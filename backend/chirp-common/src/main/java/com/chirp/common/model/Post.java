package com.chirp.common.model;

import jakarta.persistence.*;
import java.time.Instant;

/**
 * 帖子实体 — 存储用户发布的推文/帖子。
 * <p>
 * 关键字段：
 * - content: 帖子正文，1-500 字符（数据库有 ck_posts_content_length CHECK 约束）
 * - userId: 外键关联 users.id，ON DELETE CASCADE（删除用户时级联删除帖子）
 * - createdAt: 发帖时间，数据库建立降序索引（idx_posts_created_at）加速时间线查询
 * </p>
 */
@Entity
@Table(name = "posts")
public class Post {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 发帖用户，外键关联 users.id，删除用户时级联删除帖子 */
    @Column(nullable = false)
    private Long userId;

    /** 帖子正文，1-500 字符 */
    @Column(nullable = false, length = 500)
    private String content;

    /** 发帖时间，数据库建立降序索引以加速时间线查询 */
    @Column(nullable = false)
    private Instant createdAt;

    protected Post() {}

    /** 业务构造器：发帖时使用，createdAt 自动填充 */
    public Post(Long userId, String content) {
        this.userId = userId;
        this.content = content;
        this.createdAt = Instant.now();
    }

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public String getContent() { return content; }
    public Instant getCreatedAt() { return createdAt; }
}