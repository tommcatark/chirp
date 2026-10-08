package com.chirp.auth.repository;

import com.chirp.common.model.Post;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/**
 * 帖子数据访问层 — JPA Repository。
 * <p>
 * 关键方法：
 * - findTop50ByOrderByCreatedAtDesc：时间线查询，取最新 50 条（posts.created_at 有降序索引）
 * </p>
 */
public interface PostRepository extends JpaRepository<Post, Long> {
    /** 时间线：按发帖时间倒序取最新 50 条 */
    List<Post> findTop50ByOrderByCreatedAtDesc();
}
