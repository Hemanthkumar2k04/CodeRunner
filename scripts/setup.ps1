<#
.SYNOPSIS
    CodeRunner Setup Script for Windows

.DESCRIPTION
    Sets up the entire CodeRunner environment:
      1. Checks prerequisites (Node.js, Docker, npm)
      2. Installs dependencies for server and client
      3. Builds all Docker runtime images
      4. Optionally configures Docker settings

.PARAMETER SkipDocker
    Skip building Docker images

.PARAMETER SkipDeps
    Skip installing npm dependencies

.PARAMETER Help
    Show help message

.EXAMPLE
    .\setup.ps1
    .\setup.ps1 -SkipDocker
    .\setup.ps1 -SkipDeps
#>

[CmdletBinding()]
param(
    [switch]$SkipDocker,
    [switch]$SkipDeps,
    [switch]$Help
)

# Error handling
$ErrorActionPreference = "Stop"

# Helper functions for colored output
function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] " -ForegroundColor Blue -NoNewline
    Write-Host $Message
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] " -ForegroundColor Green -NoNewline
    Write-Host $Message
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARN] " -ForegroundColor Yellow -NoNewline
    Write-Host $Message
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] " -ForegroundColor Red -NoNewline
    Write-Host $Message
}

# Show help if requested
if ($Help) {
    Write-Host "CodeRunner Setup Script" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage: .\setup.ps1 [options]"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -SkipDocker    Skip building Docker images"
    Write-Host "  -SkipDeps      Skip installing npm dependencies"
    Write-Host "  -Help          Show this help message"
    exit 0
}

# Script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Load environment variables from .env file if it exists
$EnvFile = Join-Path $ScriptDir "server\.env"
if (Test-Path $EnvFile) {
    Write-Info "Loading environment variables from server\.env"
    Get-Content $EnvFile | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]*)\s*=\s*(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
} else {
    Write-Warning "server\.env file not found, using defaults"
}

# Header
Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║                  CodeRunner Setup                         ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ─────────────────────────────────────────────────────────────────
# Step 1: Check Prerequisites
# ─────────────────────────────────────────────────────────────────
Write-Info "Step 1/3: Checking prerequisites..."

# Check Node.js
try {
    $nodeVersion = node --version 2>$null
    if ($LASTEXITCODE -ne 0) { throw }
    
    $nodeMajor = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
    if ($nodeMajor -lt 18) {
        Write-Error "Node.js v18+ required (found $nodeVersion)"
        Write-Host "  Install from: https://nodejs.org/" -ForegroundColor Yellow
        exit 1
    }
    Write-Success "Node.js $nodeVersion"
} catch {
    Write-Error "Node.js is not installed"
    Write-Host "  Install from: https://nodejs.org/ (v18+ required)" -ForegroundColor Yellow
    exit 1
}

# Check npm
try {
    $npmVersion = npm --version 2>$null
    if ($LASTEXITCODE -ne 0) { throw }
    Write-Success "npm $npmVersion"
} catch {
    Write-Error "npm is not installed"
    exit 1
}

# Check Docker
try {
    $dockerVersion = docker --version 2>$null
    if ($LASTEXITCODE -ne 0) { throw }
    Write-Success "Docker ($dockerVersion)"
} catch {
    Write-Error "Docker is not installed"
    Write-Host "  Install Docker Desktop from: https://docs.docker.com/desktop/install/windows-install/" -ForegroundColor Yellow
    exit 1
}

# Check Docker daemon
try {
    docker ps 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Cannot connect to Docker daemon"
        Write-Host "  Possible reasons:" -ForegroundColor Yellow
        Write-Host "  1. Docker Desktop is not running" -ForegroundColor Yellow
        Write-Host "  2. Docker service needs to be started" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Error "Cannot connect to Docker daemon"
    Write-Host "  Make sure Docker Desktop is running" -ForegroundColor Yellow
    exit 1
}

# ─────────────────────────────────────────────────────────────────
# Step 2: Install Dependencies
# ─────────────────────────────────────────────────────────────────
if (-not $SkipDeps) {
    Write-Host ""
    Write-Info "Step 2/3: Installing dependencies..."
    
    # Server Dependencies
    $ServerDir = Join-Path $ScriptDir "server"
    if (Test-Path $ServerDir) {
        Write-Info "Installing server dependencies..."
        Push-Location $ServerDir
        try {
            npm install
            if ($LASTEXITCODE -ne 0) {
                throw "Failed to install server dependencies"
            }
        } finally {
            Pop-Location
        }
    } else {
        Write-Warning "Server directory not found!"
    }
    
    # Client Dependencies
    $ClientDir = Join-Path $ScriptDir "client"
    if (Test-Path $ClientDir) {
        Write-Info "Installing client dependencies..."
        Push-Location $ClientDir
        try {
            npm install
            if ($LASTEXITCODE -ne 0) {
                throw "Failed to install client dependencies"
            }
        } finally {
            Pop-Location
        }
    } else {
        Write-Warning "Client directory not found!"
    }
} else {
    Write-Host ""
    Write-Info "Step 2/3: Skipping dependencies installation"
}

# ─────────────────────────────────────────────────────────────────
# Step 3: Build Runtime Images
# ─────────────────────────────────────────────────────────────────
if (-not $SkipDocker) {
    Write-Host ""
    Write-Info "Step 3/3: Building runtime images..."
    
    $RuntimesDir = Join-Path $ScriptDir "runtimes"
    if (Test-Path $RuntimesDir) {
        $runtimes = Get-ChildItem -Path $RuntimesDir -Directory
        
        foreach ($runtime in $runtimes) {
            $lang = $runtime.Name
            $imageName = "$lang-runtime"
            
            Write-Info "Building ${imageName}..."
            
            try {
                docker build -q -t $imageName $runtime.FullName 2>&1 | Out-Null
                if ($LASTEXITCODE -eq 0) {
                    Write-Success "Built ${imageName}"
                } else {
                    Write-Error "Failed to build ${imageName}"
                    exit 1
                }
            } catch {
                Write-Error "Failed to build ${imageName}"
                exit 1
            }
        }
    } else {
        Write-Warning "Runtimes directory not found at $RuntimesDir"
    }
} else {
    Write-Host ""
    Write-Info "Step 3/3: Skipping Docker build"
}

# ─────────────────────────────────────────────────────────────────
# Completion
# ─────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║             Setup Completed Successfully!                 ║" -ForegroundColor Green
Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "To start the development server:"
Write-Host "  cd server" -ForegroundColor Cyan
Write-Host "  npm run dev" -ForegroundColor Cyan
Write-Host ""
Write-Host "To start the client:"
Write-Host "  cd client" -ForegroundColor Cyan
Write-Host "  npm run dev" -ForegroundColor Cyan
Write-Host ""
