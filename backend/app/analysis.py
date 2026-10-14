from collections import defaultdict
from statistics import median, pstdev

import networkx as nx
import numpy as np
from sklearn.ensemble import RandomForestRegressor

from .models import Pipeline, Run, Task, TaskRun


def analyze(pipeline: Pipeline) -> dict:
    tasks = pipeline.tasks
    task_by_id = {t.id: t for t in tasks}
    graph = nx.DiGraph()
    for task in tasks:
        graph.add_node(task.id, name=task.name, weight=max(task.median_minutes, 0))
    deps_by_task: dict[int, list[int]] = defaultdict(list)
    for task in tasks:
        for dep in task.dependencies:
            deps_by_task[task.id].append(dep.depends_on_task_id)
            graph.add_edge(dep.depends_on_task_id, task.id)
    if not nx.is_directed_acyclic_graph(graph):
        raise ValueError("Dependency graph contains a cycle")
    # `dag_longest_path` weights edges. CritPath weights tasks, so accumulate
    # each node's median runtime while walking a topological ordering.
    finish: dict[int, float] = {}
    previous: dict[int, int | None] = {}
    for node_id in nx.topological_sort(graph):
        predecessors = list(graph.predecessors(node_id))
        parent = max(predecessors, key=lambda p: finish[p], default=None)
        finish[node_id] = graph.nodes[node_id]["weight"] + (
            finish[parent] if parent is not None else 0
        )
        previous[node_id] = parent
    end_id = max(finish, key=finish.get, default=None)
    path_ids = []
    while end_id is not None:
        path_ids.append(end_id)
        end_id = previous[end_id]
    path_ids.reverse()
    path = [task_by_id[i].name for i in path_ids]
    cp_minutes = sum(task_by_id[i].median_minutes for i in path_ids)

    runs = sorted(pipeline.runs, key=lambda r: r.started_at)
    task_runs: dict[int, list[TaskRun]] = defaultdict(list)
    for run in runs:
        for tr in run.task_runs:
            task_runs[tr.task_id].append(tr)
    bottlenecks = []
    task_rows = []
    pathset = set(path_ids)
    for task in tasks:
        observed = sorted(task_runs[task.id], key=lambda r: r.end_time)
        durations = [r.duration_minutes for r in observed]
        med = median(durations) if durations else task.median_minutes
        latest = durations[-1] if durations else None
        flagged = latest is not None and med > 0 and latest > 1.5 * med
        if flagged:
            bottlenecks.append(task.name)
        task_rows.append(
            {
                "id": task.id,
                "name": task.name,
                "median_minutes": round(med, 2),
                "latest_minutes": round(latest, 2) if latest is not None else None,
                "change_ratio": round(latest / med, 3)
                if latest is not None and med
                else None,
                "bottleneck": flagged,
                "critical_path": task.id in pathset,
                "dependencies": [
                    task_by_id[x].name for x in deps_by_task[task.id] if x in task_by_id
                ],
            }
        )

    durations = [r.duration_minutes for r in runs]
    failure_rate = (
        sum(r.status.lower() not in {"success", "completed", "ok"} for r in runs)
        / len(runs)
        if runs
        else 0
    )
    runtime_variance_z = 0.0
    if len(durations) > 1 and median(durations) > 0:
        runtime_variance_z = min(3.0, pstdev(durations) / median(durations))
    health = max(
        0,
        min(
            100,
            round(
                100
                - 15 * len(bottlenecks)
                - 25 * failure_rate
                - 10 * runtime_variance_z
            ),
        ),
    )
    if health >= 80:
        status = "good"
    elif health >= 60:
        status = "warning"
    else:
        status = "critical"

    if len(durations) >= 5:
        x = np.arange(len(durations)).reshape(-1, 1)
        model = RandomForestRegressor(n_estimators=200, max_depth=8, random_state=42)
        model.fit(x, np.array(durations))
        prediction = max(0, float(model.predict(np.array([[len(durations)]]))[0]))
        method = "random_forest"
    else:
        prediction = sum(t.median_minutes for t in tasks) * 1.10
        method = "median_fallback"
    low, high = prediction * 0.85, prediction * 1.15
    if low > pipeline.sla_minutes:
        prediction_tag = "PREDICTED BREACH"
    elif prediction > pipeline.sla_minutes:
        prediction_tag = "LIKELY BREACH"
    else:
        prediction_tag = "UNDER SLA"
    recommendations = []
    for name in bottlenecks:
        row = next(x for x in task_rows if x["name"] == name)
        recommendations.append(
            {
                "priority": 1 if row["critical_path"] else 2,
                "task": name,
                "title": f"Review {name} capacity",
                "body": f"Latest runtime is {row['change_ratio']:.1f}× its median. Check worker capacity, queue time, and upstream handoffs.",
            }
        )
    if prediction_tag != "UNDER SLA":
        recommendations.append(
            {
                "priority": 3,
                "task": None,
                "title": "Add an early SLA alert",
                "body": f"Forecast is {prediction:.1f} minutes against a {pipeline.sla_minutes:.1f} minute SLA. Alert before the run reaches 80% of the SLA.",
            }
        )
    if not recommendations:
        recommendations.append(
            {
                "priority": 1,
                "task": None,
                "title": "Protect the critical path",
                "body": "Keep the longest dependency chain unblocked and monitor task runtimes on each scheduled run.",
            }
        )
    recommendations.sort(key=lambda r: (r["priority"], r["task"] or ""))
    return {
        "health": health,
        "status": status,
        "run_count": len(runs),
        "failure_rate": failure_rate,
        "runtime_variance_z": runtime_variance_z,
        "bottlenecks": bottlenecks,
        "critical_path": path,
        "critical_path_minutes": round(cp_minutes, 2),
        "tasks": task_rows,
        "prediction": {
            "minutes": round(prediction, 2),
            "low": round(low, 2),
            "high": round(high, 2),
            "sla_minutes": pipeline.sla_minutes,
            "tag": prediction_tag,
            "method": method,
        },
        "history": [
            {
                "id": r.id,
                "started_at": r.started_at.isoformat(),
                "minutes": round(r.duration_minutes, 2),
                "status": r.status,
            }
            for r in runs
        ],
        "recommendations": recommendations,
    }
