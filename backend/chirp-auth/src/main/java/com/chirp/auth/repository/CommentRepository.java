package com.chirp.auth.repository;

import com.chirp.common.model.Comment;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 评论数据访问层 — JPA Repository。
 * <p>
 * 规范 §3.2.8：评论按 createdAt 升序（评论区阅读习惯）。
 * </p>
 */
public interface CommentRepository extends JpaRepository<Comment, Long> {
    long countByPostId(Long postId);
    Page<Comment> findByPostIdOrderByCreatedAtAsc(Long postId, Pageable pageable);
}