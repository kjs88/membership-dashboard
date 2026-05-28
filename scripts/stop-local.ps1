$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$pidFile = Join-Path $root ".local-server.pid"

if (-not (Test-Path -LiteralPath $pidFile)) {
  Write-Host "No local server pid file found."
  exit 0
}

$state = @{}
Get-Content -LiteralPath $pidFile | ForEach-Object {
  $parts = $_ -split "=", 2
  if ($parts.Count -eq 2) { $state[$parts[0]] = $parts[1] }
}

$pidValue = $state.pid
if ($pidValue) {
  $proc = Get-Process -Id ([int]$pidValue) -ErrorAction SilentlyContinue
  if ($proc) {
    Stop-Process -Id $proc.Id
    Write-Host "Stopped local server process: $($proc.Id)"
  }
}

Remove-Item -LiteralPath $pidFile -Force
