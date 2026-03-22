---
title: Mini-Express 完善版：把三篇文章的知识全部写进代码
date: 2026-03-22
category: 后端
tags: [Express, Node.js, 源码, 手写实现]
readTime: 18 min
slug: mini-express-enhanced
excerpt: 将前三篇文章讨论的所有核心机制——app.route()、子路由器、路径剥离、next('route')、next('router')、精确/前缀匹配、res.send()——逐一写进 mini-express，从基础版升级到完善版。
---

## 前言

在[第一篇](/blog/express-architecture)中，我们手写了一个基础版 mini-express，实现了 Router → Layer → Route 三层模型和中间件管道。但那个版本有很多简化：Route 只能单 handler、没有子路由器、不区分前缀/精确匹配、不支持 `next('route')`……

在[第二篇](/blog/express-in-practice)和[第三篇](/blog/express-router-deep-dive)中，我们深入讨论了控制流、子路由器、`app.route()`、边界行为等话题——但都停留在"原理讲解"层面，没有落地到代码。

本篇的目标：**把前三篇讨论过的所有核心机制，逐一写进 mini-express**。每个升级点都会标注"来自哪篇文章的哪个知识点"，让理论和实现一一对应。


---


## 一、基础版 vs 完善版

先看一眼升级前后的功能对比：

| 功能 | 基础版 | 完善版 | 知识来源 |
|------|--------|--------|----------|
| `app.get(path, fn)` 单 handler | ✓ | ✓ | 第一篇 |
| `app.use(path, fn)` 中间件 | ✓ | ✓ | 第一篇 |
| `next()` / `next(err)` 流转 | ✓ | ✓ | 第一篇 |
| 错误中间件（4 参数） | ✓ | ✓ | 第一篇 |
| `app.get(path, fn1, fn2)` 多 handler | ✗ | ✓ | 第三篇 1.4 |
| `app.route(path).get(fn).post(fn)` | ✗ | ✓ | 第三篇 1.2 |
| `app.all(path, fn)` 全方法匹配 | ✗ | ✓ | 第二篇 Q5 |
| `next('route')` 跳过当前 Route | ✗ | ✓ | 第二篇 Q7 |
| `express.Router()` 子路由器 | ✗ | ✓ | 第三篇 2.2 |
| 路径剥离（path stripping） | ✗ | ✓ | 第三篇 2.3 |
| `next('router')` 跳出子路由器 | ✗ | ✓ | 第三篇 3.2 |
| 中间件前缀匹配 / 路由精确匹配 | ✗ | ✓ | 第二篇 Q6 |
| `res.send()` / `res.json()` / `res.status()` | ✗ | ✓ | 第二篇 Q2 |
| Route.dispatch index 遍历 + method 过滤 | ✗ | ✓ | 第三篇 4.3 |

项目结构不变：

```
mini-express/
├── index.js          # 入口
├── application.js    # Application 层
└── router/
    ├── index.js      # Router
    ├── layer.js      # Layer
    └── route.js      # Route
```

下面从底层往上逐个升级。


---


## 二、升级 Route：多 handler、method 过滤、next('route')、ALL

Route 是改动最大的一层。基础版的 `dispatch` 用 `this.stack.find()` 只找第一个匹配的 handler，不支持多 handler 链式调用，也无法响应 `next('route')`。

### 2.1 完善版 route.js

```js
// router/route.js
function Route(path) {
  this.path = path
  this.stack = []       // [{ method, handler }, ...]
  this.methods = {}     // 快速判断该 Route 是否处理某方法
}

// 支持传入多个 handler（flatten）—— 第三篇 1.4 节
Route.prototype.addHandler = function(method, handlers) {
  handlers.forEach(fn => {
    this.stack.push({ method, handler: fn })
    this.methods[method] = true
  })
}

// 为 route.get(fn) / route.post(fn) 链式调用挂载方法 —— 第三篇 1.2 节
;['get', 'post', 'put', 'delete', 'patch', 'all'].forEach(method => {
  Route.prototype[method] = function(...handlers) {
    const m = method === 'all' ? 'ALL' : method.toUpperCase()
    this.addHandler(m, handlers)
    return this  // 返回 this，支持链式调用
  }
})

// dispatch 重写：index 遍历 + method 过滤 + next 链式调用 —— 第三篇 4.3 节
Route.prototype.dispatch = function(req, res, done) {
  const method = req.method
  let index = 0
  const stack = this.stack

  function next(err) {
    // next('route')：跳过当前 Route 的所有剩余 handler —— 第二篇 Q7
    if (err === 'route') {
      return done()
    }

    const entry = stack[index++]

    if (!entry) {
      return done(err)
    }

    // 错误流转：跳过普通 handler，寻找错误 handler
    if (err) {
      if (entry.handler.length === 4) {
        entry.handler(err, req, res, next)
      } else {
        next(err)
      }
      return
    }

    // method 过滤：不匹配则跳过 —— 第二篇 Q5 + 第三篇 4.3 节
    if (entry.method !== method && entry.method !== 'ALL') {
      return next()
    }

    try {
      entry.handler(req, res, next)
    } catch (e) {
      next(e)
    }
  }

  next()
}

module.exports = Route
```

**关键改动解读：**

**多 handler 支持**：`addHandler` 接受一个数组，循环 push 进 stack。`app.get('/user', fn1, fn2)` 时，fn1 和 fn2 都以 `{ method: 'GET', handler: fn }` 的形式进入同一个 Route 的 stack。

**index 遍历 + method 过滤**：基础版用 `find()` 只找第一个匹配项，无法支持多 handler。完善版改为 index 递增遍历，每一步检查 `entry.method !== method`，不匹配就 `next()` 跳过——这就是为什么 `.get(fn1).post(fn2).get(fn3)` 在 GET 请求下会跳过 fn2 直接执行 fn3。

**`next('route')`**：当 `err === 'route'` 时，不再继续遍历 Route 内部的 stack，而是调用外层传入的 `done()` 回调。`done` 来自 Router.handle 中的 `next`——这意味着控制权回到了 Router stack，继续匹配下一个 Layer。

**ALL 方法**：匹配条件加了 `entry.method !== 'ALL'`。`app.all()` 注册时 method 设为 `'ALL'`，dispatch 时任何 HTTP 方法都能匹配上。

**`this.methods` 快速判断**：用一个哈希表记录该 Route 注册了哪些方法，Router 层可以据此快速跳过不可能匹配的 Route，避免无意义地进入 dispatch。


---


## 三、升级 Layer：精确匹配 vs 前缀匹配

基础版的 Layer 只有一种匹配策略（前缀匹配），无法区分中间件和路由。

### 3.1 完善版 layer.js

```js
// router/layer.js
function Layer(path, handler) {
  this.path = path
  this.handle = handler
  this.route = null      // 路由 Layer 指向 Route，中间件 Layer 为 null
}

// 区分前缀匹配（中间件）和精确匹配（路由） —— 第二篇 Q6
Layer.prototype.match = function(url) {
  if (this.route) {
    // 路由 Layer：精确匹配
    return url === this.path
  }

  // 中间件 Layer：前缀匹配
  if (this.path === '/') return true
  return url === this.path || url.startsWith(this.path + '/')
}

module.exports = Layer
```

改动只有一处，但影响深远：

- `app.use('/api', fn)` 注册的中间件 Layer，`route` 为 `null`，走前缀匹配——`/api`、`/api/users`、`/api/posts/123` 都能命中
- `app.get('/api', fn)` 注册的路由 Layer，`route` 指向 Route 实例，走精确匹配——只有 `/api` 能命中，`/api/users` 不行

这正是第二篇 Q6 讨论的核心：**中间件是过滤器（前缀匹配），路由是终点（精确匹配）**。区分的依据就是 `layer.route` 是否为 `null`。


---


## 四、升级 Router：子路由器、路径剥离、next('router')

Router 的升级是最复杂的部分。核心改动有三个：改为函数式构造、路径剥离、`next('router')` 支持。

### 4.1 完善版 router/index.js

```js
// router/index.js
const Layer = require('./layer')
const Route = require('./route')

// Router 改为函数式构造 —— 第三篇 2.2 节
// Router() 返回一个函数，既可以作为 handler 使用，也可以挂方法
function Router() {
  function router(req, res, next) {
    router.handle(req, res, next)
  }

  router.stack = []

  // 将 prototype 方法绑定到 router 函数上
  Object.setPrototypeOf(router, Router.prototype)

  return router
}

// 注册中间件
Router.prototype.use = function(path, handler) {
  if (typeof path === 'function') {
    handler = path
    path = '/'
  }
  const layer = new Layer(path, handler)
  // 中间件 Layer 的 route 保持 null（前缀匹配）
  this.stack.push(layer)
}

// 创建 Route 并返回，支持链式注册 —— 第三篇 1.2 节
Router.prototype.route = function(path) {
  const route = new Route(path)

  const layer = new Layer(path, function(req, res, next) {
    route.dispatch(req, res, next)
  })
  layer.route = route  // 标记为路由 Layer（精确匹配）

  this.stack.push(layer)
  return route
}

// 注册路由（特定 HTTP 方法 + 路径 + 多 handler）
Router.prototype.addRoute = function(method, path, handlers) {
  const route = this.route(path)
  route.addHandler(method, handlers)
}

// 动态注册 HTTP 方法 + all
;['get', 'post', 'put', 'delete', 'patch'].forEach(method => {
  Router.prototype[method] = function(path, ...handlers) {
    this.addRoute(method.toUpperCase(), path, handlers)
  }
})

Router.prototype.all = function(path, ...handlers) {
  this.addRoute('ALL', path, handlers)
}

// 请求处理入口 —— 签名改为 handle(req, res, done)，支持父子路由器串联
Router.prototype.handle = function(req, res, done) {
  let index = 0
  const stack = this.stack

  // 如果没有传入 done（最顶层 app 调用），提供默认的兜底处理
  done = done || function(err) {
    res.statusCode = err ? 500 : 404
    res.end(err ? 'Internal Server Error' : 'Not Found')
  }

  function next(err) {
    // next('router')：跳出整个当前路由器 —— 第三篇 3.2 节
    if (err === 'router') {
      return done()
    }

    const layer = stack[index++]

    if (!layer) {
      return done(err)
    }

    // 错误流转：跳过普通中间件，寻找错误中间件（4 参数）
    if (err) {
      if (layer.handle.length === 4) {
        try {
          layer.handle(err, req, res, next)
        } catch (e) {
          next(e)
        }
      } else {
        next(err)
      }
      return
    }

    if (!layer.match(req.url)) {
      return next()
    }

    // 路由 Layer 的 method 快速判断：如果 Route 不处理当前 method，直接跳过
    if (layer.route && !layer.route.methods[req.method] && !layer.route.methods['ALL']) {
      return next()
    }

    // 路径剥离：中间件 Layer 需要剥离匹配到的前缀 —— 第三篇 2.3 节
    if (!layer.route && layer.path !== '/') {
      const originalUrl = req.url
      req.url = req.url.slice(layer.path.length) || '/'

      try {
        layer.handle(req, res, function(layerErr) {
          req.url = originalUrl  // 恢复
          next(layerErr)
        })
      } catch (e) {
        req.url = originalUrl
        next(e)
      }
    } else {
      // 路由 Layer 或 path='/' 的中间件：不需要剥离
      try {
        layer.handle(req, res, next)
      } catch (e) {
        next(e)
      }
    }
  }

  next()
}

module.exports = Router
```

**关键改动解读：**

**函数式构造**：基础版的 `Router` 是一个普通构造函数，`new Router()` 返回一个对象。完善版改为返回一个函数——`router(req, res, next)`——这个函数本身就是一个合法的 handler。当 `app.use('/api', router)` 时，Express 匹配到路径后直接调用 `router(req, res, next)`，子路由器就启动了。这是第三篇 2.2 节讨论的核心：**子路由器 = 一个函数 + 一套 Router 能力**。

**`Router.prototype.route(path)`**：创建 Route + Layer，推入 stack，返回 route。`app.route('/user')` 委托到这里，返回的 route 支持 `.get(fn).post(fn)` 链式调用。

**`handle` 签名**：从 `handle(req, res)` 变为 `handle(req, res, done)`。`done` 是父路由器传入的 `next` 回调。最顶层的 `app` 调用时没有 `done`，提供默认的 404/500 兜底。

**`next('router')`**：当 `err === 'router'` 时，调用 `done()` 跳出整个当前路由器，控制权回到父路由器的下一个 Layer。这和 `next('route')` 的区别在于作用域——`next('route')` 只跳出一个 Route，`next('router')` 跳出整个 Router。

**路径剥离**：当匹配到一个中间件 Layer（`!layer.route`）且路径不是 `/` 时，将 `req.url` 中匹配到的前缀临时剥离。比如请求 `/api/users/list`，Layer 路径是 `/api/users`，剥离后子路由器看到的 `req.url` 是 `/list`。处理完毕后通过闭包恢复 `req.url`。

**method 快速跳过**：在进入 `route.dispatch` 之前，先检查 `layer.route.methods` 哈希表。如果当前 HTTP 方法根本不在 Route 的注册方法中，直接 `next()` 跳过，省去一次 dispatch 调用。


---


## 五、升级 Application：route()、all()、多 handler、res.send()

### 5.1 完善版 application.js

```js
// application.js
const http = require('http')
const Router = require('./router')

function createApplication() {
  const app = function(req, res) {
    app.handle(req, res)
  }

  app._router = new Router()

  app.handle = function(req, res) {
    // 增强 res —— 第二篇 Q2
    enhanceResponse(res)
    app._router.handle(req, res)
  }

  app.use = function(path, handler) {
    if (typeof path === 'function') {
      handler = path
      path = '/'
    }
    app._router.use(path, handler)
  }

  // 动态注册 HTTP 方法，支持多 handler —— 第三篇 1.4 节
  ;['get', 'post', 'put', 'delete', 'patch'].forEach(method => {
    app[method] = function(path, ...handlers) {
      app._router.addRoute(method.toUpperCase(), path, handlers)
    }
  })

  // app.all() —— 第二篇 Q5
  app.all = function(path, ...handlers) {
    app._router.addRoute('ALL', path, handlers)
  }

  // app.route() —— 第三篇 1.2 节
  app.route = function(path) {
    return app._router.route(path)
  }

  app.listen = function(port, cb) {
    const server = http.createServer(app)
    server.listen(port, cb)
  }

  return app
}

// 增强 res 对象 —— 第二篇 Q2
function enhanceResponse(res) {
  // res.status(code)：设置状态码，返回 res 支持链式调用
  res.status = function(code) {
    res.statusCode = code
    return res
  }

  // res.send(body)：自动判断类型，设置 Content-Type 和 Content-Length
  res.send = function(body) {
    if (typeof body === 'object' && body !== null) {
      res.setHeader('Content-Type', 'application/json')
      body = JSON.stringify(body)
    } else if (typeof body === 'string') {
      res.setHeader('Content-Type', 'text/html')
    }

    if (typeof body === 'string') {
      res.setHeader('Content-Length', Buffer.byteLength(body))
    }

    res.end(body)
  }

  // res.json(obj)：显式 JSON 响应
  res.json = function(obj) {
    res.setHeader('Content-Type', 'application/json')
    const body = JSON.stringify(obj)
    res.setHeader('Content-Length', Buffer.byteLength(body))
    res.end(body)
  }
}

module.exports = createApplication
```

**关键改动解读：**

**多 handler 支持**：`app.get(path, ...handlers)` 用 rest 参数收集所有 handler，传给 `addRoute`。这样 `app.get('/user', fn1, fn2, fn3)` 三个函数都会进入同一个 Route 的 stack。

**`app.route(path)`**：直接委托给 `app._router.route(path)`，返回 Route 实例。用户可以继续链式调用 `.get(fn).post(fn)`。

**`app.all()`**：用 `'ALL'` 作为 method 注册，dispatch 时任何 HTTP 方法都能匹配。

**`res.send()`**：给 `res` 挂载了三个增强方法。`res.send()` 会自动判断类型——对象走 JSON，字符串走 HTML——并设置 `Content-Type` 和 `Content-Length`。真实 Express 的 `res.send()` 还处理 ETag、HEAD 请求等，这里只保留核心逻辑。


---


## 六、升级入口：导出 Router

### 6.1 完善版 index.js

```js
// index.js
const createApplication = require('./application')
const Router = require('./router')

function express() {
  return createApplication()
}

// 导出 Router 构造函数 —— 第三篇 2.1 节
express.Router = Router

module.exports = express
```

一行 `express.Router = Router`，让用户可以通过 `express.Router()` 创建子路由器。因为 Router 的函数式构造已经在 `router/index.js` 中处理了，`express.Router()` 就等价于 `new Router()`——返回一个既是函数又有 stack 的对象。


---


## 七、验证：用完善版 mini-express 跑通所有场景

下面用前三篇文章中讨论过的典型场景来验证完善版的实现。

### 7.1 多 handler + next('route') —— 第二篇 Q7 + 第三篇 4.2

```js
const express = require('./mini-express')
const app = express()

app.get('/dashboard',
  (req, res, next) => {
    if (!req.user) return next('route')
    next()
  },
  (req, res) => {
    res.send(`欢迎回来，${req.user.name}`)
  }
)

app.get('/dashboard', (req, res) => {
  res.send('请先登录')
})

// 请求 GET /dashboard（未登录）
// → handler1 调用 next('route')
// → 跳过 handler2（同 Route 内）
// → Route.dispatch 调用 done()，回到 Router stack
// → 匹配第二个 Layer，执行 → 返回"请先登录"
```

### 7.2 app.route() 链式注册 —— 第三篇 1.2

```js
app.route('/user')
  .get((req, res) => res.json({ action: 'get user' }))
  .post((req, res) => res.json({ action: 'create user' }))
  .put((req, res) => res.json({ action: 'update user' }))

// GET /user  → { action: 'get user' }
// POST /user → { action: 'create user' }
// 只有一个 Layer，一个 Route，三个 handler
```

### 7.3 链式注册中的 method 过滤 —— 第三篇 4.3

```js
app.route('/resource')
  .get((req, res, next) => {
    console.log('fn1')
    next()
  })
  .post((req, res) => {
    console.log('fn2 - POST only')
    res.send('posted')
  })
  .get((req, res) => {
    console.log('fn3')
    res.send('got it')
  })

// GET /resource
// → fn1 执行，调用 next()
// → fn2 是 POST，method 不匹配，跳过
// → fn3 是 GET，匹配，执行 → 返回"got it"
// 输出：fn1, fn3
```

### 7.4 子路由器 + 路径剥离 —— 第三篇 2.2 + 2.3

```js
const express = require('./mini-express')
const app = express()
const apiRouter = express.Router()

apiRouter.use((req, res, next) => {
  console.log('API middleware, url:', req.url)
  // 此时 req.url 已被剥离前缀 /api，变成 /users
  next()
})

apiRouter.get('/users', (req, res) => {
  res.json([{ id: 1, name: 'Alice' }])
})

app.use('/api', apiRouter)

// GET /api/users
// → app._router 匹配 Layer('/api')，前缀匹配成功
// → req.url 从 /api/users 剥离为 /users
// → 进入 apiRouter.handle
// → apiRouter 中间件执行，打印 "API middleware, url: /users"
// → apiRouter 路由匹配 /users（精确匹配），返回 JSON
// → req.url 恢复为 /api/users
```

### 7.5 next('router') 跳出子路由器 —— 第三篇 3.2

```js
const express = require('./mini-express')
const app = express()
const authRouter = express.Router()

authRouter.use((req, res, next) => {
  if (!req.headers['x-token']) {
    return next('router')   // 跳出 authRouter
  }
  next()
})

authRouter.get('/secret', (req, res) => {
  res.send('机密数据')
})

app.use('/auth', authRouter)

app.use('/auth', (req, res) => {
  res.status(401).send('需要认证')
})

// GET /auth/secret（无 x-token）
// → authRouter 中间件检测到无 token
// → next('router') → authRouter.handle 中 err === 'router'
// → 调用 done()，回到 app._router 的下一个 Layer
// → 匹配 Layer('/auth') 的 fallback handler
// → 返回 401 "需要认证"
```

### 7.6 app.all() 全方法匹配 —— 第二篇 Q5

```js
app.all('/health', (req, res) => {
  res.json({ status: 'ok' })
})

// GET /health    → { status: 'ok' }
// POST /health   → { status: 'ok' }
// DELETE /health  → { status: 'ok' }
// 只有一个 Layer，method 为 'ALL'，任何方法都匹配
```

### 7.7 中间件前缀匹配 vs 路由精确匹配 —— 第二篇 Q6

```js
app.use('/api', (req, res, next) => {
  console.log('中间件命中 /api')
  next()
})

app.get('/api', (req, res) => {
  res.send('精确匹配 /api')
})

// GET /api/users
// → 中间件 Layer('/api')：前缀匹配 ✓，执行 → 打印日志
// → 路由 Layer('/api')：精确匹配 ✗（/api !== /api/users），跳过
// → 没有更多 Layer → 404

// GET /api
// → 中间件 Layer('/api')：前缀匹配 ✓，执行
// → 路由 Layer('/api')：精确匹配 ✓，执行 → 返回"精确匹配 /api"
```


---


## 八、完善版架构总览

升级后的完整数据流：

```
http.Server 收到请求
    │
    ▼
app(req, res)
    │
    ├─ enhanceResponse(res)      ← 挂载 send/json/status
    │
    ▼
app._router.handle(req, res)
    │
    ├─ 遍历 stack，逐个 Layer：
    │     │
    │     ├─ layer.match(req.url)
    │     │    ├─ route Layer → 精确匹配
    │     │    └─ middleware Layer → 前缀匹配
    │     │
    │     ├─ 中间件 Layer（route === null）：
    │     │    ├─ 路径剥离 req.url
    │     │    ├─ layer.handle(req, res, restore-next)
    │     │    └─ 恢复 req.url
    │     │
    │     └─ 路由 Layer（route !== null）：
    │          ├─ methods 快速判断
    │          └─ route.dispatch(req, res, next)
    │               │
    │               ├─ 遍历 route.stack：
    │               │    ├─ method 过滤（ALL 通配）
    │               │    ├─ handler(req, res, next)
    │               │    └─ next('route') → done()
    │               │
    │               └─ stack 耗尽 → done()
    │
    ├─ next('router') → done()  ← 跳出子路由器
    ├─ next(err) → 跳到 4 参数错误中间件
    └─ stack 耗尽 → 404 / 500
```

三层模型的职责升级：

| 层级 | 基础版 | 完善版新增 |
|------|--------|-----------|
| **Router** | 管理 Layer stack，`next()` 遍历 | 函数式构造（可作子路由器）、路径剥离、`next('router')`、method 快速判断 |
| **Route** | 单 handler 的 `find` 匹配 | 多 handler index 遍历、method 过滤、`next('route')`、链式 API |
| **Layer** | 统一前缀匹配 | 区分精确/前缀匹配（`route` 标记） |


---


## 九、与真实 Express 的剩余差距

完善版已经覆盖了 Express 路由系统的核心机制，但距离真实 Express 仍有一些差距：

| 特性 | 完善版 | 真实 Express |
|------|--------|-------------|
| 路径匹配 | 字符串相等 / `startsWith` | `path-to-regexp`，支持 `:id`、`*`、正则 |
| `req.params` | 不支持 | 自动解析路径参数 |
| `req.query` | 不支持 | 自动解析查询字符串 |
| `res.send()` | 基础类型判断 | ETag、HEAD、Buffer、`charset` |
| `res.render()` | 不支持 | 模板引擎集成 |
| `app.set()` / `app.get()` 配置 | 不支持 | 全局配置系统 |
| `req.baseUrl` / `req.originalUrl` | 不支持 | 完整的 URL 追踪 |
| `express.static()` | 不支持 | 静态文件服务 |

但这些都是"**在核心架构上添砖加瓦**"的工作。核心的三层模型、中间件管道、子路由器嵌套、四种 next 行为——这些决定 Express 行为本质的机制，在完善版中已经全部实现。理解了这些代码，再去看 Express 源码中的 `path-to-regexp`、`req.params` 解析、模板引擎集成，就只是细节填充，不再有架构层面的困惑。

---

*本文是 Express 深入系列的第四篇。第一篇搭骨架，第二篇讲控制流，第三篇讲子路由器，本篇把所有知识点落地为代码。四篇文章形成了一个完整的闭环：理论 → 实践 → 深入 → 实现。*
