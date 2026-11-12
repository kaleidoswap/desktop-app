# Run on a Windows workstation with Docker Desktop in Linux-container mode.
# Uses a new unfunded Signet wallet and removes only its disposable container/volume.
$ErrorActionPreference = 'Stop'
if ($env:OS -ne 'Windows_NT') { throw 'Run this check on Windows' }
$serverOS = docker info --format '{{.OSType}}'
if ($LASTEXITCODE -ne 0 -or $serverOS.Trim() -ne 'linux') {
  throw 'Start Docker Desktop with Linux containers before running this check'
}
$image = (Get-Content (Join-Path $PSScriptRoot '../p2pd.image') -Raw).Trim()
if ($image -notmatch '@sha256:[0-9a-f]{64}$') { throw 'Expected a digest-pinned daemon image' }
docker pull $image
if ($LASTEXITCODE -ne 0) { throw 'Could not pull the pinned daemon' }
$report = Join-Path $env:TEMP 'kaleidoswap-windows-docker-smoke.json'
python (Join-Path $PSScriptRoot 'test-p2p-docker.py') --image $image --report $report
if ($LASTEXITCODE -ne 0) { throw "Docker smoke failed; inspect $report" }
Get-Content $report
