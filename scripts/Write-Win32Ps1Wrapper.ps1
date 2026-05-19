param(
  [string] $OutDir = 'by-arch/win32-x64/bin'
)

$ErrorActionPreference = 'Stop'

$repo = Resolve-Path (Join-Path $PSScriptRoot '..')
$pkg = Get-Content -Raw -Path (Join-Path $repo 'package.json') | ConvertFrom-Json
$name = $pkg.name

$targetDir = Join-Path $repo $OutDir
New-Item -ItemType Directory -Force -Path $targetDir | Out-Null

$wrapperPath = Join-Path $targetDir "$name.ps1"
$wrapper = @"
& "`$PSScriptRoot\$name.exe" @args
"@

Set-Content -Path $wrapperPath -Value $wrapper -Encoding ascii
Write-Host "Wrote wrapper: $wrapperPath"

$exePath = Join-Path $targetDir "$name.exe"
$runtimePath = Join-Path $targetDir "$name-runtime.exe"
Copy-Item -Path $exePath -Destination $runtimePath -Force
Write-Host "Copied runtime: $runtimePath"
