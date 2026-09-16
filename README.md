# Spine Previewer

**English** | [繁體中文](README.zh-TW.md)

[![PixiJS](https://img.shields.io/badge/PixiJS-8.18.1-e72264)](https://pixijs.com)
[![spine-pixi-v8](https://img.shields.io/badge/spine--pixi--v8-4.3.11-7c4dff)](https://esotericsoftware.com/spine-runtimes)
[![Tauri](https://img.shields.io/badge/Tauri-v2-24c8db)](https://v2.tauri.app)
[![Platforms](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20browser-555)](#packaging)
[![License](https://img.shields.io/badge/license-UNLICENSED-lightgrey)](#license)
[![Release](https://img.shields.io/github/v/release/Yuhuan183/pixi-spine-previewer?display_name=tag)](https://github.com/Yuhuan183/pixi-spine-previewer/releases/latest)

**Download:** [latest release](https://github.com/Yuhuan183/pixi-spine-previewer/releases/latest) — `.dmg` for macOS (Apple Silicon), `-setup.exe` for Windows (x64). Neither is code-signed yet; see [Notes](#notes) for the first-launch steps.

A desktop previewer for Spine 4.3 skeletons that renders with the **exact runtime the game ships**: PixiJS 8 + `@esotericsoftware/spine-pixi-v8`. Point it at a source directory; it pairs every skeleton with its atlas, lists them by folder, and lets you step through skins, animations and load-time parameters. It never writes back to the source files.

The shell is Tauri v2, so the installer is about 15 MB and uses the system webview instead of a bundled Chromium.

## Features

- **Directory scan and pairing.** Walks the tree, pairs `.skel`/`.json` with `.atlas` by name, groups by folder, filters by name or path.
- **Skins.** Stack several skins or show a single one.
- **Animations on three tracks.** Play on track 0–2, adjust default mix, speed, loop; scrub the timeline frame by frame.
- **Load-time parameters.** Skeleton scale, premultiplied alpha, texture filter, dark tint; changing any of them re-parses the asset.
- **Display helpers.** Background colour, checkerboard, grid, origin cross, bounds box, and the seven `SpineDebugRenderer` overlays.
- **Inspector.** Exporter version, hash, atlas pages, counts, bones, slots, events, and a live event log.
- **Version probe.** Reads the exporter version from the file header before parsing, so a 3.8 export produces a clear message instead of a parser stack trace.
- **Screenshot.** Transparent PNG of the current frame without grid or helpers.
- **Browser mode.** The same UI runs in a plain browser tab through the File System Access API.

## Requirements

| Tool | Version |
| --- | --- |
| Node.js | `>= 20.19` (`.nvmrc` says 22) |
| Rust toolchain | stable (`rust-version = 1.77.2`), only for the desktop shell |
| macOS | 13.0 or later to run the packaged app |
| Windows | WebView2 Runtime (preinstalled on Windows 10 1803+ / 11) |

## Getting started

```bash
npm install
rustup default stable                                  # first time only
export PATH="$(brew --prefix)/opt/rustup/bin:$PATH"    # Homebrew rustup: cargo lives here

npm run dev            # browser mode at http://localhost:5178
npm run dev:desktop    # Tauri window with Vite hot reload
```

### Skipping the directory picker in browser mode

Native directory pickers cannot be scripted, so the dev server accepts a query parameter that points straight at a real directory:

```
http://localhost:5178/?devfs=/absolute/path/to/spine
```

Files are served by the `/__dev-fs` endpoints of the Vite dev server. Both endpoints exist only in dev mode and never reach a production build.

### Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server, browser mode |
| `npm run dev:desktop` | `tauri dev` |
| `npm run build` | `typecheck` then `build:web` |
| `npm run typecheck` | `tsc` for both the app and the node-side configs |
| `npm run lint` | ESLint, zero warnings allowed |
| `npm run package:mac` | `.app` + `.dmg` |
| `npm run package:win` | NSIS installer, run on Windows |
| `npm run package:win:cross` | NSIS installer cross-compiled on macOS (see below) |
| `npm version patch\|minor` | Bumps the version in all four files and commits; pushing it triggers a release (see [Releasing](#releasing)) |

## Usage

| Action | How |
| --- | --- |
| Open a directory | Toolbar button, `⌘O`, or the command line: `Spine Previewer /path/to/assets` |
| Pick an asset | Left rail, grouped by folder; the search box filters by name or path |
| Skins | Tick to stack several; **單選** keeps only that one |
| Animations | Click to play on the current target track (T0–T2); tracks can overlap |
| Timeline | Drag to scrub; playback pauses while dragging |
| Display | Background / grid / origin / bounds box / debug overlays |
| Load parameters | Skeleton scale · premultiplied alpha · texture filter · dark tint; the asset reloads automatically |
| Screenshot | Transparent PNG without grid or helper lines |

Press `?` in the app for the keyboard shortcuts.

| Keys | Action |
| --- | --- |
| `⌘/Ctrl + O` | Open a directory |
| `⌘/Ctrl + R` | Rescan the directory |
| `Space` | Play / pause |
| `R` | Restart the current track |
| `L` | Toggle loop |
| `← / →` | Previous / next animation |
| `F` | Fit to content |
| `1` | Reset to 100% zoom |
| `G` | Toggle grid |
| `B` | Toggle bone overlay |
| `/` | Focus the filter box |
| Wheel / drag / double-click | Zoom / pan / fit |

### Supported files

- **Skeleton:** `.skel` or `.bin` (binary), `.json`. Wrapped names such as `Foo.skel.txt` or `Foo.atlas.bytes` are unwrapped.
- **Atlas:** `.atlas`
- **Textures:** `png`, `webp`, `jpg`, `jpeg`, `avif`

Files with the same base name in the same directory are paired. A `.json` only counts as a skeleton when an atlas of the same name exists, or the directory holds exactly one atlas and one JSON; otherwise ordinary config files would show up as broken skeletons. A `.skel` with no atlas is still listed and flagged, because a missing atlas is the kind of packaging slip this tool exists to surface.

Atlas page names are resolved in this order: exact relative path, same file name in the folder, same base name in the folder, same base name anywhere in the scan. An atlas that says `.png` while the disk has `.webp` still loads; the substitution is shown as a warning in the viewport.

The scan skips hidden entries, `node_modules`, `.git`, `.svn`, `.hg` and `__MACOSX`, does not follow symlinks, and stops at 20 000 files or a depth of 12.

### Version mismatch

The exporter version is read from the file header before parsing (4.x and 3.x headers have different layouts; both are handled). Data from a line other than 4.3 is flagged with a warning; if parsing then fails, the error says "data is Spine 3.8.99, this previewer bundles the 4.3 runtime" instead of surfacing an internal format error.

## Packaging

```bash
npm run package:mac        # .app + .dmg
npm run package:win        # on a Windows machine
npm run package:win:cross  # Windows installer built on macOS (prerequisites below)
```

Everything lands under `src-tauri/target/`. Without `--target` the path is `release/bundle/`; with a target triple there is one more level:

| Script | Output |
| --- | --- |
| `package:mac` | `release/bundle/macos/Spine Previewer.app` · `release/bundle/dmg/*.dmg` |
| `package:win` / `package:win:cross` | `x86_64-pc-windows-msvc/release/bundle/nsis/*-setup.exe` |

### Releasing

A version bump on `main` is the release trigger:

```bash
npm version patch          # or minor / major: bumps package.json, mirrors it into src-tauri/, commits, tags
git push --follow-tags
```

`release.yml` sees `package.json` change, builds the macOS bundle on `macos-latest` (Apple Silicon) and the NSIS installer on `windows-latest` (x64), signs the updater artifacts, and opens a **draft** GitHub Release `vX.Y.Z` with the `.dmg`, `-setup.exe`, their `.sig` files and `latest.json`. Publish the draft once you have checked it; the in-app updater only ever sees published releases. `workflow_dispatch` builds the current version on demand.

The workflow needs two repository secrets, both produced by `npx tauri signer generate -w ~/.tauri/spine-previewer.key`:

| Secret | Content |
| --- | --- |
| `TAURI_SIGNING_PRIVATE_KEY` | The private key file |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Its password |

The matching public key is committed in `tauri.conf.json` under `plugins.updater.pubkey`. **Keep an offline backup of the private key**: without it no future release can be signed, and installed apps will never accept an update. Updater artifacts are only enabled through `src-tauri/tauri.release.conf.json`, so local `package:*` runs do not need the key.

To reproduce the release build locally:

```bash
export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/spine-previewer.key)"          # the key's content, not its path
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="$(cat ~/.tauri/spine-previewer.key.password)"
npx tauri build --config "$PWD/src-tauri/tauri.release.conf.json" --bundles app,dmg
```

`--config` has to be an absolute path: the CLI resolves a relative one against its own working directory, which is not the repo root.

`ci.yml` runs `typecheck` · `lint` · `build:web` on every push to `main` and every pull request; it needs no secrets.

### Windows

CI is the canonical path: the NSIS installer comes out of `release.yml` on a real Windows runner.

Cross-compiling on macOS also works. Tauri does not support it officially, but as of 2026-09-16 it produces a correct PE32+ x64 executable and NSIS installer. One-time setup:

```bash
brew install llvm makensis
rustup target add x86_64-pc-windows-msvc
cargo install cargo-xwin
export PATH="$HOME/.cargo/bin:$(brew --prefix)/opt/rustup/bin:$(brew --prefix)/opt/llvm/bin:$PATH"
npm run package:win:cross   # first run downloads about 1 GB of MSVC CRT and Windows SDK headers
```

`$HOME/.cargo/bin` is required: `cargo install` puts its binaries there, while the Homebrew rustup shims live elsewhere, and without it Tauri reports `cargo-xwin` command not found.

**Open cross-compiled installers on a real Windows machine before shipping them.** There is no official guarantee for this path, and the macOS host cannot sign the binary, so users see a SmartScreen warning.

### Notes

- **Only the host architecture is built by default.** To cover Intel Macs as well: `rustup target add x86_64-apple-darwin`, then `npx tauri build --target universal-apple-darwin`.
- **No code signing.** Gatekeeper blocks the first launch on macOS; clear it with `xattr -dr com.apple.quarantine "/Applications/Spine Previewer.app"`. Windows shows the SmartScreen "Run anyway" prompt.

## Architecture

```
.
├── .github/workflows/        ci.yml (quality) · release.yml (version bump → draft release)
├── index.html                Vite entry
├── vite.config.ts            Vite config; injects __APP_VERSIONS__ from package.json
├── scripts/                  Node-side helpers used by the Vite dev server
│   ├── devFsPlugin.ts        /__dev-fs endpoints, `serve` only
│   ├── fsScan.ts             Directory walk, same rules as the Rust scanner
│   └── sync-version.mjs      npm `version` hook: mirrors package.json into src-tauri/
├── src/
│   ├── main.tsx              Boot: installs the dev host, then mounts <App />
│   ├── App.tsx               Layout, drawers, global shortcuts
│   ├── bridge/               Host abstraction; nothing above it knows which host is live
│   │   ├── types.ts          PreviewerBridge interface and scan limits
│   │   ├── tauriBridge.ts    Rust IPC (desktop)
│   │   ├── injectedHostBridge.ts  window.previewerHost (dev filesystem host)
│   │   └── browserBridge.ts  File System Access API, webkitdirectory fallback
│   ├── core/                 UI-independent
│   │   ├── scanner.ts        Pairs skeletons with atlases
│   │   ├── probe.ts          Reads the exporter version from the file header
│   │   ├── loadSpine.ts      Bytes → textures → SkeletonData → Spine
│   │   ├── stage.ts          PreviewStage: the one Pixi Application, camera, helpers
│   │   └── inspect.ts        Read-only projection of SkeletonData for the inspector
│   ├── store/                zustand
│   │   ├── useAppStore.ts    App state and actions; persists UI preferences
│   │   ├── useRuntimeStore.ts  20 Hz stage snapshot (fps, zoom, tracks, bounds)
│   │   └── stage.ts          PreviewStage singleton and asset mount / dispose
│   ├── components/           React UI: top bar, library, viewport, timeline, inspector tabs
│   ├── hooks/                Layout breakpoints, rail resize
│   ├── lib/                  Formatting helpers
│   └── dev/devHost.ts        Dev-only host behind ?devfs=
└── src-tauri/
    ├── src/lib.rs            Commands (authorize_root · scan_directory · read_file · recent_roots · initial_root) and the menu
    ├── tauri.conf.json       Window, CSP, bundle targets, updater public key and endpoint
    ├── tauri.release.conf.json  Merged in by release.yml only: enables signed updater artifacts
    ├── capabilities/         Permissions granted to the webview
    ├── app-icon.png          1024×1024 icon source
    └── icons/                Generated with `npx tauri icon src-tauri/app-icon.png`
```

Four boundaries worth remembering:

1. **React never touches Pixi objects.** Panels call methods on `PreviewStage`; the stage publishes a plain-data snapshot every 50 ms. Sixty frames a second of playback do not become sixty re-renders.
2. **Loading bypasses `Assets`.** The source files live outside any web root, and the official loader resolves atlas pages by URL. Bytes are read through the bridge and texture sources are built by hand, which also makes PMA and filtering live, overridable options.
3. **The Rust host only reads authorised directories.** `scan_directory` and `read_file` canonicalise the path first (so `..` segments and symlinks cannot escape) and check it against the directories picked in this session. Files come back over the binary IPC channel, not as JSON number arrays. Both commands are async so a 20 000-file walk never blocks the window's event loop.
4. **No `eval`.** The production CSP has no `unsafe-eval`, so Pixi runs the interpreted shader system from `pixi.js/unsafe-eval`. The import at the top of `src/core/stage.ts` must stay.

### A rendering difference you need to know about

On macOS, Tauri uses WKWebView, not Chromium. Measured on 2026-09-16, the two differ in exactly one place: `createImageBitmap(blob, { premultiplyAlpha: 'none' })` goes through a premultiply-then-unpremultiply round trip in WebKit. Low-alpha pixels pick up quantisation error (max RGB difference 35/255 at alpha 3) and pixels with alpha 0 have their RGB zeroed. Chromium is bit-exact.

This path is **only taken for atlases with a `pma: true` line**. Atlases packed without premultiplied alpha go through the browser's native premultiply, which is exact on both engines. Grep your atlas files for `pma: true` to know whether it applies to you.

If it does, judge soft-glow and low-alpha details on a Chromium engine (Android or a desktop browser) rather than trusting the macOS preview alone.

## Browser mode

`npm run dev` and `npm run preview` serve the same UI to a plain browser tab. Chromium-based browsers use the File System Access API, so rescanning works. Other browsers fall back to a `webkitdirectory` input, which is a one-shot snapshot without rescan. File sizes show as `—` until an asset is opened, because the handles are not read up front.

## Data on disk

- **Recent directories:** `recent-roots.json` in the app's config directory, last 8 entries.
- **UI preferences** (view, transform, load options, speed, loop, mix, rail widths): `localStorage` under the key `spine-previewer`.

## License

UNLICENSED. © 2026 Yuhuan, all rights reserved.
