package com.chirp.gateway;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;

/**
 * API 网关启动类 — Spring Cloud Gateway + Nacos 服务发现。
 * <p>
 * 关键技术：
 * - Spring Cloud Gateway：基于 WebFlux 的响应式网关，负责路由转发、跨域、限流
 * - @EnableDiscoveryClient：向 Nacos 注册自身并发现其他微服务
 * - 路由配置见 application.yml 的 spring.cloud.gateway.routes 节
 * </p>
 *
 * 注意：Gateway 基于 Netty + WebFlux，不可引入 spring-boot-starter-web（Servlet 栈），
 * 否则启动会报 "Netty started on port" 与 "Tomcat started on port" 冲突。
 */
@SpringBootApplication
@EnableDiscoveryClient
public class GatewayApplication {
    public static void main(String[] args) {
        SpringApplication.run(GatewayApplication.class, args);
    }
}