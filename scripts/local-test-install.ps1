[CmdletBinding()]
param(
    [ValidateSet("Setup", "Status", "EnableDeveloper", "Launch")]
    [string]$Action = "Status",
    [string]$GameRoot,
    [string]$TestRoot
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$cargoBin = Join-Path $env:USERPROFILE ".cargo\bin"
if (Test-Path -LiteralPath $cargoBin -PathType Container) {
    $pathEntries = @($env:PATH -split ";" | Where-Object { $_ })
    if (-not ($pathEntries | Where-Object { $_.TrimEnd("\").Equals($cargoBin.TrimEnd("\"), [System.StringComparison]::OrdinalIgnoreCase) })) {
        $env:PATH = "$cargoBin;$env:PATH"
    }
}

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
if ([string]::IsNullOrWhiteSpace($GameRoot)) {
    $GameRoot = (Resolve-Path -LiteralPath (Join-Path $repoRoot "..\..")).Path
} else {
    $GameRoot = (Resolve-Path -LiteralPath $GameRoot).Path
}
if ([string]::IsNullOrWhiteSpace($TestRoot)) {
    $parent = Split-Path -Parent $GameRoot
    $leaf = Split-Path -Leaf $GameRoot
    $TestRoot = Join-Path $parent "$leaf-kd-hybrid-test"
} else {
    $TestRoot = [System.IO.Path]::GetFullPath($TestRoot)
}

$comparison = [System.StringComparison]::OrdinalIgnoreCase
$sourcePrefix = $GameRoot.TrimEnd("\") + "\"
if (
    $TestRoot.Equals($GameRoot, $comparison) -or
    $TestRoot.StartsWith($sourcePrefix, $comparison)
) {
    throw "TestRoot must be outside the live game tree: $TestRoot"
}

$testAppRoot = Join-Path $TestRoot "resources\app"
$testExecutable = Join-Path $TestRoot "KinkyDungeon.exe"
$testUserData = Join-Path $TestRoot "user-data"
$testMods = Join-Path $TestRoot "Mods"
$markerPath = Join-Path $TestRoot ".kd-hybrid-test-install.json"
$liveMain = Join-Path $GameRoot "resources\app\out\main.js"
$testMain = Join-Path $testAppRoot "out\main.js"
$cliPath = Join-Path $repoRoot "packages\tools\dist\cli.js"
$payloadRoot = Join-Path $repoRoot "dist\bootstrap"
$isolationMarker = "// KD Hybrid isolated test userData"
$developerMarker = "// KD Hybrid developer test mode"

$runtimeFiles = @(
    "KinkyDungeon.exe",
    "chrome_100_percent.pak",
    "chrome_200_percent.pak",
    "d3dcompiler_47.dll",
    "dxcompiler.dll",
    "dxil.dll",
    "ffmpeg.dll",
    "icudtl.dat",
    "libEGL.dll",
    "libGLESv2.dll",
    "resources.pak",
    "snapshot_blob.bin",
    "v8_context_snapshot.bin",
    "version",
    "vk_swiftshader.dll",
    "vk_swiftshader_icd.json",
    "vulkan-1.dll",
    "LICENSE",
    "LICENSES.chromium.html"
)

function Assert-LiveLayout {
    foreach ($relative in @(
        "KinkyDungeon.exe",
        "resources\app\index.html",
        "resources\app\electron.js",
        "resources\app\package.json",
        "resources\app\out\main.js",
        "resources\app\Screens\MiniGame\KinkyDungeon\Text_KinkyDungeon.csv"
    )) {
        $path = Join-Path $GameRoot $relative
        if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
            throw "Live game layout is missing $relative"
        }
    }
}

function Invoke-Checked {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter(Mandatory = $true)][string[]]$Arguments
    )
    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$FilePath failed with exit code $LASTEXITCODE"
    }
}

function Invoke-RobocopyTree {
    param(
        [Parameter(Mandatory = $true)][string]$Source,
        [Parameter(Mandatory = $true)][string]$Destination
    )
    New-Item -ItemType Directory -Path $Destination -Force | Out-Null
    & robocopy.exe $Source $Destination /E /COPY:DAT /DCOPY:DAT /R:2 /W:1 /NP /NFL /NDL /NJH /NJS
    $code = $LASTEXITCODE
    if ($code -ge 8) {
        throw "robocopy failed for $Source with exit code $code"
    }
}

function Get-PatcherStatus {
    if (-not (Test-Path -LiteralPath $cliPath -PathType Leaf)) {
        throw "Missing built patcher CLI: $cliPath"
    }
    $node = (Get-Command node.exe -ErrorAction Stop).Source
    $json = & $node $cliPath status --app-root $testAppRoot
    if ($LASTEXITCODE -ne 0) {
        throw "Patcher status failed with exit code $LASTEXITCODE"
    }
    return ($json | Out-String | ConvertFrom-Json)
}

function Add-UserDataIsolation {
    $electronPath = Join-Path $testAppRoot "electron.js"
    $text = [System.IO.File]::ReadAllText($electronPath)
    if ($text.Contains($isolationMarker)) {
        return
    }
    $needle = "const path = require('node:path')"
    if (-not $text.Contains($needle)) {
        throw "Could not locate the path import in copied electron.js"
    }
    $injection = @"
$needle
$isolationMarker
const KDHybridTestUserData = path.resolve(__dirname, '..', '..', 'user-data')
app.setPath('userData', KDHybridTestUserData)
"@
    $patched = $text.Replace($needle, $injection.TrimEnd())
    [System.IO.File]::WriteAllText(
        $electronPath,
        $patched,
        [System.Text.UTF8Encoding]::new($false)
    )
}

function Add-DeveloperTestMode {
    $electronPath = Join-Path $testAppRoot "electron.js"
    $text = [System.IO.File]::ReadAllText($electronPath)
    if ($text.Contains($developerMarker)) {
        return
    }
    $needle = "mainWindow.loadFile('index.html')"
    if (-not $text.Contains($needle)) {
        throw "Could not locate index.html loading in copied electron.js"
    }
    $replacement = @"
$developerMarker
	mainWindow.loadFile('index.html', { query: { test: 'kd-hybrid' } })
	mainWindow.webContents.openDevTools({ mode: 'detach', activate: false })
"@
    $patched = $text.Replace($needle, $replacement.TrimEnd())
    [System.IO.File]::WriteAllText(
        $electronPath,
        $patched,
        [System.Text.UTF8Encoding]::new($false)
    )
}

function Write-TestMarker {
    $metadata = [ordered]@{
        schema = 1
        createdAt = (Get-Date).ToUniversalTime().ToString("o")
        sourceGameRoot = $GameRoot
        testRoot = $TestRoot
        testUserData = $testUserData
        gameVersion = "5.4.92"
        packageVersion = "5.1.12"
        developerTestMode = $true
        upstreamBundleSha256 = (Get-FileHash -LiteralPath $liveMain -Algorithm SHA256).Hash.ToLowerInvariant()
    }
    $json = $metadata | ConvertTo-Json -Depth 4
    [System.IO.File]::WriteAllText(
        $markerPath,
        "$json`n",
        [System.Text.UTF8Encoding]::new($false)
    )
}

function Show-Status {
    if (-not (Test-Path -LiteralPath $markerPath -PathType Leaf)) {
        [ordered]@{
            state = "missing"
            testRoot = $TestRoot
            marker = $markerPath
        } | ConvertTo-Json -Depth 5
        return
    }
    if (-not (Test-Path -LiteralPath $testExecutable -PathType Leaf)) {
        throw "Test marker exists but KinkyDungeon.exe is missing"
    }
    $marker = Get-Content -LiteralPath $markerPath -Raw | ConvertFrom-Json
    if (-not $marker.testRoot.Equals($TestRoot, $comparison)) {
        throw "Test marker root does not match the requested TestRoot"
    }
    $patcher = Get-PatcherStatus
    $electronPath = Join-Path $testAppRoot "electron.js"
    $electronText = [System.IO.File]::ReadAllText($electronPath)
    $liveHash = (Get-FileHash -LiteralPath $liveMain -Algorithm SHA256).Hash.ToLowerInvariant()
    $testHash = (Get-FileHash -LiteralPath $testMain -Algorithm SHA256).Hash.ToLowerInvariant()
    $realSave = Join-Path $env:APPDATA "Kinky Dungeon"
    [ordered]@{
        state = if (
            $patcher.state -eq "installed" -and
            $electronText.Contains($isolationMarker) -and
            $electronText.Contains($developerMarker) -and
            $liveHash -eq $testHash
        ) { "ready" } else { "invalid" }
        testRoot = $TestRoot
        executable = $testExecutable
        userData = $testUserData
        realSaveDirectory = $realSave
        userDataIsolated = -not $testUserData.Equals($realSave, $comparison)
        isolationHookPresent = $electronText.Contains($isolationMarker)
        developerTestMode = $electronText.Contains($developerMarker)
        liveAndTestBundleMatch = $liveHash -eq $testHash
        bundleSha256 = $testHash
        patcher = $patcher
    } | ConvertTo-Json -Depth 8
}

function Setup-TestInstall {
    Assert-LiveLayout
    $existingChildren = @()
    if (Test-Path -LiteralPath $TestRoot -PathType Container) {
        $existingChildren = @(Get-ChildItem -LiteralPath $TestRoot -Force)
    }
    if ($existingChildren.Count -gt 0 -and -not (Test-Path -LiteralPath $markerPath -PathType Leaf)) {
        throw "Refusing nonempty unmarked TestRoot: $TestRoot"
    }

    $npm = (Get-Command npm.cmd -ErrorAction Stop).Source
    Push-Location $repoRoot
    try {
        Invoke-Checked -FilePath $npm -Arguments @("run", "package")
    } finally {
        Pop-Location
    }

    if (Test-Path -LiteralPath (Join-Path $testAppRoot "index.html") -PathType Leaf) {
        $existingStatus = Get-PatcherStatus
        if ($existingStatus.state -eq "installed") {
            $node = (Get-Command node.exe -ErrorAction Stop).Source
            Invoke-Checked -FilePath $node -Arguments @(
                $cliPath,
                "uninstall",
                "--app-root",
                $testAppRoot
            )
        } elseif ($existingStatus.state -ne "not-installed") {
            throw "Refusing to refresh test install in patcher state $($existingStatus.state)"
        }
    }

    New-Item -ItemType Directory -Path $TestRoot -Force | Out-Null
    foreach ($relative in $runtimeFiles) {
        $source = Join-Path $GameRoot $relative
        if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
            throw "Required Electron runtime file is missing: $relative"
        }
        Copy-Item -LiteralPath $source -Destination (Join-Path $TestRoot $relative) -Force
    }
    Invoke-RobocopyTree -Source (Join-Path $GameRoot "locales") -Destination (Join-Path $TestRoot "locales")
    Invoke-RobocopyTree -Source (Join-Path $GameRoot "resources") -Destination (Join-Path $TestRoot "resources")
    New-Item -ItemType Directory -Path $testUserData -Force | Out-Null
    New-Item -ItemType Directory -Path $testMods -Force | Out-Null

    Add-UserDataIsolation
    Add-DeveloperTestMode
    $node = (Get-Command node.exe -ErrorAction Stop).Source
    Invoke-Checked -FilePath $node -Arguments @(
        $cliPath,
        "install",
        "--app-root",
        $testAppRoot,
        "--payload",
        $payloadRoot,
        "--upstream-version",
        "5.4.92"
    )
    Write-TestMarker
    Show-Status
}

function Enable-DeveloperTestInstall {
    if (-not (Test-Path -LiteralPath $markerPath -PathType Leaf)) {
        throw "Test installation marker is missing; run npm run test:local:setup"
    }
    if (-not (Test-Path -LiteralPath (Join-Path $testAppRoot "electron.js") -PathType Leaf)) {
        throw "Test electron.js is missing; run npm run test:local:setup"
    }
    Add-DeveloperTestMode
    Write-TestMarker
    Show-Status
}

function Launch-TestInstall {
    $status = Show-Status | ConvertFrom-Json
    if ($status.state -ne "ready") {
        throw "Test installation is not ready; run npm run test:local:setup"
    }
    $running = @(Get-Process -Name "KinkyDungeon" -ErrorAction SilentlyContinue | Where-Object {
        $_.Path -and $_.Path.Equals($testExecutable, $comparison)
    })
    if ($running.Count -gt 0) {
        Write-Output "Test Kinky Dungeon is already running: PID $($running[0].Id)"
        return
    }
    New-Item -ItemType Directory -Path $testUserData -Force | Out-Null
    Start-Process -FilePath $testExecutable -WorkingDirectory $TestRoot -ArgumentList @(
        "--user-data-dir=$testUserData"
    )
    Write-Output "Started isolated test installation: $testExecutable"
    Write-Output "Dedicated user data: $testUserData"
}

switch ($Action) {
    "Setup" { Setup-TestInstall }
    "Status" { Show-Status }
    "EnableDeveloper" { Enable-DeveloperTestInstall }
    "Launch" { Launch-TestInstall }
}
