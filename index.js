const Server = require("./server.js");
const server = new Server({ port: 8080, hostname: "127.0.0.1", root: __dirname });
server.start();