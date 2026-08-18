import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { Lang } from "../i18n/strings";
import { t } from "../i18n/strings";
import type { CatalogItem } from "../types/test";

interface CatalogPageProps {
  lang: Lang;
}

export function CatalogPage({ lang }: CatalogPageProps) {
  const { user, isAdmin, logout } = useAuth();
  const [tests, setTests] = useState<CatalogItem[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getCatalog()
      .then(({ tests: list }) => setTests(list))
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Не удалось загрузить каталог"),
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page">
      <header className="site-header">
        <div className="site-header__logo">PROB</div>
        <nav className="site-header__nav">
          <Link to="/admin">Админка</Link>
          {isAdmin && user && (
            <>
              <span className="site-header__user">{user.name}</span>
              <button type="button" className="link-btn" onClick={logout}>
                Выйти
              </button>
            </>
          )}
        </nav>
      </header>

      <section className="catalog">
        <h2>{lang === "kz" ? "Тесттер" : "Тесты"}</h2>
        {loading && <p>Загрузка...</p>}
        {error && (
          <p className="auth-card__error">
            {error}. Запустите API: <code>npm run server</code>
          </p>
        )}
        <div className="catalog-grid">
          {tests.map((item) => (
            <article key={item.id} className="test-card">
              <div className="test-card__badge">{item.examType}</div>
              <h3>{lang === "kz" ? item.titleKz : item.title}</h3>
              <p className="test-card__subject">{item.subject}</p>
              <p className="test-card__meta">
                {item.questionCount} {t("questions", lang)} ·{" "}
                {item.durationMinutes} {t("minutes", lang)}
              </p>
              <p className="test-card__price">
                {item.isFree ? t("free", lang) : `${item.priceTenge} ₸`}
              </p>
              <p className="test-card__desc">{item.description}</p>
              <Link to={`/test/${item.id}`} className="test-card__cta">
                {t("startTest", lang)}
              </Link>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
