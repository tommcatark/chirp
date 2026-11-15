import { useState } from "react";
import { Outlet } from "react-router-dom";
import SideNav from "./SideNav.jsx";
import ComposerModal from "../post/ComposerModal.jsx";

export default function AppShell() {
  const [composerOpen, setComposerOpen] = useState(false);
  const openComposer = () => setComposerOpen(true);

  return (
    <div className="app-shell observatory">
      <SideNav onCompose={openComposer} />
      <main className="stage">
        <Outlet context={{ openComposer }} />
      </main>
      <ComposerModal open={composerOpen} onClose={() => setComposerOpen(false)} />
    </div>
  );
}
