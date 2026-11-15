const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function timeAgo(timestamp) {
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return "";
  const diff = Math.max(0, Date.now() - ts);
  if (diff < MINUTE) return "刚刚";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} 分钟前`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)} 小时前`;
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)} 天前`;
  return formatDate(ts);
}

export function formatDate(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatCount(value) {
  const n = Number(value) || 0;
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function initialOf(name) {
  return String(name || "?").trim().charAt(0).toUpperCase();
}

/* 将后端 PostResponse 统一为前端渲染结构 */
export function normalizePost(post) {
  return {
    id: post.id,
    userId: post.userId,
    author: { name: post.authorName, handle: post.authorHandle },
    avatarUrl: post.authorAvatarUrl || "",
    createdAt: Date.parse(post.createdAt) || Date.now(),
    text: post.content,
    likes: post.likes || 0,
    reposts: post.reposts || 0,
    comments: post.comments || 0,
    liked: !!post.liked,
    bookmarked: !!post.bookmarked,
    reposted: false,
    mine: !!post.mine
  };
}
