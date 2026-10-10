/* 鸣 Chirp · 话题页：展示某话题下的帖子（GET /api/search?type=post） */
const API_BASE = "http://localhost:8080";
const $ = (s, r = document) => r.querySelector(s);

const AVATAR_PAIRS = [
  ["#fcd34d", "#f472b6"], ["#6ee7b7", "#38bdf8"], ["#c4b5fd", "#f0abfc"],
  ["#fca5a5", "#fcd34d"], ["#7dd3fc", "#818cf8"], ["#34d399", "#0e9f6e"]
];

function loadToken() {
  return localStorage.getItem("chirpToken") || sessionStorage.getItem("chirpToken");
}
function authHeaders() {
  const token = loadToken();
  return token ? { Accept: "application/json", Authorization: `Bearer ${token}` } : { Accept: "application/json" };
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

const tag = new URLSearchParams(location.search).get("tag") || "";

init();

function init() {
  if (!tag) {
    $("#topic-name").textContent = "未指定话题";
    $("#posts-loading").textContent = "请从首页趋势榜进入话题页。";
    return;
  }
  document.title = `#${tag} · 鸣 Chirp`;
  $("#topic-name").textContent = `#${tag}`;
  loadTopicPosts();
}

async function loadTopicPosts() {
  try {
    const r = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(tag)}&type=post&limit=50`, { headers: authHeaders() });
    if (r.status === 401) { location.replace("/"); return; }
    if (!r.ok) throw new Error();
    const data = await r.json();
    // 精确过滤：内容中确实包含该话题标记（#tag# 或 #tag 至空白/结尾）
    const re = new RegExp(`#${tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=#|\\s|$)`);
    const items = (data.items || []).filter((p) => re.test(p.content));
    $("#posts-loading").classList.add("hidden");
    $("#topic-count").textContent = `${items.length} 条鸣响`;
    $("#posts-empty").classList.toggle("hidden", items.length > 0);
    $("#topic-posts").innerHTML = items.map((p) => {
      const [a, b] = avatarPair(p.userId);
      return `
      <article class="chirp">
        <div class="avatar avatar-lg" style="--a:${a};--b:${b}">${escapeHTML((p.authorName || "?").charAt(0))}</div>
        <div class="chirp-main">
          <p class="chirp-head">
            <strong>${escapeHTML(p.authorName)}</strong>
            <span class="handle">@${escapeHTML(p.authorHandle)}</span>
            <span class="dot">·</span>
            <time>${timeAgo(Date.parse(p.createdAt) || Date.now())}</time>
          </p>
          <p class="chirp-content">${escapeHTML(p.content)}</p>
          <div class="chirp-foot">
            <span class="action-static">评论 ${p.comments ?? 0}</span>
            <span class="action-static">点赞 ${p.likes ?? 0}</span>
          </div>
        </div>
      </article>`;
    }).join("");
  } catch {
    $("#posts-loading").textContent = "加载失败，请确认后端服务已启动后刷新重试。";
  }
}
