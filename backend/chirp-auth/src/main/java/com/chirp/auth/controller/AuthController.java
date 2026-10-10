package com.chirp.auth.controller;

import com.chirp.auth.config.CryptoKeyService;
import com.chirp.auth.repository.UserRepository;
import com.chirp.common.model.AuthDTO;
import com.chirp.common.model.User;
import com.chirp.common.security.TokenStoreService;
import com.chirp.common.util.PasswordEncoderUtil;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Map;

/**
 * 认证控制器 — 规范 §3.1 会话与用户。
 * <p>
 * 关键改造（C1）：
 * - token 改为 64 位随机字符串（规范 D1：DB token，不用 JWT）
 * - AuthResponse 追加 token / expiresAt / handle / avatarUrl
 * - 注册成功即登录态，前端不再二次登录
 * - logout 返回 204（规范 §3.1.4）
 * </p>
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final UserRepository users;
    private final CryptoKeyService cryptoKeys;
    private final TokenStoreService tokenStore;
    private final long tokenExpirationMillis;

    public AuthController(UserRepository users,
                          CryptoKeyService cryptoKeys,
                          TokenStoreService tokenStore,
                          @Value("${chirp.jwt.expiration-millis:604800000}") long tokenExpirationMillis) {
        this.users = users;
        this.cryptoKeys = cryptoKeys;
        this.tokenStore = tokenStore;
        this.tokenExpirationMillis = tokenExpirationMillis;
    }

    /** 规范 §3.1.1 — 下发 RSA 公钥（SPKI DER 的 Base64） */
    @GetMapping("/public-key")
    public Map<String, String> publicKey() {
        return Map.of("publicKey", cryptoKeys.getPublicKeyBase64());
    }

    /**
     * 规范 §3.1.2 — 用户注册 [改造]
     * 改造点：响应追加 token / expiresAt / handle / avatarUrl，注册即登录
     */
    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody AuthDTO.RegisterRequest request) {
        String password = decryptOrReject(request.password());
        if (password == null) return badRequest("无效的请求，请刷新页面后重试。");

        if (password.length() < 8 || password.length() > 100) return badRequest("无效的请求，请刷新页面后重试。");

        String name = request.name().trim();
        int nameLen = name.codePointCount(0, name.length());
        if (nameLen < 2 || nameLen > 120) return badRequest("昵称需要 2-120 个字符");

        String email = request.email().trim().toLowerCase();
        if (users.existsByEmailIgnoreCase(email)) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(new AuthDTO.ErrorResponse("该邮箱已经注册"));
        }

        User user = users.save(new User(name, email, PasswordEncoderUtil.encode(password)));
        return ResponseEntity.status(HttpStatus.CREATED).body(buildAuthResponse(user, "注册成功"));
    }

    /**
     * 规范 §3.1.3 — 用户登录 [改造]
     * 改造点：响应追加 token / expiresAt / handle / avatarUrl
     */
    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody AuthDTO.LoginRequest request) {
        String password = decryptOrReject(request.password());
        if (password == null) return badRequest("无效的请求，请刷新页面后重试。");

        String finalPassword = password;
        return users.findByEmailIgnoreCase(request.email().trim())
                .filter(user -> PasswordEncoderUtil.matches(finalPassword, user.getPasswordHash()))
                .<ResponseEntity<?>>map(user -> ResponseEntity.ok(buildAuthResponse(user, "登录成功")))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new AuthDTO.ErrorResponse("邮箱或密码不正确")));
    }

    /**
     * 规范 §3.1.4 — 用户登出 [新增]
     * 响应 204 No Content，删除 token 使其立即失效
     */
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@RequestHeader(HttpHeaders.AUTHORIZATION) String authorization) {
        if (authorization != null && authorization.startsWith("Bearer ")) {
            String token = authorization.substring("Bearer ".length()).trim();
            tokenStore.remove(token);
        }
        return ResponseEntity.noContent().build();
    }

    /** 规范 §3.1.5 — 忘记密码 [现状] */
    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgotPassword(@Valid @RequestBody AuthDTO.ForgotPasswordRequest request) {
        return ResponseEntity.ok(new AuthDTO.MessageResponse("如果该邮箱已注册，重置密码的链接将发送到你的邮箱。"));
    }

    /** 签发 64 位随机 token 并构建 AuthResponse */
    private AuthDTO.AuthResponse buildAuthResponse(User user, String message) {
        String token = generateSecureToken();
        Instant expiresAt = Instant.now().plusMillis(tokenExpirationMillis);
        tokenStore.store(token, user.getId(), tokenExpirationMillis);
        return new AuthDTO.AuthResponse(
                token, expiresAt, user.getId(), user.getName(), user.getEmail(),
                handleOf(user.getEmail()), user.getAvatarUrl(), message
        );
    }

    /** 生成 64 个十六进制字符（32 字节 = 64 hex chars）的随机 token */
    private String generateSecureToken() {
        byte[] bytes = new byte[32];
        SECURE_RANDOM.nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }

    private String decryptOrReject(String cipherText) {
        if (cipherText == null || cipherText.isBlank()) return null;
        try {
            return cryptoKeys.decryptPassword(cipherText);
        } catch (Exception e) {
            return null;
        }
    }

    private ResponseEntity<?> badRequest(String message) {
        return ResponseEntity.badRequest().body(new AuthDTO.ErrorResponse(message));
    }

    static String handleOf(String email) {
        int at = email.indexOf('@');
        return at > 0 ? email.substring(0, at) : email;
    }
}