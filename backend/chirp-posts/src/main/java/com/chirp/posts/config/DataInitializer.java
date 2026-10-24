package com.chirp.posts.config;

import com.chirp.posts.repository.PostRepository;
import com.chirp.posts.repository.UserRepository;
import com.chirp.common.model.Post;
import com.chirp.common.model.User;
import com.chirp.common.util.PasswordEncoderUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
public class DataInitializer implements CommandLineRunner {
    private static final Logger log = LoggerFactory.getLogger(DataInitializer.class);
    private final UserRepository users;
    private final PostRepository posts;

    public DataInitializer(UserRepository users, PostRepository posts) {
        this.users = users;
        this.posts = posts;
    }

    @Override
    public void run(String... args) {
        seedUsers();
        seedPosts();
    }

    private void seedUsers() {
        if (users.count() > 0) {
            log.info("测试用户已存在，跳过用户初始化");
            return;
        }
        log.info("正在插入测试用户...");
        users.save(new User("张三", "zhangsan@example.com", PasswordEncoderUtil.encode("password123")));
        users.save(new User("李四", "lisi@example.com", PasswordEncoderUtil.encode("password123")));
        users.save(new User("王五", "wangwu@example.com", PasswordEncoderUtil.encode("password123")));
        users.save(new User("赵六", "zhaoliu@example.com", PasswordEncoderUtil.encode("password123")));
        users.save(new User("孙七", "sunqi@example.com", PasswordEncoderUtil.encode("password123")));
        log.info("已插入 5 条测试用户数据");
    }

    private void seedPosts() {
        if (posts.count() > 0) {
            log.info("示例帖子已存在，跳过帖子初始化");
            return;
        }
        Map<String, String> samples = Map.of(
                "zhangsan@example.com", "好想法不该只停留在脑海里，说出来就是第一步。今天也要认真发声。",
                "lisi@example.com", "今天的日落值得一条头条 ✦ 你们那边的天空是什么颜色？",
                "wangwu@example.com", "读书摘记：「声音看不见形状，却能在人心里留下轮廓。」",
                "zhaoliu@example.com", "晨跑五公里，风灌进耳朵的声音，像世界在给我鼓掌。早安，各位。",
                "sunqi@example.com", "刚在鸣上发了第一条，有人听见吗？🌙 愿每一个安静的灵魂都能找到共鸣。"
        );

        int inserted = 0;
        for (Map.Entry<String, String> entry : samples.entrySet()) {
            User user = users.findByEmailIgnoreCase(entry.getKey()).orElse(null);
            if (user == null) continue;
            posts.save(new Post(user.getId(), entry.getValue()));
            inserted++;
        }
        log.info("已插入 {} 条示例帖子", inserted);
    }
}