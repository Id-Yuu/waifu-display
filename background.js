// ============================================================
// BACKGROUND SERVICE WORKER
// Handles all API calls, CORS proxying, and provider routing.
// ============================================================

import { verifyImage, fetchImageAsDataUrl } from './utils.js';
import { sinoalice } from './providers/sinoalice.js';
import { wutheringwaves } from './providers/wutheringwaves.js';
import { arknights } from './providers/arknights.js';
import { bluearchive } from './providers/bluearchive.js';

// ===== PROVIDER REGISTRY =====
// To add a new source, import it above and register it here.
const PROVIDERS = {
  sinoalice,
  wutheringwaves,
  arknights,
  bluearchive
};

// ===== MESSAGE ROUTER =====
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const handle = async () => {
    switch (request.action) {
      case 'fetchCharacterData': {
        const providerId = request.provider || 'sinoalice';
        const provider = PROVIDERS[providerId];
        if (!provider) throw new Error(`Unknown provider: ${providerId}`);
        const data = await provider.fetchCharacterData(request.characterPath);
        return { success: true, data };
      }

      case 'searchCharacters': {
        const providerId = request.provider || 'wutheringwaves';
        const provider = PROVIDERS[providerId];
        if (!provider || !provider.searchCharacters) {
          return { success: false, error: 'Search not supported for this provider' };
        }
        const results = await provider.searchCharacters(request.query);
        return { success: true, results };
      }

      case 'fetchImageAsDataUrl': {
        // Return direct URL for providers that support it
        if (request.imageUrl && (
          request.imageUrl.includes('wutheringwaves.kurogames.com') ||
          request.imageUrl.includes('raw.githubusercontent.com') ||
          (request.imageUrl.includes('github.com') && request.imageUrl.includes('?raw=true'))
        )) {
          return { success: true, dataUrl: request.imageUrl, direct: true };
        }
        const dataUrl = await fetchImageAsDataUrl(request.imageUrl);
        return { success: true, dataUrl };
      }

      case 'getSettings': {
        const data = await chrome.storage.sync.get('waifuSettings');
        return { success: true, settings: data.waifuSettings || {} };
      }

      default:
        return { success: false, error: 'Unknown action' };
    }
  };

  handle()
    .then(sendResponse)
    .catch(err => sendResponse({ success: false, error: err.message }));

  return true;
});

// ===== INSTALLATION =====
chrome.runtime.onInstalled.addListener(() => {
  console.log('[Waifu Extension] Installed');

  chrome.storage.sync.get('waifuSettings', (data) => {
    if (!data.waifuSettings) {
      const defaults = {
        provider: 'sinoalice',
        characterPath: '',
        position: 'bottom-right',
        size: 250,
        opacity: 0.9,
        animation: 'idle',
        alwaysOnTop: true
      };
      chrome.storage.sync.set({ waifuSettings: defaults });
    }
  });
});