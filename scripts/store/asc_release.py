#!/usr/bin/env python3
"""App Store Connect metadata, screenshots, and submit-for-review (gated in CI)."""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
ASC_BASE = "https://api.appstoreconnect.apple.com/v1"
DEFAULT_BUNDLE_ID = "com.apoorvdarshan.calorietracker"
IPHONE_67_DISPLAY = "APP_IPHONE_67"
EDITABLE_VERSION_STATES = {
    "PREPARE_FOR_SUBMISSION",
    "DEVELOPER_REJECTED",
    "REJECTED",
    "METADATA_REJECTED",
    "INVALID_BINARY",
}
SUBMITTABLE_VERSION_STATES = EDITABLE_VERSION_STATES


def fail(msg: str) -> None:
    print(f"error: {msg}", file=sys.stderr)
    raise SystemExit(1)


def truthy(name: str) -> bool:
    return os.environ.get(name, "").strip().lower() in {"1", "true", "yes", "on"}


def read_text(path: Path) -> str | None:
    if not path.is_file():
        return None
    text = path.read_text(encoding="utf-8").strip()
    return text or None


class AscClient:
    def __init__(self, token: str) -> None:
        self._token = token

    def request(
        self,
        method: str,
        path: str,
        *,
        body: dict[str, Any] | None = None,
        raw_body: bytes | None = None,
        content_type: str = "application/json",
        accept: str = "application/json",
    ) -> dict[str, Any] | None:
        url = path if path.startswith("http") else f"{ASC_BASE}{path}"
        headers = {
            "Authorization": f"Bearer {self._token}",
            "Accept": accept,
        }
        data: bytes | None = None
        if body is not None:
            data = json.dumps(body).encode("utf-8")
            headers["Content-Type"] = content_type
        elif raw_body is not None:
            data = raw_body
            headers["Content-Type"] = content_type

        req = urllib.request.Request(url, data=data, method=method, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                payload = resp.read()
                if not payload:
                    return None
                if accept != "application/json":
                    return {"raw": payload}
                return json.loads(payload.decode("utf-8"))
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            fail(f"ASC {method} {path} → HTTP {exc.code}: {detail[:2000]}")

    def get(self, path: str) -> dict[str, Any]:
        result = self.request("GET", path)
        assert result is not None
        return result

    def patch(self, path: str, body: dict[str, Any]) -> dict[str, Any]:
        result = self.request("PATCH", path, body=body)
        assert result is not None
        return result

    def post(self, path: str, body: dict[str, Any]) -> dict[str, Any]:
        result = self.request("POST", path, body=body)
        assert result is not None
        return result

    def upload_bytes(
        self, url: str, data: bytes, headers: dict[str, str], *, method: str = "PUT"
    ) -> None:
        req = urllib.request.Request(
            url, data=data, method=method.upper(), headers=headers
        )
        try:
            with urllib.request.urlopen(req, timeout=300):
                return
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            fail(f"ASC asset upload → HTTP {exc.code}: {detail[:1000]}")


def make_asc_token(key_id: str, issuer_id: str, private_key: str) -> str:
    import jwt

    now = int(time.time())
    payload = {
        "iss": issuer_id,
        "iat": now,
        "exp": now + 1200,
        "aud": "appstoreconnect-v1",
    }
    headers = {"kid": key_id, "typ": "JWT"}
    return jwt.encode(payload, private_key, algorithm="ES256", headers=headers)


def load_credentials() -> tuple[str, str, str]:
    key_id = os.environ.get("APP_STORE_CONNECT_API_KEY_ID", "").strip()
    issuer_id = os.environ.get("APP_STORE_CONNECT_ISSUER_ID", "").strip()
    key_p8 = os.environ.get("APP_STORE_CONNECT_API_KEY_P8", "").strip()
    if not key_id or not issuer_id or not key_p8:
        fail(
            "missing ASC credentials — set APP_STORE_CONNECT_API_KEY_ID, "
            "APP_STORE_CONNECT_ISSUER_ID, APP_STORE_CONNECT_API_KEY_P8"
        )
    key_p8 = key_p8.replace("\\n", "\n")
    return key_id, issuer_id, key_p8


def find_app(client: AscClient, bundle_id: str) -> str:
    query = urllib.parse.urlencode({"filter[bundleId]": bundle_id})
    payload = client.get(f"/apps?{query}")
    data = payload.get("data") or []
    if not data:
        fail(f"no App Store Connect app for bundle id {bundle_id}")
    return data[0]["id"]


def get_ios_app_store_version(
    client: AscClient, app_id: str, version_string: str
) -> dict[str, Any]:
    query = urllib.parse.urlencode(
        {
            "filter[app]": app_id,
            "filter[platform]": "IOS",
            "filter[versionString]": version_string,
            "limit": "5",
        }
    )
    payload = client.get(f"/appStoreVersions?{query}")
    data = payload.get("data") or []
    if not data:
        fail(
            f"no IOS App Store version {version_string!r} for app {app_id} "
            "(create the version in App Store Connect first)"
        )
    if len(data) > 1:
        fail(
            f"ambiguous App Store versions for {version_string!r} on IOS — "
            f"got {len(data)} records"
        )
    return data[0]


def localization_for_locale(
    client: AscClient, collection_path: str, locale: str
) -> dict[str, Any]:
    query = urllib.parse.urlencode({"filter[locale]": locale, "limit": "1"})
    payload = client.get(f"{collection_path}?{query}")
    data = payload.get("data") or []
    if not data:
        fail(f"no localization {locale} at {collection_path}")
    return data[0]


def get_app_info_localization(client: AscClient, app_id: str, locale: str) -> dict[str, Any]:
    infos = client.get(f"/apps/{app_id}/appInfos")
    info_rows = infos.get("data") or []
    if not info_rows:
        fail("app has no appInfos")
    info_id = info_rows[0]["id"]
    return localization_for_locale(
        client, f"/appInfos/{info_id}/appInfoLocalizations", locale
    )


def upload_listing(
    client: AscClient,
    *,
    app_id: str,
    version_id: str,
    locale: str,
    metadata_dir: Path,
) -> None:
    loc_dir = metadata_dir / "ios" / locale

    info_loc = get_app_info_localization(client, app_id, locale)
    info_attrs: dict[str, str] = {}
    name = read_text(loc_dir / "name.txt")
    subtitle = read_text(loc_dir / "subtitle.txt")
    if name:
        info_attrs["name"] = name
    if subtitle:
        info_attrs["subtitle"] = subtitle
    privacy = read_text(loc_dir / "privacy_url.txt")
    if privacy:
        info_attrs["privacyPolicyUrl"] = privacy
    if info_attrs:
        client.patch(
            f"/appInfoLocalizations/{info_loc['id']}",
            {
                "data": {
                    "type": "appInfoLocalizations",
                    "id": info_loc["id"],
                    "attributes": info_attrs,
                }
            },
        )
        print(f"  updated app info localization ({locale}): {', '.join(info_attrs)}")

    version_loc = localization_for_locale(
        client, f"/appStoreVersions/{version_id}/appStoreVersionLocalizations", locale
    )
    version_attrs: dict[str, str] = {}
    for field, filename in (
        ("description", "description.txt"),
        ("keywords", "keywords.txt"),
        ("promotionalText", "promotional_text.txt"),
        ("whatsNew", "whats_new.txt"),
        ("marketingUrl", "marketing_url.txt"),
        ("supportUrl", "support_url.txt"),
    ):
        value = read_text(loc_dir / filename)
        if value:
            version_attrs[field] = value
    if version_attrs:
        client.patch(
            f"/appStoreVersionLocalizations/{version_loc['id']}",
            {
                "data": {
                    "type": "appStoreVersionLocalizations",
                    "id": version_loc["id"],
                    "attributes": version_attrs,
                }
            },
        )
        print(f"  updated version localization ({locale}): {', '.join(version_attrs)}")


def screenshot_sets_for_localization(
    client: AscClient, version_loc_id: str
) -> list[dict[str, Any]]:
    payload = client.get(
        f"/appStoreVersionLocalizations/{version_loc_id}/appScreenshotSets"
    )
    return payload.get("data") or []


def ensure_screenshot_set(
    client: AscClient, version_loc_id: str, display_type: str
) -> dict[str, Any]:
    for item in screenshot_sets_for_localization(client, version_loc_id):
        if (item.get("attributes") or {}).get("screenshotDisplayType") == display_type:
            return item
    created = client.post(
        "/appScreenshotSets",
        {
            "data": {
                "type": "appScreenshotSets",
                "attributes": {"screenshotDisplayType": display_type},
                "relationships": {
                    "appStoreVersionLocalization": {
                        "data": {
                            "type": "appStoreVersionLocalizations",
                            "id": version_loc_id,
                        }
                    }
                },
            }
        },
    )
    return created["data"]


def list_screenshot_ids(client: AscClient, screenshot_set_id: str) -> list[str]:
    payload = client.get(f"/appScreenshotSets/{screenshot_set_id}/appScreenshots")
    return [shot["id"] for shot in payload.get("data") or []]


def delete_screenshots(client: AscClient, screenshot_ids: list[str]) -> None:
    for shot_id in screenshot_ids:
        client.request("DELETE", f"/appScreenshots/{shot_id}")


def upload_screenshot_file(
    client: AscClient, screenshot_set_id: str, image_path: Path
) -> None:
    raw = image_path.read_bytes()
    reserved = client.post(
        "/appScreenshots",
        {
            "data": {
                "type": "appScreenshots",
                "attributes": {
                    "fileName": image_path.name,
                    "fileSize": len(raw),
                },
                "relationships": {
                    "appScreenshotSet": {
                        "data": {"type": "appScreenshotSets", "id": screenshot_set_id}
                    }
                },
            }
        },
    )
    shot = reserved["data"]
    shot_id = shot["id"]
    upload_ops = (shot.get("attributes") or {}).get("uploadOperations") or []
    if not upload_ops:
        fail(f"ASC returned no uploadOperations for {image_path.name}")
    for op in upload_ops:
        offset = int(op.get("offset", 0))
        length = int(op["length"])
        chunk = raw[offset : offset + length]
        headers = {h["name"]: h["value"] for h in op.get("requestHeaders") or []}
        method = (op.get("method") or "PUT").upper()
        client.upload_bytes(op["url"], chunk, headers, method=method)
    client.patch(
        f"/appScreenshots/{shot_id}",
        {
            "data": {
                "type": "appScreenshots",
                "id": shot_id,
                "attributes": {"uploaded": True},
            }
        },
    )
    print(f"  uploaded screenshot {image_path.name}")


def upload_screenshots(
    client: AscClient,
    *,
    version_id: str,
    locale: str,
    screenshots_dir: Path,
) -> None:
    version_loc = localization_for_locale(
        client, f"/appStoreVersions/{version_id}/appStoreVersionLocalizations", locale
    )
    version_loc_id = version_loc["id"]
    pngs = sorted(screenshots_dir.glob("*.png"))
    if not pngs:
        fail(f"no PNG screenshots in {screenshots_dir}")

    shot_set = ensure_screenshot_set(client, version_loc_id, IPHONE_67_DISPLAY)
    old_ids = list_screenshot_ids(client, shot_set["id"])
    for path in pngs:
        upload_screenshot_file(client, shot_set["id"], path)
    if old_ids:
        delete_screenshots(client, old_ids)
        print(f"  removed {len(old_ids)} previous ASC screenshot(s)")


def submit_for_review(client: AscClient, app_id: str, version_id: str) -> None:
    submission = client.post(
        "/reviewSubmissions",
        {
            "data": {
                "type": "reviewSubmissions",
                "relationships": {
                    "app": {"data": {"type": "apps", "id": app_id}}
                },
            }
        },
    )
    submission_id = submission["data"]["id"]
    client.post(
        "/reviewSubmissionItems",
        {
            "data": {
                "type": "reviewSubmissionItems",
                "relationships": {
                    "reviewSubmission": {
                        "data": {"type": "reviewSubmissions", "id": submission_id}
                    },
                    "appStoreVersion": {
                        "data": {"type": "appStoreVersions", "id": version_id}
                    },
                },
            }
        },
    )
    client.request("POST", f"/reviewSubmissions/{submission_id}/submit")
    print(f"  submitted App Store version {version_id} for review")


def validate_local_inputs(
    *,
    upload_listing: bool,
    upload_screenshots: bool,
    metadata_dir: Path,
    screenshots_dir: Path,
    locale: str,
) -> None:
    if upload_listing:
        loc_dir = metadata_dir / "ios" / locale
        if not loc_dir.is_dir():
            fail(f"metadata dir missing: {loc_dir}")
    if upload_screenshots:
        if not screenshots_dir.is_dir():
            fail(f"screenshots dir missing: {screenshots_dir}")
        if not any(screenshots_dir.glob("*.png")):
            fail(f"no PNG files in {screenshots_dir}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--metadata-dir",
        type=Path,
        default=ROOT / "store" / "metadata",
        help="Prepared listing + what's new tree",
    )
    parser.add_argument(
        "--screenshots-dir",
        type=Path,
        default=ROOT / "store" / "metadata" / "screenshots" / "ios" / "6.7",
    )
    parser.add_argument("--locale", default="en-US")
    parser.add_argument("--bundle-id", default=DEFAULT_BUNDLE_ID)
    parser.add_argument(
        "--version",
        help="Marketing version from release tag (e.g. 1.2.3 when tag is v1.2.3)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate flags and local files only — no ASC HTTP calls",
    )
    args = parser.parse_args()

    do_listing = truthy("UPLOAD_LISTING")
    do_screenshots = truthy("UPLOAD_SCREENSHOTS")
    do_submit = truthy("SUBMIT_IOS_REVIEW")

    if not (do_listing or do_screenshots or do_submit):
        print(
            "ASC release skipped — UPLOAD_LISTING / UPLOAD_SCREENSHOTS / "
            "SUBMIT_IOS_REVIEW are off"
        )
        return

    validate_local_inputs(
        upload_listing=do_listing,
        upload_screenshots=do_screenshots,
        metadata_dir=args.metadata_dir,
        screenshots_dir=args.screenshots_dir,
        locale=args.locale,
    )

    if args.dry_run:
        print("ASC dry-run — local inputs OK; no API calls")
        print(
            f"  bundle={args.bundle_id} listing={do_listing} "
            f"screenshots={do_screenshots} submit={do_submit}"
        )
        return

    key_id, issuer_id, key_p8 = load_credentials()
    token = make_asc_token(key_id, issuer_id, key_p8)
    client = AscClient(token)

    if not args.version:
        fail("--version is required for live ASC calls (pass marketing version from tag)")

    app_id = find_app(client, args.bundle_id)
    version = get_ios_app_store_version(client, app_id, args.version)
    version_id = version["id"]
    state = (version.get("attributes") or {}).get("appStoreState") or ""
    print(
        f"ASC app={app_id} version={args.version} id={version_id} state={state}"
    )

    if state == "WAITING_FOR_REVIEW":
        if do_submit and not (do_listing or do_screenshots):
            print(
                "ASC submit skipped — version already WAITING_FOR_REVIEW (idempotent)"
            )
            print("ASC release step finished")
            return
        if do_listing or do_screenshots:
            fail(
                f"cannot update listing/screenshots while version {args.version!r} "
                "is WAITING_FOR_REVIEW"
            )
        do_submit = False

    if do_listing or do_screenshots:
        if state not in EDITABLE_VERSION_STATES:
            fail(
                f"version {args.version!r} is not editable for metadata (state={state}); "
                f"expected one of: {', '.join(sorted(EDITABLE_VERSION_STATES))}"
            )

    if do_submit and state not in SUBMITTABLE_VERSION_STATES:
        fail(
            f"version {args.version!r} cannot be submitted for review (state={state})"
        )

    if do_listing:
        print("uploading ASC listing metadata…")
        upload_listing(
            client,
            app_id=app_id,
            version_id=version_id,
            locale=args.locale,
            metadata_dir=args.metadata_dir,
        )

    if do_screenshots:
        print('uploading ASC 6.7" screenshots…')
        upload_screenshots(
            client,
            version_id=version_id,
            locale=args.locale,
            screenshots_dir=args.screenshots_dir,
        )

    if do_submit:
        print("submitting for App Store review…")
        submit_for_review(client, app_id, version_id)

    print("ASC release step finished")


if __name__ == "__main__":
    main()
