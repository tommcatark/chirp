import Avatar from "../ui/Avatar.jsx";
import { formatDate } from "../../lib/utils.js";

export default function ProfileCard({
  profile,
  error = "",
  isSelf = false,
  following = false,
  followPending = false,
  onEdit,
  onToggleFollow
}) {
  const name = profile?.name || (error ? "资料加载失败" : "—");
  const handle = profile?.handle ? `@${profile.handle}` : "@—";
  const bio = profile?.bio || (error ? "请确认后端服务已启动后刷新重试。" : "这个人还没有留下简介。");
  const joined = profile?.createdAt ? `${formatDate(profile.createdAt)} 加入` : "";
  const canFollow = !isSelf && Boolean(profile) && !profile.me;

  return (
    <section className="profile-card">
      <div className="profile-cover" aria-hidden="true" />
      <Avatar seed={profile?.id} name={profile?.name} src={profile?.avatarUrl || undefined} size="avatar-xl" />
      <div className="profile-info">
        <h1>{name}</h1>
        <p className="profile-handle">{handle}</p>
        <p className="profile-bio">{bio}</p>
        <p className="profile-joined">{joined}</p>
      </div>

      {isSelf ? (
        <button type="button" className="edit-btn" disabled={!profile} onClick={onEdit}>
          编辑资料
        </button>
      ) : null}

      {canFollow ? (
        <button
          type="button"
          className="edit-btn"
          disabled={followPending}
          aria-pressed={following}
          onClick={onToggleFollow}
        >
          {followPending ? "处理中…" : following ? "已关注" : "关注"}
        </button>
      ) : null}

      <ul className="profile-stats">
        <li>
          <strong>{profile?.postCount ?? 0}</strong>
          <span>鸣响</span>
        </li>
        <li>
          <strong>{profile?.followingCount ?? 0}</strong>
          <span>关注</span>
        </li>
        <li>
          <strong>{profile?.followerCount ?? 0}</strong>
          <span>粉丝</span>
        </li>
      </ul>
    </section>
  );
}
