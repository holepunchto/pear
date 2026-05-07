param(
  [string] $Subject = 'CN=Holepunch Inc'
)

$ErrorActionPreference = 'Stop'

function Find-Certificate {
  param([string] $Subject)

  $store = [System.Security.Cryptography.X509Certificates.X509Store]::new('My', 'CurrentUser')
  $store.Open('ReadOnly')
  try {
    return @($store.Certificates |
      Where-Object { $_.Subject -eq $Subject -and $_.NotAfter -gt (Get-Date).AddDays(30) } |
      Sort-Object NotAfter -Descending |
      Select-Object -First 1)[0]
  } finally {
    $store.Close()
  }
}

function Trust-Certificate {
  param(
    [System.Security.Cryptography.X509Certificates.X509Certificate2] $Certificate,
    [string] $StoreName
  )

  $store = [System.Security.Cryptography.X509Certificates.X509Store]::new($StoreName, 'CurrentUser')
  $store.Open('ReadWrite')
  try {
    $existing = $store.Certificates | Where-Object { $_.Thumbprint -eq $Certificate.Thumbprint } | Select-Object -First 1
    if (-not $existing) {
      $store.Add($Certificate)
    }
  } finally {
    $store.Close()
  }
}

function New-CodeSigningCertificate {
  param([string] $Subject)

  $rsa = [System.Security.Cryptography.RSA]::Create(2048)
  $request = [System.Security.Cryptography.X509Certificates.CertificateRequest]::new(
    $Subject,
    $rsa,
    [System.Security.Cryptography.HashAlgorithmName]::SHA256,
    [System.Security.Cryptography.RSASignaturePadding]::Pkcs1
  )

  $request.CertificateExtensions.Add(
    [System.Security.Cryptography.X509Certificates.X509KeyUsageExtension]::new(
      [System.Security.Cryptography.X509Certificates.X509KeyUsageFlags]::DigitalSignature,
      $true
    )
  )

  $eku = [System.Security.Cryptography.OidCollection]::new()
  $eku.Add([System.Security.Cryptography.Oid]::new('1.3.6.1.5.5.7.3.3', 'Code Signing')) | Out-Null
  $request.CertificateExtensions.Add(
    [System.Security.Cryptography.X509Certificates.X509EnhancedKeyUsageExtension]::new($eku, $true)
  )

  $request.CertificateExtensions.Add(
    [System.Security.Cryptography.X509Certificates.X509BasicConstraintsExtension]::new($false, $false, 0, $true)
  )

  $request.CertificateExtensions.Add(
    [System.Security.Cryptography.X509Certificates.X509SubjectKeyIdentifierExtension]::new($request.PublicKey, $false)
  )

  $created = $request.CreateSelfSigned([DateTimeOffset]::Now.AddDays(-1), [DateTimeOffset]::Now.AddYears(3))
  $password = [Guid]::NewGuid().ToString('N')
  $pfx = $created.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Pfx, $password)

  $flags =
    [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::PersistKeySet -bor
    [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::UserKeySet -bor
    [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::Exportable

  $cert = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new($pfx, $password, $flags)

  $store = [System.Security.Cryptography.X509Certificates.X509Store]::new('My', 'CurrentUser')
  $store.Open('ReadWrite')
  try {
    $store.Add($cert)
  } finally {
    $store.Close()
  }

  return $cert
}

function Get-CodeSigningCertificate {
  param([string] $Subject)

  $cert = Find-Certificate -Subject $Subject
  if (-not $cert) {
    $cert = New-CodeSigningCertificate -Subject $Subject
  }

  Trust-Certificate -Certificate $cert -StoreName TrustedPeople
  Trust-Certificate -Certificate $cert -StoreName Root

  return $cert
}

function Invoke-Checked {
  param(
    [string] $FilePath,
    [string[]] $Arguments
  )

  & $FilePath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "'$FilePath $($Arguments -join ' ')' failed with exit code $LASTEXITCODE"
  }
}

function Sign-File {
  param(
    [string] $Path,
    [System.Security.Cryptography.X509Certificates.X509Certificate2] $Certificate,
    [string] $Subject
  )

  Invoke-Checked signtool @(
    'sign',
    '/a',
    '/fd', 'SHA256',
    '/t', 'http://timestamp.digicert.com',
    '/n', $Subject.Replace('CN=', ''),
    '/sha1', $Certificate.Thumbprint,
    $Path
  )

  Invoke-Checked signtool @('verify', '/pa', '/v', $Path)
}

$repo = Resolve-Path (Join-Path $PSScriptRoot '..')
$pkg = Get-Content -Raw -Path (Join-Path $repo 'package.json') | ConvertFrom-Json
$name = $pkg.name
$cert = Get-CodeSigningCertificate -Subject $Subject
$localRuntime = Join-Path $repo '..\bare-build\build\short-mt-win32-x64-install\win32-x64\bare.exe'
$runtimePackage = Join-Path $repo 'node_modules\bare-build-win32-x64\bare.exe'

if (Test-Path $localRuntime) {
  Copy-Item -LiteralPath $localRuntime -Destination $runtimePackage -Force
}

Push-Location $repo
try {
  $env:MSIX_CERT_SUBJECT = $Subject
  $env:MSIX_CERT_THUMBPRINT = $cert.Thumbprint

  $contentRoot = Join-Path $repo 'out\win32-x64-msix-dir'
  $contentDir = Join-Path $contentRoot $name
  $msixOut = Join-Path $repo 'out\win32-x64-msix'
  $msixPath = Join-Path $msixOut "$name.msix"
  $msixContentBuilder = Join-Path $repo 'node_modules\bare-build\lib\platform\windows\create-msix-content-directory.js'
  $originalMsixContentBuilder = $null

  try {
    Remove-Item $contentRoot, $msixOut -Recurse -Force -ErrorAction SilentlyContinue

    $originalMsixContentBuilder = Get-Content -Raw -Path $msixContentBuilder
    $patchedMsixContentBuilder = $originalMsixContentBuilder.Replace(
      'binary.optionalHeader.subsystem = PE.OptionalHeader.SUBSYSTEM.WINDOWS_GUI',
      'binary.optionalHeader.subsystem = PE.OptionalHeader.SUBSYSTEM.WINDOWS_CUI'
    )

    if ($patchedMsixContentBuilder -eq $originalMsixContentBuilder) {
      throw 'Could not patch bare-build MSIX subsystem to console mode'
    }

    Set-Content -NoNewline -Path $msixContentBuilder -Value $patchedMsixContentBuilder

    Invoke-Checked bare-build @('--config', './bare-build.msix.config.cjs', '--host', 'win32-x64', '--out', './out/win32-x64-msix-dir', 'scripts/standalone-entry.js')

    New-Item -ItemType Directory -Force -Path $msixOut | Out-Null
    Invoke-Checked makeappx @('pack', '/d', $contentDir, '/p', $msixPath, '/o')
    Sign-File -Path $msixPath -Certificate $cert -Subject $Subject

    Write-Host "Signed MSIX: $msixPath"
  } finally {
    if ($null -ne $originalMsixContentBuilder) {
      Set-Content -NoNewline -Path $msixContentBuilder -Value $originalMsixContentBuilder
    }

    Remove-Item Env:\MSIX_CERT_SUBJECT -ErrorAction SilentlyContinue
    Remove-Item Env:\MSIX_CERT_THUMBPRINT -ErrorAction SilentlyContinue
  }
} finally {
  Pop-Location
}
