// Theme Management Utility
export class ThemeManager {
  constructor() {
    this.currentTheme = 'default';
    this.themes = ['default', 'dark', 'warm'];
    this.init();
  }

  init() {
    // Load saved theme from localStorage
    const savedTheme = localStorage.getItem('asc-theme');
    if (savedTheme && this.themes.includes(savedTheme)) {
      this.setTheme(savedTheme);
    } else {
      this.setTheme('default');
    }

    // Add theme toggle to page
    this.addThemeToggle();
  }

  async loadTheme(themeName) {
    if (!this.themes.includes(themeName)) {
      console.warn(`Theme "${themeName}" not found`);
      return false;
    }

    try {
      // Remove existing theme classes
      document.body.classList.remove(...this.themes.map(t => `theme-${t}`));
      
      // Add new theme class
      document.body.classList.add(`theme-${themeName}`);
      
      // Save to localStorage
      localStorage.setItem('asc-theme', themeName);
      
      this.currentTheme = themeName;
      
      // Dispatch theme change event
      document.dispatchEvent(new CustomEvent('asc:theme:changed', {
        detail: { theme: themeName }
      }));
      
      return true;
    } catch (error) {
      console.error(`Failed to load theme "${themeName}":`, error);
      return false;
    }
  }

  setTheme(themeName) {
    return this.loadTheme(themeName);
  }

  getCurrentTheme() {
    return this.currentTheme;
  }

  getAvailableThemes() {
    return [...this.themes];
  }

  addThemeToggle() {
    // Create theme toggle if it doesn't exist
    if (document.getElementById('theme-toggle')) return;

    const toggle = document.createElement('div');
    toggle.id = 'theme-toggle';
    toggle.className = 'theme-toggle';
    toggle.innerHTML = `
      <button class="theme-toggle-btn" aria-label="Toggle theme">
        <span class="theme-toggle-icon">🎨</span>
      </button>
      <div class="theme-dropdown" style="display: none;">
        ${this.themes.map(theme => `
          <button class="theme-option ${theme === this.currentTheme ? 'active' : ''}" 
                  data-theme="${theme}">
            ${theme.charAt(0).toUpperCase() + theme.slice(1)}
          </button>
        `).join('')}
      </div>
    `;

    // Add event listeners
    const toggleBtn = toggle.querySelector('.theme-toggle-btn');
    const dropdown = toggle.querySelector('.theme-dropdown');
    const options = toggle.querySelectorAll('.theme-option');

    toggleBtn.addEventListener('click', () => {
      dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
    });

    options.forEach(option => {
      option.addEventListener('click', () => {
        const theme = option.dataset.theme;
        this.setTheme(theme);
        
        // Update active state
        options.forEach(opt => opt.classList.remove('active'));
        option.classList.add('active');
        
        // Hide dropdown
        dropdown.style.display = 'none';
      });
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!toggle.contains(e.target)) {
        dropdown.style.display = 'none';
      }
    });

    // Insert into page
    document.body.appendChild(toggle);
  }
}

// Export singleton instance
export const themeManager = new ThemeManager();
