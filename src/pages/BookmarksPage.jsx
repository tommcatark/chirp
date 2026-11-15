import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Avatar from "../components/ui/Avatar.jsx";
import Loading from "../components/ui/Loading.jsx";
import { usePageClass } from "../hooks/usePageClass.js";
import { useRevealMotion } from "../hooks/useRevealMotion.js";
import { bookmarksApi, postsApi } from "../lib/api.js";
import { timeAgo } from "../lib/utils.js";

const PAGE_SIZE = 20;

/* 正文中的 #话题 渲染为可点击链接（以 React 节点渲染，不拼接 HTML） */
function TextWithTags({ text }) {
  const source = String(text ?? "");
  const regex = /#([^\s#]+)/g;
  const nodes = [];
  let cursor = 0;
  let index = 0;
  let match = regex.exec(source);

  while (match) {
    if (match.index > cursor) {
      nodes.push(<Fragment key={`text-${index}`}>{source.slice(cursor, match.index)}</Fragment>);
    }
    nodes.push(
      <Link className="chirp-tag" key={`tag-${index}`} to={`/topic/${encodeURIComponent(match[1])}`}>
        {`#${match[1]}`}
      </Link>
    );
    cursor = match.index + match[0].length;
    index += 1;
    match = regex.exec(source);
  }

  if (cursor < source.length) {
    nodes.push(<Fragment key={`text-${index}`}>{source.slice(cursor)}</Fragment>);
  }

  return <>{nodes}</>;
}

export default function BookmarksPage() {
  usePageClass("profile-page bookmarks-page", "收藏 · 鸣 Chirp");
  useRevealMotion();

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState(() => new Set());

  const offsetRef = useRef(0);
  const aliveRef = useRef(true);
  const pendingRef = useRef(new Set());

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const load = useCallback(async (reset) => {
    if (reset) {
      setLoading(true);
      setError("");
    } else {
      setLoadingMore(true);
    }
    try {
      const data = await bookmarksApi.list({
        offset: reset ? 0 : offsetRef.current,
        limit: PAGE_SIZE
      });
      if (!aliveRef.current) return;
      const list = data?.items || [];
      offsetRef.current = (reset ? 0 : offsetRef.current) + list.length;
      setItems((prev) => (reset ? list : [...prev, ...list]));
      setTotal(data?.total ?? 0);
      setHasMore(Boolean(data?.hasMore));
    } catch {
      if (!aliveRef.current) return;
      if (reset) setError("收藏加载失败，请确认后端服务已启动后刷新重试。");
    } finally {
      if (aliveRef.current) {
        setLoading(false);
        setLoadingMore(false);
        if (reset) setLoaded(true);
      }
    }
  }, []);

  useEffect(() => {
    load(true);
  }, [load]);

  /* 取消收藏：先乐观隐藏并递减计数，失败回滚 */
  const removeBookmark = async (id) => {
    if (pendingRef.current.has(id)) return;
    pendingRef.current.add(id);
    setRemoving((prev) => new Set(prev).add(id));
    setTotal((prev) => Math.max(0, prev - 1));
    try {
      await postsApi.unbookmark(id);
      if (!aliveRef.current) return;
      setItems((prev) => prev.filter((post) => post.id !== id));
      offsetRef.current = Math.max(0, offsetRef.current - 1);
    } catch {
      if (!aliveRef.current) return;
      setTotal((prev) => prev + 1);
      setRemoving((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } finally {
      pendingRef.current.delete(id);
    }
  };

  return (
    <main className="profile-wrap">
      <header className="profile-topbar">
        <Link className="brand-mark app-brand" to="/home" aria-label="返回首页">
          <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
            <rect width="24" height="24" rx="6" fill="#0e9f6e" />
            <rect x="5" y="10" width="3.4" height="8" rx="1.7" fill="#fff" />
            <rect x="10.3" y="5.5" width="3.4" height="13" rx="1.7" fill="#fff" />
            <rect x="15.6" y="9" width="3.4" height="9.5" rx="1.7" fill="#fff" />
          </svg>
          <strong>鸣 Chirp</strong>
        </Link>
        <Link className="back-link" to="/home">
          ← 返回首页
        </Link>
      </header>

      <section className="bm-head">
        <h1>收藏</h1>
        <span className={`bm-count${total === 0 ? " hidden" : ""}`} id="bm-count">
          {total} 条
        </span>
      </section>

      <section>
        {loading ? <Loading text="正在加载…" id="bm-loading" /> : null}
        {error ? <p className="feed-loading">{error}</p> : null}
        <div className="bm-list" id="bm-list">
          {items.map((post) => {
            const name = post.authorName || "未知用户";
            const handle = post.authorHandle || "unknown";
            const profilePath = `/profile/${post.userId}`;
            const isRemoving = removing.has(post.id);
            return (
              <article
                className={`chirp bm-item${isRemoving ? " is-removing" : ""}`}
                data-id={post.id}
                key={post.id}
              >
                <Link to={profilePath} aria-label={`查看 ${name} 的主页`}>
                  <Avatar seed={post.userId} name={name} src={post.authorAvatarUrl} />
                </Link>
                <div className="chirp-main">
                  <p className="chirp-head">
                    <Link to={profilePath}>
                      <strong>{name}</strong>
                    </Link>
                    <span className="handle">@{handle}</span>
                    <span className="dot">·</span>
                    <time>{timeAgo(Date.parse(post.createdAt) || Date.now())}</time>
                  </p>
                  <p className="chirp-content">
                    <TextWithTags text={post.content} />
                  </p>
                  <div className="chirp-foot">
                    <button
                      type="button"
                      className="action action-bookmark on"
                      title="取消收藏"
                      disabled={isRemoving}
                      onClick={() => removeBookmark(post.id)}
                    >
                      <svg viewBox="0 0 24 24" width="17" height="17">
                        <path d="M6 3h12v18l-6-4-6 4Z" />
                      </svg>
                      <span>已收藏</span>
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        {loaded && !error && !hasMore && items.length === 0 ? (
          <div className="empty-state" id="bm-empty">
            <div className="empty-mark">
              <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">
                <path d="M6 3h12v18l-6-4-6 4Z" />
              </svg>
            </div>
            <h3>还没有收藏</h3>
            <p>在鸣响下方点一下收藏，之后就能在这里找到它。</p>
          </div>
        ) : null}
        {hasMore ? (
          <button
            className="bm-load-more"
            id="bm-more"
            type="button"
            disabled={loadingMore}
            onClick={() => load(false)}
          >
            {loadingMore ? "加载中…" : "加载更多"}
          </button>
        ) : null}
      </section>
    </main>
  );
}
