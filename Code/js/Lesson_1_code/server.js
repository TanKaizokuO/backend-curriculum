const net = require('net');

const server = net.createServer((socket) => {
    console.log('Client connected from:', socket.remoteAddress, socket.remotePort);

    // Triggered when the client writes bytes to the socket
    socket.on('data', (data) => {
        console.log('--- RECEIVED REQUEST ---');
        console.log(data.toString());

        // Construct a valid HTTP/1.1 response
        const body = 'Hello, JS world!\n';
        const response =
            'HTTP/1.1 200 OK\r\n' +
            'Content-Type: text/plain; charset=utf-8\r\n' +
            `Content-Length: ${Buffer.byteLength(body)}\r\n` +
            'Connection: close\r\n' +
            '\r\n' +
            body;

        // Write bytes back to the socket and close it
        socket.write(response, () => {
            socket.end();
        });
    });
});

server.listen(8080, '127.0.0.1', () => {
    console.log('Listening on http://127.0.0.1:8080');
});