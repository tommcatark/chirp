# chirp-q-api
鸣啾啾后端

## 消息削峰（Kafka）

### 设计思路

项目在高频写操作（**点赞 / 评论 / 关注**）中引入 Kafka 进行消息削峰。削峰落点为**通知生成**：

当一条帖子爆火时，海量点赞 / 评论 / 关注会同步触发等比的通知写入，通知是被放大的写入因子。为此将通知写入从请求同步路径剥离，改为异步消费：

```
点赞/评论(chirp-posts) ─┐
                        ├─▶ Kafka 主题 [chirp.notifications] ──▶ chirp-social 异步落库
关注(chirp-users)       ─┘
```

- **生产者**：`chirp-posts`（点赞、评论）、`chirp-users`（关注）。核心数据仍同步写入以保证用户能立刻看到点赞数 / 关注状态；通知只发布事件到 `chirp.notifications`，请求即刻返回。
- **消费者**：`chirp-social`（通知归属服务）通过 `@KafkaListener` 监听主题，按消费节奏异步生成通知，高峰期不再拖累请求路径。

### 关键组件

| 组件 | 位置 | 说明 |
|------|------|------|
| `NotificationEvent` | `chirp-common` model | 通知事件 DTO，JSON 序列化在服务间传递 |
| `ServiceConstants.NOTIFICATION_TOPIC` | `chirp-common` | 主题常量 `chirp.notifications` |
| `PostController.publishNotification` | `chirp-posts` | 点赞 / 评论事件生产 |
| `FollowController` | `chirp-users` | 关注事件生产 |
| `NotificationConsumer` | `chirp-social` | 消费事件并落库生成通知 |

### 依赖与配置

三个服务（`chirp-posts` / `chirp-users` / `chirp-social`）引入 `spring-kafka`：

- **生产者**（posts / users）：`application.yml` 配置 JSON 序列化
  ```yaml
  spring:
    kafka:
      bootstrap-servers: localhost:9092
      producer:
        value-serializer: org.springframework.kafka.support.serializer.JsonSerializer
  ```
- **消费者**（social）：`application.yml` 配置反序列化与可信包
  ```yaml
  spring:
    kafka:
      bootstrap-servers: localhost:9092
      consumer:
        group-id: chirp-social-notification
        auto-offset-reset: earliest
        key-deserializer: org.apache.kafka.common.serialization.StringDeserializer
        value-deserializer: org.springframework.kafka.support.serializer.JsonDeserializer
        properties:
          spring.json.trusted.packages: "com.chirp.common.model"
          spring.json.value.default.type: "com.chirp.common.model.NotificationEvent"
  ```

### 运行前提

需启动本地 Kafka（`localhost:9092`）。主题 `chirp.notifications` 无需手动创建，消费时自动创建。

### 说明

当前保留了核心写同步以保证即时反馈；仅通知生成这一放大因子被异步削峰。如需更强的削峰（如点赞统计等），可进一步将核心写异步化，但需改造为 Redis 计数 + 批量落库模式。