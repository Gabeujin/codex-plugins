param(
    [Parameter(Mandatory)][string]$OutputPath,
    [ValidateRange(5,60)][int]$TimeoutSeconds = 35,
    [ValidatePattern('^[0-9]{3}$')][string]$Token = '123'
)
$ErrorActionPreference = 'Stop'
if (Test-Path -LiteralPath $OutputPath) { throw 'Output already exists; use a unique run path.' }
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()
$script:attempts = 0
$script:matched = $false
$script:seen = $false
$script:closedBy = 'dismissed'
$form = [System.Windows.Forms.Form]::new()
$form.Text = 'Codex Daily Check - Windows notification test'
$form.Size = [Drawing.Size]::new(530,265)
$form.StartPosition = 'CenterScreen'
$form.TopMost = $true
$label = [Windows.Forms.Label]::new()
$label.Text = "Codex Daily Check diagnostic only (not permission approval).`r`nType $Token and click Send. No action will be authorized."
$label.Location = [Drawing.Point]::new(18,18)
$label.Size = [Drawing.Size]::new(480,48)
$inputBox = [Windows.Forms.TextBox]::new()
$inputBox.Location = [Drawing.Point]::new(18,78)
$inputBox.Width = 470
$checkbox = [Windows.Forms.CheckBox]::new()
$checkbox.Text = 'I also saw the separate Windows balloon notification.'
$checkbox.Location = [Drawing.Point]::new(18,117)
$checkbox.Size = [Drawing.Size]::new(485,26)
$button = [Windows.Forms.Button]::new()
$button.Text = 'Send test response'
$button.Location = [Drawing.Point]::new(18,159)
$button.Size = [Drawing.Size]::new(175,32)
$button.Add_Click({
    $script:attempts++
    $script:matched = $inputBox.Text.Trim() -ceq $Token
    if (-not $script:matched) {
        $label.Text = "Please enter the 3-digit code: $Token. Try again before the timer ends."
        $inputBox.SelectAll()
        $inputBox.Focus()
        return
    }
    $script:seen = $checkbox.Checked
    $script:closedBy = 'submitted'
    $form.Close()
})
$form.Controls.AddRange(@($label,$inputBox,$checkbox,$button))
$form.AcceptButton = $button
$notify = [Windows.Forms.NotifyIcon]::new()
$notify.Icon = [Drawing.SystemIcons]::Information
$notify.Visible = $true
$notify.BalloonTipTitle = 'Codex Daily Check'
$notify.BalloonTipText = 'Simple Windows notification test. No approval is requested.'
$notify.BalloonTipIcon = 'Info'
$script:balloonShown = $false
$notify.Add_BalloonTipShown({ $script:balloonShown = $true })
$timer = [Windows.Forms.Timer]::new()
$timer.Interval = $TimeoutSeconds * 1000
$timer.Add_Tick({ $script:closedBy = 'timeout'; $form.Close() })
$form.Add_Shown({ $notify.ShowBalloonTip(10000); $timer.Start(); $inputBox.Focus() })
$started = [DateTimeOffset]::UtcNow
try { [void]$form.ShowDialog() }
finally { $timer.Stop(); $timer.Dispose(); $notify.Dispose(); $form.Dispose() }
$result = [ordered]@{
    schemaVersion = 1
    provider = 'plugin-owned-winforms-diagnostic'
    startedAt = $started.ToString('o')
    elapsedSeconds = [math]::Round(([DateTimeOffset]::UtcNow - $started).TotalSeconds,3)
    closedBy = $script:closedBy
    responseMatched = $script:matched
    responseAttempts = $script:attempts
    notificationApiEvent = $script:balloonShown
    notificationUserConfirmed = $script:seen
    codexApprovalProven = $false
}
$json = $result | ConvertTo-Json -Depth 5
$fullPath = [IO.Path]::GetFullPath($OutputPath)
[IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($fullPath)) | Out-Null
$utf8 = [Text.UTF8Encoding]::new($false,$true)
$bytes = $utf8.GetBytes($json)
$stream = [IO.File]::Open($fullPath,[IO.FileMode]::CreateNew)
try { $stream.Write($bytes,0,$bytes.Length) } finally { $stream.Dispose() }
if ([IO.File]::ReadAllText($fullPath,$utf8) -cne $json) { throw 'Readback mismatch' }
Write-Output $json
