param(
  [int]$Port = 8000
)

$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

function Test-PortAvailable([int]$Candidate) {
  $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Candidate)
  try {
    $listener.Start()
    return $true
  } catch {
    return $false
  } finally {
    try { $listener.Stop() } catch {}
  }
}

$python = Get-Command "python" -ErrorAction SilentlyContinue
$pythonArgsPrefix = @()
if (-not $python) {
  $python = Get-Command "py" -ErrorAction SilentlyContinue
  $pythonArgsPrefix = @("-3")
}
if (-not $python) {
  throw "Python is not installed. Install Python 3, then run this again."
}

$selectedPort = $null
for ($candidate = $Port; $candidate -lt ($Port + 50); $candidate++) {
  if (Test-PortAvailable $candidate) {
    $selectedPort = $candidate
    break
  }
}
if (-not $selectedPort) {
  throw "No available local port found near $Port."
}

$pidFile = Join-Path $root ".local-server.pid"
if (Test-Path -LiteralPath $pidFile) {
  $oldState = @{}
  Get-Content -LiteralPath $pidFile -ErrorAction SilentlyContinue | ForEach-Object {
    $parts = $_ -split "=", 2
    if ($parts.Count -eq 2) { $oldState[$parts[0]] = $parts[1] }
  }
  if ($oldState.pid) {
    $oldProc = Get-Process -Id ([int]$oldState.pid) -ErrorAction SilentlyContinue
    if ($oldProc) {
      $oldPort = if ($oldState.port) { [int]$oldState.port } else { $selectedPort }
      Write-Host "Local server already running. Opening browser."
      Start-Process "http://127.0.0.1:$oldPort/"
      exit 0
    }
  }
}

$args = @($pythonArgsPrefix + @("-m", "http.server", "$selectedPort"))
$proc = Start-Process -FilePath $python.Source -ArgumentList $args -WorkingDirectory $root -WindowStyle Hidden -PassThru
Set-Content -LiteralPath $pidFile -Value @("pid=$($proc.Id)", "port=$selectedPort") -Encoding ASCII

Start-Sleep -Seconds 1
Start-Process "http://127.0.0.1:$selectedPort/"
Write-Host "Local server started: http://127.0.0.1:$selectedPort/"
