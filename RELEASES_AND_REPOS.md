# Astralyr Repository & Release Architecture

This document describes the two-tier repository architecture, the split between the open-source web edition and the commercial desktop edition, and the multi-platform automated release pipeline.

---

## 1. Repository Split Architecture

```
┌──────────────────────────────────────────────┐
│  PUBLIC REPOSITORY: Shridhar396/Astralyr     │
│  - License: MIT                              │
│  - Core Visualizer & Constellation Engine    │
│  - Web Edition (PWA & Hosted)                │
│  - Builds independently with zero Pro code   │
└──────────────────────┬───────────────────────┘
                       │ Fork / Upstream
                       ▼
┌──────────────────────────────────────────────┐
│  PRIVATE REPOSITORY: Shridhar396/astralyr-pro│
│  - Proprietary Pro modules (`src/pro/`)      │
│  - Electron desktop shell (`electron/`)      │
│  - Native licensing & audio integrations     │
│  - GitHub Actions builds multi-platform      │
└──────────────────────┬───────────────────────┘
                       │ Publishes releases to
                       ▼
┌──────────────────────────────────────────────┐
│  PUBLIC RELEASES: Shridhar396/astralyr-releases
│  - Multi-platform installers:                │
│    • Windows: Astralyr-Setup-*.exe           │
│    • macOS: Astralyr-*.dmg                   │
│    • Linux: Astralyr-*.AppImage              │
│  - SHA-256 checksums (`checksums.txt`)       │
│  - Auto-updater manifest (`latest.yml`)      │
└──────────────────────────────────────────────┘
```

### A. Public Repository (`Astralyr`)
- **Scope:** Free Web Edition and open-source visualizer core.
- **Build Target:** Web application with PWA capabilities.
- **Independence:** Compiles independently via `pnpm run build` without any private submodules or tokens. The build-time flag `__ASTRALYR_PRO__ = false` replaces `@pro-engine` with `src/pro/stubs.ts`, completely tree-shaking proprietary Pro code out of distribution bundles.

### B. Private Repository (`astralyr-pro` / Desktop Shell)
- **Scope:** Electron main process, `src/pro/proModules.ts`, desktop persistent library manager, licensing engine, and native OS integrations.
- **Build Target:** Standalone desktop installers (.exe, .dmg, .AppImage).

---

## 2. GitHub Actions Release Workflow

The release workflow is defined in `.github/workflows/release-desktop.yml`.

### Workflow Pipeline
1. **Trigger:** Triggered on Git tags starting with `v*` (e.g. `v1.1.0`) or manual workflow dispatch.
2. **Matrix Builds:** Runs parallel builds on:
   - `windows-latest` -> generates `.exe` (NSIS installer)
   - `macos-latest` -> generates `.dmg` (Universal or x64/arm64)
   - `ubuntu-latest` -> generates `.AppImage`
3. **Checksum Generation:** Automatically computes SHA-256 checksums for all installer artifacts and outputs a unified `checksums.txt`.
4. **Publishing to Public Releases Repo:**
   - Uses a GitHub Personal Access Token (PAT) with repository write permissions to publish the assets directly to `Shridhar396/astralyr-releases`.
   - Generates release notes and attaches `latest.yml` / `latest-mac.yml` / `latest-linux.yml` for Electron's auto-updater.

---

## 3. Auto-Updater Configuration

In `electron-builder.json`, the publish target is configured as:
```json
"publish": {
  "provider": "github",
  "owner": "Shridhar396",
  "repo": "astralyr-releases"
}
```

When users launch Astralyr Desktop, `electron-updater` queries `https://github.com/Shridhar396/astralyr-releases/releases/latest` to check for new versions, verify SHA-512 blockmaps, and download updates smoothly in the background.
