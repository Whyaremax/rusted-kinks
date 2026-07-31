[CmdletBinding()]
param(
    [ValidateSet("Install", "Status", "Configure", "Uninstall")]
    [string]$Action = "Status",
    [string]$GameRoot,
    [ValidateSet("quality", "fast", "human")]
    [string]$PathfindingMode = "fast",
    [ValidateSet("auto", "original", "full", "mobile")]
    [string]$TextureMode = "auto",
    [ValidateSet("optimized", "original")]
    [string]$SourceMode = "optimized",
    [switch]$NoSourceOptimizations
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($GameRoot)) {
    $GameRoot = Read-Host "Path to your Kinky Dungeon installation"
}
if ([string]::IsNullOrWhiteSpace($GameRoot)) {
    throw "GameRoot is required."
}

$resolvedGameRoot = (Resolve-Path -LiteralPath $GameRoot).Path
$directIndex = Join-Path $resolvedGameRoot "index.html"
$nestedAppRoot = Join-Path $resolvedGameRoot "resources\app"
if (
    (Test-Path -LiteralPath $directIndex -PathType Leaf) -and
    (Test-Path -LiteralPath (Join-Path $resolvedGameRoot "out\main.js") -PathType Leaf)
) {
    $appRoot = $resolvedGameRoot
} elseif (
    (Test-Path -LiteralPath (Join-Path $nestedAppRoot "index.html") -PathType Leaf) -and
    (Test-Path -LiteralPath (Join-Path $nestedAppRoot "out\main.js") -PathType Leaf)
) {
    $appRoot = $nestedAppRoot
} else {
    throw "Could not find resources\app\index.html and out\main.js under: $resolvedGameRoot"
}

$nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
if (-not $nodeCommand) {
    $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
}
if (-not $nodeCommand) {
    throw "Node.js 22 or newer is required. Install it from https://nodejs.org/ and try again."
}

$nodeVersionText = & $nodeCommand.Source --version
if ($LASTEXITCODE -ne 0 -or $nodeVersionText -notmatch '^v(\d+)') {
    throw "Could not determine the installed Node.js version."
}
if ([int]$matches[1] -lt 22) {
    throw "Node.js 22 or newer is required; found $nodeVersionText."
}

$tool = Join-Path $PSScriptRoot "tools\kd-hybrid-tool.mjs"
if (-not (Test-Path -LiteralPath $tool -PathType Leaf)) {
    throw "The redistribution kit is incomplete: tools\kd-hybrid-tool.mjs is missing."
}

$arguments = @(
    $tool,
    $Action.ToLowerInvariant(),
    "--app-root",
    $appRoot
)
if ($Action -eq "Install") {
    $sourceOptimizations = $SourceMode -eq "optimized"
    if ($NoSourceOptimizations) {
        if (
            $PSBoundParameters.ContainsKey("SourceMode") -and
            $SourceMode -ne "original"
        ) {
            throw "-NoSourceOptimizations conflicts with -SourceMode optimized."
        }
        $sourceOptimizations = $false
    }
    $payload = Join-Path $PSScriptRoot "bootstrap"
    if (-not (Test-Path -LiteralPath (Join-Path $payload "version.json") -PathType Leaf)) {
        throw "The redistribution kit is incomplete: bootstrap\version.json is missing."
    }
    $arguments += @(
        "--payload",
        $payload,
        "--upstream-version",
        "5.4.92",
        "--pathfinding-mode",
        $PathfindingMode,
        "--texture-mode",
        $TextureMode,
        "--source-optimizations",
        $sourceOptimizations.ToString().ToLowerInvariant()
    )
} elseif ($Action -eq "Configure") {
    $settingsAdded = 0
    if ($PSBoundParameters.ContainsKey("PathfindingMode")) {
        $arguments += @(
            "--pathfinding-mode",
            $PathfindingMode
        )
        $settingsAdded += 1
    }
    if ($PSBoundParameters.ContainsKey("TextureMode")) {
        $arguments += @(
            "--texture-mode",
            $TextureMode
        )
        $settingsAdded += 1
    }
    if ($PSBoundParameters.ContainsKey("SourceMode")) {
        $arguments += @(
            "--source-optimizations",
            ($SourceMode -eq "optimized").ToString().ToLowerInvariant()
        )
        $settingsAdded += 1
    }
    if ($NoSourceOptimizations) {
        if (
            $PSBoundParameters.ContainsKey("SourceMode") -and
            $SourceMode -ne "original"
        ) {
            throw "-NoSourceOptimizations conflicts with -SourceMode optimized."
        }
        if (-not $PSBoundParameters.ContainsKey("SourceMode")) {
            $arguments += @(
                "--source-optimizations",
                "false"
            )
            $settingsAdded += 1
        }
    }
    if ($settingsAdded -eq 0) {
        throw "Configure requires PathfindingMode, TextureMode, or SourceMode."
    }
}

Write-Host "KD Hybrid $Action"
Write-Host "Application root: $appRoot"
& $nodeCommand.Source @arguments
if ($LASTEXITCODE -ne 0) {
    throw "KD Hybrid $Action failed with exit code $LASTEXITCODE."
}
