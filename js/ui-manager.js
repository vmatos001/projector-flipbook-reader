/**
 * UI Manager - Central Controller for Projector Flipbook Reader
 * Orchestrates catalog rendering, book loading, reader view, settings and D-Pad focus.
 */
class UIManager {
    constructor() {
        this.currentView = 'catalog'; // 'catalog' | 'reader' | 'settings'
        this.isMenuOpen = false;
        this.books = [];
        this.currentBook = null;

        // Subsystems
        this.opdsClient = new OPDSClient();
        this.epubEngine = new EpubEngine();
        this.flipbook = null;
        this.remoteController = null;

        // DOM elements
        this.appRoot = document.getElementById('app-root');
        this.catalogView = document.getElementById('catalog-view');
        this.catalogGrid = document.getElementById('catalog-grid');
        this.readerView = document.getElementById('reader-view');
        this.flipbookContainer = document.getElementById('flipbook-container');
        this.floatingMenu = document.getElementById('floating-menu');
        this.settingsModal = document.getElementById('settings-modal');
        this.loadingOverlay = document.getElementById('loading-overlay');
        this.loadingText = document.getElementById('loading-text');
        this.loadingProgress = document.getElementById('loading-progress');

        // Form elements
        this.inputServerUrl = document.getElementById('input-server-url');
        this.inputUsername = document.getElementById('input-username');
        this.inputPassword = document.getElementById('input-password');
        this.settingsStatus = document.getElementById('settings-status');

        this.init();
    }

    async init() {
        this.initViewportScale();
        window.addEventListener('resize', () => this.initViewportScale());

        this.flipbook = new FlipbookEngine(this.flipbookContainer);
        this.remoteController = new TVRemoteController(this);

        this.applyTheme(AppConfig.getTheme());
        this.applyBrightness(AppConfig.getBrightness());

        // Load credentials into form
        this.inputServerUrl.value = AppConfig.getServerUrl();
        const creds = AppConfig.getCredentials();
        this.inputUsername.value = creds.username;
        this.inputPassword.value = creds.password;

        this.bindUiEvents();

        // Initial catalog load
        await this.loadCatalog();
    }

    /**
     * Scales 1920x1080 master container to fit the current display maintaining 16:9 ratio
     */
    initViewportScale() {
        const targetWidth = 1920;
        const targetHeight = 1080;
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;

        const scaleX = windowWidth / targetWidth;
        const scaleY = windowHeight / targetHeight;
        const scale = Math.min(scaleX, scaleY);

        this.appRoot.style.transform = `scale(${scale})`;
    }

    bindUiEvents() {
        document.getElementById('btn-settings').addEventListener('click', () => this.openSettingsModal());
        document.getElementById('btn-close-settings').addEventListener('click', () => this.closeSettingsModal());
        document.getElementById('btn-save-settings').addEventListener('click', () => this.saveSettings());
        document.getElementById('btn-test-connection').addEventListener('click', () => this.testConnection());
    }

    showLoading(text = 'Cargando...', progress = '') {
        this.loadingText.textContent = text;
        this.loadingProgress.textContent = progress;
        this.loadingOverlay.style.display = 'flex';
    }

    hideLoading() {
        this.loadingOverlay.style.display = 'none';
    }

    async loadCatalog() {
        this.showLoading('Conectando con Calibre-Web...', 'Consultando feed OPDS');
        try {
            const feed = await this.opdsClient.fetchCatalog();
            this.books = feed.books;
            this.renderCatalogGrid();
            this.hideLoading();
            this.remoteController.setGridFocus(0);
        } catch (error) {
            console.warn('Fallo al conectar con OPDS remoto, cargando libros de muestra locales:', error);
            // Fallback to mock catalog for local testing
            this.loadMockCatalog();
        }
    }

    loadMockCatalog() {
        this.books = [
            {
                id: 'mock_1',
                title: 'Don Quijote de la Mancha',
                author: 'Miguel de Cervantes',
                summary: 'El ingenioso hidalgo Don Quijote de la Mancha narra las aventuras de un hidalgo pobre que de tanto leer novelas de caballería acaba enloqueciendo...',
                coverUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=350&q=80',
                epubUrl: '/mock/quijote.epub'
            },
            {
                id: 'mock_2',
                title: 'La Metamorfosis',
                author: 'Franz Kafka',
                summary: 'Una mañana, tras un sueño intranquilo, Gregorio Samsa se despertó convertido en un monstruoso insecto...',
                coverUrl: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=350&q=80',
                epubUrl: '/mock/metamorfosis.epub'
            },
            {
                id: 'mock_3',
                title: 'El Principito',
                author: 'Antoine de Saint-Exupéry',
                summary: 'Pido perdón a los niños por haber dedicado este libro a una persona grande...',
                coverUrl: 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=350&q=80',
                epubUrl: '/mock/principito.epub'
            },
            {
                id: 'mock_4',
                title: 'Cien Años de Soledad',
                author: 'Gabriel García Márquez',
                summary: 'Muchos años después, frente al pelotón de fusilamiento, el coronel Aureliano Buendía había de recordar...',
                coverUrl: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=350&q=80',
                epubUrl: '/mock/soledad.epub'
            },
            {
                id: 'mock_5',
                title: 'El Arte de la Guerra',
                author: 'Sun Tzu',
                summary: 'El arte de la guerra se basa en el engaño. Por lo tanto, cuando seamos capaces de atacar, debemos parecer incapaces...',
                coverUrl: 'https://images.unsplash.com/photo-1495640388908-05fa85288e61?w=350&q=80',
                epubUrl: '/mock/guerra.epub'
            }
        ];
        this.renderCatalogGrid();
        this.hideLoading();
        this.remoteController.setGridFocus(0);
    }

    renderCatalogGrid() {
        this.catalogGrid.innerHTML = '';
        this.remoteController.totalItems = this.books.length;

        this.books.forEach((book, index) => {
            const card = document.createElement('div');
            card.className = `catalog-card ${index === 0 ? 'focused' : ''}`;
            card.setAttribute('data-index', index);

            card.innerHTML = `
                <div class="catalog-card-cover">
                    ${book.coverUrl 
                        ? `<img src="${book.coverUrl}" alt="${book.title}" loading="lazy" />` 
                        : `<div class="cover-placeholder">📖</div>`
                    }
                </div>
                <div class="catalog-card-info">
                    <div class="catalog-card-title">${book.title}</div>
                    <div class="catalog-card-author">${book.author}</div>
                </div>
            `;

            card.addEventListener('click', () => {
                this.remoteController.setGridFocus(index);
                this.onBookSelected(index);
            });

            this.catalogGrid.appendChild(card);
        });
    }

    async onBookSelected(index) {
        const book = this.books[index];
        if (!book) return;
        this.currentBook = book;

        this.showLoading('Descargando libro...', '0%');

        try {
            let buffer;
            if (book.epubUrl && !book.epubUrl.startsWith('/mock/')) {
                buffer = await this.opdsClient.downloadEpub(book.epubUrl, (percent) => {
                    this.showLoading('Descargando libro...', `${percent}%`);
                });
                this.showLoading('Procesando pliegos 16:9...', 'Estructurando capítulos');
                await this.epubEngine.load(buffer);
            } else {
                // Generate instant sample EPUB structure in memory for mock testing
                await this.createSampleEpubBuffer(book);
            }

            this.epubEngine.paginate(AppConfig.getFontSize(), AppConfig.getTheme());

            const savedProgress = AppConfig.getReadingProgress(book.id);
            this.flipbook.setEngine(this.epubEngine, savedProgress);

            this.hideLoading();
            this.switchView('reader');
        } catch (error) {
            console.error('Error opening book:', error);
            this.hideLoading();
            alert(`Error al abrir el libro: ${error.message}`);
        }
    }

    async createSampleEpubBuffer(book) {
        // Generates sample chapters for immediate interactive flipbook testing
        const sampleText = `
            <h2>${book.title}</h2>
            <p><strong>Autor:</strong> ${book.author}</p>
            <p>${book.summary}</p>
            <p>Este es el visor Projector Flipbook Reader configurado para proyectar pliegos de dos páginas en resolución 16:9 sobre paredes o techo.</p>
            <p>El sistema de control remoto por D-Pad permite pasar las páginas suavemente con animación 3D Page-Curl optimizada para 60 fotogramas por segundo.</p>
            <p>Al presionar DPAD_CENTER (o Enter), se despliega el menú rápido de proyección con ajuste de paletas (Modo Pergamino vs Modo Noche) y tamaño tipográfico.</p>
            <p>La tipografía serif está calibrada para evitar la fatiga visual y eliminar la luz azul nociva durante la lectura en dormitorios oscuros.</p>
        `;

        this.epubEngine.chapters = [
            { id: 'ch1', html: sampleText },
            { id: 'ch2', html: `<h2>Capítulo II</h2><p>Las palabras fluían a través del proyector iluminando la habitación con una tenue luz ámbar.</p><p>Todo el procesamiento de texto y maquetación a doble columna se calcula en milisegundos para garantizar una lectura fluida.</p>` }
        ];
        this.epubEngine.metadata = { title: book.title, creator: book.author };
        this.epubEngine.paginate(AppConfig.getFontSize(), AppConfig.getTheme());
        return new ArrayBuffer(8);
    }

    switchView(viewName) {
        this.currentView = viewName;
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));

        if (viewName === 'catalog') {
            this.catalogView.classList.add('active');
        } else if (viewName === 'reader') {
            this.readerView.classList.add('active');
        }
    }

    closeReaderAndSaveProgress() {
        if (this.currentBook && this.flipbook) {
            AppConfig.saveReadingProgress(this.currentBook.id, this.flipbook.currentSpreadIndex);
        }
        this.closeFloatingMenu();
        this.switchView('catalog');
    }

    toggleFloatingMenu() {
        if (this.isMenuOpen) {
            this.closeFloatingMenu();
        } else {
            this.openFloatingMenu();
        }
    }

    openFloatingMenu() {
        this.isMenuOpen = true;
        this.floatingMenu.classList.add('open');
        this.updateMenuUI();
        this.updateMenuFocus(0);
    }

    closeFloatingMenu() {
        this.isMenuOpen = false;
        this.floatingMenu.classList.remove('open');
    }

    updateMenuFocus(index) {
        const items = document.querySelectorAll('.menu-item');
        items.forEach((item, i) => {
            item.classList.toggle('focused', i === index);
        });
    }

    updateMenuUI() {
        const theme = AppConfig.getTheme();
        const fontSize = AppConfig.getFontSize();
        const brightness = Math.round(AppConfig.getBrightness() * 100);

        document.getElementById('menu-theme-val').textContent = theme === 'night' ? '🌙 Modo Noche' : '📜 Pergamino';
        document.getElementById('menu-fontsize-val').textContent = `${fontSize} px`;
        document.getElementById('menu-brightness-val').textContent = `${brightness}%`;
    }

    adjustMenuOption(index, delta) {
        if (index === 0) { // Theme
            const current = AppConfig.getTheme();
            const next = current === 'parchment' ? 'night' : 'parchment';
            AppConfig.setTheme(next);
            this.applyTheme(next);
            this.flipbook.setTheme(next);
        } else if (index === 1) { // Font Size
            let current = AppConfig.getFontSize();
            current = Math.max(18, Math.min(38, current + (delta * 4)));
            AppConfig.setFontSize(current);
            this.flipbook.setFontSize(current);
        } else if (index === 2) { // Brightness
            let current = AppConfig.getBrightness();
            current = Math.max(0.4, Math.min(1.0, current + (delta * 0.1)));
            AppConfig.setBrightness(current);
            this.applyBrightness(current);
        }
        this.updateMenuUI();
    }

    applyTheme(theme) {
        this.flipbookContainer.setAttribute('data-theme', theme);
    }

    applyBrightness(brightness) {
        this.appRoot.style.filter = `brightness(${brightness})`;
    }

    openSettingsModal() {
        this.currentView = 'settings';
        this.settingsModal.style.display = 'flex';
        this.inputServerUrl.focus();
    }

    closeSettingsModal() {
        this.settingsModal.style.display = 'none';
        this.currentView = 'catalog';
        this.remoteController.setGridFocus(this.remoteController.focusedIndex);
    }

    async testConnection() {
        this.settingsStatus.textContent = 'Probando conexión...';
        this.settingsStatus.style.color = '#FFB300';

        const result = await this.opdsClient.testConnection(
            this.inputServerUrl.value,
            this.inputUsername.value,
            this.inputPassword.value
        );

        if (result.success) {
            this.settingsStatus.textContent = `✓ ${result.message}`;
            this.settingsStatus.style.color = '#4CAF50';
        } else {
            this.settingsStatus.textContent = `✗ ${result.error}`;
            this.settingsStatus.style.color = '#F44336';
        }
    }

    saveSettings() {
        AppConfig.setServerUrl(this.inputServerUrl.value);
        AppConfig.setCredentials(this.inputUsername.value, this.inputPassword.value);
        this.closeSettingsModal();
        this.loadCatalog();
    }

    focusToolbar() {
        document.getElementById('btn-settings').focus();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new UIManager();
});
