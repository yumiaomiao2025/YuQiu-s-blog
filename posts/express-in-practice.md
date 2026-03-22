---
title: Express 实战避坑：从 next() 到 res.end() 的控制流精讲
date: 2026-03-22
category: 后端
tags: [Express, Node.js, 中间件, 最佳实践]
readTime: 15 min
slug: express-in-practice
excerpt: 理解了 Express 的三层架构之后，实战中如何正确驾驭 next()、return 和 res.end()？本文用代码拆解最常见的控制流陷阱，给出可直接复用的最佳实践范式。
---

## 一、前言：从架构到实战

在[上一篇文章](/blog/express-architecture)中，我们通过手写 mini-express 还原了 Express 的核心架构——Router、Route、Layer 三层模型与中间件管道机制。核心结论可以概括为三句话：

- **`app` 本身就是一个函数**，传给 `http.createServer` 作为回调
- **Router 维护一个有序的 Layer 数组**（stack），请求依次遍历匹配
- **`next()` 是驱动管道流转的唯一动力**，不调用就停，传入 `err` 就跳到错误中间件

架构理解了，代码该怎么写？实际开发中，Express 最容易踩坑的地方不在路由注册，而在**控制流**——`next()` 该不该调用？`return` 应该放在哪里？`res.end()` 到底终止了什么？

本文就围绕这些问题展开，将草稿中的 9 个实战问题系统化整理，给出可以直接复用的模式和范式。

## 二、next() 与 return：Express 的双轨控制流

### 2.1 两个世界的控制权

Express 回调函数中存在两套控制流，分属不同层面：

| 控制手段 | 所属层面 | 作用 |
|----------|----------|------|
| `return` | JavaScript 语言层 | 终止**当前函数**的执行，后续代码不再运行 |
| `next()` | Express 框架层 | 将控制权交给 Router stack 中的**下一个 Layer** |

理解它们的区别至关重要：**`next()` 不是 `return`**。调用 `next()` 之后，当前函数并没有结束，`next()` 后面的代码依然会执行——因为 `next()` 只是把一个新的函数调用压入了调用栈，当前回调函数本身仍然在栈上。

### 2.2 三种经典错误

**错误一：既不 next 也不响应**

```js
app.use((req, res, next) => {
  console.log('hello')
  // 没有 next()，也没有 res.end()
})
```

请求到达这里后石沉大海——pipeline 停了，HTTP 响应也没发出去。客户端会一直 loading，直到超时。对服务端来说，这个连接一直被占用，高并发场景下会迅速耗尽可用连接数。

**错误二：next() 之后继续执行逻辑**

```js
app.use((req, res, next) => {
  next()
  console.log('我还在执行')  // next() 后面的代码照样跑
})
```

`next()` 把控制权交给了下一个中间件，但当前函数并没有 `return`，所以 `console.log` 依然会执行。如果这里不只是打日志，而是修改了 `req` 或 `res` 上的数据、发起了异步操作，就会和后续中间件产生竞态——经典的"左右脑互搏"。

**错误三：响应之后还 next()**

```js
app.get('/', (req, res, next) => {
  res.end('ok')
  next()  // 响应已发出，pipeline 还在继续
})
```

`res.end()` 已经把 HTTP 响应发给了客户端，但 `next()` 又把控制权交给了下一个 Layer。如果后续 Layer 试图再次写入响应，Node.js 会抛出 `ERR_HTTP_HEADERS_SENT` 错误。

### 2.3 三种正确模式

**模式一：纯中间件——处理后传递**

```js
app.use((req, res, next) => {
  req.startTime = Date.now()
  return next()
})
```

`return next()` 是最安全的写法。`next()` 把控制权交出去，`return` 确保当前函数不再执行后续代码。这等价于先调用 `next()` 再 `return`，但写成一行更简洁，也更不容易遗漏。

**模式二：终止型路由——响应后结束**

```js
app.get('/', (req, res) => {
  return res.end('ok')
})
```

路由 handler 是请求链路的终点，职责就是发送响应。不需要 `next`，参数列表里甚至不用写它。`return res.end()` 确保响应发出后函数立即结束。

**模式三：条件分支——根据情况决定**

```js
app.use((req, res, next) => {
  if (!req.headers.authorization) {
    return res.status(401).end('Unauthorized')
  }
  return next()
})
```

每个分支都有明确的出口：要么响应（`res.end`），要么传递（`next()`），并且都用 `return` 保证不会"穿透"到下面的逻辑。

### 2.4 一条原则

每个回调函数的每个分支，都必须做出且只做出两个决定：

1. **框架层面**：这个请求是**继续**（`next()`）还是**结束**（`res.end` / `res.send`）？
2. **函数层面**：决定做完之后，`return`。

记住这条原则，Express 中 80% 的控制流 bug 都不会出现。

## 三、res.end() 的真相：HTTP 层 vs Express 层

### 3.1 一个常见的误解

很多开发者以为 `res.end()` 能"结束 pipeline"。事实并非如此——**`res.end()` 结束的是 HTTP 响应，不是 Express 的中间件管道**。

Express 的 pipeline 是纯粹的 JavaScript 函数调用链，它的流转完全取决于你有没有调用 `next()`。`res.end()` 属于 Node.js 原生 `http` 模块，它的职责是告诉底层的 TCP 连接："响应数据发完了，可以关闭（或复用）了。"

```
Express pipeline 的控制权：next() / 不 next()
HTTP 响应的控制权：     res.end() / res.send()
```

两者是独立的。pipeline 停下来，是因为你**没有调用 `next()`**，而不是因为你调用了 `res.end()`。

### 3.2 res.end() 在底层做了什么

当你调用 `res.end('ok')` 时，Node.js 底层经历了这样的过程：

1. `res`（`http.ServerResponse`）将响应头和响应体写入底层的 socket
2. Node.js 的 C++/libuv 层将数据通过 TCP 发出
3. 浏览器收到完整的 HTTP 响应：

```
HTTP/1.1 200 OK
Content-Length: 2

ok
```

4. 连接进入 keep-alive 等待复用，或直接关闭

从客户端的角度，这就是一次成功的请求-响应周期。

### 3.3 res.send() 是 res.end() 的增强

`res.send()` 是 Express 对 `res.end()` 的封装，额外做了这些事：

- **自动设置 `Content-Type`**：传入字符串设为 `text/html`，传入对象/数组自动 `JSON.stringify` 并设为 `application/json`
- **自动设置 `Content-Length`**：根据响应体计算字节长度
- **处理 HEAD 请求**：只发响应头，不发响应体
- **设置 ETag**：用于缓存协商

最终，`res.send()` 内部还是调用了 `res.end()`。所有 Express 的响应方法（`res.json`、`res.redirect` 等）追根溯源都走向 `res.end()`。

### 3.4 中间件 next()，路由 res.end()——设计哲学

为什么中间件里推荐 `next()`，而路由里推荐 `res.end()` / `res.send()`？

**中间件是"过路者"**。它的职责是对请求做中间处理——记日志、解析 body、校验权限——然后把请求传递下去。即使出了错，也应该 `next(err)` 交给专门的错误中间件，而不是自己直接响应。

**路由是"终点站"**。它是请求链路的最后一环，职责就是生成响应并发送给客户端。不管是成功的数据、还是 404 Not Found、还是 403 Forbidden，都是有意义的响应信息。路由不应该 `next()` 继续传递（除了 `next(err)` 和 `next('route')` 这两种特殊情况）。

## 四、请求终止的标准范式

理解了 `next()`、`return`、`res.end()` 各自的职责后，我们可以给出一个路由 handler 的**标准写法**：

```js
app.get('/api/resource', (req, res, next) => {
  // 分支 1：鉴权失败
  if (!req.user) {
    return res.status(401).end('Unauthorized')
  }

  // 分支 2：业务异常
  if (somethingWrong) {
    return next(new Error('boom'))
  }

  // 分支 3：正常响应
  return res.json({ data: 'ok' })
})
```

三条原则：

1. **每个分支一个出口**：要么 `res.xxx()` 响应，要么 `next(err)` 抛错，不能两者都做
2. **响应之后不再操作**：`res.end()` / `res.send()` / `res.json()` 之后不应该再有任何逻辑
3. **`return` 一切**：每个出口语句都用 `return` 包裹，避免穿透到后续逻辑

不要写出这样的代码：

```js
// 反面教材
app.get('/', (req, res, next) => {
  res.send('ok')
  // 忘记 return，下面的代码还会执行
  doSomethingElse()  // 可能引发二次响应或其他副作用
})
```

## 五、响应之后的事：finish 事件与后置处理

### 5.1 HTTP 的一次性约束

HTTP/1.1 是**一问一答**的协议：一次请求对应一次响应。`res.end()` 调用之后，响应就已经发出了，你不能再发第二次。如果需要"重试"，只能由客户端发起新的请求。

那如果我想在响应完成后做一些事——比如记录响应日志、统计请求耗时、上报监控数据——该怎么办？

### 5.2 res.on('finish') 模式

答案是利用 Node.js 原生的事件机制。`res`（`http.ServerResponse`）是一个 `Writable Stream`，它会在响应完全发送后触发 `finish` 事件。关键在于：**事件监听器要在 `res.end()` 之前注册**。

最佳实践是将这个逻辑写成一个前置中间件：

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
  })

  next()
})
```

这个中间件注册在所有路由之前。每个请求进来时，它在 `res` 上挂一个 `finish` 事件监听器，然后 `next()` 放行。无论后续哪个路由最终调用了 `res.end()`，`finish` 事件都会触发，回调中就能拿到完整的响应信息。

这是一个经典的**回调前置注册**模式——在事件发生之前注册监听器，事件发生时自动执行。Express 生态中的 `morgan` 日志中间件就是用类似的方式实现的。

### 5.3 finish vs close

`res` 上有两个相关的事件，含义不同：

| 事件 | 触发时机 | 典型场景 |
|------|----------|----------|
| `finish` | 响应数据已**全部交给操作系统缓冲区**，即将发出 | 记录日志、统计耗时 |
| `close` | 底层连接**关闭**（可能是正常关闭，也可能是异常断开） | 清理资源、检测客户端断开 |

正常请求的事件顺序是 `finish` → `close`。如果客户端在响应发完之前断开了连接，则只会触发 `close`，不会触发 `finish`。因此，做日志和监控通常监听 `finish`，做资源清理和异常检测则监听 `close`。

## 六、中间件与路由的匹配差异：前缀 vs 精确

### 6.1 两种匹配策略

在上一篇文章中，我们的 mini-express 对所有 Layer 都使用了前缀匹配（`startsWith`）。但真实的 Express 对中间件和路由采用了**不同的匹配策略**：

| 注册方式 | 匹配策略 | `/api` 是否匹配 `/api/users` |
|----------|----------|------|
| `app.use('/api', fn)` | **前缀匹配** | 是 |
| `app.get('/api', fn)` | **精确匹配** | 否 |

换句话说：

- **`app.use()`** 注册的中间件使用前缀匹配，`/api` 会命中 `/api`、`/api/users`、`/api/posts/123` 等所有以 `/api` 开头的路径
- **`app.get()` / `app.post()` / `app.all()`** 注册的路由使用精确匹配（或参数匹配），`/api` 只命中 `/api`，不会命中 `/api/users`

### 6.2 为什么这样设计

这种差异不是随意的，而是由中间件和路由的**语义角色**决定的：

**中间件是过滤器**。一个挂在 `/api` 下的鉴权中间件，当然应该对 `/api` 下的所有子路径生效。前缀匹配正好符合这个语义——"所有经过 `/api` 这道门的请求，都要先过安检"。

**路由是终点**。`app.get('/api')` 表示"我只处理 `GET /api` 这一个请求"。如果它也匹配 `/api/users`，那路由表就乱了。精确匹配保证了路由的确定性——每个请求只会命中它该命中的路由。

### 6.3 注册顺序建议

由于 Router stack 是按注册顺序遍历的，所以：

```js
// 中间件：宽泛的放前面
app.use('/api', authMiddleware)       // 所有 /api/* 都要鉴权

// 路由：精确路径在参数路径之前
app.get('/api/users/me', getMe)       // 先匹配精确路径
app.get('/api/users/:id', getUser)    // 再匹配参数路径
```

如果把 `/api/users/:id` 放在 `/api/users/me` 前面，那么 `GET /api/users/me` 会被 `:id = 'me'` 捕获，永远走不到 `getMe` 处理函数。

## 七、进阶路由控制：app.all() 与 next('route')

### 7.1 app.all() 的实现方式

`app.all()` 匹配指定路径上的**所有 HTTP 方法**。一个常见的误解是它会为每个 HTTP 方法都注册一遍 handler——实际上并非如此。

Express 内部的做法是在 Route 的 stack 中注册一个 method 为特殊标记的 Layer。dispatch 时的判断逻辑是：

```js
if (layer.method === method || layer.method === '_all') {
  layer.handler(req, res, next)
}
```

所以 `app.all('/health', handler)` 只注册了一个 Layer，而不是 GET、POST、PUT、DELETE... 各注册一遍。这在性能上是合理的——如果你有 30 多个 HTTP 方法都注册一遍，stack 会膨胀得很厉害。

`app.all()` 的典型用途是**对某个路径做统一预处理**：

```js
app.all('/api/*', (req, res, next) => {
  res.set('X-Powered-By', 'MyApp')
  next()
})
```

### 7.2 next('route')：跳过当前 Route

`next()` 的参数除了 `Error` 对象之外，还有两个硬编码的特殊字符串关键字：`'route'` 和 `'router'`。

`next('route')` 的作用是：**跳过当前 Route 中剩余的所有 handler，直接跳到 Router stack 中的下一个匹配的 Route**。

这在同一个路径注册了多组 handler 时非常有用。看这个登录/游客分流的例子：

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

- 如果 `req.user` 存在：执行第一组的第二个 handler，返回"欢迎回来"
- 如果 `req.user` 不存在：`next('route')` 跳过第一组，进入第二个 `app.get('/dashboard')`，返回"请先登录"

这本质上是在路由层面实现了**策略模式**——同一个路径，不同条件走不同处理逻辑，代码组织比一堆 `if-else` 更清晰。

### 7.3 next('route') vs next(err) vs next()

| 调用方式 | 行为 |
|----------|------|
| `next()` | 执行当前 Route 中的下一个 handler（如果有）；没有则进入下一个 Layer |
| `next('route')` | 跳过当前 Route 的所有剩余 handler，进入 Router stack 中下一个匹配的 Layer |
| `next(err)` | 跳过所有后续普通中间件和路由，进入最近的错误中间件（4 参数） |

至于 `next('router')`，它用于从当前子路由器（`express.Router()`）中跳出，回到父路由器的控制流。这个特性留待后续讨论子路由器时再展开。

## 八、响应方法速查表

Express 为 `res` 扩展了多个响应方法，它们最终都调用了 Node.js 原生的 `res.end()`。如果路由 handler 没有调用其中任何一个方法，请求就会一直挂起——浏览器持续 loading、服务端连接数被占用、高并发时直接拖垮服务。

### 8.1 方法对比

| 方法 | 自动设置的 Header | 适用场景 |
|------|-------------------|----------|
| `res.send(body)` | `Content-Type`（自动判断）、`Content-Length`、`ETag` | 通用响应，最省心 |
| `res.json(obj)` | `Content-Type: application/json` | 返回 JSON 数据，自动 `JSON.stringify` |
| `res.redirect(url)` | `Location`、状态码 301/302 | 重定向 |
| `res.sendFile(path)` | `Content-Type`（按文件扩展名） | 发送文件，浏览器尝试预览 |
| `res.download(path)` | `Content-Type` + `Content-Disposition: attachment` | 发送文件，强制下载 |
| `res.render(view)` | `Content-Type: text/html` | 模板引擎渲染后发送 |
| `res.end(data)` | 无（需手动设置） | Node.js 原生方法，以上所有方法的底层实现 |

### 8.2 res.sendFile vs res.download

这两个方法经常被混淆，其实本质区别只有一个 HTTP 头——`Content-Disposition`：

```js
// sendFile：浏览器尝试预览
res.sendFile('/path/to/report.pdf')
// → Content-Type: application/pdf
// → 浏览器行为：能预览就预览（PDF、图片、txt），不能预览才下载
```

```js
// download：强制下载
res.download('/path/to/report.pdf')
// → Content-Type: application/pdf
// → Content-Disposition: attachment; filename="report.pdf"
// → 浏览器行为：弹出保存对话框，强制下载
```

`res.download()` 内部就是调用了 `res.sendFile()` 并额外设置了 `Content-Disposition: attachment`。用一句话概括：**`sendFile` 是展示，`download` 是拿走**。

## 九、总结

回顾全文，Express 实战中的控制流可以归结为几条核心原则：

**1. 每个回调只做一个决定**：继续（`next()`）或结束（`res.send()`），然后 `return`。

**2. `res.end()` 结束的是 HTTP，不是 pipeline**：pipeline 的流转由 `next()` 控制，两者独立。

**3. 中间件前缀匹配，路由精确匹配**：这是由它们各自的语义角色决定的。

**4. 响应后的处理走事件监听**：`res.on('finish', ...)` 而不是在 `res.end()` 之后写逻辑。

**5. `next()` 的参数决定去向**：无参数向下走、`Error` 对象跳到错误中间件、`'route'` 跳过当前 Route。

这些原则的本质，都来自于上一篇文章中剖析的那个架构——Router 按序遍历 Layer stack、`next()` 推动遍历前进、Route 做方法分发。理解了架构，实战中的"为什么"就有了答案；掌握了实战范式，写出来的 Express 代码就不会再出现请求挂起、二次响应、控制流混乱这些恼人的 bug。

---

*本文是 Express 深入系列的第二篇。上一篇讲架构，本篇讲控制流，后续计划讨论子路由器 `express.Router()`、参数路由与中间件组合等进阶话题。*
