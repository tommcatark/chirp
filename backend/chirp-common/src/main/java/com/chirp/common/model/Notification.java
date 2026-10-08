package com.chirp.common.model;

import jakarta.persistence.*;
import java.time.Instant;

/**
 * 站内通知实体 — 存储点赞/评论/关注等通知。
 * <p>
 * 关键字段：
 * - userId: 通知接收用户，外键 users.id，ON DELETE CASCADE
 * - actorId: 触发操作的用户，外键 users.id，ON DELETE CASCADE
 * - type: 通知类型，仅允许 'like'、'comment'、'follow'（数据库有 ck_notifications_type CHECK 约束）
 * - postId: 关联帖子，可为 null；点赞/评论通知才填充；外键 posts.id，ON DELETE SET NULL
 * - commentId: 关联评论，可为 null；评论通知才填充；外键 comments.id，ON DELETE SET NULL
 * - isRead: 是否已读，默认 false
 * </p>
 *
 * 外键删除行为说明：
 * - 删除用户时级联删除其接收/触发的所有通知
 * - 删除帖子时将 postId 置为 NULL（通知保留，但帖子引用消失）
 * - 删除评论时将 commentId 置为 NULL（通知保留，但评论引用消失）
 */
@Entity
@Table(name = "notifications")
public class Notification {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 通知接收用户，外键关联 users.id，删除用户时级联删除通知 */
    @Column(nullable = false)
    private Long userId;

    /** 触发操作的用户，外键关联 users.id，删除用户时级联删除通知 */
    @Column(nullable = false)
    private Long actorId;

    /** 通知类型，仅允许 'like'、'comment'、'follow' */
    @Column(nullable = false, length = 20)
    private String type;

    /** 关联帖子，可为 null；点赞/评论通知才填充；删除帖子时 SET NULL */
    @Column
    private Long postId;

    /** 关联评论，可为 null；评论通知才填充；删除评论时 SET NULL */
    @Column
    private Long commentId;

    /** 是否已读，默认 false */
    @Column(nullable = false)
    private boolean isRead = false;

    /** 通知创建时间 */
    @Column(nullable = false)
    private Instant createdAt;

    protected Notification() {}

    /** 业务构造器：创建通知时使用，createdAt 自动填充 */
    public Notification(Long userId, Long actorId, String type, Long postId, Long commentId) {
        this.userId = userId;
        this.actorId = actorId;
        this.type = type;
        this.postId = postId;
        this.commentId = commentId;
        this.createdAt = Instant.now();
    }

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public Long getActorId() { return actorId; }
    public String getType() { return type; }
    public Long getPostId() { return postId; }
    public Long getCommentId() { return commentId; }
    public boolean isRead() { return isRead; }
    public Instant getCreatedAt() { return createdAt; }

    public void setRead(boolean read) { isRead = read; }
}