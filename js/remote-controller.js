/**
 * Remote Controller & D-Pad Focus Engine
 * Handles Fire TV / Android TV remote control key events (DPAD, Enter, Back)
 * and keyboard navigation for development testing.
 */
class TVRemoteController {
    constructor(uiManager) {
        this.ui = uiManager;
        this.cols = 5; // 5-column grid as per PRD
        this.focusedIndex = 0;
        this.totalItems = 0;
        this.menuFocusIndex = 0;
        this.totalMenuItems = 3; // Theme, FontSize, Brightness

        this.bindEvents();
    }

    bindEvents() {
        window.addEventListener('keydown', (e) => this.handleKeyDown(e));
    }

    handleKeyDown(e) {
        const key = e.key;
        const keyCode = e.keyCode;

        // Android TV KeyCodes mapping
        // KEYCODE_DPAD_UP = 19
        // KEYCODE_DPAD_DOWN = 20
        // KEYCODE_DPAD_LEFT = 21
        // KEYCODE_DPAD_RIGHT = 22
        // KEYCODE_DPAD_CENTER = 23
        // KEYCODE_ENTER = 66
        // KEYCODE_BACK = 4

        const isUp = key === 'ArrowUp' || keyCode === 19 || keyCode === 38;
        const isDown = key === 'ArrowDown' || keyCode === 20 || keyCode === 40;
        const isLeft = key === 'ArrowLeft' || keyCode === 21 || keyCode === 37;
        const isRight = key === 'ArrowRight' || keyCode === 22 || keyCode === 39;
        const isSelect = key === 'Enter' || key === 'Select' || keyCode === 23 || keyCode === 66 || keyCode === 13;
        const isBack = key === 'Escape' || key === 'Backspace' || key === 'GoBack' || keyCode === 4 || keyCode === 27;

        if (this.ui.currentView === 'catalog') {
            this.handleCatalogKey({ isUp, isDown, isLeft, isRight, isSelect, isBack, e });
        } else if (this.ui.currentView === 'reader') {
            if (this.ui.isMenuOpen) {
                this.handleMenuKey({ isUp, isDown, isLeft, isRight, isSelect, isBack, e });
            } else {
                this.handleReaderKey({ isUp, isDown, isLeft, isRight, isSelect, isBack, e });
            }
        } else if (this.ui.currentView === 'settings') {
            this.handleSettingsKey({ isUp, isDown, isLeft, isRight, isSelect, isBack, e });
        }
    }

    /**
     * Navigation for the 5-column Catalog Grid
     */
    handleCatalogKey({ isUp, isDown, isLeft, isRight, isSelect, isBack, e }) {
        if (isLeft) {
            e.preventDefault();
            if (this.focusedIndex > 0) {
                this.setGridFocus(this.focusedIndex - 1);
            }
        } else if (isRight) {
            e.preventDefault();
            if (this.focusedIndex < this.totalItems - 1) {
                this.setGridFocus(this.focusedIndex + 1);
            }
        } else if (isUp) {
            e.preventDefault();
            if (this.focusedIndex - this.cols >= 0) {
                this.setGridFocus(this.focusedIndex - this.cols);
            } else {
                // Focus on header toolbar / settings button
                this.ui.focusToolbar();
            }
        } else if (isDown) {
            e.preventDefault();
            if (this.focusedIndex + this.cols < this.totalItems) {
                this.setGridFocus(this.focusedIndex + this.cols);
            }
        } else if (isSelect) {
            e.preventDefault();
            this.ui.onBookSelected(this.focusedIndex);
        } else if (isBack) {
            e.preventDefault();
            this.ui.openSettingsModal();
        }
    }

    setGridFocus(index) {
        const items = document.querySelectorAll('.catalog-card');
        if (items.length === 0) return;

        items.forEach(item => item.classList.remove('focused'));

        this.focusedIndex = Math.max(0, Math.min(index, items.length - 1));
        const target = items[this.focusedIndex];
        if (target) {
            target.classList.add('focused');
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    /**
     * Navigation during Reading Mode
     */
    handleReaderKey({ isUp, isDown, isLeft, isRight, isSelect, isBack, e }) {
        if (isRight || isDown) {
            e.preventDefault();
            this.ui.flipbook.nextSpread();
        } else if (isLeft || isUp) {
            e.preventDefault();
            this.ui.flipbook.previousSpread();
        } else if (isSelect) {
            e.preventDefault();
            this.ui.toggleFloatingMenu();
        } else if (isBack) {
            e.preventDefault();
            this.ui.closeReaderAndSaveProgress();
        }
    }

    /**
     * Navigation inside the Floating Quick Menu
     */
    handleMenuKey({ isUp, isDown, isLeft, isRight, isSelect, isBack, e }) {
        if (isBack || isSelect) {
            e.preventDefault();
            this.ui.toggleFloatingMenu();
            return;
        }

        if (isUp) {
            e.preventDefault();
            this.menuFocusIndex = (this.menuFocusIndex - 1 + this.totalMenuItems) % this.totalMenuItems;
            this.ui.updateMenuFocus(this.menuFocusIndex);
        } else if (isDown) {
            e.preventDefault();
            this.menuFocusIndex = (this.menuFocusIndex + 1) % this.totalMenuItems;
            this.ui.updateMenuFocus(this.menuFocusIndex);
        } else if (isLeft || isRight) {
            e.preventDefault();
            const delta = isRight ? 1 : -1;
            this.ui.adjustMenuOption(this.menuFocusIndex, delta);
        }
    }

    /**
     * Settings modal navigation
     */
    handleSettingsKey({ isBack, e }) {
        if (isBack) {
            e.preventDefault();
            this.ui.closeSettingsModal();
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = TVRemoteController;
}
