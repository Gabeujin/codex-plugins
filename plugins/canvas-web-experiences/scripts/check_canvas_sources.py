#!/usr/bin/env python3
"""Read-only live checks for Canvas catalog URLs and Chrome feature status."""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import sys
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "references" / "source-catalog.json"
CHROME_STATUS_URL = "https://chromestatus.com/api/v0/features/5172548013916160"
USER_AGENT = "CanvasWebExperiences/1.0 (+read-only-source-check)"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Check live HTML-in-Canvas status or catalog links without writing files."
    )
    parser.add_argument("--chrome-status", action="store_true")
    parser.add_argument("--links", action="store_true")
    parser.add_argument("--strict", action="store_true", help="Fail on every non-2xx/3xx link response.")
    parser.add_argument("--timeout", type=float, default=12.0)
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--format", choices=("text", "json"), default="text")
    return parser.parse_args()


def read_url(url: str, timeout: float, max_bytes: int | None = None) -> tuple[int, bytes, str]:
    request = Request(
        url,
        headers={"User-Agent": USER_AGENT, "Accept": "application/json,text/html,*/*"},
    )
    with urlopen(request, timeout=timeout) as response:
        body = response.read() if max_bytes is None else response.read(max_bytes)
        return response.status, body, response.geturl()


def parse_xssi_json(raw: bytes) -> dict[str, Any]:
    text = raw.decode("utf-8", errors="replace")
    if text.startswith(")]}'"):
        text = text.split("\n", 1)[1]
    data = json.loads(text)
    if not isinstance(data, dict):
        raise ValueError("Expected a JSON object")
    return data


def summarize_chrome_status(timeout: float) -> dict[str, Any]:
    _, raw, final_url = read_url(CHROME_STATUS_URL, timeout)
    data = parse_xssi_json(raw)
    chrome = data.get("browsers", {}).get("chrome", {})
    standards = data.get("standards", {}).get("maturity", {})
    active_stage_id = data.get("active_stage_id")
    active_stage = next(
        (stage for stage in data.get("stages", []) if stage.get("id") == active_stage_id),
        {},
    )
    extension_last = max(
        (
            extension.get("desktop_last") or 0
            for extension in active_stage.get("extensions", [])
            if isinstance(extension, dict)
        ),
        default=0,
    )
    return {
        "checked_url": final_url,
        "feature_id": data.get("id"),
        "name": data.get("name"),
        "updated": data.get("updated", {}).get("when"),
        "implementation_status": chrome.get("status", {}).get("text"),
        "is_released": data.get("is_released"),
        "stable_milestone": chrome.get("desktop"),
        "flag_name": data.get("flag_name"),
        "standards_maturity": standards.get("text"),
        "firefox_signal": data.get("browsers", {}).get("ff", {}).get("view", {}).get("text"),
        "safari_signal": data.get("browsers", {}).get("safari", {}).get("view", {}).get("text"),
        "origin_trial_name": active_stage.get("ot_chromium_trial_name"),
        "origin_trial_desktop_first": active_stage.get("desktop_first"),
        "origin_trial_desktop_last": active_stage.get("desktop_last"),
        "origin_trial_extension_desktop_last": extension_last or None,
        "warning": (
            "Chrome Status metadata is not proof that enrollment, a token, a selected "
            "channel, or an API overload works. Verify DevTools and the target browser."
        ),
    }


def load_links() -> list[str]:
    data = json.loads(CATALOG.read_text(encoding="utf-8"))
    links: set[str] = set()
    for item in data["items"]:
        for field in ("url", "repository"):
            value = item.get(field)
            if isinstance(value, str) and value.startswith(("http://", "https://")):
                links.add(value)
    return sorted(links)


def check_link(url: str, timeout: float) -> dict[str, Any]:
    try:
        status, _, final_url = read_url(url, timeout, max_bytes=1024)
        state = "ok" if 200 <= status < 400 else "warning"
        return {"url": url, "status": status, "state": state, "final_url": final_url}
    except HTTPError as error:
        state = "warning" if error.code in (401, 403, 429) else "failed"
        return {
            "url": url,
            "status": error.code,
            "state": state,
            "error": str(error.reason),
        }
    except (URLError, TimeoutError, OSError) as error:
        return {"url": url, "status": None, "state": "failed", "error": str(error)}


def check_links(timeout: float, workers: int) -> list[dict[str, Any]]:
    links = load_links()
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, min(workers, 16))) as pool:
        results = list(pool.map(lambda url: check_link(url, timeout), links))
    return sorted(results, key=lambda item: (item["state"], item["url"]))


def print_text(status: dict[str, Any] | None, links: list[dict[str, Any]] | None) -> None:
    if status:
        print("Chrome HTML-in-Canvas live status")
        for key, value in status.items():
            print(f"- {key}: {value}")
    if links is not None:
        if status:
            print()
        counts = {state: sum(item["state"] == state for item in links) for state in ("ok", "warning", "failed")}
        print(
            f"Catalog links: total={len(links):,}, ok={counts['ok']:,}, "
            f"warning={counts['warning']:,}, failed={counts['failed']:,}"
        )
        for item in links:
            if item["state"] != "ok":
                print(
                    f"- {item['state'].upper()}: {item['url']} "
                    f"status={item.get('status')} error={item.get('error', '')}"
                )


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    args = parse_args()
    if not args.chrome_status and not args.links:
        args.chrome_status = True

    status: dict[str, Any] | None = None
    links: list[dict[str, Any]] | None = None
    try:
        if args.chrome_status:
            status = summarize_chrome_status(args.timeout)
        if args.links:
            links = check_links(args.timeout, args.workers)
    except (OSError, ValueError, json.JSONDecodeError, URLError) as error:
        print(f"Live check failed: {error}", file=sys.stderr)
        return 2

    payload = {"chrome_status": status, "links": links}
    if args.format == "json":
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    else:
        print_text(status, links)

    if links is None:
        return 0
    failures = [item for item in links if item["state"] == "failed"]
    warnings = [item for item in links if item["state"] == "warning"]
    return 1 if failures or (args.strict and warnings) else 0


if __name__ == "__main__":
    raise SystemExit(main())
