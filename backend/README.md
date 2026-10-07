# Chirp Backend — Spring Cloud 微服务架构

> Chirp 社交平台后端，基于 Spring Cloud + Spring Cloud Alibaba 构建的微服务系统。

## 技术栈

| 组件 | 版本 | 说明 |
|------|------|------|
| Spring Boot | 3.4.4 | 基础框架 |
| Spring Cloud | 2024.0.0 | 微服务治理 |
| Spring Cloud Alibaba | 2023.0.3.2 | Nacos 注册/配置中心 |
| Spring Cloud Gateway | — | API 网关（WebFlux） |
| Nacos Server | 2.4.3 | 服务发现与配置管理 |
| PostgreSQL | 17.11 | 持久化存储 |
| Hibernate / JPA | 6.6.11 | ORM |
| BCrypt | — | 密码哈希 |
| RSA-2048 OAEP | — | 传输层密码加密 |

## 项目结构

```
backend/
├── pom.xml                          ← 父POM（统一版本管理 + 模块聚合）
├── chirp-common/                    ← 公共模块
│   ├── model/
│   │   ├── User.java                ← 用户实体（JPA）
│   │   ├── AuthDTO.java             ← 认证 DTO（请求/响应 record）
│   │   └── ServiceConstants.java    ← 微服务常量（服务名、路由前缀）
│   └── util/
│       └── PasswordEncoderUtil.java ← BCrypt 密码编码器单例
├── chirp-gateway/                   ← API 网关
│   ├── GatewayApplication.java      ← 启动类（@EnableDiscoveryClient）
│   ├── config/CorsConfig.java       ← 网关跨域配置（CorsWebFilter）
│   └── application.yml              ← 路由规则 + Nacos 配置
└── chirp-auth/                      ← 认证服务
    ├── AuthApplication.java         ← 启动类（@EnableDiscoveryClient）
    ├── controller/AuthController.java← 认证接口（注册/登录/公钥）
    ├── config/CryptoKeyService.java ← RSA-2048 密钥对管理
    ├── config/DataInitializer.java  ← 测试数据初始化
    ├── repository/UserRepository.java← 用户 JPA Repository
    └── application.yml              ← 数据源 + Nacos 配置
```

## 模块说明

### chirp-common（公共模块）

跨服务共享的实体、DTO、工具类与常量。新增微服务时，如需复用 User 实体或 AuthDTO，直接依赖此模块即可。

- **User.java** — 用户实体，映射 PostgreSQL `users` 表，含 BCrypt 哈希字段
- **AuthDTO.java** — 认证相关请求/响应 record（RegisterRequest、LoginRequest、AuthResponse 等）
- **ServiceConstants.java** — 微服务常量（服务名、路由前缀），避免硬编码散落各处
- **PasswordEncoderUtil.java** — BCryptPasswordEncoder 单例封装，统一密码哈希/校验入口

### chirp-gateway（API 网关）

基于 Spring Cloud Gateway（WebFlux）的统一入口，负责路由转发、跨域处理。

- 路由规则：`/api/auth/**` → `lb://chirp-auth`（基于 Nacos 服务发现的负载均衡路由）
- 跨域配置：统一在网关层处理 CORS，微服务无需单独配置
- **注意**：Gateway 基于 Netty + WebFlux，不可引入 `spring-boot-starter-web`

### chirp-auth（认证服务）

用户注册、登录、RSA 公钥下发、密码管理。

- **注册流程**：前端 RSA 加密 → 后端 RSA 解密 → 密码长度校验 → 邮箱唯一性检查 → BCrypt 哈希入库
- **登录流程**：前端 RSA 加密 → 后端 RSA 解密 → 按邮箱查找用户 → BCrypt 匹配
- **RSA 密钥**：服务启动时内存生成 RSA-2048 密钥对，重启即轮换
- **Nacos 注册**：服务启动后自动注册到 Nacos，网关通过服务发现路由到此服务

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/auth/public-key` | 获取 RSA 公钥（SPKI DER Base64） |
| POST | `/api/auth/register` | 用户注册 |
| POST | `/api/auth/login` | 用户登录 |
| POST | `/api/auth/forgot-password` | 忘记密码（预留接口） |

### 请求示例

**注册**
```json
POST /api/auth/register
{
  "name": "张三",
  "email": "zhangsan@example.com",
  "password": "<RSA-OAEP加密后的Base64密文>"
}
```

**登录**
```json
POST /api/auth/login
{
  "email": "zhangsan@example.com",
  "password": "<RSA-OAEP加密后的Base64密文>"
}
```

**成功响应**
```json
{
  "id": 1,
  "name": "张三",
  "email": "zhangsan@example.com",
  "message": "登录成功"
}
```

## 环境要求

- **JDK** 17+
- **Maven** 3.9+
- **Docker**（运行 PostgreSQL 和 Nacos Server）
- **PostgreSQL** 17.11（Docker 容器）
- **Nacos Server** 2.4.3（Docker 容器）

## 快速启动

### 1. 启动基础设施

```bash
# PostgreSQL
docker run -d --name pg17 -p 5432:5432 -e POSTGRES_PASSWORD=123456 postgres:17.11

# 创建数据库
docker exec pg17 psql -U postgres -c "CREATE DATABASE chirp;"

# Nacos Server（单机模式）
docker run -d --name nacos -e MODE=standalone -p 8848:8848 -p 9848:9848 nacos/nacos-server:v2.4.3
```

### 2. 启动微服务

```bash
# 认证服务（端口 8081）
cd chirp-auth
mvn spring-boot:run

# API 网关（端口 8080）
cd chirp-gateway
mvn spring-boot:run
```

### 3. 验证

```bash
# 通过网关访问认证服务
curl http://localhost:8080/api/auth/public-key

# Nacos 控制台
# 浏览器打开 http://localhost:8848/nacos（默认账号 nacos/nacos）
```

## 服务端口

| 服务 | 端口 | 说明 |
|------|------|------|
| chirp-gateway | 8080 | API 网关（前端请求入口） |
| chirp-auth | 8081 | 认证服务 |
| Nacos Server | 8848 | 注册中心 + 配置中心 |
| PostgreSQL | 5432 | 数据库 |

## 安全设计

### RSA-OAEP 传输加密

前端通过 `/api/auth/public-key` 获取 RSA-2048 公钥，使用 WebCrypto API 的 RSA-OAEP(SHA-256) 加密密码，后端用私钥解密后再走 BCrypt 校验/入库。

- 私钥仅存于服务端内存，每次重启重新生成
- 解密失败统一返回"无效请求"，不暴露具体错误（防信息泄露）
- 这是 HTTP 下的纵深防御措施，**不能替代 HTTPS**

### BCrypt 密码哈希

- 默认 cost = 10（2^10 轮哈希）
- 每次编码结果不同（内置随机盐）
- 永不存储/返回明文密码

## 扩展指南

### 新增微服务

1. 在父 POM 的 `<modules>` 中添加新模块
2. 在 `chirp-common/ServiceConstants.java` 中添加服务名常量
3. 在 `chirp-gateway/application.yml` 中添加路由规则
4. 新模块依赖 `chirp-common` + `spring-cloud-starter-alibaba-nacos-discovery`

### 配置中心

各服务的 `application.yml` 中已启用 Nacos 配置中心（`spring.cloud.nacos.config.enabled: true`），可将数据源、路由规则等配置托管到 Nacos 实现动态刷新。

## 开发规范

- 关键功能和关键技术的代码均添加中文注释，方便修改和查找
- DTO 集中在 `chirp-common` 模块，跨服务复用
- 服务名和路由前缀集中在 `ServiceConstants`，避免硬编码
- 密码编码统一通过 `PasswordEncoderUtil`，避免各服务重复实例化