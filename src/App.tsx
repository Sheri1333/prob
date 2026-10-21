import { useEffect, useState } from "react";
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
import { NotFoundPage } from "./pages/NotFoundPage";
import "./styles/tokens.css";
import "./styles/global.css";
import "./styles/screens.css";

const LANG_KEY = "prob_lang";

export function App() {
  const [lang, setLang] = useState<Lang>(() => {
    try {
      return localStorage.getItem(LANG_KEY) === "ru" ? "ru" : "kz";
    } catch {
      return "kz";
    }
  });

  useEffect(() => {
    document.documentElement.lang = lang === "kz" ? "kk" : "ru";
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch {
      /* private mode */
    }
  }, [lang]);

  const toggleLang = () => setLang((l) => (l === "kz" ? "ru" : "kz"));

  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route
              path="/"
              element={<CatalogPage lang={lang} onToggleLang={toggleLang} />}
            />
            <Route path="/faq" element={<LegalPage lang={lang} onToggleLang={toggleLang} kind="faq" />} />
            <Route path="/terms" element={<LegalPage lang={lang} onToggleLang={toggleLang} kind="terms" />} />
            <Route
              path="/privacy"
              element={<LegalPage lang={lang} onToggleLang={toggleLang} kind="privacy" />}
            />
            <Route path="/login" element={<LoginPage lang={lang} onToggleLang={toggleLang} />} />
            <Route path="/register" element={<RegisterPage lang={lang} onToggleLang={toggleLang} />} />
            <Route path="/forgot" element={<ForgotPasswordPage lang={lang} onToggleLang={toggleLang} />} />
            <Route path="/reset" element={<ResetPasswordPage lang={lang} onToggleLang={toggleLang} />} />
            <Route path="/verify" element={<VerifyEmailPage lang={lang} onToggleLang={toggleLang} />} />
            <Route path="/profile" element={<ProfilePage lang={lang} onToggleLang={toggleLang} />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route
              path="/exam/results/:sessionId"
              element={<ExamResultsPage lang={lang} onToggleLang={toggleLang} />}
            />
            <Route
              path="/exam/results"
              element={<ExamResultsPage lang={lang} onToggleLang={toggleLang} />}
            />
            <Route
              path="/exam/:sessionId"
              element={<ExamPage lang={lang} onToggleLang={toggleLang} />}
            />
            <Route
              path="/exam"
              element={<ExamPage lang={lang} onToggleLang={toggleLang} />}
            />
            <Route path="*" element={<NotFoundPage lang={lang} onToggleLang={toggleLang} />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
