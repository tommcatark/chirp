import { Fragment, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Avatar from "../components/ui/Avatar.jsx";
import Loading from "../components/ui/Loading.jsx";
import { usePageClass } from "../hooks/usePageClass.js";
import { useRevealMotion } from "../hooks/useRevealMotion.js";
import { searchApi } from "../lib/api.js";
import { timeAgo } from "../lib/utils.js";

const PAGE_SIZE = 20;

function tagOf(value) {
  return String(value ?? "").replace(/^#/, "").trim();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* 只保留正文确实包含 #tag（后接 #、空白或结尾）的帖子 */
function matcherFor(tag) {
  return new RegExp(`#${escapeRegExp(tag)}(?=#|\\s|$)`);
}

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

function PostCard({ post }) {
  const profilePath = `/profile/${post.userId}`;
  return (
    <article className="chirp" data-id={post.id}>
      <Link to={profilePath} aria-label={`查看 ${post.authorName || "用户"} 的主页`}>
        <Avatar
          seed={post.userId}
          name={post.authorName}
          src={post.authorAvatarUrl}
          size="avatar-lg"
        />
      </Link>
      <div className="chirp-main">
        <p className="chirp-head">
          <Link to={profilePath}>
            <strong>{post.authorName}</strong>
          </Link>
          <span className="handle">@{post.authorHandle}</span>
          <span className="dot">·</span>
          <time>{timeAgo(Date.parse(post.createdAt) || Date.now())}</time>
        </p>
        <p className="chirp-content">
          <TextWithTags text={post.content} />
        </p>
        <div className="chirp-foot">
          <span className="action-static">评论 {post.comments ?? 0}</span>
          <span className="action-static">点赞 {post.likes ?? 0}</span>
        </div>
      </div>
    </article>
  );
}

export default function TopicPage() {
  const { tag: rawTag } = useParams();
  const tag = tagOf(rawTag);

  usePageClass("profile-page topic-page", tag ? `#${tag} · 鸣 Chirp` : "话题 · 鸣 Chirp");
  useRevealMotion();

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(Boolean(tag));
  const [loaded, setLoaded] = useState(!tag);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const offsetRef = useRef(0);
  const aliveRef = useRef(true);
  const tagRef = useRef(tag);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  useEffect(() => {
    tagRef.current = tag;
  }, [tag]);

  useEffect(() => {
    offsetRef.current = 0;
    setPosts([]);
    setHasMore(false);
    setLoadingMore(false);
    setError("");

    if (!tag) {
      setLoading(false);
      setLoaded(true);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setLoaded(false);
    const matchTag = matcherFor(tag);

    searchApi
      .query({ q: tag, type: "post", offset: 0, limit: PAGE_SIZE })
      .then((data) => {
        if (cancelled) return;
        const items = data?.items || [];
        offsetRef.current = items.length;
        setPosts(items.filter((post) => matchTag.test(post.content || "")));
        setHasMore(Boolean(data?.hasMore));
        setLoading(false);
        setLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setError("加载失败，请确认后端服务已启动后刷新重试。");
        setLoading(false);
        setLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [tag]);

  const loadMore = async () => {
    if (!tag || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const data = await searchApi.query({
        q: tag,
        type: "post",
        offset: offsetRef.current,
        limit: PAGE_SIZE
      });
      if (!aliveRef.current || tagRef.current !== tag) return;
      const items = data?.items || [];
      const matchTag = matcherFor(tag);
      offsetRef.current += items.length;
      setPosts((prev) => [...prev, ...items.filter((post) => matchTag.test(post.content || ""))]);
      setHasMore(Boolean(data?.hasMore));
    } catch {
      /* 保留按钮，允许重试 */
    } finally {
      if (aliveRef.current) setLoadingMore(false);
    }
  };

  const countText = !tag ? "—" : loaded ? `${posts.length} 条鸣响` : "—";

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

      <section className="profile-card topic-head">
        <div className="topic-mark">#</div>
        <div className="profile-info">
          <h1 id="topic-name">{tag ? `#${tag}` : "未指定话题"}</h1>
          <p className="profile-handle" id="topic-count">
            {countText}
          </p>
        </div>
      </section>

      <section className="profile-posts">
        {loading ? <Loading text="正在加载…" id="posts-loading" /> : null}
        {error ? <p className="feed-loading">{error}</p> : null}
        {!tag ? <p className="feed-loading">请从首页趋势榜进入话题页。</p> : null}
        <div id="topic-posts" className="feed">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
        {loaded && tag && !error && posts.length === 0 ? (
          <div className="empty-state" id="posts-empty">
            <h3>这个话题下还没有鸣响</h3>
            <p>发布一条带该话题的鸣响，就会成为第一条。</p>
          </div>
        ) : null}
        {hasMore ? (
          <button
            className="bm-load-more"
            type="button"
            disabled={loadingMore}
            onClick={loadMore}
          >
            {loadingMore ? "加载中…" : "加载更多"}
          </button>
        ) : null}
      </section>
    </main>
  );
}
