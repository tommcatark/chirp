package com.chirp.gateway.config;

import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

/**
 * 响应式 Redis token 存储网关侧组件。
 * <p>
 * 网关基于 WebFlux，必须使用 {@link ReactiveStringRedisTemplate} 而非阻塞式 StringRedisTemplate，
 * 否则在 Netty 事件循环中执行 Redis I/O 会阻塞整个网关。
 * <p>
 * Key 前缀 {@value #KEY_PREFIX} 与 chirp-auth 的 RedisTokenStoreService 一致，
 * 两侧共享同一 Redis 实例，实现跨服务 token 校验与主动失效。
 */
@Component
public class ReactiveRedisTokenStore {

    private static final String KEY_PREFIX = "chirp:token:";

    private final ReactiveStringRedisTemplate redisTemplate;

    public ReactiveRedisTokenStore(ReactiveStringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    /**
     * 检查 token 是否仍有效（存在于 Redis 中）。
     * <p>
     * 返回 Mono，适配网关 GlobalFilter 的响应式过滤链。
     */
    public Mono<Boolean> isValid(String token) {
        return redisTemplate.hasKey(KEY_PREFIX + token);
    }

    /**
     * 移除 token（登出/踢下线时调用）。
     */
    public Mono<Boolean> remove(String token) {
        return redisTemplate.delete(KEY_PREFIX + token).map(count -> count > 0);
    }
}