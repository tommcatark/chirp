package com.chirp.auth.config;

import com.chirp.auth.repository.PostRepository;
import com.chirp.auth.repository.UserRepository;
import com.chirp.common.model.Post;
import com.chirp.common.model.User;
import com.chirp.common.util.PasswordEncoderUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * 测试数据初始化器 — 应用启动时幂等插入测试用户与示例帖子。
 * <p>
 * 关键逻辑：
 * - users 表为空时插入 5 个测试用户（密码统一 password123，BCrypt 哈希入库）
 * - posts 表为空时给已有用户插入若干示例帖子，让时间线开箱即有内容
 * - 两段逻辑相互独立、各自幂等，重启不会重复插入
 * - 仅用于开发/测试环境，生产环境应通过迁移脚本维护
 * </p>
 */
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

    /** users 表为空时插入 5 个测试用户。 */
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

    /** posts 表为空时，按 邮箱 -> 文案 的映射给已有用户插入示例帖子。 */
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
            // 按 Map 顺序依次插入，createdAt 毫秒级递增，时间线自然倒序
            posts.save(new Post(user.getId(), entry.getValue()));
            inserted++;
        }
        log.info("已插入 {} 条示例帖子", inserted);
    }
}
