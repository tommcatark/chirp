import { useState } from "react";
import { Link } from "react-router-dom";
import { formatCount, timeAgo } from "../../lib/utils.js";
import Avatar from "../ui/Avatar.jsx";
import CommentPanel from "./CommentPanel.jsx";

const TAG_PATTERN = /(#[^\s#]+)/g;

/* 正文按话题标签切分，标签渲染为可跳转的链接 */
function renderContent(text) {
  const source = String(text || "");
  return source.split(TAG_PATTERN).map((part, index) => {
    if (!part) return null;
    if (part.startsWith("#")) {
      return (
        <Link
          className="chirp-tag"
          to={`/topic/${encodeURIComponent(part.slice(1))}`}
          key={`tag-${index}`}
        >
          {part}
        </Link>
      );
    }
    return <span key={`text-${index}`}>{part}</span>;
  });
}

export default function PostCard({
  post,
  highlighted = false,
  onToggleLike,
  onToggleBookmark,
  onDelete,
  onCommentCountChange
}) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [reposted, setReposted] = useState(post.reposted);
  const [reposts, setReposts] = useState(post.reposts);
  const [deleting, setDeleting] = useState(false);

  const toggleRepost = () => {
    const next = !reposted;
    setReposted(next);
    setReposts((count) => Math.max(0, count + (next ? 1 : -1)));
  };

  const handleDelete = async () => {
    if (deleting) return;
    if (!window.confirm("确定删除这条鸣响吗？删除后不可恢复，其评论和点赞也会一并删除。")) return;
    setDeleting(true);
    try {
      await onDelete(post);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <article className={`chirp${highlighted ? " just-posted" : ""}`} data-id={post.id}>
      <Link to={`/profile/${post.userId}`} aria-label={`查看 ${post.author.name} 的主页`}>
        <Avatar seed={post.userId} name={post.author.name} src={post.avatarUrl} />
      </Link>
      <div className="chirp-main">
        <p className="chirp-head">
          <Link to={`/profile/${post.userId}`}>
            <strong>{post.author.name}</strong>
          </Link>
          <span className="handle">@{post.author.handle}</span>
          <span className="dot">·</span>
          <time>{timeAgo(post.createdAt)}</time>
          {post.mine ? (
            <button
              type="button"
              className="post-delete"
              title="删除这条鸣响"
              aria-label="删除这条鸣响"
              disabled={deleting}
              onClick={handleDelete}
            >
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6M10 11v6M14 11v6" />
              </svg>
            </button>
          ) : null}
        </p>
        <p className="chirp-content">{renderContent(post.text)}</p>
        <div className="chirp-foot">
          <button
            type="button"
            className="action action-comment"
            title="评论"
            onClick={() => setCommentsOpen((prev) => !prev)}
          >
            <svg viewBox="0 0 24 24" width="17" height="17">
              <path d="M21 12a8 8 0 0 1-11.5 7.2L4 20l.9-4.4A8 8 0 1 1 21 12Z" />
            </svg>
            <span>{formatCount(post.comments)}</span>
          </button>
          <button
            type="button"
            className={`action action-repost${reposted ? " on" : ""}`}
            title="转发"
            onClick={toggleRepost}
          >
            <svg viewBox="0 0 24 24" width="17" height="17">
              <path d="M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3" />
            </svg>
            <span>{formatCount(reposts)}</span>
          </button>
          <button
            type="button"
            className={`action action-like${post.liked ? " on" : ""}`}
            title="喜欢"
            onClick={() => onToggleLike(post)}
          >
            <svg viewBox="0 0 24 24" width="17" height="17">
              <path d="M12 21s-7.5-4.6-9.7-9C.8 8.7 2.4 5 5.8 5c2 0 3.3 1.1 4.2 2.4C10.9 6.1 12.2 5 14.2 5 17.6 5 19.2 8.7 21.7 12c-2.2 4.4-9.7 9-9.7 9Z" />
            </svg>
            <span>{formatCount(post.likes)}</span>
          </button>
          <button type="button" className="action action-share" title="分享">
            <svg viewBox="0 0 24 24" width="17" height="17">
              <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M12 15V3M8 7l4-4 4 4" />
            </svg>
          </button>
          <button
            type="button"
            className={`action action-bookmark${post.bookmarked ? " on" : ""}`}
            title="收藏"
            onClick={() => onToggleBookmark(post)}
          >
            <svg viewBox="0 0 24 24" width="17" height="17">
              <path d="M6 3h12v18l-6-4-6 4Z" />
            </svg>
          </button>
        </div>
        <div className={`comment-panel${commentsOpen ? "" : " hidden"}`}>
          <CommentPanel
            postId={post.id}
            active={commentsOpen}
            onCountChange={(delta) => onCommentCountChange(post.id, delta)}
          />
        </div>
      </div>
    </article>
  );
}
