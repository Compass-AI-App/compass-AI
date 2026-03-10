import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import ErrorBoundary from "./components/ErrorBoundary";
import WorkspacePage from "./pages/WorkspacePage";
import EvidencePage from "./pages/EvidencePage";
import ConflictsPage from "./pages/ConflictsPage";
import DiscoverPage from "./pages/DiscoverPage";
import ChatPage from "./pages/ChatPage";
import SettingsPage from "./pages/SettingsPage";
import OnboardingPage, { isOnboardingComplete } from "./pages/OnboardingPage";
import LoginPage from "./pages/LoginPage";
import { useSettingsStore } from "./stores/settings";

function AppWithStartup() {
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const pushToEngine = useSettingsStore((s) => s.pushToEngine);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadSettings();
    pushToEngine();
    setReady(true);
  }, [loadSettings, pushToEngine]);

  if (!ready) return null;

  const needsOnboarding = !isOnboardingComplete();

  return (
    <Routes>
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route element={<AppLayout />}>
        <Route path="/" element={<Navigate to={needsOnboarding ? "/onboarding" : "/workspace"} replace />} />
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
