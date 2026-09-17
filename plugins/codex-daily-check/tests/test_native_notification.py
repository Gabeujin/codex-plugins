"""Exercise the actual click handler without displaying or controlling a window."""
from pathlib import Path
import shutil
import subprocess
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / 'scripts/native-notification.ps1'


class NativeNotificationTests(unittest.TestCase):
    @unittest.skipUnless(shutil.which('pwsh'), 'PowerShell is not installed')
    def test_short_code_retry_does_not_close_or_save_answers(self):
        code = r'''
param($Path)
$tokens=$null; $errors=$null
$ast=[System.Management.Automation.Language.Parser]::ParseFile($Path,[ref]$tokens,[ref]$errors)
if ($errors.Count) { throw 'Parser error' }
$click=$ast.FindAll({param($n) $n -is [System.Management.Automation.Language.InvokeMemberExpressionAst] -and $n.Member.Value -eq 'Add_Click'},$true)
if ($click.Count -ne 1) { throw 'Expected one response handler' }
$handler=$click[0].Arguments[0].ScriptBlock.GetScriptBlock()
$script:attempts=0; $script:matched=$false; $script:closedBy='dismissed'
$Token='123'
$inputBox=[pscustomobject]@{Text='wrong'}
$inputBox | Add-Member ScriptMethod Focus {}
$inputBox | Add-Member ScriptMethod SelectAll {}
$label=[pscustomobject]@{Text=''}
$visibility=[pscustomobject]@{SelectedIndex=1}
$visibility | Add-Member ScriptMethod Focus {}
$form=[pscustomobject]@{Closed=$false}
$form | Add-Member ScriptMethod Close {$this.Closed=$true}
. $handler
if ($form.Closed -or $script:matched -or $script:attempts -ne 1) { throw 'Mismatch must permit retry' }
$inputBox.Text=' 123 '
. $handler
if (-not $form.Closed -or -not $script:matched -or $script:attempts -ne 2 -or $script:closedBy -ne 'submitted') { throw 'Correct code failed' }
$form.Closed=$false
$visibility.SelectedIndex=0
. $handler
if ($form.Closed) { throw 'Must explicitly select visibility' }
foreach ($index in @(1,2,3)) {
    $form.Closed=$false
    $visibility.SelectedIndex=$index
    . $handler
    $expected=@('unknown','seen','not_seen','unknown')[$index]
    if (-not $form.Closed -or $script:visibility -ne $expected -or $script:seen -ne ($index -eq 1)) { throw 'Visibility mapping failed' }
}
$source=[IO.File]::ReadAllText($Path)
if (-not $source.Contains("^[0-9]{3}$")) { throw 'Challenge must be three digits' }
$receipt=$source.Substring($source.IndexOf('$result ='))
if ($receipt.Contains('$inputBox.Text')) { throw 'Raw answer must not be retained' }
'''
        # Use an encoded command so paths and script text never traverse shell quoting.
        import base64
        escaped = str(SCRIPT).replace("'", "''")
        command = '& {\n' + code + "\n} -Path '" + escaped + "'"
        result = subprocess.run(['pwsh', '-NoProfile', '-NonInteractive', '-EncodedCommand',
                                 base64.b64encode(command.encode('utf-16le')).decode('ascii')],
                                capture_output=True, timeout=20)
        self.assertEqual(result.returncode, 0, result.stderr.decode('utf-8', errors='replace'))


if __name__ == '__main__':
    unittest.main()
