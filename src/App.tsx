import { useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { ThemeProvider } from "./theme/ThemeContext";
import type { Lang } from "./i18n/strings";
import { AdminPage } from "./pages/AdminPage";
import { CatalogPage } from "./pages/CatalogPage";
import { ExamPage } from "./pages/ExamPage";
import { ExamResultsPage } from "./pages/ExamResultsPage";
import { LoginPage, RegisterPage } from "./pages/LoginPage";
import {
  ForgotPasswordPage,
  ResetPasswordPage,
  VerifyEmailPage,
} from "./pages/EmailAuthPages";
import { LegalPage } from "./pages/LegalPage";
import { ProfilePage } from "./pages/ProfilePage";
import { ResultsPage } from "./pages/ResultsPage";
import { TestPage } from "./pages/TestPage";
import "./styles/global.css";

export function App() {
  const [lang, setLang] = useState<Lang>("kz");

  const toggleLang = () => setLang((l) => (l === "kz" ? "ru" : "kz"));

  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<CatalogPage lang={lang} />} />
            <Route path="/faq" element={<LegalPage lang={lang} kind="faq" />} />
            <Route path="/terms" element={<LegalPage lang={lang} kind="terms" />} />
            <Route
              path="/privacy"
              element={<LegalPage lang={lang} kind="privacy" />}
            />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot" element={<ForgotPasswordPage />} />
            <Route path="/reset" element={<ResetPasswordPage />} />
            <Route path="/verify" element={<VerifyEmailPage />} />
            <Route path="/profile" element={<ProfilePage lang={lang} />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route
              path="/exam/results/:sessionId"
              element={<ExamResultsPage lang={lang} />}
            />
            <Route
              path="/exam/results"
              element={<ExamResultsPage lang={lang} />}
            />
            <Route
              path="/exam/:sessionId"
              element={<ExamPage lang={lang} onToggleLang={toggleLang} />}
            />
            <Route
              path="/exam"
              element={<ExamPage lang={lang} onToggleLang={toggleLang} />}
            />
            <Route
              path="/test/:testId"
              element={<TestPage lang={lang} onToggleLang={toggleLang} />}
            />
            <Route
              path="/test/:testId/results"
              element={<ResultsPage lang={lang} />}
            />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
