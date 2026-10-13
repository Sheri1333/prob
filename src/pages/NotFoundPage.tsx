import { Link } from "react-router-dom";
import { ThemeToggle } from "../components/ThemeToggle";
import type { Lang } from "../i18n/strings";
import { useDocumentTitle } from "../utils/useDocumentTitle";

export function NotFoundPage({ lang }: { lang: Lang }) {
  const title = lang === "kz" ? "Бет табылмады" : "Страница не найдена";
  useDocumentTitle(title);

  return (
    <div className="page">
      <header className="site-header">
        <div className="site-header__brand">
          <Link to="/" className="site-header__logo">
            Талапкер
          </Link>
          <ThemeToggle />
        </div>
      </header>
      <article className="legal-page">
        <h1>404 · {title}</h1>
        <p>
          {lang === "kz"
            ? "Мұндай бет жоқ немесе ол жойылған. Сілтемені тексеріңіз."
            : "Такой страницы нет или она была удалена. Проверьте ссылку."}
        </p>
        <Link to="/" className="test-card__cta not-found__cta">
          {lang === "kz" ? "Басты бетке" : "На главную"}
        </Link>
      </article>
    </div>
  );
}
