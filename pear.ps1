$processorArch = if ($env:PROCESSOR_ARCHITEW6432) { $env:PROCESSOR_ARCHITEW6432 } else { $env:PROCESSOR_ARCHITECTURE }
$arch = @{ AMD64 = 'x64'; ARM64 = 'arm64' }[$processorArch]

if (-not $arch) {
  Write-Error "Unsupported Windows architecture: $processorArch"
  exit 1
}

$bare = "$PSScriptRoot\node_modules\bare-runtime-win32-$arch\bin\bare.exe"

if (-not (Test-Path $bare)) {
  Write-Error "Missing Bare runtime: $bare"
  exit 1
}

& $bare "$PSScriptRoot\targets\main.dev.js" @args
exit $LASTEXITCODE
