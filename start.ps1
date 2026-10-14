[CmdletBinding()]
param(
    [switch] $Docker
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = $PSScriptRoot
Set-Location -LiteralPath $ProjectRoot

function Stop-ProcessTree {
    param([System.Diagnostics.Process] $Process)

    if ($null -eq $Process -or $Process.HasExited) {
        return
    }

    & taskkill.exe /PID $Process.Id /T /F 2>$null | Out-Null
    if (-not $Process.HasExited) {
        Stop-Process -Id $Process.Id -Force -ErrorAction SilentlyContinue
    }
}

if ($Docker) {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        throw 'Docker is required when using -Docker.'
    }

    & docker compose up --build
    exit $LASTEXITCODE
}

$PythonCommand = Get-Command python -ErrorAction SilentlyContinue
if (-not $PythonCommand) {
    $PythonCommand = Get-Command py -ErrorAction SilentlyContinue
}
if (-not $PythonCommand) {
    throw 'Python is required. Install Python 3.12 or newer and run this script again.'
}

$NpmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $NpmCommand) {
    throw 'Node.js and npm are required. Install Node.js 20 or newer and run this script again.'
}

$BackendPath = Join-Path $ProjectRoot 'backend'
$FrontendPath = Join-Path $ProjectRoot 'frontend'
$VenvPath = Join-Path $BackendPath '.venv'
$VenvPython = Join-Path $VenvPath 'Scripts\python.exe'

if (-not (Test-Path -LiteralPath $VenvPython)) {
    Write-Host 'Creating backend virtual environment...'
    & $PythonCommand.Source -m venv $VenvPath
    if ($LASTEXITCODE -ne 0) {
        throw 'Could not create the backend virtual environment.'
    }
}

& $VenvPython -c 'import fastapi, uvicorn, sqlalchemy, networkx, sklearn, jose, passlib, email_validator' 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host 'Installing backend dependencies...'
    & $VenvPython -m pip install -r (Join-Path $BackendPath 'requirements.txt')
    if ($LASTEXITCODE -ne 0) {
        throw 'Backend dependency installation failed.'
    }
}

if (-not (Test-Path -LiteralPath (Join-Path $FrontendPath 'node_modules'))) {
    Write-Host 'Installing frontend dependencies...'
    Push-Location $FrontendPath
    try {
        & $NpmCommand.Source install
        if ($LASTEXITCODE -ne 0) {
            throw 'Frontend dependency installation failed.'
        }
    } finally {
        Pop-Location
    }
}

$env:DATABASE_URL = if ($env:DATABASE_URL) { $env:DATABASE_URL } else { 'sqlite:///./critpath.db' }
$env:SEED_DEMO = if ($env:SEED_DEMO) { $env:SEED_DEMO } else { 'true' }
$env:JWT_SECRET = if ($env:JWT_SECRET) { $env:JWT_SECRET } else { 'local-development-secret-change-before-deploying' }
$env:CORS_ORIGINS = if ($env:CORS_ORIGINS) { $env:CORS_ORIGINS } else { 'http://localhost:5173' }
$env:VITE_API_URL = if ($env:VITE_API_URL) { $env:VITE_API_URL } else { 'http://localhost:8000/api' }

$ApiProcess = $null
$FrontendProcess = $null

try {
    Write-Host 'Starting CritPath API at http://localhost:8000'
    $ApiProcess = Start-Process `
        -FilePath $VenvPython `
        -ArgumentList @('-m', 'uvicorn', 'app.main:app', '--host', '0.0.0.0', '--port', '8000') `
        -WorkingDirectory $BackendPath `
        -NoNewWindow `
        -PassThru

    Write-Host 'Starting CritPath frontend at http://localhost:5173'
    $FrontendProcess = Start-Process `
        -FilePath $NpmCommand.Source `
        -ArgumentList @('run', 'dev') `
        -WorkingDirectory $FrontendPath `
        -NoNewWindow `
        -PassThru

    Write-Host 'Both services are running in this terminal. Press Ctrl+C to stop them.'
    Write-Host 'Demo login: demo@critpath.io / critpath-demo'

    while (-not $ApiProcess.HasExited -and -not $FrontendProcess.HasExited) {
        Start-Sleep -Seconds 1
    }

    if ($ApiProcess.HasExited -and $ApiProcess.ExitCode -ne 0) {
        throw "The API stopped with exit code $($ApiProcess.ExitCode)."
    }
    if ($FrontendProcess.HasExited -and $FrontendProcess.ExitCode -ne 0) {
        throw "The frontend stopped with exit code $($FrontendProcess.ExitCode)."
    }
} finally {
    Stop-ProcessTree $FrontendProcess
    Stop-ProcessTree $ApiProcess
}
