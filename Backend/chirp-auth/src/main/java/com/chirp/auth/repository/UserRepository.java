package com.chirp.auth.repository;

import com.chirp.common.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

/**
 * 用户数据访问层 — JPA Repository。
 * <p>
 * 规范 §3.1.6 / §3.1.7 / §3.1.8 / §3.2.11：
 * - 按邮箱查找（忽略大小写）
 * - 按昵称搜索（ILIKE）
 * </p>
 */
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmailIgnoreCase(String email);
    boolean existsByEmailIgnoreCase(String email);

    @Query("SELECT u FROM User u WHERE LOWER(u.name) LIKE LOWER(CONCAT('%', :q, '%'))")
    org.springframework.data.domain.Page<User> searchByName(@Param("q") String q, org.springframework.data.domain.Pageable pageable);
}