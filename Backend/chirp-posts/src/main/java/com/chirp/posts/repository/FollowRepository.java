package com.chirp.posts.repository;

import com.chirp.common.model.Follow;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

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