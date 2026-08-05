import { Link } from "react-router-dom";
import type { Lang } from "../i18n/strings";
import { t } from "../i18n/strings";
import { catalog } from "../data/catalog";

interface CatalogPageProps {
  lang: Lang;
}

export function CatalogPage({ lang }: CatalogPageProps) {
  return (
    <div className="page">
      <header className="site-header">
        <div className="site-header__logo">PROB</div>
        <nav className="site-header__nav">
          <span>{t("catalog", lang)}</span>
        </nav>
      </header>

      <section className="hero">
        <h1>{t("heroTitle", lang)}</h1>
        <p>{t("heroSubtitle", lang)}</p>
      </section>

      <section className="catalog">
        <h2>{t("catalog", lang)}</h2>
        <div className="catalog-grid">
          {catalog.map((item) => (
            <article key={item.id} className="test-card">
              <div className="test-card__badge">{item.examType}</div>
              <h3>{lang === "kz" ? item.titleKz : item.title}</h3>
              <p className="test-card__subject">{item.subject}</p>
              <p className="test-card__meta">
                {item.questionCount} {t("questions", lang)} ·{" "}
                {item.durationMinutes} {t("minutes", lang)}
              </p>
              <p className="test-card__price">
                {item.isFree
                  ? t("free", lang)
                  : `${item.priceTenge} ₸`}
              </p>
              <p className="test-card__desc">{item.description}</p>
              {item.id === "ent-geography" || item.isFree ? (
                <Link to={`/test/${item.id}`} className="test-card__cta">
                  {t("startTest", lang)}
                </Link>
              ) : (
                <button type="button" className="test-card__cta test-card__cta--disabled" disabled>
                  {item.priceTenge} ₸
                </button>
              )}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
