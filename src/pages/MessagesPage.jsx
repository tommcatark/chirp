import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiFetch, messagesApi, usersApi } from "../lib/api.js";
import { timeAgo } from "../lib/utils.js";
import { useAuth } from "../context/AuthContext.jsx";
import { usePageClass } from "../hooks/usePageClass.js";
import { useRevealMotion } from "../hooks/useRevealMotion.js";
import Avatar from "../components/ui/Avatar.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import Loading from "../components/ui/Loading.jsx";

export default function MessagesPage() {
  usePageClass("profile-page messages-page", "消息 · 鸣 Chirp");
  useRevealMotion();
  const { user } = useAuth();
  const meId = user?.id ?? null;
  const [searchParams, setSearchParams] = useSearchParams();
  const paramId = Number(searchParams.get("userId") || searchParams.get("with") || "") || null;

  const [conversations, setConversations] = useState([]);
  const [totalUnread, setTotalUnread] = useState(0);
  const [convLoading, setConvLoading] = useState(true);
  const [convError, setConvError] = useState("");

  const [activePeer, setActivePeer] = useState(null);
  const [messages, setMessages] = useState([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [msgError, setMsgError] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");

  const bodyRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setConvLoading(true);
    setConvError("");
    messagesApi
      .conversations()
      .then((data) => {
        if (cancelled) return;
        setConversations(data?.items || []);
        setTotalUnread(data?.totalUnread ?? 0);
      })
      .catch((err) => {
        if (!cancelled) setConvError(err.message || "消息加载失败，请确认后端服务已启动后刷新重试。");
      })
      .finally(() => {
        if (!cancelled) setConvLoading(false);
      });

    let cancelledUnread = false;
    messagesApi
      .unreadCount()
      .then((data) => {
        if (!cancelledUnread) setTotalUnread(data?.unreadCount ?? 0);
      })
      .catch(() => {
        /* 角标失败不影响会话列表 */
      });

    return () => {
      cancelled = true;
      cancelledUnread = true;
    };
  }, []);

  useEffect(() => {
    if (!paramId) {
      setActivePeer(null);
      return undefined;
    }
    if (meId && paramId === meId) {
      setActivePeer(null);
      return undefined;
    }

    const existing = conversations.find((conversation) => conversation.user?.id === paramId);
    if (existing?.user) {
      setActivePeer(existing.user);
      return undefined;
    }

    let cancelled = false;
    usersApi
      .get(paramId)
      .then((data) => {
        if (cancelled) return;
        setActivePeer({
          id: data.id,
          name: data.name,
          handle: data.handle,
          avatarUrl: data.avatarUrl
        });
      })
      .catch(() => {
        if (cancelled) return;
        setActivePeer(null);
        setSearchParams({}, { replace: true });
      });
    return () => {
      cancelled = true;
    };
  }, [paramId, conversations, meId, setSearchParams]);

  const peerId = activePeer?.id ?? null;

  useEffect(() => {
    if (!peerId) {
      setMessages([]);
      setMsgLoading(false);
      setMsgError("");
      setSendError("");
      setDraft("");
      return undefined;
    }

    let cancelled = false;
    setMessages([]);
    setDraft("");
    setSendError("");
    setMsgError("");
    setMsgLoading(true);

    messagesApi
      .history(peerId)
      .then((data) => {
        if (cancelled) return;
        setMessages((data?.items || []).slice().reverse());
      })
      .catch((err) => {
        if (!cancelled) setMsgError(err.message || "加载失败，请稍后重试。");
      })
      .finally(() => {
        if (!cancelled) setMsgLoading(false);
      });

    apiFetch("/api/messages/read", {
      method: "POST",
      body: { with: peerId },
      auth: true
    })
      .then((data) => {
        if (cancelled) return;
        setConversations((prev) =>
          prev.map((conversation) =>
            conversation.user?.id === peerId ? { ...conversation, unreadCount: 0 } : conversation
          )
        );
        if (typeof data?.unreadCount === "number") setTotalUnread(data.unreadCount);
      })
      .catch(() => {
        /* 已读失败不影响聊天 */
      });

    return () => {
      cancelled = true;
    };
  }, [peerId]);

  useEffect(() => {
    const node = bodyRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, peerId]);

  const openChat = (peer) => {
    if (!peer?.id) return;
    setActivePeer(peer);
    setSearchParams({ userId: String(peer.id) }, { replace: true });
  };

  const refreshConversations = () => {
    messagesApi
      .conversations()
      .then((data) => {
        if (!mountedRef.current) return;
        setConversations(data?.items || []);
        setTotalUnread(data?.totalUnread ?? 0);
      })
      .catch(() => {
        /* 保留现有会话列表 */
      });
  };

  const backToList = () => {
    setActivePeer(null);
    setSearchParams({}, { replace: true });
    refreshConversations();
  };

  const sendMessage = async () => {
    const content = draft.trim();
    if (!content || !peerId || sending || msgLoading) return;
    setSending(true);
    setSendError("");
    try {
      const message = await messagesApi.send(peerId, content);
      if (!mountedRef.current) return;
      setMessages((prev) => [...prev, message]);
      setDraft("");
    } catch (error) {
      if (mountedRef.current) setSendError(error.message || "发送失败，请稍后重试。");
    } finally {
      if (mountedRef.current) setSending(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    sendMessage();
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (draft.trim() && !sending) sendMessage();
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

      <section className="msg-head">
        <h1>消息</h1>
        <span className={`notif-unread${totalUnread > 0 ? "" : " hidden"}`}>{totalUnread} 条未读</span>
      </section>

      <section className={activePeer ? "hidden" : ""}>
        {convLoading ? <Loading /> : null}
        {!convLoading && convError ? <p className="feed-loading">{convError}</p> : null}

        <ul className="conv-list">
          {conversations.map((conversation) => {
            const peer = conversation.user || {};
            const last = conversation.lastMessage || {};
            const mine = last.senderId === meId;
            return (
              <li
                className={`conv-item${conversation.unreadCount > 0 ? " is-unread" : ""}`}
                data-id={peer.id}
                key={`${peer.id ?? "unknown"}-${last.id ?? ""}`}
                onClick={() => openChat(peer)}
              >
                <Avatar seed={peer.id} name={peer.name || "未知用户"} src={peer.avatarUrl || undefined} />
                <div className="conv-body">
                  <p className="conv-line">
                    <strong>{peer.name || "未知用户"}</strong>
                    <span className="handle">@{peer.handle || "unknown"}</span>
                    <time>{timeAgo(Date.parse(last.createdAt) || Date.now())}</time>
                  </p>
                  <p className="conv-preview">
                    {mine ? "我：" : ""}
                    {last.content || ""}
                  </p>
                </div>
                {conversation.unreadCount > 0 ? (
                  <span className="conv-badge">
                    {conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>

        <EmptyState
          title="还没有私信"
          description="去探索页找感兴趣的人，发起第一段对话吧。"
          hidden={convLoading || Boolean(convError) || conversations.length > 0}
        />
      </section>

      <section className={activePeer ? "" : "hidden"}>
        <header className="chat-head">
          <button className="chat-back" type="button" aria-label="返回会话列表" onClick={backToList}>
            ←
          </button>
          <Avatar
            seed={activePeer?.id}
            name={activePeer?.name || "未知用户"}
            src={activePeer?.avatarUrl || undefined}
          />
          <div className="chat-peer">
            <strong>{activePeer?.name || ""}</strong>
            <span className="handle">@{activePeer?.handle || "unknown"}</span>
          </div>
        </header>

        <div className="chat-body" ref={bodyRef}>
          {msgLoading ? <Loading /> : null}
          {!msgLoading && msgError ? <p className="feed-loading">{msgError}</p> : null}
          {sendError ? <p className="feed-loading">{sendError}</p> : null}
          <ul className="msg-list">
            {messages.map((message) => (
              <li
                className={`msg-item ${message.senderId === meId ? "mine" : "theirs"}`}
                data-id={message.id}
                key={message.id}
              >
                {message.content}
                <time>{timeAgo(Date.parse(message.createdAt) || Date.now())}</time>
              </li>
            ))}
          </ul>
        </div>

        <form className="chat-composer" onSubmit={handleSubmit}>
          <textarea
            maxLength={500}
            rows={1}
            placeholder="发送私信…"
            aria-label="消息内容"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button className="post-btn" type="submit" disabled={!draft.trim() || sending || msgLoading}>
            发送
          </button>
        </form>
      </section>
    </main>
  );
}
