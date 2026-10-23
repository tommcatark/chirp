package com.chirp.common.model;

import jakarta.persistence.*;
import java.time.Instant;

/**
 * 私信实体 — 存储用户之间的一对一消息。
 * <p>
 * 关键字段：
 * - senderId: 发送者，外键 users.id，ON DELETE CASCADE
 * - recipientId: 接收者，外键 users.id，ON DELETE CASCADE
 * - content: 消息正文，1-500 字符（数据库有 ck_messages_content_length CHECK 约束）
 * - isRead: 是否已读（接收者维度），默认 false
 * </p>
 *
 * 外键删除行为说明：删除用户时级联删除其发送/接收的所有私信。
 */
@Entity
@Table(name = "messages")
public class Message {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 发送者，外键关联 users.id，删除用户时级联删除消息 */
    @Column(nullable = false)
    private Long senderId;

    /** 接收者，外键关联 users.id，删除用户时级联删除消息 */
    @Column(nullable = false)
    private Long recipientId;

    /** 消息正文，1-500 字符 */
    @Column(nullable = false, length = 500)
    private String content;

    /** 是否已读，默认 false */
    @Column(nullable = false)
    private boolean isRead = false;

    /** 发送时间 */
    @Column(nullable = false)
    private Instant createdAt;

    protected Message() {}

    /** 业务构造器：发送消息时使用，createdAt 自动填充 */
    public Message(Long senderId, Long recipientId, String content) {
        this.senderId = senderId;
        this.recipientId = recipientId;
        this.content = content;
        this.createdAt = Instant.now();
    }

    public Long getId() { return id; }
    public Long getSenderId() { return senderId; }
    public Long getRecipientId() { return recipientId; }
    public String getContent() { return content; }
    public boolean isRead() { return isRead; }
    public Instant getCreatedAt() { return createdAt; }

    public void setRead(boolean read) { isRead = read; }
}
