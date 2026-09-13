#!/usr/bin/env python3
"""Validate store/catalog JSON against basic IAP / RevenueCat invariants."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PRODUCTS = ROOT / "store" / "catalog" / "products.json"
REVENUECAT = ROOT / "store" / "catalog" / "revenuecat.json"

CREDIT_PACKAGE_IDS = ("credits_50", "credits_150", "credits_400")
PLUS_PACKAGE_IDS = ("$rc_monthly", "$rc_annual")
PRO_PACKAGE_IDS = ("pro_monthly", "pro_yearly")


def fail(msg: str) -> None:
    print(f"error: {msg}", file=sys.stderr)
    raise SystemExit(1)


def package_ids(offering: dict) -> set[str]:
    ids: set[str] = set()
    for package in offering.get("packages", []):
        ident = package.get("identifier")
        if not ident or not isinstance(ident, str):
            fail(f"offering {offering.get('identifier')!r} has invalid package: {package!r}")
        ids.add(ident)
    return ids


def require_packages(offering: dict, required: tuple[str, ...]) -> None:
    oid = offering.get("identifier", "?")
    have = package_ids(offering)
    missing = [pid for pid in required if pid not in have]
    if missing:
        fail(f"offering {oid!r} missing package identifiers: {', '.join(missing)}")


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

    offerings = revenuecat.get("offerings", [])
    if not offerings:
        fail("revenuecat.offerings must be non-empty")

    by_id = {o.get("identifier"): o for o in offerings}
    for required in ("plus", "pro"):
        if required not in by_id:
            fail(f"missing offering identifier {required!r}")
        packages = by_id[required].get("packages", [])
        if not packages:
            fail(f"offering {required!r} must include at least one package")

    for offering in offerings:
        oid = offering.get("identifier")
        if not oid:
            fail("offering missing identifier")
        for package in offering.get("packages", []):
            pid = package.get("product_id")
            if pid not in id_set:
                fail(f"offering {oid} references unknown product {pid}")

    require_packages(by_id["plus"], PLUS_PACKAGE_IDS + CREDIT_PACKAGE_IDS)
    require_packages(by_id["pro"], PRO_PACKAGE_IDS + CREDIT_PACKAGE_IDS)

    # Pro must include Plus for upgrade behavior documented in HOSTED_AI_REVENUECAT.md
    pro = next(e for e in revenuecat["entitlements"] if e["id"] == "pro")
    if "plus" not in pro.get("includes_entitlements", []):
        fail("pro entitlement must include plus")

    print(
        f"ok: {len(ids)} products, {len(revenuecat['entitlements'])} entitlements, "
        f"{len(revenuecat['offerings'])} offerings"
    )


if __name__ == "__main__":
    main()
