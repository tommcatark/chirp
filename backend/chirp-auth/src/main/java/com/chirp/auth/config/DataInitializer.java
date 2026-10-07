package com.chirp.auth.config;

import com.chirp.auth.repository.UserRepository;
import com.chirp.common.model.User;
import com.chirp.common.util.PasswordEncoderUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

/**
 * 测试数据初始化器 — 应用启动时自动插入测试用户。
 * <p>
 * 关键逻辑：
 * - 仅在 users 表为空时插入（幂等，重启不会重复插入）
 * - 密码使用 BCrypt 哈希入库（通过 PasswordEncoderUtil 统一调用）
 * - 仅用于开发/测试环境，生产环境应通过迁移脚本或管理接口创建用户
 * </p>
 */
@Component
public class DataInitializer implements CommandLineRunner {
    private static final Logger log = LoggerFactory.getLogger(DataInitializer.class);
    private final UserRepository users;

    public DataInitializer(UserRepository users) { this.users = users; }

    @Override
    public void run(String... args) {
        // 幂等检查：已有数据则跳过
        if (users.count() > 0) {
            log.info("测试数据已存在，跳过初始化");
            return;
        }
        log.info("正在插入测试数据...");

        // 插入 5 条测试用户，密码统一为 "password123"（BCrypt 哈希）
        users.save(new User("张三", "zhangsan@example.com", PasswordEncoderUtil.encode("password123")));
        users.save(new User("李四", "lisi@example.com", PasswordEncoderUtil.encode("password123")));
        users.save(new User("王五", "wangwu@example.com", PasswordEncoderUtil.encode("password123")));
        users.save(new User("赵六", "zhaoliu@example.com", PasswordEncoderUtil.encode("password123")));
        users.save(new User("孙七", "sunqi@example.com", PasswordEncoderUtil.encode("password123")));

        log.info("已插入 5 条测试用户数据");
    }
}