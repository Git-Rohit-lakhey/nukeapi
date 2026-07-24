$src = "E:\Applications\nukeapi"
$zip = "E:\Applications\nukeapi-dist.zip"
$excludeDirs = @("node_modules", ".next", ".git", ".claude")

if (Test-Path $zip) { Remove-Item $zip -Force }
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zs = [System.IO.Compression.ZipFile]::Open($zip, 'Create')
$count = 0
Get-ChildItem $src -Recurse -File | ForEach-Object {
  $full = $_.FullName
  $rel = $full.Substring($src.Length + 1)
  $parts = $rel -split '\\'
  if ($parts -contains 'node_modules' -or $parts -contains '.next' -or $parts -contains '.git' -or $parts -contains '.claude') { return }
  if ($_.Extension -eq '.tsbuildinfo') { return }
  if ($_.Name -eq '.env.local') { return }
  if ($rel -eq 'nukeapi-dist.zip') { return }
  $entryName = "nukeapi/" + ($rel -replace '\\', '/')
  $entry = $zs.CreateEntry($entryName)
  $srcStream = [System.IO.File]::OpenRead($full)
  $dstStream = $entry.Open()
  $srcStream.CopyTo($dstStream)
  $srcStream.Dispose()
  $dstStream.Dispose()
  $count++
}
$zs.Dispose()
Write-Host "Zipped $count entries into $zip"
