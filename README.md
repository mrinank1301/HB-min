# CritPath

Pipeline intelligence for small data teams. CritPath calculates weighted DAG critical paths, identifies slow tasks, scores pipeline health, forecasts SLA risk, and provides prioritized recommendations.

## Run locally with Docker Compose

Prerequisites: Docker Desktop with Compose enabled.

1. Copy `.env.example` to `.env` and replace `JWT_SECRET` and `POSTGRES_PASSWORD` for any non-demo deployment.
2. From this directory, run:

   ```sh
   docker compose up --build
   ```

3. Open [http://localhost:5173](http://localhost:5173).
4. Sign in with the seeded demo account:

   - Email: `demo@critpath.io`
   - Password: `critpath-demo`

   Or create another tenant using the sign-up link. Demo credentials are configurable through `.env`.

The API is available at [http://localhost:8000](http://localhost:8000) and interactive API docs at [http://localhost:8000/docs](http://localhost:8000/docs).

## Start both services in one terminal

On Linux, macOS, WSL, or Git Bash, run:

```sh
bash start.sh
```

The script creates the backend virtual environment and installs dependencies on the first run, then starts FastAPI and Vite together. Press Ctrl+C to stop both. It uses SQLite for this local mode. To use Docker Compose from the same script instead, run `bash start.sh --docker`.

On Windows PowerShell, run:

```powershell
.\start.ps1
```

This starts both services in the same terminal and stops their process trees with Ctrl+C. Use `.start.ps1 -Docker` to start the Docker Compose stack instead.

## Project layout

```text
backend/
  app/
    analysis.py       # NetworkX critical path, health, forecasts, recommendations
    auth.py           # Password hashing, JWT issuance and tenant-aware auth
    config.py         # Environment configuration
    database.py       # SQLAlchemy engine and sessions
    main.py           # FastAPI routes and CSV/JSON ingestion
    models.py         # Tenant, user, pipeline, task, dependency, run models
    schemas.py        # API request/response validation
    seed.py           # Four campus demo pipelines
  Dockerfile
  requirements.txt
frontend/
  src/
    components/
      AppShell.jsx    # Sidebar, navigation, header, and page container
      Badge.jsx
      FilePick.jsx
      StatCard.jsx
    pages/
      LoginPage.jsx
      DashboardPage.jsx
      UploadPage.jsx
      PipelineDetailPage.jsx
      TrendsPage.jsx
    utils/
      format.js       # Shared labels and duration formatting
    api.js            # Authenticated API client
    App.jsx           # Session state and page composition
    main.jsx          # React entry point
    styles.css
  Dockerfile
  package.json
  vite.config.js
docker-compose.yml
```

## Data format

Upload a CSV with columns `task_name,start_time,end_time,cpu_usage,memory_usage,status` and a JSON dependency map. Dependencies mean *prerequisites* of the named task:

```json
{
  "extract": [],
  "transform": ["extract"],
  "publish": ["transform"]
}
```

Use ISO 8601 timestamps. Rows are grouped into pipeline runs by the calendar date of `start_time`; this matches daily batch logs and makes historical forecasts possible. Each task name in the CSV must appear in the dependency JSON. Cycles are rejected. Uploads are stored under the signed-in tenant.

## Analysis behavior

- Task weights are median task durations; NetworkX finds the longest dependency path.
- A task is a bottleneck when its latest observed runtime is greater than 1.5 times its median.
- Health is clamped to 0–100 using `100 - 15*bottlenecks - 25*failure_rate - 10*runtime_variance_z`. Runtime variance z is implemented as the coefficient of variation of pipeline run durations, capped at 3.
- With at least five historical runs, a 200-tree `RandomForestRegressor` (maximum depth 8) predicts the next duration. The interval is ±15%. Under five runs, CritPath uses the sum of task medians plus 10%.
- Recommendations sort critical-path bottlenecks before other signals.

## Local development without Docker

Backend (Python 3.12 recommended):

```sh
cd backend
python -m venv .venv
# Activate .venv, then:
pip install -r requirements.txt
$env:DATABASE_URL="sqlite:///./critpath.db"  # PowerShell; use export on macOS/Linux
$env:SEED_DEMO="true"
uvicorn app.main:app --reload
```

Frontend (Node 20+):

```sh
cd frontend
npm install
npm run dev
```

Set `VITE_API_URL` if the API is not at `http://localhost:8000/api`.

## Code formatting

- Python: `ruff format backend/app`
- Frontend: from `frontend`, run `npm install` then `npm run format` (Prettier).
- The root `.editorconfig`, `pyproject.toml`, and `.prettierrc.json` hold shared formatting rules.

## Current scope

This is a runnable MVP. JWT auth and tenant scoping are implemented, while account recovery, invitations/roles, Alembic migrations, automated tests, production deployment hardening, and background prediction jobs are future work. The Compose setup is intended for local development, not production as-is.
