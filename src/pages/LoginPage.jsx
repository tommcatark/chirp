import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Starfield, { StarMotionToggle } from "../components/effects/Starfield.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { usePageClass } from "../hooks/usePageClass.js";
import { ApiError, authApi } from "../lib/api.js";
import { dropCachedPublicKey, encryptPassword } from "../lib/crypto.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LOCK_THRESHOLD = 5;
const LOCK_SECONDS = 30;

const HEADINGS = {
  login: {
    eyebrow: "WELCOME BACK",
    title: "欢迎回来",
    subtitle: "登录鸣 Chirp，继续发声与共鸣。",
    submit: "登录账户"
  },
  register: {
    eyebrow: "JOIN CHIRP",
    title: "创建你的账户",
    subtitle: "注册鸣 Chirp，发出你的第一声。",
    submit: "创建账户"
  }
};

function passwordScore(value) {
  if (!value) return 0;
  let score = 0;
  if (value.length >= 8) score += 1;
  if (
    (/[a-z]/.test(value) && /[A-Z]/.test(value)) ||
    (/[a-zA-Z]/.test(value) && /\d/.test(value))
  ) {
    score += 1;
  }
  if (value.length >= 12 || /[^a-zA-Z0-9]/.test(value)) score += 1;
  return Math.min(score, 3);
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const failedLogins = useRef(0);
  const redirectTimer = useRef(0);

  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [lockUntil, setLockUntil] = useState(0);

  usePageClass("auth-body star-body", "鸣 Chirp · 登录");

  useEffect(
    () => () => {
      window.clearTimeout(redirectTimer.current);
    },
    []
  );

  useEffect(() => {
    if (!lockUntil) return undefined;
    const render = () => {
      const left = Math.max(0, Math.ceil((lockUntil - Date.now()) / 1000));
      if (left <= 0) {
        setLockUntil(0);
        setStatus("请重新输入后再试。");
        return;
      }
      setStatus(`登录失败次数过多，请 ${left} 秒后再试。`);
    };
    render();
    const timer = window.setInterval(render, 1000);
    return () => window.clearInterval(timer);
  }, [lockUntil]);

  const isRegister = mode === "register";
  const heading = HEADINGS[mode];
  const score = passwordScore(password);
  const showStrength = isRegister && Boolean(password);
  const strengthClassName = `strength register-only${isRegister ? "" : " hidden"}${
    showStrength ? ` level-${score}` : ""
  }`;

  const changeMode = (nextMode) => {
    setMode(nextMode);
    setStatus("");
    setErrors({});
  };

  const validate = () => {
    const nextErrors = {};
    if (isRegister && name.trim().length < 2) {
      nextErrors.name = "请输入至少 2 个字符的昵称";
    }
    if (!email.trim() || !EMAIL_PATTERN.test(email.trim())) {
      nextErrors.email = "请输入有效的邮箱地址";
    }
    if (password.length < 8) {
      nextErrors.password = "密码至少需要 8 位字符";
    }
    if (password.length > 100) {
      nextErrors.password = "密码不能超过 100 位字符";
    }
    if (isRegister && confirmPassword !== password) {
      nextErrors.confirmPassword = "两次输入的密码不一致";
    }
    return nextErrors;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrors({});
    setStatus("");

    if (mode === "login" && lockUntil > Date.now()) return;

    const nextErrors = validate();
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    setSubmitting(true);
    setStatus("正在安全加密…");

    let encryptedPassword;
    try {
      encryptedPassword = await encryptPassword(password);
    } catch {
      setStatus("暂时无法建立安全连接，请确认后端已启动后重试。");
      setSubmitting(false);
      return;
    }

    setStatus("正在提交…");
    try {
      const payload = isRegister
        ? { name: name.trim(), email: email.trim(), password: encryptedPassword }
        : { email: email.trim(), password: encryptedPassword };
      const data = isRegister
        ? await authApi.register(payload)
        : await authApi.login(payload);

      failedLogins.current = 0;
      signIn(data, isRegister ? true : remember);
      setStatus(`${data.message}，正在为你打开鸣 Chirp…`);
      redirectTimer.current = window.setTimeout(() => navigate("/home"), 700);
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 400 && /无效的请求/.test(error.message)) {
          dropCachedPublicKey();
        }
        if (mode === "login") {
          failedLogins.current += 1;
          if (failedLogins.current >= LOCK_THRESHOLD) {
            setLockUntil(Date.now() + LOCK_SECONDS * 1000);
          } else {
            setStatus(error.message || "操作失败，请稍后重试。");
          }
        } else {
          setStatus(error.message || "操作失败，请稍后重试。");
        }
      } else {
        setStatus("暂时无法连接服务器，请确认后端已启动。");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Starfield>
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
            让每一个想法
            <br />
            <em>鸣响</em>世界。
          </h1>
          <p className="sat-copy">分享此刻、加入讨论，你的声音会在这里激起回响。</p>
        </aside>

        <aside className="auth-satellite sat-quote" aria-hidden="true">
          <span className="sat-mark">“</span>
          <p>好想法不该只停留在脑海里，说出来就是第一步。</p>
          <span className="sat-meta">夜航船 · @nightboat</span>
        </aside>

        <aside className="auth-satellite sat-card sat-card-a" aria-hidden="true">
          <article className="chirp-card">
            <div className="avatar" data-av="0">
              林
            </div>
            <div className="chirp-body">
              <p className="chirp-meta">
                <strong>林默</strong>
                <span>@linmo · 2 分钟</span>
              </p>
              <p className="chirp-text">刚在鸣上发了第一条，有人听见吗？🌙</p>
              <p className="chirp-actions">
                <span>♡ 128</span>
                <span>♺ 46</span>
                <span>◎ 12</span>
              </p>
            </div>
          </article>
        </aside>

        <aside className="auth-satellite sat-card sat-card-b" aria-hidden="true">
          <article className="chirp-card">
            <div className="avatar" data-av="2">
              M
            </div>
            <div className="chirp-body">
              <p className="chirp-meta">
                <strong>Momo</strong>
                <span>@momo · 1 小时</span>
              </p>
              <p className="chirp-text">今天的日落值得一条头条 ✦</p>
              <p className="chirp-actions">
                <span>♡ 894</span>
                <span>♺ 203</span>
                <span>◎ 41</span>
              </p>
            </div>
          </article>
        </aside>

        <section className="auth-center">
          <div className="form-wrap">
            <div className="mobile-brand">
              <span className="brand-symbol" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="20" height="20">
                  <rect x="4" y="9" width="4" height="10" rx="2" />
                  <rect x="10" y="4" width="4" height="15" rx="2" />
                  <rect x="16" y="7" width="4" height="12" rx="2" />
                </svg>
              </span>
              鸣 <em>Chirp</em>
            </div>
            <div className="form-heading">
              <p className="eyebrow" id="form-eyebrow">
                {heading.eyebrow}
              </p>
              <h2 id="form-title">{heading.title}</h2>
              <p id="form-subtitle">{heading.subtitle}</p>
            </div>

            <div className="tabs" role="tablist" aria-label="账户操作">
              <button
                className={mode === "login" ? "tab active" : "tab"}
                type="button"
                data-mode="login"
                role="tab"
                aria-selected={mode === "login"}
                onClick={() => changeMode("login")}
              >
                登录
              </button>
              <button
                className={mode === "register" ? "tab active" : "tab"}
                type="button"
                data-mode="register"
                role="tab"
                aria-selected={mode === "register"}
                onClick={() => changeMode("register")}
              >
                注册
              </button>
            </div>

            <form id="auth-form" noValidate onSubmit={handleSubmit}>
              <div className={`field register-only${isRegister ? "" : " hidden"}`}>
                <label htmlFor="name">你的昵称</label>
                <div className="input-wrap">
                  <span className="input-icon">◎</span>
                  <input
                    id="name"
                    type="text"
                    placeholder="例如：林默"
                    autoComplete="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </div>
                <small className="error" data-error="name">
                  {errors.name || ""}
                </small>
              </div>

              <div className="field">
                <label htmlFor="email">邮箱地址</label>
                <div className="input-wrap">
                  <span className="input-icon">@</span>
                  <input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </div>
                <small className="error" data-error="email">
                  {errors.email || ""}
                </small>
              </div>

              <div className="field">
                <label htmlFor="password">密码</label>
                <div className="input-wrap">
                  <span className="input-icon">⌁</span>
                  <input
                    id="password"
                    type={passwordVisible ? "text" : "password"}
                    placeholder="至少 8 位字符"
                    autoComplete={isRegister ? "new-password" : "current-password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <button
                    className="toggle-password"
                    type="button"
                    aria-label={passwordVisible ? "隐藏密码" : "显示密码"}
                    onClick={() => setPasswordVisible((prev) => !prev)}
                  >
                    {passwordVisible ? "隐藏" : "显示"}
                  </button>
                </div>
                <div className={strengthClassName} id="strength">
                  <div className="strength-bars">
                    <i />
                    <i />
                    <i />
                  </div>
                  <small id="strength-text">
                    {showStrength ? ["太短", "弱", "一般", "强"][score] : ""}
                  </small>
                </div>
                <small className="error" data-error="password">
                  {errors.password || ""}
                </small>
              </div>

              <div className={`field register-only${isRegister ? "" : " hidden"}`}>
                <label htmlFor="confirm-password">确认密码</label>
                <div className="input-wrap">
                  <span className="input-icon">⌁</span>
                  <input
                    id="confirm-password"
                    type="password"
                    placeholder="再次输入密码"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                  />
                </div>
                <small className="error" data-error="confirm-password">
                  {errors.confirmPassword || ""}
                </small>
              </div>

              <div className={`form-options login-only${isRegister ? " hidden" : ""}`}>
                <label className="check-label">
                  <input
                    id="remember"
                    type="checkbox"
                    checked={remember}
                    onChange={(event) => setRemember(event.target.checked)}
                  />{" "}
                  <span>记住我</span>
                </label>
                <Link
                  to={
                    EMAIL_PATTERN.test(email.trim())
                      ? `/forgot-password?email=${encodeURIComponent(email.trim())}`
                      : "/forgot-password"
                  }
                  id="forgot-link"
                >
                  忘记密码？
                </Link>
              </div>

              <button className="submit-button" type="submit" disabled={submitting}>
                <span id="submit-text">{heading.submit}</span>
                <span className="arrow">→</span>
              </button>
              <p className="status" id="status" role="status">
                {status}
              </p>
            </form>

            <p className="terms">
              继续即表示你同意我们的 <a href="#">服务条款</a> 与 <a href="#">隐私政策</a>
            </p>
          </div>
        </section>

        <footer className="auth-foot">
          <span>© 2026 Chirp</span>
          <span>每一声，都有回响</span>
          <StarMotionToggle />
        </footer>
      </main>
    </Starfield>
  );
}
