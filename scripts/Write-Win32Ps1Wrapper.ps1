param(
  [string] $OutDir = 'out/win32-x64'
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
