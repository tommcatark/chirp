package com.chirp.auth.repository;

import com.chirp.common.model.Like;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

/**
 * 点赞数据访问层 — JPA Repository。
 * <p>
 * 规范 §3.2.6：同一用户对同一帖子只能点赞一次（uk_likes_user_post）。
 * 幂等：重复点赞不报错。
 * </p>
 */
public interface LikeRepository extends JpaRepository<Like, Long> {
    boolean existsByUserIdAndPostId(Long userId, Long postId);
    long countByPostId(Long postId);
    Optional<Like> findByUserIdAndPostId(Long userId, Long postId);

    @Query("SELECT l.postId FROM Like l WHERE l.userId = :userId AND l.postId IN :postIds")
    List<Long> findLikedPostIdsByUserId(@Param("userId") Long userId, @Param("postIds") Collection<Long> postIds);
}