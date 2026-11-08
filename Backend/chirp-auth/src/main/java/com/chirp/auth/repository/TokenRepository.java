package com.chirp.auth.repository;

import com.chirp.common.model.Token;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

/**
 * 令牌数据访问层 — JPA Repository。
 * <p>
 * 规范 D1：DB token，64 位随机字符串，7 天过期，可即时作废。
 * token 落 tokens 表，登出时删除对应记录。
 * </p>
 */
public interface TokenRepository extends JpaRepository<Token, Long> {
    Optional<Token> findByToken(String token);
    void deleteByToken(String token);
}