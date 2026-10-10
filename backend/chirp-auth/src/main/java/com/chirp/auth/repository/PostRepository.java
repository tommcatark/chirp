package com.chirp.auth.repository;

import com.chirp.common.model.Post;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

/**
 * 帖子数据访问层 — JPA Repository。
 * <p>
 * 规范 §3.2.1：支持分页 + scope（latest / following）
 * 规范 §1.5：offset/limit 分页，limit 上限 50
 * </p>
 */
public interface PostRepository extends JpaRepository<Post, Long> {
    Page<Post> findAllByOrderByCreatedAtDesc(Pageable pageable);

    @Query("SELECT p FROM Post p WHERE p.userId IN :userIds ORDER BY p.createdAt DESC")
    Page<Post> findByUserIdInOrderByCreatedAtDesc(@Param("userIds") List<Long> userIds, Pageable pageable);

    Page<Post> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);

    long countByUserId(Long userId);

    @Query("SELECT p FROM Post p WHERE LOWER(p.content) LIKE LOWER(CONCAT('%', :q, '%')) ORDER BY p.createdAt DESC")
    Page<Post> searchByContent(@Param("q") String q, Pageable pageable);
}