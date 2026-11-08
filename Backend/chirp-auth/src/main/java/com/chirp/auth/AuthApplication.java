package com.chirp.auth;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

/**
 * 认证服务启动类 — 注册/登录/RSA 密钥管理。
 * <p>
 * 关键技术：
 * - @EntityScan：扫描 chirp-common 模块中的 JPA 实体类（User、Token 等）
 * - @EnableJpaRepositories：扫描 chirp-auth 模块中的 JPA Repository 接口
 * </p>
 */
@SpringBootApplication
@EntityScan("com.chirp.common.model")
@EnableJpaRepositories("com.chirp.auth.repository")
@ComponentScan({"com.chirp.auth", "com.chirp.common"})
public class AuthApplication {
    public static void main(String[] args) {
        SpringApplication.run(AuthApplication.class, args);
    }
}