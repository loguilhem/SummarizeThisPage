$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot
$OutputDirectory = Join-Path $ProjectRoot "dist\firefox"
$ArchivePath = Join-Path $ProjectRoot "dist\SummarizeThisPage-firefox.zip"
$Files = @(
  "background.js",
  "content.js",
  "manifest.json",
  "markdown.js",
  "sidepanel.html",
  "sidepanel.js",
  "options.html",
  "options.js",
  "styles.css",
  "logo_stp.png",
  "LICENSE"
)
$Directories = @("icons", "i18n")

if (Test-Path $OutputDirectory) {
  Remove-Item -LiteralPath $OutputDirectory -Recurse -Force
}

New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null

foreach ($File in $Files) {
  Copy-Item -LiteralPath (Join-Path $ProjectRoot $File) -Destination $OutputDirectory
}

foreach ($Directory in $Directories) {
  Copy-Item -LiteralPath (Join-Path $ProjectRoot $Directory) -Destination $OutputDirectory -Recurse
}

if (Test-Path $ArchivePath) {
  Remove-Item -LiteralPath $ArchivePath -Force
}

Compress-Archive -Path (Join-Path $OutputDirectory "*") -DestinationPath $ArchivePath
Write-Output "Built Firefox extension in $OutputDirectory"
Write-Output "Built Firefox submission archive at $ArchivePath"
