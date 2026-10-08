package com.chirp.auth;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

/**
 * 认证服务启动类 — 注册/登录/RSA 密钥管理。
 * <p>
 * 关键技术：
 * - @EnableDiscoveryClient：将 chirp-auth 注册到 Nacos，网关通过服务发现路由到此服务
 * - @EntityScan：扫描 chirp-common 模块中的 JPA 实体类（User、Token 等）
 * - @EnableJpaRepositories：扫描 chirp-auth 模块中的 JPA Repository 接口
 * - 服务名由 spring.application.name 决定，网关路由 uri 中的 lb://chirp-auth 需与此一致
 * </p>
 */
@SpringBootApplication
@EnableDiscoveryClient
@EntityScan("com.chirp.common.model")
@EnableJpaRepositories("com.chirp.auth.repository")
public class AuthApplication {
    public static void main(String[] args) {
        SpringApplication.run(AuthApplication.class, args);
    }
}