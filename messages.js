/* 鸣 Chirp · 消息页：会话列表（GET /api/messages/conversations）+ 聊天视图（GET/POST /api/messages） */
const API_BASE = "http://localhost:8080";
const $ = (s, r = document) => r.querySelector(s);
const PAGE_SIZE = 30;

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

const me = loadUser();
let currentPeer = null;   // 当前聊天对象 {id, name, handle}
let msgOffset = 0;
let msgHasMore = false;

init();

function init() {
  if (!loadToken() || !me) {
    location.replace("/index.html");
    return;
  }
  $("#conv-list").addEventListener("click", onConvClick);
  $("#chat-back").addEventListener("click", backToList);
  $("#chat-form").addEventListener("submit", onSend);
  $("#chat-more-btn").addEventListener("click", () => loadMessages(false));
  const input = $("#chat-input");
  input.addEventListener("input", () => {
    $("#chat-send").disabled = !input.value.trim();
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.value.trim()) $("#chat-form").requestSubmit();
    }
  });

  // 支持 ?with={userId} 直接进入与某人的会话
  const withId = Number(new URLSearchParams(location.search).get("with"));
  if (withId && withId !== me.id) {
    openChatById(withId);
  } else {
    loadConversations();
  }
}

/* ============ 会话列表 ============ */
async function loadConversations() {
  $("#conv-view").classList.remove("hidden");
  $("#chat-view").classList.add("hidden");
  $("#conv-loading").classList.remove("hidden");
  $("#conv-empty").classList.add("hidden");
  try {
    const r = await fetch(`${API_BASE}/api/messages/conversations`, { headers: authHeaders() });
    if (r.status === 401) { location.replace("/index.html"); return; }
    if (!r.ok) throw new Error();
    const data = await r.json();
    const items = data.items || [];
    const totalUnread = data.totalUnread ?? 0;
    $("#conv-loading").classList.add("hidden");
    $("#conv-list").innerHTML = items.map(convHTML).join("");
    $("#conv-empty").classList.toggle("hidden", items.length > 0);
    const badge = $("#msg-unread");
    badge.textContent = `${totalUnread} 条未读`;
    badge.classList.toggle("hidden", totalUnread === 0);
  } catch {
    $("#conv-loading").textContent = "消息加载失败，请确认后端服务已启动后刷新重试。";
  }
}

function convHTML(c) {
  const u = c.user || {};
  const last = c.lastMessage || {};
  const mine = last.senderId === me.id;
  const variant = avatarVariant(u.id);
  return `
  <li class="conv-item ${c.unreadCount > 0 ? "is-unread" : ""}" data-id="${u.id}"
      data-name="${escapeHTML(u.name)}" data-handle="${escapeHTML(u.handle)}">
    <div class="avatar" data-av="${variant}">${escapeHTML((u.name || "?").charAt(0))}</div>
    <div class="conv-body">
      <p class="conv-line">
        <strong>${escapeHTML(u.name)}</strong>
        <span class="handle">@${escapeHTML(u.handle)}</span>
        <time>${timeAgo(Date.parse(last.createdAt) || Date.now())}</time>
      </p>
      <p class="conv-preview">${mine ? "我：" : ""}${escapeHTML(last.content || "")}</p>
    </div>
    ${c.unreadCount > 0 ? `<span class="conv-badge">${c.unreadCount > 99 ? "99+" : c.unreadCount}</span>` : ""}
  </li>`;
}

function onConvClick(event) {
  const item = event.target.closest(".conv-item");
  if (!item) return;
  openChat({
    id: Number(item.dataset.id),
    name: item.dataset.name,
    handle: item.dataset.handle
  });
}

/* ============ 聊天视图 ============ */
async function openChatById(userId) {
  try {
    const r = await fetch(`${API_BASE}/api/users/${userId}`, { headers: authHeaders() });
    if (r.status === 401) { location.replace("/index.html"); return; }
    if (!r.ok) throw new Error();
    const u = await r.json();
    openChat({ id: u.id, name: u.name, handle: u.handle });
  } catch {
    loadConversations();
  }
}

function openChat(user) {
  currentPeer = user;
  msgOffset = 0;
  msgHasMore = false;
  $("#conv-view").classList.add("hidden");
  $("#chat-view").classList.remove("hidden");
  const [a, b] = avatarPair(user.id);
  const avatar = $("#chat-avatar");
  avatar.style.setProperty("--a", a);
  avatar.style.setProperty("--b", b);
  avatar.textContent = (user.name || "?").charAt(0);
  $("#chat-name").textContent = user.name;
  $("#chat-handle").textContent = `@${user.handle}`;
  $("#msg-list").innerHTML = "";
  $("#chat-input").value = "";
  $("#chat-send").disabled = true;
  loadMessages(true);
}

function backToList() {
  currentPeer = null;
  loadConversations();
}

async function loadMessages(reset) {
  if (!currentPeer) return;
  const moreBtn = $("#chat-more-btn");
  moreBtn.classList.add("hidden");
  if (reset) $("#chat-loading").classList.remove("hidden");
  try {
    const r = await fetch(`${API_BASE}/api/messages?with=${currentPeer.id}&offset=${reset ? 0 : msgOffset}&limit=${PAGE_SIZE}`, { headers: authHeaders() });
    if (r.status === 401) { location.replace("/index.html"); return; }
    if (!r.ok) throw new Error();
    const data = await r.json();
    // 接口返回倒序（最新在前），渲染时反转为正序
    const items = (data.items || []).slice().reverse();
    msgHasMore = !!data.hasMore;
    msgOffset = (reset ? 0 : msgOffset) + items.length;

    const body = $("#chat-body");
    if (reset) {
      $("#chat-loading").classList.add("hidden");
      $("#msg-list").innerHTML = items.map(bubbleHTML).join("");
      body.scrollTop = body.scrollHeight;
      markConversationRead();
    } else {
      const prevHeight = body.scrollHeight;
      $("#msg-list").insertAdjacentHTML("afterbegin", items.map(bubbleHTML).join(""));
      body.scrollTop = body.scrollHeight - prevHeight;
    }
    moreBtn.classList.toggle("hidden", !msgHasMore);
  } catch {
    if (reset) $("#chat-loading").textContent = "加载失败，请稍后重试。";
  }
}

function bubbleHTML(m) {
  const mine = m.senderId === me.id;
  return `
  <li class="msg-item ${mine ? "mine" : "theirs"}" data-id="${m.id}">
    ${escapeHTML(m.content)}
    <time>${timeAgo(Date.parse(m.createdAt) || Date.now())}</time>
  </li>`;
}

/* 进入会话后，将对方发来的消息标记已读 */
async function markConversationRead() {
  try {
    await fetch(`${API_BASE}/api/messages/read`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ with: currentPeer.id })
    });
  } catch { /* 静默失败，不影响聊天 */ }
}

/* ============ 发送消息 ============ */
async function onSend(event) {
  event.preventDefault();
  if (!currentPeer) return;
  const input = $("#chat-input");
  const content = input.value.trim();
  if (!content) return;
  const btn = $("#chat-send");
  btn.disabled = true;
  try {
    const r = await fetch(`${API_BASE}/api/messages`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ recipientId: currentPeer.id, content })
    });
    if (r.status === 401) { location.replace("/index.html"); return; }
    if (!r.ok) throw new Error();
    const m = await r.json();
    $("#msg-list").insertAdjacentHTML("beforeend", bubbleHTML(m));
    input.value = "";
    const body = $("#chat-body");
    body.scrollTop = body.scrollHeight;
  } catch {
    btn.disabled = false;
  }
}
