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
  const [comboId, setComboId] = useState("");
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    api
      .getExamBlueprint()
      .then((bp) => {
        setBlueprint(bp);
        const firstReady = bp.combinations.find((c) => c.ready);
        if (firstReady) setComboId(firstReady.id);
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Не удалось загрузить ЕНТ"),
      )
      .finally(() => setLoading(false));
  }, []);

  const selected = blueprint?.combinations.find((c) => c.id === comboId);

  const startEnt = () => {
    if (!blueprint || !comboId || !selected?.ready) return;
    setStarting(true);
    navigate(`/exam?combo=${encodeURIComponent(comboId)}`);
  };

  const resume = loadExamDraft();

  return (
    <div className="page">
      <header className="site-header">
        <div className="site-header__logo">Талапкер</div>
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

      <section className="hero">
        <h1>
          {lang === "kz" ? "Ұлттық бірыңғай тестілеуге дайында" : "Готовься к ЕНТ по-настоящему"}
        </h1>
        <p>
          {lang === "kz"
            ? "Бейіндік пәндер жұбын таңдаңыз — толық пробный ҰБТ беріледі: нақты уақыт, нақты сұрақтар, нақты нәтиже."
            : "Выберите пару профильных предметов — получите полный пробный ЕНТ: настоящий таймер, настоящие вопросы, честный результат."}
        </p>
      </section>

      <section className="catalog catalog--ent">
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
                      {m.ready
                        ? lang === "kz"
                          ? "дайын"
                          : "готово"
                        : lang === "kz"
                          ? "тест жоқ"
                          : "нет теста"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="ent-profile">
              <h3>
                {lang === "kz" ? "Бейіндік пәндер" : "Профильные предметы"}
              </h3>
              <label className="ent-combo">
                <span className="ent-combo__label">
                  {lang === "kz" ? "Комбинацияны таңдаңыз" : "Выберите комбинацию"}
                </span>
                <select
                  className="ent-combo__select"
                  value={comboId}
                  onChange={(e) => setComboId(e.target.value)}
                >
                  <option value="" disabled>
                    {lang === "kz" ? "Бейіндік пәндер" : "Профильные предметы"}
                  </option>
                  {blueprint.combinations.map((c) => (
                    <option key={c.id} value={c.id} disabled={!c.ready}>
                      {lang === "kz" ? c.labelKz : c.labelRu}
                      {!c.ready
                        ? lang === "kz"
                          ? " (тест жоқ)"
                          : " (нет теста)"
                        : ""}
                    </option>
                  ))}
                </select>
              </label>
              {selected && (
                <p className="catalog__hint">
                  {selected.ready
                    ? lang === "kz"
                      ? `Пәндер: ${selected.subject1} + ${selected.subject2}`
                      : `Предметы: ${selected.subject1} + ${selected.subject2}`
                    : lang === "kz"
                      ? "Бұл комбинация үшін админкада тесттер жоқ"
                      : "Для этой комбинации ещё нет тестов в админке"}
                </p>
              )}
            </div>

            <button
              type="button"
              className="test-card__cta ent-start"
              disabled={
                starting ||
                !blueprint.ready ||
                !comboId ||
                !selected?.ready
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
