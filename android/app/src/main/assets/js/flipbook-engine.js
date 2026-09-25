/**
 * Flipbook Engine with 3D Page-Curl Animation
 * Renders dual 960x1080 columns in 16:9 layout with hardware-accelerated 60fps 3D page-curl transition.
 */
class FlipbookEngine {
    constructor(containerElement) {
        this.container = containerElement;
        this.currentSpreadIndex = 0;
        this.totalSpreads = 0;
        this.isAnimating = false;
        this.animationDuration = 280; // <= 300ms as per PRD
        this.epubEngine = null;
        this.theme = 'parchment';
        this.fontSize = 24;

        this.initDOM();
    }

    initDOM() {
        this.container.innerHTML = `
            <div class="flipbook-viewport" id="flipbookViewport">
                <!-- Underlay / Base Spread (Current or Target) -->
                <div class="spread-container current-spread" id="currentSpread">
                    <div class="page-side page-left" id="leftPage">
                        <div class="page-inner-border"></div>
                        <div class="page-header" id="leftHeader"></div>
                        <div class="page-content" id="leftContent"></div>
                        <div class="page-footer" id="leftFooter"></div>
                    </div>
                    <div class="spine-shadow"></div>
                    <div class="page-side page-right" id="rightPage">
                        <div class="page-inner-border"></div>
                        <div class="page-header" id="rightHeader"></div>
                        <div class="page-content" id="rightContent"></div>
                        <div class="page-footer" id="rightFooter"></div>
                    </div>
                </div>

                <!-- 3D Page Curl Overlay Layer for 60fps Hardware Accelerated Animation -->
                <div class="curl-overlay" id="curlOverlay" style="display: none;">
                    <div class="curl-sheet" id="curlSheet">
                        <div class="curl-front" id="curlFront"></div>
                        <div class="curl-back" id="curlBack"></div>
                        <div class="curl-shadow" id="curlShadow"></div>
                    </div>
                </div>
            </div>
        `;

        this.viewport = document.getElementById('flipbookViewport');
        this.currentSpreadEl = document.getElementById('currentSpread');
        this.leftContent = document.getElementById('leftContent');
        this.rightContent = document.getElementById('rightContent');
        this.leftHeader = document.getElementById('leftHeader');
        this.rightHeader = document.getElementById('rightHeader');
        this.leftFooter = document.getElementById('leftFooter');
        this.rightFooter = document.getElementById('rightFooter');
        this.curlOverlay = document.getElementById('curlOverlay');
        this.curlSheet = document.getElementById('curlSheet');
        this.curlFront = document.getElementById('curlFront');
        this.curlBack = document.getElementById('curlBack');
    }

    setEngine(epubEngine, initialSpread = 0) {
        this.epubEngine = epubEngine;
        this.totalSpreads = epubEngine.getTotalSpreads();
        this.currentSpreadIndex = Math.max(0, Math.min(initialSpread, this.totalSpreads - 1));
        this.renderCurrentSpread();
    }

    setTheme(theme) {
        this.theme = theme;
        if (this.container) {
            this.container.setAttribute('data-theme', theme);
        }
    }

    setFontSize(fontSize) {
        this.fontSize = fontSize;
        if (this.epubEngine) {
            this.epubEngine.paginate(this.fontSize, this.theme);
            this.totalSpreads = this.epubEngine.getTotalSpreads();
            if (this.currentSpreadIndex >= this.totalSpreads) {
                this.currentSpreadIndex = Math.max(0, this.totalSpreads - 1);
            }
            this.renderCurrentSpread();
        }
    }

    renderCurrentSpread() {
        if (!this.epubEngine || this.totalSpreads === 0) return;

        const spread = this.epubEngine.getSpread(this.currentSpreadIndex);
        if (!spread) return;

        const pageNumLeft = (this.currentSpreadIndex * 2) + 1;
        const pageNumRight = pageNumLeft + 1;
        const totalPages = this.totalSpreads * 2;

        this.leftHeader.textContent = spread.leftPage.chapterTitle || this.epubEngine.metadata.title || '';
        this.leftContent.innerHTML = spread.leftPage.html || '';
        this.leftFooter.textContent = `${pageNumLeft} / ${totalPages}`;

        this.rightHeader.textContent = spread.rightPage.chapterTitle || this.epubEngine.metadata.title || '';
        this.rightContent.innerHTML = spread.rightPage.html || '';
        this.rightFooter.textContent = spread.rightPage.html ? `${pageNumRight} / ${totalPages}` : '';
    }

    /**
     * Advances to next 2-page spread with 3D Page Curl animation
     */
    nextSpread() {
        if (this.isAnimating || this.currentSpreadIndex >= this.totalSpreads - 1) {
            return false;
        }

        const nextIndex = this.currentSpreadIndex + 1;
        this.animatePageCurl('next', () => {
            this.currentSpreadIndex = nextIndex;
            this.renderCurrentSpread();
        });
        return true;
    }

    /**
     * Goes back to previous 2-page spread with reverse 3D Page Curl animation
     */
    previousSpread() {
        if (this.isAnimating || this.currentSpreadIndex <= 0) {
            return false;
        }

        const prevIndex = this.currentSpreadIndex - 1;
        this.animatePageCurl('prev', () => {
            this.currentSpreadIndex = prevIndex;
            this.renderCurrentSpread();
        });
        return true;
    }

    /**
     * Executes GPU-accelerated 3D Page Curl transition
     */
    animatePageCurl(direction, onComplete) {
        this.isAnimating = true;
        this.curlOverlay.style.display = 'block';

        const currentSpread = this.epubEngine.getSpread(this.currentSpreadIndex);

        if (direction === 'next') {
            // Turning right page over to left
            this.curlSheet.className = 'curl-sheet turning-next';
            this.curlFront.innerHTML = this.rightContent.innerHTML;
            this.curlBack.innerHTML = '';
        } else {
            // Turning left page over to right
            this.curlSheet.className = 'curl-sheet turning-prev';
            this.curlFront.innerHTML = this.leftContent.innerHTML;
            this.curlBack.innerHTML = '';
        }

        // Trigger CSS 3D transition
        requestAnimationFrame(() => {
            this.curlSheet.classList.add('animating');
        });

        setTimeout(() => {
            this.curlSheet.classList.remove('animating');
            this.curlOverlay.style.display = 'none';
            this.isAnimating = false;
            if (onComplete) onComplete();
        }, this.animationDuration);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = FlipbookEngine;
}
