import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Starfield, { StarMotionToggle } from "../components/effects/Starfield.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { usePageClass } from "../hooks/usePageClass.js";

export default function WelcomePage() {
  const navigate = useNavigate();
  const { isAuthed } = useAuth();
  const timerRef = useRef(0);
  const [ripple, setRipple] = useState(null);

  usePageClass("welcome-body star-body", "鸣 Chirp · 让每一个想法鸣响世界");

  useEffect(() => {
    if (isAuthed) navigate("/home", { replace: true });
  }, [isAuthed, navigate]);

  useEffect(
    () => () => {
      window.clearTimeout(timerRef.current);
      document.body.classList.remove("is-settled", "is-leaving");
    },
    []
  );

  const handleEnter = (event) => {
    if (document.body.classList.contains("is-leaving")) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const rect = event.currentTarget.getBoundingClientRect();

    document.body.classList.add("is-settled");
    setRipple({
      left: rect.left + rect.width / 2,
      top: rect.top + rect.height / 2,
      reduced: reduceMotion
    });
    document.body.classList.add("is-leaving");

    timerRef.current = window.setTimeout(
      () => navigate("/login"),
      reduceMotion ? 180 : 560
    );
  };

  if (isAuthed) return null;

  return (
    <Starfield>
      <header className="welcome-top">
        <Link className="brand-mark" to="/" aria-label="鸣 Chirp">
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
        <Link className="welcome-top-link" to="/login">
          已有账户？登录
        </Link>
      </header>

      <main className="welcome-stage">
        <div className="echo-system" aria-hidden="true">
          <span className="echo-ring ring-1" />
          <span className="echo-ring ring-2" />
          <span className="echo-ring ring-3" />
          <span className="echo-core" />
        </div>

        <div className="welcome-title-wrap">
          <span className="welcome-title-echo" aria-hidden="true">
            让每一个想法
            <br />
            <em>鸣响</em>世界
          </span>
          <h1 className="welcome-title">
            让每一个想法
            <br />
            <em>鸣响</em>世界
          </h1>
        </div>
        <span className="welcome-rule" aria-hidden="true" />
        <p className="welcome-sub">
          声音在星云中扩散。分享此刻、加入讨论，你的声音会在这里激起回响。
        </p>
        <button className="welcome-enter" id="enter-btn" type="button" onClick={handleEnter}>
          <span>进入</span>
          <span className="welcome-arrow" aria-hidden="true">
            →
          </span>
        </button>
      </main>

      <footer className="welcome-foot">
        <span>© 2026 Chirp</span>
        <span>每一声，都有回响</span>
        <StarMotionToggle />
      </footer>

      {ripple ? (
        <span
          className={ripple.reduced ? "enter-ripple is-reduced" : "enter-ripple"}
          style={{ left: `${ripple.left}px`, top: `${ripple.top}px` }}
        />
      ) : null}
    </Starfield>
  );
}
