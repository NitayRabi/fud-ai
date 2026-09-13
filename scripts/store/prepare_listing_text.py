#!/usr/bin/env python3
"""Extract listing text fields from APPSTORE.md / PLAYSTORE.md into store metadata dirs."""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def fail(msg: str) -> None:
    print(f"error: {msg}", file=sys.stderr)
    raise SystemExit(1)


def first_fence_after(text: str, heading: str) -> str:
    pattern = rf"^## {re.escape(heading)}\s*$"
    lines = text.splitlines()
    for i, line in enumerate(lines):
        if re.match(pattern, line):
            for j in range(i + 1, len(lines)):
                if lines[j].startswith("## "):
                    break
                if lines[j].strip().startswith("```"):
                    body: list[str] = []
                    for k in range(j + 1, len(lines)):
                        if lines[k].strip().startswith("```"):
                            return "\n".join(body).strip()
                        body.append(lines[k])
                    fail(f"unclosed fence under {heading}")
            fail(f"no fence under {heading}")
    fail(f"missing heading: {heading}")


def write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content.strip() + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=ROOT / "store" / "metadata")
    args = parser.parse_args()

    play = (ROOT / "PLAYSTORE.md").read_text(encoding="utf-8")
    ios = (ROOT / "APPSTORE.md").read_text(encoding="utf-8")

    write(args.out / "play" / "en-US" / "title.txt", first_fence_after(play, "1. App Name"))
    write(
        args.out / "play" / "en-US" / "short_description.txt",
        first_fence_after(play, "2. Short Description"),
    )
    write(
        args.out / "play" / "en-US" / "full_description.txt",
        first_fence_after(play, "3. Full Description"),
    )

    write(args.out / "ios" / "en-US" / "name.txt", first_fence_after(ios, "App Name"))
    write(args.out / "ios" / "en-US" / "subtitle.txt", first_fence_after(ios, "Subtitle (30 chars max)"))
    write(
        args.out / "ios" / "en-US" / "promotional_text.txt",
        first_fence_after(ios, "Promotional Text (170 chars max)"),
    )
    write(args.out / "ios" / "en-US" / "keywords.txt", first_fence_after(ios, "Keywords (100 chars max)"))
    write(args.out / "ios" / "en-US" / "description.txt", first_fence_after(ios, "Description"))
    write(args.out / "ios" / "en-US" / "privacy_url.txt", first_fence_after(ios, "Privacy URL"))
    write(args.out / "ios" / "en-US" / "support_url.txt", first_fence_after(ios, "Support URL"))
    write(args.out / "ios" / "en-US" / "marketing_url.txt", first_fence_after(ios, "Marketing URL"))

    print(f"wrote listing text under {args.out}")


if __name__ == "__main__":
    main()
