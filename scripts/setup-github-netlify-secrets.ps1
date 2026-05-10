param(
  [Parameter(Mandatory = $true)]
  [string]$NetlifyAuthToken,

  [Parameter(Mandatory = $true)]
  [string]$NetlifySiteId
)

$ErrorActionPreference = "Stop"

function Get-GhCommand {
  $cmd = Get-Command "gh" -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }

  $commonPaths = @(
    "C:\Program Files\GitHub CLI\gh.exe",
    "C:\Program Files (x86)\GitHub CLI\gh.exe",
    "$env:LOCALAPPDATA\GitHub CLI\gh.exe"
  )

  foreach ($path in $commonPaths) {
    if (Test-Path -LiteralPath $path) { return $path }
  }

  throw "gh 명령을 찾을 수 없습니다. GitHub CLI(gh)를 먼저 설치하고 로그인해야 합니다."
}

$gh = Get-GhCommand

$repo = "kjs88/membership-dashboard"

& $gh auth status | Out-Host
& $gh secret set NETLIFY_AUTH_TOKEN --repo $repo --body $NetlifyAuthToken
& $gh secret set NETLIFY_SITE_ID --repo $repo --body $NetlifySiteId

Write-Host "GitHub Actions secrets 등록 완료: $repo"
Write-Host "- NETLIFY_AUTH_TOKEN"
Write-Host "- NETLIFY_SITE_ID"
