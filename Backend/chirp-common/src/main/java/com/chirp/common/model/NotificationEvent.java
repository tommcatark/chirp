package com.chirp.common.model;

/**
 * 通知生成事件 — 通过 Kafka 在服务间传递，用于将通知写入与高频请求解耦（消息削峰）。
 * <p>
 * 字段与 {@link Notification} 的业务构造器参数一一对应：
 * - userId: 通知接收用户
 * - actorId: 触发操作的用户
 * - type: 通知类型（'like' / 'comment' / 'follow'）
 * - postId: 关联帖子，可 null
 * - commentId: 关联评论，可 null
 * </p>
 */
public record NotificationEvent(Long userId, Long actorId, String type, Long postId, Long commentId) {
}