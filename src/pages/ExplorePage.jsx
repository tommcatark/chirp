import { Fragment, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Avatar from "../components/ui/Avatar.jsx";
import Loading from "../components/ui/Loading.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { usePageClass } from "../hooks/usePageClass.js";
import { useRevealMotion } from "../hooks/useRevealMotion.js";
import { postsApi, searchApi, usersApi } from "../lib/api.js";
import { timeAgo } from "../lib/utils.js";

const SEARCH_DELAY = 300;
const SEARCH_LIMIT = 30;
const LATEST_LIMIT = 30;

function tagOf(value) {
  return String(value ?? "").replace(/^#/, "").trim();
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

function UserRow({ user, followed, pending, onToggle }) {
  const profilePath = `/profile/${user.id}`;
  return (
    <li data-id={user.id}>
      <Link to={profilePath} aria-label={`查看 ${user.name || "用户"} 的主页`}>
        <Avatar seed={user.id} name={user.name} src={user.avatarUrl} />
      </Link>
      <div className="suggest-meta">
        <Link to={profilePath}>
          <strong>{user.name}</strong>
        </Link>
        <span>
          @{user.handle} · {user.followerCount ?? 0} 位关注者
        </span>
        {user.bio ? <span className="explore-user-bio">{user.bio}</span> : null}
      </div>
      <button
        type="button"
        className={`follow-btn${followed ? " is-following" : ""}`}
        disabled={pending}
        onClick={() => onToggle(user)}
      >
        {followed ? "已关注" : "关注"}
      </button>
    </li>
  );
}

export default function ExplorePage() {
  usePageClass("profile-page explore-page", "探索 · 鸣 Chirp");
  useRevealMotion();

  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const keyword = (searchParams.get("q") || "").trim();
  const searchType = searchParams.get("type") === "user" ? "user" : "post";

  const [inputValue, setInputValue] = useState(keyword);
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  const [trends, setTrends] = useState(null);
  const [trendsError, setTrendsError] = useState("");
  const [latest, setLatest] = useState([]);
  const [latestLoading, setLatestLoading] = useState(true);
  const [latestLoaded, setLatestLoaded] = useState(false);
  const [latestError, setLatestError] = useState("");
  const [authors, setAuthors] = useState(null);

  const [followOverrides, setFollowOverrides] = useState({});
  const [followPending, setFollowPending] = useState({});
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  /* URL -> 输入框（后退/前进时同步） */
  useEffect(() => {
    setInputValue(keyword);
  }, [keyword]);

  /* 输入防抖 300ms 后写入 URL 查询参数 */
  useEffect(() => {
    const next = inputValue.trim();
    if (next === keyword) return undefined;
    const timer = window.setTimeout(() => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (next) params.set("q", next);
          else params.delete("q");
          return params;
        },
        { replace: true }
      );
    }, SEARCH_DELAY);
    return () => window.clearTimeout(timer);
  }, [inputValue, keyword, setSearchParams]);

  const applyKeywordNow = () => {
    const next = inputValue.trim();
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (next) params.set("q", next);
        else params.delete("q");
        return params;
      },
      { replace: true }
    );
  };

  const changeType = (nextType) => {
    if (nextType === searchType) return;
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        params.set("type", nextType);
        return params;
      },
      { replace: true }
    );
  };

  /* 搜索结果 */
  useEffect(() => {
    if (!keyword) {
      setResults([]);
      setSearching(false);
      setSearchError("");
      return undefined;
    }
    let cancelled = false;
    setSearching(true);
    setSearchError("");
    setResults([]);
    searchApi
      .query({ q: keyword, type: searchType, offset: 0, limit: SEARCH_LIMIT })
      .then((data) => {
        if (cancelled) return;
        setResults(data?.items || []);
      })
      .catch(() => {
        if (!cancelled) setSearchError("搜索失败，请确认后端服务已启动后重试。");
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [keyword, searchType]);

  /* 默认视图：趋势话题 / 最新鸣响 / 活跃作者 */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await searchApi.trends();
        if (cancelled) return;
        setTrends(Array.isArray(data) ? data : data?.items || []);
      } catch {
        if (cancelled) return;
        setTrends([]);
        setTrendsError("趋势加载失败，请确认后端服务已启动。");
      }
    })();

    (async () => {
      try {
        const data = await postsApi.list({ scope: "latest", offset: 0, limit: LATEST_LIMIT });
        if (cancelled) return;
        const items = data?.items || [];
        setLatest(items);
        setLatestLoaded(true);
        setLatestLoading(false);

        const seen = new Map();
        items.forEach((post) => {
          if (post.userId && !seen.has(post.userId)) seen.set(post.userId, post);
        });
        const picked = [...seen.values()]
          .filter((post) => post.userId !== user?.id)
          .slice(0, 6);
        if (!picked.length) {
          setAuthors([]);
          return;
        }
        const details = await Promise.all(
          picked.map((post) => usersApi.get(post.userId).catch(() => null))
        );
        if (cancelled) return;
        setAuthors(details.filter((detail) => detail && !detail.me));
      } catch {
        if (cancelled) return;
        setLatest([]);
        setLatestLoaded(true);
        setLatestLoading(false);
        setLatestError("加载失败，请确认后端服务已启动后刷新重试。");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const isFollowed = (target) => followOverrides[target.id] ?? Boolean(target.followedByMe);

  const toggleFollow = async (target) => {
    if (followPending[target.id]) return;
    const following = isFollowed(target);
    setFollowPending((prev) => ({ ...prev, [target.id]: true }));
    try {
      if (following) await usersApi.unfollow(target.id);
      else await usersApi.follow(target.id);
      if (!aliveRef.current) return;
      setFollowOverrides((prev) => ({ ...prev, [target.id]: !following }));
    } catch {
      /* 失败时保持原状态 */
    } finally {
      if (aliveRef.current) {
        setFollowPending((prev) => {
          const next = { ...prev };
          delete next[target.id];
          return next;
        });
      }
    }
  };

  const renderUserList = (list) => (
    <ul className="suggest-list explore-user-list">
      {list.map((item) => (
        <UserRow
          key={item.id}
          user={item}
          followed={isFollowed(item)}
          pending={Boolean(followPending[item.id])}
          onToggle={toggleFollow}
        />
      ))}
    </ul>
  );

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

      <section className="page-hero">
        <h1>探索</h1>
        <p>搜索声音，发现正在鸣响的此刻。</p>
      </section>

      <label className="search-box explore-search">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          type="search"
          id="explore-search"
          placeholder="搜索帖子、话题或用户"
          aria-label="搜索"
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            applyKeywordNow();
          }}
        />
      </label>

      <section className={keyword ? undefined : "hidden"} id="search-view">
        <div className="feed-tabs explore-tabs" role="tablist" aria-label="搜索结果类型">
          <button
            className={`feed-tab${searchType === "post" ? " active" : ""}`}
            type="button"
            data-type="post"
            role="tab"
            aria-selected={searchType === "post"}
            onClick={() => changeType("post")}
          >
            帖子
          </button>
          <button
            className={`feed-tab${searchType === "user" ? " active" : ""}`}
            type="button"
            data-type="user"
            role="tab"
            aria-selected={searchType === "user"}
            onClick={() => changeType("user")}
          >
            用户
          </button>
        </div>
        {searching ? <Loading text="正在搜索…" id="search-loading" /> : null}
        {searchError ? <p className="feed-loading">{searchError}</p> : null}
        <div id="search-results" className="feed">
          {searchType === "post"
            ? results.map((post) => <PostCard key={post.id} post={post} />)
            : renderUserList(results)}
        </div>
        {!searching && !searchError && results.length === 0 ? (
          <div className="empty-state" id="search-empty">
            <h3>没有找到相关内容</h3>
            <p>换个关键词试试，或回到下方看看趋势话题。</p>
          </div>
        ) : null}
      </section>

      <div className={keyword ? "hidden" : undefined} id="explore-view">
        <section className="side-card">
          <h3>正在鸣响</h3>
          <ul className="trend-list" id="explore-trends">
            {(trends || []).map((item) => {
              const tag = tagOf(item.tag);
              return (
                <li key={tag}>
                  <Link to={`/topic/${encodeURIComponent(tag)}`}>
                    <strong>#{tag}</strong>
                    <span>{item.postCount ?? 0} 条鸣响</span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <p
            className={`explore-empty-line${
              trends && trends.length === 0 ? "" : " hidden"
            }`}
            id="trends-empty"
          >
            {trendsError || "暂无趋势话题"}
          </p>
        </section>

        <section className="side-card">
          <h3>活跃作者</h3>
          <ul className="suggest-list" id="explore-users">
            {(authors || []).map((item) => (
              <UserRow
                key={item.id}
                user={item}
                followed={isFollowed(item)}
                pending={Boolean(followPending[item.id])}
                onToggle={toggleFollow}
              />
            ))}
          </ul>
          <p
            className={`explore-empty-line${
              authors && authors.length === 0 ? "" : " hidden"
            }`}
            id="users-empty"
          >
            暂时没有可推荐的作者
          </p>
        </section>

        <section className="explore-latest">
          <h3 className="explore-section-title">最新鸣响</h3>
          {latestLoading ? <Loading text="正在加载…" id="posts-loading" /> : null}
          {latestError ? <p className="feed-loading">{latestError}</p> : null}
          <div id="explore-posts" className="feed">
            {latest.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
          {latestLoaded && !latestError && latest.length === 0 ? (
            <div className="empty-state" id="explore-posts-empty">
              <h3>还没有任何鸣响</h3>
              <p>回到首页发布第一条吧。</p>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
