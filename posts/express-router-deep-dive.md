---
title: Express 深入：app.route()、子路由器与路由边界行为
date: 2026-03-22
category: 后端
tags: [Express, Node.js, Router, 源码]
readTime: 14 min
slug: express-router-deep-dive
excerpt: 深入剖析 app.route() 的链式注册机制、express.Router() 子路由器的挂载与路径剥离原理、next('route') 与 next('router') 的跳跃行为，以及同路径/同方法叠加的边界表现。
---

## 前言

在[第一篇](/blog/express-architecture)中，我们手写 mini-express 还原了 Router → Layer → Route 三层模型；在[第二篇](/blog/express-in-practice)中，我们用九问九答拆解了 `next()`、`return`、`res.end()` 的控制流陷阱。

架构懂了，控制流也清楚了——但 Express 还有几个"看似简单、实则暗藏玄机"的 API 没有展开：

- `app.route()` 到底做了什么？和分开注册有什么结构差异？
- `express.Router()` 返回的是什么？它和 `app._router` 是什么关系？
- `next('route')` 和 `next('router')` 分别跳到哪里？
- 同一路径注册多个路由、同一 Route 注册多个同名方法，调度行为是什么？

本篇逐一拆解。


---


## 一、app.route()：同路径多方法的链式注册

### 1.1 用法

`app.route()` 允许你对**同一路径**链式注册不同的 HTTP 方法：

```js
app.route('/user')
  .get(getUser)
  .post(createUser)
  .put(updateUser)
```

### 1.2 内部原理

`app.route()` 来自 `Router.prototype.route`，内部做了两件事：

```js
Router.prototype.route = function(path) {
  const route = new Route(path)
  const layer = new Layer(path, route.dispatch.bindTo(route))
  layer.route = route
  this.stack.push(layer)
  return route
}
```

1. 创建一个新的 `Route` 实例
2. 用这个 Route 的 `dispatch` 方法创建一个 `Layer`，推入 Router 的 `stack`
3. 返回 `route` 实例——所以后续的 `.get()`、`.post()` 调用都是在这个 Route 上操作

链式调用 `.get(fn1).post(fn2).put(fn3)` 的效果等价于：

```js
route.stack.push({ method: 'GET', handler: fn1 })
route.stack.push({ method: 'POST', handler: fn2 })
route.stack.push({ method: 'PUT', handler: fn3 })
```

所有 handler 共享**同一个 Layer**，在 Route 内部按 HTTP 方法做二次分发。

### 1.3 与分开注册的结构差异

这是一个很容易忽略的区别。看这两种写法：

**写法 A：`app.route()` 链式注册**

```js
app.route('/user')
  .get(fn1)
  .post(fn2)
```

**写法 B：分别调用 `app.get()` / `app.post()`**

```js
app.get('/user', fn1)
app.post('/user', fn2)
```

看起来效果一样，但内部数据结构完全不同：

```
写法 A —— 一个 Layer，一个 Route：

app._router.stack:
  └── Layer('/user') → Route
                          ├── { method: 'GET',  handler: fn1 }
                          └── { method: 'POST', handler: fn2 }


写法 B —— 两个 Layer，两个 Route：

app._router.stack:
  ├── Layer('/user') → Route1 → { method: 'GET',  handler: fn1 }
  └── Layer('/user') → Route2 → { method: 'POST', handler: fn2 }
```

**差异的实际影响：**

- **遍历开销**：写法 A 只需匹配一次路径，然后在 Route 内部按方法分发；写法 B 如果 GET 不匹配（比如收到 POST 请求），还要继续遍历 stack 才能找到下一个 Layer。对路径一样、方法不同的路由而言，`app.route()` 的路径匹配次数更少。
- **`next('route')` 的作用域**：写法 A 中调用 `next('route')` 会跳过整个 Route（包括 GET 和 POST 的 handler），进入 Router stack 的下一个 Layer；写法 B 中调用 `next('route')` 只跳过当前 Route，下一个 Layer 仍然是 `/user` 的另一个 Route。

### 1.4 app.get('/user', fn1, fn2) 的内部结构

还有一种容易混淆的写法——同一方法传入多个 handler：

```js
app.get('/user', fn1, fn2)
```

这也只创建**一个 Route**，但两个 handler 是相同方法：

```
app._router.stack:
  └── Layer('/user') → Route
                        ├── { method: 'GET', handler: fn1 }
                        └── { method: 'GET', handler: fn2 }
```

Express 源码中，`app.get()` 会把所有 handler 参数 flatten 后逐个推入 Route 的 stack。执行时，fn1 调用 `next()` 会进入 fn2；如果 fn1 不调用 `next()`，fn2 不会执行。

三种写法的对比总结：

| 写法 | Router stack 中的 Layer 数 | Route 数 | handler 分发方式 |
|------|---------------------------|----------|-----------------|
| `app.route('/user').get(fn1).post(fn2)` | 1 | 1 | 按 HTTP 方法 |
| `app.get('/user', fn1)` + `app.post('/user', fn2)` | 2 | 2 | 各自独立 |
| `app.get('/user', fn1, fn2)` | 1 | 1 | 同方法顺序执行 |

其实本质就是不同的用法创建的对应的逻辑结构

---


## 二、express.Router()：模块化路由的核心

### 2.1 三个关键问题

要理解 `express.Router()`，先回答三个问题：

> **Q1**：`express.Router()` 是不是 `new Router()`？
> **A**：是。`express.Router` 就是 Router 构造函数本身，调用 `express.Router()` 内部会帮你处理 `new`。

> **Q2**：`express` 对象上是不是挂了 `Router`？
> **A**：是。Express 入口文件中有 `exports.Router = Router`。

> **Q3**：`app._router` 和手动创建的 `express.Router()` 是不是同一个类的实例？
> **A**：是。它们共享同一个原型——`Router.prototype`，拥有同样的 `stack`、同样的 `handle` 方法、同样的路由注册 API。

Express 主入口的关键代码简化后大致是：

```js
const Router = require('./router')

function createApplication() {
  const app = function(req, res) { app.handle(req, res) }
  app._router = new Router()
  // ... 挂载 use、get、post、listen 等方法
  return app
}

exports = module.exports = createApplication
exports.Router = Router
```

所以 `express.Router()` 返回的实例和 `app._router` 是同一个类——唯一的区别是 `app` 上额外挂载了 `listen`、`set`、`engine` 等 Application 层方法。**子路由器是一个"没有 HTTP 服务器外壳的 app"**。

### 2.2 子路由器的挂载机制

子路由器通过 `app.use()` 挂载到父路由器上：

```js
const router = express.Router()

router.get('/list', listUsers)
router.post('/create', createUser)

app.use('/api/users', router)
```

回顾第一篇中 `app.use(path, handler)` 的实现——它创建一个 Layer，将 `handler` 作为 `layer.handle` 推入 stack。这里的 `handler` 就是子路由器实例。

那子路由器为什么能当 handler 用？因为 `Router()` 返回的实例本身就是一个 `(req, res, next) => void` 函数：

```js
function Router() {
  function router(req, res, next) {
    router.handle(req, res, next)
  }
  router.stack = []
  // ... 挂载 prototype 方法
  return router
}
```

所以 `app.use('/api/users', router)` 等价于 `app.use('/api/users', (req, res, next) => router.handle(req, res, next))`——父路由器匹配到路径后，把控制权交给子路由器的 `handle` 方法，子路由器再在自己的 stack 中遍历匹配。

挂载后的完整结构：

```
app._router.stack:
  ├── Layer(middleware1)
  ├── Layer('/api/users') → router (子路由器)
  │                           ├── Layer('/list')   → Route → { GET: listUsers }
  │                           └── Layer('/create') → Route → { POST: createUser }
  └── Layer(middleware2)
```

### 2.3 路径剥离（Path Stripping）

子路由器有一个非常重要的行为——**路径剥离**。当请求 `GET /api/users/list` 到达时：

1. 父路由器匹配 Layer 路径 `/api/users`——前缀匹配成功
2. 父路由器将 `req.url` 中的前缀 `/api/users` **临时剥离**，只保留 `/list`
3. 子路由器拿到的 `req.url` 是 `/list`，在自己的 stack 中匹配 `/list`——命中
4. 子路由器处理完毕后，`req.url` 恢复原值

Express 源码中的关键逻辑（简化）：

```js
if (layer.match(req.url)) {
  const originalUrl = req.url
  req.url = req.url.slice(layer.path.length)  // 剥离前缀

  layer.handle(req, res, function(err) {
    req.url = originalUrl  // 恢复
    next(err)
  })
}
```

这就是为什么子路由器内部的路由只需要写**相对路径**——挂载点的前缀已经被父路由器剥离了。你不需要在子路由器里写 `/api/users/list`，只需要写 `/list`。

### 2.4 独立的中间件作用域

每个子路由器都有自己独立的 `stack`，这意味着你可以为不同模块注册**局部中间件**：

```js
const adminRouter = express.Router()
const publicRouter = express.Router()

adminRouter.use(authMiddleware)  // 只对 admin 路由生效
adminRouter.get('/dashboard', dashboardHandler)
adminRouter.get('/settings', settingsHandler)

publicRouter.get('/about', aboutHandler)
publicRouter.get('/contact', contactHandler)

app.use('/admin', adminRouter)
app.use('/', publicRouter)
```

`authMiddleware` 只存在于 `adminRouter.stack` 中，不会影响 `publicRouter` 下的路由。这比在每个路由 handler 里手动判断权限要优雅得多。


---


## 三、next('route') vs next('router')：两种跳跃

第二篇讨论过 `next()` 的三种调用方式。这里单独展开 `next('route')` 和 `next('router')` 的区别——它们名字只差一个字母，行为却截然不同。

### 3.1 next('route')：跳过当前 Route 的剩余 handler

`next('route')` 的作用域是 **Route 内部**。它跳过当前 Route 中尚未执行的 handler，回到 Router stack 继续匹配下一个 Layer。

```js
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
```

执行流程：

```
GET /dashboard (未登录)

app._router.stack:
  Layer('/dashboard') → Route1
                          ├── handler1: 检查 req.user → next('route') ← 跳过 Route1 剩余 handler
                          └── handler2: 发送"欢迎回来"      ← 被跳过
  Layer('/dashboard') → Route2
                          └── handler3: 发送"请先登录"      ← 继续执行
```

### 3.2 next('router')：跳出整个子路由器

`next('router')` 的作用域是**整个子路由器**。它终止当前子路由器的遍历，将控制权交还给**父路由器的下一个 Layer**。

```js
const apiRouter = express.Router()

apiRouter.use((req, res, next) => {
  if (!req.headers['x-api-key']) {
    return next('router')  // 没有 API key，跳出整个 apiRouter
  }
  next()
})

apiRouter.get('/data', (req, res) => {
  res.json({ data: 'secret' })
})

app.use('/api', apiRouter)

app.use('/api', (req, res) => {
  res.status(403).json({ error: 'API key required' })
})
```

执行流程（无 API key 时）：

```
GET /api/data (无 x-api-key)

app._router.stack:
  Layer('/api') → apiRouter (子路由器)
                      ├── middleware: 检查 API key → next('router') ← 跳出整个子路由器
                      └── route('/data'): 返回数据      ← 被跳过
  Layer('/api') → fallback handler     ← 回到父 stack，继续执行
                      └── 返回 403
```

关键区别：`next('router')` 不仅跳过了子路由器中的剩余中间件和路由，还**回到了父路由器的控制流**。

### 3.3 对比总结

| 调用方式 | 跳过什么 | 跳到哪里 | 典型场景 |
|----------|---------|---------|---------|
| `next()` | 无 | 当前 Route 的下一个 handler，或 Router stack 的下一个 Layer | 正常传递 |
| `next('route')` | 当前 Route 的剩余 handler | Router stack 中下一个匹配的 Layer | 同路径多组 handler 的条件分流 |
| `next('router')` | 当前子路由器的所有剩余 Layer | 父路由器 stack 的下一个 Layer | 子路由器整体跳过，回退到 fallback |
| `next(err)` | 所有普通中间件和路由 | 最近的错误中间件（4 参数） | 错误处理 |

一个常见误解：在子路由器中调用 `next('router')` 不会跳过父路由器的后续 Layer——它只是跳出子路由器，父路由器照常从下一个 Layer 继续遍历。

```
app._router.stack:
  Layer(middleware1)
  Layer('/api') → apiRouter
                      ├── route1      ← next('router') 在这里调用
                      └── middleware2  ← 被跳过
  Layer(middleware3)    ← 正常执行（不会被跳过）
  Layer('/other') → otherRouter  ← 正常执行
```


---


## 四、边界行为：同路径 / 同方法的叠加

### 4.1 Router stack 中多个同路径 Layer

```js
app.get('/user', fn1)
app.get('/user', fn2)
```

内部结构：

```
app._router.stack:
  ├── Layer('/user') → Route1 → { GET: fn1 }
  └── Layer('/user') → Route2 → { GET: fn2 }
```

Router 遍历 stack 时按顺序匹配。当 `GET /user` 到达：

- 匹配第一个 Layer，执行 `fn1`
- 如果 `fn1` 中调用了 `next()`，继续遍历，匹配第二个 Layer，执行 `fn2`
- 如果 `fn1` **没有**调用 `next()`（直接 `res.send()` 了），`fn2` 不会执行

这就是为什么 Express 中路由注册的**顺序决定优先级**——先注册的先匹配。

### 4.2 同一 Route 中多个同方法 handler

```js
app.get('/user', fn1, fn2)
```

内部结构：

```
route.stack:
  ├── { method: 'GET', handler: fn1 }
  └── { method: 'GET', handler: fn2 }
```

行为和 4.1 类似：`fn1` 调用 `next()` 则 `fn2` 执行，不调用则不执行。区别在于这两个 handler 共享同一个 Route 和同一个 Layer，`next('route')` 会同时跳过它们俩。

### 4.3 链式注册中的方法过滤

这是一个有趣的边界情况：

```js
app.route('/resource')
  .get(fn1)
  .post(fn2)
  .get(fn3)
```

内部结构：

```
route.stack:
  ├── { method: 'GET',  handler: fn1 }  // index 0
  ├── { method: 'POST', handler: fn2 }  // index 1
  └── { method: 'GET',  handler: fn3 }  // index 2
```

当 `GET /resource` 到达时，Route 的 `dispatch` 会遍历 stack，**逐个检查 method 是否匹配**：

1. index 0：`GET === GET` ✓ → 执行 `fn1`
2. `fn1` 调用 `next()` → 继续遍历
3. index 1：`POST === GET` ✗ → 跳过
4. index 2：`GET === GET` ✓ → 执行 `fn3`

所以 `fn1` 中调用 `next()` 后，下一个执行的是 `fn3`，而不是 `fn2`——因为 `fn2` 是 POST 方法，GET 请求根本匹配不上。

这个行为的本质是：Route.dispatch 内部维护了一个 index，通过 `next()` 推进遍历，但在每一步都会做 **method 过滤**。Express 源码中的关键逻辑（简化）：

```js
Route.prototype.dispatch = function(req, res, done) {
  const method = req.method.toLowerCase()
  let index = 0
  const stack = this.stack

  function next(err) {
    const layer = stack[index++]
    if (!layer) return done(err)

    if (layer.method && layer.method !== method) {
      return next(err)  // 方法不匹配，跳过
    }

    layer.handle(req, res, next)
  }

  next()
}
```

这和 Router 级别的 `handle` 逻辑如出一辙——都是"遍历 stack + 条件过滤 + next 推进"的模式。


---


## 五、实战模式：用 Router 组织大型项目

理解了 `express.Router()` 的原理后，来看它在实际项目中如何发挥作用。

### 5.1 典型的模块化目录结构

```
src/
├── app.js              # 主入口，挂载各模块路由
├── routes/
│   ├── users.js        # /api/users/*
│   ├── posts.js        # /api/posts/*
│   └── auth.js         # /auth/*
└── middleware/
    ├── auth.js         # 鉴权中间件
    └── logger.js       # 日志中间件
```

### 5.2 路由模块的标准写法

```js
// routes/users.js
const router = require('express').Router()

router.get('/', listUsers)
router.get('/:id', getUser)
router.post('/', createUser)
router.put('/:id', updateUser)
router.delete('/:id', deleteUser)

module.exports = router
```

```js
// app.js
const express = require('express')
const app = express()

const usersRouter = require('./routes/users')
const postsRouter = require('./routes/posts')
const authRouter = require('./routes/auth')

app.use(express.json())
app.use(logger)

app.use('/api/users', usersRouter)
app.use('/api/posts', postsRouter)
app.use('/auth', authRouter)

app.use(errorHandler)
```

每个路由文件只关心自己模块内的**相对路径**（路径剥离的功劳），不需要知道自己被挂载在哪个前缀下。这意味着你可以随时更改挂载点：

```js
// 把用户模块从 /api/users 迁移到 /v2/users，路由文件零修改
app.use('/v2/users', usersRouter)
```

### 5.3 路由器嵌套

子路由器可以嵌套子路由器，形成多级路由树：

```js
// routes/admin.js
const adminRouter = express.Router()
const adminUsersRouter = express.Router()
const adminPostsRouter = express.Router()

adminUsersRouter.get('/', listAdminUsers)
adminPostsRouter.get('/', listAdminPosts)

adminRouter.use(adminAuthMiddleware)
adminRouter.use('/users', adminUsersRouter)
adminRouter.use('/posts', adminPostsRouter)

module.exports = adminRouter
```

```js
// app.js
app.use('/admin', adminRouter)
```

请求 `GET /admin/users/` 的路径剥离过程：

```
app._router:       /admin/users/  → 匹配 /admin，剥离为 /users/
adminRouter:       /users/        → 匹配 /users，剥离为 /
adminUsersRouter:  /              → 匹配 /，执行 listAdminUsers
```

每一层路由器只看到属于自己的那一段路径。


---


## 总结

本文围绕三个核心主题展开：

**1. app.route() 的本质**

`app.route(path)` 创建一个 Route + 一个 Layer，后续的链式调用（`.get()`、`.post()`）将 handler 添加到同一个 Route 的 stack 中。与分开注册相比，减少了 Router stack 中的 Layer 数量，路径匹配只需一次。

**2. express.Router() 的本质**

`express.Router()` 返回的子路由器和 `app._router` 是同一个类的实例，拥有同样的 stack、handle、use 等能力。子路由器通过 `app.use(path, router)` 挂载，利用路径剥离机制让内部路由只需关注相对路径。每个子路由器有独立的中间件作用域，是大型项目模块化的基石。

**3. 路由边界行为的确定性**

Express 路由系统的一切行为都可以从"遍历 stack + 条件匹配 + next 推进"这个模型推导出来：同路径多 Layer 按注册顺序执行、同 Route 多 handler 按 method 过滤后顺序执行、`next('route')` 跳出 Route、`next('router')` 跳出子路由器。没有魔法，只有有序遍历。

---

*本文是 Express 深入系列的第三篇。第一篇讲三层架构，第二篇讲控制流，本篇讲子路由器与路由边界行为。至此，Express 的核心机制已经基本覆盖——从 `http.createServer` 的回调增强，到 Router/Layer/Route 的三层分发，到 next() 驱动的中间件管道，再到子路由器的模块化挂载。掌握了这些，无论是排查问题还是阅读源码，都不会再觉得 Express "黑箱"了。*
