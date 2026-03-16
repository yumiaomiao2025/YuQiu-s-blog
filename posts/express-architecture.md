---
title: Express 框架架构解析：从源码到 Mini 实现
date: 2026-03-15
category: 后端
tags: [Express, Node.js, 架构, 源码]
readTime: 12 min
slug: express-architecture
excerpt: 通过手写 mini-express，深入理解 Express 的核心架构——Router、Route、Layer 三层模型与中间件管道机制。
---

## 一、从原生 http 到 Express

在 Express 中创建一个 Hello World 只需要几行代码：

```js
const express = require('express')
const app = express()

app.get('/', (req, res) => {
  res.send('Hello World')
})

app.listen(3000, () => {
  console.log('Server is running on http://localhost:3000')
})
```

而用原生 `http` 模块实现相同功能，需要手动处理路径匹配和方法判断：

```js
const http = require('http')

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    res.statusCode = 200
    res.setHeader('Content-Type', 'text/plain')
    res.end('Hello World')
  } else {
    res.statusCode = 404
    res.end('Not Found')
  }
})

server.listen(3000, () => {
  console.log('Server is running on http://localhost:3000')
})
```

对比之下可以发现：Express 做的事情，本质上就是**对 `http.createServer(callback)` 中那个回调函数的系统化封装**。原生写法里我们手动写 `if (req.method === xxx && req.url === xxx)` 的判断逻辑，Express 将其抽象为路由系统；我们在回调里做的各种预处理（解析 body、设置 CORS 等），Express 将其抽象为中间件机制。

## 二、Express 的本质：增强的回调函数

理解 Express 的关键在于一个事实：**`app` 本身就是一个函数**。

当我们调用 `http.createServer(app)` 时，Node.js 每收到一个 HTTP 请求就会执行 `app(req, res)`。Express 所做的一切——路由匹配、中间件管道、错误处理——都发生在这次函数调用内部。

把路径判断 + 方法判断封装起来，就是**路由**；把请求到达路由之前（或之后）的通用逻辑封装起来，就是**中间件**。Express 的核心架构就围绕这两件事展开。

下面，我们通过手写一个 mini-express 来完整还原这套架构。

## 三、Mini-Express 实现

### 3.1 项目结构

```
mini-express/
├── index.js          # 入口，导出 express 工厂函数
├── application.js    # Application 层，封装 app 实例
└── router/
    ├── index.js      # Router，管理 layer stack
    ├── layer.js      # Layer，路径匹配 + handler 包装
    └── route.js      # Route，管理同路径下的多方法 handler
```

### 3.2 入口文件

```js
// index.js
const createApplication = require('./application')

function express() {
  return createApplication()
}

module.exports = express
```

`require('mini-express')` 得到的是 `express` 函数，调用后返回 `createApplication()` 的结果——也就是我们熟悉的 `app`。

### 3.3 Application 层

```js
// application.js
const http = require('http')
const Router = require('./router')

function createApplication() {
  // app 本身是一个 (req, res) => void 函数
  const app = function(req, res) {
    app.handle(req, res)
  }

  app._router = new Router()

  app.handle = function(req, res) {
    app._router.handle(req, res)
  }

  app.use = function(path, handler) {
    if (typeof path === 'function') {
      handler = path
      path = '/'
    }
    app._router.use(path, handler)
  }

  // 动态注册 HTTP 方法
  ;['get', 'post', 'put', 'delete', 'patch'].forEach(method => {
    app[method] = function(path, handler) {
      app._router.addRoute(method.toUpperCase(), path, handler)
    }
  })

  app.listen = function(port, cb) {
    const server = http.createServer(app)
    server.listen(port, cb)
  }

  return app
}

module.exports = createApplication
```

这里有几个关键点：

- **`app` 是一个函数，同时也是一个对象**。JavaScript 中函数本身就是对象，可以挂载属性和方法。`app` 既能作为 `http.createServer` 的回调，又能通过 `app.get()`、`app.use()` 注册路由和中间件。
- **`app.listen` 的内部实现**就是 `http.createServer(app)`，这正印证了前文的结论——Express 的本质就是增强回调函数。
- **HTTP 方法通过遍历动态注册**，而不是为每个方法手写一遍。这也是 Express 源码中的实际做法（遍历 `methods` 数组）。
- **所有操作都委托给 `app._router`**。Application 层本身不处理路由逻辑，只是一层薄封装。

### 3.4 Router：中间件管道的核心

```js
// router/index.js
const Layer = require('./layer')
const Route = require('./route')

function Router() {
  this.stack = []
}

// 注册中间件
Router.prototype.use = function(path, handler) {
  const layer = new Layer(path, handler)
  this.stack.push(layer)
}

// 注册路由（特定 HTTP 方法 + 路径）
Router.prototype.addRoute = function(method, path, handler) {
  const route = new Route(path)
  route.addHandler(method, handler)

  const layer = new Layer(path, function(req, res, next) {
    route.dispatch(req, res, next)
  })
  layer.route = route

  this.stack.push(layer)
}

// 请求处理入口：遍历 stack，依次匹配执行
Router.prototype.handle = function(req, res) {
  let index = 0
  const stack = this.stack

  function next(err) {
    const layer = stack[index++]

    if (!layer) {
      res.statusCode = err ? 500 : 404
      res.end(err ? 'Internal Server Error' : 'Not Found')
      return
    }

    if (err) {
      // 有错误时，跳过普通中间件，寻找错误处理中间件（4 参数）
      if (layer.handle.length === 4) {
        layer.handle(err, req, res, next)
      } else {
        next(err)
      }
      return
    }

    if (layer.match(req.url)) {
      try {
        layer.handle(req, res, next)
      } catch (e) {
        next(e)
      }
    } else {
      next()
    }
  }

  next()
}

module.exports = Router
```

Router 内部维护一个 `stack` 数组，存储的每一项都是 `Layer` 对象。这里的 "stack" 并非数据结构中的栈，而是一个**有序列表**——请求会从第一个 Layer 开始，依次向下匹配执行。

`Router.prototype.handle` 是整个框架的调度核心，其中 `next` 函数的设计值得重点理解：

- **正常流程**：`next()` 无参数调用，继续执行下一个 Layer
- **错误流程**：`next(err)` 传入错误对象，会**跳过所有普通中间件**，直到找到一个 4 参数的错误处理中间件
- **异常捕获**：`try-catch` 包裹 `layer.handle` 的调用，确保同步抛出的异常不会导致进程崩溃

### 3.5 Layer：路径匹配与 handler 封装

```js
// router/layer.js
function Layer(path, handler) {
  this.path = path
  this.handle = handler
  this.route = null
}

Layer.prototype.match = function(url) {
  if (this.path === '/') return true
  return url === this.path || url.startsWith(this.path + '/')
}

module.exports = Layer
```

Layer 是一个**装饰对象**，将路径和处理函数封装在一起。每个 Layer 都有一个 `match` 方法用于路径匹配：

- 中间件的 Layer：`route` 属性为 `null`，`handle` 就是中间件函数本身
- 路由的 Layer：`route` 属性指向对应的 Route 实例，`handle` 是 `route.dispatch` 的封装

路径匹配采用**前缀匹配**策略（`startsWith`），这意味着注册在 `/api` 上的中间件会匹配 `/api/users`、`/api/posts` 等所有子路径。而 Express 的真实实现中使用了 `path-to-regexp` 库来支持参数路由（如 `/users/:id`）。

### 3.6 Route：同路径多方法的分发器

```js
// router/route.js
function Route(path) {
  this.path = path
  this.stack = []
}

Route.prototype.addHandler = function(method, handler) {
  this.stack.push({ method, handler })
}

Route.prototype.dispatch = function(req, res, next) {
  const method = req.method
  const matched = this.stack.find(layer => layer.method === method)

  if (matched) {
    matched.handler(req, res, next)
  } else {
    res.statusCode = 405
    res.end('Method Not Allowed')
  }
}

module.exports = Route
```

Route 同样维护一个 `stack`，但存储的是 `{ method, handler }` 对。当 Router 的 Layer 匹配到路径后，会调用 `route.dispatch`，再根据 HTTP 方法做二次匹配：

- 路径匹配 `/users` + 方法匹配 `GET` → 执行对应 handler
- 路径匹配 `/users` + 方法不匹配 → 返回 405

这就是 Express 的**两级匹配**设计：Router 层按路径匹配，Route 层按方法匹配。

## 四、错误处理机制

Express 的错误处理是一个实际开发中的重要兜底逻辑。在 mini-express 中我们已经实现了基础版本，下面展开讲解。

### 4.1 错误中间件的特征

Express 通过**函数参数个数**来区分普通中间件和错误中间件：

```js
// 普通中间件：3 个参数
app.use((req, res, next) => {
  console.log('普通中间件')
  next()
})

// 错误中间件：4 个参数，第一个是 err
app.use((err, req, res, next) => {
  console.error('捕获到错误:', err.message)
  res.statusCode = 500
  res.end('Internal Server Error')
})
```

Express 内部通过 `fn.length` 判断参数个数。当 `fn.length === 4` 时，该中间件被视为错误处理器。这就是为什么错误中间件的 4 个参数**一个都不能省略**，即使你不需要 `next`，也必须写上：

```js
// 错误！只有 3 个参数，Express 会当作普通中间件
app.use((err, req, res) => { ... })

// 正确：必须保留全部 4 个参数
app.use((err, req, res, next) => { ... })
```

### 4.2 错误传播链

`next(err)` 是触发错误处理流程的开关。一旦调用，请求会**跳过后续所有普通中间件和路由**，直到遇到第一个错误中间件：

```
middleware1 → middleware2 → route1 → errorMiddleware
                ↑ next(err)                ↑ 直接跳到这里
```

在我们的 `Router.prototype.handle` 中，这个逻辑体现为：

```js
if (err) {
  if (layer.handle.length === 4) {
    layer.handle(err, req, res, next)  // 找到错误中间件，执行
  } else {
    next(err)  // 不是错误中间件，继续跳过
  }
  return
}
```

### 4.3 实际应用示例

```js
const app = express()

app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`)
  next()
})

app.get('/api/data', (req, res, next) => {
  try {
    const data = JSON.parse('invalid json')
    res.end(JSON.stringify(data))
  } catch (e) {
    next(e)  // 将错误传递给错误中间件
  }
})

// 错误处理中间件，放在所有路由之后
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.statusCode = 500
  res.end(JSON.stringify({ error: err.message }))
})
```

## 五、架构总览

### 5.1 三层模型

下图展示了 Express 的核心架构——Router、Route、Layer 三层模型的关系：

<img src="https://cdn.jsdelivr.net/gh/yumiaomiao2025/my-image-hosting@main/images/express-architecture-1773676913267-qru28z.png" alt="Express 架构图：Router-Route-Layer 三层模型" width="90%" />

整个架构可以概括为：

| 层级 | 职责 | stack 内容 |
|------|------|-----------|
| **Router** | 管理中间件和路由的执行顺序 | Layer 对象（中间件 Layer + 路由 Layer） |
| **Route** | 管理同一路径下不同 HTTP 方法的 handler | `{ method, handler }` 对象 |
| **Layer** | 封装路径匹配逻辑 + handler 引用 | —（叶子节点） |

### 5.2 请求的完整生命周期

一个请求从进入到响应，经历以下流程：

1. `http.Server` 收到请求，调用 `app(req, res)`
2. `app` 委托给 `app._router.handle(req, res)`
3. Router 从 `stack[0]` 开始遍历：
   - **中间件 Layer**：路径匹配 → 执行 handler → 调用 `next()` 进入下一个 Layer
   - **路由 Layer**：路径匹配 → 调用 `route.dispatch(req, res, next)`
4. Route 在自己的 `stack` 中按 HTTP 方法查找匹配的 handler 并执行
5. 如果任何环节调用 `next(err)`，流程跳转到最近的错误中间件
6. 如果 stack 耗尽仍未响应，返回 404

### 5.3 核心设计思想：中间件管道

Express 的核心思想是 **Middleware Pipeline（中间件管道）**。每个请求都像水流一样通过一系列管道节点，每个节点可以：

- **处理请求**并直接响应（终止流程）
- **修改 req/res**后调用 `next()` 传递给下一个节点
- **抛出错误**触发 `next(err)` 跳转到错误处理节点

这种设计实现了关注点分离——日志、鉴权、解析、业务逻辑、错误处理各司其职，通过 `next()` 串联。

## 六、实践启示

通过理解 Express 的内部架构，我们可以在实际开发中做出更好的决策：

**1. 中间件的注册顺序至关重要**

Router 按 stack 顺序遍历，所以通用中间件（如日志、CORS、body 解析）必须注册在路由之前，错误处理中间件必须注册在最后：

```js
// 正确顺序
app.use(logger)           // 日志
app.use(cors())           // CORS
app.use(express.json())   // Body 解析
app.get('/api/users', handler)  // 业务路由
app.use(errorHandler)     // 错误处理（最后）
```

**2. 路径匹配是前缀匹配**

Router 层的 Layer 使用前缀匹配，`/api` 会匹配 `/api`、`/api/users`、`/api/posts` 等。如果有多条相似路径的路由，精确路径应放在前面：

```js
app.get('/api/users/me', getMeHandler)      // 先注册精确路径
app.get('/api/users/:id', getUserHandler)   // 再注册参数路径
```

**3. 中间件中务必调用 `next()` 或发送响应**

忘记调用 `next()` 且不发送响应，请求会永远挂起（hang），客户端最终超时。这是 Express 开发中最常见的 bug 之一。

**4. 错误中间件必须写满 4 个参数**

Express 依赖 `fn.length` 判断是否为错误中间件。即便你不需要 `next`，也不能省略，否则它会被当作普通中间件，错误将无法被捕获。

---

*本文通过 mini-express 还原了 Express 框架的核心架构。真实的 Express 源码在此基础上还包含更多特性（参数路由、子路由器 `express.Router()`、内容协商等），但核心的 Router → Layer → Route 三层模型和中间件管道机制是不变的。理解了这些，阅读 Express 源码就不再困难。*
