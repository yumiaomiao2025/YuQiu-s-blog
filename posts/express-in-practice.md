---
title: Express 实战九问九答：从 next() 到 res.end() 的控制流精讲
date: 2026-03-22
category: 后端
tags: [Express, Node.js, 中间件, 最佳实践]
readTime: 15 min
slug: express-in-practice
excerpt: 理解了 Express 的三层架构之后，实战中最容易踩哪些坑？本文以九问九答的形式，逐一拆解 next()、return、res.end() 的控制流陷阱与最佳实践。
---

## 前言

在[上一篇文章](/blog/express-architecture)中，我们通过手写 mini-express 还原了 Express 的核心架构——Router、Route、Layer 三层模型与 `next()` 驱动的中间件管道。架构理解了，代码该怎么写？

实际开发中，Express 最容易踩坑的地方不在路由注册，而在**控制流**——`next()` 该不该调、`return` 应该放在哪、`res.end()` 到底终止了什么。本文以九问九答的形式，把这些实战中最高频的疑惑逐一拆解。

---

### Q1：是不是不能在回调函数里随便写 next 和 return？

**A：** 是的。`return` 和 `next()` 分属两个不同的控制层面，不能混用乱写。

| 控制手段 | 所属层面 | 作用 |
|----------|----------|------|
| `return` | JavaScript 语言层 | 终止**当前函数**的执行，后续代码不再运行 |
| `next()` | Express 框架层 | 将控制权交给 Router stack 中的**下一个 Layer** |

关键认知：**`next()` 不等于 `return`**。调用 `next()` 后，当前函数并没有结束——`next()` 只是在调用栈上新压入了一个函数，当前回调仍然在栈上，`next()` 后面的代码**照样会执行**。

实战中最常见的三种错误写法：

**错误一：既不 next 也不响应——请求石沉大海**

```js
app.use((req, res, next) => {
  console.log('hello')
  // 没有 next()，也没有 res.end()
})
```

pipeline 停了，HTTP 响应也没发出去。客户端一直 loading 直到超时，服务端连接被白白占用，高并发下直接拖垮服务。

**错误二：next() 之后还有逻辑——左右脑互搏**

```js
app.use((req, res, next) => {
  next()
  console.log('我还在执行')
})
```

`next()` 把控制权交给了下一个中间件，但当前函数没有 `return`，后续代码继续跑。如果这里不是 `console.log` 而是异步操作或数据修改，就会和后续中间件形成竞态，产生诡异 bug。

**错误三：res.end 之后还 next()——二次响应炸弹**

```js
app.get('/', (req, res, next) => {
  res.end('ok')
  next()
})
```

HTTP 响应已经发出去了，`next()` 又让 pipeline 继续。后续中间件如果再尝试写响应，Node.js 直接抛 `ERR_HTTP_HEADERS_SENT`。

**安全的写法只有三种**：

```js
// 模式一：纯中间件——处理后传递
app.use((req, res, next) => {
  req.startTime = Date.now()
  return next()
})

// 模式二：终止型路由——响应后结束
app.get('/', (req, res) => {
  return res.end('ok')
})

// 模式三：条件分支——每个分支都有明确出口
app.use((req, res, next) => {
  if (!req.headers.authorization) {
    return res.status(401).end('Unauthorized')
  }
  return next()
})
```

说白了，良好的书写习惯就两条：

1. **框架层面做决定**：这个分支是**继续**（`next()`）还是**结束**（`res.end` / `res.send`）？
2. **函数层面收尾**：决定做完之后，`return`。

---

### Q2：res.end() 或 res.send() 背后调用了什么？它们真的能"结束 pipeline"吗？

**A：** `res.end()` 结束的是 HTTP 响应，**不是** Express 的中间件管道。pipeline 停下来，是因为你没有调用 `next()`。

Express 本质上是一条 JavaScript 函数调用链，它的流转完全取决于有没有调用 `next()`。而 `res.end()` 属于 Node.js 原生 `http` 模块，它的职责是告诉底层 TCP 连接："响应数据发完了，可以关闭（或 keep-alive 复用）了。"

```
Express pipeline 的控制权：next() / 不 next()
HTTP 响应的控制权：     res.end() / res.send()
```

两者是**独立**的。

当你调用 `res.end('ok')` 时，Node.js 底层经历了这些事：

1. `res`（`http.ServerResponse`）将响应头和响应体写入底层 socket
2. C++/libuv 层将数据通过 TCP 发出
3. 浏览器收到完整的 HTTP 响应：

```
HTTP/1.1 200 OK
Content-Length: 2

ok
```

4. 连接进入 keep-alive 等待复用，或直接关闭

从客户端的角度，这就是一次成功的请求-响应周期。

`res.send()` 则是 Express 对 `res.end()` 的封装，额外做了这些贴心操作：

- **自动设置 `Content-Type`**：字符串 → `text/html`，对象/数组 → 自动 `JSON.stringify` 后设为 `application/json`
- **自动设置 `Content-Length`**：根据响应体计算字节长度
- **处理 HEAD 请求**：只发响应头，不发响应体
- **设置 ETag**：用于缓存协商

最终，`res.send()` 内部还是调用了 `res.end()`。Express 的所有响应方法（`res.json`、`res.redirect` 等）追根溯源都走向 `res.end()`。

那为什么中间件里推荐 `next()`，而路由里推荐 `res.end()` / `res.send()`？因为角色不同：

- **中间件是过路者**——它的职责是中间处理（记日志、解析 body、校验权限），然后传递下去。即使出了错，也应该 `next(err)` 交给错误中间件，而不是自己直接响应。
- **路由是终点站**——它是请求链路的最后一环，职责就是生成并发送响应。不管是 200 OK、404 Not Found 还是 403 Forbidden，都是有意义的响应信息，不能让请求搁置着不了了之。

---

### Q3：如何正确地结束一个请求？有没有标准范式？

**A：** 路由 handler 就应该直接 `res.end()` / `res.send()` 或者 `next(err)`，然后 `return`。不要多次响应，响应之后不应该再有操作。

标准写法：

```js
app.get('/api/resource', (req, res, next) => {
  if (!req.user) {
    return res.status(401).end('Unauthorized')
  }

  if (somethingWrong) {
    return next(new Error('boom'))
  }

  return res.json({ data: 'ok' })
})
```

三条原则：

1. **每个分支一个出口**：要么 `res.xxx()` 响应，要么 `next(err)` 抛错，不能两者都做
2. **响应之后不再操作**：`res.end()` / `res.send()` / `res.json()` 之后不应该再有任何逻辑
3. **`return` 一切**：每个出口语句都用 `return` 包裹，避免穿透到后续代码

反面教材：

```js
app.get('/', (req, res, next) => {
  res.send('ok')
  doSomethingElse()  // 忘记 return，这行还会执行
})
```

---

### Q4：如果我想在响应成功后记录日志、统计耗时怎么办？

**A：** HTTP 是一次性通信——一次请求一次响应，`res.end()` 之后不能再响应第二次。如果需要"重试"，只能由客户端发起新请求。

但**响应之后的处理**是完全可以做的，关键是不要在 Express 的 pipeline 里做，而是利用 Node.js 原生 `http` 模块的事件机制。`res`（`http.ServerResponse`）是一个 `Writable Stream`，它会在响应完成后触发 `finish` 事件。

做法很简单——在 `res.end()` 被调用之前，提前注册事件监听器。这是一个经典的**回调前置注册**模式：

```js
app.use((req, res, next) => {
  const start = Date.now()

  res.on('finish', () => {
    const duration = Date.now() - start
    console.log({
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`
    })
    // 写日志 / 打点 / 上报监控
  })

  next()
})
```

这个中间件注册在所有路由之前。每个请求进来时，它在 `res` 上挂一个 `finish` 事件监听器，然后 `next()` 放行。无论后续哪个路由最终调用了 `res.end()`，`finish` 事件都会触发。Express 生态中的 `morgan` 日志中间件就是用类似的方式实现的。

`res` 上还有一个相关事件 `close`，两者的区别：

| 事件 | 触发时机 | 典型场景 |
|------|----------|----------|
| `finish` | 响应数据已**全部交给操作系统缓冲区** | 记录日志、统计耗时 |
| `close` | 底层连接**关闭**（正常关闭或异常断开） | 清理资源、检测客户端断开 |

正常请求的事件顺序是 `finish` → `close`。如果客户端在响应发完之前断开了连接，则只会触发 `close`，不会触发 `finish`。

---

### Q5：app.all() 是怎样的一种存在？

**A：** `app.all()` **不是**把所有 HTTP 方法都注册一遍，而是注册一个特殊标记的 Layer。

很多人以为 `app.all('/health', handler)` 会在内部为 GET、POST、PUT、DELETE... 各注册一次 handler——那 HTTP 方法有 30 多种，stack 岂不是要爆炸？

实际上，Express 只注册一个 Layer，在 Route 的 dispatch 阶段做判断：

```js
if (layer.method === method || layer.method === '_all') {
  layer.handler(req, res, next)
}
```

所以回到上一篇 mini-express 中的 `Route.prototype.dispatch`，更准确的写法应该是：

```js
const matched = this.stack.find(
  layer => layer.method === method || layer.method === 'ALL'
)
```

`app.all()` 的典型用途是对某个路径做统一的前置处理：

```js
app.all('/api/*', (req, res, next) => {
  res.set('X-Request-Id', generateId())
  next()
})
```

---

### Q6：/a 和 /a/b 哪个应该写在前面？中间件和路由的匹配规则一样吗？

**A：** 不一样。**中间件是前缀匹配，路由是精确匹配**。

| 注册方式 | 匹配策略 | `/api` 是否匹配 `/api/users` |
|----------|----------|------|
| `app.use('/api', fn)` | **前缀匹配** | 是 |
| `app.get('/api', fn)` | **精确匹配** | 否 |

`app.use()` 注册的中间件，只要请求路径的前缀匹配就会执行——`/api` 会命中 `/api`、`/api/users`、`/api/posts/123`。而 `app.get()` / `app.post()` / `app.all()` 注册的路由，必须路径完全匹配（或参数匹配），`/api` 不会命中 `/api/users`。

这种差异是由它们的**语义角色**决定的：

- **中间件是过滤器**。挂在 `/api` 下的鉴权中间件，当然应该对 `/api` 下的所有子路径生效——"所有经过 `/api` 这道门的请求，都要先过安检"。
- **路由是终点**。`app.get('/api')` 表示"我只处理 `GET /api` 这一个请求"。精确匹配保证了路由的确定性。

所以中间件层面你不需要担心 `/a` 和 `/a/b` 的顺序问题——前缀匹配上了都会执行，而且中间件不做终结响应。但路由层面要注意**精确路径在参数路径之前**：

```js
app.use('/api', authMiddleware)         // 中间件，前缀匹配，所有 /api/* 过安检

app.get('/api/users/me', getMe)         // 精确路径在前
app.get('/api/users/:id', getUser)      // 参数路径在后
```

如果顺序反了，`GET /api/users/me` 会被 `:id = 'me'` 捕获，永远走不到 `getMe`。

---

### Q7：next('route') 是什么操作？

**A：** `next()` 传入的参数通常是 `Error` 对象，会跳到错误中间件。但有两个硬编码的特殊字符串关键字——`'route'` 和 `'router'`——行为完全不同。

`next('route')` 的作用是：**跳过当前 Route 中剩余的所有 handler，直接进入 Router stack 中下一个匹配的 Route**。

来看一个登录/游客分流的实战场景：

```js
app.get('/dashboard',
  (req, res, next) => {
    if (!req.user) {
      return next('route')  // 没登录，跳过这组 handler
    }
    next()
  },
  (req, res) => {
    res.send(`欢迎回来，${req.user.name}`)
  }
)

app.get('/dashboard', (req, res) => {
  res.send('请先登录')
})
```

请求 `GET /dashboard` 时：

- `req.user` 存在 → 执行第一组的第二个 handler → 返回"欢迎回来"
- `req.user` 不存在 → `next('route')` 跳过第一组 → 进入第二个 `app.get('/dashboard')` → 返回"请先登录"

这本质上是在路由层面实现了**策略模式**——同一个路径，不同条件走不同处理逻辑，比一堆 `if-else` 更清晰。

三种 `next` 调用方式的对比：

| 调用方式 | 行为 |
|----------|------|
| `next()` | 执行当前 Route 中的下一个 handler；没有则进入下一个 Layer |
| `next('route')` | 跳过当前 Route 的所有剩余 handler，进入 Router stack 中下一个匹配的 Layer |
| `next(err)` | 跳过所有后续普通中间件和路由，进入最近的错误中间件（4 参数） |

至于 `next('router')`，它用于从当前子路由器（`express.Router()`）中跳出，回到父路由器的控制流。等后面讨论 Express 子路由器时再展开。

---

### Q8：有哪些 res 的方法可以终止请求/响应循环？如果都不调用会怎样？

**A：** 如果路由 handler 没有调用任何响应方法，请求就会一直挂起。后果很严重：

- 浏览器一直 loading
- Node.js 连接数被占满
- 高并发场景直接把服务拖死
- 用户以为你网站"卡了"

Express 常用的响应方法有 7 个，它们最终都调用了 Node.js 原生的 `res.end()`：

| 方法 | 特点 | 适用场景 |
|------|------|----------|
| `res.send(body)` | 自动判断 `Content-Type`、设置 `Content-Length`、`ETag` | 通用响应，最省心 |
| `res.json(obj)` | 自动设置 `Content-Type: application/json`，自动 `JSON.stringify` | 返回 JSON 数据 |
| `res.redirect(url)` | 自动设置 `Location` 头和 301/302 状态码 | 重定向 |
| `res.sendFile(path)` | 按文件扩展名设置 `Content-Type` | 发送文件，浏览器尝试预览 |
| `res.download(path)` | 同上 + 设置 `Content-Disposition: attachment` | 发送文件，强制下载 |
| `res.render(view)` | 模板引擎渲染后设置 `Content-Type: text/html` | 服务端渲染页面 |
| `res.end(data)` | 不做任何贴心操作，需手动设置所有 Header | Node.js 原生，以上所有方法的底层实现 |

记住：路由 handler 的职责就是**做出响应**。不管是成功的数据、还是 404、401、500，都是有意义的信息。不能让请求石沉大海。

---

### Q9：res.download 和 res.sendFile 的区别是什么？

**A：** 本质区别只有一个 HTTP 头——`Content-Disposition`。

`res.sendFile` 发送文件，浏览器收到后自己决定怎么处理：

```js
res.sendFile('/path/to/report.pdf')
```

```
Content-Type: application/pdf
（没有 Content-Disposition）

浏览器行为：能预览就预览（PDF、图片、txt），不能预览才下载
```

`res.download` 也发送文件，但强制浏览器下载：

```js
res.download('/path/to/report.pdf')
```

```
Content-Type: application/pdf
Content-Disposition: attachment; filename="report.pdf"

浏览器行为：弹出保存对话框，强制下载
```

其实 `res.download` 内部就是调用了 `res.sendFile`，只是额外加了一行：

```js
res.set('Content-Disposition', `attachment; filename="${filename}"`)
```

一句话概括：**`sendFile` 是"展示"，`download` 是"拿走"**。

---

## 写在最后

九个问题贯穿了 Express 日常开发中最高频的控制流困惑，核心要点可以浓缩为五条原则：

1. **每个回调只做一个决定**：继续（`next()`）或结束（`res.send()`），然后 `return`
2. **`res.end()` 结束的是 HTTP，不是 pipeline**：pipeline 的流转由 `next()` 控制，两者独立
3. **中间件前缀匹配，路由精确匹配**：由它们各自的语义角色决定
4. **响应后的处理走事件监听**：`res.on('finish', ...)` 而非在 `res.end()` 之后写逻辑
5. **`next()` 的参数决定去向**：无参数向下走、`Error` 跳到错误中间件、`'route'` 跳过当前 Route

这些原则的本质，都来自于上一篇文章中剖析的那个架构——Router 按序遍历 Layer stack、`next()` 推动遍历前进、Route 做方法分发。理解了架构，实战中的"为什么"就有了答案；掌握了这些范式，写出来的 Express 代码就不会再出现请求挂起、二次响应、控制流混乱这些恼人的 bug。

---

*本文是 Express 深入系列的第二篇。上一篇讲架构，本篇讲控制流，后续计划讨论子路由器 `express.Router()`、参数路由与中间件组合等进阶话题。*
