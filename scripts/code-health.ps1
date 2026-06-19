param(
  [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
  [int]$Top = 8
)

$ErrorActionPreference = "Stop"

$excludeDirs = @(
  "\\.git\\",
  "\\test-results\\",
  "\\scripts\\__pycache__\\"
)
$extensions = @(".html", ".js", ".css", ".ps1", ".py", ".yml", ".yaml", ".md")

$files = Get-ChildItem -LiteralPath $Root -Recurse -Force -File | Where-Object {
  $path = $_.FullName
  -not ($excludeDirs | Where-Object { $path -match $_ }) -and
  ($extensions -contains $_.Extension.ToLowerInvariant())
}

function Get-RelPath($Path) {
  return Resolve-Path -LiteralPath $Path -Relative
}

$largest = $files |
  Sort-Object Length -Descending |
  Select-Object -First $Top |
  ForEach-Object {
    [pscustomobject]@{
      Path = Get-RelPath $_.FullName
      KB = [math]::Round($_.Length / 1KB, 1)
    }
  }

$hotspots = foreach ($file in $files) {
  $text = ""
  try { $text = Get-Content -LiteralPath $file.FullName -Raw -ErrorAction Stop }
  catch { continue }

  $innerHtml = [regex]::Matches($text, "\b(innerHTML|outerHTML|insertAdjacentHTML)\b").Count
  $inlineHandlers = [regex]::Matches($text, "\son[a-z]+\s*=").Count
  $globalFns = [regex]::Matches($text, "(?m)^\s*function\s+[A-Za-z0-9_]+\s*\(").Count

  if ($innerHtml -or $inlineHandlers -or $globalFns) {
    [pscustomobject]@{
      Path = Get-RelPath $file.FullName
      HtmlSinks = $innerHtml
      InlineHandlers = $inlineHandlers
      GlobalFunctions = $globalFns
      Score = ($innerHtml * 3) + ($inlineHandlers * 2) + $globalFns
    }
  }
}

Write-Host "Code health summary"
Write-Host "Largest files:"
$largest | Format-Table -AutoSize | Out-String | Write-Host

Write-Host "Refactor hotspots:"
$hotspots |
  Sort-Object Score -Descending |
  Select-Object -First $Top Path, HtmlSinks, InlineHandlers, GlobalFunctions |
  Format-Table -AutoSize |
  Out-String |
  Write-Host

Write-Host "Code health scan completed."
