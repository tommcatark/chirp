package com.chirp.gateway.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.reactive.CorsWebFilter;
import org.springframework.web.cors.reactive.UrlBasedCorsConfigurationSource;

/**
 * 网关跨域配置 — 统一在网关层处理 CORS，微服务无需单独配置。
 * <p>
 * 关键技术点：
 * - Spring Cloud Gateway 基于 WebFlux，需使用 CorsWebFilter（非 WebMvcConfigurer）
 * - 仅允许前端开发服务器 origin 访问
 * - allowedHeaders 设为 "*" 以支持 RSA 公钥等自定义头
 * </p>
 */
@Configuration
public class CorsConfig {

    /** 前端开发服务器地址，从 application.yml 注入 */
    @Value("${app.cors-origin}")
    private String origin;

    /**
     * 构建跨域过滤器 — 所有路由共享同一 CORS 策略。
     * 如需按路由差异化，可改为在 yml 的 spring.cloud.gateway.globalcors 中配置。
     */
    @Bean
    public CorsWebFilter corsWebFilter() {
        CorsConfiguration config = new CorsConfiguration();
        config.addAllowedOrigin(origin);
        config.addAllowedMethod("GET");
        config.addAllowedMethod("POST");
        config.addAllowedMethod("OPTIONS");
        config.addAllowedHeader("*");
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return new CorsWebFilter(source);
    }
}