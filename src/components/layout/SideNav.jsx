import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { useNavLiquid } from "../../hooks/useNavLiquid.js";
import { messagesApi, notificationsApi } from "../../lib/api.js";
import Avatar from "../ui/Avatar.jsx";
import { useRef } from "react";

const NAV_ITEMS = [
  { to: "/home", label: "首页", view: "home", badge: null, path: "M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5" },
  {
    to: "/explore",
    label: "探索",
    badge: null,
    path: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9 16-3.5-3.5"
  },
  {
    to: "/notifications",
    label: "通知",
    badge: "notif",
    path: "M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10.3 21a2 2 0 0 0 3.4 0"
  },
  {
    to: "/messages",
    label: "消息",
    badge: "msg",
    path: "M21 12a8 8 0 0 1-11.5 7.2L4 20l.9-4.4A8 8 0 1 1 21 12Z"
  },
  { to: "/bookmarks", label: "收藏", badge: null, path: "M6 3h12v18l-6-4-6 4Z" },
  {
    to: "/profile",
    label: "个人主页",
    badge: null,
    path: "M12 8a4 4 0 1 0 0-8 4 4 0 0 0 0 8M4 21c0-4 3.6-6 8-6s8 2 8 6"
  }
];

export default function SideNav({ onCompose }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const navRef = useRef(null);
  const [badges, setBadges] = useState({ notif: 0, msg: 0 });
  useNavLiquid(navRef);

  useEffect(() => {
    let cancelled = false;
    const loadBadges = async () => {
      try {
        const [notif, msg] = await Promise.all([
          notificationsApi.list({ limit: 1 }),
          messagesApi.unreadCount()
        ]);
        if (cancelled) return;
        setBadges({
          notif: notif?.unreadCount ?? 0,
          msg: msg?.unreadCount ?? 0
        });
      } catch {
        /* 角标失败不影响导航 */
      }
    };
    loadBadges();
    const timer = window.setInterval(loadBadges, 60000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const handleLogout = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  const handleBadge = (kind) => {
    const count = badges[kind] || 0;
    if (!count) return null;
    return <i className="nav-badge">{count > 99 ? "99+" : count}</i>;
  };

  return (
    <aside className="side-nav dock">
      <a className="brand-mark app-brand" href="/home" aria-label="鸣 Chirp 首页">
        <span className="brand-symbol" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="20" height="20">
            <rect x="4" y="9" width="4" height="10" rx="2" />
            <rect x="10" y="4" width="4" height="15" rx="2" />
            <rect x="16" y="7" width="4" height="12" rx="2" />
          </svg>
        </span>
        <span className="brand-name">
          鸣 <em>Chirp</em>
        </span>
      </a>

      <nav className="nav-list" aria-label="主导航" ref={navRef}>
        <span className="nav-liquid" aria-hidden="true" />
        {NAV_ITEMS.map((item) => (
          <a className="nav-item" href={item.to} data-view={item.view} key={item.to}>
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path d={item.path} />
            </svg>
            <span>{item.label}</span>
            {item.badge ? handleBadge(item.badge) : null}
          </a>
        ))}
      </nav>

      <button className="compose-cta" type="button" aria-label="发布新声" onClick={onCompose}>
        发布新声
      </button>

      <div className="me-card">
        <Avatar seed={user?.id || user?.email} name={user?.name} size="avatar-lg" />
        <div className="me-meta">
          <strong>{user?.name || "我"}</strong>
          <span>@{user?.email ? user.email.split("@")[0] : "me"}</span>
        </div>
        <button
          className="logout-btn"
          type="button"
          title="退出登录"
          aria-label="退出登录"
          onClick={handleLogout}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
            <path d="M10 17l-5-5 5-5M5 12h12" />
          </svg>
        </button>
      </div>
    </aside>
  );
}
