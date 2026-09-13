# Store release automation (setup only)

Future-proof GitHub Actions plumbing for App Store + Play Store releases,
including listing copy, What’s New, screenshots, and the IAP / subscription /
tip / credit catalog (RevenueCat).

**Nothing goes live by default.** Live submit / production rollout / catalog sync
stay off until you flip repository variables and add secrets.

## Current vs planned

| Step | iOS today | Android today | This setup |
|------|-----------|---------------|------------|
| Tag → quality | `v*` → GitHub Release | `android-v*` → AAB draft | unchanged |
| Binary upload | Xcode Cloud → ASC | GHA → Play **draft** | kept |
| What’s New | manual paste | manual paste | prepared + wired (Play); ASC gated |
| Listing / screenshots | manual | manual | metadata layout + gated upload |
| Submit for review / production | manual | manual Roll out | **gated OFF** |
| IAP / subs / tips / credits | ASC + RevenueCat console | not shipped yet | versioned `store/catalog/` + validate CI |
| RevenueCat sync | manual | n/a | dry-run in CI; enabling `STORE_SYNC_REVENUECAT` fails until write path ships |

## Safe defaults (do not flip until ready)

Repository **Variables** (Settings → Secrets and variables → Actions → Variables):

| Variable | Default | When `true` |
|----------|---------|-------------|
| `STORE_UPLOAD_WHATS_NEW` | unset / false | Attach What’s New on Play upload (still draft) |
| `STORE_UPLOAD_LISTING` | unset / false | Upload title/short/full description |
| `STORE_UPLOAD_SCREENSHOTS` | unset / false | Upload phone screenshots from `store/metadata/` |
| `STORE_PRODUCTION_ROLLOUT` | unset / false | Play status `completed` instead of `draft` |
| `STORE_SUBMIT_IOS_REVIEW` | unset / false | Submit the latest ASC build for review |
| `STORE_SYNC_REVENUECAT` | unset / false | **Fails the workflow** — write/sync to RevenueCat is not implemented yet |

Until those are explicitly `true`, tag workflows keep today’s safe behavior
(Android draft only; iOS GitHub notes only; Xcode Cloud unchanged).

## Secrets still required for live paths

Already used:

- `ANDROID_KEYSTORE_*`, `PLAY_SERVICE_ACCOUNT_JSON`

Needed later for full automation (add when you turn gates on):

| Secret | Used for |
|--------|----------|
| `APP_STORE_CONNECT_API_KEY_ID` | ASC metadata / submit |
| `APP_STORE_CONNECT_ISSUER_ID` | ASC metadata / submit |
| `APP_STORE_CONNECT_API_KEY_P8` | ASC private key (`.p8` body) |
| `REVENUECAT_SECRET_API_KEY` | Catalog sync / product verification |

## Canonical catalog

- [`catalog/products.json`](catalog/products.json) — App Store + Play product IDs (subs, credits, tips)
- [`catalog/revenuecat.json`](catalog/revenuecat.json) — entitlements + offerings

Source of truth for product IDs stays aligned with [`docs/HOSTED_AI_REVENUECAT.md`](../docs/HOSTED_AI_REVENUECAT.md).

## Metadata layout

```
store/metadata/
  play/en-US/          # title, short/full description, whatsnew (generated)
  ios/en-US/           # description, keywords, promotional_text, whats_new
  screenshots/
    play/phone/        # symlink or copy targets for Play phoneScreenshots
    ios/6.7/           # ASC 6.7" slot (fill when automating screenshots)
```

Marketing PNGs today live in `web/assets/screenshots/`. Copy/resize into
`store/metadata/screenshots/` before enabling `STORE_UPLOAD_SCREENSHOTS`.

## How to enable later (when you want it)

1. Fill `store/metadata/` + keep `APPSTORE.md` / `PLAYSTORE.md` / `RELEASE_NOTES.md` in sync.
2. Add ASC + RevenueCat secrets.
3. Flip only the variables you want (start with `STORE_UPLOAD_WHATS_NEW`).
4. Tag as usual (`vX.Y` / `android-vX.Y`). Do **not** set `STORE_PRODUCTION_ROLLOUT` or
   `STORE_SUBMIT_IOS_REVIEW` until you are ready for a real store submission.

## Dry-run

```bash
python3 scripts/store/validate_catalog.py
python3 scripts/store/prepare_whats_new.py --platform all --tag android-v6.1 --out /tmp/whatsnew
python3 scripts/store/prepare_listing_text.py --platform all --out /tmp/listing
STORE_SYNC_REVENUECAT=false python3 scripts/store/sync_revenuecat_catalog.py
```

With `STORE_SYNC_REVENUECAT=true`, `sync_revenuecat_catalog.py` exits with an error (no API write path yet).

Or run the **Store automation (dry-run)** workflow from the Actions tab
(`workflow_dispatch`). It never uploads to the stores.
