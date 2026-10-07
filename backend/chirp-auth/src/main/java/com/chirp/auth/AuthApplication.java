package com.chirp.auth;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;

/**
 * 认证服务启动类 — 注册/登录/RSA 密钥管理。
 * <p>
 * 关键技术：
 * - @EnableDiscoveryClient：将 chirp-auth 注册到 Nacos，网关通过服务发现路由到此服务
 * - 服务名由 spring.application.name 决定，网关路由 uri 中的 lb://chirp-auth 需与此一致
 * </p>
 */
@SpringBootApplication
@EnableDiscoveryClient
public class AuthApplication {
    public static void main(String[] args) {
        SpringApplication.run(AuthApplication.class, args);
    }
}