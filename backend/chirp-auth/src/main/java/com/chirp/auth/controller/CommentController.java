package com.chirp.auth.controller;

import com.chirp.auth.repository.CommentRepository;
import com.chirp.common.model.Comment;
import com.chirp.common.security.TokenStoreService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * 评论控制器 - 规范 3.2.10 DELETE /comments/{id}。
 */
@RestController
@RequestMapping("/api/comments")
public class CommentController {
    private final CommentRepository comments;
    private final TokenStoreService tokenStore;

    public CommentController(CommentRepository comments, TokenStoreService tokenStore) {
        this.comments = comments;
        this.tokenStore = tokenStore;
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id,
                                       @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
        Long userId = resolveUserId(authorization);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        Comment comment = comments.findById(id).orElse(null);
        if (comment == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        if (!comment.getUserId().equals(userId)) return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        comments.delete(comment);
        return ResponseEntity.noContent().build();
    }

    private Long resolveUserId(String authorization) {
        if (authorization == null || !authorization.startsWith("Bearer ")) return null;
        String token = authorization.substring("Bearer ".length()).trim();
        if (token.isEmpty()) return null;
        return tokenStore.getUserId(token);
    }
}