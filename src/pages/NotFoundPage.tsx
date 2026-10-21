import { Link } from "react-router-dom";
import { SiteHeader } from "../components/SiteHeader";
import type { Lang } from "../i18n/strings";
import { useDocumentTitle } from "../utils/useDocumentTitle";
import "../styles/home.css";

interface NotFoundPageProps {
  lang: Lang;
  onToggleLang: () => void;
}

export function NotFoundPage({ lang, onToggleLang }: NotFoundPageProps) {
  const kz = lang === "kz";
  const title = kz ? "Бет табылмады" : "Страница не найдена";
  useDocumentTitle(title);

  return (
    <div className="page v2">
      <SiteHeader lang={lang} onToggleLang={onToggleLang} />
      <main className="not-found">
        <p className="not-found__code" aria-hidden="true">
          404
        </p>
        <h1>{title}</h1>
        <p>
          {kz
            ? "Мұндай бет жоқ немесе ол жойылған. Сілтемені тексеріңіз немесе басты беттен бастаңыз."
            : "Такой страницы нет или её удалили. Проверьте ссылку или начните с главной."}
        </p>
        <Link to="/" className="v2-btn">
          {kz ? "Басты бетке" : "На главную"}
        </Link>
      </main>
    </div>
  );
}
