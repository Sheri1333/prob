import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { Lang } from "../i18n/strings";
import { t } from "../i18n/strings";
import { loadExamDraft } from "../utils/examDraft";

interface CatalogPageProps {
  lang: Lang;
}

export function CatalogPage({ lang }: CatalogPageProps) {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [blueprint, setBlueprint] = useState<Awaited<
    ReturnType<typeof api.getExamBlueprint>
  > | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    api
      .getExamBlueprint()
      .then(setBlueprint)
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Не удалось загрузить ЕНТ"),
      )
      .finally(() => setLoading(false));
  }, []);

  const toggleProfile = (key: string) => {
    setSelected((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key);
      if (prev.length >= 2) return [prev[1], key];
      return [...prev, key];
    });
  };

  const startEnt = () => {
    if (!blueprint || selected.length !== 2) return;
    setStarting(true);
    const q = selected
      .map((s) => `profile=${encodeURIComponent(s)}`)
      .join("&");
    navigate(`/exam?${q}`);
  };

  const resume = loadExamDraft();

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

      <section className="catalog catalog--ent">
        <h2>{lang === "kz" ? "Пробный ЕНТ" : "Пробный ЕНТ"}</h2>
        <p className="catalog__lead">
          {lang === "kz"
            ? "Толық ҰБТ сессиясы: міндетті блоктар + 2 бейіндік пән. Нұсқалар қайталанбайды."
            : "Полная сессия ЕНТ: обязательные блоки + 2 профильных предмета. Варианты не повторяются."}
        </p>

        {loading && <p>Загрузка...</p>}
        {error && (
          <p className="auth-card__error">
            {error}. Запустите API: <code>npm run server</code>
          </p>
        )}

        {resume && (
          <div className="ent-resume">
            <p>
              {lang === "kz"
                ? "Аяқталмаған сессия бар"
                : "Есть незавершённая сессия"}
            </p>
            <button
              type="button"
              className="test-card__cta"
              onClick={() => navigate("/exam")}
            >
              {lang === "kz" ? "Жалғастыру" : "Продолжить"}
            </button>
          </div>
        )}

        {blueprint && (
          <>
            <div className="ent-blocks">
              <h3>{lang === "kz" ? "Міндетті блоктар" : "Обязательные блоки"}</h3>
              <ul className="ent-blocks__list">
                {blueprint.mandatory.map((m) => (
                  <li key={m.key} className={m.ready ? "" : "is-missing"}>
                    <strong>{lang === "kz" ? m.label.kz : m.label.ru}</strong>
                    <span>
                      {m.variantCount}{" "}
                      {lang === "kz" ? "нұсқа" : "вариант(ов)"}
                      {!m.ready &&
                        (lang === "kz"
                          ? " — тест жоқ"
                          : " — нет теста")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="ent-profile">
              <h3>
                {lang === "kz"
                  ? "Бейіндік пәндер (2 таңдаңыз)"
                  : "Профильные предметы (выберите 2)"}
              </h3>
              {blueprint.profileSubjects.length === 0 ? (
                <p className="catalog__hint">
                  {lang === "kz"
                    ? "Әкімшілікте бейіндік пәндер бойынша тесттер қосыңыз (тарих/сауаттылықтан басқа)."
                    : "Добавьте в админке тесты по профильным предметам (кроме истории/грамотности)."}
                </p>
              ) : (
                <div className="ent-profile__grid">
                  {blueprint.profileSubjects.map((p) => {
                    const on = selected.includes(p.key);
                    return (
                      <button
                        key={p.key}
                        type="button"
                        className={`ent-profile__chip ${on ? "active" : ""}`}
                        onClick={() => toggleProfile(p.key)}
                      >
                        {p.subject}
                        <small>
                          {p.variantCount}{" "}
                          {lang === "kz" ? "нұсқа" : "вар."}
                        </small>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              type="button"
              className="test-card__cta ent-start"
              disabled={
                starting ||
                !blueprint.ready ||
                selected.length !== blueprint.profileCount
              }
              onClick={startEnt}
            >
              {starting
                ? "..."
                : lang === "kz"
                  ? "ҰБТ бастау"
                  : "Начать ЕНТ"}
              {" · "}
              {blueprint.durationMinutes} {t("minutes", lang)}
            </button>
          </>
        )}
      </section>
    </div>
  );
}
