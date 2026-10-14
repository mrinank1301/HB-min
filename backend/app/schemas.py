from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class RegisterIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    organization: str = Field(min_length=1, max_length=120)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    name: str


class TaskIn(BaseModel):
    name: str
    dependencies: list[str] = []


class PipelineCreate(BaseModel):
    name: str
    domain: str = "Uploaded pipeline"
    sla_minutes: float = Field(gt=0)
    tasks: list[TaskIn]


class TaskLogIn(BaseModel):
    task_name: str
    start_time: datetime
    end_time: datetime
    cpu_usage: float = 0
    memory_usage: float = 0
    status: str = "success"


class LogsIn(BaseModel):
    rows: list[TaskLogIn]
