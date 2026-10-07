package com.chirp.auth.repository;

import com.chirp.common.model.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

/**
 * 用户数据访问层 — JPA Repository。
 * <p>
 * 关键方法：
 * - findByEmailIgnoreCase：按邮箱查找用户，忽略大小写（登录/注册邮箱唯一性检查）
 * - existsByEmailIgnoreCase：判断邮箱是否已注册，忽略大小写
 * </p>
 *
 * 扩展说明：
 * - 如需复杂查询（分页、排序、条件构造），可自定义 @Query 或使用 JpaSpecificationExecutor
 * - 如切换为 MyBatis-Plus，将此接口替换为 BaseMapper<User> 即可
 */
public interface UserRepository extends JpaRepository<User, Long> {
    /** 按邮箱查找用户，忽略大小写（登录时使用） */
    Optional<User> findByEmailIgnoreCase(String email);

    /** 判断邮箱是否已注册，忽略大小写（注册时唯一性检查） */
    boolean existsByEmailIgnoreCase(String email);
}