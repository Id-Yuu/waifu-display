## 🚀 Contributing / Add a Waifu

Adding a new waifu to your extention browser

### Step 1: Create a provider file

Create `providers/yourgame.js`:

```javascript
// providers/yourgame.js
export const yourgame = {
  name: 'Your Game Name',
  baseUrl: 'https://your-game-cdn.com/assets',

  // Optional: characterMap for name aliases
  characterMap: {
    'internal_name': 'canonical_name',
  },

  // Optional: display names for the sidebar
  displayNames: {
    'canonical_name': 'Pretty Display Name',
  },

  // Required for sidebar: static character list
  characterList: [
    {
      name: 'canonical_name',
      displayName: 'Pretty Display Name',
      imageUrl: 'https://your-game-cdn.com/assets/character.png',
      filename: 'character.png'
    },
    // ... add more
  ],

  // Required: fetch character data by path/name
  async fetchCharacterData(characterPath) {
    // Return { characterId, imageUrl, characterPath, provider, displayName }
  },

  // Required for sidebar: search/filter characters
  async searchCharacters(query) {
    // Return array of { name, displayName, imageUrl, filename }
  },

  extractCharacterId(html) {
    return null;
  }
};
```

### Step 2: Register the provider

In `background.js`, import and register:

```javascript
import { yourgame } from './providers/yourgame.js';

const PROVIDERS = {
  sinoalice,
  wutheringwaves,
  arknights,
  yourgame,  // ← add here
};
```

### Step 3: Add UI metadata

In `popup.js`, add to `PROVIDER_CONFIG`:

```javascript
yourgame: {
  name: 'Your Game',
  instructions: '<strong>How to use:</strong> Select a character from the sidebar.',
  placeholder: 'Enter character name or select from list',
  hasCharacterList: true  // set false if no sidebar list
}
```

### Step 4: Add to the dropdown

In `popup.html`, add an `<option>`:

```html
<select class="form-select" id="provider">
  <option value="sinoalice">SinoAlice Wiki</option>
  <option value="wutheringwaves">Wuthering Waves</option>
  <option value="arknights">Arknights</option>
  <option value="yourgame">Your Game</option>  <!-- add here -->
</select>
```

### Step 5: Add host permission

In `manifest.json`, add the CDN domain:

```json
"host_permissions": [
  "https://sinoalice.game-db.tw/*",
  "https://wutheringwaves.kurogames.com/*",
  "https://raw.githubusercontent.com/*",
  "https://api.github.com/*",
  "https://your-game-cdn.com/*"  // ← add here
]
```

That's it — the rest of the architecture handles it automatically.

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Character not loading | Check the browser console (F12) for error messages. Verify the image URL is accessible. |
| Arknights list empty | GitHub API may be rate-limited. The extension falls back to cached data automatically. Try again later. |
| Images blocked by CORS | The extension uses direct URLs for Wuthering Waves and Arknights. For SinoAlice, images are fetched via the background service worker. |
| Extension not appearing | Ensure the extension is enabled at `chrome://extensions/` or `edge://extensions/`. Try reloading the extension. |
| Sidebar shows "No characters found" | Check that `hasCharacterList: true` is set in `popup.js` `PROVIDER_CONFIG`. Verify `searchCharacters()` returns data. |
| Images load in sidebar but not on page | Add your CDN domain to the direct-URL check in `background.js` and `content.js`. Check for CORS errors in the webpage console. |
| "Unknown provider" error | Ensure the provider ID matches in `background.js` (PROVIDERS key), `popup.js` (PROVIDER_CONFIG key), and `popup.html` (`<option value>`). |
| Changes not appearing after edit | Go to `chrome://extensions/` → click 🔄 reload. For content script changes, reload the target webpage (F5). |
