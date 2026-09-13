#!/usr/bin/env python3
"""Dry-run RevenueCat catalog sync. Live push only if STORE_SYNC_REVENUECAT=true + secret."""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[2]
PRODUCTS = ROOT / "store" / "catalog" / "products.json"
REVENUECAT = ROOT / "store" / "catalog" / "revenuecat.json"


def enabled(name: str) -> bool:
    return os.environ.get(name, "").strip().lower() in {"1", "true", "yes", "on"}


def main() -> None:
    products = json.loads(PRODUCTS.read_text())
    revenuecat = json.loads(REVENUECAT.read_text())
    product_ids = [
        item["id"]
        for group in ("subscriptions", "consumables", "tips")
        for item in products[group]
    ]

    print(f"catalog: {len(product_ids)} products, "
          f"{len(revenuecat['entitlements'])} entitlements, "
          f"{len(revenuecat['offerings'])} offerings")

    if not enabled("STORE_SYNC_REVENUECAT"):
        print("dry-run only (STORE_SYNC_REVENUECAT is false) — no RevenueCat API calls")
        return

    token = os.environ.get("REVENUECAT_SECRET_API_KEY", "").strip()
    if not token:
        print("error: STORE_SYNC_REVENUECAT=true but REVENUECAT_SECRET_API_KEY is missing",
              file=sys.stderr)
        raise SystemExit(1)

    # Read-only probe: list apps. Creating/updating products stays manual until
    # ASC/Play products exist; this gate is reserved for a future write path.
    req = Request(
        "https://api.revenuecat.com/v2/projects",
        headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
        method="GET",
    )
    try:
        with urlopen(req, timeout=30) as resp:
            body = resp.read().decode("utf-8")
        print("RevenueCat API reachable; write/sync not implemented yet — catalog stays source of truth in git")
        print(f"projects response bytes: {len(body)}")
    except HTTPError as exc:
        print(f"error: RevenueCat HTTP {exc.code}: {exc.read()[:500]!r}", file=sys.stderr)
        raise SystemExit(1) from exc
    except URLError as exc:
        print(f"error: RevenueCat request failed: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc


if __name__ == "__main__":
    main()
