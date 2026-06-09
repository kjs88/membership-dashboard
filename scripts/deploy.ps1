param(
  [string]$Message = ""
)

$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location -LiteralPath $root

git rev-parse --is-inside-work-tree *> $null
if ($LASTEXITCODE -ne 0) {
  throw "This folder is not a git repository."
}

$branch = (git branch --show-current).Trim()
if ($branch -ne "main") {
  throw "Deploy must run on main branch. Current branch: $branch"
}

& (Join-Path $PSScriptRoot "security-scan.ps1") -Root $root
git diff --check

$status = git status --porcelain
if ($status) {
  if (-not $Message) {
    $stamp = Get-Date -Format "yyyy-MM-dd HH:mm"
    $Message = "update: dashboard $stamp"
  }
  Write-Host "Committing changes: $Message"
  git add -A
  git commit -m $Message
  git pull --rebase origin main
  git push origin main
} else {
  Write-Host "No local changes. Updating from origin/main."
  git pull --ff-only origin main
}

$pagesStatus = ""
$gh = Get-Command "gh" -ErrorAction SilentlyContinue
if ($gh) {
  for ($i = 0; $i -lt 24; $i++) {
    try {
      $pagesStatus = & $gh.Source api repos/kjs88/membership-dashboard/pages --jq ".status"
      if ($pagesStatus -eq "built") { break }
      Start-Sleep -Seconds 5
    } catch {
      $pagesStatus = ""
      break
    }
  }
}

try {
  $res = Invoke-WebRequest -Uri "https://kjs88.github.io/membership-dashboard/" -UseBasicParsing -TimeoutSec 20
  Write-Host "GitHub Pages HTTP $($res.StatusCode). Status: $pagesStatus"
} catch {
  Write-Host "Pushed, but live URL check failed: $($_.Exception.Message)"
}
