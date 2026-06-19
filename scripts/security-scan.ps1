param(
  [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
  [switch]$ShowAdvisory
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
  @{ Name = "Literal password field"; Regex = "\bpassword\s*:\s*['""][^'""\r\n]{4,}['""]" },
  @{ Name = "Dangerous eval"; Regex = "\beval\s*\(" },
  @{ Name = "Dynamic Function constructor"; Regex = "\bnew\s+Function\s*\(" },
  @{ Name = "document.write"; Regex = "\bdocument\.write\s*\(" },
  @{ Name = "String timer execution"; Regex = "\bset(?:Timeout|Interval)\s*\(\s*['""]" },
  @{ Name = "javascript: URL"; Regex = "href\s*=\s*['""]javascript:" }
)

$advisoryPatterns = @(
  @{ Name = "DOM HTML sink"; Regex = "\b(innerHTML|outerHTML|insertAdjacentHTML)\b" },
  @{ Name = "Inline event handler"; Regex = "\son[a-z]+\s*=" },
  @{ Name = "Browser storage write"; Regex = "\b(localStorage|sessionStorage)\.setItem\b" }
)

$files = Get-ChildItem -LiteralPath $Root -Recurse -Force -File | Where-Object {
  $path = $_.FullName
  -not ($excludeDirs | Where-Object { $path -match $_ }) -and
  -not ($excludeExtensions -contains $_.Extension.ToLowerInvariant())
}

$findings = New-Object System.Collections.Generic.List[string]
foreach ($file in $files) {
  $text = ""
  try { $text = [string](Get-Content -LiteralPath $file.FullName -Raw -ErrorAction Stop) }
  catch { continue }
  foreach ($pattern in $patterns) {
    if ($text -match $pattern.Regex) {
      $rel = Resolve-Path -LiteralPath $file.FullName -Relative
      $findings.Add("$($pattern.Name): $rel")
    }
  }
  if ($file.Extension.ToLowerInvariant() -in @(".html", ".htm")) {
    $externalScriptsWithoutSri = [regex]::Matches($text, "(?is)<script\b(?=[^>]*\bsrc\s*=\s*['""]https?://)(?![^>]*\bintegrity\s*=)[^>]*>")
    if ($externalScriptsWithoutSri.Count -gt 0) {
      $rel = Resolve-Path -LiteralPath $file.FullName -Relative
      $findings.Add("External script without SRI: $rel")
    }
  }
}

if ($findings.Count -gt 0) {
  Write-Error ("Security scan failed:`n" + ($findings | Sort-Object -Unique | ForEach-Object { " - $_" } | Out-String))
}

if ($ShowAdvisory) {
  $advisories = New-Object System.Collections.Generic.List[string]
  foreach ($file in $files) {
    if (-not ($file.Extension.ToLowerInvariant() -in @(".html", ".htm", ".js", ".py"))) { continue }
    $text = ""
    try { $text = [string](Get-Content -LiteralPath $file.FullName -Raw -ErrorAction Stop) }
    catch { continue }
    foreach ($pattern in $advisoryPatterns) {
      $count = [regex]::Matches($text, $pattern.Regex).Count
      if ($count -gt 0) {
        $rel = Resolve-Path -LiteralPath $file.FullName -Relative
        $advisories.Add("$($pattern.Name): $rel ($count)")
      }
    }
  }
  if ($advisories.Count -gt 0) {
    Write-Host "Security advisory hotspots:"
    $advisories | Sort-Object | ForEach-Object { Write-Host " - $_" }
  }
}

Write-Host "Security scan passed."
