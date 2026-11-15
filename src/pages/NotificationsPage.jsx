import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch, notificationsApi } from "../lib/api.js";
import { timeAgo } from "../lib/utils.js";
import { usePageClass } from "../hooks/usePageClass.js";
import { useRevealMotion } from "../hooks/useRevealMotion.js";
import Avatar from "../components/ui/Avatar.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import Loading from "../components/ui/Loading.jsx";

const PAGE_SIZE = 20;

const TYPE_TEXT = {
  follow: "关注了你",
  like: "赞了你的鸣响",
  comment: "评论了你的鸣响"
};

function TypeIcon({ type }) {
  if (type === "follow") {
    return (
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
      </svg>
    );
  }
  if (type === "like") {
    return (
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <path d="M12 21s-7.5-4.6-9.7-9A5.4 5.4 0 0 1 12 6.5 5.4 5.4 0 0 1 21.7 12c-2.2 4.4-9.7 9-9.7 9Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path d="M21 12a8 8 0 0 1-11.5 7.2L4 20l.9-4.4A8 8 0 1 1 21 12Z" />
    </svg>
  );
}

export default function NotificationsPage() {
  usePageClass("profile-page notifications-page", "通知 · 鸣 Chirp");
  useRevealMotion();
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    notificationsApi
      .list({ offset: 0, limit: PAGE_SIZE })
      .then((data) => {
        if (cancelled) return;
        const nextItems = data?.items || [];
        setItems(nextItems);
        setOffset(nextItems.length);
        setHasMore(Boolean(data?.hasMore));
        setUnreadCount(data?.unreadCount ?? 0);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "通知加载失败，请确认后端服务已启动后刷新重试。");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadMore = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await notificationsApi.list({ offset, limit: PAGE_SIZE });
      const nextItems = data?.items || [];
      setItems((prev) => [...prev, ...nextItems]);
      setOffset(offset + nextItems.length);
      setHasMore(Boolean(data?.hasMore));
      setUnreadCount(data?.unreadCount ?? 0);
    } catch {
      /* 保留已加载内容，按钮可再次点击重试 */
    } finally {
      setLoadingMore(false);
    }
  };

  const markAllRead = async () => {
    if (marking || unreadCount === 0) return;
    setMarking(true);
    try {
      const data = await notificationsApi.markRead();
      setUnreadCount(data?.unreadCount ?? 0);
      setItems((prev) => prev.map((item) => ({ ...item, isRead: true })));
    } catch {
      /* 失败时保持原状 */
    } finally {
      setMarking(false);
    }
  };

  const openNotification = (notification) => {
    if (!notification.isRead) {
      setItems((prev) =>
        prev.map((item) => (item.id === notification.id ? { ...item, isRead: true } : item))
      );
      setUnreadCount((count) => Math.max(0, count - 1));
      apiFetch("/api/notifications/read", {
        method: "POST",
        body: { ids: [notification.id] },
        auth: true
      })
        .then((data) => {
          if (typeof data?.unreadCount === "number") setUnreadCount(data.unreadCount);
        })
        .catch(() => {
          setItems((prev) =>
            prev.map((item) => (item.id === notification.id ? { ...item, isRead: false } : item))
          );
          setUnreadCount((count) => count + 1);
        });
    }

    const actorId = notification.actor?.id;
    if (actorId) navigate(`/profile/${actorId}`);
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

      <section className="notif-head">
        <h1>通知</h1>
        <span className={`notif-unread${unreadCount > 0 ? "" : " hidden"}`}>{unreadCount} 条未读</span>
        <button
          className="notif-mark-all"
          type="button"
          disabled={unreadCount === 0 || marking}
          onClick={markAllRead}
        >
          全部标为已读
        </button>
      </section>

      <section>
        {loading ? <Loading /> : null}
        {!loading && error ? <p className="feed-loading">{error}</p> : null}

        <ul className="notif-list">
          {items.map((notification) => {
            const type = notification.type || "unknown";
            const actor = notification.actor || {};
            const quote = notification.commentExcerpt || notification.postExcerpt;
            return (
              <li
                className={`notif-item${notification.isRead ? "" : " is-unread"}`}
                data-id={notification.id}
                data-read={notification.isRead ? "true" : "false"}
                key={notification.id}
                onClick={() => openNotification(notification)}
              >
                <span className={`notif-icon notif-icon-${type}`}>
                  <TypeIcon type={type} />
                </span>
                <Avatar
                  seed={actor.id}
                  name={actor.name || "未知用户"}
                  src={actor.avatarUrl || undefined}
                />
                <div className="notif-body">
                  <p className="notif-line">
                    <strong>{actor.name || "未知用户"}</strong>
                    <span className="handle">@{actor.handle || "unknown"}</span>
                    {TYPE_TEXT[type] || "与你互动了"}
                  </p>
                  {quote ? <p className="notif-quote">{quote}</p> : null}
                  <time className="notif-time">
                    {timeAgo(Date.parse(notification.createdAt) || Date.now())}
                  </time>
                </div>
                <span className="notif-dot" aria-hidden="true" />
              </li>
            );
          })}
        </ul>

        <EmptyState
          title="还没有通知"
          description="当有人关注你、赞或评论你的鸣响时，会出现在这里。"
          hidden={loading || Boolean(error) || items.length > 0}
        />

        {!loading && hasMore ? (
          <button className="notif-load-more" type="button" disabled={loadingMore} onClick={loadMore}>
            {loadingMore ? "加载中…" : "加载更多"}
          </button>
        ) : null}
      </section>
    </main>
  );
}
