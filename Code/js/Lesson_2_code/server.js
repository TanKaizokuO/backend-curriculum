const net = require('net');

function parseRequestLine(raw) {
    const firstLine = raw.toString('ascii').split('\r\n')[0];
    const parts = firstLine.split(' ');
    if (parts.length !== 3) throw new Error('Malformed');
    return { method: parts[0], target: parts[1], version: parts[2] };
}

function parseHeaders(raw) {
    const requestStr = raw.toString('ascii');
    const parts = requestStr.split('\r\n\r\n');
    const headerLines = parts[0].split('\r\n').slice(1);
    const headers = {};
    for (const line of headerLines) {
        const colon = line.indexOf(':');
        if (colon === -1) continue;
        headers[line.slice(0, colon).trim().toLowerCase()] = line.slice(colon + 1).trim();
    }
    return headers;
}

const ROUTES = {
    'GET /': () => ({ status: 200, type: 'text/plain', body: 'Welcome.\n' }),
    'GET /hello': (req) => {
        const name = req.query.name || 'stranger';
        return { status: 200, type: 'text/plain', body: `Hello, ${name}!\n` };
    }
};

const PHRASES = { 200: 'OK', 400: 'Bad Request', 404: 'Not Found', 405: 'Method Not Allowed' };

function buildResponse(status, contentType, body, extraHeaders = []) {
    const phrase = PHRASES[status] || 'Unknown';
    const headers = [
        `HTTP/1.1 ${status} ${phrase}`,
        `Content-Type: ${contentType}; charset=utf-8`,
        `Content-Length: ${Buffer.byteLength(body)}`,
        'Connection: close',
        ...extraHeaders,
        '', ''
    ];
    return Buffer.concat([Buffer.from(headers.join('\r\n'), 'ascii'), Buffer.from(body, 'utf-8')]);
}

const server = net.createServer((socket) => {
    socket.on('data', (raw) => {
        try {
            const { method, target } = parseRequestLine(raw);
            const urlObj = new URL(target, 'http://localhost');
            const path = urlObj.pathname;
            
            const query = {};
            for (const [k, v] of urlObj.searchParams) query[k] = v;

            const headers = parseHeaders(raw);
            const reqKey = `${method} ${path}`;

            if (ROUTES[reqKey]) {
                const res = ROUTES[reqKey]({ query, headers });
                socket.write(buildResponse(res.status, res.type, res.body), () => socket.end());
            } else {
                // Check if path exists under another method
                const allowed = Object.keys(ROUTES)
                    .filter(k => k.split(' ')[1] === path)
                    .map(k => k.split(' ')[0]);

                if (allowed.length > 0) {
                    socket.write(buildResponse(405, 'text/plain', 'Method Not Allowed\n', [
                        `Allow: ${allowed.join(', ')}`
                    ]), () => socket.end());
                } else {
                    socket.write(buildResponse(404, 'text/plain', 'Not Found\n'), () => socket.end());
                }
            }
        } catch (err) {
            socket.write(buildResponse(400, 'text/plain', 'Bad Request\n'), () => socket.end());
        }
    });
});

server.listen(8080, '127.0.0.1', () => console.log('Listening on http://127.0.0.1:8080'));