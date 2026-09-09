[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$OutputDirectory,
  [int]$Port = 8765
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$sourceRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$demoRoot = Join-Path $sourceRoot "assets\demo"
$replayScript = Join-Path $sourceRoot "tests\browser\round2-replay.js"
$outputRoot = [System.IO.Path]::GetFullPath($OutputDirectory)
$npx = (Get-Command npx.cmd -ErrorAction Stop).Source
$python = (Get-Command python -ErrorAction Stop).Source
$playwrightPackage = "@playwright/cli@0.1.19"
$session = "kgj-round2-$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"
$server = $null
$traceStarted = $false
$opened = $false

if (Test-Path -LiteralPath $outputRoot) {
  throw "OutputDirectory already exists; replay refuses to overwrite evidence: $outputRoot"
}
if (-not (Test-Path -LiteralPath $replayScript -PathType Leaf)) {
  throw "Browser replay script is missing: $replayScript"
}
New-Item -ItemType Directory -Path $outputRoot | Out-Null

function Write-Utf8NoBom {
  param([string]$Path, [string]$Value)
  [System.IO.File]::WriteAllText($Path, $Value, [System.Text.UTF8Encoding]::new($false))
}

function Invoke-PwCli {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string[]]$Arguments,
    [switch]$AllowFailure
  )
  $stdoutPath = Join-Path $outputRoot "$Name.stdout.log"
  $stderrPath = Join-Path $outputRoot "$Name.stderr.log"
  $commandArguments = @("--yes", "--package", $playwrightPackage, "playwright-cli", "--session", $session) + $Arguments
  $stdout = & $npx @commandArguments 2> $stderrPath
  $exitStatus = $LASTEXITCODE
  Write-Utf8NoBom -Path $stdoutPath -Value (($stdout | ForEach-Object { [string]$_ }) -join "`n")
  if ($exitStatus -ne 0 -and -not $AllowFailure) {
    throw "Playwright CLI step failed: $Name (exit $exitStatus)"
  }
  [pscustomobject]@{
    Name = $Name
    ExitStatus = $exitStatus
    StdoutPath = $stdoutPath
    StderrPath = $stderrPath
    Stdout = (($stdout | ForEach-Object { [string]$_ }) -join "`n")
    Arguments = $commandArguments
  }
}

function Get-RelativePathSafe {
  param([string]$Base, [string]$Path)
  [System.IO.Path]::GetRelativePath($Base, $Path).Replace("\", "/")
}

$serverStdout = Join-Path $outputRoot "server.stdout.log"
$serverStderr = Join-Path $outputRoot "server.stderr.log"

try {
  $server = Start-Process -FilePath $python -ArgumentList @("-m", "http.server", [string]$Port, "--bind", "127.0.0.1") -WorkingDirectory $demoRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput $serverStdout -RedirectStandardError $serverStderr
  $ready = $false
  for ($attempt = 0; $attempt -lt 50; $attempt += 1) {
    try {
      $response = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/" -UseBasicParsing -TimeoutSec 1
      if ($response.StatusCode -eq 200) { $ready = $true; break }
    } catch {
      Start-Sleep -Milliseconds 100
    }
  }
  if (-not $ready) { throw "Local exact-source server did not become ready" }

  Push-Location $outputRoot
  try {
    $openResult = Invoke-PwCli -Name "01-open" -Arguments @("open", "http://127.0.0.1:$Port/", "--browser", "chrome")
    $opened = $true
    $traceResult = Invoke-PwCli -Name "02-tracing-start" -Arguments @("tracing-start")
    $traceStarted = $true
    $replayResult = Invoke-PwCli -Name "03-browser-replay" -Arguments @("run-code", "--filename", $replayScript, "--json")
    $snapshotResult = Invoke-PwCli -Name "04-semantic-snapshot" -Arguments @("snapshot")
    $consoleResult = Invoke-PwCli -Name "05-console-errors" -Arguments @("console", "error")
    $traceStopResult = Invoke-PwCli -Name "06-tracing-stop" -Arguments @("tracing-stop")
    $traceStarted = $false
  } finally {
    Pop-Location
  }

  $envelope = $replayResult.Stdout | ConvertFrom-Json
  $replay = $envelope.result | ConvertFrom-Json
  Write-Utf8NoBom -Path (Join-Path $outputRoot "browser-replay-result.json") -Value ($replay | ConvertTo-Json -Depth 16)
  if ($replay.status -ne "pass") {
    throw "Browser replay returned HOLD; inspect browser-replay-result.json"
  }

  $failedChecks = @($replay.checks | Where-Object status -ne "pass")
  $failedControls = @($replay.negativeControls | Where-Object status -ne "pass")
  if ($failedChecks.Count -ne 0 -or $failedControls.Count -ne 0) {
    throw "Browser replay contains failed checks or negative controls"
  }
} finally {
  if ($traceStarted) {
    Push-Location $outputRoot
    try { Invoke-PwCli -Name "98-tracing-stop-on-error" -Arguments @("tracing-stop") -AllowFailure | Out-Null } finally { Pop-Location }
  }
  if ($opened) {
    Push-Location $outputRoot
    try { Invoke-PwCli -Name "99-close" -Arguments @("close") -AllowFailure | Out-Null } finally { Pop-Location }
  }
  if ($server -and -not $server.HasExited) {
    Stop-Process -Id $server.Id -Force
    $server.WaitForExit()
  }
}

$sourceBindings = @(
  "assets/demo/index.html",
  "assets/demo/styles.css",
  "assets/demo/app.js",
  "tests/browser/round2-replay.js",
  "scripts/Invoke-KgjBrowserReplay.ps1"
) | ForEach-Object {
  $path = Join-Path $sourceRoot $_
  [ordered]@{
    path = $_.Replace("\", "/")
    bytes = (Get-Item -LiteralPath $path).Length
    sha256 = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
  }
}

$artifactEntries = Get-ChildItem -LiteralPath $outputRoot -Recurse -File |
  Where-Object Name -ne "browser-replay-receipt.json" |
  Sort-Object FullName |
  ForEach-Object {
    [ordered]@{
      path = Get-RelativePathSafe -Base $outputRoot -Path $_.FullName
      bytes = $_.Length
      sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    }
  }

$transcriptMaterial = [ordered]@{
  schemaVersion = "1.0"
  runner = "kgj-browser-replay"
  runnerVersion = "1.0.0"
  playwrightCli = "0.1.19"
  sourceBindings = @($sourceBindings)
  artifacts = @($artifactEntries)
}
$canonicalTranscript = $transcriptMaterial | ConvertTo-Json -Depth 12 -Compress
$transcriptBytes = [System.Text.Encoding]::UTF8.GetBytes($canonicalTranscript)
$transcriptHash = [System.Convert]::ToHexString([System.Security.Cryptography.SHA256]::HashData($transcriptBytes)).ToLowerInvariant()

$receipt = [ordered]@{
  schemaVersion = "1.0"
  id = "evidence.r2.browser-replay"
  result = "pass"
  exitStatus = 0
  startedAt = $replay.startedAt
  completedAt = $replay.completedAt
  runner = [ordered]@{
    name = "kgj-browser-replay"
    version = "1.0.0"
    playwrightCli = "0.1.19"
    shell = $false
  }
  environment = $replay.environment
  checks = @($replay.checks)
  negativeControls = @($replay.negativeControls)
  consoleEntries = @($replay.consoleEntries)
  pageErrors = @($replay.pageErrors)
  sourceBindings = @($sourceBindings)
  artifacts = @($artifactEntries)
  limitations = @($replay.limitations)
  transcriptSha256 = $transcriptHash
}
$receiptPath = Join-Path $outputRoot "browser-replay-receipt.json"
Write-Utf8NoBom -Path $receiptPath -Value ($receipt | ConvertTo-Json -Depth 16)

[pscustomobject]@{
  ok = $true
  status = "PASS"
  checks = @($replay.checks).Count
  negativeControls = @($replay.negativeControls).Count
  browser = $replay.environment.browser
  browserVersion = $replay.environment.browserVersion
  artifacts = @($artifactEntries).Count
  transcriptSha256 = $transcriptHash
  receipt = $receiptPath
} | ConvertTo-Json -Depth 5
