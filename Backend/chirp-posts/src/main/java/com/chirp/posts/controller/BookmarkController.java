package com.chirp.posts.controller;

import com.chirp.posts.repository.*;
import com.chirp.common.model.*;
import com.chirp.common.security.TokenStoreService;
import com.chirp.common.util.UserUtil;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/bookmarks")
public class BookmarkController {
    private static final int MAX_LIMIT = 50;

    private final BookmarkRepository bookmarks;
    private final PostRepository posts;
    private final UserRepository users;
    private final LikeRepository likes;
    private final CommentRepository comments;
    private final TokenStoreService tokenStore;

    public BookmarkController(BookmarkRepository bookmarks, PostRepository posts,
                              UserRepository users, LikeRepository likes,
                              CommentRepository comments, TokenStoreService tokenStore) {
        this.bookmarks = bookmarks;
        this.posts = posts;
        this.users = users;
        this.likes = likes;
        this.comments = comments;
        this.tokenStore = tokenStore;
    }

    @GetMapping
    public ResponseEntity<?> list(@RequestParam(defaultValue = "0") int offset,
                                  @RequestParam(defaultValue = "20") int limit,
                                  @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
        Long userId = requireAuth(authorization);
        if (userId == null) return unauthorized();

        int safeLimit = Math.max(1, Math.min(limit, MAX_LIMIT));
        Page<Bookmark> page = bookmarks.findByUserIdOrderByCreatedAtDesc(userId, PageRequest.of(offset / safeLimit, safeLimit));

        List<Bookmark> bookmarkList = page.getContent();
        if (bookmarkList.isEmpty()) {
            return ResponseEntity.ok(PageResponse.of(Collections.emptyList(), page.getTotalElements(), offset, safeLimit));
        }

        List<Long> postIds = bookmarkList.stream().map(Bookmark::getPostId).toList();
        Map<Long, Post> postMap = posts.findAllById(postIds).stream()
                .collect(Collectors.toMap(Post::getId, Function.identity()));

        List<Long> userIds = postMap.values().stream().map(Post::getUserId).distinct().toList();
        Map<Long, User> authorMap = users.findAllById(userIds).stream()
                .collect(Collectors.toMap(User::getId, Function.identity()));

        Set<Long> likedPostIds = new HashSet<>(likes.findLikedPostIdsByUserId(userId, postIds));

        List<PostDTO.PostResponse> items = bookmarkList.stream()
                .map(b -> {
                    Post post = postMap.get(b.getPostId());
                    if (post == null) return null;
                    User author = authorMap.get(post.getUserId());
                    boolean liked = likedPostIds.contains(post.getId());
                    boolean mine = userId.equals(post.getUserId());
                    return toResponse(post, author, liked, mine, true);
                })
                .filter(Objects::nonNull)
                .toList();

        return ResponseEntity.ok(PageResponse.of(items, page.getTotalElements(), offset, safeLimit));
    }

    private PostDTO.PostResponse toResponse(Post post, User author, boolean liked, boolean mine, boolean bookmarked) {
        String name = author != null ? author.getName() : "未知用户";
        String handle = author != null ? UserUtil.handleOf(author.getEmail()) : "unknown";
        String avatarUrl = author != null ? author.getAvatarUrl() : null;
        long likeCount = likes.countByPostId(post.getId());
        long commentCount = comments.countByPostId(post.getId());
        return new PostDTO.PostResponse(
                post.getId(), post.getUserId(), name, handle, avatarUrl,
                post.getContent(), post.getCreatedAt(), likeCount, 0, commentCount, liked, mine, bookmarked);
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