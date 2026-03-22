1、app.route方法
它到底是个啥
是一个给同一路径注册不同的http方法，比如以下用法：
app.route('/user')
  .get(fn1)
  .post(fn2)
  .put(fn3)
来源是 Router.prototype.route
内部等价于：
const route = new Route('/user');

app._router.stack.push(
  new Layer('/user', route.dispatch)
);

return route;
然后
route.get(fn1)
route.post(fn2)
就相当于 route.stack.push({method: 'get', handler: fn1})
route.stack.push({method: 'post', handler: fn2})
需要注意的是
app.get('/user', fn1, fn2)
是一个 route
多个 handler（同一个方法）
而app.route('/user')
.get(fn1)
.get(fn2)
是一个 route
多个方法（同一个路径）
另外，
app.route('/user').get(fn1).post(fn2)
和app.get('/user', fn1) and app.post('/user', fn2)
的结构也不太一样，
前者是
Layer1 (/user) → route
    ├── GET → fn1
    ├── POST → fn2
    ├── PUT → fn3
后者是
Layer1 (/user) → route1 --> fn1
Layer2 (/user) → route2 --> fn2

2、深入express.router  返回的相当于什么？里面mini版本是什么？
这里需要问自己三个问题：
express.Router() 是不是 new Router()？
express 上是不是挂了 Router？
app 里的 Router 和 express.Router 是不是同一个？

实际上：
是的，express.Router === Router（同一个构造函数）
express.Router() 本质就是 new Router() 的语法糖（内部帮你处理了 new）
app 里的 _router 和你手动 express.Router() 用的是同一个类
所以啊，express.Router()返回的这个实例上，和app里的_router，都是同一个类，同一个stack，同一个dispatch方法，唯一缺少的就是一些专门绑定在app上的比如listen之类的http方法和set之类的全局配置方法
express主入口大概相当于：
const createApplication = require('./lib/express')
const Router = require('./lib/router')

function express() {
  return createApplication()
}

express.Router = Router

而根据我们之前的mini-express中，app.use的第二个参数实际是handler，也就是说app.use(path, express.Router())等价于app.use(path, handler)，这里Router调用之后也是返回一个handler，这个handler实际上就是(req, res, next)=>router.handle(req, res, next)，然后使用router.use也好，router.get也好其实处理方法和app那一套一样，就是给router.stack添加layer，然后调用router.handle(req, res, next)

所以next('router')，对于一个app stack的 layer(md1), layer(router1), layer(md2), layer(router2)来说，在router1调用是不是会跳过router1中的剩余layer，也会跳过app中的md2直接到router2？还是只是跳过router1中的剩余lalyer？
实际上是，对于
app._router.stack:
    Layer(md1)
    Layer(router1)
        Layer(route1)
        Layer(router1-md1)
    Layer(md2)
    Layer(router2)

在 router1 里调用 next('router')，会跳过 router1 中的剩余 layer（route1和router1-md1），回到app stack，继续执行app中的md2，然后router2

3、如果一个router stack多个同名路径的路由layer会怎么样？
比如：
app.get('/user', fn1)
app.get('/user', fn2)
会怎么样？
实际上是，对于
app._router.stack:
    ├──Layer(/user, route1) --> fn1
    └──Layer(/user, route2) --> fn2

如果fn1中有next()，将会执行下一个中间件，也就是fn2；如果没有，fn2将不会执行

4、一个route stack多个同名方法？
比如：
app.get('/user', fn1, fn2)
会怎么样？
实际上是，对于
route.stack:
    ├──{method: 'get', handler: fn1}
    └──{method: 'get', handler: fn2}
如果fn1中有next()，将会执行下一个method，也就是fn2；如果没有，fn2将不会执行；
还有一种比较好玩的是这种：
app.route('/a')
  .get(fn1)
  .post(fn2)
  .get(fn3)

实际上是，对于
route.stack:
    ├──{method: 'get', handler: fn1}
    ├──{method: 'post', handler: fn2}
    └──{method: 'get', handler: fn3}
如果fn1中有next()，将会执行下一个method，也就是fn3；为什么是fn3，因为匹配的时候是GET方法，POST根本不会匹配，所以链式回到下一个匹配上的方法