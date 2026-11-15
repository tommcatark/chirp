import { Link } from "react-router-dom";
import { usePageClass } from "../hooks/usePageClass.js";

export default function NotFoundPage() {
  usePageClass("auth-body", "页面不存在 · 鸣 Chirp");
  return (
    <main className="auth-center">
      <section className="auth-card">
        <h1>页面走丢了</h1>
        <p className="auth-sub">你访问的地址不存在。</p>
        <Link className="btn-primary" to="/home">
          回到首页
        </Link>
      </section>
    </main>
  );
}
