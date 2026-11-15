import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { usePageClass } from "../hooks/usePageClass.js";
import { ApiError, authApi } from "../lib/api.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_COOLDOWN = 60;

export default function ForgotPasswordPage() {
  const location = useLocation();
  const emailRef = useRef(null);
  const [email, setEmail] = useState(
    () =>
      location.state?.email ||
      new URLSearchParams(location.search).get("email") ||
      ""
  );
  const [emailError, setEmailError] = useState("");
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitLabel, setSubmitLabel] = useState("发送重置链接");
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [cooldownLeft, setCooldownLeft] = useState(0);

  usePageClass("auth-body", "鸣 Chirp · 忘记密码");

  useEffect(() => {
    if (emailRef.current) emailRef.current.focus();
  }, []);

  useEffect(() => {
    if (!cooldownUntil) return undefined;
    const render = () => {
      const left = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
      setCooldownLeft(left);
      if (left <= 0) {
        setCooldownUntil(0);
        setSubmitLabel("重新发送重置链接");
        return;
      }
      setSubmitLabel(`请 ${left} 秒后再试`);
    };
    render();
    const timer = window.setInterval(render, 1000);
    return () => window.clearInterval(timer);
  }, [cooldownUntil]);

  const startCooldown = () => {
    setCooldownUntil(Date.now() + RESEND_COOLDOWN * 1000);
    setCooldownLeft(RESEND_COOLDOWN);
    setSubmitLabel(`请 ${RESEND_COOLDOWN} 秒后再试`);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setEmailError("");
    setStatus("");

    const value = email.trim();
    if (!EMAIL_PATTERN.test(value)) {
      setEmailError("请输入有效的邮箱地址");
      return;
    }
    if (cooldownUntil > Date.now()) return;

    setSubmitting(true);
    setSubmitLabel("正在发送…");
    try {
      const data = await authApi.forgotPassword({ email: value });
      setStatus((data && data.message) || "重置链接已发送，请查收邮箱。");
      startCooldown();
    } catch (error) {
      setStatus(
        error instanceof ApiError
          ? error.message || "操作失败，请稍后重试。"
          : "暂时无法连接服务器，请稍后重试。"
      );
      setSubmitLabel("重新发送重置链接");
    } finally {
      setSubmitting(false);
    }
  };

  const submitDisabled = submitting || cooldownLeft > 0;

  return (
    <main className="auth-stage">
      <div className="auth-orbit" aria-hidden="true">
        <span className="orbit-glow" />
        <span className="orbit-ring orbit-ring-1" />
        <span className="orbit-ring orbit-ring-2" />
        <span className="orbit-ring orbit-ring-3" />
      </div>

      <aside className="auth-satellite sat-brand">
        <Link className="brand-mark" to="/" aria-label="返回鸣 Chirp 首屏">
          <span className="brand-symbol" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22">
              <rect x="4" y="9" width="4" height="10" rx="2" className="bar bar-1" />
              <rect x="10" y="4" width="4" height="15" rx="2" className="bar bar-2" />
              <rect x="16" y="7" width="4" height="12" rx="2" className="bar bar-3" />
            </svg>
          </span>
          <span>
            鸣 <em>Chirp</em>
          </span>
        </Link>
        <h1 className="sat-title">
          忘记密码
          <br />
          <em>别担心</em>。
        </h1>
        <p className="sat-copy">输入你注册时使用的邮箱，我们会把重置密码的链接发送给你。</p>
      </aside>

      <aside className="auth-satellite sat-quote" aria-hidden="true">
        <span className="sat-mark">“</span>
        <p>声音看不见形状，却能在人心里留下轮廓。</p>
        <span className="sat-meta">王五 · @wangwu</span>
      </aside>

      <aside className="auth-satellite sat-card sat-card-a" aria-hidden="true">
        <article className="chirp-card">
          <div className="avatar" data-av="1">
            舟
          </div>
          <div className="chirp-body">
            <p className="chirp-meta">
              <strong>夜航船</strong>
              <span>@nightboat · 17 分钟</span>
            </p>
            <p className="chirp-text">好想法不该只停留在脑海里，说出来就是第一步。</p>
            <p className="chirp-actions">
              <span>♡ 2.3k</span>
              <span>♺ 812</span>
              <span>◎ 95</span>
            </p>
          </div>
        </article>
      </aside>

      <aside className="auth-satellite sat-card sat-card-b" aria-hidden="true">
        <article className="chirp-card">
          <div className="avatar" data-av="3">
            张
          </div>
          <div className="chirp-body">
            <p className="chirp-meta">
              <strong>张三</strong>
              <span>@zhangsan · 32 分钟</span>
            </p>
            <p className="chirp-text">今天也要认真发声。</p>
            <p className="chirp-actions">
              <span>♡ 64</span>
              <span>♺ 12</span>
              <span>◎ 8</span>
            </p>
          </div>
        </article>
      </aside>

      <section className="auth-center">
        <div className="form-wrap">
          <Link className="mobile-brand" to="/">
            <span className="brand-symbol" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="20" height="20">
                <rect x="4" y="9" width="4" height="10" rx="2" />
                <rect x="10" y="4" width="4" height="15" rx="2" />
                <rect x="16" y="7" width="4" height="12" rx="2" />
              </svg>
            </span>
            鸣 <em>Chirp</em>
          </Link>
          <div className="form-heading">
            <p className="eyebrow">RESET PASSWORD</p>
            <h2>忘记密码？</h2>
            <p>输入注册邮箱，重置链接将发送到你的邮箱。</p>
          </div>

          <form id="forgot-form" noValidate onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="email">邮箱地址</label>
              <div className="input-wrap">
                <span className="input-icon">@</span>
                <input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  ref={emailRef}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <small className="error" data-error="email">
                {emailError}
              </small>
            </div>

            <button className="submit-button" type="submit" disabled={submitDisabled}>
              <span id="submit-text">{submitLabel}</span>
              <span className="arrow">→</span>
            </button>
            <p className="status" id="status" role="status">
              {status}
            </p>
          </form>

          <p className="back-login">
            <Link to="/login">← 返回登录</Link>
          </p>
        </div>
      </section>

      <footer className="auth-foot">
        <span>© 2026 Chirp</span>
        <span>每一声，都有回响</span>
      </footer>
    </main>
  );
}
