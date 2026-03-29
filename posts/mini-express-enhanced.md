---
title: Mini-Express 完善版：两种风格完整实现
date: 2026-03-22
category: 后端
tags: [Express, Node.js, 源码, 手写实现]
readTime: 20 min
slug: mini-express-enhanced
excerpt: 用闭包+函数对象和构造函数+原型链两种风格，各自完整实现包含 app.route()、子路由器、路径剥离、next('route')、next('router')、精确/前缀匹配、res.send() 的 mini-express。
---

## 前言

前三篇文章讨论了 Express 的三层模型、控制流、子路由器等核心机制。本篇把所有知识点落地为代码，分别用两种 JavaScript 风格各自完整地实现一遍，让你看到同一套架构在不同编码范式下的全貌：

- **风格 A：闭包 + 函数对象** —— 无 `new`、无 `prototype`、无 `this`，纯工厂函数 + 闭包封装状态
- **风格 B：构造函数 + 原型链** —— `new`、`this`、`prototype`，传统 OOP 模式（也是真实 Express 采用的方式）

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


## 风格 A：闭包 + 函数对象

### Route（闭包）

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
          entry.handler(err, req, res, next)    // 错误 handler
        } else {
          next(err)                             // 跳过普通 handler
        }
        return
      }

      if (entry.method !== method && entry.method !== 'ALL') {
        return next()                           // method 不匹配，跳过
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

### Layer（闭包）

```js
// router/layer.js
function createLayer(path, handler) {
  return {
    path,
    handle: handler,
    route: null,      // 路由 Layer 指向 Route，中间件 Layer 为 null
    match(url) {
      if (this.route) {
        return url === this.path                                         // 路由：精确匹配
      }
      if (this.path === '/') return true
      return url === this.path || url.startsWith(this.path + '/')       // 中间件：前缀匹配
    }
  }
}

module.exports = createLayer
```

### Router（闭包）

Router 本身必须是一个函数（这样才能作为 handler 传入 `app.use('/api', router)`），同时又需要拥有 `use`、`route`、`handle` 等方法。闭包风格的解法是：创建内部函数 `router`，然后直接把所有方法作为属性挂在这个函数上。

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

      // method 快速判断（仅对路由 Layer）
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

### Application + 入口（闭包）

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


---


## 风格 B：构造函数 + 原型链

### Route（原型链）

```js
// router/route.js
function Route(path) {
  this.path = path
  this.stack = []     // [{ method, handler }, ...]
  this.methods = {}   // 快速判断该 Route 是否处理某方法
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

// index 遍历 + method 过滤 + next('route') 支持
Route.prototype.dispatch = function(req, res, done) {
  const method = req.method
  let index = 0
  const stack = this.stack

  function next(err) {
    if (err === 'route') return done()        // 跳出整个 Route

    const entry = stack[index++]
    if (!entry) return done(err)

    if (err) {
      if (entry.handler.length === 4) {
        entry.handler(err, req, res, next)    // 错误 handler
      } else {
        next(err)                             // 跳过普通 handler
      }
      return
    }

    if (entry.method !== method && entry.method !== 'ALL') {
      return next()                           // method 不匹配，跳过
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

### Layer（原型链）

```js
// router/layer.js
function Layer(path, handler) {
  this.path = path
  this.handle = handler
  this.route = null     // 路由 Layer 指向 Route，中间件 Layer 为 null
}

Layer.prototype.match = function(url) {
  if (this.route) {
    return url === this.path                                         // 路由：精确匹配
  }
  if (this.path === '/') return true
  return url === this.path || url.startsWith(this.path + '/')       // 中间件：前缀匹配
}

module.exports = Layer
```

### Router（原型链）

prototype 风格的解法：创建内部函数 `router`，然后用 `Object.setPrototypeOf(router, Router.prototype)` 让这个函数实例接入原型链，从而同时具备"可调用"和"有实例方法"两个特性——这也是真实 Express 源码的做法。

```js
// router/index.js
const Layer = require('./layer')
const Route = require('./route')

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
  // 中间件 Layer 的 route 保持 null → 前缀匹配
  this.stack.push(layer)
}

Router.prototype.route = function(path) {
  const route = new Route(path)
  const layer = new Layer(path, function(req, res, next) {
    route.dispatch(req, res, next)
  })
  layer.route = route   // 标记为路由 Layer → 精确匹配
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

    // method 快速判断（仅对路由 Layer）
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

module.exports = Router
```

### Application + 入口（原型链）

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


---



## 架构总览

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

三层职责：

| 层级 | 职责 |
|------|------|
| **Router** | 管理 Layer stack，遍历匹配，函数式构造（可作子路由器），路径剥离，`next('router')`，method 快速判断 |
| **Route** | 管理同路径多 handler，index 遍历 + method 过滤，`next('route')`，链式 API |
| **Layer** | 持有路径和 handler，区分精确/前缀匹配（`route` 标记） |


---


## 两种风格的主要差异

两套代码的核心逻辑完全一致，差异集中在三个地方：

**Router 的"函数 + 方法"问题**。Router 必须同时是函数和对象。风格 A 直接往函数上挂属性；风格 B 用 `Object.setPrototypeOf(router, Router.prototype)` 让函数接入原型链——后者是真实 Express 的做法。

**状态存放与封装性**。风格 A 的状态（`stack`、`methods`）藏在闭包里，外部无法直接访问；风格 B 存在 `this` 上（`this.stack`、`this.methods`），外部可以读写。

**内存与方法共享**。风格 A 每个实例各有一套方法副本；风格 B 所有实例共享 `prototype` 上的方法，大量路由实例时更省内存，也支持 `instanceof` 判断——这是 Express 选择风格 B 的主要原因。

---

*本文是 Express 深入系列的第四篇。第一篇搭骨架，第二篇讲控制流，第三篇讲子路由器，本篇把所有知识点落地为代码。四篇文章形成完整闭环：理论 → 实践 → 深入 → 实现。*
