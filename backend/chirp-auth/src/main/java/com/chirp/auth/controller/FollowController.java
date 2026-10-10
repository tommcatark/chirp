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

import java.util.Map;

/**
 * 社交控制器 - 规范 3.3 社交与通知。
 */
@RestController
@RequestMapping("/api/users")
public class FollowController {
    private static final int MAX_LIMIT = 50;

    private final FollowRepository follows;
    private final UserRepository users;
    private final PostRepository posts;
    private final NotificationRepository notifications;
    private final TokenStoreService tokenStore;

    public FollowController(FollowRepository follows, UserRepository users,
                            PostRepository posts, NotificationRepository notifications,
                            TokenStoreService tokenStore) {
        this.follows = follows;
        this.users = users;
        this.posts = posts;
        this.notifications = notifications;
        this.tokenStore = tokenStore;
    }

    @PostMapping("/{id}/follow")
    public ResponseEntity<?> follow(@PathVariable Long id,
                                    @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
        Long userId = requireAuth(authorization);
        if (userId == null) return unauthorized();
        if (userId.equals(id)) return badRequest("不能关注自己");
        if (!users.existsById(id)) return ResponseEntity.status(HttpStatus.NOT_FOUND).body(err("用户不存在"));
        if (!follows.existsByFollowerIdAndFolloweeId(userId, id)) {
            follows.save(new Follow(userId, id));
            notifications.save(new Notification(id, userId, "follow", null, null));
        }
        return ResponseEntity.ok(Map.of("following", true, "followerCount", follows.countByFolloweeId(id)));
    }

    @DeleteMapping("/{id}/follow")
    public ResponseEntity<?> unfollow(@PathVariable Long id,
                                      @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
        Long userId = requireAuth(authorization);
        if (userId == null) return unauthorized();
        if (!users.existsById(id)) return ResponseEntity.status(HttpStatus.NOT_FOUND).body(err("用户不存在"));
        follows.findByFollowerIdAndFolloweeId(userId, id).ifPresent(follows::delete);
        return ResponseEntity.ok(Map.of("following", false, "followerCount", follows.countByFolloweeId(id)));
    }

    @GetMapping("/{id}/followers")
    public ResponseEntity<?> followers(@PathVariable Long id,
                                       @RequestParam(defaultValue = "0") int offset,
                                       @RequestParam(defaultValue = "20") int limit,
                                       @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
        if (!users.existsById(id)) return ResponseEntity.status(HttpStatus.NOT_FOUND).body(err("用户不存在"));
        int safeLimit = Math.max(1, Math.min(limit, MAX_LIMIT));
        Long currentUserId = resolveUserId(authorization);
        Page<Follow> page = follows.findByFolloweeIdOrderByCreatedAtDesc(id, PageRequest.of(offset / safeLimit, safeLimit));
        var items = page.getContent().stream()
                .map(f -> users.findById(f.getFollowerId()).orElse(null))
                .filter(java.util.Objects::nonNull)
                .map(u -> toUserResponse(u, currentUserId))
                .toList();
        return ResponseEntity.ok(PageResponse.of(items, page.getTotalElements(), offset, safeLimit));
    }

    @GetMapping("/{id}/following")
    public ResponseEntity<?> following(@PathVariable Long id,
                                       @RequestParam(defaultValue = "0") int offset,
                                       @RequestParam(defaultValue = "20") int limit,
                                       @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
        if (!users.existsById(id)) return ResponseEntity.status(HttpStatus.NOT_FOUND).body(err("用户不存在"));
        int safeLimit = Math.max(1, Math.min(limit, MAX_LIMIT));
        Long currentUserId = resolveUserId(authorization);
        Page<Follow> page = follows.findByFollowerIdOrderByCreatedAtDesc(id, PageRequest.of(offset / safeLimit, safeLimit));
        var items = page.getContent().stream()
                .map(f -> users.findById(f.getFolloweeId()).orElse(null))
                .filter(java.util.Objects::nonNull)
                .map(u -> toUserResponse(u, currentUserId))
                .toList();
        return ResponseEntity.ok(PageResponse.of(items, page.getTotalElements(), offset, safeLimit));
    }

    private Long resolveUserId(String authorization) {
        if (authorization == null || !authorization.startsWith("Bearer ")) return null;
        String token = authorization.substring("Bearer ".length()).trim();
        if (token.isEmpty()) return null;
        return tokenStore.getUserId(token);
    }
    private Long requireAuth(String authorization) { return resolveUserId(authorization); }

    private UserDTO.UserResponse toUserResponse(User user, Long currentUserId) {
        boolean followedByMe = currentUserId != null && follows.existsByFollowerIdAndFolloweeId(currentUserId, user.getId());
        boolean me = currentUserId != null && currentUserId.equals(user.getId());
        return new UserDTO.UserResponse(
                user.getId(), user.getName(), AuthController.handleOf(user.getEmail()),
                user.getBio(), user.getAvatarUrl(), user.getCreatedAt(),
                posts.countByUserId(user.getId()),
                follows.countByFollowerId(user.getId()),
                follows.countByFolloweeId(user.getId()),
                followedByMe, me);
    }

    private ResponseEntity<?> unauthorized() {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new AuthDTO.ErrorResponse("登录已失效，请重新登录"));
    }
    private ResponseEntity<?> badRequest(String message) {
        return ResponseEntity.badRequest().body(new AuthDTO.ErrorResponse(message));
    }
    private AuthDTO.ErrorResponse err(String message) { return new AuthDTO.ErrorResponse(message); }
}