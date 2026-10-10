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
 * 用户控制器 - 规范 3.1.6 / 3.1.7 / 3.1.8 / 3.2.5。
 */
@RestController
@RequestMapping("/api/users")
public class UserController {
    private static final int MAX_LIMIT = 50;

    private final UserRepository users;
    private final PostRepository posts;
    private final LikeRepository likes;
    private final CommentRepository comments;
    private final FollowRepository follows;
    private final TokenStoreService tokenStore;

    public UserController(UserRepository users, PostRepository posts,
                          LikeRepository likes, CommentRepository comments,
                          FollowRepository follows, TokenStoreService tokenStore) {
        this.users = users;
        this.posts = posts;
        this.likes = likes;
        this.comments = comments;
        this.follows = follows;
        this.tokenStore = tokenStore;
    }

    @GetMapping("/me")
    public ResponseEntity<?> me(@RequestHeader(HttpHeaders.AUTHORIZATION) String authorization) {
        Long userId = requireAuth(authorization);
        if (userId == null) return unauthorized();
        User user = users.findById(userId).orElse(null);
        if (user == null) return unauthorized();
        return ResponseEntity.ok(toMeResponse(user));
    }

    @PutMapping("/me")
    public ResponseEntity<?> updateMe(@RequestHeader(HttpHeaders.AUTHORIZATION) String authorization,
                                      @RequestBody UserDTO.UpdateUserRequest request) {
        Long userId = requireAuth(authorization);
        if (userId == null) return unauthorized();
        User user = users.findById(userId).orElse(null);
        if (user == null) return unauthorized();

        boolean hasUpdate = false;
        if (request.name() != null) {
            String name = request.name().trim();
            int nameLen = name.codePointCount(0, name.length());
            if (nameLen < 2 || nameLen > 120) return badRequest("昵称需要 2-120 个字符");
            user.setName(name);
            hasUpdate = true;
        }
        if (request.bio() != null) {
            String bio = request.bio().trim();
            if (bio.codePointCount(0, bio.length()) > 200) return badRequest("简介不能超过 200 个字符");
            user.setBio(bio);
            hasUpdate = true;
        }
        if (request.avatarUrl() != null) {
            if (request.avatarUrl().length() > 500) return badRequest("头像链接过长");
            user.setAvatarUrl(request.avatarUrl().trim());
            hasUpdate = true;
        }
        if (!hasUpdate) return badRequest("没有需要更新的内容");

        users.save(user);
        return ResponseEntity.ok(toMeResponse(user));
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> get(@PathVariable Long id,
                                 @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
        User user = users.findById(id).orElse(null);
        if (user == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body(err("用户不存在"));
        Long currentUserId = resolveUserId(authorization);
        return ResponseEntity.ok(toUserResponse(user, currentUserId));
    }

    @GetMapping("/{id}/posts")
    public ResponseEntity<?> userPosts(@PathVariable Long id,
                                       @RequestParam(defaultValue = "0") int offset,
                                       @RequestParam(defaultValue = "20") int limit,
                                       @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
        if (!users.existsById(id))
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(err("用户不存在"));
        int safeLimit = Math.max(1, Math.min(limit, MAX_LIMIT));
        Long currentUserId = resolveUserId(authorization);
        Page<Post> page = posts.findByUserIdOrderByCreatedAtDesc(id, PageRequest.of(offset / safeLimit, safeLimit));
        List<PostDTO.PostResponse> items = page.getContent().stream().map(p -> {
            User author = users.findById(p.getUserId()).orElse(null);
            boolean liked = currentUserId != null && likes.existsByUserIdAndPostId(currentUserId, p.getId());
            boolean mine = currentUserId != null && currentUserId.equals(p.getUserId());
            return toPostResponse(p, author, liked, mine);
        }).toList();
        return ResponseEntity.ok(PageResponse.of(items, page.getTotalElements(), offset, safeLimit));
    }

    private Long resolveUserId(String authorization) {
        if (authorization == null || !authorization.startsWith("Bearer ")) return null;
        String token = authorization.substring("Bearer ".length()).trim();
        if (token.isEmpty()) return null;
        return tokenStore.getUserId(token);
    }

    private Long requireAuth(String authorization) { return resolveUserId(authorization); }

    private UserDTO.UserMeResponse toMeResponse(User user) {
        return new UserDTO.UserMeResponse(
                user.getId(), user.getName(), AuthController.handleOf(user.getEmail()),
                user.getBio(), user.getAvatarUrl(), user.getCreatedAt(),
                posts.countByUserId(user.getId()),
                follows.countByFollowerId(user.getId()),
                follows.countByFolloweeId(user.getId()),
                false, true, user.getEmail());
    }

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

    private PostDTO.PostResponse toPostResponse(Post post, User author, boolean liked, boolean mine) {
        String name = author != null ? author.getName() : "未知用户";
        String handle = author != null ? AuthController.handleOf(author.getEmail()) : "unknown";
        String avatarUrl = author != null ? author.getAvatarUrl() : null;
        return new PostDTO.PostResponse(
                post.getId(), post.getUserId(), name, handle, avatarUrl,
                post.getContent(), post.getCreatedAt(),
                likes.countByPostId(post.getId()), 0, comments.countByPostId(post.getId()), liked, mine);
    }

    private ResponseEntity<?> unauthorized() {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new AuthDTO.ErrorResponse("登录已失效，请重新登录"));
    }
    private ResponseEntity<?> badRequest(String message) {
        return ResponseEntity.badRequest().body(new AuthDTO.ErrorResponse(message));
    }
    private AuthDTO.ErrorResponse err(String message) { return new AuthDTO.ErrorResponse(message); }
}