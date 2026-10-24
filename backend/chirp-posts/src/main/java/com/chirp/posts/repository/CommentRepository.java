package com.chirp.posts.repository;

import com.chirp.common.model.Comment;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CommentRepository extends JpaRepository<Comment, Long> {
    long countByPostId(Long postId);
    Page<Comment> findByPostIdOrderByCreatedAtAsc(Long postId, Pageable pageable);
}