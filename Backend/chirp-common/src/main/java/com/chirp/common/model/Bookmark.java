package com.chirp.common.model;

import jakarta.persistence.*;
import java.time.Instant;

/**
 * 收藏实体 — 存储用户对帖子的收藏记录。
 * <p>
 * 关键约束：
 * - UNIQUE (user_id, post_id)：同一用户对同一帖子只能收藏一次（uk_bookmarks_user_post）
 * - userId: 外键关联 users.id，ON DELETE CASCADE（删除用户时级联删除收藏）
 * - postId: 外键关联 posts.id，ON DELETE CASCADE（删除帖子时级联删除收藏）
 * </p>
 */
@Entity
@Table(name = "bookmarks", uniqueConstraints = @UniqueConstraint(name = "uk_bookmarks_user_post", columnNames = {"userId", "postId"}))
public class Bookmark {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long userId;

    @Column(nullable = false)
    private Long postId;

    @Column(nullable = false)
    private Instant createdAt;

    protected Bookmark() {}

    public Bookmark(Long userId, Long postId) {
        this.userId = userId;
        this.postId = postId;
        this.createdAt = Instant.now();
    }

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public Long getPostId() { return postId; }
    public Instant getCreatedAt() { return createdAt; }
}