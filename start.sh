#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

MODE="local"
if [[ "${1:-}" == "--docker" ]]; then
  MODE="docker"
elif [[ -n "${1:-}" && "${1:-}" != "--local" ]]; then
  echo "Usage: ./start.sh [--local|--docker]" >&2
  exit 2
fi

if [[ "$MODE" == "docker" ]]; then
  if ! command -v docker >/dev/null 2>&1; then
    echo "Docker is required for --docker mode." >&2
    exit 1
  fi
  docker compose up --build
  exit $?
fi

for command_name in npm; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Missing prerequisite: $command_name (Node.js 20+)." >&2
    exit 1
  fi
done

PYTHON=""
for candidate in python3 python py; do
  if command -v "$candidate" >/dev/null 2>&1; then
    PYTHON="$candidate"
    break
  fi
done
if [[ -z "$PYTHON" ]]; then
  echo "Missing prerequisite: Python 3.12+." >&2
  exit 1
fi

if [[ -x "backend/.venv/bin/python" ]]; then
  VENV_PYTHON="backend/.venv/bin/python"
elif [[ -x "backend/.venv/Scripts/python.exe" ]]; then
  VENV_PYTHON="backend/.venv/Scripts/python.exe"
else
  echo "Creating backend virtual environment..."
  "$PYTHON" -m venv backend/.venv
  if [[ -x "backend/.venv/bin/python" ]]; then
    VENV_PYTHON="backend/.venv/bin/python"
  else
    VENV_PYTHON="backend/.venv/Scripts/python.exe"
  fi
fi

if ! "$VENV_PYTHON" -c "import fastapi, uvicorn, sqlalchemy, networkx, sklearn, jose, passlib, email_validator" >/dev/null 2>&1; then
  echo "Installing backend dependencies..."
  "$VENV_PYTHON" -m pip install -r backend/requirements.txt
fi

if [[ ! -d frontend/node_modules ]]; then
  echo "Installing frontend dependencies..."
  (cd frontend && npm install)
fi

export DATABASE_URL="${DATABASE_URL:-sqlite:///./critpath.db}"
export SEED_DEMO="${SEED_DEMO:-true}"
export JWT_SECRET="${JWT_SECRET:-local-development-secret-change-before-deploying}"
export CORS_ORIGINS="${CORS_ORIGINS:-http://localhost:5173}"
export VITE_API_URL="${VITE_API_URL:-http://localhost:8000/api}"

API_PID=""
WEB_PID=""
shutdown() {
  trap - INT TERM EXIT
  [[ -z "$WEB_PID" ]] || kill "$WEB_PID" 2>/dev/null || true
  [[ -z "$API_PID" ]] || kill "$API_PID" 2>/dev/null || true
  [[ -z "$WEB_PID" ]] || wait "$WEB_PID" 2>/dev/null || true
  [[ -z "$API_PID" ]] || wait "$API_PID" 2>/dev/null || true
}
trap shutdown INT TERM EXIT

echo "Starting CritPath API at http://localhost:8000"
(cd backend && exec "../$VENV_PYTHON" -m uvicorn app.main:app --host 0.0.0.0 --port 8000) &
API_PID=$!
echo "Starting CritPath frontend at http://localhost:5173"
(cd frontend && exec npm run dev) &
WEB_PID=$!
echo "Both services are running. Press Ctrl+C to stop them."

while kill -0 "$API_PID" 2>/dev/null && kill -0 "$WEB_PID" 2>/dev/null; do
  sleep 1
done
set +e
wait "$API_PID"
API_STATUS=$?
wait "$WEB_PID"
WEB_STATUS=$?
set -e
if [[ "$API_STATUS" -ne 0 ]]; then exit "$API_STATUS"; fi
exit "$WEB_STATUS"
