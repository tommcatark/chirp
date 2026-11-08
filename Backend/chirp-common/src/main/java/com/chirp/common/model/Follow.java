package com.chirp.common.model;

import jakarta.persistence.*;
import java.time.Instant;

/**
 * 关注关系实体 — 存储用户之间的关注/粉丝关系。
 * <p>
 * 关键约束：
 * - UNIQUE (follower_id, followee_id)：不能重复关注同一用户（uk_follows_pair）
 * - CHECK (follower_id <> followee_id)：禁止自己关注自己（ck_follows_no_self）
 * - followerId: 外键关联 users.id，ON DELETE CASCADE（删除用户时级联删除其作为关注人的记录）
 * - followeeId: 外键关联 users.id，ON DELETE CASCADE（删除用户时级联删除其作为被关注人的记录）
 * </p>
 */
@Entity
@Table(name = "follows", uniqueConstraints = @UniqueConstraint(name = "uk_follows_pair", columnNames = {"followerId", "followeeId"}))
public class Follow {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 关注人（主动关注方），外键关联 users.id，删除用户时级联删除 */
    @Column(nullable = false)
    private Long followerId;

    /** 被关注人（被动被关注方），外键关联 users.id，删除用户时级联删除 */
    @Column(nullable = false)
    private Long followeeId;

    /** 关注时间 */
    @Column(nullable = false)
    private Instant createdAt;

    protected Follow() {}

    /** 业务构造器：关注时使用，createdAt 自动填充 */
    public Follow(Long followerId, Long followeeId) {
        this.followerId = followerId;
        this.followeeId = followeeId;
        this.createdAt = Instant.now();
    }

    public Long getId() { return id; }
    public Long getFollowerId() { return followerId; }
    public Long getFolloweeId() { return followeeId; }
    public Instant getCreatedAt() { return createdAt; }
}