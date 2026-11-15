import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import PostList from "../components/post/PostList.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { usePageClass } from "../hooks/usePageClass.js";
import { useRevealMotion } from "../hooks/useRevealMotion.js";
import { searchApi, usersApi } from "../lib/api.js";
import { normalizePost } from "../lib/utils.js";
import Avatar from "../components/ui/Avatar.jsx";

const FEED_TABS = [
  { id: "all", label: "推荐" },
  { id: "following", label: "关注" }
];

/* 热门话题：接口不可用时保留运营占位 */
const FALLBACK_TRENDS = [
  { tag: "#秋日鸣响", posts: "12.4k 条鸣响" },
  { tag: "#产品更新", posts: "8,931 条鸣响" },
  { tag: "#读书笔记", posts: "5,207 条鸣响" },
  { tag: "#第一声", posts: "3,118 条鸣响" },
  { tag: "#今晚的月亮", posts: "2,406 条鸣响" }
];

/* 推荐关注：handle 与种子用户邮箱前缀一致，id 通过搜索接口解析 */
const SUGGESTION_SEEDS = [
  { name: "张三", handle: "zhangsan" },
  { name: "李四", handle: "lisi" },
  { name: "王五", handle: "wangwu" }
];

export default function HomePage() {
  const { openComposer } = useOutletContext() || {};
  const { user } = useAuth();

  usePageClass("app-body observatory-body", "首页 · 鸣 Chirp");
  useRevealMotion();

  const [scope, setScope] = useState("all");
  const [search, setSearch] = useState("");
  const [keyword, setKeyword] = useState("");
  const [incomingPost, setIncomingPost] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [trends, setTrends] = useState(FALLBACK_TRENDS);
  const [suggestions, setSuggestions] = useState(() =>
    SUGGESTION_SEEDS.map((item) => ({ ...item, id: null }))
  );
  const [followed, setFollowed] = useState(() => new Set());
  const [followBusy, setFollowBusy] = useState("");

  /* 搜索：停止输入 180ms 后过滤当前信息流 */
  useEffect(() => {
    const timer = window.setTimeout(() => setKeyword(search.trim()), 180);
    return () => window.clearTimeout(timer);
  }, [search]);

  /* 发布成功后由 ComposerModal 派发，插入列表首位并回到推荐流 */
  useEffect(() => {
    const handlePosted = (event) => {
      if (!event.detail) return;
      setScope("all");
      setIncomingPost(normalizePost(event.detail));
    };
    window.addEventListener("chirp:posted", handlePosted);
    return () => window.removeEventListener("chirp:posted", handlePosted);
  }, []);

  /* 趋势榜：近期帖子的话题热度 */
  useEffect(() => {
    let cancelled = false;
    searchApi
      .trends()
      .then((data) => {
        if (cancelled) return;
        const items = Array.isArray(data) ? data : data?.items || [];
        if (items.length) {
          setTrends(
            items.map((item) => ({ tag: `#${item.tag}`, posts: `${item.postCount ?? 0} 条鸣响` }))
          );
        }
      })
      .catch(() => {
        /* 接口不可用时保留静态占位 */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /* 关注关系先加载，保证建议列表按钮与关注流状态正确 */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const nextFollowed = new Set();
      if (user?.id) {
        try {
          const data = await usersApi.following(user.id, 50);
          (data?.items || []).forEach((item) => nextFollowed.add(item.id));
        } catch {
          /* 拉取失败按空关注处理 */
        }
      }
      let results = [];
      try {
        results = await Promise.all(
          SUGGESTION_SEEDS.map((item) =>
            searchApi
              .query({ q: item.name, type: "user", offset: 0, limit: 20 })
              .catch(() => null)
          )
        );
      } catch {
        results = [];
      }
      if (cancelled) return;
      const next = SUGGESTION_SEEDS.map((item, index) => {
        const hit = (results[index]?.items || []).find((entry) => entry.handle === item.handle);
        if (hit?.followedByMe) nextFollowed.add(hit.id);
        return { ...item, id: hit?.id ?? null };
      });
      setSuggestions(next);
      setFollowed(nextFollowed);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const switchTab = (id) => {
    if (id === scope) return;
    setScope(id);
  };

  const toggleFollow = async (suggestion) => {
    if (!suggestion.id || followBusy) return;
    const isFollowing = followed.has(suggestion.id);
    setFollowBusy(suggestion.handle);
    try {
      if (isFollowing) await usersApi.unfollow(suggestion.id);
      else await usersApi.follow(suggestion.id);
      setFollowed((prev) => {
        const next = new Set(prev);
        if (isFollowing) next.delete(suggestion.id);
        else next.add(suggestion.id);
        return next;
      });
      if (scope === "following") setRefreshKey((key) => key + 1);
    } catch (err) {
      if (err?.status !== 401) window.alert("操作失败，请稍后重试");
    } finally {
      setFollowBusy("");
    }
  };

  return (
    <div className="view-panel view-home" id="view-home">
      <header className="signal-console">
        <div className="signal-title">
          <h1>首页</h1>
        </div>

        <label className="search-box console-search">
          <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            type="search"
            id="search-input"
            placeholder="搜索鸣 Chirp"
            aria-label="搜索"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>

        <div className="feed-tabs liquid-tabs" role="tablist" aria-label="信息流">
          {FEED_TABS.map((tab) => {
            const active = scope === tab.id;
            return (
              <button
                className={`feed-tab${active ? " active" : ""}`}
                type="button"
                role="tab"
                aria-selected={active}
                key={tab.id}
                onClick={() => switchTab(tab.id)}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* 信号带：趋势 / 推荐 */}
      <section className="signal-band">
        <section className="side-card signal-card signal-trends">
          <div className="signal-card-head">
            <h3>正在鸣响</h3>
            <Link className="side-more" to="/explore">
              查看全部
            </Link>
          </div>
          <ul className="trend-list" id="trend-list">
            {trends.map((trend) => (
              <li key={trend.tag}>
                <Link to={`/topic/${encodeURIComponent(trend.tag.replace(/^#/, ""))}`}>
                  <strong>{trend.tag}</strong>
                  <span>{trend.posts}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="side-card signal-card signal-people">
          <div className="signal-card-head">
            <h3>你可能感兴趣的人</h3>
          </div>
          <ul className="suggest-list" id="suggest-list">
            {suggestions.map((suggestion) => (
              <li data-handle={suggestion.handle} key={suggestion.handle}>
                <Avatar seed={suggestion.handle} name={suggestion.name} />
                <div className="suggest-meta">
                  <strong>{suggestion.name}</strong>
                  <span>@{suggestion.handle}</span>
                </div>
                <button
                  type="button"
                  className={`follow-btn${followed.has(suggestion.id) ? " is-following" : ""}`}
                  disabled={!suggestion.id || followBusy === suggestion.handle}
                  onClick={() => toggleFollow(suggestion)}
                >
                  {followed.has(suggestion.id) ? "已关注" : "关注"}
                </button>
              </li>
            ))}
          </ul>
        </section>
      </section>

      {/* 信息流 */}
      <section className="feed-stage">
        <PostList
          scope={scope}
          keyword={keyword}
          incomingPost={incomingPost}
          refreshKey={refreshKey}
          onCompose={openComposer}
        />
      </section>

      <footer className="stage-footer">
        <div>
          <a href="#">服务条款</a>
          <a href="#">隐私政策</a>
          <a href="#">帮助中心</a>
        </div>
        <span>© 2026 Chirp · 每一声，都有回响</span>
      </footer>
    </div>
  );
}
