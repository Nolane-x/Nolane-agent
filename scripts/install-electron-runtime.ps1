param(
  [Parameter(Mandatory = $false)]
  [string]$InstallRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'Continue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$Version = '43.2.0'
$ArchiveName = 'electron-v43.2.0-win32-x64.zip'
$ExpectedSha256 = 'eba5f5088af40ecb364fe258809c79a5234c6ece5a75c64722772eba01b02786'
$ExpectedBytes = 144326439
$RuntimeRoot = Join-Path $InstallRoot "runtime\electron-$Version"
$ElectronExe = Join-Path $RuntimeRoot 'electron.exe'
$VersionFile = Join-Path $RuntimeRoot 'version'
$CacheRoot = Join-Path $InstallRoot 'runtime\downloads'
$ArchivePath = Join-Path $CacheRoot $ArchiveName
$PartialPath = "$ArchivePath.partial"
$StagingPath = "$RuntimeRoot.staging-$PID"
$Sources = @(
  "https://github.com/electron/electron/releases/download/v$Version/$ArchiveName",
  "https://mirrors.huaweicloud.com/electron/$Version/$ArchiveName"
)

function Test-Runtime {
  if (-not (Test-Path -LiteralPath $ElectronExe -PathType Leaf)) { return $false }
  if (-not (Test-Path -LiteralPath $VersionFile -PathType Leaf)) { return $false }
  return ((Get-Content -LiteralPath $VersionFile -Raw).Trim() -eq $Version)
}

function Test-Archive {
  if (-not (Test-Path -LiteralPath $ArchivePath -PathType Leaf)) { return $false }
  $File = Get-Item -LiteralPath $ArchivePath
  if ($File.Length -ne $ExpectedBytes) { return $false }
  return ((Get-FileHash -LiteralPath $ArchivePath -Algorithm SHA256).Hash.ToLowerInvariant() -eq $ExpectedSha256)
}

if (Test-Runtime) { exit 0 }
New-Item -ItemType Directory -Path $CacheRoot -Force | Out-Null

if (-not (Test-Archive)) {
  Remove-Item -LiteralPath $ArchivePath, $PartialPath -Force -ErrorAction SilentlyContinue
  $LastError = $null
  foreach ($Source in $Sources) {
    try {
      Write-Host "Downloading verified Electron $Version from $Source"
      Invoke-WebRequest -Uri $Source -OutFile $PartialPath -UseBasicParsing -MaximumRedirection 8
      $Downloaded = Get-Item -LiteralPath $PartialPath
      if ($Downloaded.Length -ne $ExpectedBytes) { throw "Unexpected Electron archive size: $($Downloaded.Length)" }
      $Digest = (Get-FileHash -LiteralPath $PartialPath -Algorithm SHA256).Hash.ToLowerInvariant()
      if ($Digest -ne $ExpectedSha256) { throw "Electron SHA-256 mismatch" }
      Move-Item -LiteralPath $PartialPath -Destination $ArchivePath -Force
      $LastError = $null
      break
    } catch {
      $LastError = $_
      Remove-Item -LiteralPath $PartialPath -Force -ErrorAction SilentlyContinue
    }
  }
  if ($null -ne $LastError) { throw "Unable to download verified Electron runtime: $LastError" }
}

Remove-Item -LiteralPath $StagingPath -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $StagingPath -Force | Out-Null
try {
  Expand-Archive -LiteralPath $ArchivePath -DestinationPath $StagingPath -Force
  $StagedExe = Join-Path $StagingPath 'electron.exe'
  $StagedVersion = Join-Path $StagingPath 'version'
  if (-not (Test-Path -LiteralPath $StagedExe -PathType Leaf)) { throw 'Electron archive does not contain electron.exe' }
  if (-not (Test-Path -LiteralPath $StagedVersion -PathType Leaf)) { throw 'Electron archive does not contain version marker' }
  if (((Get-Content -LiteralPath $StagedVersion -Raw).Trim()) -ne $Version) { throw 'Electron runtime version marker mismatch' }
  Remove-Item -LiteralPath $RuntimeRoot -Recurse -Force -ErrorAction SilentlyContinue
  Move-Item -LiteralPath $StagingPath -Destination $RuntimeRoot
} finally {
  Remove-Item -LiteralPath $StagingPath -Recurse -Force -ErrorAction SilentlyContinue
}

if (-not (Test-Runtime)) { throw 'Verified Electron runtime was not installed correctly' }
Write-Host "Electron $Version installed successfully."
