package com.chirp.common.security;

/**
 * Token 存储服务接口 — 将 JWT token 存入/查询/移除外部存储（如 Redis）。
 * <p>
 * 用途：支持 token 主动失效（登出、踢下线、修改密码后批量失效），
 * 弥补纯无状态 JWT 无法在过期前撤销的缺陷。
 * <p>
 * 部署形态：
 * <ul>
 *   <li>chirp-auth：签发 token 后调用 store，登出时调用 remove</li>
 *   <li>chirp-gateway：鉴权时调用 isValid，若 token 不在 Redis 中则拒绝</li>
 * </ul>
 */
public interface TokenStoreService {

    /**
     * 将 token 存入外部存储，设置与 JWT 一致的过期时间。
     *
     * @param token           JWT 令牌字符串
     * @param userId          用户 id
     * @param expirationMillis 过期时间（毫秒），与 JWT 的 exp 保持一致
     */
    void store(String token, Long userId, long expirationMillis);

    /**
     * 检查 token 是否仍有效（存在于外部存储中）。
     *
     * @param token JWT 令牌字符串
     * @return true 表示 token 仍有效，false 表示已被移除（登出/失效）
     */
    boolean isValid(String token);

    /**
     * 移除 token（登出时调用），使该 token 立即失效。
     *
     * @param token 令牌字符串
     */
    void remove(String token);

    /**
     * 根据 token 获取关联的用户 ID。
     * <p>
     * 用于下游服务从 Authorization 头解析当前用户身份（纵深防御）。
     * token 无效或已过期时返回 null。
     * </p>
     *
     * @param token 令牌字符串
     * @return 用户 ID，token 无效时返回 null
     */
    Long getUserId(String token);
}