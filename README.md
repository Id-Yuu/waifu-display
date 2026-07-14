# ✦ Waifu Display

Display your favorite game characters on any webpage. A lightweight Chrome extension with a modern dark UI, zero CSS conflicts, and support for multiple character sources.

<p>
  <img src="https://img.shields.io/badge/manifest-v3-blue?style=flat-square" alt="Manifest V3">
  <img src="https://img.shields.io/badge/chrome-extension-4285F4?style=flat-square&logo=google-chrome&logoColor=white" alt="Chrome Extension">
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="MIT License">
</p>

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| **Zero Style Conflicts** | Shadow DOM (`mode: 'closed'`) — styles are fully scoped. No `!important` hacks needed. |
| **Entry Animation** | Elastic scale-up with `cubic-bezier(0.34, 1.56, 0.64, 1)` easing. |
| **Global Size Sync** | `chrome.storage.sync` is the single source of truth. All tabs auto-update. |
| **Modern Dark UI** | CSS grid layouts, custom toggle switches, smooth focus states, contextual instructions. |
| **Sidebar Character List** | Browse and search characters visually with avatars — no need to remember paths. |
| **Multi-Provider** | Supports SinoAlice, Wuthering Waves, and Arknights out of the box. |
| **Easy to Upscale** | Provider registry pattern — add a new game source in minutes. |

---

## 🎮 Supported Sources

| Source | Type | Sidebar | Notes |
|--------|------|---------|-------|
| **SinoAlice** | Wiki scraper | ❌ | Copy path from `sinoalice.game-db.tw/characters/...` |
| **Wuthering Waves** | Static list | ✅ | Pre-loaded roster from kurogames.com |
| **Arknights** | GitHub repo | ✅ | Fetched live from [PuppiizSunniiz/Arknight-Images](https://github.com/PuppiizSunniiz/Arknight-Images) |

---

## 📦 Installation

### From Source (Developer Mode)

1. Clone or download this repository
2. Open Chrome/edge → `chrome://extensions/`, `edge://extensions/`
3. Enable **Developer mode** (toggle actived)
4. Click **Load unpacked**
5. Select the extension folder


## 🏗️ File Structure
```
waifu-display/
├── manifest.json              # Extension manifest (V3, ES modules)
├── background.js              # Thin message router, imports providers
├── content.js                 # Shadow DOM character renderer
├── popup.html                 # Popup UI markup
├── popup.js                   # Popup controller + sidebar logic
├── utils.js                   # Shared utilities
└── providers/
    ├── sinoalice.js           # Wiki scraper provider
    ├── wutheringwaves.js      # Static list provider
    └── arknights.js           # API-fetched provider with cache fallback
```

## 🚀 Contributing / Add a Your Waifu
Adding a waifu to the provider registry pattern.
1. Create `providers/yourgame.js`
2. Import & register in `background.js`
3. Add UI metadata in `popup.js` <kbd>PROVIDER_CONFIG</kbd>
4. Add `<option>` in `popup.html`
5. Add host permission in `manifest.json`
