import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import { postsApi } from "../../lib/api.js";
import Avatar from "../ui/Avatar.jsx";

const MAX_LENGTH = 280;

export default function ComposerModal({ open, onClose }) {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open) {
      setContent("");
      setStatus("");
      setSending(false);
    }
  }, [open]);

  if (!open) return null;

  const submit = async () => {
    const text = content.trim();
    if (!text || sending) return;
    if (text.length > MAX_LENGTH) {
      setStatus("内容不能超过 280 字符");
      return;
    }
    setSending(true);
    setStatus("正在发布…");
    try {
      const data = await postsApi.create(text);
      window.dispatchEvent(new CustomEvent("chirp:posted", { detail: data }));
      onClose();
    } catch (error) {
      setStatus(error.message || "发布失败，请稍后重试。");
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      submit();
    }
  };

  return (
    <div className="composer-modal">
      <section className="composer-sheet" role="dialog" aria-modal="true" aria-labelledby="composer-title">
        <header className="composer-sheet-head">
          <div>
            <h2 id="composer-title">发布新声</h2>
          </div>
          <button className="composer-close" type="button" aria-label="关闭发布框" onClick={onClose}>
            ×
          </button>
        </header>

        <section className="composer">
          <Avatar seed={user?.id || user?.email} name={user?.name} size="avatar-lg" />
          <div className="composer-main">
            <textarea
              id="composer-input"
              maxLength={MAX_LENGTH}
              rows={4}
              placeholder="此刻，你想鸣响什么？"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              onKeyDown={onKeyDown}
            />
            <div className="composer-bar">
              <div className="composer-tools" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="18" height="18">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" />
                </svg>
                <svg viewBox="0 0 24 24" width="18" height="18">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <circle cx="8.5" cy="10.5" r="1.5" />
                  <path d="m4 17 5-4 4 3 3-2 4 3" />
                </svg>
                <svg viewBox="0 0 24 24" width="18" height="18">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M8 12h8M12 8v8" />
                </svg>
              </div>
              <div className="composer-send">
                <span className="char-count">{MAX_LENGTH - content.length}</span>
                <button className="post-btn" type="button" disabled={!content.trim() || sending} onClick={submit}>
                  发布
                </button>
              </div>
            </div>
            <p className="composer-status" role="status">
              {status}
            </p>
          </div>
        </section>
        <p className="composer-hint">Ctrl / ⌘ + Enter 快速发布</p>
      </section>
    </div>
  );
}
