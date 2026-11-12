$ErrorActionPreference = 'Stop'
$bundle = Join-Path $PSScriptRoot '../src-tauri/target/x86_64-pc-windows-msvc/release/bundle'
$msi = @(Get-ChildItem "$bundle/msi/*.msi")
$nsis = @(Get-ChildItem "$bundle/nsis/*.exe")
if ($msi.Count -ne 1 -or $nsis.Count -ne 1) { throw 'Expected one MSI and one NSIS installer' }
$root = Join-Path $env:RUNNER_TEMP 'kaleidoswap-beta-package-smoke'
New-Item -ItemType Directory -Path $root -Force | Out-Null
$extract = Join-Path $root 'extracted'
$log = Join-Path $root 'msi-extract.log'
# Administrative extraction validates the real MSI payload without installing a wallet.
$p = Start-Process msiexec.exe -ArgumentList @('/a', "`"$($msi[0].FullName)`"", '/qn', "TARGETDIR=`"$extract`"", '/l*v', "`"$log`"") -Wait -PassThru
if ($p.ExitCode -notin @(0,3010)) { throw "MSI extraction failed: $($p.ExitCode)" }
$exe = @(Get-ChildItem $extract -Recurse -Filter 'kaleidoswap.exe')
if ($exe.Count -ne 1) { throw "Expected one extracted app executable; found $($exe.Count)" }
$env:WEBVIEW2_USER_DATA_FOLDER = Join-Path $root 'webview'
$app = $null
try {
  $app = Start-Process $exe[0].FullName -PassThru
  Start-Sleep -Seconds 15
  $app.Refresh()
  if ($app.HasExited) { throw "Packaged application exited during startup: $($app.ExitCode)" }
  if ($app.MainWindowHandle -eq 0) { throw 'Packaged application did not create a window' }
  $report = [ordered]@{
    result = 'passed'; host = 'Windows'; msi_extracted = $true
    packaged_app_started = $true; window_created = $true
    msi_sha256 = (Get-FileHash $msi[0].FullName -Algorithm SHA256).Hash
    nsis_sha256 = (Get-FileHash $nsis[0].FullName -Algorithm SHA256).Hash
    authenticode = (Get-AuthenticodeSignature $exe[0].FullName).Status.ToString()
    docker_desktop_runtime = 'not-tested-on-hosted-server-runner'
  }
  $report | ConvertTo-Json
} finally {
  if ($app -and !$app.HasExited) { Stop-Process -Id $app.Id -Force }
}
