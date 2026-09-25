/**
 * Local Server & Calibre-Web Proxy for Projector Flipbook Reader
 * Serves static assets, provides local mock OPDS feeds, and proxies remote Calibre-Web requests.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'src');

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.epub': 'application/epub+zip',
    '.xml': 'application/atom+xml; charset=utf-8'
};

// Mock OPDS Atom XML Feed for standalone testing
const MOCK_OPDS_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opds="http://opds-spec.org/2010/catalog">
  <id>urn:calibre-web:feed:books</id>
  <title>Biblioteca Calibre-Web (Mock Local)</title>
  <updated>2026-09-24T20:00:00Z</updated>
  <author>
    <name>Calibre-Web TV Server</name>
  </author>
  
  <entry>
    <title>Don Quijote de la Mancha</title>
    <id>urn:book:1</id>
    <updated>2026-09-24T20:00:00Z</updated>
    <author><name>Miguel de Cervantes</name></author>
    <summary>En un lugar de la Mancha, de cuyo nombre no quiero acordarme, no ha mucho tiempo que vivía un hidalgo...</summary>
    <link rel="http://opds-spec.org/image/thumbnail" type="image/jpeg" href="https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=350&amp;q=80" />
    <link rel="http://opds-spec.org/acquisition" type="application/epub+zip" href="/mock/quijote.epub" />
  </entry>

  <entry>
    <title>La Metamorfosis</title>
    <id>urn:book:2</id>
    <updated>2026-09-24T20:00:00Z</updated>
    <author><name>Franz Kafka</name></author>
    <summary>Una mañana, tras un sueño intranquilo, Gregorio Samsa se despertó convertido en un monstruoso insecto.</summary>
    <link rel="http://opds-spec.org/image/thumbnail" type="image/jpeg" href="https://images.unsplash.com/photo-1512820790803-83ca734da794?w=350&amp;q=80" />
    <link rel="http://opds-spec.org/acquisition" type="application/epub+zip" href="/mock/metamorfosis.epub" />
  </entry>

  <entry>
    <title>El Principito</title>
    <id>urn:book:3</id>
    <updated>2026-09-24T20:00:00Z</updated>
    <author><name>Antoine de Saint-Exupéry</name></author>
    <summary>Pido perdón a los niños por haber dedicado este libro a una persona grande.</summary>
    <link rel="http://opds-spec.org/image/thumbnail" type="image/jpeg" href="https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=350&amp;q=80" />
    <link rel="http://opds-spec.org/acquisition" type="application/epub+zip" href="/mock/principito.epub" />
  </entry>

  <entry>
    <title>Cien Años de Soledad</title>
    <id>urn:book:4</id>
    <updated>2026-09-24T20:00:00Z</updated>
    <author><name>Gabriel García Márquez</name></author>
    <summary>Muchos años después, frente al pelotón de fusilamiento, el coronel Aureliano Buendía había de recordar aquella tarde remota...</summary>
    <link rel="http://opds-spec.org/image/thumbnail" type="image/jpeg" href="https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=350&amp;q=80" />
    <link rel="http://opds-spec.org/acquisition" type="application/epub+zip" href="/mock/soledad.epub" />
  </entry>

  <entry>
    <title>El Arte de la Guerra</title>
    <id>urn:book:5</id>
    <updated>2026-09-24T20:00:00Z</updated>
    <author><name>Sun Tzu</name></author>
    <summary>El arte de la guerra se basa en el engaño. Por lo tanto, cuando seamos capaces de atacar, debemos parecer incapaces...</summary>
    <link rel="http://opds-spec.org/image/thumbnail" type="image/jpeg" href="https://images.unsplash.com/photo-1495640388908-05fa85288e61?w=350&amp;q=80" />
    <link rel="http://opds-spec.org/acquisition" type="application/epub+zip" href="/mock/guerra.epub" />
  </entry>
</feed>`;

const server = http.createServer((req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // Endpoint: Mock OPDS Feed
    if (pathname === '/opds' || pathname === '/opds/books') {
        res.writeHead(200, { 'Content-Type': 'application/atom+xml; charset=utf-8' });
        res.end(MOCK_OPDS_FEED);
        return;
    }

    // Static File Serving
    let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
    if (safePath === '/' || safePath === '\\') {
        safePath = '/index.html';
    }

    const filePath = path.join(PUBLIC_DIR, safePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('404 Not Found');
            } else {
                res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end(`500 Server Error: ${err.code}`);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
});

server.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🎬 Projector Flipbook Reader corriendo en:`);
    console.log(`👉 http://localhost:${PORT}`);
    console.log(`📡 Mock OPDS Feed activo en: http://localhost:${PORT}/opds`);
    console.log(`======================================================\n`);
});
