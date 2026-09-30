package com.chirp.config;

import com.chirp.user.User;
import com.chirp.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;

@Component
public class DataInitializer implements CommandLineRunner {
    private static final Logger log = LoggerFactory.getLogger(DataInitializer.class);
    private final UserRepository users;
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();

    public DataInitializer(UserRepository users) { this.users = users; }

    @Override
    public void run(String... args) {
        if (users.count() > 0) {
            log.info("测试数据已存在，跳过初始化");
            return;
        }
        log.info("正在插入测试数据...");

        users.save(new User("张三", "zhangsan@example.com", encoder.encode("password123")));
        users.save(new User("李四", "lisi@example.com", encoder.encode("password123")));
        users.save(new User("王五", "wangwu@example.com", encoder.encode("password123")));
        users.save(new User("赵六", "zhaoliu@example.com", encoder.encode("password123")));
        users.save(new User("孙七", "sunqi@example.com", encoder.encode("password123")));

        log.info("已插入 5 条测试用户数据");
    }
}