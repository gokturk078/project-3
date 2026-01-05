const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3000;
const DB_PATH = path.join(__dirname, 'data', 'db.json');

const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
    // Enable CORS for development flexibility
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // API Endpoint: Save DB
    if (pathname === '/api/save' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            try {
                const data = JSON.parse(body);

                // Add metadata about update
                if (!data.meta) data.meta = {};
                data.meta.lastUpdated = new Date().toISOString();

                // Write to file (pretty print)
                fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));

                console.log(`[Database] Updated at ${new Date().toLocaleTimeString()}`);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: 'Database updated successfully' }));
            } catch (err) {
                console.error('[Error] Failed to save DB:', err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: err.message }));
            }
        });
        return;
    }

    // Static File Serving
    let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);

    const extname = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[extname] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                // 404
                fs.readFile(path.join(__dirname, 'index.html'), (err2, content2) => {
                    // SPA Fallback? No, just 404 for assets
                    if (extname) {
                        res.writeHead(404);
                        res.end(`File not found: ${pathname}`);
                    } else {
                        // Maybe SPA routing fallback? But client uses hash routing.
                        res.writeHead(404);
                        res.end('404 Not Found');
                    }
                });
            } else {
                // 500
                res.writeHead(500);
                res.end(`Server Error: ${err.code}`);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log(`
🚀 Server running at http://localhost:${PORT}/
📝 Persistence API enabled at http://localhost:${PORT}/api/save
📂 Serving static files from ${__dirname}
    `);
});
