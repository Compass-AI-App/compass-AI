import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import CommandPalette from "../search/CommandPalette";
import FeedbackButton from "../FeedbackButton";

export default function AppLayout() {
  return (
    <div className="flex h-screen bg-compass-bg">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
      <CommandPalette />
      <FeedbackButton />
    </div>
  );
}
