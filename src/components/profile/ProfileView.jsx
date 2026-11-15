import { useEffect, useState } from "react";
import { postsApi, usersApi } from "../../lib/api.js";
import { timeAgo } from "../../lib/utils.js";
import { useAuth } from "../../context/AuthContext.jsx";
import Avatar from "../ui/Avatar.jsx";
import EmptyState from "../ui/EmptyState.jsx";
import Loading from "../ui/Loading.jsx";
import ProfileCard from "./ProfileCard.jsx";
import ProfileEditCard from "./ProfileEditCard.jsx";

const POSTS_LIMIT = 20;
const DELETE_CONFIRM_TEXT = "确定删除这条鸣响吗？删除后不可恢复，其评论和点赞也会一并删除。";

export default function ProfileView({ userId = null, embedded = false }) {
  const isSelf = userId == null;
  const { updateUser } = useAuth();

  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState("");
  const [profileLoading, setProfileLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [followPending, setFollowPending] = useState(false);

  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsError, setPostsError] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setProfile(null);
    setProfileError("");
    setProfileLoading(true);
    setEditOpen(false);
    setFollowPending(false);
    setPosts([]);
    setPostsError("");
    setPostsLoading(false);

    const request = isSelf ? usersApi.me() : usersApi.get(userId);
    request
      .then((data) => {
        if (!cancelled) setProfile(data);
      })
      .catch((error) => {
        if (!cancelled) setProfileError(error.message || "资料加载失败，请稍后重试。");
      })
      .finally(() => {
        if (!cancelled) setProfileLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isSelf, userId]);

  useEffect(() => {
    if (!profile?.id) return undefined;
    let cancelled = false;
    setPosts([]);
    setPostsLoading(true);
    setPostsError("");

    usersApi
      .posts({ id: profile.id, offset: 0, limit: POSTS_LIMIT })
      .then((data) => {
        if (!cancelled) setPosts(data?.items || []);
      })
      .catch((error) => {
        if (!cancelled) setPostsError(error.message || "帖子加载失败，请稍后刷新重试。");
      })
      .finally(() => {
        if (!cancelled) setPostsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  const toggleFollow = async () => {
    if (!profile || isSelf || followPending) return;
    setFollowPending(true);
    try {
      const data = profile.followedByMe
        ? await usersApi.unfollow(profile.id)
        : await usersApi.follow(profile.id);
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              followedByMe: data?.following ?? !prev.followedByMe,
              followerCount: data?.followerCount ?? prev.followerCount
            }
          : prev
      );
    } catch {
      /* 保持原关注状态 */
    } finally {
      setFollowPending(false);
    }
  };

  const saveProfile = (data) => {
    setProfile(data);
    setEditOpen(false);
    updateUser({
      name: data.name,
      bio: data.bio,
      avatarUrl: data.avatarUrl
    });
  };

  const removePost = async (postId) => {
    if (deletingId) return;
    if (!window.confirm(DELETE_CONFIRM_TEXT)) return;

    setDeletingId(postId);
    try {
      await postsApi.remove(postId);
      setPosts((prev) => prev.filter((post) => post.id !== postId));
      setProfile((prev) =>
        prev ? { ...prev, postCount: Math.max(0, (prev.postCount ?? 1) - 1) } : prev
      );
    } catch (error) {
      window.alert(error.status === 403 ? "只能删除自己的鸣响" : "删除失败，请稍后重试");
    } finally {
      setDeletingId(null);
    }
  };

  const showEmptyPosts =
    !profileLoading &&
    !profileError &&
    !postsLoading &&
    !postsError &&
    posts.length === 0;

  return (
    <div className={`profile-wrap${embedded ? " embedded-profile" : ""}`}>
      <ProfileCard
        profile={profile}
        error={profileError}
        isSelf={isSelf}
        following={Boolean(profile?.followedByMe)}
        followPending={followPending}
        onEdit={() => setEditOpen(true)}
        onToggleFollow={toggleFollow}
      />

      {isSelf && editOpen ? (
        <ProfileEditCard
          profile={profile}
          onCancel={() => setEditOpen(false)}
          onSaved={saveProfile}
        />
      ) : null}

      <section className="profile-posts">
        <h2>{isSelf ? "我的鸣响" : profile?.name ? `${profile.name} 的鸣响` : "TA 的鸣响"}</h2>

        {postsLoading ? <Loading /> : null}
        {!postsLoading && postsError ? <p className="feed-loading">{postsError}</p> : null}

        <div className="feed">
          {posts.map((post) => (
            <article className="chirp" data-id={post.id} key={post.id}>
              <Avatar
                seed={post.userId}
                name={post.authorName || "未知用户"}
                src={post.authorAvatarUrl || undefined}
                size="avatar-lg"
              />
              <div className="chirp-main">
                <p className="chirp-head">
                  <strong>{post.authorName || "未知用户"}</strong>
                  <span className="handle">@{post.authorHandle || "unknown"}</span>
                  <span className="dot">·</span>
                  <time>{timeAgo(Date.parse(post.createdAt) || Date.now())}</time>
                  {isSelf ? (
                    <button
                      type="button"
                      className="post-delete"
                      title="删除这条鸣响"
                      aria-label="删除这条鸣响"
                      disabled={deletingId === post.id}
                      onClick={() => removePost(post.id)}
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16">
                        <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6M10 11v6M14 11v6" />
                      </svg>
                    </button>
                  ) : null}
                </p>
                <p className="chirp-content">{post.content}</p>
                <div className="chirp-foot">
                  <span className="action-static">评论 {post.comments ?? 0}</span>
                  <span className="action-static">点赞 {post.likes ?? 0}</span>
                </div>
              </div>
            </article>
          ))}
        </div>

        <EmptyState
          title={isSelf ? "还没有发布过鸣响" : "TA 还没有发布过鸣响"}
          description={
            isSelf ? "回到首页发布你的第一条吧。" : "TA 发布的鸣响会出现在这里。"
          }
          hidden={!showEmptyPosts}
        />
      </section>
    </div>
  );
}
