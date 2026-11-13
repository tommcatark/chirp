/* 鸣 Chirp · 个人主页：查看/编辑资料（PUT /api/users/me）+ 我的帖子（GET /api/users/{id}/posts） */
const API_BASE = "http://localhost:8080";
const $ = (s, r = document) => r.querySelector(s);

const AVATAR_PAIRS = [
  ["#fcd34d", "#f472b6"], ["#6ee7b7", "#38bdf8"], ["#c4b5fd", "#f0abfc"],
  ["#fca5a5", "#fcd34d"], ["#7dd3fc", "#818cf8"], ["#34d399", "#0e9f6e"]
];

function loadToken() {
  return localStorage.getItem("chirpToken") || sessionStorage.getItem("chirpToken");
}
function loadUser() {
  const raw = localStorage.getItem("chirpUser") || sessionStorage.getItem("chirpUser");
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function authHeaders(extra = {}) {
  return { Accept: "application/json", Authorization: `Bearer ${loadToken()}`, ...extra };
}
function escapeHTML(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function avatarPair(seed) {
  const s = String(seed ?? "?");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_PAIRS[h % AVATAR_PAIRS.length];
}
function avatarVariant(seed) {
  const s = String(seed ?? "?");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % AVATAR_PAIRS.length;
}
function applyAvatar(el, seed, letter) {
  const [a, b] = avatarPair(seed);
  el.style.setProperty("--a", a);
  el.style.setProperty("--b", b);
  el.textContent = (letter || "?").trim().charAt(0);
}
function timeAgo(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "刚刚";
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} 天前`;
  return new Date(ts).toLocaleDateString("zh-CN");
}

let profile = null; // UserMeResponse

init();

function init() {
  if (!loadToken() || !loadUser()) {
    location.replace("/index.html");
    return;
  }
  bindEditForm();
  bindPostDelete();
  loadProfile().then((ok) => { if (ok) loadMyPosts(); });
}

/* 删除我的帖子（事件代理，动态渲染无需重复绑定） */
function bindPostDelete() {
  $("#my-posts").addEventListener("click", async (event) => {
    const btn = event.target.closest(".post-delete");
    if (!btn) return;
    const node = btn.closest(".chirp");
    const postId = Number(node?.dataset.id);
    if (!postId) return;
    if (!window.confirm("确定删除这条鸣响吗？删除后不可恢复，其评论和点赞也会一并删除。")) return;

    btn.disabled = true;
    try {
      const r = await fetch(`${API_BASE}/api/posts/${postId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${loadToken()}` }
      });
      if (r.status === 401) { location.replace("/index.html"); return; }
      if (!r.ok && r.status !== 204) {
        btn.disabled = false;
        alert(r.status === 403 ? "只能删除自己的鸣响" : "删除失败，请稍后重试");
        return;
      }
      node.remove();
      profile.postCount = Math.max(0, (profile.postCount ?? 1) - 1);
      $("#st-posts").textContent = profile.postCount;
      $("#posts-empty").classList.toggle("hidden", $("#my-posts").children.length > 0);
    } catch {
      btn.disabled = false;
      alert("删除失败，请稍后重试");
    }
  });
}

async function loadProfile() {
  try {
    const r = await fetch(`${API_BASE}/api/users/me`, { headers: authHeaders() });
    if (r.status === 401) { location.replace("/index.html"); return false; }
    if (!r.ok) throw new Error();
    profile = await r.json();
    renderProfile();
    return true;
  } catch {
    $("#pf-name").textContent = "资料加载失败";
    $("#pf-bio").textContent = "请确认后端服务已启动后刷新重试。";
    return false;
  }
}

function renderProfile() {
  applyAvatar($("#pf-avatar"), profile.id, profile.name);
  $("#pf-name").textContent = profile.name;
  $("#pf-handle").textContent = `@${profile.handle}`;
  $("#pf-bio").textContent = profile.bio || "这个人还没有留下简介。";
  $("#pf-joined").textContent = profile.createdAt
    ? `${new Date(Date.parse(profile.createdAt)).toLocaleDateString("zh-CN")} 加入`
    : "";
  $("#st-posts").textContent = profile.postCount ?? 0;
  $("#st-following").textContent = profile.followingCount ?? 0;
  $("#st-followers").textContent = profile.followerCount ?? 0;
}

/* ============ 我的帖子 ============ */
async function loadMyPosts() {
  $("#posts-loading").classList.remove("hidden");
  try {
    const r = await fetch(`${API_BASE}/api/users/${profile.id}/posts`, { headers: authHeaders() });
    if (r.status === 401) { location.replace("/index.html"); return; }
    if (!r.ok) throw new Error();
    const data = await r.json();
    const items = data.items || [];
    $("#posts-loading").classList.add("hidden");
    $("#posts-empty").classList.toggle("hidden", items.length > 0);
    $("#my-posts").innerHTML = items.map((p) => `
      <article class="chirp" data-id="${p.id}">
        <div class="avatar avatar-lg" data-av="${avatarVariant(p.userId)}">${escapeHTML((p.authorName || "?").charAt(0))}</div>
        <div class="chirp-main">
          <p class="chirp-head">
            <strong>${escapeHTML(p.authorName)}</strong>
            <span class="handle">@${escapeHTML(p.authorHandle)}</span>
            <span class="dot">·</span>
            <time>${timeAgo(Date.parse(p.createdAt) || Date.now())}</time>
            <button type="button" class="post-delete" title="删除这条鸣响" aria-label="删除这条鸣响">
              <svg viewBox="0 0 24 24" width="16" height="16"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6M10 11v6M14 11v6"/></svg>
            </button>
          </p>
          <p class="chirp-content">${escapeHTML(p.content)}</p>
          <div class="chirp-foot">
            <span class="action-static">评论 ${p.comments ?? 0}</span>
            <span class="action-static">点赞 ${p.likes ?? 0}</span>
          </div>
        </div>
      </article>`).join("");
  } catch {
    $("#posts-loading").textContent = "帖子加载失败，请稍后刷新重试。";
  }
}

/* ============ 编辑资料 ============ */
function bindEditForm() {
  const card = $("#edit-card");
  const form = $("#edit-form");
  const status = $("#edit-status");
  const saveBtn = $("#edit-save");

  $("#edit-btn").addEventListener("click", () => {
    $("#edit-name").value = profile?.name || "";
    $("#edit-bio").value = profile?.bio || "";
    $("#edit-avatar").value = profile?.avatarUrl || "";
    status.textContent = "";
    card.classList.remove("hidden");
    saveBtn.disabled = false;
    $("#edit-name").focus();
  });
  $("#edit-cancel").addEventListener("click", () => card.classList.add("hidden"));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = $("#edit-name").value.trim();
    const bio = $("#edit-bio").value.trim();
    const avatarUrl = $("#edit-avatar").value.trim();
    if (name.length < 2) {
      status.textContent = "昵称至少需要 2 个字符。";
      return;
    }
    saveBtn.disabled = true;
    saveBtn.textContent = "保存中…";
    try {
      const r = await fetch(`${API_BASE}/api/users/me`, {
        method: "PUT",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ name, bio, avatarUrl })
      });
      const data = await r.json().catch(() => ({}));
      if (r.status === 401) { location.replace("/index.html"); return; }
      if (!r.ok) throw new Error(data.message || "保存失败，请稍后重试");
      profile = data;
      // 同步登录态缓存，首页用户卡片立即生效
      const user = loadUser();
      if (user) {
        user.name = profile.name;
        const store = localStorage.getItem("chirpUser") ? localStorage : sessionStorage;
        store.setItem("chirpUser", JSON.stringify(user));
      }
      renderProfile();
      status.textContent = "已保存。";
      setTimeout(() => card.classList.add("hidden"), 600);
    } catch (err) {
      status.textContent = err.message;
    } finally {
      saveBtn.textContent = "保存";
      saveBtn.disabled = false;
    }
  });
}
