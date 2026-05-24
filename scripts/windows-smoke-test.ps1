# AllyCat cross-machine smoke test — Windows
# Usage: .\scripts\windows-smoke-test.ps1 -TarballPath "C:\path\to\allycat-0.1.0.tgz"
# Requires: Node.js >= 20 already installed (check: node --version)
param(
    [Parameter(Mandatory=$true)]
    [string]$TarballPath
)

$ErrorActionPreference = 'Stop'
$pass = 0; $fail = 0

function Check($label, $code) {
    & $code
    if ($LASTEXITCODE -eq 0) { Write-Host "  PASS  $label" -ForegroundColor Green; $script:pass++ }
    else                     { Write-Host "  FAIL  $label (exit $LASTEXITCODE)" -ForegroundColor Red; $script:fail++ }
}

Write-Host "`n=== AllyCat Windows Smoke Test ===" -ForegroundColor Cyan
Write-Host "Node: $(node --version)  npm: $(npm --version)"
Write-Host "Tarball: $TarballPath`n"

# Install from tarball
Write-Host "Installing from tarball..." -ForegroundColor Yellow
npm install -g $TarballPath
if ($LASTEXITCODE -ne 0) { Write-Error "Install failed — aborting."; exit 1 }

# Create a temp test dir with a sample HTML file
$testDir = "$env:TEMP\allycat-smoke-$(Get-Random)"
New-Item -ItemType Directory -Force $testDir | Out-Null
$sampleHtml = @'
<html lang="en">
<head><title>Test</title></head>
<body>
  <img src="x.png">
  <button></button>
</body>
</html>
'@
$sampleHtml | Out-File -Encoding utf8 "$testDir\sample.html"

# BOM UTF-8 fixture
node -e "const fs=require('fs'); fs.writeFileSync('$testDir\\bom.html'.replace(/\\\\/g,'\\\\'), '﻿<html lang=""en""><head><title>t</title></head><body><img src=""x""></body></html>', 'utf8');"

Write-Host "`n--- Basic checks ---"
Check "version prints" { allycat --version }
Check "help prints"    { allycat --help }

Write-Host "`n--- Scan: forward slash path ---"
Check "scan forward slash" { allycat scan "$testDir/sample.html" }

Write-Host "`n--- Scan: backslash path ---"
Check "scan backslash" { allycat scan "$testDir\sample.html" }

Write-Host "`n--- BOM UTF-8 file ---"
Check "BOM file scanned" { allycat scan "$testDir\bom.html" }

Write-Host "`n--- Exit code test ---"
$exitCodeFile = "$testDir\sample.html"
allycat scan $exitCodeFile --fail-on-any
$ec = $LASTEXITCODE
if ($ec -eq 3) { Write-Host "  PASS  exit code 3 (--fail-on-any with violations)" -ForegroundColor Green; $pass++ }
else           { Write-Host "  FAIL  expected exit 3, got $ec" -ForegroundColor Red; $fail++ }

Write-Host "`n--- Summary mode ---"
Check "summary mode" { allycat scan "$testDir\sample.html" --summary }

Write-Host "`n--- JSON output ---"
Check "json output" { allycat scan "$testDir\sample.html" --output json }

# Cleanup
npm uninstall -g allycat | Out-Null
Remove-Item -Recurse -Force $testDir

Write-Host "`n==============================="
Write-Host "  PASSED: $pass  FAILED: $fail" -ForegroundColor $(if ($fail -eq 0) {'Green'} else {'Red'})
Write-Host "==============================="
if ($fail -gt 0) { exit 1 }
