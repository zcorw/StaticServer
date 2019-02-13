const http = require("http");
const path = require("path");
const url = require("url");
const fs = require("fs");
const mime = require("mime");
const zlib = require("zlib");
const template = require("./template.js");
module.exports = class Server {
    constructor(option) {
        this.option = option;
    }
    start() {
        const server = http.createServer();
        server.on("request", this.request.bind(this));
        server.listen(this.option.port, () => {
            console.log("server started");
        })
    }
    async request(req, res) {
        const pathname = decodeURI(req.url);
        const filepath = path.join(this.option.root, pathname);
        if (pathname == '/favicon.ico') return;
        try {
            const statObj = await fs.statSync(filepath);
            statObj.isDirectory() ? this.sendList(req, res, filepath, pathname) : this.sendFile(req, res, filepath, statObj);
        } catch (e) {
            console.error(e)
            this.sendError(req, res);
        }
    }
    sendError(req, res) {
        res.statusCode = 500;
        res.end(`there is something wrong in the server! please try later!`);
    }
    sendFile(req, res, filepath, statObj) {
        res.setHeader('Content-type', mime.getType(filepath));
        let encoding = this.getEncoding(req, res);
        const rs = this.getStream(req, res, filepath, statObj);
        encoding ? rs.pipe(encoding).pipe(res) : rs.pipe(res);
    }
    sendList(req, res, filepath, pathname) {
        const fileList = fs.readdirSync(filepath);
        const dirTitle = path.basename(filepath);
        const html = template(fs.readFileSync("list.html", 'utf-8'), {title: dirTitle, path: pathname, host: this.option.hostname + ":" + this.option.port, list: fileList.map((name) => ({title: name}))})
        res.setHeader('Content-Type', 'text/html');
        res.end(html);
    }
    getStream(req, res, filepath, statObj) {
        let start = 0;
        // let end = statObj.size - 1;
        let end = statObj.size - 1;
        let range = req.headers['range'];
        if (range) {
            let result = range.match(/bytes=(\d*)-(\d*)/); //不可能有小数，网络传输的最小单位为一个字节
            if (result) {
                start = isNaN(result[1]) || result[1] === '' ? 0 : parseInt(result[1]);
                // end = isNaN(result[2])?end:parseInt(result[2]) - 1;
                end = isNaN(result[2]) || result[2] === '' ? end : parseInt(result[2]);
            }

        }
        res.setHeader('Accept-Range', 'bytes');
        res.setHeader('Content-Range', `bytes ${start}-${end}/${statObj.size}`);
        res.setHeader('Content-Length', end - start + 1);
        res.statusCode = 206; //返回整个数据的一块
        return fs.createReadStream(filepath, {
            start: start, end: end
        });
    }
    getEncoding(req, res) {
        let acceptEncoding = req.headers['accept-encoding'];
        if (/\bgzip\b/.test(acceptEncoding)) {
            res.setHeader('Content-Encoding', 'gzip');
            return zlib.createGzip();
        } else if (/\bdeflate\b/.test(acceptEncoding)) {
            res.setHeader('Content-Encoding', 'deflate');
            return zlib.createDeflate();
        } else {
            return null;
        }
    }
}