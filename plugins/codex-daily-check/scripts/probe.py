#!/usr/bin/env python3
"""Bounded local version probe with an optional read-only npm registry check."""
from __future__ import annotations
import argparse, datetime as dt, json, os, re, shutil, signal, subprocess, sys, time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Sequence
from urllib.error import URLError
from urllib.request import urlopen

TOTAL_SUBPROCESS_SECONDS = 45.0
KOREAN_ROUNDTRIP_TEXT = "코덱스 점검: 한글 UTF-8 왕복 확인"
VERSION_PATTERN = re.compile(r"\b\d+(?:\.\d+){1,3}(?:[-+][0-9A-Za-z.-]+)?\b")
STABLE_SEMVER = re.compile(r"^\d+\.\d+\.\d+$")
LATEST_URL = "https://registry.npmjs.org/@openai/codex/latest"
CREATE_NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0)
CREATE_NEW_PROCESS_GROUP = getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)

@dataclass
class CommandResult:
    command: list[str]; returncode: int | None; stdout: str; stderr: str; elapsed_seconds: float
    timed_out: bool = False; decode_failed: bool = False

def decode_strict(value: bytes | str | None) -> tuple[str, bool]:
    if value is None: return "", False
    if isinstance(value, str): return value, False
    try: return value.decode("utf-8", errors="strict"), False
    except UnicodeDecodeError: return "", True

class SubprocessBudget:
    """Enforce one budget; kill a POSIX process group or the direct Windows child only."""
    def __init__(self, total_seconds: float = TOTAL_SUBPROCESS_SECONDS) -> None:
        self.total_seconds, self._started = total_seconds, time.monotonic()
    def remaining_seconds(self) -> float:
        return max(0.0, self.total_seconds - (time.monotonic() - self._started))
    def run(self, command: Sequence[str], requested_timeout: float) -> CommandResult:
        remaining = self.remaining_seconds()
        if remaining <= 0: return CommandResult(list(command), None, "", "subprocess budget exhausted", 0.0, True)
        started = time.monotonic()
        try:
            options = {"stdout":subprocess.PIPE,"stderr":subprocess.PIPE,"text":False}
            if os.name == "nt": options["creationflags"] = CREATE_NO_WINDOW | CREATE_NEW_PROCESS_GROUP
            else: options["start_new_session"] = True
            process = subprocess.Popen(list(command), **options)
        except OSError as error:
            return CommandResult(list(command), None, "", str(error), time.monotonic() - started)
        try:
            stdout_raw, stderr_raw = process.communicate(timeout=min(requested_timeout, remaining))
            stdout, stdout_bad = decode_strict(stdout_raw); stderr, stderr_bad = decode_strict(stderr_raw)
            return CommandResult(list(command), process.returncode, stdout, stderr, time.monotonic() - started, decode_failed=stdout_bad or stderr_bad)
        except subprocess.TimeoutExpired:
            # Do not use taskkill by numeric PID: a recycled PID could target another process.
            try:
                if os.name == "nt": process.kill()
                else: os.killpg(process.pid, signal.SIGKILL)
            except OSError: pass
            try: stdout_raw, stderr_raw = process.communicate(timeout=min(2.0,max(0.1,self.remaining_seconds())))
            except subprocess.TimeoutExpired: stdout_raw, stderr_raw = b"", b""
            stdout, stdout_bad = decode_strict(stdout_raw); stderr, stderr_bad = decode_strict(stderr_raw)
            return CommandResult(list(command), None, stdout, stderr, time.monotonic() - started, True, stdout_bad or stderr_bad)

def parse_version(text: str) -> str | None:
    match = VERSION_PATTERN.search(text)
    return match.group(0) if match else None

def version_parts(value: str) -> tuple[tuple[int, ...], str | None] | None:
    core, separator, suffix = value.partition("-"); core = core.split("+", 1)[0]
    try: return tuple(int(part) for part in core.split(".")), suffix if separator else None
    except ValueError: return None

def compare_cli_versions(standalone: str | None, bundled: str | None) -> str:
    """Compare CLI builds only; Desktop Appx versions are deliberately excluded."""
    if not standalone or not bundled: return "unknown"
    left, right = version_parts(standalone), version_parts(bundled)
    if left is None or right is None: return "unparseable"
    left_numbers, left_channel = left; right_numbers, right_channel = right
    if bool(left_channel) != bool(right_channel): return "different_channel"
    width = max(len(left_numbers), len(right_numbers)); left_numbers += (0,) * (width - len(left_numbers)); right_numbers += (0,) * (width - len(right_numbers))
    if left_numbers == right_numbers: return "equal" if left_channel == right_channel else "different_channel"
    return "standalone_newer" if left_numbers > right_numbers else "bundled_newer"

def compare_stable_versions(current: str | None, latest: str | None) -> str:
    if not current or not latest or not STABLE_SEMVER.fullmatch(current) or not STABLE_SEMVER.fullmatch(latest): return "unknown"
    current_parts = tuple(map(int,current.split("."))); latest_parts = tuple(map(int,latest.split(".")))
    if current_parts == latest_parts: return "up_to_date"
    return "update_available" if current_parts < latest_parts else "current_newer"

def npm_install_source(snapshot: dict[str, Any]) -> dict[str, Any]:
    path = snapshot.get("path"); version = snapshot.get("version")
    if snapshot.get("status") != "ok" or not path or not version or Path(path).name.lower() != "codex.cmd":
        return {"status":"unknown_manual","reason":"PATH snapshot is not a successful npm codex.cmd version"}
    package_path = Path(path).parent / "node_modules" / "@openai" / "codex" / "package.json"
    try:
        package = json.loads(package_path.read_text(encoding="utf-8",errors="strict"))
    except (OSError,ValueError,json.JSONDecodeError):
        return {"status":"unknown_manual","reason":"Adjacent npm package metadata unavailable"}
    if package.get("name") != "@openai/codex" or package.get("version") != version:
        return {"status":"unknown_manual","reason":"Adjacent npm package metadata did not match PATH version"}
    return {"status":"verified_npm_global","packagePath":str(package_path),"name":package["name"],"version":package["version"]}

def check_latest(budget: SubprocessBudget, snapshot: dict[str, Any], opener=urlopen) -> dict[str, Any]:
    result = {"requested":True,"networkAttempted":False,"checkedAt":None,"sourceUrl":LATEST_URL,"date":None,"status":"unknown","version":None,"comparison":"unknown","updateCommandSuggestion":None}
    timeout = min(5.0,budget.remaining_seconds())
    if timeout <= 0: return result
    result["networkAttempted"] = True; result["checkedAt"] = dt.datetime.now(dt.timezone.utc).isoformat()
    try:
        with opener(LATEST_URL,timeout=timeout) as response:
            body = response.read(65537)
            if len(body) > 65536: return result
            payload = json.loads(body.decode("utf-8",errors="strict")); result["date"] = response.headers.get("Date")
    except (OSError,URLError,ValueError,UnicodeDecodeError,json.JSONDecodeError):
        return result
    latest = payload.get("version") if isinstance(payload,dict) and payload.get("name") == "@openai/codex" else None
    if not isinstance(latest,str) or not STABLE_SEMVER.fullmatch(latest): return result
    result.update({"status":"ok","version":latest,"comparison":compare_stable_versions(snapshot.get("version") if snapshot.get("status")=="ok" else None,latest)})
    provenance = npm_install_source(snapshot); result["installSource"] = provenance
    if result["comparison"] == "update_available" and provenance["status"] == "verified_npm_global":
        result["updateCommandSuggestion"] = "npm install -g @openai/codex@latest"
    return result

def discover_desktop(budget: SubprocessBudget) -> dict[str, Any]:
    if os.name != "nt":
        return {"found":False,"version":None,"install_path":None,"status":"unsupported","reason":"Desktop Appx discovery is Windows-only"}
    script = "$p=Get-AppxPackage -Name OpenAI.Codex -ErrorAction SilentlyContinue | Select-Object -First 1 Name,Version,InstallLocation; if($p){$p|ConvertTo-Json -Compress}"
    result = budget.run(["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", script], 7)
    desktop: dict[str, Any] = {"found": False, "version": None, "install_path": None, "status":"not_found"}
    if result.returncode == 0 and not result.decode_failed and result.stdout.strip():
        try:
            data = json.loads(result.stdout); desktop = {"found": True, "version": str(data.get("Version")), "install_path": data.get("InstallLocation"), "status":"ok"}
        except json.JSONDecodeError: desktop.update(status="failed",discovery_error="Appx response was not JSON")
    elif result.decode_failed: desktop.update(status="failed",discovery_error="Appx response was not valid UTF-8")
    elif result.timed_out or result.returncode is None or result.returncode != 0 or result.stderr: desktop.update(status="failed",discovery_error="Appx discovery failed")
    return desktop

def bundled_cli_path(desktop: dict[str, Any]) -> str | None:
    """Return only the verified native CLI in this Desktop package; never fall back."""
    install_path = desktop.get("install_path")
    if not install_path: return None
    candidate = Path(install_path) / "app" / "resources" / "codex.exe"
    try:
        with candidate.open("rb") as binary: return str(candidate) if binary.read(2) == b"MZ" else None
    except OSError: return None

def resolve_wrapper(explicit: str | None) -> Path | None:
    if explicit:
        candidate = Path(explicit).expanduser()
        if not candidate.is_file(): raise ValueError("--cli-wrapper must name an existing file")
        return candidate.resolve()
    home = Path(os.environ.get("CODEX_HOME",Path.home()/".codex"))
    candidate = home / "scripts" / "Invoke-FreshCodexCli.ps1"
    return candidate if candidate.is_file() else None

def wrapper_shell() -> str | None:
    return "powershell.exe" if os.name == "nt" else shutil.which("pwsh")

def cli_version(budget: SubprocessBudget, cli_path: str | None, wrapper: Path | None = None) -> dict[str, Any]:
    if not cli_path: return {"path":None,"resolution":"not_found","version":None,"status":"not_found"}
    shell = wrapper_shell() if wrapper else None
    if wrapper and shell:
        command = [shell, "-NoProfile", "-NonInteractive", "-File", str(wrapper), "--wrapper-mode", "path", "--wrapper-path", cli_path, "--version"]
        resolution = "fresh_wrapper_exact_path"
    else:
        command = [cli_path,"--version"]
        resolution = "direct_fresh_subprocess"
    result = budget.run(command, 11)
    version = parse_version(result.stdout) if result.returncode == 0 and not result.decode_failed else None
    return {"path":cli_path,"resolution":resolution,"version":version,"status":"ok" if version else "failed","timed_out":result.timed_out,"decode_failed":result.decode_failed}

def wrapper_default_version(budget: SubprocessBudget, wrapper: Path | None) -> dict[str, Any]:
    shell = wrapper_shell() if wrapper else None
    if not wrapper or not shell:
        return {"path":None,"resolution":"not_tested_without_wrapper","version":None,"status":"not_tested"}
    result = budget.run([shell,"-NoProfile","-NonInteractive","-File",str(wrapper),"--version"],11)
    version = parse_version(result.stdout) if result.returncode == 0 and not result.decode_failed else None
    return {"path":None,"resolution":"wrapper_default_fresh_environment","version":version,"status":"ok" if version else "failed","timed_out":result.timed_out,"decode_failed":result.decode_failed}

def assert_new_targets(output: Path) -> Path:
    artifact = output.with_name(f"{output.stem}.korean-roundtrip.txt")
    if output.exists() or artifact.exists(): raise FileExistsError("Refusing to overwrite a probe report or Korean roundtrip artifact")
    return artifact

def exclusive_write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("x", encoding="utf-8", newline="\n") as handle: handle.write(content)

def write_json(output: Path, data: dict[str, Any]) -> Path:
    intended = json.dumps(data, ensure_ascii=False, indent=2) + "\n"; exclusive_write(output, intended)
    if output.read_text(encoding="utf-8", errors="strict") != intended: raise RuntimeError("Persisted JSON did not exactly match the intended UTF-8 text")
    return output

def korean_roundtrip_artifact(artifact: Path) -> dict[str, Any]:
    exclusive_write(artifact, KOREAN_ROUNDTRIP_TEXT)
    actual = artifact.read_text(encoding="utf-8", errors="strict")
    return {"path": str(artifact), "exact_match": actual == KOREAN_ROUNDTRIP_TEXT, "retained": True}

def build_report(output: Path, check_latest_requested: bool = False, cli_wrapper: str | None = None) -> dict[str, Any]:
    artifact = assert_new_targets(output); wrapper = resolve_wrapper(cli_wrapper); budget = SubprocessBudget(); desktop = discover_desktop(budget)
    path_snapshot = shutil.which("codex")
    resolved_path = str(Path(path_snapshot).resolve()) if path_snapshot else None
    snapshot_cli = cli_version(budget,resolved_path,wrapper)
    fresh_cli = wrapper_default_version(budget,wrapper)
    bundled_path = bundled_cli_path(desktop)
    bundled = cli_version(budget,bundled_path,wrapper) if os.name == "nt" else {"path":None,"version":None,"status":"unsupported","reason":"Bundled Desktop CLI is Windows-only"}
    latest = check_latest(budget,snapshot_cli) if check_latest_requested else {"requested":False,"networkAttempted":False,"checkedAt":None,"sourceUrl":LATEST_URL,"date":None,"status":"not_requested","version":None,"comparison":"unknown","updateCommandSuggestion":None}
    return {"schema_version": 3, "offline": not check_latest_requested, "desktop_appx": desktop, "path_cli_snapshot": snapshot_cli, "fresh_environment_cli": fresh_cli, "bundled_cli": bundled, "cli_version_comparison": compare_cli_versions(fresh_cli.get("version"), bundled.get("version")), "latestStandaloneCli":latest, "subprocess_budget_seconds": TOTAL_SUBPROCESS_SECONDS, "subprocess_budget_remaining_seconds": round(budget.remaining_seconds(), 3), "korean_roundtrip": korean_roundtrip_artifact(artifact)}

def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__); parser.add_argument("--output", required=True, type=Path, help="New UTF-8 JSON report path"); parser.add_argument("--check-latest",action="store_true",help="Read official npm registry only; never installs or updates"); parser.add_argument("--cli-wrapper",help="Optional existing fresh-CLI wrapper path") ; args = parser.parse_args(argv)
    write_json(args.output, build_report(args.output,args.check_latest,args.cli_wrapper)); print(args.output); return 0

if __name__ == "__main__": raise SystemExit(main())
