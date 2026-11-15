import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import { postsApi } from "../../lib/api.js";
import { timeAgo } from "../../lib/utils.js";
import Avatar from "../ui/Avatar.jsx";

const MAX_COMMENT_LENGTH = 500;

/* 将后端 CommentResponse 归一化为前端渲染结构 */
function normalizeComment(comment) {
  return {
    id: comment.id,
    userId: comment.userId,
    author: { name: comment.authorName, handle: comment.authorHandle },
    createdAt: Date.parse(comment.createdAt) || Date.now(),
    text: comment.content,
    mine: !!comment.mine
  };
}

export default function CommentPanel({ postId, active, onCountChange }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [removingId, setRemovingId] = useState(null);

  const mountedRef = useRef(false);
  const startedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /* 展开时懒加载一次；收起后再展开不重复请求 */
  useEffect(() => {
    if (!active || startedRef.current || loaded) return;
    startedRef.current = true;
    setLoading(true);
    setError("");
    postsApi
      .comments({ id: postId, offset: 0, limit: 50 })
      .then((data) => {
        if (!mountedRef.current) return;
        const list = Array.isArray(data) ? data : data?.items || [];
        setItems(list.map(normalizeComment));
        setLoaded(true);
      })
      .catch((err) => {
        if (!mountedRef.current || err?.status === 401) return;
        startedRef.current = false;
        setError(err?.message || "评论加载失败，请稍后重试");
      })
      .finally(() => {
        if (mountedRef.current) setLoading(false);
      });
  }, [active, loaded, postId]);

  /* 收起时清理错误，便于再次展开重试 */
  useEffect(() => {
    if (active) return;
    startedRef.current = false;
    setError("");
  }, [active]);

  const submit = async (event) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    setError("");
    try {
      const data = await postsApi.addComment(postId, content);
      if (!mountedRef.current) return;
      setItems((prev) => [...prev, normalizeComment(data)]);
      setLoaded(true);
      setDraft("");
      onCountChange(1);
    } catch (err) {
      if (err?.status === 401) return;
      if (mountedRef.current) setError(err?.message || "评论失败，请稍后重试");
    } finally {
      if (mountedRef.current) setSending(false);
    }
  };

  const remove = async (comment) => {
    if (removingId) return;
    if (!window.confirm("确定删除这条评论吗？")) return;
    setRemovingId(comment.id);
    setError("");
    try {
      await postsApi.removeComment(comment.id);
      if (!mountedRef.current) return;
      setItems((prev) => prev.filter((item) => item.id !== comment.id));
      onCountChange(-1);
    } catch (err) {
      if (err?.status === 401) return;
      if (mountedRef.current) setError(err?.message || "删除失败，请稍后重试");
    } finally {
      if (mountedRef.current) setRemovingId(null);
    }
  };

  let list;
  if (loading) {
    list = <p className="comment-empty">评论加载中…</p>;
  } else if (items.length) {
    list = items.map((comment) => (
      <div className="comment" data-cid={comment.id} key={comment.id}>
        <Avatar seed={comment.userId} name={comment.author.name} size="avatar-sm" />
        <div className="comment-main">
          <p className="comment-head">
            <strong>{comment.author.name}</strong>
            <span className="handle">@{comment.author.handle}</span>
            <span className="dot">·</span>
            <time>{timeAgo(comment.createdAt)}</time>
          </p>
          <p className="comment-content">{comment.text}</p>
        </div>
        {comment.mine ? (
          <button
            type="button"
            className="comment-delete"
            title="删除这条评论"
            disabled={removingId === comment.id}
            onClick={() => remove(comment)}
          >
            删除
          </button>
        ) : null}
      </div>
    ));
  } else if (error) {
    list = <p className="comment-empty comment-error">{error}</p>;
  } else {
    list = <p className="comment-empty">还没有评论，来抢沙发。</p>;
  }

  return (
    <>
      <div className="comment-list">
        {list}
        {!loading && items.length > 0 && error ? (
          <p className="comment-empty comment-error">{error}</p>
        ) : null}
      </div>
      <form className="comment-form" onSubmit={submit}>
        <Avatar seed={user?.id || user?.email} name={user?.name} size="avatar-sm" />
        <input
          type="text"
          className="comment-input"
          maxLength={MAX_COMMENT_LENGTH}
          placeholder="发表你的评论…"
          autoComplete="off"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit" className="comment-send" disabled={!draft.trim() || sending}>
          {sending ? "发送中…" : "发送"}
        </button>
      </form>
    </>
  );
}
