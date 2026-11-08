package com.chirp.common.model;

import java.time.Instant;

/**
 * 用户相关 DTO。
 * <p>
 * 规范 §3.0：
 * - UserResponse：公开资料，不含 email
 * - UserMeResponse：UserResponse + email，仅 GET/PUT /users/me 返回
 * - UpdateUserRequest：三个字段全部可选，只传需要修改的
 * </p>
 */
public final class UserDTO {

    public record UserResponse(
            Long id,
            String name,
            String handle,
            String bio,
            String avatarUrl,
            Instant createdAt,
            long postCount,
            long followingCount,
            long followerCount,
            boolean followedByMe,
            boolean me
    ) {}

    public record UserMeResponse(
            Long id,
            String name,
            String handle,
            String bio,
            String avatarUrl,
            Instant createdAt,
            long postCount,
            long followingCount,
            long followerCount,
            boolean followedByMe,
            boolean me,
            String email
    ) {}

    public record UpdateUserRequest(
            String name,
            String bio,
            String avatarUrl
    ) {}

    private UserDTO() {}
}