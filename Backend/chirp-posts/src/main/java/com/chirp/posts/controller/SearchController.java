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
@RequestMapping("/api/search")
public class SearchController {
    private static final int MAX_LIMIT = 50;

    private final PostRepository posts;
    private final UserRepository users;
    private final LikeRepository likes;
    private final CommentRepository comments;
    private final FollowRepository follows;
    private final BookmarkRepository bookmarks;
    private final TokenStoreService tokenStore;

    public SearchController(PostRepository posts, UserRepository users,
                            LikeRepository likes, CommentRepository comments,
                            FollowRepository follows, BookmarkRepository bookmarks,
                            TokenStoreService tokenStore) {
        this.posts = posts;
        this.users = users;
        this.likes = likes;
        this.comments = comments;
        this.follows = follows;
        this.bookmarks = bookmarks;
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
            List<Post> postList = page.getContent();
            if (postList.isEmpty()) {
                return ResponseEntity.ok(PageResponse.of(Collections.emptyList(), page.getTotalElements(), offset, safeLimit));
            }

            List<Long> userIds = postList.stream().map(Post::getUserId).distinct().toList();
            Map<Long, User> authorMap = users.findAllById(userIds).stream()
                    .collect(Collectors.toMap(User::getId, Function.identity()));

            List<Long> postIds = postList.stream().map(Post::getId).toList();
            Set<Long> likedPostIds = Collections.emptySet();
            Set<Long> bookmarkedPostIds = Collections.emptySet();
            if (currentUserId != null) {
                likedPostIds = new HashSet<>(likes.findLikedPostIdsByUserId(currentUserId, postIds));
                bookmarkedPostIds = new HashSet<>(bookmarks.findBookmarkedPostIdsByUserId(currentUserId, postIds));
            }

            Set<Long> finalLikedPostIds = likedPostIds;
            Set<Long> finalBookmarkedPostIds = bookmarkedPostIds;
            var items = postList.stream()
                    .map(p -> toPostResponse(p, authorMap.get(p.getUserId()),
                            finalLikedPostIds.contains(p.getId()),
                            currentUserId != null && currentUserId.equals(p.getUserId()),
                            finalBookmarkedPostIds.contains(p.getId())))
                    .toList();
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

    private PostDTO.PostResponse toPostResponse(Post post, User author, boolean liked, boolean mine, boolean bookmarked) {
        String name = author != null ? author.getName() : "未知用户";
        String handle = author != null ? UserUtil.handleOf(author.getEmail()) : "unknown";
        String avatarUrl = author != null ? author.getAvatarUrl() : null;
        return new PostDTO.PostResponse(
                post.getId(), post.getUserId(), name, handle, avatarUrl,
                post.getContent(), post.getCreatedAt(),
                likes.countByPostId(post.getId()), 0, comments.countByPostId(post.getId()), liked, mine, bookmarked);
    }

    private UserDTO.UserResponse toUserResponse(User user, Long currentUserId) {
        boolean followedByMe = currentUserId != null && follows.existsByFollowerIdAndFolloweeId(currentUserId, user.getId());
        boolean me = currentUserId != null && currentUserId.equals(user.getId());
        return new UserDTO.UserResponse(
                user.getId(), user.getName(), UserUtil.handleOf(user.getEmail()),
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