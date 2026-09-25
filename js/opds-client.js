/**
 * OPDS Client for Calibre-Web
 * Parses Atom XML OPDS feeds, handles Basic Auth and cover image downsampling.
 */
class OPDSClient {
    constructor() {
        this.maxCoverWidth = 350; // PRD: Máx. 350 px de ancho para evitar errores OOM en Fire OS
    }

    /**
     * Resolves relative URL with base server URL
     */
    resolveUrl(relativeUrl, baseUrl) {
        if (!relativeUrl) return '';
        if (relativeUrl.startsWith('http://') || relativeUrl.startsWith('https://') || relativeUrl.startsWith('data:')) {
            return relativeUrl;
        }
        const base = (baseUrl || AppConfig.getServerUrl()).replace(/\/+$/, '');
        const path = relativeUrl.startsWith('/') ? relativeUrl : `/${relativeUrl}`;
        return `${base}${path}`;
    }

    /**
     * Creates headers with Basic Auth if configured
     */
    getHeaders() {
        const headers = {
            'Accept': 'application/atom+xml,application/xml,text/xml,*/*'
        };
        const auth = AppConfig.getAuthHeader();
        if (auth) {
            headers['Authorization'] = auth;
        }
        return headers;
    }

    /**
     * Tests connection to Calibre-Web OPDS endpoint
     */
    async testConnection(serverUrl, username, password) {
        const url = this.resolveUrl('/opds', serverUrl);
        const headers = { 'Accept': 'application/atom+xml,application/xml,text/xml,*/*' };
        if (username || password) {
            const encoded = btoa(unescape(encodeURIComponent(`${username}:${password}`)));
            headers['Authorization'] = `Basic ${encoded}`;
        }

        try {
            const response = await fetch(url, { method: 'GET', headers });
            if (response.status === 401) {
                return { success: false, error: 'Credenciales inválidas (401 Unauthorized)' };
            }
            if (!response.ok) {
                return { success: false, error: `Error del servidor: HTTP ${response.status}` };
            }
            const xmlText = await response.text();
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, 'application/xml');
            if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
                return { success: false, error: 'La respuesta no es un feed OPDS XML válido' };
            }
            return { success: true, message: 'Conexión exitosa con Calibre-Web' };
        } catch (err) {
            return { success: false, error: `Fallo de conexión: ${err.message}` };
        }
    }

    /**
     * Fetches and parses OPDS catalog entries
     */
    async fetchCatalog(feedPath = '/opds/books') {
        const serverUrl = AppConfig.getServerUrl();
        const url = this.resolveUrl(feedPath, serverUrl);

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: this.getHeaders()
            });

            if (!response.ok) {
                // Fallback to /opds if /opds/books returns 404
                if (response.status === 404 && feedPath !== '/opds') {
                    return this.fetchCatalog('/opds');
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const xmlText = await response.text();
            return this.parseOpdsFeed(xmlText, serverUrl);
        } catch (error) {
            console.error('Error fetching OPDS feed:', error);
            throw error;
        }
    }

    /**
     * Parses raw OPDS XML string into structured Book objects
     */
    parseOpdsFeed(xmlString, baseUrl) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, 'application/xml');
        const entries = xmlDoc.getElementsByTagName('entry');
        const books = [];

        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            
            const idNode = entry.getElementsByTagName('id')[0];
            const titleNode = entry.getElementsByTagName('title')[0];
            const summaryNode = entry.getElementsByTagName('summary')[0] || entry.getElementsByTagName('content')[0];
            
            // Extract author
            let author = 'Autor desconocido';
            const authorNode = entry.getElementsByTagName('author')[0];
            if (authorNode) {
                const nameNode = authorNode.getElementsByTagName('name')[0];
                if (nameNode) author = nameNode.textContent.trim();
            }

            // Extract links (cover, thumbnail, epub)
            const links = entry.getElementsByTagName('link');
            let coverUrl = null;
            let thumbnailUrl = null;
            let epubUrl = null;
            let navSubFeedUrl = null;

            for (let j = 0; j < links.length; j++) {
                const link = links[j];
                const rel = link.getAttribute('rel') || '';
                const type = link.getAttribute('type') || '';
                const href = link.getAttribute('href') || '';

                if (rel.includes('image') || rel.includes('cover') || type.startsWith('image/')) {
                    if (rel.includes('thumbnail')) {
                        thumbnailUrl = this.resolveUrl(href, baseUrl);
                    } else {
                        coverUrl = this.resolveUrl(href, baseUrl);
                    }
                }

                if (type.includes('epub') || href.endsWith('.epub') || rel.includes('acquisition')) {
                    epubUrl = this.resolveUrl(href, baseUrl);
                }

                // If entry is a navigation catalog rather than a book
                if (type.includes('atom+xml') && (rel.includes('subsection') || rel.includes('nav'))) {
                    navSubFeedUrl = this.resolveUrl(href, baseUrl);
                }
            }

            const title = titleNode ? titleNode.textContent.trim() : 'Sin título';
            const bookId = idNode ? idNode.textContent.trim() : `book_${i}_${encodeURIComponent(title)}`;
            const summary = summaryNode ? summaryNode.textContent.trim() : '';

            books.push({
                id: bookId,
                title: title,
                author: author,
                summary: summary,
                coverUrl: thumbnailUrl || coverUrl || null,
                originalCoverUrl: coverUrl || thumbnailUrl || null,
                epubUrl: epubUrl,
                navSubFeedUrl: navSubFeedUrl
            });
        }

        return {
            title: xmlDoc.getElementsByTagName('title')[0]?.textContent || 'Biblioteca Calibre-Web',
            books: books
        };
    }

    /**
     * Loads an image and downsamples it in an off-screen canvas to maximum width (350px)
     * Returns a lightweight blob URL or data URL to prevent OOM on Fire OS.
     */
    async loadDownsampledCover(imageUrl) {
        if (!imageUrl) return null;

        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';

            img.onload = () => {
                let width = img.width;
                let height = img.height;

                if (width > this.maxCoverWidth) {
                    height = Math.round((height * this.maxCoverWidth) / width);
                    width = this.maxCoverWidth;
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                // Clear memory
                canvas.width = 0;
                canvas.height = 0;
                resolve(dataUrl);
            };

            img.onerror = () => {
                // Return original or null on failure
                resolve(imageUrl);
            };

            img.src = imageUrl;
        });
    }

    /**
     * Downloads an EPUB file as an ArrayBuffer with progress callback
     */
    async downloadEpub(epubUrl, onProgress = null) {
        const response = await fetch(epubUrl, {
            method: 'GET',
            headers: this.getHeaders()
        });

        if (!response.ok) {
            throw new Error(`Fallo al descargar EPUB (HTTP ${response.status})`);
        }

        const contentLength = response.headers.get('content-length');
        const total = contentLength ? parseInt(contentLength, 10) : 0;
        
        if (!response.body || !onProgress || total === 0) {
            return await response.arrayBuffer();
        }

        const reader = response.body.getReader();
        let receivedLength = 0;
        const chunks = [];

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            receivedLength += value.length;
            if (onProgress && total > 0) {
                onProgress(Math.round((receivedLength / total) * 100));
            }
        }

        const allChunks = new Uint8Array(receivedLength);
        let position = 0;
        for (const chunk of chunks) {
            allChunks.set(chunk, position);
            position += chunk.length;
        }

        return allChunks.buffer;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = OPDSClient;
}
