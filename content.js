// ============================================================
// CONTENT SCRIPT — Waifu Display
// Uses Shadow DOM for zero CSS conflicts with host pages.
// ============================================================

class WaifuManager {
  constructor() {
    this.host = null;
    this.shadow = null;
    this.container = null;
    this.img = null;
    this.styleEl = null;
    this.loadingEl = null;
    this.errorEl = null;
    this.settings = this.getDefaultSettings();
  }

  getDefaultSettings() {
    return {
      provider: 'sinoalice',
      characterPath: '',
      position: 'bottom-right',
      size: 250,
      opacity: 0.9,
      animation: 'idle',
      alwaysOnTop: true
    };
  }

  // ===== LIFECYCLE =====

  async init() {
    await this.loadSettings();
    this.setupStorageListener();
    this.setupMessageListener();

    if (this.settings.characterPath) {
      await this.showCharacter();
    }
  }

  async loadSettings() {
    try {
      const data = await chrome.storage.sync.get('waifuSettings');
      if (data.waifuSettings) {
        this.settings = { ...this.getDefaultSettings(), ...data.waifuSettings };
      }
    } catch (e) {
      console.error('[Waifu] Failed to load settings:', e);
    }
  }

  // ===== EVENT LISTENERS =====

  setupStorageListener() {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync' || !changes.waifuSettings) return;

      const newSettings = changes.waifuSettings.newValue;
      if (!newSettings) {
        this.hideCharacter();
        return;
      }

      const oldPath = this.settings.characterPath;
      this.settings = { ...this.getDefaultSettings(), ...newSettings };

      if (!this.settings.characterPath) {
        this.hideCharacter();
      } else if (oldPath !== this.settings.characterPath) {
        this.showCharacter();
      } else {
        this.updateDisplay();
      }
    });
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      const handle = async () => {
        switch (request.action) {
          case 'changeCharacter':
            if (request.settings) {
              // this.settings = { ...this.getDefaults(), ...request.settings };
              this.settings = { ...this.getDefaultSettings(), ...request.settings };
            } else {
              this.settings.characterPath = request.characterPath;
            }

            if (this.settings.characterPath) {
              await this.showCharacter();
            } else {
              this.hideCharacter();
            }
            return { success: true };

          case 'updateSettings':
            this.settings = { ...this.settings, ...request.settings };
            this.updateDisplay();
            return { success: true };

          case 'reloadWaifu':
            if (this.settings.characterPath) {
              await this.showCharacter();
            }
            return { success: true };

          default:
            return { success: false, error: 'Unknown action' };
        }
      };

      handle().then(sendResponse).catch(err => sendResponse({ success: false, error: err.message }));
      return true;
    });
  }

  // ===== SHADOW DOM CORE =====

  createShadowHost() {
    this.destroy();

    const host = document.createElement('div');
    host.id = 'waifu-extension-host';
    host.style.cssText = 'position:static;display:block;width:0;height:0;margin:0;padding:0;border:none;overflow:visible;';

    const shadow = host.attachShadow({ mode: 'closed' });

    const styleEl = document.createElement('style');
    shadow.appendChild(styleEl);

    const container = document.createElement('div');
    container.id = 'waifu-container';
    container.className = 'waifu-entering';
    shadow.appendChild(container);

    const img = document.createElement('img');
    img.id = 'waifu-img';
    img.alt = 'Character';
    img.draggable = false;
    container.appendChild(img);

    document.body.appendChild(host);

    this.host = host;
    this.shadow = shadow;
    this.styleEl = styleEl;
    this.container = container;
    this.img = img;

    this.updateStyles();

    setTimeout(() => {
      if (this.container) {
        this.container.classList.remove('waifu-entering');
        this.container.classList.add('waifu-idle');
      }
    }, 600);
  }

  updateStyles() {
    if (!this.styleEl) return;

    const s = this.settings;
    const zIndex = s.alwaysOnTop ? '2147483647' : '999999';

    const posMap = {
      'bottom-right': 'bottom:16px;right:16px;',
      'bottom-left': 'bottom:16px;left:16px;',
      'top-right': 'top:16px;right:16px;',
      'top-left': 'top:16px;left:16px;'
    };

    const animMap = {
      none: 'none',
      bounce: 'waifu-bounce 2s ease-in-out infinite',
      sway: 'waifu-sway 3s ease-in-out infinite',
      idle: 'waifu-idle 2.5s ease-in-out infinite',
      float: 'waifu-float 3.5s ease-in-out infinite',
      pulse: 'waifu-pulse 2s ease-in-out infinite'
    };

    const position = posMap[s.position] || posMap['bottom-right'];
    const animation = animMap[s.animation] || animMap['idle'];

    this.styleEl.textContent = `
      :host { all: initial; }

      #waifu-container {
        position: fixed;
        ${position}
        width: ${s.size}px;
        height: ${s.size}px;
        z-index: ${zIndex};
        pointer-events: none;
        user-select: none;
        opacity: ${s.opacity};
        transition: opacity 0.3s ease, width 0.3s ease, height 0.3s ease;
      }

      #waifu-container.waifu-entering {
        animation: waifu-enter 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
      }

      #waifu-container.waifu-idle {
        animation: ${animation};
      }

      #waifu-img {
        width: 100%;
        height: 100%;
        object-fit: contain;
        display: block;
        pointer-events: none;
        user-select: none;
        -webkit-user-drag: none;
        filter: drop-shadow(0 4px 16px rgba(0,0,0,0.35));
      }

      @keyframes waifu-enter {
        0% { opacity: 0; transform: scale(0.6) translateY(20px); }
        100% { opacity: ${s.opacity}; transform: scale(1) translateY(0); }
      }

      @keyframes waifu-bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
      @keyframes waifu-sway { 0%,100%{transform:rotate(-3deg)} 50%{transform:rotate(3deg)} }
      @keyframes waifu-idle { 0%,100%{transform:scale(1)} 50%{transform:scale(1.04)} }
      @keyframes waifu-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
      @keyframes waifu-pulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.06);opacity:.88} }
    `;
  }

  // ===== DISPLAY CONTROL =====

  async showCharacter() {
    this.showLoading();
    this.hideError();

    try {
      const res = await chrome.runtime.sendMessage({
        action: 'fetchCharacterData',
        characterPath: this.settings.characterPath,
        provider: this.settings.provider
      });

      if (!res.success) throw new Error(res.error);

      const imageUrl = res.data.imageUrl;
      
      // For Wuthering Waves, use the image URL directly without converting to data URL
      const useDirectUrl = this.settings.provider === 'wutheringwaves' || 
                     this.settings.provider === 'arknights' ||
                     this.settings.provider === 'bluearchive';
      
      let finalImageUrl;
      
      if (useDirectUrl) {
        // Use direct URL for Wuthering Waves
        finalImageUrl = imageUrl;
      } else {
        // Convert to data URL for other providers
        const imgRes = await chrome.runtime.sendMessage({
          action: 'fetchImageAsDataUrl',
          imageUrl: imageUrl
        });
        
        if (!imgRes.success) throw new Error('Failed to load image');
        finalImageUrl = imgRes.dataUrl;
      }

      this.createShadowHost();
      if (!this.img) {
        throw new Error('Failed to create image element');
      }
      this.img.src = finalImageUrl;
      
      // Add a load handler for direct URLs
      if (useDirectUrl) {
        this.img.onerror = () => {
          console.error('[Waifu] Failed to load image directly, trying data URL fallback...');
          // Fallback: try to convert to data URL
          chrome.runtime.sendMessage({
            action: 'fetchImageAsDataUrl',
            imageUrl: imageUrl
          }, (imgRes) => {
            if (imgRes && imgRes.success && this.img) {
              this.img.src = imgRes.dataUrl;
            }
          });
        };
      }

    } catch (err) {
      console.error('[Waifu] Failed to show character:', err);
      this.showError(err.message);
    } finally {
      this.hideLoading();
    }
  }

  updateDisplay() {
    if (!this.host) return;
    this.updateStyles();

    if (this.container) {
      this.container.classList.remove('waifu-entering');
      this.container.classList.remove('waifu-idle');
      void this.container.offsetHeight;
      this.container.classList.add('waifu-idle');
    }
  }

  hideCharacter() {
    this.destroy();
  }

  destroy() {
    if (this.host?.parentNode) {
      this.host.remove();
    }
    this.host = null;
    this.shadow = null;
    this.container = null;
    this.img = null;
    this.styleEl = null;
  }

  // ===== OVERLAYS =====

  showLoading() {
    this.hideLoading();
    const el = document.createElement('div');
    el.id = 'waifu-loading';
    el.style.cssText = `
      position:fixed !important;bottom:20px !important;right:20px !important;
      z-index:2147483647 !important;background:rgba(10,10,10,0.9) !important;
      color:#fbbf24 !important;padding:8px 14px !important;border-radius:6px !important;
      font-family:system-ui,-apple-system,sans-serif !important;font-size:12px !important;
      display:flex !important;align-items:center !important;gap:8px !important;
      pointer-events:none !important;backdrop-filter:blur(8px) !important;
      border:1px solid rgba(251,191,36,0.2) !important;
    `;
    el.innerHTML = `<span style="display:inline-block;width:14px;height:14px;border:2px solid #fbbf24;border-top-color:transparent;border-radius:50%;animation:waifu-spin 0.8s linear infinite;"></span> Loading...`;

    if (!document.getElementById('waifu-global-keyframes')) {
      const style = document.createElement('style');
      style.id = 'waifu-global-keyframes';
      style.textContent = `@keyframes waifu-spin { to { transform: rotate(360deg); } }`;
      document.head.appendChild(style);
    }

    document.body.appendChild(el);
    this.loadingEl = el;
  }

  hideLoading() {
    if (this.loadingEl) {
      this.loadingEl.remove();
      this.loadingEl = null;
    }
  }

  showError(msg) {
    this.hideError();
    const el = document.createElement('div');
    el.id = 'waifu-error';
    el.style.cssText = `
      position:fixed !important;top:16px !important;right:16px !important;
      z-index:2147483647 !important;background:rgba(239,68,68,0.95) !important;
      color:#fff !important;padding:10px 14px !important;border-radius:6px !important;
      font-family:system-ui,-apple-system,sans-serif !important;font-size:12px !important;
      max-width:300px !important;line-height:1.4 !important;cursor:pointer !important;
      pointer-events:auto !important;backdrop-filter:blur(8px) !important;
      box-shadow:0 4px 20px rgba(0,0,0,0.3) !important;
    `;
    el.textContent = msg;
    el.onclick = () => this.hideError();
    document.body.appendChild(el);

    setTimeout(() => this.hideError(), 6000);
    this.errorEl = el;
  }

  hideError() {
    if (this.errorEl) {
      this.errorEl.remove();
      this.errorEl = null;
    }
  }
}

// ===== BOOT =====
const manager = new WaifuManager();
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => manager.init());
} else {
  manager.init();
}