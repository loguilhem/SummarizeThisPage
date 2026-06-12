param(
  [ValidateSet("chrome", "firefox", "all")]
  [string]$Target = "all"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot
$DistRoot = Join-Path $ProjectRoot "dist"
$CommonFiles = @(
  "background.js",
  "content.js",
  "sidepanel.html",
  "sidepanel.js",
  "options.html",
  "options.js",
  "styles.css",
  "logo_stp.png",
  "LICENSE"
)
$CommonDirectories = @("icons", "i18n")

function Build-Extension {
  param(
    [string]$Name,
    [string]$Manifest
  )

  $OutputDirectory = Join-Path $DistRoot $Name

  if (Test-Path $OutputDirectory) {
    Remove-Item -LiteralPath $OutputDirectory -Recurse -Force
  }

  New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null

  foreach ($File in $CommonFiles) {
    Copy-Item -LiteralPath (Join-Path $ProjectRoot $File) -Destination $OutputDirectory
  }

  foreach ($Directory in $CommonDirectories) {
    Copy-Item -LiteralPath (Join-Path $ProjectRoot $Directory) -Destination $OutputDirectory -Recurse
  }

  Copy-Item -LiteralPath (Join-Path $ProjectRoot $Manifest) -Destination (Join-Path $OutputDirectory "manifest.json")
  Write-Output "Built $Name extension in $OutputDirectory"
}

if ($Target -in @("chrome", "all")) {
  Build-Extension -Name "chrome" -Manifest "manifest.chrome.json"
}

if ($Target -in @("firefox", "all")) {
  Build-Extension -Name "firefox" -Manifest "manifest.json"
}
