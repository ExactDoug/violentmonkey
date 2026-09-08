# Syncing this fork with upstream Violentmonkey

This repository is a fork of [violentmonkey/violentmonkey](https://github.com/violentmonkey/violentmonkey),
rebranded as **Exact Scripts**. Upstream owns the engine; we own the branding and nothing else.

## The rule that keeps syncs cheap

**Never edit an upstream-maintained file to apply branding.**

Branding is a build-time overlay (`scripts/brand.js` + `brand.config.js`) that rewrites the
*built* output in `dist/` and `dist-mv3/`. It touches no upstream source, so upstream's
constant churn in `_locales/**` can never conflict with us.

The complete fork delta against upstream is:

| File | Kind | Why |
|---|---|---|
| `brand.config.js` | new | Brand name and optional manifest overrides |
| `scripts/brand.js` | new | Post-build rename across all locales |
| `doc/SYNCING-UPSTREAM.md` | new | This file |
| `.gitattributes` | new | Forces LF; prevents the CRLF phantom-diff failure |
| `src/resources/icon{,-beta}.{png,svg}` | replaced | Exact logo |
| `src/resources/icon-small.png` | new | Square monogram for sizes < 128px (see below) |
| `gulpfile.js` | ~30 lines | Wires `rebrand` into `dev`/`build`/`watch`; small-icon source in `createIcons` |
| `.gitignore` | 2 lines | `.worktrees/`, `/dev-resources/` |

That is the whole fork. If this table grows, push back — a new entry is a new
conflict every sync, and branding almost never needs one.

`gulpfile.js` is the only upstream file we patch with real logic, so it is the
one place a sync can genuinely conflict. Both patches are small and localized:
a two-line `rebrand` wiring, and a `createIcons` that picks its source image
based on size. If upstream rewrites `createIcons`, take theirs and re-apply the
`brand.iconSmall` branch on top.

## Icons

`src/resources/icon.png` is the full Exact wordmark. It is legible at 128px and
nowhere near it below that, so `createIcons` renders every smaller size from
`src/resources/icon-small.png` — the red checkmark from the logo, extracted and
squared. Set `brand.iconSmall` to `null` to fall back to upstream's behaviour of
deriving all sizes from a single image.

Regenerating the monogram is a manual step; it was cut from the wordmark once and
committed. If the brand artwork changes, re-cut it as a square, transparent PNG
that fills ~96% of its canvas (looser framing thins the stroke to near-invisible
at 16px) and check the result at true size, including the grayscale `b` variants
— `browser_action` uses those, not the colour ones.

## Doing a sync

```sh
git fetch upstream --tags
git worktree add .worktrees/upstream-sync -b chore/sync-upstream-<ver> upstream/master
cd .worktrees/upstream-sync
```

Re-apply the delta above onto the fresh upstream tree (cherry-pick the branding commit from
the previous sync branch, or copy the files listed in the table), then:

```sh
corepack pnpm install
corepack pnpm build          # MV2  -> dist/       (Firefox)
corepack pnpm build:mv3      # MV3  -> dist-mv3/   (Chrome / Edge)
```

Verify the rebrand took (see "Verifying" below), then merge back to `master`.

## Toolchain

Upstream requires **Node >= 24** and **pnpm** (enforced by `preinstall: only-allow pnpm`).
`npm install` or `yarn install` will be rejected, and running one anyway corrupts
`pnpm-lock.yaml`.

```sh
nvm use 24
corepack enable
corepack pnpm install
```

## MV2 vs MV3 — which build goes where

Chrome and Edge have disabled Manifest V2. **Chromium browsers require the MV3 build.**

| Browser | Build | Output |
|---|---|---|
| Chrome, Edge | `pnpm build:mv3` | `dist-mv3/` |
| Firefox | `pnpm build` | `dist/` |

MV3 requires **Chrome/Edge 135+** (it depends on `chrome.userScripts.execute`).

### Required post-install step on Chrome/Edge

MV3 userscript managers cannot inject anything until the user grants a browser-level
permission. After loading the extension:

1. Open `edge://extensions` (or `chrome://extensions`)
2. Find **Exact Scripts** → **Details**
3. Turn **Allow User Scripts** **on**
4. Confirm **Site access** is *On all sites*
5. Reload any affected tab

Without this, scripts are listed in the dashboard but never run. This is a Chromium
platform requirement, not a bug — every MV3 userscript manager (Tampermonkey included)
needs it.

## Verifying a build

```sh
# Name was rebranded in the built locales, in every language
grep -h '"extName"' -A2 dist-mv3/_locales/*/messages.json | grep -c 'Exact Scripts'

# No upstream name leaked into user-visible strings
grep -rl 'Violentmonkey' dist-mv3/_locales/ || echo "clean"

# MV3 manifest shape
node -e "const m=require('./dist-mv3/manifest.json');
  console.log(m.manifest_version, m.minimum_chrome_version, !!m.background.service_worker)"
```

`scripts/brand.js` fails the build if upstream ever puts the capitalized product name
inside a URL, which a blind replace would turn into a dead link.

## What we deliberately do *not* rebrand

- `homepage_url` and `author` in the manifest still point at upstream. The code is
  upstream's and the MIT license requires the attribution be preserved; pointing the
  homepage at a nonexistent Exact URL would ship a dead link. Both are overridable in
  `brand.config.js` if that changes.
- The Firefox extension ID in `src/manifest.yml` is still upstream's. It must change
  before this is ever published to AMO, but it is harmless for internal sideloading.
