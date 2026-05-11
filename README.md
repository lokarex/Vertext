# Vertext

<p align="center">
  <b>Git-backed Markdown Notebook</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-AGPL--3.0-blue" alt="License">
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux%20%7C%20Android-lightgrey" alt="Platform">
  <img src="https://img.shields.io/badge/version-0.1.0-informational" alt="Version">
</p>

A application that treats each personal workspace as a **Git repository**, giving you a full-featured WYSIWYG Markdown editor with automatic version history and seamless multi-device synchronization.

---

## Features

### Repository Management
- **Init** local Git repositories from scratch
- **Clone** existing remote repositories via HTTP/HTTPS
- Each repository is stored independently under the app data directory

### Markdown Editor
- Powered by [Milkdown](https://milkdown.dev/) (ProseMirror-based)
- **4 display modes**: WYSIWYG, Split (edit + preview), Edit, Preview
- Full formatting toolbar: bold, italic, strikethrough, inline code, headings (H1-H3), bullet/ordered lists, blockquote, links, horizontal rules
- Auto-save with configurable interval (1-120 seconds)
- Ctrl+S manual save with dirty/clean state indicators

### Code Viewer
- Syntax highlighting for **40+ languages** via Naive UI `NCode`
- Automatic language detection by file extension
- Read-only mode for non-Markdown files

### Smart Multi-Device Sync
- **Device-branch strategy**: each device gets its own branch (named after the hostname), eliminating merge conflicts
- Full sync workflow: commit local changes → fetch all remote branches → find latest commit → merge with theirs-strategy → push all branches
- Real-time progress events with step-by-step status

### Version History
- Scrollable commit timeline with shortened OIDs
- Branch and tag annotations on each commit
- One-click **restore** to any historical commit (creates a new restore commit, preserving the full history)

### Customization
- **Dark / Light** theme toggle via Naive UI
- Configurable **font size** (12-36)
- **i18n** support: English and Simplified Chinese (中文)

### Security
- Repository credentials (password) stored in the **OS-level keyring**

---

## How Sync Works — The Device-Branch Strategy

Vertext takes a unique approach to multi-device synchronization. Instead of having all devices fight over the same branch, each device works on its own branch (named after the hostname).

```
┌──────────┐       ┌──────────┐       ┌──────────┐
│ Device A │       │ Device B │       │ Device C │
│ (laptop) │       │ (desktop)│       │ (phone)  │
│          │       │          │       │          │
│ branch:  │       │ branch:  │       │ branch:  │
│ "laptop" │       │ "pc-des" │       │ "andrd-1"│
└────┬─────┘       └────┬─────┘       └────┬─────┘
     │                  │                  │
     └──────────────────┼──────────────────┘
                        │
                    ┌────▼────┐
                    │  Remote │
                    │  (Git)  │
                    └─────────┘
```

**Sync process on each device:**

1. **Commit** — auto-commit any uncommitted local changes
2. **Fetch** — pull all remote branches
3. **Find Latest** — scan every branch and remote tracking ref to find the most recent commit
4. **Merge** — fast-forward if possible; otherwise, create a merge commit using the theirs strategy (favors the remote latest)
5. **Push** — push all local branches back to the remote

This means each device always publishes its work and always picks up the latest work from others — without ever encountering a traditional merge conflict.

---

## Prerequisites

- **Node.js**
- **npm** (comes with Node.js)
- **Rust** toolchain — install via [rustup.rs](https://rustup.rs)
- **Tauri** platform-specific [dependencies](https://tauri.app/start/prerequisites/)
---

## Installation

### From Source

```bash
# Clone the repository
git clone https://github.com/your-username/vertext.git
cd vertext

# Install frontend dependencies
npm install

# Run in development mode (starts Vite dev server + opens Tauri window)
npm run tauri dev

# Build for production
npm run tauri build
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | [Tauri v2](https://v2.tauri.app/) |
| **Frontend** | [Vue 3](https://vuejs.org/) + [TypeScript](https://www.typescriptlang.org/) |
| **Bundler** | [Vite](https://vitejs.dev/) |
| **UI Components** | [Naive UI](https://www.naiveui.com/) |
| **Icons** | [Vicons](https://www.xicons.org/#/) (Fluent + Ionicons5) |
| **Markdown Editor** | [Milkdown](https://milkdown.dev/) (ProseMirror-based) |
| **State Management** | [Pinia](https://pinia.vuejs.org/) + [Tauri Store Plugin](https://tauri.app/plugin/store/) |
| **i18n** | [vue-i18n](https://vue-i18n.intlify.dev/) |
| **Backend (Rust)** | [git2](https://docs.rs/git2/latest/git2/) (libgit2 bindings) |
| **Credential Storage** | [keyring](https://docs.rs/keyring/latest/keyring/) (OS-native) |
| **Logging** | [fern](https://docs.rs/fern/latest/fern/) + [tauri-plugin-log](https://v2.tauri.app/plugin/logging/) |

---

## License

Vertext is licensed under the [GNU Affero General Public License v3.0](LICENSE). You are free to use, modify, and distribute this software under the terms of the AGPL-3.0 license.
