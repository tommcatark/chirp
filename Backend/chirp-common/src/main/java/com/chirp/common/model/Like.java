package com.chirp.common.model;

import jakarta.persistence.*;
import java.time.Instant;

/**
 * 点赞实体 — 存储用户对帖子的点赞记录。
 * <p>
 * 关键约束：
 * - UNIQUE (user_id, post_id)：同一用户对同一帖子只能点赞一次（uk_likes_user_post）
 * - userId: 外键关联 users.id，ON DELETE CASCADE（删除用户时级联删除点赞）
 * - postId: 外键关联 posts.id，ON DELETE CASCADE（删除帖子时级联删除点赞）
 * </p>
 */
@Entity
@Table(name = "likes", uniqueConstraints = @UniqueConstraint(name = "uk_likes_user_post", columnNames = {"userId", "postId"}))
public class Like {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 点赞用户，外键关联 users.id，删除用户时级联删除点赞 */
    @Column(nullable = false)
    private Long userId;

    /** 被赞帖子，外键关联 posts.id，删除帖子时级联删除点赞 */
    @Column(nullable = false)
    private Long postId;

    /** 点赞时间 */
    @Column(nullable = false)
    private Instant createdAt;

    protected Like() {}

    /** 业务构造器：点赞时使用，createdAt 自动填充 */
    public Like(Long userId, Long postId) {
        this.userId = userId;
        this.postId = postId;
        this.createdAt = Instant.now();
    }

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public Long getPostId() { return postId; }
    public Instant getCreatedAt() { return createdAt; }
}