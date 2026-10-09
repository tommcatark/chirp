package com.chirp.auth.repository;

import com.chirp.common.model.Follow;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

/**
 * 关注关系数据访问层 — JPA Repository。
 * <p>
 * 规范 §3.3.1 / §3.3.2：
 * - followerId：关注人（主动关注方）
 * - followeeId：被关注人（被动被关注方）
 * - 幂等：重复关注/取关不报错
 * </p>
 */
public interface FollowRepository extends JpaRepository<Follow, Long> {
    boolean existsByFollowerIdAndFolloweeId(Long followerId, Long followeeId);
    long countByFollowerId(Long followerId);
    long countByFolloweeId(Long followeeId);
    Optional<Follow> findByFollowerIdAndFolloweeId(Long followerId, Long followeeId);
    Page<Follow> findByFollowerIdOrderByCreatedAtDesc(Long followerId, Pageable pageable);
    Page<Follow> findByFolloweeIdOrderByCreatedAtDesc(Long followeeId, Pageable pageable);

    @Query("SELECT f.followeeId FROM Follow f WHERE f.followerId = :followerId")
    List<Long> findFolloweeIdsByFollowerId(@Param("followerId") Long followerId);
}