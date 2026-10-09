package com.chirp.common.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

/**
 * JWT 服务 — 登录令牌的签发与校验（HS256 对称签名）。
 * <p>
 * 部署形态：chirp-auth 用同一密钥签发，chirp-gateway 与各微服务用同一密钥校验，
 * 密钥通过各服务 application.yml 的 chirp.jwt.secret 注入（生产用环境变量覆盖）。
 * </p>
 * 载荷（claims）：
 * <ul>
 *   <li>sub：用户邮箱</li>
 *   <li>uid：用户 id（业务身份，接口据此识别请求者）</li>
 *   <li>name：用户昵称</li>
 *   <li>iat / exp：签发与过期时间</li>
 * </ul>
 */
public class JwtService {

    /** 校验通过后返回的调用方身份信息。 */
    public record JwtPayload(Long userId, String email, String name) {}

    private final SecretKey signingKey;
    private final long expirationMillis;

    /**
     * @param secret           HMAC 密钥（UTF-8 字节数必须 ≥ 32，即 256 位）
     * @param expirationMillis 令牌有效期（毫秒）
     */
    public JwtService(String secret, long expirationMillis) {
        byte[] keyBytes = secret.getBytes(StandardCharsets.UTF_8);
        if (keyBytes.length < 32) {
            throw new IllegalStateException("chirp.jwt.secret 长度不足，至少需要 32 字节（256 位）");
        }
        this.signingKey = Keys.hmacShaKeyFor(keyBytes);
        this.expirationMillis = expirationMillis;
    }

    /** 为登录用户签发 JWT。 */
    public String issue(Long userId, String email, String name) {
        long now = System.currentTimeMillis();
        return Jwts.builder()
                .subject(email)
                .claim("uid", userId)
                .claim("name", name)
                .issuedAt(new Date(now))
                .expiration(new Date(now + expirationMillis))
                .signWith(signingKey, Jwts.SIG.HS256)
                .compact();
    }

    /**
     * 校验令牌签名与有效期，返回其中的身份信息。
     *
     * @throws JwtException 令牌为空、签名错误、已过期或载荷非法时抛出
     */
    public JwtPayload verify(String token) {
        Claims claims = Jwts.parser()
                .verifyWith(signingKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();

        Number uid = claims.get("uid", Number.class);
        if (uid == null) {
            throw new JwtException("令牌缺少用户标识(uid)");
        }
        return new JwtPayload(uid.longValue(), claims.getSubject(), claims.get("name", String.class));
    }
}
