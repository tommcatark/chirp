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

/**
 * 搜索控制器 - 规范 3.2.11 GET /search。
 */
@RestController
@RequestMapping("/api/search")
public class SearchController {
    private static final int MAX_LIMIT = 50;

    private final PostRepository posts;
    private final UserRepository users;
    private final LikeRepository likes;
    private final CommentRepository comments;
    private final FollowRepository follows;
    private final TokenStoreService tokenStore;

    public SearchController(PostRepository posts, UserRepository users,
                            LikeRepository likes, CommentRepository comments,
                            FollowRepository follows, TokenStoreService tokenStore) {
        this.posts = posts;
        this.users = users;
        this.likes = likes;
        this.comments = comments;
        this.follows = follows;
        this.tokenStore = tokenStore;
    }

    @GetMapping
    public ResponseEntity<?> search(@RequestParam String q,
                                    @RequestParam String type,
                                    @RequestParam(defaultValue = "0") int offset,
                                    @RequestParam(defaultValue = "20") int limit,
                                    @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
        String keyword = q.trim();
        if (keyword.isEmpty()) return badRequest("搜索关键词不能为空");
        if (!"post".equals(type) && !"user".equals(type)) return badRequest("搜索类型不合法");
        int safeLimit = Math.max(1, Math.min(limit, MAX_LIMIT));
        Long currentUserId = resolveUserId(authorization);

        if ("post".equals(type)) {
            Page<Post> page = posts.searchByContent(keyword, PageRequest.of(offset / safeLimit, safeLimit));
            var items = page.getContent().stream().map(p -> {
                User author = users.findById(p.getUserId()).orElse(null);
                boolean liked = currentUserId != null && likes.existsByUserIdAndPostId(currentUserId, p.getId());
                boolean mine = currentUserId != null && currentUserId.equals(p.getUserId());
                return toPostResponse(p, author, liked, mine);
            }).toList();
            return ResponseEntity.ok(PageResponse.of(items, page.getTotalElements(), offset, safeLimit));
        }

        Page<User> page = users.searchByName(keyword, PageRequest.of(offset / safeLimit, safeLimit));
        var items = page.getContent().stream().map(u -> toUserResponse(u, currentUserId)).toList();
        return ResponseEntity.ok(PageResponse.of(items, page.getTotalElements(), offset, safeLimit));
    }

    private Long resolveUserId(String authorization) {
        if (authorization == null || !authorization.startsWith("Bearer ")) return null;
        String token = authorization.substring("Bearer ".length()).trim();
        if (token.isEmpty()) return null;
        return tokenStore.getUserId(token);
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

    private ResponseEntity<?> badRequest(String message) {
        return ResponseEntity.badRequest().body(new AuthDTO.ErrorResponse(message));
    }
}