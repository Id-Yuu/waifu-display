// ============================================================
// SINOALICE PROVIDER
// Wiki scraper for sinoalice.game-db.tw
// ============================================================

import { verifyImage } from '../utils.js';

export const sinoalice = {
  name: 'SinoAlice Wiki',
  baseUrl: 'https://sinoalice.game-db.tw',

  async fetchCharacterData(characterPath) {
    const encodedPath = encodeURI(characterPath);
    const url = `${this.baseUrl}/characters/${encodedPath}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      }
    });

    if (!response.ok) {
      throw new Error(`Character not found (HTTP ${response.status})`);
    }

    const html = await response.text();
    const characterId = this.extractCharacterId(html);

    if (!characterId) {
      throw new Error('Could not find character ID on the page');
    }

    const formats = ['.png', '.jpg', '.jpeg', '.webp'];
    let imageUrl = null;

    for (const ext of formats) {
      const testUrl = `${this.baseUrl}/images/character_l/${characterId}${ext}`;
      if (await verifyImage(testUrl)) {
        imageUrl = testUrl;
        break;
      }
    }

    return {
      characterId,
      imageUrl: imageUrl || `${this.baseUrl}/images/character_l/${characterId}.png`,
      characterPath,
      provider: 'sinoalice'
    };
  },

  extractCharacterId(html) {
    const ogMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*)["'][^>]*>/i) ||
                   html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:image["'][^>]*>/i);

    if (ogMatch?.[1]) {
      const m = ogMatch[1].match(/CharacterIcon(\d+)|character_l\/(\d+)/i);
      if (m) return m[1] || m[2];
    }

    const imgMatches = html.matchAll(/<img[^>]*src=["']([^"']*)["'][^>]*>/gi);
    for (const match of imgMatches) {
      const m = match[1].match(/CharacterIcon(\d+)|character_l\/(\d+)/i);
      if (m) return m[1] || m[2];
    }

    const scriptMatches = html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi);
    for (const match of scriptMatches) {
      const m = match[1].match(/characterId['"]?\s*[:=]\s*['"]?(\d+)['"]?|charId['"]?\s*[:=]\s*['"]?(\d+)['"]?|character_l\/(\d+)\.png/i);
      if (m) return m[1] || m[2] || m[3];
    }

    return null;
  }
};
