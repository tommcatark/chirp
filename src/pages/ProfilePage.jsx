import { useParams } from "react-router-dom";
import { usePageClass } from "../hooks/usePageClass.js";
import { useRevealMotion } from "../hooks/useRevealMotion.js";
import ProfileView from "../components/profile/ProfileView.jsx";

export default function ProfilePage() {
  const { id } = useParams();
  const userId = id === undefined ? null : Number(id);

  usePageClass("app-body observatory-body", "个人主页 · 鸣 Chirp");
  useRevealMotion();

  return (
    <section className="view-panel view-profile" aria-label="个人主页">
      <ProfileView userId={userId} embedded />
    </section>
  );
}
