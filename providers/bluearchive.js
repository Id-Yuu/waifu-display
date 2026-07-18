// ============================================================
// BLUE ARCHIVE PROVIDER
// Wiki scraper for bluearchive.wikiru.jp
// Fetches character list and images from wiki pages
// ============================================================

import { verifyImage } from '../utils.js';

export const bluearchive = {
  name: 'Blue Archive Wiki',
  baseUrl: 'https://bluearchive.wikiru.jp',
  characterListUrl: 'https://bluearchive.wikiru.jp/?%E3%82%AD%E3%83%A3%E3%83%A9%E3%82%AF%E3%82%BF%E3%83%BC%E4%B8%80%E8%A6%A7',
  _cache: null,

  // Extract URL parameter from full URL
  extractUrlParam(urlString) {
    try {
      const url = new URL(urlString);
      const search = url.search; // Gets "?encoded_param"
      return search.substring(1); // Remove leading "?"
    } catch (e) {
      console.warn('[Blue Archive] Failed to parse URL:', e);
      return null;
    }
  },

  // Extract image URL from wiki HTML
  extractImageFromHtml(html, characterName) {
    // Look for image tags with character name
    const regex = /<a\s+href=[^>]*>.*?<img[^>]*data-src="([^"]*)"\s+[^>]*alt="([^"]*)"\s+[^>]*>/gi;
    let match;
    
    while ((match = regex.exec(html)) !== null) {
      const imageSrc = match[1];  // Extract data-src URL
      
      // Prefer main character image (contains attach2/)
      if (imageSrc && imageSrc.includes('attach2/')) {
        return imageSrc;
      }
    }
    
    return null;
  },

  // Convert filename to display name
  toDisplayName(filename) {
    const base = filename.replace(/\.[^.]+$/, '');
    return base
      .replace(/_\d+$/, '') // Remove trailing _0, _1, etc
      .replace(/_/g, ' ')
      .trim();
  },

  // Decode URL parameter to character name
  decodeUrlParam(urlParam) {
    try {
      return decodeURIComponent(urlParam);
    } catch (e) {
      console.warn('[Blue Archive] Failed to decode URL param:', e);
      return null;
    }
  },

  async getCharacterList(forceRefresh = false) {
    const CACHE_TTL = 24 * 60 * 60 * 1000;
    const now = Date.now();

    if (!forceRefresh && this._cache && (now - this._cache.fetchedAt) < CACHE_TTL) {
      return this._cache.list;
    }

    let cached = null;
    try {
      const stored = await chrome.storage.local.get('bluearchiveCharacterCache');
      cached = stored.bluearchiveCharacterCache;
      if (!forceRefresh && cached && (now - cached.fetchedAt) < CACHE_TTL) {
        this._cache = cached;
        return cached.list;
      }
    } catch (e) {
      console.warn('[Blue Archive] Failed to read cache:', e);
    }

    let list = [];

    try {
      // Fetch character list page
      const res = await fetch(this.characterListUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (!res.ok) {
        if (cached && cached.list && cached.list.length > 0) {
          console.warn('[Blue Archive] API error, using stale cache');
          this._cache = cached;
          return cached.list;
        }
        throw new Error(`Failed to fetch character list (HTTP ${res.status})`);
      }

      const html = await res.text();

      // Extract character links from the page
      // Look for links that point to character pages: ?[ENCODED_CHARACTER_NAME]
      const linkRegex = /href="\?([%A-F0-9]+)"[^>]*>([^<]+)<\/a>/gi;
      const characterSet = new Set();
      let linkMatch;

      while ((linkMatch = linkRegex.exec(html)) !== null) {
        const encodedName = linkMatch[1];
        const displayName = linkMatch[2];

        if (encodedName && displayName && !characterSet.has(displayName)) {
          characterSet.add(displayName);
          list.push({
            name: displayName.toLowerCase(),
            displayName: displayName,
            urlParam: encodedName,
            imageUrl: null,
            provider: 'bluearchive'
          });
        }
      }

      if (list.length === 0) {
        console.warn('[Blue Archive] No characters found in list');
      }

      list.sort((a, b) => a.displayName.localeCompare(b.displayName));

      this._cache = { list, fetchedAt: now };
      await chrome.storage.local.set({ bluearchiveCharacterCache: this._cache });

      return list;
    } catch (err) {
      if (cached && cached.list && cached.list.length > 0) {
        console.warn('[Blue Archive] Fetch failed, using stale cache:', err.message);
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
    return list.filter(c => c.displayName.toLowerCase().includes(term) || c.name.includes(term));
  },

  async fetchCharacterData(characterPath) {
    let input = characterPath.trim();

    // Handle full wiki URLs - extract the parameter
    if (input.startsWith('https://bluearchive.wikiru.jp/?') || input.startsWith('http://bluearchive.wikiru.jp/?')) {
      console.log('[Blue Archive] Detected full URL, extracting parameter...');
      const urlParam = this.extractUrlParam(input);
      
      if (urlParam) {
        console.log('[Blue Archive] Extracted URL param:', urlParam);
        const characterName = this.decodeUrlParam(urlParam);
        console.log('[Blue Archive] Decoded character name:', characterName);
        
        // Use the extracted parameter as input
        input = urlParam;
      } else {
        throw new Error('Invalid Blue Archive wiki URL format');
      }
    }

    // Handle direct image URLs (full URL to image)
    if (input.startsWith('http') && input.includes('/attach2/')) {
      if (await verifyImage(input)) {
        const filename = decodeURIComponent(input.split('/').pop());
        return {
          characterId: filename,
          imageUrl: input,
          characterPath: filename,
          provider: 'bluearchive',
          displayName: this.toDisplayName(filename)
        };
      }
      throw new Error(`Image not found at URL: ${input}`);
    }

    // Handle URL parameters (e.g., %E3%82%A2%E3%83%AB)
    let urlParam = input;
    
    // If input is not already URL-encoded, encode it
    if (!/%[A-F0-9]{2}/i.test(input)) {
      // Try to find in character list first
      const list = await this.getCharacterList();
      const found = list.find(c => c.displayName.toLowerCase() === input.toLowerCase() || c.name === input.toLowerCase());
      
      if (found) {
        urlParam = found.urlParam;
      } else {
        // Try to encode it
        urlParam = encodeURIComponent(input);
      }
    }

    // Fetch character page using URL parameter
    const characterPageUrl = `${this.baseUrl}/?${urlParam}`;
    
    try {
      const res = await fetch(characterPageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (!res.ok) {
        throw new Error(`Character page not found (HTTP ${res.status})`);
      }

      const html = await res.text();

      // Extract image URL from the character page HTML
      const imageUrl = this.extractImageFromHtml(html, input);

      if (!imageUrl) {
        throw new Error('Could not find character image on wiki page');
      }

      // Build full URL if relative
      const fullImageUrl = imageUrl.startsWith('http') 
        ? imageUrl 
        : `${this.baseUrl}/${imageUrl}`;

      // Verify the image exists
      if (!await verifyImage(fullImageUrl)) {
        throw new Error('Image URL could not be verified');
      }

      return {
        characterId: input,
        imageUrl: fullImageUrl,
        characterPath: input,
        provider: 'bluearchive',
        displayName: this.toDisplayName(imageUrl)
      };

    } catch (err) {
      console.error('[Blue Archive] Failed to fetch character data:', err);
      throw new Error(`Character "${characterPath}" not found on Blue Archive wiki. ${err.message}`);
    }
  },

  extractCharacterId(html) {
    return null;
  }
};