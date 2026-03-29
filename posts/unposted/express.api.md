express api

1、app.use(express.json())干了啥，为什么需要解析，以及解析前和解析后的数据长什么样子？

如果前端发送数据

```jsx
POST /api/user
Content-Type: application/json

{"name":"秋秋","age":18}
```

req本质是可读流，

正常来说你要获取 http的body信息是需要这样的

```jsx
// 伪代码
let body = ''

req.on('data', chunk => {
  body += chunk
})

req.on('end', () => {
  req.body = JSON.parse(body)
  next()
})
```

express本质做了这件事情

```jsx
// 伪代码
let body = ''

req.on('data', chunk => {
  body += chunk
})

req.on('end', () => {
  req.body = JSON.parse(body)
  next()
})
```

简而言之就是收集流数据，得到文本：'{"name":"秋秋","age":18}’ , 然后解析成成对象，然后赋值到 req.body身上，再next()，如果你没这个处理，访问req.body自然是 undefined

另外要注意，前后端发送数据是要对齐协议（Content-Type）的，网络只认字符串/字节，所以如下：

| 前端发送 | Content-Type | 后端解析 |
| --- | --- | --- |
| JSON字符串 | application/json | express.json() |
| 表单字符串 | application/x-www-form-urlencoded | express.urlencoded() |
| 文件 | multipart/form-data | multer 等 |

前端发送前要序列化成字符串，后端要解析字符串，很多时候工具帮你擦屁股而已

常用的options属性

```jsx
app.use(express.json({
  limit: '1mb', // 限制最大数据
  strict: true, // 解析后的数据只能为数组或者对象
  type: 'application/json' // 只接受 application/json格式
}))
```

2、**express.raw使用来干嘛的？**

处理：

- 支付系统
- 第三方回调
- 安全相关/签名校验

的，能够得到原始的 raw，（一般是加密的hash）而不是解析之后的 raw（解析会破坏它的原始性）

所以epress.json不要全局使用，要分路径使用，不然express.json之后，数据流就已经被消费了

3、express.router支持什么options

```jsx
const router = express.Router({
	caseSensitive: false,  // 不区分路径大小写
	strict: false,         // 不严格匹配结尾/ 比如：/user/  和 /user 都能匹配 /user
	mergeParams: true      // 能拿到父路由参数
})
```

4、为什么express说为了获得最佳效果，建议[使用反向代理](https://expressjs.com/en/advanced/best-practice-performance.html#use-a-reverse-proxy)缓存来提升静态资产的服务性能，那express.static存在的必要是什么？

首先要明确：

Express 的定位是：

👉 处理请求逻辑（路由 / 中间件 / API）

不是：

👉 高性能静态资源服务器

换言之，如果每次请求静态文件都走express，会极大的消耗nodejs的资源，导致：

- 并发高 → Node 被拖慢
- 静态资源多 → CPU / IO 被浪费
- 本来该处理 API 的资源被占了

所以除非是有复杂权限的文件，我们需要走express这一套，一般情况下，我们都应该利用反向代理，比如 nginx或者一些 cdn 去分流，根本走不到express身上

一般对于静态文件是

方案一：Nginx 直接处理静态资源

浏览器 → Nginx → 文件

方案二：CDN（更狠一点）

浏览器 → CDN →（缓存命中）→ 直接返回
                                            ↓
                                        源站（Nginx / OSS）

5、express.urlencoded是处理什么的？我一直没分清楚

处理下面这种 ，这种请求体很像 URL里面的query请求参数，但是那个是req.query拿的

```jsx
POST /api
Content-Type: application/x-www-form-urlencoded

name=秋秋&age=18
```

表单默认就是发送这种类型的数据

---

app api

1、几个常见的app的性质，包括app.locals和app.mountpath和app.router简述下作用？

res.app和req.app是能够拿到app的。。。

app.locals可以用来放一些全局性的变量，比如app.locals.siteName = '秋秋の小破站';然后在模板中可以使用；

放一些

app.locals.config = {

cdn: 'https://cdn.xxx.com',

version: '1.0.0'

};

这种，然后在中间件中可以用req.app.locals.config.cdn拿到，不建议放动态的数据，动态性的可以放到res.locals

app.mountpath是用来看app挂载的路径的，要分清req.path和app.mountpath

```jsx
app.use('/api', subApp);

subApp.get('/user', (req, res) => {
  console.log(req.path);        // /user 请求当前剩余路径
  console.log(req.baseUrl);     // /api  请求当前匹配的挂载路径
  console.log(subApp.mountpath);// /api  子应用当前挂载的路径
});
```

app.router就是Router的实例，也就是app._router，一般不建议直接使用它，现代的做法是express.router单独分出一个路由系统，然后作为app._router.stack中的一个layer

2、

app.engine('ejs', require('ejs').__express);

app.set('view engine', 'ejs');

做了啥？

“当你看到 `.ejs` 文件时，用这个函数来渲染它”

“默认模板后缀用 .ejs”，写res.render('index');的时候，自动补充，index.ejs

不同于中间件，更像是工具，指的是，当遇到 res.render的时候，找到渲染引擎和文件，然后渲染完毕发送

3、**app.listen(path   的应用场景在哪？**

简单来说就是node的http底层服务器也是支持监听unix路径的，所以相比于同一个服务器的两个服务通过端口的tcp(有可能加上http)来通信，通过文件来请求通信更快

4、app.set是啥？有啥用？

`app.set` 是 Express 的“全局配置中心”，既能控制框架行为，也能存自定义配置，它存的东西一般是全局性的配置，不要拿来当全局变量用，因为里面有些变量是express内部会去获取的

获取的时候用app.get，常见的用法示例像下面：

```jsx
app.set('view engine', 'ejs');
app.set('view', './template')
app.set('config', {
  cdn: 'https://cdn.xxx.com'
});

app.get('/test', (req, res) => {
  const config = req.app.get('config');
  res.send(config);
});

app.get('/user/:id', (req, res) => {
	res.render('id')
})
```

---

req api

1、req.cookie是什么？干了什么？

客户端是这么发送的：

```jsx
Cookie: token=abc123; theme=dark; uid=42
```

http原生拿到的是 req.headers.cookie 是 "token=abc123; theme=dark; uid=42”

cookie-parser中间件解析之后是
req.cookies  = {

token: abc123,

theme: dark,

uid: 42

}

# res api

1、res.append和res.set有什么区别？

- `res.set()`：**覆盖（overwrite）**
- `res.append()`：**追加（append）**
- 90%情况：用 `res.set()`
👉 简单、明确、不容易出事故
- 特定场景（比如 cookie、多 header）：用 `res.append()`

res.append('Set-Cookie', 'a=1')

res.append('Set-Cookie', 'b=2')

会得到

Set-Cookie: a=1

Set-Cookie: b=2

2、res.downfile，res.attachment和res.sendfile什么关系？

res.sendFile实际上干了
res.attachment

res.sendfile

两件事

3、res.cookie有哪些常用参数？

## 🧠 `res.cookie(name, value, options)` 结构

```
res.cookie('token','abc123', {/* options */ })
```

重点全在第三个参数 `options`，这玩意儿决定了 cookie 是“安全小可爱”还是“安全事故”。

---

## 🍪 常见参数（别全记，记重点）

### 1️⃣ `maxAge`（常用）

```
res.cookie('token','abc', { maxAge:1000*60*60 })
```

👉 存活时间（毫秒）

- 1小时后自动失效
- 浏览器帮你删

💡 和 `expires` 类似，但：

- `maxAge` 更现代
- `expires` 是具体时间点（老派但还在用）

---

### 2️⃣ `httpOnly`（非常重要）

```
res.cookie('token','abc', { httpOnly:true })
```

👉 JS 访问不到 cookie（比如 `document.cookie`）

防什么？

👉 **XSS 攻击偷 cookie**

💡 登录态 cookie 基本必开

---

### 3️⃣ `secure`（生产必备）

```
res.cookie('token','abc', { secure:true })
```

👉 只在 HTTPS 传输

HTTP 下不会发送

💡 否则你就是在裸奔

---

### 4️⃣ `sameSite`（现在很关键）

```
res.cookie('token','abc', { sameSite:'lax' })
```

可选值：

- `'strict'` 👉 最严格，跨站完全不带
- `'lax'` 👉 默认，部分跨站允许（比如 GET）
- `'none'` 👉 完全允许跨站（⚠️必须配 `secure: true`）

👉 防 **CSRF 攻击**

---

### 5️⃣ `domain`

```
res.cookie('token','abc', { domain:'.example.com' })
```

👉 哪些域名能用这个 cookie

- `.example.com` 👉 子域共享
- `api.example.com` 👉 只给这个子域

---

### 6️⃣ `path`

```
res.cookie('token','abc', { path:'/api' })
```

👉 哪些路径带这个 cookie

- `/` 👉 全站
- `/api` 👉 只有 API 请求才带

---

### 7️⃣ `expires`（老派但常见）

```
res.cookie('token','abc', { expires:newDate(Date.now()+3600000) })
```

👉 具体过期时间

---

### 8️⃣ `signed`（需要中间件）

```
res.cookie('token','abc', { signed:true })
```

👉 启用签名（防篡改）

前提：

```
app.use(cookieParser('secret'))
```

否则你以为加密了，其实只是自我安慰。

---

## 🧩 一个现实世界配置（登录态）

```
res.cookie('token','abc123', {
  httpOnly:true,
  secure:true,
  sameSite:'lax',
  maxAge:1000*60*60*24*7// 7天
})
```

👉 这是“还算不丢人”的配置

---

## 🧨 常见翻车现场

### ❌ 忘记 `httpOnly`

👉 前端一行 XSS 直接拿走 token

---

### ❌ `sameSite: none` 但没 `secure`

👉 浏览器直接无视 cookie（你还以为是 bug）

---

### ❌ `domain` 配错

👉 cookie 根本不生效

你会开始怀疑人生，其实只是你写错了域名

---

### ❌ 以为 cookie 是“安全存储”

👉 不是

👉 它只是“客户端帮你带着的字符串”

4、res.end是直接返回，res.send会完善什么呢？有帮忙识别错误状态码？

`res.send()` 不会自动识别“失败”
res.send做的是：

- 设置 `Content-Type`
- 序列化数据

帮你识别：

res.send('hello')        // text/html

res.send({ a: 1 })       // application/json

res.send(Buffer.from())  // 二进制

标准写法：
res.status(400).send({ error: '参数错误' })

另外：

👉 HTTP 状态码 ≠ 业务状态码

- HTTP：协议层（成功/失败）
- JSON：业务层（你自己定义）

你写个

res.send({ code: 500, msg: '失败' })

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

5、res.redirect干了啥

```jsx
比如后端发送
res.redirect('/login')

相当于
res.status(302)
res.set('Location', '/login')
res.end()

前端接收到
HTTP/1.1 302 Found
Location: /login

浏览器自动发起新请求
GET /login
```

这个自动不一定的，如果是：

用户在地址栏输入URL

点击 <a href>

表单提交

这些是浏览器主线程请求，接收到响应头之后会自动跳转

然是如果是js发请求，如axios和 fetch这种，是需要自己处理的，浏览器不会帮你做自动跳转，只是告诉你响应头而已

6、res.vary其实挺关键的，虽然不常用，但是如果涉及到文件缓存相关的，会非常关键

---

res api

1、res.path、res.baseUrl、res.originalUrl 的区别是什么，怎么区分；

一个例子说明一切：

```jsx
const app = express();
const r1 = express.Router();
const r2 = express.Router();

app.use('/a', r1);
r1.use('/b', r2);

r2.get('/c', (req, res) => {
  console.log('baseUrl:', req.baseUrl);
  console.log('path:', req.path);
  console.log('originalUrl:', req.originalUrl);
});
```

请求： GET /a/b/c

结果是：

```jsx
baseUrl: /a/b
path: /c
originalUrl: /a/b/c
```

也就是 baseUrl是会累加的，path是当前的，originalUrl是实际的；

res.originalUrl = res.baseUrl + res.path

```jsx
每一层 router：
  baseUrl += 当前 mount path
  path = 剩余路径
  
baseUrl = 所有 mount path 叠加
path    = 当前 router 看到的“剩余”
originalUrl = 永远不变
```