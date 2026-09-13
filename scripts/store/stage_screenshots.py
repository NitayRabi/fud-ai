#!/usr/bin/env python3
"""Copy marketing PNGs into store/metadata/screenshots/ for Play + ASC upload paths."""
from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "web" / "assets" / "screenshots"
TARGETS = (
    ROOT / "store" / "metadata" / "screenshots" / "play" / "phone",
    ROOT / "store" / "metadata" / "screenshots" / "ios" / "6.7",
)


def fail(msg: str) -> None:
    print(f"error: {msg}", file=sys.stderr)
    raise SystemExit(1)


def stage(*, dry_run: bool) -> list[Path]:
    if not SOURCE.is_dir():
        fail(f"screenshot source missing: {SOURCE.relative_to(ROOT)}")

    pngs = sorted(SOURCE.glob("*.png"))
    if not pngs:
        fail(f"no PNG files under {SOURCE.relative_to(ROOT)}")

    copied: list[Path] = []
    for target in TARGETS:
        if dry_run:
            print(f"dry-run: would copy {len(pngs)} PNG(s) → {target.relative_to(ROOT)}")
            continue
        target.mkdir(parents=True, exist_ok=True)
        for path in pngs:
            dest = target / path.name
            shutil.copy2(path, dest)
            copied.append(dest)

    if not dry_run:
        print(
            f"staged {len(pngs)} screenshot(s) into "
            f"{len(TARGETS)} store metadata folder(s)"
        )
    return copied


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print planned copies only (no filesystem changes)",
    )
    args = parser.parse_args()
    stage(dry_run=args.dry_run)


if __name__ == "__main__":
    main()
