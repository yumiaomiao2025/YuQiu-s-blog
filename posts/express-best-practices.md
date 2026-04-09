---
title: Express 最佳实践：构建可维护的后端项目
date: 2026-04-05
category: 后端
tags: [Express, Node.js, 最佳实践, 项目架构]
readTime: 18 min
slug: express-best-practices
excerpt: Express 架构原理系列收尾篇。从项目分层、中间件组织、错误处理、请求验证、安全防护到测试与部署，梳理构建可维护 Express 后端项目的工程实践。
---

## 前言

本文是 Express 架构原理系列的收尾篇。前几篇我们深入了 Express 的内部机制——路由匹配、中间件栈、请求/响应生命周期等。理解了「它是怎么跑的」之后，这篇来聊一个更实际的问题：**一个 Express 后端项目，应该怎么写？**

---

## 一、为什么需要最佳实践

Express 的核心设计哲学是 **unopinionated**——它不强制你用什么目录结构，不规定你怎么分层。写一个 `app.js` 塞下所有路由和逻辑，照样能跑。

但当项目规模增长，问题会接踵而至：

- 路由、业务逻辑、数据访问全部混在一起，改一个功能要翻遍整个文件
- 错误处理各写各的，线上出了问题难以定位
- 没有统一的校验和安全策略，到处是隐患
- 新人加入团队，看代码如读天书

最佳实践的本质不是教条，而是一套**经过大量项目验证的工程共识**——让代码可读、可测、可扩展。

---

## 二、项目目录结构

一个推荐的中大型 Express 项目目录结构如下：

```
project/
├── src/
│   ├── app.js                  # Express 应用实例（挂载中间件、路由）
│   ├── server.js               # 启动入口（监听端口、处理未捕获异常）
│   ├── routes/                 # 路由定义
│   │   ├── index.js            # 路由汇总注册
│   │   ├── user.routes.js
│   │   └── order.routes.js
│   ├── controllers/            # 控制器（请求 → 响应）
│   │   ├── user.controller.js
│   │   └── order.controller.js
│   ├── services/               # 业务逻辑层
│   │   ├── user.service.js
│   │   └── order.service.js
│   ├── models/                 # 数据模型 / DAO
│   │   ├── user.model.js
│   │   └── order.model.js
│   ├── middlewares/            # 自定义中间件
│   │   ├── auth.js
│   │   ├── validate.js
│   │   └── errorHandler.js
│   ├── utils/                  # 工具函数
│   │   ├── AppError.js
│   │   ├── catchAsync.js
│   │   └── response.js
│   └── config/                 # 配置文件
│       ├── index.js
│       └── database.js
├── tests/                      # 测试文件
│   ├── unit/
│   └── integration/
├── .env                        # 环境变量（不要提交到 Git）
├── .env.example                # 环境变量模板
├── package.json
└── README.md
```

**核心原则：按职责分目录，而不是按功能模块分目录。** 当项目更大时，也可以采用模块化分组（如 `modules/user/`、`modules/order/`），每个模块内自含 route、controller、service、model，但分层的思想不变。

---

## 三、分层架构设计

分层是整个最佳实践的核心。其目的是让每一层只关心自己该做的事。

### 请求处理流程

```mermaid
flowchart LR
    Client([客户端]) --> Router
    Router[Route 层] --> Controller[Controller 层]
    Controller --> Service[Service 层]
    Service --> Model[Model / DAO 层]
    Model --> DB[(数据库)]
    DB --> Model
    Model --> Service
    Service --> Controller
    Controller --> Client
```

### 3.1 Route 层：只做路由映射

Route 层的职责是 **定义 URL → Controller 的映射关系**，不包含任何业务逻辑。

```js
// src/routes/user.routes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { auth } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');
const { createUserSchema, updateUserSchema } = require('../validators/user.validator');

router.post('/', validate(createUserSchema), userController.create);
router.get('/', auth, userController.getAll);
router.get('/:id', auth, userController.getById);
router.put('/:id', auth, validate(updateUserSchema), userController.update);
router.delete('/:id', auth, userController.remove);

module.exports = router;
```

路由汇总注册，并加上版本前缀：

```js
// src/routes/index.js
const express = require('express');
const router = express.Router();

const userRoutes = require('./user.routes');
const orderRoutes = require('./order.routes');

router.use('/users', userRoutes);
router.use('/orders', orderRoutes);

module.exports = router;

// 在 app.js 中挂载
app.use('/api/v1', router);
```

### 3.2 Controller 层：提取参数、调用 Service、返回响应

Controller 是 HTTP 层和业务逻辑层之间的桥梁。它从 `req` 中提取参数，调用 Service，然后将结果封装为 HTTP 响应返回给客户端。

**Controller 不应该包含业务逻辑。** 判断、计算、数据组合这些事情都应该下沉到 Service 层。

```js
// src/controllers/user.controller.js
const userService = require('../services/user.service');
const { success, created } = require('../utils/response');

exports.create = async (req, res, next) => {
  try {
    const user = await userService.createUser(req.body);
    return created(res, user, '用户创建成功');
  } catch (err) {
    next(err);
  }
};

exports.getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, keyword } = req.query;
    const result = await userService.getUsers({ page, limit, keyword });
    return success(res, result);
  } catch (err) {
    next(err);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const user = await userService.getUserById(req.params.id);
    return success(res, user);
  } catch (err) {
    next(err);
  }
};
```

统一响应格式的工具函数：

```js
// src/utils/response.js
exports.success = (res, data, message = 'ok') => {
  res.status(200).json({ code: 0, message, data });
};

exports.created = (res, data, message = 'created') => {
  res.status(201).json({ code: 0, message, data });
};

exports.fail = (res, statusCode, message, errors = null) => {
  res.status(statusCode).json({ code: 1, message, errors });
};
```

### 3.3 Service 层：核心业务逻辑

Service 是整个应用最重要的一层。所有业务规则、数据组合、权限判断都在这里。

**Service 不依赖 `req` 和 `res`**——它只接收纯数据参数，返回纯数据结果。这使得 Service 可以被 Controller、定时任务、脚本等多种入口复用，也更容易编写单元测试。

```js
// src/services/user.service.js
const User = require('../models/user.model');
const AppError = require('../utils/AppError');

exports.createUser = async (data) => {
  const existing = await User.findByEmail(data.email);
  if (existing) {
    throw new AppError('该邮箱已被注册', 409);
  }
  const user = await User.create(data);
  return user;
};

exports.getUserById = async (id) => {
  const user = await User.findById(id);
  if (!user) {
    throw new AppError('用户不存在', 404);
  }
  return user;
};

exports.getUsers = async ({ page, limit, keyword }) => {
  const { users, total } = await User.findAll({ keyword, page: Number(page), limit: Number(limit) });
  return { users, total, page: Number(page), limit: Number(limit) };
};
```

### 3.4 Model / DAO 层：数据访问

Model 层负责定义数据结构和数据库交互。以 PostgreSQL + `pg` 为例。

首先配置数据库连接池：

```js
// src/config/database.js
const { Pool } = require('pg');
const config = require('./index');

const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 20,                // 连接池最大连接数
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

module.exports = pool;
```

建表 SQL（可在项目中维护一份 `migrations/001_create_users.sql`）：

```sql
CREATE TABLE users (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(30)  NOT NULL,
  email       VARCHAR(255) NOT NULL UNIQUE,
  password    VARCHAR(255) NOT NULL,
  role        VARCHAR(10)  NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
```

然后以 DAO 模式封装数据访问——每个函数对应一个数据库操作，上层只需调用函数，不接触 SQL：

```js
// src/models/user.model.js
const pool = require('../config/database');
const bcrypt = require('bcryptjs');

exports.findByEmail = async (email) => {
  const { rows } = await pool.query(
    'SELECT * FROM users WHERE email = $1',
    [email]
  );
  return rows[0] || null;
};

exports.create = async ({ name, email, password, role = 'user' }) => {
  const hashedPassword = await bcrypt.hash(password, 12);
  const { rows } = await pool.query(
    `INSERT INTO users (name, email, password, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, email, role, created_at`,
    [name, email, hashedPassword, role]
  );
  return rows[0];
};

exports.findById = async (id) => {
  const { rows } = await pool.query(
    'SELECT id, name, email, role, created_at FROM users WHERE id = $1',
    [id]
  );
  return rows[0] || null;
};

exports.findAll = async ({ keyword, page, limit }) => {
  const offset = (page - 1) * limit;
  const conditions = keyword
    ? { text: 'WHERE name ILIKE $1', params: [`%${keyword}%`] }
    : { text: '', params: [] };

  const dataQuery = `
    SELECT id, name, email, role, created_at FROM users
    ${conditions.text}
    ORDER BY created_at DESC
    LIMIT $${conditions.params.length + 1} OFFSET $${conditions.params.length + 2}
  `;
  const countQuery = `SELECT COUNT(*) FROM users ${conditions.text}`;

  const [dataResult, countResult] = await Promise.all([
    pool.query(dataQuery, [...conditions.params, limit, offset]),
    pool.query(countQuery, conditions.params),
  ]);

  return {
    users: dataResult.rows,
    total: parseInt(countResult.rows[0].count, 10),
  };
};

exports.comparePassword = async (candidatePassword, hashedPassword) => {
  return bcrypt.compare(candidatePassword, hashedPassword);
};
```

### 各层职责对照

| 层级 | 职责 | 依赖 req/res？ | 示例操作 |
|------|------|:--------------:|----------|
| Route | URL 映射 + 中间件挂载 | 是 | `router.get('/users', ...)` |
| Controller | 参数提取 + 响应封装 | 是 | `req.body` → Service → `res.json()` |
| Service | 业务逻辑 + 数据编排 | **否** | 校验规则、组合查询、抛业务异常 |
| Model / DAO | 数据结构 + 数据库操作 | **否** | `User.create()`、`User.findById()` |

---

## 四、中间件最佳实践

### 4.1 中间件注册顺序

中间件的注册顺序直接影响执行顺序，推荐按以下顺序组织：

```js
// src/app.js
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const routes = require('./routes');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

// 1. 安全相关（最先执行）
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));

// 2. 请求限流
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { code: 1, message: '请求过于频繁，请稍后再试' },
}));

// 3. 请求解析
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

// 4. 压缩 & 日志
app.use(compression());
app.use(morgan('combined'));

// 5. 业务路由
app.use('/api/v1', routes);

// 6. 404 处理
app.all('*', (req, res) => {
  res.status(404).json({ code: 1, message: `找不到 ${req.originalUrl}` });
});

// 7. 全局错误处理（必须放在最后）
app.use(errorHandler);

module.exports = app;
```

### 4.2 自定义认证中间件

```js
// src/middlewares/auth.js
const jwt = require('jsonwebtoken');
const AppError = require('../utils/AppError');
const config = require('../config');

exports.auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return next(new AppError('未提供认证令牌', 401));
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = decoded;
    next();
  } catch (err) {
    return next(new AppError('认证令牌无效或已过期', 401));
  }
};

exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new AppError('无权执行此操作', 403));
    }
    next();
  };
};
```

---

## 五、错误处理

错误处理是后端项目质量的分水岭。一个好的错误处理体系需要做到三件事：

1. **对客户端**：返回统一格式的错误响应
2. **对开发者**：提供足够的上下文定位问题
3. **对系统**：防止未捕获异常导致进程崩溃

### 5.1 自定义 AppError

```js
// src/utils/AppError.js
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true; // 区分：业务错误 vs 编程 bug
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
```

`isOperational` 的作用是区分两类错误：

- **操作错误（Operational Error）**：用户输入错误、资源不存在、权限不足——这些是预期中的，客户端可以处理
- **编程错误（Programming Error）**：`TypeError`、`ReferenceError`——这些是 bug，应该记日志并告警

### 5.2 全局错误处理中间件

```js
// src/middlewares/errorHandler.js
const logger = require('../utils/logger');

module.exports = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;

  // 记录错误日志
  logger.error({
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
  });

  // 开发环境：返回完整错误栈
  if (process.env.NODE_ENV === 'development') {
    return res.status(err.statusCode).json({
      code: 1,
      message: err.message,
      stack: err.stack,
    });
  }

  // 生产环境：操作错误返回具体信息，编程错误返回通用提示
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      code: 1,
      message: err.message,
    });
  }

  return res.status(500).json({
    code: 1,
    message: '服务器内部错误',
  });
};
```

### 5.3 异步错误捕获

每个 async Controller 都手写 `try/catch` 太啰嗦。封装一个高阶函数来统一处理：

```js
// src/utils/catchAsync.js
module.exports = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};
```

使用后 Controller 简化为：

```js
const catchAsync = require('../utils/catchAsync');

exports.getAll = catchAsync(async (req, res) => {
  const result = await userService.getUsers(req.query);
  return success(res, result);
});
```

不需要再写 `try/catch`，所有 reject 的 Promise 都会被自动传递到错误处理中间件。

### 5.4 进程级兜底

```js
// src/server.js
const app = require('./app');
const config = require('./config');
const logger = require('./utils/logger');

const server = app.listen(config.port, () => {
  logger.info(`Server running on port ${config.port} [${config.env}]`);
});

// 未捕获的 Promise rejection
process.on('unhandledRejection', (err) => {
  logger.error('UNHANDLED REJECTION:', err);
  server.close(() => process.exit(1));
});

// 未捕获的同步异常
process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION:', err);
  process.exit(1);
});
```

---

## 六、请求验证

永远不要信任客户端传来的数据。使用 `Joi` 进行声明式校验：

### 6.1 定义校验规则

```js
// src/validators/user.validator.js
const Joi = require('joi');

exports.createUserSchema = Joi.object({
  name: Joi.string().min(2).max(30).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).max(128).required(),
  role: Joi.string().valid('user', 'admin'),
});

exports.updateUserSchema = Joi.object({
  name: Joi.string().min(2).max(30),
  email: Joi.string().email(),
}).min(1); // 至少有一个字段
```

### 6.2 校验中间件

```js
// src/middlewares/validate.js
const AppError = require('../utils/AppError');

exports.validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,   // 返回所有错误，而非遇到第一个就停
      stripUnknown: true,   // 自动过滤掉 schema 中未定义的字段
    });

    if (error) {
      const messages = error.details.map((d) => d.message).join('; ');
      return next(new AppError(messages, 400));
    }

    req.body = value; // 使用经过清洗的数据
    next();
  };
};
```

---

## 七、安全防护

### 7.1 常见威胁与防护

| 威胁 | 防护手段 |
|------|---------|
| XSS（跨站脚本） | `helmet` 设置 CSP 头；输入转义 |
| SQL 注入 | 参数化查询（`$1, $2`）；Joi 校验过滤 |
| CSRF | 使用 SameSite Cookie；添加 CSRF Token |
| 暴力破解 | `express-rate-limit` 限流 |
| 敏感信息泄露 | 生产环境关闭 stack trace；`helmet` 移除 `X-Powered-By` |

### 7.2 Helmet 配置

```js
const helmet = require('helmet');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: true,
}));
```

### 7.3 环境变量管理

绝对不要将密钥硬编码在代码中。使用 `dotenv` 管理环境变量：

```bash
# .env（不提交到 Git）
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/myapp
JWT_SECRET=your-super-secret-key
JWT_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:5173
```

```js
// src/config/index.js
require('dotenv').config();

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 3000,
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
};
```

同时维护一份 `.env.example` 作为文档，标明需要配置哪些变量（值留空或使用示例值）。

---

## 八、日志与监控

### 8.1 使用 Winston 进行分级日志

```js
// src/utils/logger.js
const { createLogger, format, transports } = require('winston');

const logger = createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.json()
  ),
  transports: [
    new transports.Console({
      format: format.combine(format.colorize(), format.simple()),
    }),
    // 生产环境写入文件
    ...(process.env.NODE_ENV === 'production'
      ? [
          new transports.File({ filename: 'logs/error.log', level: 'error' }),
          new transports.File({ filename: 'logs/combined.log' }),
        ]
      : []),
  ],
});

module.exports = logger;
```

### 8.2 请求日志

结合 `morgan` 和 `winston`，让所有 HTTP 请求日志统一归集：

```js
const morgan = require('morgan');
const logger = require('./utils/logger');

const stream = { write: (message) => logger.info(message.trim()) };

app.use(morgan('combined', { stream }));
```

### 日志等级参考

| 等级 | 用途 |
|------|------|
| `error` | 系统错误、未捕获异常 |
| `warn` | 潜在问题（如接口废弃警告） |
| `info` | 关键业务事件（用户注册、订单创建） |
| `debug` | 开发阶段的调试信息 |

---

## 九、配置管理

### 9.1 环境隔离

不同环境（开发、测试、生产）的配置应该分离。推荐方式：以环境变量为主，配置文件为辅。

```js
// src/config/index.js
require('dotenv').config();

const config = {
  // 公共配置
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 3000,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  // 数据库（不同环境可指向不同实例）
  databaseUrl: process.env.DATABASE_URL,

  // 日志级别
  logLevel: process.env.LOG_LEVEL || 'debug',
};

// 必填项校验：启动时就暴露配置缺失问题
const requiredVars = ['DATABASE_URL', 'JWT_SECRET'];
for (const varName of requiredVars) {
  if (!process.env[varName]) {
    throw new Error(`环境变量 ${varName} 未配置`);
  }
}

module.exports = config;
```

启动时校验必填环境变量是一个非常值得推荐的实践——比运行到一半再报错要好得多。

---

## 十、测试

### 10.1 测试目录组织

```
tests/
├── unit/                   # 单元测试（测 Service 层）
│   └── user.service.test.js
├── integration/            # 集成测试（测 API 端到端）
│   └── user.api.test.js
└── helpers/
    └── setup.js            # 测试环境初始化
```

### 10.2 Service 层单元测试（Jest）

```js
// tests/unit/user.service.test.js
const userService = require('../../src/services/user.service');
const User = require('../../src/models/user.model');

jest.mock('../../src/models/user.model');

describe('UserService', () => {
  afterEach(() => jest.clearAllMocks());

  describe('createUser', () => {
    it('邮箱已存在时应抛出 409 错误', async () => {
      User.findByEmail.mockResolvedValue({ email: 'test@test.com' });

      await expect(
        userService.createUser({ email: 'test@test.com', name: 'test', password: '123456' })
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it('正常创建用户', async () => {
      User.findByEmail.mockResolvedValue(null);
      User.create.mockResolvedValue({ id: 1, name: 'test', email: 'test@test.com' });

      const user = await userService.createUser({
        name: 'test',
        email: 'test@test.com',
        password: '123456',
      });

      expect(user).toHaveProperty('id');
      expect(User.create).toHaveBeenCalledTimes(1);
    });
  });
});
```

### 10.3 API 集成测试（supertest）

```js
// tests/integration/user.api.test.js
const request = require('supertest');
const app = require('../../src/app');
const pool = require('../../src/config/database');

beforeAll(async () => {
  // 确保测试表存在
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(30) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(10) NOT NULL DEFAULT 'user',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
});

afterAll(async () => {
  await pool.query('DROP TABLE IF EXISTS users');
  await pool.end();
});

describe('POST /api/v1/users', () => {
  it('参数不合法时返回 400', async () => {
    const res = await request(app)
      .post('/api/v1/users')
      .send({ name: '' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(1);
  });

  it('正常创建用户返回 201', async () => {
    const res = await request(app)
      .post('/api/v1/users')
      .send({ name: 'Alice', email: 'alice@test.com', password: '123456' });

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('name', 'Alice');
  });
});
```

---

## 十一、部署与进程管理

### 11.1 健康检查接口

无论使用哪种部署方式，都应该提供健康检查端点：

```js
// 在 app.js 中注册（放在业务路由之前）
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});
```

### 11.2 PM2 部署

PM2 是 Node.js 生产环境最常用的进程管理工具，支持集群模式、自动重启、日志管理。

```js
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'my-express-app',
      script: './src/server.js',
      instances: 'max',          // 使用所有 CPU 核心
      exec_mode: 'cluster',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      max_memory_restart: '500M',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
    },
  ],
};
```

```bash
# 启动
pm2 start ecosystem.config.js --env production

# 查看状态
pm2 status

# 查看日志
pm2 logs
```

### 11.3 Docker 化

```dockerfile
# Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY src/ ./src/

EXPOSE 3000

USER node

CMD ["node", "src/server.js"]
```

配合 `.dockerignore`：

```
node_modules
tests
logs
.env
.git
```

---

## 十二、总结

回顾全文，Express 最佳实践可以提炼为以下几条核心原则：

1. **分层解耦** — Route → Controller → Service → Model，每层职责单一
2. **Controller 薄、Service 厚** — 业务逻辑集中在 Service 层，Controller 只做胶水
3. **统一错误处理** — 自定义 AppError + 全局错误中间件 + 进程级兜底
4. **输入不可信** — 所有外部输入经过 Joi/express-validator 校验
5. **安全先行** — helmet、cors、rate-limit、环境变量管理缺一不可
6. **日志分级** — 用 winston 替代 console.log，区分 error/warn/info/debug
7. **配置外置** — 通过环境变量管理配置，启动时校验必填项
8. **测试保障** — Service 层单元测试 + API 集成测试，对核心逻辑建立信心
9. **生产就绪** — PM2 集群模式 + Docker 容器化 + 健康检查端点

Express 的灵活性是它最大的优势，也是最大的挑战。好的架构不是框架给的，是工程师设计出来的。希望这篇文章能为你搭建 Express 项目提供一个可靠的起点。

---

*本文是 Express 深入系列的收尾篇。[第一篇](/blog/express-architecture)讲三层架构，[第二篇](/blog/express-in-practice)讲控制流，[第三篇](/blog/express-router-deep-dive)讲子路由器与路由边界行为，本篇从工程实践的角度出发，梳理了构建可维护 Express 后端项目的核心原则。希望这个系列能帮你从「会用 Express」走向「真正理解 Express」。*
