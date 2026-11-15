import { useState } from "react";
import { usersApi } from "../../lib/api.js";

export default function ProfileEditCard({ profile, onCancel, onSaved }) {
  const [name, setName] = useState(profile?.name || "");
  const [bio, setBio] = useState(profile?.bio || "");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatarUrl || "");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    const nextName = name.trim();
    const nextBio = bio.trim();
    const nextAvatarUrl = avatarUrl.trim();

    if (nextName.length < 2) {
      setStatus("昵称至少需要 2 个字符。");
      return;
    }

    setSaving(true);
    setStatus("");
    try {
      const data = await usersApi.updateMe({
        name: nextName,
        bio: nextBio,
        avatarUrl: nextAvatarUrl
      });
      setStatus("已保存。");
      onSaved?.(data);
    } catch (error) {
      setStatus(error.message || "保存失败，请稍后重试");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="edit-card">
      <h2>编辑资料</h2>
      <form onSubmit={submit} noValidate>
        <label className="edit-field">
          <span>昵称（2-120 字符）</span>
          <input
            type="text"
            maxLength={120}
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="edit-field">
          <span>简介（最多 200 字符）</span>
          <textarea
            maxLength={200}
            rows={3}
            value={bio}
            onChange={(event) => setBio(event.target.value)}
          />
        </label>
        <label className="edit-field">
          <span>头像链接（可选）</span>
          <input
            type="url"
            maxLength={500}
            placeholder="https://…"
            value={avatarUrl}
            onChange={(event) => setAvatarUrl(event.target.value)}
          />
        </label>
        <p className="edit-status" role="status">
          {status}
        </p>
        <div className="edit-actions">
          <button type="button" className="btn-ghost" onClick={onCancel}>
            取消
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "保存中…" : "保存"}
          </button>
        </div>
      </form>
    </section>
  );
}
