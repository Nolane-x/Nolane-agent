$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$Version = '22.16.0'
$ArchiveName = 'node-v22.16.0-win-x64.zip'
$DownloadUrl = "https://nodejs.org/dist/v$Version/$ArchiveName"
$ExpectedSha256 = '21c2d9735c80b8f86dab19305aa6a9f6f59bbc808f68de3eef09d5832e3bfbbd'
$RuntimeDir = Join-Path $PSScriptRoot 'runtime'
$NodeExe = Join-Path $RuntimeDir 'node.exe'

if (Test-Path $NodeExe) { exit 0 }
New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null
$WorkDir = Join-Path ([IO.Path]::GetTempPath()) ("forge-studio-node-" + [Guid]::NewGuid().ToString('N'))
$Archive = Join-Path $WorkDir $ArchiveName
$Extracted = Join-Path $WorkDir 'node-v22.16.0-win-x64'
try {
  New-Item -ItemType Directory -Force -Path $WorkDir | Out-Null
  Invoke-WebRequest -UseBasicParsing -Uri $DownloadUrl -OutFile $Archive
  $ActualSha256 = (Get-FileHash -Algorithm SHA256 -Path $Archive).Hash.ToLowerInvariant()
  if ($ActualSha256 -ne $ExpectedSha256) { throw "Node runtime checksum mismatch: $ActualSha256" }
  Expand-Archive -LiteralPath $Archive -DestinationPath $WorkDir -Force
  $SourceNode = Join-Path $Extracted 'node.exe'
  if (-not (Test-Path $SourceNode)) { throw 'Downloaded Node archive did not contain node.exe' }
  $TemporaryNode = Join-Path $RuntimeDir 'node.exe.partial'
  Copy-Item -LiteralPath $SourceNode -Destination $TemporaryNode -Force
  Move-Item -LiteralPath $TemporaryNode -Destination $NodeExe -Force
  Write-Host "Installed verified Node.js v$Version runtime."
} finally {
  Remove-Item -LiteralPath $WorkDir -Recurse -Force -ErrorAction SilentlyContinue
}
