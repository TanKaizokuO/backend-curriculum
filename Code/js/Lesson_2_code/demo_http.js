const http = require('http');

// This function is the callback contract
const app = (req, res) => {
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    
    console.log(req.method, parsedUrl.pathname);
    
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`You asked: ${req.method} ${parsedUrl.pathname}\n`);
};

const server = http.createServer(app);
server.listen(9000, () => console.log('http listener up on http://127.0.0.1:9000'));