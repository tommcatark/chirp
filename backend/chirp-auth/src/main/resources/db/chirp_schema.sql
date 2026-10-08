-- ============================================================================
-- Chirp 数据库初始化脚本
-- 描述：ALTER 扩展 users 表 + 新建 6 张业务表 + 约束 + 索引
-- 执行方式：docker exec -i pg17 psql -U postgres -d chirp < chirp_schema.sql
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. users 表 — 已有表，仅新增 bio、avatar_url 字段（不重建）
-- ============================================================================
-- 原有字段：id (BIGSERIAL PK), name (VARCHAR(120) NOT NULL),
--           email (VARCHAR(255) NOT NULL UNIQUE), password_hash (VARCHAR(100) NOT NULL),
--           created_at (TIMESTAMPTZ NOT NULL)

-- 简介，最多 200 字符，可为 null
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
COMMENT ON COLUMN users.bio IS '用户简介，最多200字符，可为null';

-- 头像 URL，可为 null
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500);
COMMENT ON COLUMN users.avatar_url IS '头像URL，可为null';

-- bio 长度检查约束
ALTER TABLE users ADD CONSTRAINT ck_users_bio_length CHECK (char_length(bio) <= 200);

-- ============================================================================
-- 2. tokens 表 — 会话/认证令牌
-- ============================================================================
CREATE TABLE IF NOT EXISTS tokens (
    id          BIGSERIAL   PRIMARY KEY,                          -- 主键
    user_id     BIGINT      NOT NULL,                             -- 关联用户
    token       VARCHAR(64) NOT NULL,                             -- 64位随机token
    expires_at  TIMESTAMPTZ NOT NULL,                             -- token过期时间（默认7天）
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()                -- 创建时间
);

COMMENT ON TABLE  tokens IS '会话令牌表 — 存储用户登录后的认证token';
COMMENT ON COLUMN tokens.user_id    IS '令牌所属用户，外键关联users.id，删除用户时级联删除令牌';
COMMENT ON COLUMN tokens.token      IS '64位随机token，用于无状态会话校验';
COMMENT ON COLUMN tokens.expires_at IS 'token过期时间，默认为创建时间+7天';

-- 外键：删除用户时级联删除其所有 token
ALTER TABLE tokens ADD CONSTRAINT fk_tokens_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;

-- 唯一约束：token 全局唯一
ALTER TABLE tokens ADD CONSTRAINT uk_tokens_token UNIQUE (token);

-- ============================================================================
-- 3. posts 表 — 帖子/推文
-- ============================================================================
CREATE TABLE IF NOT EXISTS posts (
    id          BIGSERIAL    PRIMARY KEY,                         -- 主键
    user_id     BIGINT       NOT NULL,                            -- 发帖用户
    content     VARCHAR(500) NOT NULL,                            -- 帖子正文，1-500字符
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()               -- 发帖时间（建立索引）
);

COMMENT ON TABLE  posts IS '帖子表 — 存储用户发布的推文/帖子';
COMMENT ON COLUMN posts.user_id    IS '发帖用户，外键关联users.id，删除用户时级联删除帖子';
COMMENT ON COLUMN posts.content    IS '帖子正文，1-500字符';
COMMENT ON COLUMN posts.created_at IS '发帖时间，建立索引以加速按时间排序查询';

-- 外键：删除用户时级联删除其所有帖子
ALTER TABLE posts ADD CONSTRAINT fk_posts_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;

-- CHECK 约束：帖子内容长度 1-500 字符
ALTER TABLE posts ADD CONSTRAINT ck_posts_content_length
    CHECK (char_length(content) BETWEEN 1 AND 500);

-- 索引：按创建时间排序查询（时间线/动态流核心查询）
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts (created_at DESC);

-- ============================================================================
-- 4. comments 表 — 评论
-- ============================================================================
CREATE TABLE IF NOT EXISTS comments (
    id          BIGSERIAL    PRIMARY KEY,                         -- 主键
    post_id     BIGINT       NOT NULL,                            -- 所属帖子
    user_id     BIGINT       NOT NULL,                            -- 评论用户
    content     VARCHAR(500) NOT NULL,                            -- 评论内容，1-500字符
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()               -- 评论时间
);

COMMENT ON TABLE  comments IS '评论表 — 存储用户对帖子的评论';
COMMENT ON COLUMN comments.post_id    IS '所属帖子，外键关联posts.id，删除帖子时级联删除评论';
COMMENT ON COLUMN comments.user_id    IS '评论用户，外键关联users.id，删除用户时级联删除评论';
COMMENT ON COLUMN comments.content    IS '评论内容，1-500字符';

-- 外键：删除帖子时级联删除其所有评论
ALTER TABLE comments ADD CONSTRAINT fk_comments_post
    FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE;

-- 外键：删除用户时级联删除其所有评论
ALTER TABLE comments ADD CONSTRAINT fk_comments_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;

-- CHECK 约束：评论内容长度 1-500 字符
ALTER TABLE comments ADD CONSTRAINT ck_comments_content_length
    CHECK (char_length(content) BETWEEN 1 AND 500);

-- ============================================================================
-- 5. likes 表 — 点赞
-- ============================================================================
CREATE TABLE IF NOT EXISTS likes (
    id          BIGSERIAL   PRIMARY KEY,                          -- 主键
    user_id     BIGINT      NOT NULL,                             -- 点赞用户
    post_id     BIGINT      NOT NULL,                             -- 被赞帖子
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()                -- 点赞时间
);

COMMENT ON TABLE  likes IS '点赞表 — 存储用户对帖子的点赞记录';
COMMENT ON COLUMN likes.user_id  IS '点赞用户，外键关联users.id，删除用户时级联删除点赞';
COMMENT ON COLUMN likes.post_id  IS '被赞帖子，外键关联posts.id，删除帖子时级联删除点赞';

-- 外键：删除用户时级联删除其所有点赞
ALTER TABLE likes ADD CONSTRAINT fk_likes_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;

-- 外键：删除帖子时级联删除其所有点赞
ALTER TABLE likes ADD CONSTRAINT fk_likes_post
    FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE;

-- 唯一约束：同一用户对同一帖子只能点赞一次
ALTER TABLE likes ADD CONSTRAINT uk_likes_user_post UNIQUE (user_id, post_id);

-- ============================================================================
-- 6. follows 表 — 关注关系
-- ============================================================================
CREATE TABLE IF NOT EXISTS follows (
    id           BIGSERIAL   PRIMARY KEY,                         -- 主键
    follower_id  BIGINT      NOT NULL,                            -- 关注人（主动关注方）
    followee_id  BIGINT      NOT NULL,                            -- 被关注人（被动被关注方）
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()               -- 关注时间
);

COMMENT ON TABLE  follows IS '关注关系表 — 存储用户之间的关注/粉丝关系';
COMMENT ON COLUMN follows.follower_id IS '关注人（主动关注方），外键关联users.id，删除用户时级联删除';
COMMENT ON COLUMN follows.followee_id IS '被关注人（被动被关注方），外键关联users.id，删除用户时级联删除';

-- 外键：删除用户时级联删除其作为关注人的记录
ALTER TABLE follows ADD CONSTRAINT fk_follows_follower
    FOREIGN KEY (follower_id) REFERENCES users (id) ON DELETE CASCADE;

-- 外键：删除用户时级联删除其作为被关注人的记录
ALTER TABLE follows ADD CONSTRAINT fk_follows_followee
    FOREIGN KEY (followee_id) REFERENCES users (id) ON DELETE CASCADE;

-- 唯一约束：不能重复关注同一用户
ALTER TABLE follows ADD CONSTRAINT uk_follows_pair UNIQUE (follower_id, followee_id);

-- CHECK 约束：禁止自己关注自己
ALTER TABLE follows ADD CONSTRAINT ck_follows_no_self
    CHECK (follower_id <> followee_id);

-- ============================================================================
-- 7. notifications 表 — 站内通知
-- ============================================================================
CREATE TABLE IF NOT EXISTS notifications (
    id          BIGSERIAL    PRIMARY KEY,                         -- 主键
    user_id     BIGINT       NOT NULL,                            -- 通知接收用户
    actor_id    BIGINT       NOT NULL,                            -- 触发操作的用户
    type        VARCHAR(20)  NOT NULL,                            -- 通知类型：like/comment/follow
    post_id     BIGINT,                                          -- 关联帖子（可为null，点赞/评论通知才填充）
    comment_id  BIGINT,                                          -- 关联评论（可为null，评论通知才填充）
    is_read     BOOLEAN      NOT NULL DEFAULT false,              -- 是否已读
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()               -- 通知创建时间
);

COMMENT ON TABLE  notifications IS '站内通知表 — 存储点赞/评论/关注等通知';
COMMENT ON COLUMN notifications.user_id    IS '通知接收用户，外键关联users.id，删除用户时级联删除通知';
COMMENT ON COLUMN notifications.actor_id   IS '触发操作的用户，外键关联users.id，删除用户时级联删除通知';
COMMENT ON COLUMN notifications.type       IS '通知类型，仅允许 like/comment/follow';
COMMENT ON COLUMN notifications.post_id    IS '关联帖子，可为null；点赞/评论通知才填充；删除帖子时SET NULL';
COMMENT ON COLUMN notifications.comment_id IS '关联评论，可为null；评论通知才填充；删除评论时SET NULL';
COMMENT ON COLUMN notifications.is_read    IS '是否已读，默认false';

-- 外键：删除接收用户时级联删除其所有通知
ALTER TABLE notifications ADD CONSTRAINT fk_notifications_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;

-- 外键：删除触发用户时级联删除其触发的所有通知
ALTER TABLE notifications ADD CONSTRAINT fk_notifications_actor
    FOREIGN KEY (actor_id) REFERENCES users (id) ON DELETE CASCADE;

-- 外键：删除帖子时将关联的 post_id 置为 NULL（通知保留，但帖子引用消失）
ALTER TABLE notifications ADD CONSTRAINT fk_notifications_post
    FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE SET NULL;

-- 外键：删除评论时将关联的 comment_id 置为 NULL（通知保留，但评论引用消失）
ALTER TABLE notifications ADD CONSTRAINT fk_notifications_comment
    FOREIGN KEY (comment_id) REFERENCES comments (id) ON DELETE SET NULL;

-- CHECK 约束：type 仅允许 'like'、'comment'、'follow'
ALTER TABLE notifications ADD CONSTRAINT ck_notifications_type
    CHECK (type IN ('like', 'comment', 'follow'));

-- ============================================================================
-- 8. 补充索引 — 外键索引（PostgreSQL 不自动为外键创建索引，需手动添加）
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_tokens_user_id       ON tokens       (user_id);
CREATE INDEX IF NOT EXISTS idx_posts_user_id        ON posts        (user_id);
CREATE INDEX IF NOT EXISTS idx_comments_post_id     ON comments     (post_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id     ON comments     (user_id);
CREATE INDEX IF NOT EXISTS idx_likes_user_id        ON likes        (user_id);
CREATE INDEX IF NOT EXISTS idx_likes_post_id        ON likes        (post_id);
CREATE INDEX IF NOT EXISTS idx_follows_follower_id  ON follows      (follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_followee_id  ON follows      (followee_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id    ON notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_actor_id   ON notifications (actor_id);
CREATE INDEX IF NOT EXISTS idx_notifications_post_id    ON notifications (post_id) WHERE post_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_comment_id ON notifications (comment_id) WHERE comment_id IS NOT NULL;

COMMIT;