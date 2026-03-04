import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import CommandPalette from "../search/CommandPalette";

export default function AppLayout() {
  return (
    <div className="flex h-screen bg-compass-bg">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
      <CommandPalette />
    </div>
  );
}
