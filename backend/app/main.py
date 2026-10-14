import csv
import io
from collections import defaultdict
from datetime import datetime, timezone

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.orm import Session

from .analysis import analyze
from .auth import current_user, hash_password, issue_token, verify_password
from .config import settings
from .database import Base, SessionLocal, engine, get_db
from .models import Dependency, Pipeline, Run, Task, TaskRun, Tenant, User
from .schemas import LoginIn, PipelineCreate, RegisterIn, TaskIn, TokenOut
from .seed import seed_demo

app = FastAPI(
    title="CritPath API",
    version="1.0.0",
    description="Pipeline health and critical path analysis",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)
    if settings.seed_demo:
        with SessionLocal() as db:
            seed_demo(db, settings.demo_email, settings.demo_password)


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "critpath-api"}


@app.post("/api/auth/register", response_model=TokenOut)
def register(payload: RegisterIn, db: Session = Depends(get_db)):
    if db.scalar(select(User).where(User.email == payload.email.lower())):
        raise HTTPException(409, "An account with this email already exists")
    tenant = Tenant(name=payload.organization)
    db.add(tenant)
    db.flush()
    user = User(
        tenant_id=tenant.id,
        name=payload.name,
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"access_token": issue_token(user), "name": user.name}


@app.post("/api/auth/login", response_model=TokenOut)
def login(payload: LoginIn, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(401, "Email or password is incorrect")
    return {"access_token": issue_token(user), "name": user.name}


@app.get("/api/auth/me")
def me(user: User = Depends(current_user)):
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "organization": user.tenant.name,
    }


def owned_pipeline(db: Session, user: User, pipeline_id: int) -> Pipeline:
    pipeline = db.scalar(
        select(Pipeline).where(
            Pipeline.id == pipeline_id, Pipeline.tenant_id == user.tenant_id
        )
    )
    if not pipeline:
        raise HTTPException(404, "Pipeline not found")
    return pipeline


@app.get("/api/pipelines")
def list_pipelines(db: Session = Depends(get_db), user: User = Depends(current_user)):
    pipelines = db.scalars(
        select(Pipeline)
        .where(Pipeline.tenant_id == user.tenant_id)
        .order_by(Pipeline.id)
    ).all()
    result = []
    for pipeline in pipelines:
        metrics = analyze(pipeline)
        result.append(
            {
                "id": pipeline.id,
                "name": pipeline.name,
                "domain": pipeline.domain,
                "sla_minutes": pipeline.sla_minutes,
                "median_runtime": metrics["critical_path_minutes"],
                "health": metrics["health"],
                "status": metrics["status"],
                "run_count": metrics["run_count"],
                "prediction": metrics["prediction"],
                "bottleneck_count": len(metrics["bottlenecks"]),
            }
        )
    return result


@app.get("/api/pipelines/{pipeline_id}")
def pipeline_detail(
    pipeline_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)
):
    pipeline = owned_pipeline(db, user, pipeline_id)
    return {
        "id": pipeline.id,
        "name": pipeline.name,
        "domain": pipeline.domain,
        "sla_minutes": pipeline.sla_minutes,
        **analyze(pipeline),
    }


@app.post("/api/pipelines")
def create_pipeline(
    payload: PipelineCreate,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    names = [task.name for task in payload.tasks]
    if len(names) != len(set(names)) or not names:
        raise HTTPException(
            422, "Pipeline tasks must have unique names and include at least one task"
        )
    by_name = {task.name: task for task in payload.tasks}
    for task in payload.tasks:
        if any(dep not in by_name for dep in task.dependencies):
            raise HTTPException(422, f"Unknown dependency listed for {task.name}")
    pipeline = Pipeline(
        tenant_id=user.tenant_id,
        name=payload.name,
        domain=payload.domain,
        sla_minutes=payload.sla_minutes,
    )
    db.add(pipeline)
    db.flush()
    tasks = {
        name: Task(pipeline_id=pipeline.id, name=name, median_minutes=0)
        for name in names
    }
    db.add_all(tasks.values())
    db.flush()
    for name, item in by_name.items():
        for dep_name in item.dependencies:
            db.add(
                Dependency(
                    task_id=tasks[name].id, depends_on_task_id=tasks[dep_name].id
                )
            )
    db.commit()
    db.refresh(pipeline)
    return {"id": pipeline.id, "name": pipeline.name}


@app.post("/api/pipelines/upload")
async def upload_pipeline(
    name: str = Form(...),
    domain: str = Form("Uploaded pipeline"),
    sla_minutes: float = Form(...),
    dependencies_file: UploadFile = File(...),
    task_log: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    try:
        if sla_minutes <= 0:
            raise ValueError("SLA target must be greater than zero")
        dependency_data = __import__("json").loads(
            (await dependencies_file.read()).decode("utf-8-sig")
        )
        raw = (await task_log.read()).decode("utf-8-sig")
        rows = list(csv.DictReader(io.StringIO(raw)))
        if not rows:
            raise ValueError("CSV has no data rows")
        required = {
            "task_name",
            "start_time",
            "end_time",
            "cpu_usage",
            "memory_usage",
            "status",
        }
        headers = set(rows[0].keys())
        if not {"task_name", "start_time", "end_time", "status"}.issubset(headers):
            raise ValueError(
                "CSV requires task_name, start_time, end_time, and status headers"
            )
        if isinstance(dependency_data, list):
            dependency_data = {
                item["task_name"]: item.get("dependencies", [])
                for item in dependency_data
            }
        if not isinstance(dependency_data, dict):
            raise ValueError(
                "Dependency JSON must map each task to a list of prerequisites"
            )

        def parse_time(value):
            dt = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
            return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt

        parsed = []
        for row in rows:
            start, end = parse_time(row["start_time"]), parse_time(row["end_time"])
            minutes = (end - start).total_seconds() / 60
            if minutes < 0:
                raise ValueError("end_time occurs before start_time")
            parsed.append({**row, "start": start, "end": end, "minutes": minutes})
        task_names = list(dict.fromkeys(row["task_name"].strip() for row in parsed))
        if any(not name for name in task_names):
            raise ValueError("task_name cannot be blank")
        if set(task_names) - set(dependency_data):
            raise ValueError("Dependency JSON is missing one or more CSV tasks")
        if any(
            dep not in task_names
            for values in dependency_data.values()
            for dep in values
        ):
            raise ValueError(
                "Dependency JSON refers to a task that is absent from the CSV"
            )
        graph = __import__("networkx").DiGraph()
        graph.add_nodes_from(task_names)
        for task_name, deps in dependency_data.items():
            if not isinstance(deps, list):
                raise ValueError(f"Dependencies for {task_name} must be an array")
            graph.add_edges_from((dep, task_name) for dep in deps)
        if not __import__("networkx").is_directed_acyclic_graph(graph):
            raise ValueError("Dependency graph contains a cycle")
        grouped = defaultdict(list)
        for row in parsed:
            grouped[row["start"].date().isoformat()].append(row)
        pipeline = Pipeline(
            tenant_id=user.tenant_id, name=name, domain=domain, sla_minutes=sla_minutes
        )
        db.add(pipeline)
        db.flush()
        medians = {}
        for task_name in task_names:
            vals = sorted(
                row["minutes"]
                for row in parsed
                if row["task_name"].strip() == task_name
            )
            medians[task_name] = vals[len(vals) // 2]
        task_models = {
            task_name: Task(
                pipeline_id=pipeline.id,
                name=task_name,
                median_minutes=medians[task_name],
            )
            for task_name in task_names
        }
        db.add_all(task_models.values())
        db.flush()
        for task_name, deps in dependency_data.items():
            for dep in deps:
                db.add(
                    Dependency(
                        task_id=task_models[task_name].id,
                        depends_on_task_id=task_models[dep].id,
                    )
                )
        for date_key, runrows in sorted(grouped.items()):
            duration = max(row["end"] for row in runrows) - min(
                row["start"] for row in runrows
            )
            statuses = {row["status"].lower() for row in runrows}
            status = (
                "success" if statuses <= {"success", "completed", "ok"} else "failed"
            )
            run = Run(
                pipeline_id=pipeline.id,
                started_at=min(row["start"] for row in runrows),
                duration_minutes=duration.total_seconds() / 60,
                status=status,
            )
            db.add(run)
            db.flush()
            for row in runrows:
                db.add(
                    TaskRun(
                        run_id=run.id,
                        task_id=task_models[row["task_name"].strip()].id,
                        start_time=row["start"],
                        end_time=row["end"],
                        duration_minutes=row["minutes"],
                        cpu_usage=float(row.get("cpu_usage") or 0),
                        memory_usage=float(row.get("memory_usage") or 0),
                        status=row["status"],
                    )
                )
        db.commit()
        return {"id": pipeline.id, "name": pipeline.name, "run_count": len(grouped)}
    except (ValueError, KeyError, TypeError, __import__("json").JSONDecodeError) as exc:
        db.rollback()
        raise HTTPException(422, str(exc))


@app.delete("/api/pipelines/{pipeline_id}")
def delete_pipeline(
    pipeline_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)
):
    pipeline = owned_pipeline(db, user, pipeline_id)
    db.delete(pipeline)
    db.commit()
    return {"deleted": True}
