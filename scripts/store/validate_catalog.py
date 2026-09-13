#!/usr/bin/env python3
"""Validate store/catalog JSON against basic IAP / RevenueCat invariants."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PRODUCTS = ROOT / "store" / "catalog" / "products.json"
REVENUECAT = ROOT / "store" / "catalog" / "revenuecat.json"


def fail(msg: str) -> None:
    print(f"error: {msg}", file=sys.stderr)
    raise SystemExit(1)


def main() -> None:
    products = json.loads(PRODUCTS.read_text())
    revenuecat = json.loads(REVENUECAT.read_text())

    ids: list[str] = []
    for group in ("subscriptions", "consumables", "tips"):
        if group not in products:
            fail(f"missing products.{group}")
        for item in products[group]:
            pid = item.get("id")
            if not pid or not isinstance(pid, str):
                fail(f"invalid id in {group}: {item!r}")
            if not pid.startswith("com.apoorvdarshan.calorietracker."):
                fail(f"unexpected product id prefix: {pid}")
            ids.append(pid)

    if len(ids) != len(set(ids)):
        fail("duplicate product ids in products.json")

    id_set = set(ids)
    for ent in revenuecat.get("entitlements", []):
        eid = ent.get("id")
        if eid not in {"plus", "pro"}:
            fail(f"unexpected entitlement id: {eid}")
        for pid in ent.get("products", []):
            if pid not in id_set:
                fail(f"entitlement {eid} references unknown product {pid}")

    for offering in revenuecat.get("offerings", []):
        oid = offering.get("identifier")
        if not oid:
            fail("offering missing identifier")
        for package in offering.get("packages", []):
            pid = package.get("product_id")
            if pid not in id_set:
                fail(f"offering {oid} references unknown product {pid}")

    # Pro must include Plus for upgrade behavior documented in HOSTED_AI_REVENUECAT.md
    pro = next(e for e in revenuecat["entitlements"] if e["id"] == "pro")
    if "plus" not in pro.get("includes_entitlements", []):
        fail("pro entitlement must include plus")

    print(f"ok: {len(ids)} products, {len(revenuecat['entitlements'])} entitlements, "
          f"{len(revenuecat['offerings'])} offerings")


if __name__ == "__main__":
    main()
