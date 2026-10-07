package com.chirp.auth.controller;

import com.chirp.auth.config.CryptoKeyService;
import com.chirp.auth.repository.UserRepository;
import com.chirp.common.model.AuthDTO;
import com.chirp.common.model.User;
import com.chirp.common.util.PasswordEncoderUtil;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 认证控制器 — 处理注册、登录、忘记密码、RSA 公钥下发。
 * <p>
 * 关键功能：
 * - /public-key：下发 RSA 公钥，前端用于加密密码传输
 * - /register：注册新用户（RSA 解密 → BCrypt 哈希 → 入库）
 * - /login：登录验证（RSA 解密 → BCrypt 匹配）
 * - /forgot-password：忘记密码（预留接口，当前仅返回提示）
 * </p>
 *
 * 关键技术：
 * - RSA-OAEP 传输加密：前端加密 → 后端解密 → BCrypt 校验/入库
 * - BCrypt 哈希：每次 encode 结果不同（内置随机盐），matches 可正确校验
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final UserRepository users;
    private final CryptoKeyService cryptoKeys;

    public AuthController(UserRepository users, CryptoKeyService cryptoKeys) {
        this.users = users;
        this.cryptoKeys = cryptoKeys;
    }

    /**
     * 下发 RSA 公钥（SPKI DER 的 Base64）。
     * 前端获取后用于 RSA-OAEP(SHA-256) 加密密码，密文通过 login/register 请求发送。
     */
    @GetMapping("/public-key")
    public Map<String, String> publicKey() {
        return Map.of("publicKey", cryptoKeys.getPublicKeyBase64());
    }

    /**
     * 用户注册 — RSA 解密密码 → 校验长度 → BCrypt 哈希 → 入库。
     * <p>
     * 关键流程：
     * 1. decryptOrReject：RSA 解密前端密文，失败则拒绝（不暴露细节）
     * 2. 密码长度校验：8~100 字符
     * 3. 邮箱唯一性检查：忽略大小写
     * 4. BCrypt 哈希入库
     * </p>
     */
    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody AuthDTO.RegisterRequest request) {
        // 第一步：RSA 解密前端密文
        String password = decryptOrReject(request.password());
        if (password == null) return badRequest("无效的请求，请刷新页面后重试。");

        // 第二步：密码长度校验
        if (password.length() < 8 || password.length() > 100) return badRequest("密码至少需要 8 位字符");

        // 第三步：邮箱唯一性检查（忽略大小写）
        String email = request.email().trim().toLowerCase();
        if (users.existsByEmailIgnoreCase(email)) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(new AuthDTO.ErrorResponse("该邮箱已经注册"));
        }

        // 第四步：BCrypt 哈希入库
        User user = users.save(new User(request.name().trim(), email, PasswordEncoderUtil.encode(password)));
        return ResponseEntity.status(HttpStatus.CREATED).body(new AuthDTO.AuthResponse(user.getId(), user.getName(), user.getEmail(), "注册成功"));
    }

    /**
     * 用户登录 — RSA 解密密码 → 查找用户 → BCrypt 匹配。
     * <p>
     * 关键流程：
     * 1. decryptOrReject：RSA 解密前端密文
     * 2. 按邮箱查找用户（忽略大小写）
     * 3. BCrypt 匹配密码哈希
     * </p>
     */
    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody AuthDTO.LoginRequest request) {
        // RSA 解密
        String password = decryptOrReject(request.password());
        if (password == null) return badRequest("无效的请求，请刷新页面后重试。");

        // 查找用户 + BCrypt 校验
        String finalPassword = password;
        return users.findByEmailIgnoreCase(request.email().trim())
                .filter(user -> PasswordEncoderUtil.matches(finalPassword, user.getPasswordHash()))
                .<ResponseEntity<?>>map(user -> ResponseEntity.ok(new AuthDTO.AuthResponse(user.getId(), user.getName(), user.getEmail(), "登录成功")))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new AuthDTO.ErrorResponse("邮箱或密码不正确")));
    }

    /**
     * 忘记密码 — 预留接口，当前仅返回提示消息。
     * 后续可集成邮件/短信发送重置链接。
     */
    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgotPassword(@Valid @RequestBody AuthDTO.ForgotPasswordRequest request) {
        return ResponseEntity.ok(new AuthDTO.MessageResponse("如果该邮箱已注册，重置密码的链接将发送到你的邮箱。"));
    }

    /**
     * 解密前端 RSA 密文；任何异常都视为非法请求（不向前端暴露细节）。
     * <p>
     * 关键安全策略：
     * - 解密失败返回 null，由调用方统一返回"无效请求"提示
     * - 不区分"密文格式错误"和"密钥不匹配"，避免信息泄露
     * </p>
     */
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
}