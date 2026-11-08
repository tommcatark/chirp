package com.chirp.gateway.config;

import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

/**
 * 响应式 Redis token 存储网关侧组件。
 * <p>
 * 规范 D1：DB token（64 位随机字符串），网关从 Redis 校验 token 有效性并读取 userId。
 * Key 前缀与 chirp-auth 的 RedisTokenStoreService 一致。
 */
@Component
public class ReactiveRedisTokenStore {

    private static final String KEY_PREFIX = "chirp:token:";

    private final ReactiveStringRedisTemplate redisTemplate;

    public ReactiveRedisTokenStore(ReactiveStringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    public Mono<Boolean> isValid(String token) {
        return redisTemplate.hasKey(KEY_PREFIX + token);
    }

    public Mono<Boolean> remove(String token) {
        return redisTemplate.delete(KEY_PREFIX + token).map(count -> count > 0);
    }

    public Mono<String> getUserId(String token) {
        return redisTemplate.opsForValue().get(KEY_PREFIX + token);
    }
}