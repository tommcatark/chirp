package com.chirp.auth.config;

import com.chirp.common.security.TokenStoreService;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.concurrent.TimeUnit;

/**
 * Redis token 存储实现 — chirp-auth 使用阻塞式 StringRedisTemplate。
 * <p>
 * Key 设计：{@code chirp:token:{jwtToken}} → value: userId
 * <br>
 * TTL 与 JWT 的 expirationMillis 一致，token 自然过期后 Redis 自动清理。
 * <p>
 * 网关（chirp-gateway）使用 ReactiveStringRedisTemplate 读取相同的 key，
 * 两侧共享同一 Redis 实例，实现跨服务 token 校验与主动失效。
 */
@Service
public class RedisTokenStoreService implements TokenStoreService {

    static final String KEY_PREFIX = "chirp:token:";

    private final StringRedisTemplate redisTemplate;

    public RedisTokenStoreService(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    @Override
    public void store(String token, Long userId, long expirationMillis) {
        redisTemplate.opsForValue().set(
                KEY_PREFIX + token,
                String.valueOf(userId),
                expirationMillis,
                TimeUnit.MILLISECONDS
        );
    }

    @Override
    public boolean isValid(String token) {
        return Boolean.TRUE.equals(redisTemplate.hasKey(KEY_PREFIX + token));
    }

    @Override
    public void remove(String token) {
        redisTemplate.delete(KEY_PREFIX + token);
    }
}