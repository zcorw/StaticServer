# 带断点续传的静态服务器尝试

初次尝试用原生nodejs做一个静态服务器应用，简单的实现两个功能：  

1. 静态服务器基础功能;
2. 断点续传。

## 创建一个服务器

要创建一个Server，在nodejs上非常简单，nodejs已经为我们提供一个api：http.createServer([options][, requestListener])，只需下面一行

```
const server = http.createServer().listen(8080);  
//.listen(port)设置该Server要监听哪个端口
```

一个Server就创建成功.

## request请求处理
资源请求者通过url访问服务器资源，在本例中我们以url的pathname来表示文件路径，在与服务器本地的工作根目录地址拼接后获得服务器真实路径。在拿到真实路径后，我们就可以利用stat判断路径指向的是个文件还是文件夹。

* 如果请求的是文件，就需要用到流。HTTP响应对象也是一个可写流，所以我们只要有一个指向访问文件的可读流，就可以通过将两个流连接起来实现文件传输。

```
sendFile(response, filepath) {
	/* 其他代码 */
	const rs = fs.createReadStream(filepath); //filepath为文件真实路径
	rs.pipe(response);
})
```

* 如果请求的是文件夹，利用fs.readdirSync返回文件夹下列表，然后选择一个模板引擎，将获得的列表编译成一套页面，最后返回给用户。

```
sendFolder(response, filepath) {
	const fileList = fs.readdirSync(filepath);
	const html = template(fileList);
	response.setHeader('Content-Type', 'text/html');
	response.end(html);
})
```

## 断点续传
在http中，很多消息类型的传递都是通过消息头来实现，断点续传的实现自然也少不了对消息头的设置。

首先看看具体流程：

* 浏览器发起请求
* 服务器通过消息头告诉浏览器可以分片请求

```
response.setHeader('Accept-Ranges', 'bytes');
```

* 浏览器重新发起请求，用Range消息头告诉服务器需要的内容范围，具体结构：bytes= (开始)-(结束)。
   * 如果结束位置被去掉了，服务器会返回从声明的开始位置到整个内容的结束位置内容的最后一个可用字节。
   * 如果开始位置被去掉了，结束位置参数可以被描述成从最后一个可用的字节算起可以被服务器返回的字节数。
* 如果浏览器给出的内容范围是合理的，服务器返回的消息体为指定范围的内容。除此之外，还要带上 206 Partial Content 状态码，消息头上还要声明以下几个字段：
   * Content-Range，告知浏览器本次返回内容的范围，具体结构：bytes (开始)-(结束)/(总数)。
   * Content-Length，告知浏览器本次传输内容大小，这里只需返回传输内容字节数。（该字段如果不返回，我们在使用下载器（比如迅雷）下载时会认为该资源不支持续传功能）
* 如果浏览器给出的内容范围是错误的(例如，比内容的总字节数大)，服务器返回 416 Requested Range Not Satisfiable 状态码，可用的范围也会在 Content-Range 消息头中声明。

```
//读取请求中Range指定范围
getRange(request, statObj) {
	const result = request.headers['range'] ? request.headers['range'].match(/bytes=(\d*)-(\d*)/) : null;
	const start = result === null || isNaN(result[1]) || result[1] === '' ? 0 : parseInt(result[1]);
	const end = result === null || isNaN(result[2]) || result[2] === '' ? statObj.size - 1 : parseInt(result[2]);
	return {
		start,
		end,
		size: statObj.size
	}
}
//返回指定范围的Stream
getStream(response, start, end, size, filepath) {
	response.setHeader('Accept-Range', 'bytes');
	response.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
	response.setHeader('Content-Length', end - start + 1);
	response.statusCode = 206; //返回整个数据的一块
	return fs.createReadStream(filepath, {
    	start: start, end: end
	});
}
//指定范围错误
rangeError(response, start, end, size) {
	response.setHeader('Accept-Range', 'bytes');
	response.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
	response.statusCode = 416;
	response.end();
}
```





