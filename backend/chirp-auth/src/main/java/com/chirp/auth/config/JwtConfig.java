package com.chirp.auth.config;

import com.chirp.common.security.JwtService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * JWT 配置 — 按 application.yml 中的 chirp.jwt.* 参数构建公共 JwtService。
 * 密钥须与 chirp-gateway 保持一致，否则网关无法校验本服务签发的令牌。
 */
@Configuration
public class JwtConfig {

    @Bean
    public JwtService jwtService(
            @Value("${chirp.jwt.secret}") String secret,
            @Value("${chirp.jwt.expiration-millis:604800000}") long expirationMillis) {
        return new JwtService(secret, expirationMillis);
    }
}
