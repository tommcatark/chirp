/* 鸣 Chirp · 通知页：通知列表（GET /api/notifications）+ 标记已读（POST /api/notifications/read） */
const API_BASE = "http://localhost:8080";
const $ = (s, r = document) => r.querySelector(s);
const PAGE_SIZE = 20;

const AVATAR_PAIRS = [
  ["#fcd34d", "#f472b6"], ["#6ee7b7", "#38bdf8"], ["#c4b5fd", "#f0abfc"],
  ["#fca5a5", "#fcd34d"], ["#7dd3fc", "#818cf8"], ["#34d399", "#0e9f6e"]
];

/* 类型图标与文案 */
const TYPE_META = {
  follow: {
    text: "关注了你",
    icon: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6"/></svg>'
  },
  like: {
    text: "赞了你的鸣响",
    icon: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.7-9A5.4 5.4 0 0 1 12 6.5 5.4 5.4 0 0 1 21.7 12c-2.2 4.4-9.7 9-9.7 9Z"/></svg>'
  },
  comment: {
    text: "评论了你的鸣响",
    icon: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.5 7.2L4 20l.9-4.4A8 8 0 1 1 21 12Z"/></svg>'
  }
};

function loadToken() {
  return localStorage.getItem("chirpToken") || sessionStorage.getItem("chirpToken");
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

let offset = 0;
let hasMore = false;
let unreadCount = 0;

init();

function init() {
  if (!loadToken()) {
    location.replace("/");
    return;
  }
  $("#mark-all-btn").addEventListener("click", markAllRead);
  $("#load-more-btn").addEventListener("click", () => loadNotifications(false));
  $("#notif-list").addEventListener("click", onItemClick);
  bindAvatarClicks();
  loadNotifications(true);
}

/* 头像点击 → 跳转用户主页 */
function bindAvatarClicks() {
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-uid]");
    if (!el) return;
    if (e.target.closest("button, a, input, textarea, select")) return;
    const uid = Number(el.dataset.uid);
    if (!uid) return;
    e.stopPropagation();
    location.href = `/profile.html?id=${uid}`;
  }, true);
}

/* ============ 加载列表 ============ */
async function loadNotifications(reset) {
  if (reset) {
    offset = 0;
    $("#notif-loading").classList.remove("hidden");
    $("#notif-empty").classList.add("hidden");
  }
  const moreBtn = $("#load-more-btn");
  moreBtn.classList.add("hidden");
  try {
    const r = await fetch(`${API_BASE}/api/notifications?offset=${reset ? 0 : offset}&limit=${PAGE_SIZE}`, { headers: authHeaders() });
    if (r.status === 401) { location.replace("/"); return; }
    if (!r.ok) throw new Error();
    const data = await r.json();
    const items = data.items || [];
    unreadCount = data.unreadCount ?? 0;
    hasMore = !!data.hasMore;
    offset = (reset ? 0 : offset) + items.length;

    if (reset) {
      $("#notif-loading").classList.add("hidden");
      $("#notif-list").innerHTML = items.map(notifHTML).join("");
      $("#notif-empty").classList.toggle("hidden", items.length > 0);
    } else {
      $("#notif-list").insertAdjacentHTML("beforeend", items.map(notifHTML).join(""));
    }
    syncUnreadUI();
    moreBtn.classList.toggle("hidden", !hasMore);
  } catch {
    if (reset) $("#notif-loading").textContent = "通知加载失败，请确认后端服务已启动后刷新重试。";
  }
}

function notifHTML(n) {
  const meta = TYPE_META[n.type] || { text: "与你互动了", icon: "" };
  const actorId = n.actor?.id;
  const [a, b] = avatarPair(actorId);
  const actorName = n.actor?.name || "未知用户";
  const quote = n.commentExcerpt || n.postExcerpt;
  const uidAttr = actorId ? ` data-uid="${actorId}"` : "";
  return `
  <li class="notif-item ${n.isRead ? "" : "is-unread"}" data-id="${n.id}" data-read="${n.isRead}">
    <span class="notif-icon notif-icon-${escapeHTML(n.type)}">${meta.icon}</span>
    <div class="avatar"${uidAttr} style="--a:${a};--b:${b}">${escapeHTML(actorName.charAt(0))}</div>
    <div class="notif-body">
      <p class="notif-line">
        <strong>${escapeHTML(actorName)}</strong>
        <span class="handle">@${escapeHTML(n.actor?.handle || "unknown")}</span>
        ${escapeHTML(meta.text)}
      </p>
      ${quote ? `<p class="notif-quote">${escapeHTML(quote)}</p>` : ""}
      <time class="notif-time">${timeAgo(Date.parse(n.createdAt) || Date.now())}</time>
    </div>
    <span class="notif-dot" aria-hidden="true"></span>
  </li>`;
}

/* ============ 已读 ============ */
function syncUnreadUI() {
  const badge = $("#unread-count");
  badge.textContent = `${unreadCount} 条未读`;
  badge.classList.toggle("hidden", unreadCount === 0);
  $("#mark-all-btn").disabled = unreadCount === 0;
}

async function markAllRead() {
  const btn = $("#mark-all-btn");
  btn.disabled = true;
  try {
    const r = await fetch(`${API_BASE}/api/notifications/read`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: "{}"
    });
    if (r.status === 401) { location.replace("/"); return; }
    if (!r.ok) throw new Error();
    const data = await r.json();
    unreadCount = data.unreadCount ?? 0;
    document.querySelectorAll(".notif-item.is-unread").forEach((el) => {
      el.classList.remove("is-unread");
      el.dataset.read = "true";
    });
    syncUnreadUI();
  } catch {
    btn.disabled = false;
  }
}

/* 点击单条未读通知 → 仅标记该条 */
async function onItemClick(event) {
  const item = event.target.closest(".notif-item");
  if (!item || item.dataset.read === "true") return;
  const id = Number(item.dataset.id);
  if (!id) return;
  // 乐观更新，失败时还原
  item.classList.remove("is-unread");
  item.dataset.read = "true";
  unreadCount = Math.max(0, unreadCount - 1);
  syncUnreadUI();
  try {
    const r = await fetch(`${API_BASE}/api/notifications/read`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ ids: [id] })
    });
    if (r.status === 401) { location.replace("/"); return; }
    if (!r.ok) throw new Error();
    const data = await r.json();
    unreadCount = data.unreadCount ?? unreadCount;
    syncUnreadUI();
  } catch {
    item.classList.add("is-unread");
    item.dataset.read = "false";
    unreadCount += 1;
    syncUnreadUI();
  }
}
