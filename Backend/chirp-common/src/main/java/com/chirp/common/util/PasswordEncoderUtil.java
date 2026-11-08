package com.chirp.common.util;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

/**
 * 密码编码器工具类 — 封装 BCryptPasswordEncoder 为单例。
 * <p>
 * BCrypt 是当前推荐的密码哈希算法（自带盐值、自适应 cost）。
 * 集中在此处实例化，避免各服务重复 new BCryptPasswordEncoder()。
 * </p>
 *
 * 关键技术点：
 * - 默认 cost = 10（2^10 轮哈希），安全性与性能的平衡点
 * - 每次调用 encode() 结果不同（内置随机盐），matches() 可正确校验
 */
public final class PasswordEncoderUtil {

    /** 全局单例 BCrypt 编码器（线程安全，可复用） */
    private static final BCryptPasswordEncoder ENCODER = new BCryptPasswordEncoder();

    public static String encode(CharSequence rawPassword) {
        return ENCODER.encode(rawPassword);
    }

    public static boolean matches(CharSequence rawPassword, String encodedPassword) {
        return ENCODER.matches(rawPassword, encodedPassword);
    }

    public static BCryptPasswordEncoder getEncoder() {
        return ENCODER;
    }

    private PasswordEncoderUtil() {}
}