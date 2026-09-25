/**
 * Config & State Manager for Projector Flipbook Reader
 * Handles persistent storage for Calibre-Web credentials, reader preferences, and bookmarks.
 */
class AppConfig {
    static KEYS = {
        SERVER_URL: 'pfr_server_url',
        USERNAME: 'pfr_username',
        PASSWORD: 'pfr_password',
        THEME: 'pfr_theme', // 'parchment' | 'night'
        FONT_SIZE: 'pfr_font_size', // 18, 22, 26, 30, 34
        BRIGHTNESS: 'pfr_brightness', // 0.4 to 1.0
        PROGRESS_PREFIX: 'pfr_progress_' // + book_id -> page_index
    };

    static getDefaults() {
        return {
            serverUrl: 'http://192.168.1.50:8083',
            username: '',
            password: '',
            theme: 'parchment', // Default for wall projection; 'night' for ceiling
            fontSize: 24,
            brightness: 1.0
        };
    }

    static getServerUrl() {
        return localStorage.getItem(this.KEYS.SERVER_URL) || this.getDefaults().serverUrl;
    }

    static setServerUrl(url) {
        let cleanUrl = (url || '').trim().replace(/\/+$/, '');
        localStorage.setItem(this.KEYS.SERVER_URL, cleanUrl);
    }

    static getCredentials() {
        return {
            username: localStorage.getItem(this.KEYS.USERNAME) || '',
            password: localStorage.getItem(this.KEYS.PASSWORD) || ''
        };
    }

    static setCredentials(username, password) {
        localStorage.setItem(this.KEYS.USERNAME, username || '');
        localStorage.setItem(this.KEYS.PASSWORD, password || '');
    }

    static getAuthHeader() {
        const { username, password } = this.getCredentials();
        if (!username && !password) return null;
        const encoded = btoa(unescape(encodeURIComponent(`${username}:${password}`)));
        return `Basic ${encoded}`;
    }

    static getTheme() {
        return localStorage.getItem(this.KEYS.THEME) || this.getDefaults().theme;
    }

    static setTheme(theme) {
        localStorage.setItem(this.KEYS.THEME, theme);
    }

    static getFontSize() {
        const size = parseInt(localStorage.getItem(this.KEYS.FONT_SIZE), 10);
        return isNaN(size) ? this.getDefaults().fontSize : size;
    }

    static setFontSize(size) {
        localStorage.setItem(this.KEYS.FONT_SIZE, size.toString());
    }

    static getBrightness() {
        const b = parseFloat(localStorage.getItem(this.KEYS.BRIGHTNESS));
        return isNaN(b) ? this.getDefaults().brightness : b;
    }

    static setBrightness(brightness) {
        localStorage.setItem(this.KEYS.BRIGHTNESS, brightness.toString());
    }

    static getReadingProgress(bookId) {
        const saved = localStorage.getItem(`${this.KEYS.PROGRESS_PREFIX}${bookId}`);
        return saved ? parseInt(saved, 10) : 0;
    }

    static saveReadingProgress(bookId, spreadIndex) {
        if (!bookId) return;
        localStorage.setItem(`${this.KEYS.PROGRESS_PREFIX}${bookId}`, spreadIndex.toString());
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = AppConfig;
}
