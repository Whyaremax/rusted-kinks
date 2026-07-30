[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$BuildDirectory,
    [Parameter(Mandatory = $true)][string]$OutputDirectory,
    [string]$Configuration = "Release",
    [string]$SfxModule
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$buildRoot = (Resolve-Path -LiteralPath $BuildDirectory).Path
$outputRoot = [IO.Path]::GetFullPath($OutputDirectory)
$stageRoot = Join-Path $outputRoot "windows-x64-runtime"
$executableCandidates = @(
    (Join-Path $buildRoot "$Configuration\KDHybridManager.exe"),
    (Join-Path $buildRoot "KDHybridManager.exe")
)
$managerExecutable = $executableCandidates |
    Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } |
    Select-Object -First 1
if (-not $managerExecutable) {
    throw "KDHybridManager.exe was not found under $buildRoot"
}
$iconToolCandidates = @(
    (Join-Path $buildRoot "$Configuration\KDHybridSetWindowsIcon.exe"),
    (Join-Path $buildRoot "KDHybridSetWindowsIcon.exe")
)
$iconTool = $iconToolCandidates |
    Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } |
    Select-Object -First 1
if (-not $iconTool) {
    throw "KDHybridSetWindowsIcon.exe was not found under $buildRoot"
}
$applicationIcon = Join-Path $repoRoot `
    "native\manager\assets\kd-hybrid-bandage.ico"
if (-not (Test-Path -LiteralPath $applicationIcon -PathType Leaf)) {
    throw "KD Hybrid Windows icon is missing: $applicationIcon"
}

$windeployqt = Get-Command windeployqt.exe -ErrorAction SilentlyContinue
if (-not $windeployqt) {
    throw "windeployqt.exe is not available in PATH"
}
$sevenZip = Get-Command 7z.exe -ErrorAction Stop
$sevenZipRoot = Split-Path -Parent $sevenZip.Source
if (-not $SfxModule) {
    $sfxCandidates = @(
        $env:KD_7ZIP_INSTALLER_SFX,
        (Join-Path $repoRoot ".local\lzma-sdk\bin\7zSD.sfx"),
        (Join-Path $sevenZipRoot "7zSD.sfx")
    ) | Where-Object { $_ }
    $SfxModule = $sfxCandidates |
        Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } |
        Select-Object -First 1
}
if (-not $SfxModule -or
    -not (Test-Path -LiteralPath $SfxModule -PathType Leaf)) {
    throw @"
7zSD.sfx from the LZMA SDK is required. The generic 7z.sfx module only opens
an extraction dialog and is intentionally rejected. Pass -SfxModule <path>.
"@
}
$sfxModulePath = (Resolve-Path -LiteralPath $SfxModule).Path

New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null
if (Test-Path -LiteralPath $stageRoot) {
    $resolvedStage = (Resolve-Path -LiteralPath $stageRoot).Path
    $expectedPrefix = $outputRoot.TrimEnd("\") + "\"
    if (-not $resolvedStage.StartsWith(
        $expectedPrefix,
        [StringComparison]::OrdinalIgnoreCase
    )) {
        throw "Refusing unsafe staging cleanup: $resolvedStage"
    }
    Remove-Item -LiteralPath $resolvedStage -Recurse -Force
}
New-Item -ItemType Directory -Path $stageRoot | Out-Null
Copy-Item -LiteralPath $managerExecutable -Destination $stageRoot

& $windeployqt.Source `
    --release `
    --compiler-runtime `
    --no-translations `
    --no-system-d3d-compiler `
    --skip-plugin-types generic,networkinformation,tls `
    --dir $stageRoot `
    (Join-Path $stageRoot "KDHybridManager.exe")
if ($LASTEXITCODE -ne 0) {
    throw "windeployqt failed with exit code $LASTEXITCODE"
}

$licenseRoot = Join-Path $stageRoot "licenses"
New-Item -ItemType Directory -Path $licenseRoot -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $repoRoot "LICENSE") `
    -Destination (Join-Path $licenseRoot "KD-Hybrid-MIT.txt")
Copy-Item -LiteralPath (Join-Path $repoRoot "LICENSES\ACORN-MIT.txt") `
    -Destination (Join-Path $licenseRoot "ACORN-MIT.txt")
Copy-Item -LiteralPath (Join-Path $repoRoot "LICENSES\MPL-2.0.txt") `
    -Destination (Join-Path $licenseRoot "MPL-2.0.txt")
Copy-Item -LiteralPath (Join-Path $repoRoot "NOTICE.md") `
    -Destination (Join-Path $licenseRoot "KD-Hybrid-NOTICE.txt")
Copy-Item -LiteralPath (Join-Path $repoRoot "native\manager\THIRD_PARTY.md") `
    -Destination (Join-Path $licenseRoot "THIRD-PARTY.txt")
$mplSource = Join-Path $repoRoot "dist\bootstrap\source\MPL-2.0"
if (-not (Test-Path -LiteralPath $mplSource -PathType Container)) {
    throw "MPL source payload is missing. Run npm run build first."
}
$sourceRoot = Join-Path $stageRoot "source"
New-Item -ItemType Directory -Path $sourceRoot -Force | Out-Null
Copy-Item -LiteralPath $mplSource -Destination $sourceRoot -Recurse
[IO.File]::WriteAllText(
    (Join-Path $licenseRoot "LZMA-SDK-Notice.txt"),
    @"
The Windows self-extractor uses 7zSD.sfx from the LZMA SDK by Igor Pavlov.
The LZMA SDK documentation places the SDK in the public domain.
Source and current SDK downloads: https://www.7-zip.org/sdk.html
"@,
    [Text.UTF8Encoding]::new($false)
)

$expectedQtLicenseHash =
    "e3a994d82e644b03a792a930f574002658412f62407f5fee083f2555c5f23118"
$qtLicense = Join-Path $repoRoot "LICENSES\LGPL-3.0.txt"
if (-not (Test-Path -LiteralPath $qtLicense -PathType Leaf)) {
    throw "Bundled LGPL-3.0 license is missing: $qtLicense"
}
$actualQtLicenseHash =
    (Get-FileHash -LiteralPath $qtLicense -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actualQtLicenseHash -ne $expectedQtLicenseHash) {
    throw "LGPL-3.0 license hash mismatch: $actualQtLicenseHash"
}
Copy-Item -LiteralPath $qtLicense `
    -Destination (Join-Path $licenseRoot "Qt-LGPL-3.txt")
[IO.File]::WriteAllText(
    (Join-Path $licenseRoot "Qt-Source-Offer.txt"),
    "Qt source code and licensing information: https://www.qt.io/download-open-source`n",
    [Text.UTF8Encoding]::new($false)
)

$archive = Join-Path $outputRoot "windows-x64-runtime.7z"
if (Test-Path -LiteralPath $archive) {
    Remove-Item -LiteralPath $archive -Force
}
Push-Location $stageRoot
try {
    & $sevenZip.Source a -t7z $archive ".\*" -mx=9 -mmt=on
    if ($LASTEXITCODE -ne 0) {
        throw "7-Zip failed with exit code $LASTEXITCODE"
    }
} finally {
    Pop-Location
}

$configPath = Join-Path $outputRoot "windows-sfx-config.txt"
[IO.File]::WriteAllText(
    $configPath,
    @"
;!@Install@!UTF-8!
Title="KD Hybrid Manager"
RunProgram="KDHybridManager.exe"
Progress="no"
;!@InstallEnd@!
"@,
    [Text.UTF8Encoding]::new($false)
)

$manifestTool = Get-Command mt.exe -ErrorAction SilentlyContinue
if (-not $manifestTool) {
    $windowsKits = Join-Path ${env:ProgramFiles(x86)} "Windows Kits\10\bin"
    if (Test-Path -LiteralPath $windowsKits) {
        $manifestTool = Get-ChildItem -LiteralPath $windowsKits -Recurse `
            -Filter mt.exe -File -ErrorAction SilentlyContinue |
            Where-Object { $_.FullName -match '\\x64\\mt\.exe$' } |
            Sort-Object FullName -Descending |
            Select-Object -First 1
    }
}
if (-not $manifestTool) {
    throw "Windows Manifest Tool (mt.exe) is required to mark the SFX asInvoker"
}
$manifestToolPath = $manifestTool.Source
if (-not $manifestToolPath) {
    $manifestToolPath = $manifestTool.FullName
}
if (-not $manifestToolPath -or
    -not (Test-Path -LiteralPath $manifestToolPath -PathType Leaf)) {
    throw "Windows Manifest Tool path could not be resolved"
}
$applicationManifest = Join-Path $outputRoot "windows-sfx.manifest"
[IO.File]::WriteAllText(
    $applicationManifest,
    @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0">
  <trustInfo xmlns="urn:schemas-microsoft-com:asm.v3">
    <security>
      <requestedPrivileges>
        <requestedExecutionLevel level="asInvoker" uiAccess="false"/>
      </requestedPrivileges>
    </security>
  </trustInfo>
</assembly>
"@,
    [Text.UTF8Encoding]::new($false)
)
$patchedSfxModule = Join-Path $outputRoot "windows-sfx-as-invoker.sfx"
Copy-Item -LiteralPath $sfxModulePath -Destination $patchedSfxModule -Force
& $manifestToolPath -nologo -manifest $applicationManifest `
    "-outputresource:$patchedSfxModule;#1"
if ($LASTEXITCODE -ne 0) {
    throw "mt.exe failed with exit code $LASTEXITCODE"
}
& $iconTool $patchedSfxModule $applicationIcon
if ($LASTEXITCODE -ne 0) {
    throw "KDHybridSetWindowsIcon failed with exit code $LASTEXITCODE"
}

$finalExecutable = Join-Path $outputRoot "KD-Hybrid-Manager-Windows-x64.exe"
$output = [IO.File]::Create($finalExecutable)
try {
    foreach ($part in @($patchedSfxModule, $configPath, $archive)) {
        $input = [IO.File]::OpenRead($part)
        try {
            $input.CopyTo($output)
        } finally {
            $input.Dispose()
        }
    }
} finally {
    $output.Dispose()
}

$hash = (Get-FileHash -LiteralPath $finalExecutable -Algorithm SHA256).Hash.ToLowerInvariant()
[IO.File]::WriteAllText(
    "$finalExecutable.sha256",
    "$hash  $([IO.Path]::GetFileName($finalExecutable))`n",
    [Text.UTF8Encoding]::new($false)
)
Write-Output $finalExecutable
