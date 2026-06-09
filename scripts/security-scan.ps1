param(
  [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)

$ErrorActionPreference = "Stop"

$excludeDirs = @(
  "\\.git\\",
  "\\test-results\\",
  "\\scripts\\__pycache__\\"
)
$excludeExtensions = @(".png", ".jpg", ".jpeg", ".gif", ".webp", ".xlsx", ".xls", ".pdf", ".pyc")

$patterns = @(
  @{ Name = "Bearer token"; Regex = "Bearer\s+[A-Za-z0-9._~+/\-=|]{20,}" },
  @{ Name = "Amarans token"; Regex = "gcmsAmaranth[0-9A-Za-z|._~+/\-=]{10,}" },
  @{ Name = "Bizcube cookie"; Regex = "BIZCUBE_(AT|HK)\s*=" },
  @{ Name = "OAuth cookie"; Regex = "oAuthToken\s*=" },
  @{ Name = "signKey cookie"; Regex = "signKey\s*=" },
  @{ Name = "Private key"; Regex = "-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----" },
  @{ Name = "Firebase auth token value"; Regex = "(AMARANS_FIREBASE_AUTH_TOKEN|FIREBASE_AUTH_TOKEN)\s*[:=]\s*['""]?[A-Za-z0-9._~+/\-=]{20,}" },
  @{ Name = "Literal password field"; Regex = "\bpassword\s*:\s*['""][^'""]{4,}['""]" }
)

$files = Get-ChildItem -LiteralPath $Root -Recurse -Force -File | Where-Object {
  $path = $_.FullName
  -not ($excludeDirs | Where-Object { $path -match $_ }) -and
  -not ($excludeExtensions -contains $_.Extension.ToLowerInvariant())
}

$findings = New-Object System.Collections.Generic.List[string]
foreach ($file in $files) {
  $text = ""
  try { $text = Get-Content -LiteralPath $file.FullName -Raw -ErrorAction Stop }
  catch { continue }
  foreach ($pattern in $patterns) {
    if ($text -match $pattern.Regex) {
      $rel = Resolve-Path -LiteralPath $file.FullName -Relative
      $findings.Add("$($pattern.Name): $rel")
    }
  }
}

if ($findings.Count -gt 0) {
  Write-Error ("Security scan failed:`n" + ($findings | Sort-Object -Unique | ForEach-Object { " - $_" } | Out-String))
}

Write-Host "Security scan passed."
