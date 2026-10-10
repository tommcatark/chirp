package com.chirp.auth.controller;

import com.chirp.auth.repository.*;
import com.chirp.common.model.*;
import com.chirp.common.security.TokenStoreService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * 通知控制器 - 规范 3.3.5 / 3.3.6。
 */
@RestController
@RequestMapping("/api/notifications")
public class NotificationController {
    private static final int MAX_LIMIT = 50;
    private static final int EXCERPT_MAX = 50;

    private final NotificationRepository notifications;
    private final UserRepository users;
    private final PostRepository posts;
    private final CommentRepository commentRepo;
    private final TokenStoreService tokenStore;

    public NotificationController(NotificationRepository notifications, UserRepository users,
                                  PostRepository posts, CommentRepository commentRepo,
                                  TokenStoreService tokenStore) {
        this.notifications = notifications;
        this.users = users;
        this.posts = posts;
        this.commentRepo = commentRepo;
        this.tokenStore = tokenStore;
    }

    @GetMapping
    public ResponseEntity<?> list(@RequestParam(defaultValue = "0") int offset,
                                  @RequestParam(defaultValue = "20") int limit,
                                  @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
        Long userId = requireAuth(authorization);
        if (userId == null) return unauthorized();
        int safeLimit = Math.max(1, Math.min(limit, MAX_LIMIT));
        Page<Notification> page = notifications.findByUserIdOrderByCreatedAtDesc(userId, PageRequest.of(offset / safeLimit, safeLimit));
        long unreadCount = notifications.countByUserIdAndIsReadFalse(userId);
        List<NotificationDTO.NotificationResponse> items = page.getContent().stream().map(this::toResp).toList();
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("items", items);
        response.put("total", page.getTotalElements());
        response.put("offset", offset);
        response.put("limit", safeLimit);
        response.put("hasMore", offset + items.size() < page.getTotalElements());
        response.put("unreadCount", unreadCount);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/read")
    public ResponseEntity<?> markRead(@RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization,
                                      @RequestBody(required = false) NotificationDTO.MarkReadRequest request) {
        Long userId = requireAuth(authorization);
        if (userId == null) return unauthorized();
        if (request == null || request.ids() == null || request.ids().isEmpty()) {
            notifications.markAllReadByUserId(userId);
        } else {
            notifications.markReadByIds(request.ids(), userId);
        }
        return ResponseEntity.ok(Map.of("unreadCount", notifications.countByUserIdAndIsReadFalse(userId)));
    }

    private NotificationDTO.NotificationResponse toResp(Notification n) {
        User actor = users.findById(n.getActorId()).orElse(null);
        var actorResp = new NotificationDTO.NotificationActor(
                n.getActorId(),
                actor != null ? actor.getName() : "未知用户",
                actor != null ? AuthController.handleOf(actor.getEmail()) : "unknown",
                actor != null ? actor.getAvatarUrl() : null);
        String postExcerpt = null;
        if (n.getPostId() != null) {
            Post post = posts.findById(n.getPostId()).orElse(null);
            if (post != null) postExcerpt = excerpt(post.getContent());
        }
        String commentExcerpt = null;
        if (n.getCommentId() != null) {
            Comment comment = commentRepo.findById(n.getCommentId()).orElse(null);
            if (comment != null) commentExcerpt = excerpt(comment.getContent());
        }
        return new NotificationDTO.NotificationResponse(
                n.getId(), n.getType(), actorResp, n.getPostId(), postExcerpt,
                n.getCommentId(), commentExcerpt, n.isRead(), n.getCreatedAt());
    }

    private String excerpt(String content) {
        if (content == null) return null;
        return content.length() <= EXCERPT_MAX ? content : content.substring(0, EXCERPT_MAX);
    }

    private Long requireAuth(String authorization) {
        if (authorization == null || !authorization.startsWith("Bearer ")) return null;
        String token = authorization.substring("Bearer ".length()).trim();
        if (token.isEmpty()) return null;
        return tokenStore.getUserId(token);
    }

    private ResponseEntity<?> unauthorized() {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new AuthDTO.ErrorResponse("登录已失效，请重新登录"));
    }
}