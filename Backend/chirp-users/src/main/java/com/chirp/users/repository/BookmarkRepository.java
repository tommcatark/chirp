package com.chirp.users.repository;

import com.chirp.common.model.Bookmark;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface BookmarkRepository extends JpaRepository<Bookmark, Long> {
    boolean existsByUserIdAndPostId(Long userId, Long postId);

    @Query("SELECT b.postId FROM Bookmark b WHERE b.userId = :userId AND b.postId IN :postIds")
    List<Long> findBookmarkedPostIdsByUserId(@Param("userId") Long userId, @Param("postIds") Collection<Long> postIds);
}