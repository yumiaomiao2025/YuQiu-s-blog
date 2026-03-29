---
title: Express API 问答（一）：express 与 Application
date: 2026-03-29
category: 后端
tags: [Express, Node.js, API]
readTime: 12 min
slug: express-api-part1
excerpt: 阅读 Express 官方 API 时顺带理清的一些问题；本篇覆盖顶层 `express.*` 与 `Application` 相关接口。
---

## 前言

Express 对外暴露的接口大致可分成五层：`express.*`（应用工厂与内置中间件）、`Application`（应用实例）、`Request`（请求对象）、`Response`（响应对象），以及 `Router`（路由分发器）。本文为系列第一篇，只讨论前两层。

---


### Q1：`app.use(express.json())` 干了什么？为什么不用它就拿不到 `req.body`？

**A：** 因为 `req` 本质是一个可读流，HTTP body 不会自动解析成 JavaScript 对象。

前端发了这样一个请求：

```
POST /api/user
Content-Type: application/json

{"name":"秋秋","age":18}
```

如果不用任何中间件，要拿到 body 必须自己读流：

```js
let body = ''

req.on('data', chunk => {
  body += chunk
})

req.on('end', () => {
  const data = JSON.parse(body)  // 这才是对象
})
```

`express.json()` 做的就是这件事——收集流数据，得到文本字符串 `'{"name":"秋秋","age":18}'`，再 `JSON.parse` 成对象，挂到 `req.body` 上，然后调 `next()`。没有它，`req.body` 就是 `undefined`。

前后端的数据格式要靠 `Content-Type` 对齐，选错解析器不会报错，只是拿不到数据：

| 前端发送 | Content-Type | 后端解析中间件 |
|----------|--------------|----------------|
| JSON 字符串 | `application/json` | `express.json()` |
| 表单字符串 | `application/x-www-form-urlencoded` | `express.urlencoded()` |
| 文件 | `multipart/form-data` | `multer` 等 |

常用 options：

```js
app.use(express.json({
  limit: '1mb',              // 限制最大 body 大小
  strict: true,              // 只接受数组或对象，拒绝原始值
  type: 'application/json'   // 只处理这个 Content-Type
}))
```


---


### Q2：`express.urlencoded()` 处理的是什么数据？

**A：** 处理 `application/x-www-form-urlencoded` 格式的请求体——HTML 表单的默认提交格式。

```
POST /api
Content-Type: application/x-www-form-urlencoded

name=秋秋&age=18
```

看起来很像 URL 里的 query 参数，但不是同一个东西——query 参数在 URL 上，用 `req.query` 取；这个在 body 里，经 `express.urlencoded()` 解析后用 `req.body` 取。

```js
app.use(express.urlencoded({ extended: false }))

app.post('/api', (req, res) => {
  console.log(req.body)  // { name: '秋秋', age: '18' }
})
```

`extended: false` 用 Node 内置的 `querystring` 解析，`extended: true` 用 `qs` 库，支持嵌套对象。


---


### Q3：`express.raw()` 是用来干什么的？

**A：** 获取原始的二进制 Buffer，不做任何解析，专门用于需要"原始字节"的场景：

- 支付系统的签名校验（微信/支付宝会对原始 body 做 HMAC 验签）
- 第三方 Webhook 回调
- 接收二进制文件流

关键注意：**`express.json()` 不要全局挂**。原因是 HTTP body 作为流只能被消费一次——`express.json()` 读走了，`express.raw()` 就读不到了，反之亦然。

```js
// ❌ 错误：全局挂了 express.json()，支付回调就拿不到原始 body
app.use(express.json())

// ✅ 正确：只在需要 JSON 的路由用
app.use('/api', express.json())

// 支付回调单独用 raw
app.post('/pay/callback', express.raw({ type: '*/*' }), (req, res) => {
  const rawBody = req.body  // Buffer
  verifySignature(rawBody)
})
```


---


### Q4：`express.Router()` 有哪些选项？

**A：** 三个常用选项：

```js
const router = express.Router({
  caseSensitive: false,  // 路径大小写不敏感（默认 false）
  strict: false,         // 不严格匹配尾部 /，/user 和 /user/ 都能匹配（默认 false）
  mergeParams: true      // 能拿到父路由的 req.params（默认 false）
})
```

`mergeParams` 最容易被忽略，嵌套路由时经常用到：

```js
const app = express()
const userRouter = express.Router({ mergeParams: true })
const postRouter = express.Router({ mergeParams: true })

app.use('/users/:userId', userRouter)
userRouter.use('/:postId/posts', postRouter)

postRouter.get('/', (req, res) => {
  // mergeParams: true 才能同时拿到 userId 和 postId
  res.json(req.params)  // { userId: '1', postId: '42' }
})
```


---


### Q5：Express 官方建议用反向代理来处理静态资源，那 `express.static()` 存在的意义是什么？

**A：** 两者定位不同，`express.static()` 没有被取代，只是不适合作为生产方案。

Express 的定位是处理请求逻辑（路由 / 中间件 / API），不是高性能静态资源服务器。如果每次静态文件请求都走 Express，Node.js 要参与每一次 I/O，并发高时 CPU 和 I/O 被静态文件占满，真正该处理的 API 请求就慢了。

生产环境的常规做法：

```
方案一：Nginx 直接处理静态资源
浏览器 → Nginx → 文件（Express 根本不知道）

方案二：CDN
浏览器 → CDN →（缓存命中）→ 直接返回
               ↓（缓存未命中）
             源站（Nginx / OSS）
```

`express.static()` 的价值在于：
- **开发环境**：起一个服务直接跑，不需要配 Nginx
- **小项目 / 内网工具**：流量少，没必要引入额外基础设施
- **需要鉴权的文件**：权限逻辑在 Express 里，静态文件必须过中间件才能下发

```js
// 需要鉴权才能下载的文件——必须走 Express
app.use('/private', authMiddleware, express.static('./private-files'))
```


---


### Q6：`app.locals`、`app.mountpath`、`app.router` 分别是什么？

**A：**

**`app.locals`**：挂全局静态数据的地方，通常是配置类信息，模板引擎可以直接访问。不要放动态数据，动态数据用 `res.locals`。

```js
app.locals.siteName = '秋秋の小破站'
app.locals.config = {
  cdn: 'https://cdn.example.com',
  version: '1.0.0'
}

// 中间件里通过 req.app 拿到
app.use((req, res, next) => {
  const cdn = req.app.locals.config.cdn
  next()
})
```

**`app.mountpath`**：子应用挂载时的路径，要和 `req.path` / `req.baseUrl` 区分：

```js
app.use('/api', subApp)

subApp.get('/user', (req, res) => {
  console.log(req.path)          // /user    当前剩余路径
  console.log(req.baseUrl)       // /api     已匹配的挂载路径
  console.log(subApp.mountpath)  // /api     子应用的挂载点
})
```

**`app.router`**：即 `app._router`，Router 的实例。不建议直接操作它，现代做法是用 `express.Router()` 单独创建路由模块，再通过 `app.use()` 挂进去。


---


### Q7：`app.engine` 和 `app.set('view engine')` 做了什么？

**A：** 两行代码共同完成模板引擎的注册和默认后缀设置。

```js
app.engine('ejs', require('ejs').__express)
app.set('view engine', 'ejs')
```

`app.engine('ejs', fn)` 的意思是："当你看到 `.ejs` 文件时，用这个函数来渲染它"，本质是注册一个渲染函数。

`app.set('view engine', 'ejs')` 的意思是："默认后缀用 `.ejs`"，这样写 `res.render('index')` 时不用带后缀，Express 自动补全为 `index.ejs`。

模板引擎不同于中间件，它是"按需调用的工具"，只在遇到 `res.render()` 时才参与，找到对应文件、渲染完毕、发送响应。


---


### Q8：`app.listen(path)` 中的 `path` 是什么？有什么应用场景？

**A：** 这里的 `path` 是 Unix Domain Socket 路径，不是 URL 路径。

通常我们这样启动服务：

```js
app.listen(3000)  // 监听 TCP 端口
```

但 Node.js 底层的 `http.Server` 也支持监听 Unix socket 文件：

```js
app.listen('/tmp/my-app.sock')
```

应用场景：**同一台服务器上的两个进程互相通信**。比如 Nginx 做反向代理，把请求转发给 Node 应用，用 Unix socket 比 TCP（`localhost:3000`）更快——不需要走网络协议栈，直接通过文件描述符传递数据。

```nginx
Nginx 配置
upstream node_app {
  server unix:/tmp/my-app.sock;
}
```

对于普通 Web 应用，用 TCP 端口就够了，Unix socket 只在对延迟极度敏感或需要减少系统开销时才值得考虑。


---


### Q9：`app.set` 是什么？有什么用？

**A：** `app.set` 是 Express 的全局配置中心，用来控制框架行为，也可以存自定义配置。用 `app.get(key)` 读取（注意不是 HTTP GET，是配置读取）。

```js
// 框架行为配置
app.set('view engine', 'ejs')
app.set('views', './templates')
app.set('trust proxy', true)       // 信任反向代理，req.ip 才能拿到真实 IP

// 自定义配置
app.set('config', {
  cdn: 'https://cdn.example.com'
})

// 读取
app.get('/test', (req, res) => {
  const config = req.app.get('config')
  res.json(config)
})
```

`app.set` 和 `app.locals` 的区别：`app.locals` 只是一个普通对象，放什么都行；`app.set` 里有些 key 是 Express 内部会读取的（比如 `view engine`、`trust proxy`），放到这里才能生效。不要把 `app.set` 当全局变量用，配置类信息放这里，动态数据还是放 `res.locals`。

---

*本文是 Express 系列的第五篇，聚焦 `express.*` 内置中间件与 `app` 层 API。下一篇继续讲 `req` 和 `res`。*
