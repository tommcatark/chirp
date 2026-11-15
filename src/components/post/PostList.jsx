import { useCallback, useEffect, useRef, useState } from "react";
import { postsApi } from "../../lib/api.js";
import { normalizePost } from "../../lib/utils.js";
import EmptyState from "../ui/EmptyState.jsx";
import Loading from "../ui/Loading.jsx";
import PostCard from "./PostCard.jsx";

function toItems(data) {
  return Array.isArray(data) ? data : data?.items || [];
}

export default function PostList({ scope, keyword, incomingPost, refreshKey = 0, onCompose }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [highlightId, setHighlightId] = useState(null);

  const listRef = useRef(null);
  const pendingRef = useRef([]);
  const requestRef = useRef(0);
  const busyRef = useRef(new Set());

  /* 刚发布的帖子先本地置顶，服务端列表回包后再去重合并 */
  useEffect(() => {
    if (!incomingPost) return;
    pendingRef.current = [
      incomingPost,
      ...pendingRef.current.filter((item) => item.id !== incomingPost.id)
    ];
    setPosts((prev) => [incomingPost, ...prev.filter((item) => item.id !== incomingPost.id)]);
    setHighlightId(incomingPost.id);
  }, [incomingPost]);

  useEffect(() => {
    if (!highlightId || !listRef.current) return;
    const node = listRef.current.querySelector(`[data-id="${highlightId}"]`);
    if (node) node.scrollIntoView({ behavior: "smooth", block: "center" });
    const timer = window.setTimeout(() => setHighlightId(null), 1200);
    return () => window.clearTimeout(timer);
  }, [highlightId]);

  const load = useCallback(async () => {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setLoading(true);
    setError("");
    try {
      const data = await postsApi.list({
        scope: scope === "following" ? "following" : "latest"
      });
      if (requestId !== requestRef.current) return;
      const rawItems = toItems(data);
      const items = rawItems.map(normalizePost);
      const ids = new Set(items.map((item) => item.id));
      const pending = scope === "following" ? [] : pendingRef.current.filter((item) => !ids.has(item.id));
      setPosts([...pending, ...items]);
    } catch (err) {
      if (err?.status === 401 || requestId !== requestRef.current) return;
      setPosts([]);
      setError(err?.message || "时间流加载失败");
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const patchPost = (postId, patch) => {
    setPosts((prev) =>
      prev.map((item) => (item.id === postId ? { ...item, ...patch } : item))
    );
  };

  const toggleLike = async (post) => {
    const key = `like:${post.id}`;
    if (busyRef.current.has(key)) return;
    busyRef.current.add(key);
    const willLike = !post.liked;
    const optimisticLikes = Math.max(0, post.likes + (willLike ? 1 : -1));
    patchPost(post.id, { liked: willLike, likes: optimisticLikes });
    try {
      const data = willLike ? await postsApi.like(post.id) : await postsApi.unlike(post.id);
      patchPost(post.id, {
        liked: typeof data?.liked === "boolean" ? data.liked : willLike,
        likes: typeof data?.likes === "number" ? data.likes : optimisticLikes
      });
    } catch (err) {
      if (err?.status !== 401) patchPost(post.id, { liked: post.liked, likes: post.likes });
    } finally {
      busyRef.current.delete(key);
    }
  };

  const toggleBookmark = async (post) => {
    const key = `bookmark:${post.id}`;
    if (busyRef.current.has(key)) return;
    busyRef.current.add(key);
    const willBookmark = !post.bookmarked;
    patchPost(post.id, { bookmarked: willBookmark });
    try {
      const data = willBookmark
        ? await postsApi.bookmark(post.id)
        : await postsApi.unbookmark(post.id);
      patchPost(post.id, {
        bookmarked: typeof data?.bookmarked === "boolean" ? data.bookmarked : willBookmark
      });
    } catch (err) {
      if (err?.status !== 401) patchPost(post.id, { bookmarked: post.bookmarked });
    } finally {
      busyRef.current.delete(key);
    }
  };

  const removePost = async (post) => {
    const key = `delete:${post.id}`;
    if (busyRef.current.has(key)) return;
    busyRef.current.add(key);
    try {
      await postsApi.remove(post.id);
      pendingRef.current = pendingRef.current.filter((item) => item.id !== post.id);
      setPosts((prev) => prev.filter((item) => item.id !== post.id));
    } catch (err) {
      if (err?.status === 401) return;
      window.alert(err?.status === 403 ? "只能删除自己的鸣响" : "删除失败，请稍后重试");
    } finally {
      busyRef.current.delete(key);
    }
  };

  const changeCommentCount = (postId, delta) => {
    setPosts((prev) =>
      prev.map((item) =>
        item.id === postId
          ? { ...item, comments: Math.max(0, (item.comments || 0) + delta) }
          : item
      )
    );
  };

  if (loading) {
    return <Loading text="正在加载时间流…" id="feed-loading" />;
  }

  if (error) {
    return (
      <div className="empty-state" id="feed-error">
        <div className="empty-mark">
          <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">
            <path d="M12 8v5M12 16.5h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          </svg>
        </div>
        <h2>时间流加载失败</h2>
        <p>
          暂时无法连接服务器，请确认后端服务已启动。
          <br />
          <button className="retry-btn" id="retry-btn" type="button" onClick={load}>
            重新加载
          </button>
        </p>
      </div>
    );
  }

  const query = keyword.trim().toLowerCase();
  const visible = query
    ? posts.filter((post) => {
        const text = String(post.text || "").toLowerCase();
        const name = String(post.author?.name || "").toLowerCase();
        const handle = String(post.author?.handle || "").toLowerCase();
        return text.includes(query) || name.includes(query) || handle.includes(query);
      })
    : posts;

  if (!visible.length) {
    if (query) return null;
    if (scope === "following") {
      return (
        <EmptyState
          id="empty-following"
          title="关注流还是静的"
          description="去探索页关注一些声音，这里就会热闹起来。"
        />
      );
    }
    return (
      <div className="empty-state" id="empty-following">
        <div className="empty-mark">
          <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">
            <path d="M17 8a5 5 0 1 0-10 0c0 5.8-2.5 7-2.5 8.5h15C19.5 15 17 13.8 17 8Z" />
          </svg>
        </div>
        <h2>还没有任何鸣响</h2>
        <p>
          发布你的第一声，让时间流动起来。
          <br />
          <button className="retry-btn" type="button" onClick={onCompose}>
            发布新声
          </button>
        </p>
      </div>
    );
  }

  return (
    <>
      <section className="feed" id="feed" aria-label="时间流" ref={listRef}>
        {visible.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            highlighted={post.id === highlightId}
            onToggleLike={toggleLike}
            onToggleBookmark={toggleBookmark}
            onDelete={removePost}
            onCommentCountChange={changeCommentCount}
          />
        ))}
      </section>
    </>
  );
}
