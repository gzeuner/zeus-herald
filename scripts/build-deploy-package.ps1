param(
  [string]$OutputDir = "dist",
  [string]$Name = "zeus-herald-deploy",
  [switch]$NoEnv
)

$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$outputRoot = Join-Path $root $OutputDir
New-Item -ItemType Directory -Force -Path $outputRoot | Out-Null

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$zipPath = Join-Path $outputRoot "$Name-$timestamp.zip"
if (Test-Path -LiteralPath $zipPath) {
  Remove-Item -LiteralPath $zipPath -Force
}

$excludedDirs = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
@(
  ".git",
  ".local",
  ".lock",
  "node_modules",
  "images",
  "state",
  "logs",
  "dist",
  "build",
  "target",
  ".wwebjs_auth",
  ".wwebjs_cache"
) | ForEach-Object { [void]$excludedDirs.Add($_) }

$excludedFileNames = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
@(".DS_Store", "Thumbs.db") | ForEach-Object { [void]$excludedFileNames.Add($_) }

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::Open($zipPath, [System.IO.Compression.ZipArchiveMode]::Create)
$fileCount = 0
$includedEnv = $false

try {
  Get-ChildItem -LiteralPath $root -Recurse -File -Force | ForEach-Object {
    $file = $_
    $relative = $file.FullName.Substring($root.Length).TrimStart("\", "/")
    $parts = $relative -split "[\\/]"

    foreach ($part in $parts) {
      if ($excludedDirs.Contains($part)) { return }
    }

    if ($excludedFileNames.Contains($file.Name)) { return }
    if ($file.Name -like "*.zip") { return }

    if ($file.Name -like ".env*") {
      if ($file.Name -eq ".env.example") {
        # keep neutral template
      } elseif ($file.Name -eq ".env" -and -not $NoEnv) {
        $includedEnv = $true
      } else {
        return
      }
    }

    $entryName = $relative.Replace("\", "/")
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $file.FullName, $entryName, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
    $script:fileCount += 1
  }
}
finally {
  $zip.Dispose()
}

$hash = Get-FileHash -Algorithm SHA256 -LiteralPath $zipPath
Write-Host "Created: $zipPath"
Write-Host "Files: $fileCount"
Write-Host "Includes private .env: $includedEnv"
Write-Host "SHA256: $($hash.Hash)"
Write-Host "Excluded: node_modules, .git, images, state, logs, .lock, dist/build/target, legacy browser sessions"

if (-not $includedEnv -and -not $NoEnv) {
  Write-Warning "No .env file was included. Create local .env or rerun without -NoEnv."
}


