param([switch]$ProbeMcp)
$ErrorActionPreference = 'Stop'
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCommand) {
    @{schemaVersion=1;status='missing-node';nextAction='Install maintained Node.js 22 or 24, reopen the shell and Codex, then run this diagnostic again.'} | ConvertTo-Json
    exit 1
}
$diagnostic = Join-Path $PSScriptRoot 'doctor.mjs'
if ($ProbeMcp) { & $nodeCommand.Source $diagnostic --probe-mcp } else { & $nodeCommand.Source $diagnostic }
exit $LASTEXITCODE
