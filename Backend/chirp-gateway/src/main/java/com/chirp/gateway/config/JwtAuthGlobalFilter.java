package com.chirp.gateway.config;

import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.nio.charset.StandardCharsets;

/**
 * 网关全局鉴权过滤器 — 规范 D1：DB token（64 位随机字符串），不用 JWT。
 * <p>
 * 规则：
 * <ul>
 *   <li>OPTIONS 预检请求直接放行</li>
 *   <li>/api/auth/**（注册/登录/公钥/忘记密码）放行</li>
 *   <li>GET /api/posts/**（时间线浏览）放行</li>
 *   <li>GET /api/users/{id}（用户公开资料）放行</li>
 *   <li>GET /api/search（搜索）放行</li>
 *   <li>actuator 健康检查放行</li>
 *   <li>其余 /api/** 请求必须携带有效 Bearer token，否则统一返回 401</li>
 * </ul>
 * 鉴权流程：
 * <ol>
 *   <li>从 Redis 检查 token 是否存在（支持登出主动失效）</li>
 *   <li>从 Redis 读取 userId，写入 X-User-Id 头供下游服务使用</li>
 * </ol>
 * </p>
 */
@Component
public class JwtAuthGlobalFilter implements GlobalFilter, Ordered {

    private final ReactiveRedisTokenStore tokenStore;

    public JwtAuthGlobalFilter(ReactiveRedisTokenStore tokenStore) {
        this.tokenStore = tokenStore;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        String path = request.getURI().getPath();
        HttpMethod method = request.getMethod();

        if (method == HttpMethod.OPTIONS || isOpen(path, method)) {
            return chain.filter(exchange);
        }

        String authorization = request.getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            return unauthorized(exchange, "缺少登录凭证，请先登录");
        }

        String token = authorization.substring("Bearer ".length()).trim();

        return tokenStore.isValid(token)
                .flatMap(valid -> {
                    if (!valid) {
                        return unauthorized(exchange, "登录已失效，请重新登录");
                    }
                    return tokenStore.getUserId(token).flatMap(userId -> {
                        ServerHttpRequest authenticated = request.mutate()
                                .headers(headers -> {
                                    headers.remove("X-User-Id");
                                    headers.remove("X-User-Email");
                                    if (userId != null) headers.set("X-User-Id", userId);
                                })
                                .build();
                        return chain.filter(exchange.mutate().request(authenticated).build());
                    });
                });
    }

    private boolean isOpen(String path, HttpMethod method) {
        if (path.startsWith("/api/auth/")) return true;
        if (method == HttpMethod.GET && path.startsWith("/api/posts")) return true;
        if (method == HttpMethod.GET && path.matches("/api/users/\\d+")) return true;
        if (method == HttpMethod.GET && path.startsWith("/api/users/") && (path.contains("/posts") || path.contains("/followers") || path.contains("/following"))) return true;
        if (method == HttpMethod.GET && path.startsWith("/api/search")) return true;
        if (method == HttpMethod.GET && path.startsWith("/api/hashtags")) return true;
        if (method == HttpMethod.GET && path.startsWith("/api/posts/") && path.contains("/comments")) return true;
        if (path.startsWith("/actuator")) return true;
        return false;
    }

    private Mono<Void> unauthorized(ServerWebExchange exchange, String message) {
        exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
        exchange.getResponse().getHeaders().setContentType(MediaType.APPLICATION_JSON);
        String json = "{\"message\":\"" + message + "\"}";
        byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
        return exchange.getResponse()
                .writeWith(Mono.just(exchange.getResponse().bufferFactory().wrap(bytes)));
    }

    @Override
    public int getOrder() {
        return -100;
    }
}