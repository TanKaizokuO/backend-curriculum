const net = require('net');

// Open a TCP socket to example.com on port 80 (HTTP)
const client = net.createConnection({ host: 'example.com', port: 80 }, () => {
    console.log('Connected to server!');
    
    // Write the HTTP request string. Lines must end with \r\n
    client.write(
        'GET / HTTP/1.1\r\n' +
        'Host: example.com\r\n' +
        'Connection: close\r\n' +
        '\r\n'
    );
});

// Listen for bytes returning from the socket
client.on('data', (data) => {
    // data is a Buffer; toString() decodes it as UTF-8
    console.log(data.toString());
});

client.on('end', () => {
    console.log('Connection closed by server.');
});