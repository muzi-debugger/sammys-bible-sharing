import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { AppProvider } from '@/context/AppContext';
import { ToastProvider } from '@/components/ui/Toast';
import { AppShell } from '@/components/AppShell';
import { RequireAuth } from '@/components/RequireAuth';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { ResetPasswordPage } from '@/pages/ResetPasswordPage';
import { HomePage } from '@/pages/HomePage';
import { WeeklyScripturesPage } from '@/pages/WeeklyScripturesPage';
import { SundayStudyPage } from '@/pages/SundayStudyPage';
import { JournalPage } from '@/pages/JournalPage';
import { SettingsPage } from '@/pages/SettingsPage';

function AppRoutes() {
  const { recoveryMode } = useAuth();

  // A recovery link must land on the password form, never inside the app.
  if (recoveryMode) {
    return (
      <Routes>
        <Route path="*" element={<ResetPasswordPage />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route
        element={
          <RequireAuth>
            <AppProvider>
              <AppShell />
            </AppProvider>
          </RequireAuth>
        }
      >
        <Route path="/" element={<HomePage />} />
        <Route path="/weekly" element={<WeeklyScripturesPage />} />
        <Route path="/sunday-study" element={<SundayStudyPage />} />
        <Route path="/journal" element={<JournalPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <HashRouter>
      <ToastProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ToastProvider>
    </HashRouter>
  );
}
