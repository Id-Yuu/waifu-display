// ============================================================
// ARKNIGHTS PROVIDER
// Fetches character list from PuppiizSunniiz GitHub repo
// Uses github.com/.../blob/...?raw=true for display URLs
// ============================================================

import { verifyImage } from '../utils.js';

export const arknights = {
  name: 'Arknights (PuppiizSunniiz)',
  apiUrl: 'https://api.github.com/repos/PuppiizSunniiz/Arknight-Images/contents/characters',
  // Display URL base using github.com blob with ?raw=true
  displayBase: 'https://github.com/PuppiizSunniiz/Arknight-Images/blob/main/characters',
  _cache: null,

  toDisplayName(filename) {
    const base = filename.replace(/\.[^.]+$/, '');
    return base
      .replace(/[_-]+/g, ' ')
      .trim()
      .split(' ')
      .filter(Boolean)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  },

  // Build display URL from filename — encodes # to %23 for valid URLs
  buildDisplayUrl(filename) {
    // Encode # as %23 so the URL is valid for img src
    const encoded = filename.replace(/#/g, '%23');
    return `${this.displayBase}/${encoded}?raw=true`;
  },

  async getCharacterList(forceRefresh = false) {
    const CACHE_TTL = 24 * 60 * 60 * 1000;
    const now = Date.now();

    if (!forceRefresh && this._cache && (now - this._cache.fetchedAt) < CACHE_TTL) {
      return this._cache.list;
    }

    let cached = null;
    try {
      const stored = await chrome.storage.local.get('arknightsCharacterCache');
      cached = stored.arknightsCharacterCache;
      if (!forceRefresh && cached && (now - cached.fetchedAt) < CACHE_TTL) {
        this._cache = cached;
        return cached.list;
      }
    } catch (e) {
      console.warn('[Arknights] Failed to read cache:', e);
    }

    const imageExts = /\.(png|jpg|jpeg|webp)$/i;
    let list = [];

    try {
      const res = await fetch(this.apiUrl, {
        headers: {
          'Accept': 'application/vnd.github+json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (!res.ok) {
        if (cached && cached.list && cached.list.length > 0) {
          console.warn('[Arknights] API error, using stale cache');
          this._cache = cached;
          return cached.list;
        }
        throw new Error(`Failed to list characters (HTTP ${res.status})`);
      }

      const items = await res.json();

      if (Array.isArray(items)) {
        for (const item of items) {
          if (item.type !== 'file' || !imageExts.test(item.name)) continue;
          list.push({
            name: item.name.replace(/\.[^.]+$/, '').toLowerCase(),
            displayName: this.toDisplayName(item.name),
            imageUrl: this.buildDisplayUrl(item.name),
            filename: item.name
          });
        }
      }

      list.sort((a, b) => a.displayName.localeCompare(b.displayName));

      this._cache = { list, fetchedAt: now };
      await chrome.storage.local.set({ arknightsCharacterCache: this._cache });

      return list;
    } catch (err) {
      if (cached && cached.list && cached.list.length > 0) {
        console.warn('[Arknights] Fetch failed, using stale cache:', err.message);
        this._cache = cached;
        return cached.list;
      }
      throw err;
    }
  },

  async searchCharacters(query) {
    const list = await this.getCharacterList();
    const term = query?.toLowerCase().trim() || '';
    if (!term) return list;
    return list.filter(c => `${c.name} ${c.displayName}`.toLowerCase().includes(term));
  },

  async fetchCharacterData(characterPath) {
    let input = characterPath.trim();

    // Handle full URLs pasted by user
    if (input.startsWith('http')) {
      let url = input;

      // If it's already a github blob URL with ?raw=true, use as-is
      if (url.includes('github.com') && url.includes('/blob/') && url.includes('?raw=true')) {
        const filename = decodeURIComponent(url.split('/').pop().replace('?raw=true', ''));
        return {
          characterId: filename.replace(/\.[^.]+$/, ''),
          imageUrl: url,
          characterPath: filename,
          provider: 'arknights',
          displayName: this.toDisplayName(filename)
        };
      }

      // If it's a raw.githubusercontent.com URL, convert to blob display URL
      if (url.includes('raw.githubusercontent.com')) {
        // Extract owner, repo, branch, path from raw URL
        const match = url.match(/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)/);
        if (match) {
          const [, owner, repo, branch, path] = match;
          const filename = path.split('/').pop();
          const displayUrl = `https://github.com/${owner}/${repo}/blob/${branch}/${path}?raw=true`;
          return {
            characterId: filename.replace(/\.[^.]+$/, ''),
            imageUrl: displayUrl,
            characterPath: filename,
            provider: 'arknights',
            displayName: this.toDisplayName(filename)
          };
        }
      }

      // Try verify and use as-is if it's already a working image URL
      if (await verifyImage(url)) {
        const filename = decodeURIComponent(url.split('/').pop().replace('?raw=true', ''));
        return {
          characterId: filename.replace(/\.[^.]+$/, ''),
          imageUrl: url,
          characterPath: filename,
          provider: 'arknights',
          displayName: this.toDisplayName(filename)
        };
      }

      throw new Error(`Image not found at URL: ${url}`);
    }

    // Search by name/filename
    const list = await this.getCharacterList();
    const lower = input.toLowerCase();

    let match = list.find(c => c.filename.toLowerCase() === lower || c.name === lower || c.displayName.toLowerCase() === lower);
    if (!match) {
      match = list.find(c => c.name.includes(lower) || c.displayName.toLowerCase().includes(lower));
    }

    if (match) {
      return {
        characterId: match.name,
        imageUrl: match.imageUrl,
        characterPath: match.filename,
        provider: 'arknights',
        displayName: match.displayName
      };
    }

    throw new Error(`Character "${characterPath}" not found. Try selecting from the list.`);
  },

  extractCharacterId(html) {
    return null;
  }
};