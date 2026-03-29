---
title: Express API 问答（二）：req 与 res
date: 2026-03-29
category: 后端
tags: [Express, Node.js, API]
readTime: 12 min
slug: express-api-part2
excerpt: 阅读 Express 官方 API 时顺带理清的一些问题；本篇覆盖请求与响应对象 `Request` 与 `Response` 相关接口。
---

## 前言

上篇梳理了 `express.*` 与 `Application`。本文是系列第二篇，主要谈谈请求与响应对象（`Request`、`Response`）的部分问题。


---


### Q1：`req.cookies` 是什么？是怎么来的？

**A：** 浏览器发请求时，会把 cookie 放在请求头里：

```
Cookie: token=abc123; theme=dark; uid=42
```

Node.js 原生能拿到的是 `req.headers.cookie`，是一整个字符串 `"token=abc123; theme=dark; uid=42"`。

`req.cookies` 是 `cookie-parser` 中间件解析之后的产物：

```js
const cookieParser = require('cookie-parser')
app.use(cookieParser())

// 解析后
req.cookies  // { token: 'abc123', theme: 'dark', uid: '42' }
```

注意 `req.cookies` 和 `req.signedCookies` 是两个对象：普通 cookie 在 `req.cookies`，用 `signed: true` 设置的签名 cookie 在 `req.signedCookies`（验签通过才会出现，验签失败是 `false`）。


---


### Q2：`req.path`、`req.baseUrl`、`req.originalUrl` 怎么区分？

**A：** 一个例子说明一切：

```js
const app = express()
const r1 = express.Router()
const r2 = express.Router()

app.use('/a', r1)
r1.use('/b', r2)

r2.get('/c', (req, res) => {
  console.log('baseUrl:',     req.baseUrl)      // /a/b
  console.log('path:',        req.path)         // /c
  console.log('originalUrl:', req.originalUrl)  // /a/b/c
})
```

请求 `GET /a/b/c`，结果：

| 属性 | 值 | 含义 |
|------|----|------|
| `req.originalUrl` | `/a/b/c` | 完整原始 URL，永远不变 |
| `req.baseUrl` | `/a/b` | 已匹配的挂载路径，逐层累加 |
| `req.path` | `/c` | 当前 router 看到的剩余路径 |

关系：`req.originalUrl === req.baseUrl + req.path`

每经过一层 router，`baseUrl` 追加当前挂载路径，`path` 变为剩下的部分，`originalUrl` 始终是最开始的完整路径。


---


### Q3：`res.append` 和 `res.set` 有什么区别？

**A：** 一个覆盖，一个追加。

```js
res.set('X-Custom', 'a')
res.set('X-Custom', 'b')
// 结果：X-Custom: b（后者覆盖前者）

res.append('Set-Cookie', 'a=1')
res.append('Set-Cookie', 'b=2')
// 结果：
// Set-Cookie: a=1
// Set-Cookie: b=2（两行都保留）
```

90% 的情况用 `res.set()`，简单明确。`res.append()` 的典型场景是 `Set-Cookie`——HTTP 允许多个 `Set-Cookie` 响应头同时存在，用 `res.set()` 只会留下最后一个。


---


### Q4：`res.download`、`res.attachment`、`res.sendFile` 是什么关系？

**A：** 三者都和文件下载有关，层级不同：

- `res.attachment(filename)` 只做一件事：设置响应头 `Content-Disposition: attachment; filename="xxx"`，告诉浏览器这是一个要下载的文件，但不发送文件内容。
- `res.sendFile(path)` 读取文件内容并发送，但不设置下载头，浏览器可能直接渲染（比如图片、PDF）。
- `res.download(path, filename)` = `res.attachment(filename)` + `res.sendFile(path)`，既设置下载头，又发送内容，是最常用的文件下载 API。

```js
// 只设置下载头，不发内容（少用）
res.attachment('report.pdf')

// 发内容，但浏览器可能直接打开
res.sendFile('/files/report.pdf')

// 完整下载：设置头 + 发内容
res.download('/files/report.pdf', '月度报告.pdf')
```


---


### Q5：`res.cookie` 有哪些常用参数？

**A：** 第三个参数 `options` 是重点，它决定了 cookie 的行为和安全性。

```js
res.cookie('token', 'abc123', { /* options */ })
```

**`httpOnly`（必须了解）**

```js
res.cookie('token', 'abc', { httpOnly: true })
```

JS 无法通过 `document.cookie` 访问该 cookie，防止 XSS 攻击偷走登录态。登录 token 基本必开。

**`secure`（生产必备）**

```js
res.cookie('token', 'abc', { secure: true })
```

只在 HTTPS 下发送，HTTP 不携带。不开的话 cookie 在网络上明文传输。

**`sameSite`（现在很重要）**

```js
res.cookie('token', 'abc', { sameSite: 'lax' })
```

控制跨站请求是否携带 cookie，防 CSRF：

| 值 | 行为 |
|----|------|
| `'strict'` | 跨站完全不带 |
| `'lax'` | 顶层导航（点链接、GET 表单）带，其他跨站不带（默认值） |
| `'none'` | 跨站都带，但必须同时设 `secure: true` |

**`maxAge` / `expires`**

```js
res.cookie('token', 'abc', { maxAge: 1000 * 60 * 60 * 24 * 7 })  // 7 天，毫秒
res.cookie('token', 'abc', { expires: new Date(Date.now() + 3600000) })  // 具体时间点
```

`maxAge` 更现代，优先用它。不设置这两个就是 Session cookie，关浏览器即失效。

**`signed`（防篡改）**

```js
app.use(cookieParser('my-secret'))
res.cookie('token', 'abc', { signed: true })

// 读取时用 req.signedCookies，而不是 req.cookies
```

签名 cookie 会把值加上 HMAC 签名，服务端验签，客户端无法篡改。注意 `signed` 不等于加密，值还是明文，只是防篡改。

**一个完整的生产配置：**

```js
res.cookie('token', 'abc123', {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  maxAge: 1000 * 60 * 60 * 24 * 7  // 7 天
})
```

常见翻车：忘记 `httpOnly` 导致 XSS 能读走 token；`sameSite: 'none'` 没加 `secure` 导致浏览器直接忽略 cookie；`domain` 写错导致 cookie 根本不生效。


---


### Q6：`res.end` 和 `res.send` 有什么区别？

**A：** `res.end()` 是 Node.js 原生方法，直接结束响应，不做任何处理。`res.send()` 是 Express 封装的，在发出响应之前帮你做了几件事：

- 自动识别数据类型，设置 `Content-Type`
- 自动序列化对象为 JSON
- 设置 `Content-Length`

```js
res.send('hello')         // Content-Type: text/html
res.send({ name: '秋' }) // Content-Type: application/json，自动 JSON.stringify
res.send(Buffer.from('x')) // application/octet-stream
```

`res.send()` 不会自动识别"请求是否失败"——状态码要自己设：

另外，HTTP 状态码 ≠ 业务状态码

- HTTP：协议层（成功/失败）
- JSON：业务层（你自己定义）

你写个
```js
res.send({ code: 500, msg: '失败' })
```
只是业务状态码是500，实际http状态码还是200

所以，一般是团队约定，有

```jsx
res.status(200).json({
  code: 0,
  data: {},
  msg: 'ok'
})

res.status(200).json({
  code: 500,
  msg: '失败'
})
```

两种风格，前者是完全依赖后端设置http状态码，后者是依靠前端识别业务状态码

---


### Q7：`res.redirect` 做了什么？

**A：** 发一个带 `Location` 响应头的 302 响应，告诉客户端去请求新地址。

```js
res.redirect('/login')

// 等价于：
res.status(302)
res.set('Location', '/login')
res.end()
```

客户端收到：

```
HTTP/1.1 302 Found
Location: /login
```

但是否自动跳转取决于谁发的请求：

- **浏览器主线程请求**（地址栏输入、点 `<a>` 标签、表单提交）：收到 302 自动发起新请求，用户能看到页面跳转。
- **JS 发的请求**（`axios`、`fetch`）：只是拿到响应头，不会自动跳转，需要自己读 `Location` 再处理。

```js
// axios 不会自动跳转，你拿到的是 302 的响应
const res = await axios.get('/api/protected')
if (res.status === 302) {
  window.location.href = res.headers.location
}
```

所以 API 接口如果想让前端跳转，直接返回 JSON 告诉前端去哪更可靠，而不是依赖 302。


---


### Q8：`res.vary` 有什么用？

**A：** 告诉代理缓存（CDN、Nginx）：**同一个 URL，根据哪个请求头的不同，要存不同的缓存版本**。

比如你的接口同时支持 JSON 和 XML，根据客户端的 `Accept` 头来决定格式：

```js
app.get('/data', (req, res) => {
  res.vary('Accept')

  if (req.headers.accept.includes('application/xml')) {
    res.type('xml').send('<data/>')
  } else {
    res.json({ data: true })
  }
})
```

不设 `res.vary('Accept')`，CDN 可能把第一个请求的响应（比如 JSON）缓存下来，之后所有请求都返回 JSON，即使客户端明确要 XML。

常见场景：
- `Accept`：内容格式协商
- `Accept-Encoding`：压缩格式（gzip / br）
- `Accept-Language`：多语言
- `Origin`：CORS

日常接口开发接触不多，但涉及缓存、CDN、内容协商时，忘了 `res.vary` 会踩很深的坑。

---

*本文是 Express 系列的第六篇，覆盖 `req` 和 `res` 层 API。至此 Express 的架构、控制流、路由、手写实现、API 全部走了一遍。*
