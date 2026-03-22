1、是不是不能在回调函数里面随便写 next和 return啊？
是的，return的本质上是js层面的终结当前函数的调用（所以绝对不会执行函数内这条语句后面的内容）
next是express层面的，它的作用是是控制route stack的接下去进行下一个layer(所以该语句执行之后，只是流程进入下一个中间件，但是这条语句之后的语句还是会继续执行的，因为这个回调函数并没有结束，还在函数栈上，只是新推入了一个next新函数调用)
常常容易犯错的是这种
既不 next 也不结束响应
app.use((req,res,next)=>{
  console.log('hello')
})
直接导致的结果就是没有任何下文，而一个请求我们要做的决定是一定要返回的，对的告诉对方对了，错了告诉对方错了，而不是石沉大海，没有下文，那样对于一个请求连接来说是很不利的，浪费资源
第二种错误是这种
既不 next 也不结束响应
app.use((req,res,next)=>{
  next()
  console.log('我还在执行')
})
导致的问题就是，后面加的逻辑有可能并不是我们想加的，或者是异步的那就更加容易出现一些诡异的逻辑了，比如你后面的中间件改了数据，这里异步做了其他处理，那就左右脑互搏了
第三种是：res.end 之后还 next
比如：
app.get('/', (req,res,next)=>{
  res.end('ok')
  next()
})
这会出现，明明结束了请求，pipeline还在继续，会报错的，因为请求已经发出去，已经结束了，下个话题讲讲res.end代表了什么，怎么终止pipeline

安全的操作是
纯 middleware
app.use((req,res,next)=>{
  // 做点事
  return next()
})
return next()代表的是  next（） return；也即是呆会进入下一个middleware，然后中止当前回调函数，不要做下面的操作了
终止型 handler 典型的就是路由啦
app.get('/', (req,res)=>{
  return res.end('ok')
})
根本不需要next
条件分支类型就是：
app.use((req,res,next)=>{
  if(!req.user){
    return res.end('no auth')
  }
  return next()
})

说白了，良好的书写习惯就是：
框架层面：
这个分支是：
1 继续（next）
还是
2 结束（res.end / res.send）
回调函数层面：
return

---

2、第二个问题：res.end或者res.send背后调用了什么？为什么能结束请求，结束pipeline
其实本质上，我们express是一个js函数流，而http是底层的一个请求流
res.end() 并不会“结束 pipeline”
它只是结束 HTTP 响应
pipeline 停，是因为你没有再 next()
res.end是node的http模块的函数，代表着对一个请求的终结，也就是结束响应，而res.send只是express对res.end的一个包装而已，加了些东西
res.end能结束请求是因为Node.js 内部 C++/libuv 层的响应结束逻辑
http协议是：request → response → 结束，
当调用res.end 浏览器收到：
HTTP/1.1 200 OK
Content-Length: ...
<数据>
然后 连接进入 keep-alive 或关闭
客户端的角度：请求已经完成
这就是一个成功的请求和响应，而不是长时间没响应，触发请求的保底逻辑，只是失败的

pipeline为什么会停止呢？
Express 的 pipeline 是这样：
layer → handler(req,res,next)
控制权完全在：
你有没有调用 next()
那我们之前为什么要说在中间件的时候，要next呢？在路由响应中不要next呢
因为中间件本质上是一个对这个响应的中间处理，所以你要做的是尽可能的不做任何路由响应，所以哪怕是出错了，你要做的也是next(err)抛给真正的错误中间件，这是唯一一个推荐坐路由处理的中间件；在路由响应中不要next的原因是，你负责的工作就是最后的响应返回，你就是这条请求链路上的最后一环，你要做的就是响应返回，让客户端知道你的响应信息（不管是没找到东西，或者没权限或者其他的，这都是合理的信息，不能让这个请求一直搁置着），所以除了next(err)，你就应该返回res.end

---

3、如何正确的结束一个请求，应该不是靠不调用next吧？
路由响应就应该直接res.end或者next(err)是吧？然后这个后面不应该再有操作了，涉及到分支，就是res.end之后return
写个标准示范：
app.get('/', (req,res,next)=>{
  if(!req.user){
    return res.status(401).end('unauthorized')
  }
  if(somethingWrong){
    return next(new Error('boom'))
  }
  return res.end('ok')
})
不要多次响应，响应之后，不应该再做其他操作，pipeline就应该结束

4、那如果我要处理如果发送成功之后再记录一次响应记录或者失败之后重新发送并记录一条失败记录应该怎么操作？
首先很遗憾的说明http是一个一次性通信，也就是说一次请求一次响应，你不能响应多次，你唯一能做的是请求那一边的客户端因为没有得到正确的响应来触发第二次请求
至于响应之后的处理，不应该在express的工作流中处理，而是应该在node的http模块本身做处理，说人话就是在res.end之前，你就应该对这个底层的res做回调处理操作的编写，就这么简单，这是一个经典的回调前置操作
app.use((req, res, next) => {
  const start = Date.now()
  res.on('finish', () => {
    const duration = Date.now() - start
    console.log({
      url: req.url,
      method: req.method,
      status: res.statusCode,
      duration
    })
    // 写日志 / 打点 / 上报
  })
  next()
})
finish → 正常结束
close  → 连接断了（可能失败）

5、all方法是怎样的一种存在？
all并不是在route stack里面将所有的方法都注册一遍，而是注册一个叫all的layer，所以上一个版本的mini express我们的dispatch的判断准确点应该是 if(layer.method === method || layer.method === 'ALL');

6、  /a /a/b 哪个应该写在前面？
如果请求是 /a /a/b的前缀匹配呢？
路由中间件是精确匹配？方法中间件是前缀匹配？
是的，中间件层，也就是app.use这种，都是前缀匹配，如果是路由层，比如app.get/post/all这种，就是精确匹配。
所以中间件层，只要前缀匹配上都会执行，但是路由层是不需要担心路由前缀匹配上了请求就结束了

7、
```
app.get('/user/:id', (req, res, next) => {
  if (req.params.id === '0') {
    return next('route')
  }
  res.send(`User${req.params.id}`)
})
```
是什么操作？
next(anything)通常是跳过剩余router stack的layer，然后进入后面的错误中间件，但是有两个硬编码的特别的关键字，'route'和'router'
后者很少用，前者的作用就是当前route的handler不再执行(当然也需要return)，继续下一个route layer（解决一个方法下多个fn处理函数是否继续）
举个例子：
```
app.get('/user',
  (req, res, next) => {
    if (!req.user) {
      return next('route'); // 没登录，走另一个逻辑
    }
    next();
  },
  (req, res) => {
    res.send('已登录用户');
  }
);

app.get('/user', (req, res) => {
  res.send('游客');
});
```
next('router')等后面解除了express router之后再谈

8、有哪些响应对象 (`res`) 的方法可以向客户机发送响应，并终止请求/响应循环？如果没有从路由处理程序调用其中任何方法，客户机请求将保持挂起状态，挂起的危害是什么？
浏览器一直 loading
Node 连接数被占满
高并发直接把你拖死
用户以为你网站“卡了”
常见的res的结束请求响应的方法有：
res.send -- 会自动判断类型，设置Content-Type，最省心
res.json -- 会自动设置Content-Type为application/json，自动 JSON.stringify
res.redirect -- 会自动设置301/302，写Location，重定向到指定URL
res.sendFile -- 直接把文件丢给客户端
res.download -- 强制下载
res.render -- 模板引擎渲染完直接发
res.end -- node原生，不带任何贴心操作，也是以上express封装的所有方法的底层实现

9、res.download 和 res.sendFile的区别？
本质区别是一个HTTP头，Content-Disposition的设置不同
res.sendFile('/path/to/file.pdf')
发送效果
Content-Type: application/pdf
（没有 Content-Disposition）
浏览器行为：
能预览就预览（PDF、图片、txt）
不能预览才下载
res.download('/path/to/file.pdf')
发送效果
Content-Type: application/pdf
Content-Disposition: attachment; filename="file.pdf"
浏览器行为：
强制下载
弹保存框
其实，res.download 就是 res.sendFile 的封装，只是设置了 Content-Disposition 而已:res.set('Content-Disposition', 'attachment; filename=xxx')
一个展示，一个拿走



