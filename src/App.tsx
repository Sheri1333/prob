import { useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import type { Lang } from "./i18n/strings";
import { AdminPage } from "./pages/AdminPage";
import { CatalogPage } from "./pages/CatalogPage";
import { LoginPage, RegisterPage } from "./pages/LoginPage";
import { ResultsPage } from "./pages/ResultsPage";
import { TestPage } from "./pages/TestPage";
import "./styles/global.css";

export function App() {
  const [lang, setLang] = useState<Lang>("kz");

  const toggleLang = () => setLang((l) => (l === "kz" ? "ru" : "kz"));

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<CatalogPage lang={lang} />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/admin" element={<AdminPage />} />
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
  );
}
