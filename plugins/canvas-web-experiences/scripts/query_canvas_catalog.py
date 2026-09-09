#!/usr/bin/env python3
"""Query the bundled Canvas source catalog without network access."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CATALOG = ROOT / "references" / "source-catalog.json"


def configure_stdout() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Search official Canvas sources and public project references."
    )
    parser.add_argument("--catalog", type=Path, default=DEFAULT_CATALOG)
    parser.add_argument("--query", default="", help="Case-insensitive text search.")
    parser.add_argument("--category", help="Require one exact category.")
    parser.add_argument(
        "--status", help="Require an evidence_status such as official, verified, or candidate."
    )
    parser.add_argument("--maturity", help="Require one exact maturity value.")
    parser.add_argument("--kind", help="Require one exact source kind.")
    parser.add_argument("--license", dest="license_query", help="License substring.")
    parser.add_argument(
        "--format", choices=("markdown", "json"), default="markdown"
    )
    parser.add_argument(
        "--limit", type=int, default=0, help="Maximum results; 0 means all."
    )
    return parser.parse_args()


def load_catalog(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data.get("items"), list):
        raise ValueError("Catalog must contain an items array.")
    return data


def searchable(item: dict[str, Any]) -> str:
    values: list[str] = []
    for key in (
        "id",
        "title",
        "kind",
        "evidence_status",
        "maturity",
        "authority",
        "url",
        "repository",
        "license",
        "notes",
    ):
        value = item.get(key)
        if value is not None:
            values.append(str(value))
    values.extend(str(value) for value in item.get("categories", []))
    return " ".join(values).casefold()


def matches(item: dict[str, Any], args: argparse.Namespace) -> bool:
    if args.query and args.query.casefold() not in searchable(item):
        return False
    if args.category and args.category.casefold() not in {
        str(value).casefold() for value in item.get("categories", [])
    }:
        return False
    for arg_name, field_name in (
        ("status", "evidence_status"),
        ("maturity", "maturity"),
        ("kind", "kind"),
    ):
        expected = getattr(args, arg_name)
        if expected and str(item.get(field_name, "")).casefold() != expected.casefold():
            return False
    if args.license_query and args.license_query.casefold() not in str(
        item.get("license") or ""
    ).casefold():
        return False
    return True


def escape_cell(value: Any) -> str:
    return str(value if value is not None else "—").replace("|", "\\|").replace("\n", " ")


def print_markdown(items: list[dict[str, Any]], checked_on: str) -> None:
    print(f"Catalog checked: {checked_on}; matched: {len(items):,}")
    print()
    if not items:
        print("No matching sources.")
        return
    print("| Title | Kind | Categories | Evidence | Maturity | License | Source |")
    print("|---|---|---|---|---|---|---|")
    for item in items:
        title = escape_cell(item["title"])
        url = item["url"]
        categories = ", ".join(item.get("categories", []))
        print(
            "| "
            + " | ".join(
                (
                    f"[{title}]({url})",
                    escape_cell(item.get("kind")),
                    escape_cell(categories),
                    escape_cell(item.get("evidence_status")),
                    escape_cell(item.get("maturity")),
                    escape_cell(item.get("license")),
                    escape_cell(item.get("authority")),
                )
            )
            + " |"
        )


def main() -> int:
    configure_stdout()
    args = parse_args()
    try:
        data = load_catalog(args.catalog.resolve())
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(f"Catalog error: {error}", file=sys.stderr)
        return 2

    items = [item for item in data["items"] if matches(item, args)]
    items.sort(key=lambda item: (item.get("evidence_status", ""), item["title"].casefold()))
    if args.limit > 0:
        items = items[: args.limit]

    if args.format == "json":
        print(
            json.dumps(
                {
                    "checked_on": data.get("checked_on"),
                    "count": len(items),
                    "items": items,
                },
                ensure_ascii=False,
                indent=2,
            )
        )
    else:
        print_markdown(items, str(data.get("checked_on", "unknown")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
