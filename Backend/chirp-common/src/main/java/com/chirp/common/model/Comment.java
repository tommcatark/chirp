package com.chirp.common.model;

import jakarta.persistence.*;
import java.time.Instant;

/**
 * 评论实体 — 存储用户对帖子的评论。
 * <p>
 * 关键字段：
 * - content: 评论内容，1-500 字符（数据库有 ck_comments_content_length CHECK 约束）
 * - postId: 外键关联 posts.id，ON DELETE CASCADE（删除帖子时级联删除评论）
 * - userId: 外键关联 users.id，ON DELETE CASCADE（删除用户时级联删除评论）
 * </p>
 */
@Entity
@Table(name = "comments")
public class Comment {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 所属帖子，外键关联 posts.id，删除帖子时级联删除评论 */
    @Column(nullable = false)
    private Long postId;

    /** 评论用户，外键关联 users.id，删除用户时级联删除评论 */
    @Column(nullable = false)
    private Long userId;

    /** 评论内容，1-500 字符 */
    @Column(nullable = false, length = 500)
    private String content;

    /** 评论时间 */
    @Column(nullable = false)
    private Instant createdAt;

    protected Comment() {}

    /** 业务构造器：评论时使用，createdAt 自动填充 */
    public Comment(Long postId, Long userId, String content) {
        this.postId = postId;
        this.userId = userId;
        this.content = content;
        this.createdAt = Instant.now();
    }

    public Long getId() { return id; }
    public Long getPostId() { return postId; }
    public Long getUserId() { return userId; }
    public String getContent() { return content; }
    public Instant getCreatedAt() { return createdAt; }
}