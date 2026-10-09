package com.chirp.gateway.config;

import com.chirp.common.security.JwtService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * 网关 JWT 配置 — 密钥必须与 chirp-auth 一致，才能校验其签发的令牌。
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
