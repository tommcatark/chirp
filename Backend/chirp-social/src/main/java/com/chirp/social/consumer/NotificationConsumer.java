package com.chirp.social.consumer;

import com.chirp.common.model.Notification;
import com.chirp.common.model.NotificationEvent;
import com.chirp.common.model.ServiceConstants;
import com.chirp.social.repository.NotificationRepository;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

/**
 * 通知事件消费者 — 异步消费 Kafka 上的通知生成事件并落库。
 * <p>
 * 削峰原理：chirp-posts / chirp-users 在高频写操作（点赞/评论/关注）时不再同步
 * 写通知，而是发布事件到 Kafka；本消费者按消费节奏异步生成通知，
 * 避免高峰期通知写入拖累请求路径。
 * </p>
 */
@Component
public class NotificationConsumer {

    private final NotificationRepository notifications;

    public NotificationConsumer(NotificationRepository notifications) {
        this.notifications = notifications;
    }

    @KafkaListener(topics = ServiceConstants.NOTIFICATION_TOPIC,
                   groupId = ServiceConstants.NOTIFICATION_CONSUMER_GROUP)
    public void onNotification(NotificationEvent event) {
        notifications.save(new Notification(
                event.userId(), event.actorId(), event.type(), event.postId(), event.commentId()));
    }
}