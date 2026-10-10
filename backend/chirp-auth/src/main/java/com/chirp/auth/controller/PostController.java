package com.chirp.auth.controller;

import com.chirp.auth.repository.*;
import com.chirp.common.model.*;
import com.chirp.common.security.TokenStoreService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 帖子控制器 — 规范 §3.2 帖子与互动。
 * <p>
 * 改造点：
 * - C3：POST /posts 移除请求体 userId，作者从 token 解析
 * - C4：GET /posts 响应由裸数组改为分页包装，支持 scope
 * - C5：PostResponse 追加 authorAvatarUrl / liked / mine
 * - 新增：帖子详情、删除、点赞/取消、评论 CRUD
 * </p>
 * 鉴权：从 Authorization: Bearer {token} 解析用户 ID（Redis token store），
 * 不再信任请求体或查询参数中的 userId。
 */
@RestController
@RequestMapping("/api/posts")
public class PostController {
    private static final int MAX_LIMIT = 50;

    private final PostRepository posts;
    private final UserRepository users;
    private final LikeRepository likes;
    private final CommentRepository comments;
    private final FollowRepository follows;
    private final NotificationRepository notifications;
    private final TokenStoreService tokenStore;

    public PostController(PostRepository posts, UserRepository users,
                          LikeRepository likes, CommentRepository comments,
                          FollowRepository follows, NotificationRepository notifications,
                          TokenStoreService tokenStore) {
        this.posts = posts;
        this.users = users;
        this.likes = likes;
        this.comments = comments;
        this.follows = follows;
        this.notifications = notifications;
        this.tokenStore = tokenStore;
    }

    /**
     * 规范 §3.2.1 — GET /posts [改造]
     * scope=latest 全站最新（访客可见）；scope=following 我关注的人的帖子
     * 响应为分页包装，items 按 createdAt 倒序
     */
    @GetMapping
    public ResponseEntity<?> list(
            @RequestParam(defaultValue = "latest") String scope,
            @RequestParam(defaultValue = "0") int offset,
            @RequestParam(defaultValue = "20") int limit,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {

        int safeLimit = Math.max(1, Math.min(limit, MAX_LIMIT));
        Long currentUserId = resolveUserId(authorization);

        if ("following".equals(scope)) {
            if (currentUserId == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(new AuthDTO.ErrorResponse("登录已失效，请重新登录"));
            }
            List<Long> followeeIds = follows.findFolloweeIdsByFollowerId(currentUserId);
            if (followeeIds.isEmpty()) {
                return ResponseEntity.ok(PageResponse.of(Collections.emptyList(), 0, offset, safeLimit));
            }
            Page<Post> page = posts.findByUserIdInOrderByCreatedAtDesc(followeeIds, PageRequest.of(offset / safeLimit, safeLimit));
            return ResponseEntity.ok(buildPostPage(page, offset, safeLimit, currentUserId));
        }

        Page<Post> page = posts.findAllByOrderByCreatedAtDesc(PageRequest.of(offset / safeLimit, safeLimit));
        return ResponseEntity.ok(buildPostPage(page, offset, safeLimit, currentUserId));
    }

    /**
     * 规范 §3.2.2 — POST /posts [改造]
     * 作者从 token 解析，请求体仅含 content
     */
    @PostMapping
    public ResponseEntity<?> create(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization,
            @Valid @RequestBody PostDTO.CreatePostRequest request) {

        Long userId = requireAuth(authorization);
        if (userId == null) return unauthorized();

        User author = users.findById(userId).orElse(null);
        if (author == null) return unauthorized();

        String content = request.content().trim();
        if (content.isEmpty()) return badRequest("内容不能为空");
        if (content.codePointCount(0, content.length()) > 500) return badRequest("内容不能超过 500 字符");

        Post saved = posts.save(new Post(author.getId(), content));
        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(saved, author, false, true));
    }

    /** 规范 §3.2.3 — GET /posts/{id} [新增] */
    @GetMapping("/{id}")
    public ResponseEntity<?> get(@PathVariable Long id,
                                 @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
        Post post = posts.findById(id).orElse(null);
        if (post == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error("帖子不存在"));

        Long currentUserId = resolveUserId(authorization);
        User author = users.findById(post.getUserId()).orElse(null);
        boolean liked = currentUserId != null && likes.existsByUserIdAndPostId(currentUserId, id);
        boolean mine = currentUserId != null && currentUserId.equals(post.getUserId());
        return ResponseEntity.ok(toResponse(post, author, liked, mine));
    }

    /** 规范 §3.2.4 — DELETE /posts/{id} [新增] */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id,
                                       @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
        Long userId = requireAuth(authorization);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        Post post = posts.findById(id).orElse(null);
        if (post == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        if (!post.getUserId().equals(userId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        posts.delete(post);
        return ResponseEntity.noContent().build();
    }

    /** 规范 §3.2.6 — POST /posts/{id}/like [新增]（幂等） */
    @PostMapping("/{id}/like")
    public ResponseEntity<?> like(@PathVariable Long id,
                                  @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
        Long userId = requireAuth(authorization);
        if (userId == null) return unauthorized();

        Post post = posts.findById(id).orElse(null);
        if (post == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error("帖子不存在"));

        if (!likes.existsByUserIdAndPostId(userId, id)) {
            likes.save(new Like(userId, id));
            if (!post.getUserId().equals(userId)) {
                notifications.save(new Notification(post.getUserId(), userId, "like", id, null));
            }
        }
        long likeCount = likes.countByPostId(id);
        return ResponseEntity.ok(new PostDTO.LikeResponse(true, likeCount));
    }

    /** 规范 §3.2.7 — DELETE /posts/{id}/like [新增]（幂等） */
    @DeleteMapping("/{id}/like")
    public ResponseEntity<?> unlike(@PathVariable Long id,
                                    @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
        Long userId = requireAuth(authorization);
        if (userId == null) return unauthorized();

        Post post = posts.findById(id).orElse(null);
        if (post == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error("帖子不存在"));

        likes.findByUserIdAndPostId(userId, id).ifPresent(likes::delete);
        long likeCount = likes.countByPostId(id);
        return ResponseEntity.ok(new PostDTO.LikeResponse(false, likeCount));
    }

    /** 规范 §3.2.8 — GET /posts/{id}/comments [新增]（按 createdAt 升序） */
    @GetMapping("/{id}/comments")
    public ResponseEntity<?> listComments(@PathVariable Long id,
                                          @RequestParam(defaultValue = "0") int offset,
                                          @RequestParam(defaultValue = "20") int limit,
                                          @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
        Post post = posts.findById(id).orElse(null);
        if (post == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error("帖子不存在"));

        int safeLimit = Math.max(1, Math.min(limit, MAX_LIMIT));
        Long currentUserId = resolveUserId(authorization);

        Page<Comment> page = comments.findByPostIdOrderByCreatedAtAsc(id, PageRequest.of(offset / safeLimit, safeLimit));
        List<Long> userIds = page.getContent().stream().map(Comment::getUserId).distinct().toList();
        Map<Long, User> authorMap = users.findAllById(userIds).stream()
                .collect(Collectors.toMap(User::getId, Function.identity()));

        List<CommentDTO.CommentResponse> items = page.getContent().stream()
                .map(c -> toCommentResponse(c, authorMap.get(c.getUserId()), currentUserId))
                .toList();
        return ResponseEntity.ok(PageResponse.of(items, page.getTotalElements(), offset, safeLimit));
    }

    /** 规范 §3.2.9 — POST /posts/{id}/comments [新增] */
    @PostMapping("/{id}/comments")
    public ResponseEntity<?> createComment(@PathVariable Long id,
                                           @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization,
                                           @Valid @RequestBody CommentDTO.CreateCommentRequest request) {
        Long userId = requireAuth(authorization);
        if (userId == null) return unauthorized();

        Post post = posts.findById(id).orElse(null);
        if (post == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error("帖子不存在"));

        String content = request.content().trim();
        if (content.isEmpty()) return badRequest("评论不能为空");
        if (content.codePointCount(0, content.length()) > 500) return badRequest("评论不能超过 500 字符");

        Comment saved = comments.save(new Comment(id, userId, content));
        if (!post.getUserId().equals(userId)) {
            notifications.save(new Notification(post.getUserId(), userId, "comment", id, saved.getId()));
        }

        User author = users.findById(userId).orElse(null);
        return ResponseEntity.status(HttpStatus.CREATED).body(toCommentResponse(saved, author, userId));
    }

    private Long resolveUserId(String authorization) {
        if (authorization == null || !authorization.startsWith("Bearer ")) return null;
        String token = authorization.substring("Bearer ".length()).trim();
        if (token.isEmpty()) return null;
        return tokenStore.getUserId(token);
    }

    private Long requireAuth(String authorization) {
        return resolveUserId(authorization);
    }

    private PageResponse<PostDTO.PostResponse> buildPostPage(Page<Post> page, int offset, int limit, Long currentUserId) {
        List<Post> postList = page.getContent();
        if (postList.isEmpty()) return PageResponse.of(Collections.emptyList(), page.getTotalElements(), offset, limit);

        List<Long> userIds = postList.stream().map(Post::getUserId).distinct().toList();
        Map<Long, User> authorMap = users.findAllById(userIds).stream()
                .collect(Collectors.toMap(User::getId, Function.identity()));

        Set<Long> likedPostIds = Collections.emptySet();
        if (currentUserId != null) {
            likedPostIds = new HashSet<>(likes.findLikedPostIdsByUserId(currentUserId,
                    postList.stream().map(Post::getId).toList()));
        }

        Set<Long> finalLikedPostIds = likedPostIds;
        List<PostDTO.PostResponse> items = postList.stream()
                .map(p -> toResponse(p, authorMap.get(p.getUserId()),
                        finalLikedPostIds.contains(p.getId()),
                        currentUserId != null && currentUserId.equals(p.getUserId())))
                .toList();
        return PageResponse.of(items, page.getTotalElements(), offset, limit);
    }

    private PostDTO.PostResponse toResponse(Post post, User author, boolean liked, boolean mine) {
        String name = author != null ? author.getName() : "未知用户";
        String handle = author != null ? AuthController.handleOf(author.getEmail()) : "unknown";
        String avatarUrl = author != null ? author.getAvatarUrl() : null;
        long likeCount = likes.countByPostId(post.getId());
        long commentCount = comments.countByPostId(post.getId());
        return new PostDTO.PostResponse(
                post.getId(), post.getUserId(), name, handle, avatarUrl,
                post.getContent(), post.getCreatedAt(), likeCount, 0, commentCount, liked, mine);
    }

    private CommentDTO.CommentResponse toCommentResponse(Comment comment, User author, Long currentUserId) {
        String name = author != null ? author.getName() : "未知用户";
        String handle = author != null ? AuthController.handleOf(author.getEmail()) : "unknown";
        String avatarUrl = author != null ? author.getAvatarUrl() : null;
        boolean mine = currentUserId != null && currentUserId.equals(comment.getUserId());
        return new CommentDTO.CommentResponse(
                comment.getId(), comment.getPostId(), comment.getUserId(),
                name, handle, avatarUrl, comment.getContent(), comment.getCreatedAt(), mine);
    }

    private ResponseEntity<?> unauthorized() {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new AuthDTO.ErrorResponse("登录已失效，请重新登录"));
    }

    private ResponseEntity<?> badRequest(String message) {
        return ResponseEntity.badRequest().body(new AuthDTO.ErrorResponse(message));
    }

    private AuthDTO.ErrorResponse error(String message) {
        return new AuthDTO.ErrorResponse(message);
    }
}