from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from .auth import hash_password
from .models import Dependency, Pipeline, Run, Task, TaskRun, Tenant, User

SAMPLES = [
    {
        "name": "attendance_sync_daily",
        "domain": "Campus operations",
        "sla": 18,
        "tasks": [
            ("Extract attendance", 5.2, []),
            ("Validate records", 2.7, ["Extract attendance"]),
            ("Normalize IDs", 3.1, ["Extract attendance"]),
            ("Sync to SIS", 4.1, ["Validate records", "Normalize IDs"]),
            ("Publish report", 1.4, ["Sync to SIS"]),
        ],
        "health": 96,
        "factor": 0.08,
        "fail": 0,
    },
    {
        "name": "semester_result_processing",
        "domain": "Academic systems",
        "sla": 45,
        "tasks": [
            ("Ingest marks", 8.2, []),
            ("Validate grades", 6.4, ["Ingest marks"]),
            ("Calculate GPA", 12.8, ["Validate grades"]),
            ("Apply moderation", 5.6, ["Calculate GPA"]),
            ("Publish results", 4.1, ["Apply moderation"]),
        ],
        "health": 84,
        "factor": 0.16,
        "fail": 0,
    },
    {
        "name": "exam_revaluation_batch",
        "domain": "Examinations",
        "sla": 75,
        "tasks": [
            ("Load applications", 9.1, []),
            ("Match answer books", 18.2, ["Load applications"]),
            ("Regrade papers", 36.5, ["Match answer books"]),
            ("Verify changes", 11.2, ["Regrade papers"]),
            ("Update ledger", 5.8, ["Verify changes"]),
        ],
        "health": 68,
        "factor": 0.31,
        "fail": 0,
    },
    {
        "name": "placement_drive_pipeline",
        "domain": "Career services",
        "sla": 120,
        "tasks": [
            ("Import applicants", 10.8, []),
            ("Parse resumes", 21.4, ["Import applicants"]),
            ("Score candidates", 48.6, ["Parse resumes"]),
            ("Match roles", 34.2, ["Score candidates"]),
            ("Send shortlist", 12.3, ["Match roles"]),
        ],
        "health": 42,
        "factor": 0.58,
        "fail": 2,
    },
]


def seed_demo(db: Session, email: str, password: str):
    existing = db.scalar(select(User).where(User.email == email.lower()))
    if existing:
        return
    tenant = Tenant(name="Campus Data Team")
    db.add(tenant)
    db.flush()
    user = User(
        tenant_id=tenant.id,
        name="Alex Morgan",
        email=email.lower(),
        password_hash=hash_password(password),
    )
    db.add(user)
    for spec in SAMPLES:
        pipeline = Pipeline(
            tenant_id=tenant.id,
            name=spec["name"],
            domain=spec["domain"],
            sla_minutes=spec["sla"],
        )
        db.add(pipeline)
        db.flush()
        tasks = {
            name: Task(pipeline_id=pipeline.id, name=name, median_minutes=minutes)
            for name, minutes, _ in spec["tasks"]
        }
        db.add_all(tasks.values())
        db.flush()
        for name, _, deps in spec["tasks"]:
            for dep in deps:
                db.add(
                    Dependency(task_id=tasks[name].id, depends_on_task_id=tasks[dep].id)
                )
        n_runs = (
            9
            if spec["name"] in {"exam_revaluation_batch", "placement_drive_pipeline"}
            else 12
        )
        for i in range(n_runs):
            wobble = 1 + (((i * 17) % 9) - 4) * spec["factor"] / 5
            slow_tasks = set()
            if spec["name"] == "exam_revaluation_batch" and i == n_runs - 1:
                slow_tasks = {"Regrade papers", "Verify changes"}
            if spec["name"] == "placement_drive_pipeline" and i == n_runs - 1:
                slow_tasks = {"Parse resumes", "Score candidates", "Match roles"}
            start = datetime.now(timezone.utc) - timedelta(days=n_runs - i)
            failed = spec["fail"] and i in {2, 6}
            task_durations = {
                name: minutes * wobble * (1.8 if name in slow_tasks else 1)
                for name, minutes, _ in spec["tasks"]
            }
            total = sum(task_durations.values())
            run = Run(
                pipeline_id=pipeline.id,
                started_at=start,
                duration_minutes=total,
                status="failed" if failed else "success",
            )
            db.add(run)
            db.flush()
            offset = 0
            for name, minutes, _ in spec["tasks"]:
                task_start = start + timedelta(minutes=offset)
                actual = task_durations[name]
                task_end = task_start + timedelta(minutes=actual)
                db.add(
                    TaskRun(
                        run_id=run.id,
                        task_id=tasks[name].id,
                        start_time=task_start,
                        end_time=task_end,
                        duration_minutes=actual,
                        cpu_usage=min(99, 35 + actual),
                        memory_usage=min(99, 40 + actual / 2),
                        status="failed"
                        if failed and name == spec["tasks"][2][0]
                        else "success",
                    )
                )
                offset += actual
    db.commit()
