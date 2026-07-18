// ============================================================
// POPUP CONTROLLER - Sidebar with Character List
// ============================================================

const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);

// Provider metadata for UI
const PROVIDER_CONFIG = {
  sinoalice: {
    name: 'SinoAlice',
    instructions: '<strong>How to use:</strong> Copy the character path from the wiki URL.<br>Example: <code>sinoalice.game-db.tw/characters/<strong>アリス/sorcerer</strong></code>',
    placeholder: 'アリス/sorcerer',
    hasCharacterList: false
  },
  wutheringwaves: {
    name: 'Wuthering Waves',
    instructions: '<strong>How to use:</strong> Select a character from the sidebar or enter the name.<br>Examples: <code>jiyan</code>, <code>yangyang</code>, <code>changli</code>',
    placeholder: 'Enter character name or select from list',
    hasCharacterList: true
  },
  arknights: {
    name: 'Arknights',
    instructions: '<strong>How to use:</strong> Select an operator from the sidebar, or type a name / paste a full GitHub image URL.<br>List is fetched live from the repo.',
    placeholder: 'Enter operator name or select from list',
    hasCharacterList: true
  },
  bluearchive: {
    name: 'Blue Archive Wiki',
    instructions: '<strong>How to use:</strong> Enter a wiki URL.<br>From lists : <kbd style="user-select:all;display:block;color:orange;">https://bluearchive.wikiru.jp/?%E3%82%AD%E3%83%A3%E3%83%A9%E3%82%AF%E3%82%BF%E3%83%BC%E4%B8%80%E8%A6%A7</kbd> <br><hr><br>Example : <kbd style="user-select:all;display:block;color:orange;">https://bluearchive.wikiru.jp/?%E3%82%AB%E3%83%AA%E3%83%B3</kbd>',
    placeholder: 'Enter character name or paste wiki URL',
    hasCharacterList: false
  }
};

class PopupController {
  constructor() {
    this.settings = this.getDefaults();
    this.allCharacters = [];
    this.filteredCharacters = [];
    this.selectedCharacter = null;
    this.init();
  }

  getDefaults() {
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

  async init() {
    await this.loadSettings();
    this.bindEvents();
    this.renderUI();
    this.updateProviderUI(this.settings.provider);

    // Load characters ONLY for providers with character lists
    if (PROVIDER_CONFIG[this.settings.provider]?.hasCharacterList) {
      await this.loadCharacterList();
    } else {
      // Explicitly clear sidebar for providers without character lists
      this.disableSidebar();
    }
  }

  async loadSettings() {
    const data = await chrome.storage.sync.get('waifuSettings');
    if (data.waifuSettings) {
      this.settings = { ...this.getDefaults(), ...data.waifuSettings };
    }
  }

  bindEvents() {
    // Range inputs
    $('#size').addEventListener('input', e => {
      $('#sizeValue').textContent = e.target.value;
    });

    $('#opacity').addEventListener('input', e => {
      $('#opacityValue').textContent = e.target.value;
    });

    // Toggle switch
    const toggle = $('#alwaysOnTopSwitch');
    const checkbox = $('#alwaysOnTop');

    toggle.addEventListener('click', () => {
      checkbox.checked = !checkbox.checked;
      toggle.classList.toggle('active', checkbox.checked);
    });

    // Provider change
    $('#provider').addEventListener('change', async e => {
      this.settings.provider = e.target.value;
      this.updateProviderUI(e.target.value);
      this.renderUI();

      // Load characters for the selected provider
      if (PROVIDER_CONFIG[e.target.value]?.hasCharacterList) {
        await this.loadCharacterList();
      } else {
        // Disable sidebar for providers without character lists
        this.disableSidebar();
      }
    });

    // Search filter
    $('#searchInput').addEventListener('input', e => {
      this.filterCharacterList(e.target.value);
    });

    // Enter key on character path
    $('#characterPath').addEventListener('keydown', e => {
      if (e.key === 'Enter') this.apply();
    });

    // Buttons
    $('#applyBtn').addEventListener('click', () => this.apply());
    $('#resetBtn').addEventListener('click', () => this.reset());
  }

  async loadCharacterList() {
    const list = $('#characterList');
    list.innerHTML = `
      <div class="character-list-loading">
        <span class="spinner"></span>
        Loading characters...
      </div>
    `;

    try {
      // Get ALL characters by not passing a query
      const response = await chrome.runtime.sendMessage({
        action: 'searchCharacters',
        provider: this.settings.provider,
        query: '' // Empty query returns ALL characters
      });

      if (!response.success) throw new Error(response.error);

      this.allCharacters = response.results || [];
      this.filteredCharacters = [...this.allCharacters];
      this.renderCharacterList(this.filteredCharacters);

      // Update count
      $('#charCount').textContent = this.allCharacters.length;

      // Select the current character if it exists
      if (this.settings.characterPath) {
        const match = this.allCharacters.find(c =>
          c.name === this.settings.characterPath ||
          c.filename === this.settings.characterPath
        );
        if (match) {
          this.selectCharacter(match);
        }
      }

      console.log(`Loaded ${this.allCharacters.length} characters`);
    } catch (error) {
      console.error('Failed to load characters:', error);
      // Graceful fallback — no error banner in sidebar
      list.innerHTML = `
        <div class="character-list-empty">
          No characters found
        </div>
      `;
      $('#charCount').textContent = '0';
    }
  }

  renderCharacterList(characters) {
    const list = $('#characterList');

    if (!characters || characters.length === 0) {
      list.innerHTML = `
        <div class="character-list-empty">
          No characters found
        </div>
      `;
      return;
    }

    list.innerHTML = '';

    characters.forEach(char => {
      const item = document.createElement('div');
      item.className = 'character-item';

      // Check if this character is selected
      if (this.selectedCharacter && this.selectedCharacter.name === char.name) {
        item.classList.add('active');
      }

      // Avatar
      const avatar = document.createElement('img');
      avatar.className = 'avatar';
      avatar.src = char.imageUrl;
      avatar.alt = char.displayName;
      avatar.loading = 'lazy';
      avatar.onerror = () => {
        avatar.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="%23737373" stroke-width="1"%3E%3Crect x="3" y="3" width="18" height="18" rx="2"/%3E%3Ccircle cx="8.5" cy="8.5" r="1.5"/%3E%3Cpath d="M21 15l-5-5L5 21"/%3E%3C/svg%3E';
      };
      item.appendChild(avatar);

      // Info
      const info = document.createElement('div');
      info.className = 'info';

      const name = document.createElement('div');
      name.className = 'name';
      name.textContent = char.displayName || char.name;
      info.appendChild(name);

      const internalName = document.createElement('div');
      internalName.className = 'internal-name';
      internalName.textContent = char.name;
      info.appendChild(internalName);

      item.appendChild(info);

      // Check mark
      const check = document.createElement('span');
      check.className = 'check';
      check.textContent = '✓';
      item.appendChild(check);

      item.addEventListener('click', () => this.selectCharacter(char));
      list.appendChild(item);
    });
  }

  filterCharacterList(query) {
    const searchTerm = query.toLowerCase().trim();

    if (!searchTerm) {
      this.filteredCharacters = [...this.allCharacters];
    } else {
      this.filteredCharacters = this.allCharacters.filter(char => {
        const searchable = `${char.name} ${char.displayName}`.toLowerCase();
        return searchable.includes(searchTerm);
      });
    }

    this.renderCharacterList(this.filteredCharacters);
  }

  selectCharacter(char) {
    this.selectedCharacter = char;

    // Update sidebar
    $$('.character-item').forEach(item => {
      const name = item.querySelector('.name');
      if (name && name.textContent === (char.displayName || char.name)) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Update form
    $('#characterPath').value = char.filename || char.name;
    this.settings.characterPath = char.filename || char.name;

    this.showStatus(`Selected: ${char.displayName || char.name}`, 'success');

    // Auto-apply after selection
    this.apply();
  }

  // Completely disable sidebar for providers without character lists
  disableSidebar() {
    const sidebarSection = document.querySelector('.sidebar-section');
    const searchBox = document.querySelector('.search-box');
    const list = $('#characterList');

    // Hide sidebar section
    if (sidebarSection) {
      sidebarSection.style.display = 'none';
    }

    // Hide search box
    if (searchBox) {
      searchBox.style.display = 'none';
    }

    // Clear character list
    if (list) {
      list.innerHTML = '';
    }

    // Reset internal state
    this.allCharacters = [];
    this.filteredCharacters = [];
    this.selectedCharacter = null;
    $('#charCount').textContent = '0';
  }

  // Old method kept for backward compatibility
  clearCharacterList() {
    this.disableSidebar();
  }

  updateProviderUI(providerId) {
    const config = PROVIDER_CONFIG[providerId];
    if (!config) return;

    $('#instructions').innerHTML = config.instructions;
    $('#characterPath').placeholder = config.placeholder;
    $('#providerBadge').textContent = config.name;

    // Show/hide search and sidebar based on provider
    const sidebarSection = document.querySelector('.sidebar');
    const searchBox = document.querySelector('.search-box');
    
    if (config.hasCharacterList) {
      // Show sidebar and search for providers with character lists
      if (sidebarSection) sidebarSection.style.display = 'flex';
      if (searchBox) searchBox.style.display = 'flex';
    } else {
      // Hide sidebar and search for providers without character lists (sinoalice, bluearchive)
      if (sidebarSection) sidebarSection.style.display = 'none';
      if (searchBox) searchBox.style.display = 'none';
    }
  }

  renderUI() {
    const s = this.settings;
    $('#characterPath').value = s.characterPath;
    $('#provider').value = s.provider;
    $('#position').value = s.position;
    $('#animation').value = s.animation;
    $('#size').value = s.size;
    $('#sizeValue').textContent = s.size;
    $('#opacity').value = s.opacity;
    $('#opacityValue').textContent = s.opacity;
    $('#alwaysOnTop').checked = s.alwaysOnTop;
    $('#alwaysOnTopSwitch').classList.toggle('active', s.alwaysOnTop);
  }

  readSettings() {
    return {
      provider: $('#provider').value,
      characterPath: $('#characterPath').value.trim(),
      position: $('#position').value,
      size: parseInt($('#size').value),
      opacity: parseFloat($('#opacity').value),
      animation: $('#animation').value,
      alwaysOnTop: $('#alwaysOnTop').checked
    };
  }

  async apply() {
    const s = this.readSettings();
    if (!s.characterPath) {
      this.showStatus('Please select a character or enter a path', 'error');
      return;
    }

    this.settings = s;
    await chrome.storage.sync.set({ waifuSettings: s });
    this.sendToContent({ action: 'changeCharacter', characterPath: s.characterPath, settings: s });
    this.showStatus('Applied successfully!', 'success');
  }

  async reset() {
    this.settings = this.getDefaults();
    await chrome.storage.sync.remove('waifuSettings');
    this.renderUI();
    this.updateProviderUI(this.settings.provider);
    this.selectedCharacter = null;

    // Reload character list if needed
    if (PROVIDER_CONFIG[this.settings.provider]?.hasCharacterList) {
      await this.loadCharacterList();
    } else {
      // Disable sidebar for default provider if it doesn't have character list
      this.disableSidebar();
    }

    this.sendToContent({ action: 'changeCharacter', characterPath: '', settings: this.settings });
    this.showStatus('Reset to defaults', 'info');
  }

  sendToContent(msg) {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (!tabs[0]?.id) return;
      if (tabs[0].url?.startsWith('chrome://')) return;

      chrome.tabs.sendMessage(tabs[0].id, msg, () => {
        if (chrome.runtime.lastError) {
          chrome.tabs.reload(tabs[0].id);
        }
      });
    });
  }

  showStatus(msg, type) {
    const el = $('#status');
    el.textContent = msg;
    el.className = `status status-${type} show`;

    clearTimeout(this._statusTimer);
    this._statusTimer = setTimeout(() => {
      el.classList.remove('show');
    }, 3000);
  }
}

document.addEventListener('DOMContentLoaded', () => new PopupController());