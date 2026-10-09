package com.chirp.gateway.config;

import com.chirp.common.security.JwtService;
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
 * 网关全局 JWT 鉴权过滤器。
 * <p>
 * 规则：
 * <ul>
 *   <li>OPTIONS 预检请求直接放行（CORS 由 CorsWebFilter 处理，预检不带 Authorization）</li>
 *   <li>/api/auth/**（注册/登录/公钥/忘记密码/登出）放行</li>
 *   <li>GET /api/posts/**（时间线浏览）放行</li>
 *   <li>actuator 健康检查放行</li>
 *   <li>其余 /api/** 请求必须携带有效 Bearer JWT，否则统一返回 401</li>
 * </ul>
 * 鉴权流程（两层校验）：
 * <ol>
 *   <li>JWT 签名 + 过期时间校验（无状态，JwtService.verify）</li>
 *   <li>Redis token 存在性校验（有状态，支持登出主动失效）</li>
 * </ol>
 * 校验通过后，先剥离客户端伪造的 X-User-* 头，再写入由令牌解析出的身份头，
 * 供下游服务使用（下游仍会再次校验 JWT，形成纵深防御）。
 * </p>
 */
@Component
public class JwtAuthGlobalFilter implements GlobalFilter, Ordered {

    private final JwtService jwtService;
    private final ReactiveRedisTokenStore tokenStore;

    public JwtAuthGlobalFilter(JwtService jwtService, ReactiveRedisTokenStore tokenStore) {
        this.jwtService = jwtService;
        this.tokenStore = tokenStore;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        String path = request.getURI().getPath();
        HttpMethod method = request.getMethod();

        // 公开路径与 CORS 预检无需令牌
        if (method == HttpMethod.OPTIONS || isOpen(path, method)) {
            return chain.filter(exchange);
        }

        String authorization = request.getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            return unauthorized(exchange, "缺少登录凭证，请先登录");
        }

        String token = authorization.substring("Bearer ".length()).trim();
        JwtService.JwtPayload payload;
        try {
            payload = jwtService.verify(token);
        } catch (Exception e) {
            return unauthorized(exchange, "登录已过期，请重新登录");
        }

        // 第二层校验：检查 Redis 中是否存在该 token（支持登出主动失效）
        return tokenStore.isValid(token)
                .flatMap(valid -> {
                    if (!valid) {
                        return unauthorized(exchange, "登录已失效，请重新登录");
                    }
                    // 剥离外部伪造身份头，写入经令牌验证的身份，再转发下游
                    ServerHttpRequest authenticated = request.mutate()
                            .headers(headers -> {
                                headers.remove("X-User-Id");
                                headers.remove("X-User-Email");
                                headers.set("X-User-Id", String.valueOf(payload.userId()));
                                if (payload.email() != null) headers.set("X-User-Email", payload.email());
                            })
                            .build();
                    return chain.filter(exchange.mutate().request(authenticated).build());
                });
    }

    /** 公开访问规则：认证接口、帖子的 GET 浏览、健康检查。 */
    private boolean isOpen(String path, HttpMethod method) {
        if (path.startsWith("/api/auth/")) return true;
        if (method == HttpMethod.GET && path.startsWith("/api/posts")) return true;
        if (path.startsWith("/actuator")) return true;
        return false;
    }

    /** 返回统一 JSON 401 响应。 */
    private Mono<Void> unauthorized(ServerWebExchange exchange, String message) {
        exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
        exchange.getResponse().getHeaders().setContentType(MediaType.APPLICATION_JSON);
        String json = "{\"message\":\"" + message + "\"}";
        byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
        return exchange.getResponse()
                .writeWith(Mono.just(exchange.getResponse().bufferFactory().wrap(bytes)));
    }

    /** 高优先级：在路由转发前完成鉴权（数值越小越先执行）。 */
    @Override
    public int getOrder() {
        return -100;
    }
}