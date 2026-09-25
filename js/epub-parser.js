/**
 * EPUB Parser and Dual-Page Paginator
 * Unpacks EPUB zip in memory, extracts spine chapters, normalizes XHTML and
 * computes static dual-page spreads (two virtual columns: 960x1080 px each in 16:9).
 */

// Simple lightweight ZIP reader for EPUB in-memory extraction
class SimpleZipReader {
    constructor(arrayBuffer) {
        this.buffer = new Uint8Array(arrayBuffer);
        this.view = new DataView(arrayBuffer);
        this.files = new Map();
    }

    async readEntries() {
        let offset = 0;
        const len = this.buffer.length;

        while (offset < len - 4) {
            const sig = this.view.getUint32(offset, true);
            if (sig === 0x04034b50) { // Local file header signature
                const compMethod = this.view.getUint16(offset + 8, true);
                const compressedSize = this.view.getUint32(offset + 18, true);
                const uncompressedSize = this.view.getUint32(offset + 22, true);
                const fileNameLen = this.view.getUint16(offset + 26, true);
                const extraFieldLen = this.view.getUint16(offset + 28, true);

                const fileNameBytes = this.buffer.subarray(offset + 30, offset + 30 + fileNameLen);
                const fileName = new TextDecoder('utf-8').decode(fileNameBytes);

                const dataStart = offset + 30 + fileNameLen + extraFieldLen;
                const compressedData = this.buffer.subarray(dataStart, dataStart + compressedSize);

                this.files.set(fileName, {
                    method: compMethod,
                    compressedSize,
                    uncompressedSize,
                    data: compressedData
                });

                offset = dataStart + compressedSize;
            } else if (sig === 0x02014b50) { // Central directory
                break;
            } else {
                offset++;
            }
        }
    }

    async getFileAsText(path) {
        // Clean leading slash
        const cleanPath = path.replace(/^\//, '');
        let entry = this.files.get(cleanPath);
        if (!entry) {
            // Try case-insensitive / normalized lookup
            for (let [key, val] of this.files.entries()) {
                if (key.toLowerCase() === cleanPath.toLowerCase()) {
                    entry = val;
                    break;
                }
            }
        }
        if (!entry) return null;

        let rawBytes = entry.data;
        if (entry.method === 8) { // DEFLATE
            if (typeof DecompressionStream !== 'undefined') {
                const ds = new DecompressionStream('deflate-raw');
                const writer = ds.writable.getWriter();
                writer.write(rawBytes);
                writer.close();
                const response = new Response(ds.readable);
                const decompressed = await response.arrayBuffer();
                return new TextDecoder('utf-8').decode(decompressed);
            } else if (typeof pako !== 'undefined') {
                return pako.inflateRaw(rawBytes, { to: 'string' });
            }
        }
        return new TextDecoder('utf-8').decode(rawBytes);
    }
}

class EpubEngine {
    constructor() {
        this.zip = null;
        this.metadata = {};
        this.spine = [];
        this.manifest = new Map();
        this.chapters = [];
        this.spreads = [];
        this.pageWidth = 960;  // Half of 1920
        this.pageHeight = 1080;
    }

    /**
     * Loads and parses an EPUB ArrayBuffer
     */
    async load(arrayBuffer) {
        this.zip = new SimpleZipReader(arrayBuffer);
        await this.zip.readEntries();

        // 1. Locate rootfile from META-INF/container.xml
        const containerXml = await this.zip.getFileAsText('META-INF/container.xml');
        if (!containerXml) {
            throw new Error('EPUB inválido: No se encontró META-INF/container.xml');
        }

        const parser = new DOMParser();
        const containerDoc = parser.parseFromString(containerXml, 'application/xml');
        const rootfileNode = containerDoc.querySelector('rootfile');
        if (!rootfileNode) {
            throw new Error('EPUB inválido: Falta elemento rootfile en container.xml');
        }

        const opfPath = rootfileNode.getAttribute('full-path');
        const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : '';

        // 2. Parse OPF file
        const opfText = await this.zip.getFileAsText(opfPath);
        if (!opfText) {
            throw new Error(`No se pudo leer el archivo OPF en: ${opfPath}`);
        }

        const opfDoc = parser.parseFromString(opfText, 'application/xml');
        
        // Metadata
        this.metadata = {
            title: opfDoc.querySelector('metadata > title, metadata > dc\\:title')?.textContent || 'Libro sin título',
            creator: opfDoc.querySelector('metadata > creator, metadata > dc\\:creator')?.textContent || 'Autor desconocido',
            language: opfDoc.querySelector('metadata > language, metadata > dc\\:language')?.textContent || 'es'
        };

        // Manifest
        this.manifest.clear();
        const itemNodes = opfDoc.querySelectorAll('manifest > item');
        itemNodes.forEach(item => {
            const id = item.getAttribute('id');
            const href = item.getAttribute('href');
            const mediaType = item.getAttribute('media-type');
            this.manifest.set(id, {
                href: opfDir + href,
                mediaType: mediaType
            });
        });

        // Spine
        this.spine = [];
        const itemrefNodes = opfDoc.querySelectorAll('spine > itemref');
        itemrefNodes.forEach(itemref => {
            const idref = itemref.getAttribute('idref');
            const item = this.manifest.get(idref);
            if (item) {
                this.spine.push(item);
            }
        });

        // 3. Extract and sanitize chapter contents
        this.chapters = [];
        for (let spineItem of this.spine) {
            const rawContent = await this.zip.getFileAsText(spineItem.href);
            if (rawContent) {
                const cleanedHtml = this.sanitizeChapterHtml(rawContent);
                this.chapters.push({
                    id: spineItem.href,
                    html: cleanedHtml
                });
            }
        }

        return this.metadata;
    }

    /**
     * Cleans chapter XHTML removing fixed layout inline styles and scripts
     */
    sanitizeChapterHtml(xhtmlString) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xhtmlString, 'text/html');

        // Remove scripts, styles, objects
        doc.querySelectorAll('script, style, link[rel="stylesheet"], iframe, object').forEach(el => el.remove());

        // Remove absolute positions and fixed font sizes from inline style
        doc.querySelectorAll('*').forEach(el => {
            el.removeAttribute('style');
            el.removeAttribute('width');
            el.removeAttribute('height');
        });

        const body = doc.body;
        return body ? body.innerHTML : xhtmlString;
    }

    /**
     * Splits extracted chapters into two-column spreads for 1920x1080 projector resolution
     */
    paginate(fontSize = 24, theme = 'parchment') {
        const spreads = [];
        
        // Approximate character budget per 960x1080 page based on font size and line height
        // Column width ~ 800px printable, height ~ 900px printable
        const charsPerPage = Math.max(300, Math.floor(18000 / fontSize));

        let currentSpread = {
            leftPage: { html: '', chapterTitle: '' },
            rightPage: { html: '', chapterTitle: '' },
            spreadIndex: 0
        };

        let isLeft = true;

        for (let chapterIndex = 0; chapterIndex < this.chapters.length; chapterIndex++) {
            const chapter = this.chapters[chapterIndex];
            const div = document.createElement('div');
            div.innerHTML = chapter.html;

            // Split by paragraphs / headings
            const blocks = div.children.length > 0 ? Array.from(div.children) : [div];

            let pageBuffer = '';
            let currentLen = 0;

            for (let block of blocks) {
                const blockHtml = block.outerHTML;
                const textLen = block.textContent.length;

                if (currentLen + textLen > charsPerPage && pageBuffer.length > 0) {
                    if (isLeft) {
                        currentSpread.leftPage = {
                            html: pageBuffer,
                            chapterTitle: `Capítulo ${chapterIndex + 1}`
                        };
                        isLeft = false;
                    } else {
                        currentSpread.rightPage = {
                            html: pageBuffer,
                            chapterTitle: `Capítulo ${chapterIndex + 1}`
                        };
                        currentSpread.spreadIndex = spreads.length;
                        spreads.push(currentSpread);

                        currentSpread = {
                            leftPage: { html: '', chapterTitle: '' },
                            rightPage: { html: '', chapterTitle: '' },
                            spreadIndex: spreads.length
                        };
                        isLeft = true;
                    }

                    pageBuffer = blockHtml;
                    currentLen = textLen;
                } else {
                    pageBuffer += blockHtml;
                    currentLen += textLen;
                }
            }

            // Flush remaining page for chapter
            if (pageBuffer.length > 0) {
                if (isLeft) {
                    currentSpread.leftPage = {
                        html: pageBuffer,
                        chapterTitle: `Capítulo ${chapterIndex + 1}`
                    };
                    isLeft = false;
                } else {
                    currentSpread.rightPage = {
                        html: pageBuffer,
                        chapterTitle: `Capítulo ${chapterIndex + 1}`
                    };
                    currentSpread.spreadIndex = spreads.length;
                    spreads.push(currentSpread);

                    currentSpread = {
                        leftPage: { html: '', chapterTitle: '' },
                        rightPage: { html: '', chapterTitle: '' },
                        spreadIndex: spreads.length
                    };
                    isLeft = true;
                }
            }
        }

        // Push last unclosed spread
        if (!isLeft || currentSpread.leftPage.html.length > 0) {
            currentSpread.spreadIndex = spreads.length;
            spreads.push(currentSpread);
        }

        this.spreads = spreads;
        return this.spreads;
    }

    getSpread(index) {
        if (index < 0 || index >= this.spreads.length) return null;
        return this.spreads[index];
    }

    getTotalSpreads() {
        return this.spreads.length;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { EpubEngine, SimpleZipReader };
}
