import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import ErrorBoundary from "./components/ErrorBoundary";
import WorkspacePage from "./pages/WorkspacePage";
import EvidencePage from "./pages/EvidencePage";
import ConflictsPage from "./pages/ConflictsPage";
import DiscoverPage from "./pages/DiscoverPage";
import ChatPage from "./pages/ChatPage";
import SettingsPage from "./pages/SettingsPage";
import { useSettingsStore } from "./stores/settings";

function AppWithStartup() {
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const pushToEngine = useSettingsStore((s) => s.pushToEngine);

  useEffect(() => {
    loadSettings();
    pushToEngine();
  }, [loadSettings, pushToEngine]);

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Navigate to="/workspace" replace />} />
        <Route path="/workspace" element={<WorkspacePage />} />
        <Route path="/evidence" element={<EvidencePage />} />
        <Route path="/conflicts" element={<ConflictsPage />} />
        <Route path="/discover" element={<DiscoverPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppWithStartup />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
