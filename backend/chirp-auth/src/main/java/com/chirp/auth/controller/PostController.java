package com.chirp.auth.controller;

import com.chirp.auth.repository.PostRepository;
import com.chirp.auth.repository.UserRepository;
import com.chirp.common.model.Post;
import com.chirp.common.model.PostDTO;
import com.chirp.common.model.User;
import com.chirp.common.security.JwtService;
import io.jsonwebtoken.JwtException;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 帖子控制器 — 时间线查询与发帖。
 * <p>
 * - GET  /api/posts：获取最新 50 条帖子（含作者昵称、handle），按时间倒序（公开可读）
 * - POST /api/posts：发帖入库，发帖人身份从 Authorization: Bearer {JWT} 解析
 * </p>
 * 安全设计（纵深防御）：网关已对写请求统一校验 JWT，本服务仍再次独立校验，
 * 即使绕过网关直连 8081 也无法伪造身份；请求体不再包含 userId。
 */
@RestController
@RequestMapping("/api/posts")
public class PostController {
    private final PostRepository posts;
    private final UserRepository users;
    private final JwtService jwtService;

    public PostController(PostRepository posts, UserRepository users, JwtService jwtService) {
        this.posts = posts;
        this.users = users;
        this.jwtService = jwtService;
    }

    /** 时间线：最新 50 条帖子，批量带出作者信息（避免 N+1 查询）。 */
    @GetMapping
    public List<PostDTO.PostResponse> list() {
        List<Post> latest = posts.findTop50ByOrderByCreatedAtDesc();
        if (latest.isEmpty()) return Collections.emptyList();

        List<Long> userIds = latest.stream().map(Post::getUserId).distinct().toList();
        Map<Long, User> authorMap = users.findAllById(userIds).stream()
                .collect(Collectors.toMap(User::getId, Function.identity()));

        return latest.stream().map(post -> toResponse(post, authorMap.get(post.getUserId()))).toList();
    }

    /** 发帖：校验 JWT → 确认用户存在 → 内容去首尾空白 → 入库 → 返回完整帖子。 */
    @PostMapping
    public ResponseEntity<?> create(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization,
            @Valid @RequestBody PostDTO.CreatePostRequest request) {

        JwtService.JwtPayload payload = authenticate(authorization);
        if (payload == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new AuthError("登录信息已失效，请重新登录"));
        }

        User author = users.findById(payload.userId()).orElse(null);
        if (author == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new AuthError("登录信息已失效，请重新登录"));
        }
        String content = request.content().trim();
        if (content.isEmpty() || content.length() > 500) {
            return ResponseEntity.badRequest().body(new AuthError("内容长度需在 1-500 字符之间"));
        }

        Post saved = posts.save(new Post(author.getId(), content));
        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(saved, author));
    }

    /**
     * 从 Authorization 头解析并校验 JWT；任何异常（缺失/格式错/过期/签名错）一律返回 null。
     * 不向前端区分失败类型，避免信息泄露。
     */
    private JwtService.JwtPayload authenticate(String authorization) {
        if (authorization == null || !authorization.startsWith("Bearer ")) return null;
        String token = authorization.substring("Bearer ".length()).trim();
        if (token.isEmpty()) return null;
        try {
            return jwtService.verify(token);
        } catch (JwtException | IllegalArgumentException e) {
            return null;
        }
    }

    /** 实体转响应；作者被删除等异常情况下做兜底（外键级联场景一般不会出现）。 */
    private PostDTO.PostResponse toResponse(Post post, User author) {
        String name = author != null ? author.getName() : "未知用户";
        String handle = author != null ? handleOf(author.getEmail()) : "unknown";
        // 点赞/转发/评论接口尚未上线，计数先返回 0，前端交互保持本地态
        return new PostDTO.PostResponse(
                post.getId(), post.getUserId(), name, handle,
                post.getContent(), post.getCreatedAt(), 0, 0, 0);
    }

    /** handle 取邮箱 @ 前缀，与前端展示规则一致。 */
    private String handleOf(String email) {
        int at = email.indexOf('@');
        return at > 0 ? email.substring(0, at) : email;
    }

    /** 复用认证模块的错误结构 {message: "..."}。 */
    private record AuthError(String message) {}
}
