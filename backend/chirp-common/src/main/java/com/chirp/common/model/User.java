package com.chirp.common.model;

import jakarta.persistence.*;
import java.time.Instant;

/**
 * 用户实体 — 系统核心领域对象。
 * <p>
 * 存储于 PostgreSQL 的 users 表，由 chirp-auth 服务直接读写。
 * 后续如拆分用户服务，可将此实体迁移至独立的 chirp-user 模块。
 * </p>
 *
 * 关键字段说明：
 * - email: 业务唯一键，数据库层有 uk_users_email 唯一约束
 * - passwordHash: BCrypt 哈希值，永不存储明文
 * - bio: 用户简介，最多 200 字符，可为 null
 * - avatarUrl: 头像 URL，可为 null
 * - createdAt: ISO-8601 时间戳，由 JPA 审计自动填充
 */
@Entity
@Table(name = "users", uniqueConstraints = @UniqueConstraint(name = "uk_users_email", columnNames = "email"))
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 120)
    private String name;

    /** 业务唯一键，入库前统一 toLowerCase + trim */
    @Column(nullable = false, length = 255)
    private String email;

    /** BCrypt 哈希，永不存储/返回明文密码 */
    @Column(nullable = false)
    private String passwordHash;

    /** 用户简介，最多 200 字符，可为 null（数据库有 ck_users_bio_length CHECK 约束） */
    @Column
    private String bio;

    /** 头像 URL，可为 null */
    @Column(length = 500)
    private String avatarUrl;

    /** 注册时间，构造时自动填充为当前 UTC 时间 */
    @Column(nullable = false)
    private Instant createdAt;

    /** JPA 要求的无参构造器 */
    protected User() {}

    /** 业务构造器：注册时使用，createdAt 自动填充 */
    public User(String name, String email, String passwordHash) {
        this.name = name;
        this.email = email;
        this.passwordHash = passwordHash;
        this.createdAt = Instant.now();
    }

    public Long getId() { return id; }
    public String getName() { return name; }
    public String getEmail() { return email; }
    public String getPasswordHash() { return passwordHash; }
    public String getBio() { return bio; }
    public String getAvatarUrl() { return avatarUrl; }
    public Instant getCreatedAt() { return createdAt; }

    public void setName(String name) { this.name = name; }
    public void setBio(String bio) { this.bio = bio; }
    public void setAvatarUrl(String avatarUrl) { this.avatarUrl = avatarUrl; }
}