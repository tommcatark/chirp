-- ============================================================================
-- 收藏表建表 SQL — 需在 PostgreSQL 容器中执行
-- 执行方式：docker exec -i <容器名> psql -U postgres -d chirp < bookmark_migration.sql
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS bookmarks (
    id          BIGSERIAL    PRIMARY KEY,
    user_id     BIGINT       NOT NULL,
    post_id     BIGINT       NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

COMMENT ON TABLE  bookmarks IS '收藏表 — 存储用户对帖子的收藏记录';
COMMENT ON COLUMN bookmarks.user_id    IS '收藏者，外键关联users.id，删除用户时级联删除收藏';
COMMENT ON COLUMN bookmarks.post_id    IS '被收藏的帖子，外键关联posts.id，删除帖子时级联删除收藏';
COMMENT ON COLUMN bookmarks.created_at IS '收藏时间，按此倒序排列收藏列表';

ALTER TABLE bookmarks ADD CONSTRAINT fk_bookmarks_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;

ALTER TABLE bookmarks ADD CONSTRAINT fk_bookmarks_post
    FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE;

ALTER TABLE bookmarks ADD CONSTRAINT uk_bookmarks_user_post UNIQUE (user_id, post_id);

CREATE INDEX IF NOT EXISTS idx_bookmarks_user_created ON bookmarks (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookmarks_post_id      ON bookmarks (post_id);

COMMIT;