from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def now_utc():
    return datetime.now(timezone.utc)


class Tenant(Base):
    __tablename__ = "tenants"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc
    )
    users: Mapped[list["User"]] = relationship(back_populates="tenant")


class User(Base):
    __tablename__ = "users"
    __table_args__ = (UniqueConstraint("tenant_id", "email"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    tenant: Mapped[Tenant] = relationship(back_populates="users")


class Pipeline(Base):
    __tablename__ = "pipelines"
    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(180))
    domain: Mapped[str] = mapped_column(String(120), default="Uploaded pipeline")
    sla_minutes: Mapped[float] = mapped_column(Float, default=60)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc
    )
    tasks: Mapped[list["Task"]] = relationship(
        back_populates="pipeline", cascade="all, delete-orphan"
    )
    runs: Mapped[list["Run"]] = relationship(
        back_populates="pipeline", cascade="all, delete-orphan"
    )


class Task(Base):
    __tablename__ = "tasks"
    id: Mapped[int] = mapped_column(primary_key=True)
    pipeline_id: Mapped[int] = mapped_column(
        ForeignKey("pipelines.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(180))
    median_minutes: Mapped[float] = mapped_column(Float, default=0)
    pipeline: Mapped[Pipeline] = relationship(back_populates="tasks")
    dependencies: Mapped[list["Dependency"]] = relationship(
        foreign_keys="Dependency.task_id", cascade="all, delete-orphan"
    )


class Dependency(Base):
    __tablename__ = "dependencies"
    __table_args__ = (UniqueConstraint("task_id", "depends_on_task_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    task_id: Mapped[int] = mapped_column(
        ForeignKey("tasks.id", ondelete="CASCADE"), index=True
    )
    depends_on_task_id: Mapped[int] = mapped_column(
        ForeignKey("tasks.id", ondelete="CASCADE"), index=True
    )


class Run(Base):
    __tablename__ = "runs"
    id: Mapped[int] = mapped_column(primary_key=True)
    pipeline_id: Mapped[int] = mapped_column(
        ForeignKey("pipelines.id", ondelete="CASCADE"), index=True
    )
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    duration_minutes: Mapped[float] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(30), default="success")
    pipeline: Mapped[Pipeline] = relationship(back_populates="runs")
    task_runs: Mapped[list["TaskRun"]] = relationship(
        back_populates="run", cascade="all, delete-orphan"
    )


class TaskRun(Base):
    __tablename__ = "task_runs"
    id: Mapped[int] = mapped_column(primary_key=True)
    run_id: Mapped[int] = mapped_column(
        ForeignKey("runs.id", ondelete="CASCADE"), index=True
    )
    task_id: Mapped[int] = mapped_column(
        ForeignKey("tasks.id", ondelete="CASCADE"), index=True
    )
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    duration_minutes: Mapped[float] = mapped_column(Float)
    cpu_usage: Mapped[float] = mapped_column(Float, default=0)
    memory_usage: Mapped[float] = mapped_column(Float, default=0)
    status: Mapped[str] = mapped_column(String(30), default="success")
    run: Mapped[Run] = relationship(back_populates="task_runs")
