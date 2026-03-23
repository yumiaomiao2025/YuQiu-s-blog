---
title: Mini-Express 完善版：两种风格实现 Express 核心
date: 2026-03-22
category: 后端
tags: [Express, Node.js, 源码, 手写实现]
readTime: 20 min
slug: mini-express-enhanced
excerpt: 用闭包+函数对象和构造函数+原型链两种风格，实现包含 app.route()、子路由器、路径剥离、next('route')、next('router')、精确/前缀匹配、res.send() 的完整 mini-express。
---

## 前言

前三篇文章讨论了 Express 的三层模型、控制流、子路由器等核心机制。本篇把所有知识点落地为代码，并且用**两种 JavaScript 风格**分别实现，让你看到同一套架构在不同编码范式下的样子：

- **风格 A：闭包 + 函数对象** —— 无 `new`、无 `prototype`、无 `this`，纯工厂函数 + 闭包封装状态
- **风格 B：构造函数 + 原型链** —— `new`、`this`、`prototype`，传统 OOP 模式（也是真实 Express 采用的方式）


---


## 功能清单

| 功能 | 知识来源 |
|------|----------|
| `app.get(path, fn1, fn2)` 多 handler | 第三篇 1.4 |
| `app.route(path).get(fn).post(fn)` 链式注册 | 第三篇 1.2 |
| `app.all(path, fn)` 全方法匹配 | 第二篇 Q5 |
| `next('route')` 跳过当前 Route | 第二篇 Q7 |
| `express.Router()` 子路由器 | 第三篇 2.2 |
| 路径剥离（path stripping） | 第三篇 2.3 |
| `next('router')` 跳出子路由器 | 第三篇 3.2 |
| 中间件前缀匹配 / 路由精确匹配 | 第二篇 Q6 |
| `res.send()` / `res.json()` / `res.status()` | 第二篇 Q2 |
| Route.dispatch index 遍历 + method 过滤 | 第三篇 4.3 |
| `next()` / `next(err)` 流转 + 错误中间件 | 第一篇 |

项目结构（两种风格相同）：

```
mini-express/
├── index.js          # 入口
├── application.js    # Application 层
└── router/
    ├── index.js      # Router
    ├── layer.js      # Layer
    └── route.js      # Route
```


---


## 一、Route

Route 负责管理同一路径下的多个 handler，按 HTTP 方法过滤，支持 `next('route')` 跳出。

### 风格 A：闭包 + 函数对象

```js
// router/route.js
function createRoute(path) {
  const stack = []     // [{ method, handler }, ...]
  const methods = {}   // 快速判断该 Route 是否处理某方法

  function addHandler(method, handlers) {
    handlers.forEach(fn => {
      stack.push({ method, handler: fn })
      methods[method] = true
    })
  }

  // index 遍历 + method 过滤 + next('route') 支持
  function dispatch(req, res, done) {
    const method = req.method
    let index = 0

    function next(err) {
      if (err === 'route') return done()        // 跳出整个 Route

      const entry = stack[index++]
      if (!entry) return done(err)

      if (err) {
        if (entry.handler.length === 4) {
          entry.handler(err, req, res, next)     // 错误 handler
        } else {
          next(err)                              // 跳过普通 handler
        }
        return
      }

      if (entry.method !== method && entry.method !== 'ALL') {
        return next()                            // method 不匹配，跳过
      }

      try {
        entry.handler(req, res, next)
      } catch (e) {
        next(e)
      }
    }

    next()
  }

  // 构建返回对象，挂载链式方法
  const route = { path, stack, methods, addHandler, dispatch }

  ;['get', 'post', 'put', 'delete', 'patch', 'all'].forEach(m => {
    route[m] = function(...handlers) {
      addHandler(m === 'all' ? 'ALL' : m.toUpperCase(), handlers)
      return route
    }
  })

  return route
}

module.exports = createRoute
```

### 风格 B：构造函数 + 原型链

```js
// router/route.js
function Route(path) {
  this.path = path
  this.stack = []
  this.methods = {}
}

Route.prototype.addHandler = function(method, handlers) {
  handlers.forEach(fn => {
    this.stack.push({ method, handler: fn })
    this.methods[method] = true
  })
}

;['get', 'post', 'put', 'delete', 'patch', 'all'].forEach(method => {
  Route.prototype[method] = function(...handlers) {
    const m = method === 'all' ? 'ALL' : method.toUpperCase()
    this.addHandler(m, handlers)
    return this
  }
})

Route.prototype.dispatch = function(req, res, done) {
  const method = req.method
  let index = 0
  const stack = this.stack

  function next(err) {
    if (err === 'route') return done()

    const entry = stack[index++]
    if (!entry) return done(err)

    if (err) {
      if (entry.handler.length === 4) {
        entry.handler(err, req, res, next)
      } else {
        next(err)
      }
      return
    }

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

### 对比

两种风格的 `dispatch` 内部逻辑完全一致——`next` 闭包无法避免，因为它需要捕获 `index` 和 `stack`。区别在于**状态存放位置**和**方法挂载方式**：

| | 风格 A | 风格 B |
|---|---|---|
| 状态 | 闭包变量 `stack`、`methods` | `this.stack`、`this.methods` |
| 方法 | 直接挂在返回对象上 | 挂在 `Route.prototype` 上 |
| 实例化 | `createRoute(path)` | `new Route(path)` |


---


## 二、Layer

Layer 负责路径匹配。核心区别：路由 Layer 精确匹配，中间件 Layer 前缀匹配。

### 风格 A：闭包 + 函数对象

```js
// router/layer.js
function createLayer(path, handler) {
  return {
    path,
    handle: handler,
    route: null,      // 路由 Layer 指向 Route，中间件 Layer 为 null
    match(url) {
      if (this.route) {
        return url === this.path                // 路由：精确匹配
      }
      if (this.path === '/') return true
      return url === this.path || url.startsWith(this.path + '/')  // 中间件：前缀匹配
    }
  }
}

module.exports = createLayer
```

### 风格 B：构造函数 + 原型链

```js
// router/layer.js
function Layer(path, handler) {
  this.path = path
  this.handle = handler
  this.route = null
}

Layer.prototype.match = function(url) {
  if (this.route) {
    return url === this.path
  }
  if (this.path === '/') return true
  return url === this.path || url.startsWith(this.path + '/')
}

module.exports = Layer
```

Layer 代码量很少，两种风格差异不大。关键是 `route` 字段：`null` 表示中间件（前缀匹配），指向 Route 实例表示路由（精确匹配）。


---


## 三、Router

Router 是最复杂的一层。核心要求：**Router 本身必须是一个函数**（这样才能作为 handler 传入 `app.use('/api', router)`），同时又需要拥有 `use`、`route`、`handle` 等方法。

### 风格 A：闭包 + 函数对象

```js
// router/index.js
const createLayer = require('./layer')
const createRoute = require('./route')

function createRouter() {
  const stack = []

  // router 本身是函数，可直接作为 handler
  function router(req, res, next) {
    router.handle(req, res, next)
  }

  router.stack = stack

  // ---------- 注册 ----------

  router.use = function(path, handler) {
    if (typeof path === 'function') { handler = path; path = '/' }
    const layer = createLayer(path, handler)
    // 中间件 Layer 的 route 保持 null → 前缀匹配
    stack.push(layer)
  }

  router.route = function(path) {
    const route = createRoute(path)
    const layer = createLayer(path, (req, res, next) => route.dispatch(req, res, next))
    layer.route = route   // 标记为路由 Layer → 精确匹配
    stack.push(layer)
    return route
  }

  router.addRoute = function(method, path, handlers) {
    const route = router.route(path)
    route.addHandler(method, handlers)
  }

  ;['get', 'post', 'put', 'delete', 'patch'].forEach(method => {
    router[method] = function(path, ...handlers) {
      router.addRoute(method.toUpperCase(), path, handlers)
    }
  })

  router.all = function(path, ...handlers) {
    router.addRoute('ALL', path, handlers)
  }

  // ---------- 请求处理 ----------

  router.handle = function(req, res, done) {
    let index = 0

    done = done || function(err) {
      res.statusCode = err ? 500 : 404
      res.end(err ? 'Internal Server Error' : 'Not Found')
    }

    function next(err) {
      // next('router')：跳出整个当前路由器
      if (err === 'router') return done()

      const layer = stack[index++]
      if (!layer) return done(err)

      // 错误流转
      if (err) {
        if (layer.handle.length === 4) {
          try { layer.handle(err, req, res, next) } catch (e) { next(e) }
        } else {
          next(err)
        }
        return
      }

      // 路径匹配
      if (!layer.match(req.url)) return next()

      // method 快速判断
      if (layer.route && !layer.route.methods[req.method] && !layer.route.methods['ALL']) {
        return next()
      }

      // 路径剥离：中间件 Layer 需要剥离匹配到的前缀
      if (!layer.route && layer.path !== '/') {
        const originalUrl = req.url
        req.url = req.url.slice(layer.path.length) || '/'
        try {
          layer.handle(req, res, function(layerErr) {
            req.url = originalUrl
            next(layerErr)
          })
        } catch (e) {
          req.url = originalUrl
          next(e)
        }
      } else {
        try { layer.handle(req, res, next) } catch (e) { next(e) }
      }
    }

    next()
  }

  return router
}

module.exports = createRouter
```

### 风格 B：构造函数 + 原型链

```js
// router/index.js
const Layer = require('./layer')
const Route = require('./route')

// Router() 返回一个函数，用 setPrototypeOf 让它同时拥有 prototype 方法
// 这是真实 Express 采用的技巧——函数既能被调用，又有实例方法
function Router() {
  function router(req, res, next) {
    router.handle(req, res, next)
  }
  router.stack = []
  Object.setPrototypeOf(router, Router.prototype)
  return router
}

// ---------- 注册 ----------

Router.prototype.use = function(path, handler) {
  if (typeof path === 'function') { handler = path; path = '/' }
  const layer = new Layer(path, handler)
  this.stack.push(layer)
}

Router.prototype.route = function(path) {
  const route = new Route(path)
  const layer = new Layer(path, function(req, res, next) {
    route.dispatch(req, res, next)
  })
  layer.route = route
  this.stack.push(layer)
  return route
}

Router.prototype.addRoute = function(method, path, handlers) {
  const route = this.route(path)
  route.addHandler(method, handlers)
}

;['get', 'post', 'put', 'delete', 'patch'].forEach(method => {
  Router.prototype[method] = function(path, ...handlers) {
    this.addRoute(method.toUpperCase(), path, handlers)
  }
})

Router.prototype.all = function(path, ...handlers) {
  this.addRoute('ALL', path, handlers)
}

// ---------- 请求处理 ----------

Router.prototype.handle = function(req, res, done) {
  let index = 0
  const stack = this.stack

  done = done || function(err) {
    res.statusCode = err ? 500 : 404
    res.end(err ? 'Internal Server Error' : 'Not Found')
  }

  function next(err) {
    if (err === 'router') return done()

    const layer = stack[index++]
    if (!layer) return done(err)

    if (err) {
      if (layer.handle.length === 4) {
        try { layer.handle(err, req, res, next) } catch (e) { next(e) }
      } else {
        next(err)
      }
      return
    }

    if (!layer.match(req.url)) return next()

    if (layer.route && !layer.route.methods[req.method] && !layer.route.methods['ALL']) {
      return next()
    }

    if (!layer.route && layer.path !== '/') {
      const originalUrl = req.url
      req.url = req.url.slice(layer.path.length) || '/'
      try {
        layer.handle(req, res, function(layerErr) {
          req.url = originalUrl
          next(layerErr)
        })
      } catch (e) {
        req.url = originalUrl
        next(e)
      }
    } else {
      try { layer.handle(req, res, next) } catch (e) { next(e) }
    }
  }

  next()
}

module.exports = Router
```

### 对比

Router 是两种风格差异最有意思的地方。核心难题：**Router 必须同时是函数和对象**。

| | 风格 A | 风格 B |
|---|---|---|
| 解法 | 创建函数后直接往上挂属性和方法 | 创建函数后用 `Object.setPrototypeOf` 接入原型链 |
| 方法归属 | 每个 router 实例各有一份方法（闭包捕获 `stack`） | 所有实例共享 `Router.prototype` 上的方法 |
| `this` | 不存在，`stack` 通过闭包访问 | `this.stack`，通过原型链查找方法 |
| 内存 | 每个实例独立复制方法 | 方法只存一份在 prototype 上 |

风格 B 中 `Object.setPrototypeOf(router, Router.prototype)` 是关键一行——没有它，`router` 只是个普通函数，找不到 `handle`、`use` 等方法。这也是真实 Express 源码的做法。


---


## 四、Application + 入口

### 风格 A：闭包 + 函数对象

```js
// application.js
const http = require('http')
const createRouter = require('./router')

function createApplication() {
  const router = createRouter()

  function app(req, res) {
    enhanceResponse(res)
    router.handle(req, res)
  }

  app.use = function(path, handler) {
    if (typeof path === 'function') { handler = path; path = '/' }
    router.use(path, handler)
  }

  ;['get', 'post', 'put', 'delete', 'patch'].forEach(method => {
    app[method] = function(path, ...handlers) {
      router.addRoute(method.toUpperCase(), path, handlers)
    }
  })

  app.all = function(path, ...handlers) {
    router.addRoute('ALL', path, handlers)
  }

  app.route = function(path) {
    return router.route(path)
  }

  app.listen = function(port, cb) {
    http.createServer(app).listen(port, cb)
  }

  return app
}
```

```js
// index.js
const createApplication = require('./application')
const createRouter = require('./router')

function express() {
  return createApplication()
}

express.Router = createRouter

module.exports = express
```

### 风格 B：构造函数 + 原型链

```js
// application.js
const http = require('http')
const Router = require('./router')

function Application() {
  this._router = new Router()
}

Application.prototype.handle = function(req, res) {
  enhanceResponse(res)
  this._router.handle(req, res)
}

Application.prototype.use = function(path, handler) {
  if (typeof path === 'function') { handler = path; path = '/' }
  this._router.use(path, handler)
}

;['get', 'post', 'put', 'delete', 'patch'].forEach(method => {
  Application.prototype[method] = function(path, ...handlers) {
    this._router.addRoute(method.toUpperCase(), path, handlers)
  }
})

Application.prototype.all = function(path, ...handlers) {
  this._router.addRoute('ALL', path, handlers)
}

Application.prototype.route = function(path) {
  return this._router.route(path)
}

Application.prototype.listen = function(port, cb) {
  const self = this
  http.createServer(function(req, res) {
    self.handle(req, res)
  }).listen(port, cb)
}
```

```js
// index.js
const Application = require('./application')
const Router = require('./router')

function express() {
  return new Application()
}

express.Router = Router

module.exports = express
```

### 两种风格 Application 的差异

| | 风格 A | 风格 B |
|---|---|---|
| `app` 是什么 | 函数（直接传给 `http.createServer`） | Application 实例（`listen` 内部包装一层） |
| `http.createServer` | `http.createServer(app)` | `http.createServer((req, res) => self.handle(req, res))` |
| `_router` 可见性 | 外部不可访问（闭包封装） | `app._router` 外部可访问 |

风格 A 中 `app` 本身就是 `(req, res) => {}` 函数，天然适配 `http.createServer`。风格 B 中 `app` 是对象，需要在 `listen` 里包一层。

### enhanceResponse（两种风格共用）

```js
function enhanceResponse(res) {
  res.status = function(code) {
    res.statusCode = code
    return res
  }

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

  res.json = function(obj) {
    res.setHeader('Content-Type', 'application/json')
    const body = JSON.stringify(obj)
    res.setHeader('Content-Length', Buffer.byteLength(body))
    res.end(body)
  }
}
```

`enhanceResponse` 是纯工具函数，给 `res` 挂方法，不涉及 `this` 或 `prototype`，两种风格完全相同。


---


## 五、两种风格总体对比

| 维度 | 风格 A：闭包 + 函数对象 | 风格 B：构造函数 + 原型链 |
|------|------------------------|--------------------------|
| 关键词 | `createXxx()`、闭包变量、直接挂属性 | `new Xxx()`、`this`、`prototype` |
| 封装性 | 强——内部状态外部不可访问 | 弱——`this.stack` 外部可直接读写 |
| 内存 | 每个实例独立复制方法 | 方法共享在 prototype 上，更节省内存 |
| 可继承性 | 无原型链，不支持 `instanceof` | 支持原型链继承和 `instanceof` |
| 调试 | 闭包变量在 devtools 中不易查看 | `this` 上的属性一目了然 |
| 真实 Express | — | ✓（Express 源码使用此风格） |

**为什么 Express 选择风格 B？** 主要是 prototype 的方法共享更省内存（大量路由实例共享同一套 `dispatch`），以及 `layer.route instanceof Route` 这类检查在类型判断时很方便。


---


## 六、验证场景

以下场景两种风格都能跑通，用法完全一致。

### 6.1 多 handler + next('route')

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

// GET /dashboard（未登录）→ next('route') → 跳过 Route1 → 匹配 Route2 → "请先登录"
```

### 6.2 app.route() 链式注册

```js
app.route('/user')
  .get((req, res) => res.json({ action: 'get user' }))
  .post((req, res) => res.json({ action: 'create user' }))
  .put((req, res) => res.json({ action: 'update user' }))

// 一个 Layer，一个 Route，三个 handler
// GET /user → { action: 'get user' }
```

### 6.3 method 过滤

```js
app.route('/resource')
  .get((req, res, next) => { console.log('fn1'); next() })
  .post((req, res) => { console.log('fn2'); res.send('posted') })
  .get((req, res) => { console.log('fn3'); res.send('got it') })

// GET /resource → fn1 执行 → fn2 是 POST 跳过 → fn3 执行 → "got it"
```

### 6.4 子路由器 + 路径剥离

```js
const apiRouter = express.Router()

apiRouter.use((req, res, next) => {
  console.log('API middleware, url:', req.url)  // 此时 url 已被剥离为 /users
  next()
})

apiRouter.get('/users', (req, res) => {
  res.json([{ id: 1, name: 'Alice' }])
})

app.use('/api', apiRouter)

// GET /api/users → 剥离前缀 → apiRouter 看到 /users → 匹配 → 返回 JSON
```

### 6.5 next('router') 跳出子路由器

```js
const authRouter = express.Router()

authRouter.use((req, res, next) => {
  if (!req.headers['x-token']) return next('router')
  next()
})

authRouter.get('/secret', (req, res) => {
  res.send('机密数据')
})

app.use('/auth', authRouter)

app.use('/auth', (req, res) => {
  res.status(401).send('需要认证')
})

// GET /auth/secret（无 token）→ next('router') → 跳出 authRouter → fallback → 401
```

### 6.6 中间件前缀匹配 vs 路由精确匹配

```js
app.use('/api', (req, res, next) => {
  console.log('中间件命中')
  next()
})

app.get('/api', (req, res) => {
  res.send('精确匹配 /api')
})

// GET /api/users → 中间件命中 ✓ → 路由精确匹配 ✗ → 404
// GET /api       → 中间件命中 ✓ → 路由精确匹配 ✓ → "精确匹配 /api"
```


---


## 七、架构总览

两种风格共享同一套架构，完整数据流如下：

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

三层模型职责：

| 层级 | 职责 |
|------|------|
| **Router** | 管理 Layer stack，遍历匹配，函数式构造（可作子路由器），路径剥离，`next('router')`，method 快速判断 |
| **Route** | 管理同路径多 handler，index 遍历 + method 过滤，`next('route')`，链式 API |
| **Layer** | 持有路径和 handler，区分精确/前缀匹配（`route` 标记） |


---


## 八、与真实 Express 的剩余差距

| 特性 | 完善版 | 真实 Express |
|------|--------|-------------|
| 路径匹配 | 字符串相等 / `startsWith` | `path-to-regexp`，支持 `:id`、`*`、正则 |
| `req.params` | 不支持 | 自动解析路径参数 |
| `req.query` | 不支持 | 自动解析查询字符串 |
| `res.send()` | 基础类型判断 | ETag、HEAD、Buffer、`charset` |
| `res.render()` | 不支持 | 模板引擎集成 |
| `req.baseUrl` / `req.originalUrl` | 不支持 | 完整的 URL 追踪 |
| `express.static()` | 不支持 | 静态文件服务 |

这些都是在核心架构上添砖加瓦的工作。三层模型、中间件管道、子路由器嵌套、四种 next 行为——决定 Express 行为本质的机制，在完善版中已经全部实现。

---

*本文是 Express 深入系列的第四篇。第一篇搭骨架，第二篇讲控制流，第三篇讲子路由器，本篇把所有知识点落地为代码。四篇文章形成完整闭环：理论 → 实践 → 深入 → 实现。*
