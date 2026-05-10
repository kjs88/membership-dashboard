param(
  [Parameter(Mandatory = $true)]
  [string]$NetlifyAuthToken,

  [Parameter(Mandatory = $true)]
  [string]$NetlifySiteId
)

$ErrorActionPreference = "Stop"

function Require-Command($Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "$Name 명령을 찾을 수 없습니다. GitHub CLI(gh)를 먼저 설치하고 로그인해야 합니다."
  }
}

Require-Command "gh"

$repo = "kjs88/membership-dashboard"

gh auth status | Out-Host
gh secret set NETLIFY_AUTH_TOKEN --repo $repo --body $NetlifyAuthToken
gh secret set NETLIFY_SITE_ID --repo $repo --body $NetlifySiteId

Write-Host "GitHub Actions secrets 등록 완료: $repo"
Write-Host "- NETLIFY_AUTH_TOKEN"
Write-Host "- NETLIFY_SITE_ID"

