# oc-router Installation Script
# Installs oc-router globally

$ErrorActionPreference = "Stop"

# Color helpers
function Write-ColorHost($message, $color) {
    Write-Host $message -ForegroundColor $color
}

function Write-Step($message) {
    Write-Host $message -ForegroundColor Cyan
}

function Write-Success($message) {
    Write-Host $message -ForegroundColor Green
}

function Write-Error($message) {
    Write-Host $message -ForegroundColor Red
}

function Write-Info($message) {
    Write-Host $message -ForegroundColor Yellow
}

Write-Step "🚀 Installing oc-router..."

try {
    # Get repository root directory (relative to script location)
    $repoRoot = Split-Path -Parent -Path $MyInvocation.MyCommand.Path

    # Add npm bin dir to PATH for current session
    $npmBinDir = Join-Path $env:APPDATA "npm"
    if (-not ($env:PATH.Split(";") | Where-Object { $_ -eq $npmBinDir })) {
        Write-Info "Adding $npmBinDir to PATH for this session..."
        $env:PATH = "$npmBinDir;$env:PATH"
    }

    # Check if Node.js is installed
    $nodeVersion = $null
    try {
        $nodeVersion = node --version 2>$null
    } catch {
        $nodeVersion = $null
    }

    if (-not $nodeVersion) {
        Write-Error "❌ Node.js is not installed. Please install Node.js first."
        Write-Info "   Download from: https://nodejs.org/"
        exit 1
    }

    # Check Node version (require 18+)
    $nodeMajor = [int]($nodeVersion -replace '^v(\d+).*', '$1')
    if ($nodeMajor -lt 18) {
        Write-Error "❌ Node.js $nodeVersion is too old. oc-router requires Node.js 18+."
        exit 1
    }
    Write-Success "✓ Node.js $nodeVersion found"

    # Check npm
    $npmVersion = $null
    try {
        $npmVersion = npm --version 2>$null
    } catch {
        $npmVersion = $null
    }

    if (-not $npmVersion) {
        Write-Error "❌ npm is not installed. Please install npm first."
        exit 1
    }
    Write-Success "✓ npm v$npmVersion found"

    # Build the project first
    Write-Step "🔨 Building oc-router..."
    Push-Location $repoRoot

    if (Test-Path "package.json") {
        npm install --loglevel=error
        try {
            npm run build 2>$null
            Write-Success "✓ Build successful"
        } catch {
            Write-Info "⚠ Build step skipped or failed (continuing with install)"
        }
    }

    # Install globally
    Write-Step "📦 Installing oc-router globally..."
    npm install -g .

    Pop-Location

    # Verify installation
    $installed = $false
    $installedVersion = $null
    try {
        $installedVersion = oc-router --version 2>$null
        if ($LASTEXITCODE -eq 0 -and $installedVersion) {
            $installed = $true
        }
    } catch {
        $installed = $false
    }

    Write-Host ""
    if ($installed) {
        Write-Success "✅ oc-router v$installedVersion installed successfully!"
    } else {
        Write-Success "✅ oc-router installed successfully!"
        Write-Info "Note: You may need to restart your terminal or reload your PATH."
    }

    # Initialize oc-router configuration (update OpenCode config, create plugin and agents)
    Write-Host ""
    Write-Step "⚙️ Configuring oc-router..."
    try {
        oc-router init --global --yes 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Success "✓ oc-router configured successfully"
        } else {
            Write-Info "⚠ Could not configure automatically. Run manually: oc-router init --global"
        }
    } catch {
        Write-Info "⚠ Could not configure automatically. Run manually: oc-router init --global"
    }

    Write-Host ""
    Write-Info "To verify, run: oc-router --version"
    Write-Info "To check status, run: oc-router status"

} catch {
    Write-Error "❌ Installation failed: $_"
    Pop-Location 2>$null
    exit 1
}