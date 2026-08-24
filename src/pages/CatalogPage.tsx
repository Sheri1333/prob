import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { ThemeToggle } from "../components/ThemeToggle";
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
    if (!user) {
      navigate("/login", { state: { from: `/exam?combo=${comboId}` } });
      return;
    }
    setStarting(true);
    navigate(`/exam?combo=${encodeURIComponent(comboId)}`);
  };

  const resumeExam = () => {
    if (!user) {
      navigate("/login", { state: { from: "/exam" } });
      return;
    }
    navigate("/exam");
  };

  const resume = loadExamDraft();

  return (
    <div className="page">
      <header className="site-header">
        <div className="site-header__logo">Талапкер</div>
        <nav className="site-header__nav">
          <ThemeToggle />
          {user ? (
            <>
              {isAdmin && <Link to="/admin">Админка</Link>}
              <Link to="/profile" className="site-header__user">
                {user.name}
              </Link>
              <button type="button" className="link-btn" onClick={logout}>
                Выйти
              </button>
            </>
          ) : (
            <>
              <Link to="/login">Кіру</Link>
              <Link to="/register" className="link-btn">
                Тіркелу
              </Link>
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
        <p className="hero__about">
          {lang === "kz"
            ? "Талапкер — Қазақстан оқушыларына арналған тегін онлайн платформа. Мұнда сіз ұлттық бірыңғай тестілеуді нақты форматта тапсырып көресіз, ал әр әрекеттен кейін балл мен қателерге толық талдау аласыз."
            : "Талапкер — бесплатная онлайн-платформа для подготовки школьников Казахстана к ЕНТ. Здесь можно пройти экзамен в реальном формате и сразу после попытки получить балл и разбор ошибок."}
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
              onClick={resumeExam}
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

      {blueprint && (
        <section className="landing-stats">
          <div className="landing-stat">
            <strong>{blueprint.durationMinutes}</strong>
            <span>{lang === "kz" ? "минут" : "минут на весь ЕНТ"}</span>
          </div>
          <div className="landing-stat">
            <strong>{blueprint.mandatory.length}</strong>
            <span>
              {lang === "kz" ? "міндетті блок" : "обязательных блока"}
            </span>
          </div>
          <div className="landing-stat">
            <strong>{blueprint.combinations.length}+</strong>
            <span>
              {lang === "kz" ? "бейіндік комбинация" : "профильных комбинаций"}
            </span>
          </div>
          <div className="landing-stat">
            <strong>3</strong>
            <span>
              {lang === "kz" ? "сұрақ форматы" : "формата вопросов"}
            </span>
          </div>
        </section>
      )}

      <section className="landing-features">
        <h2 className="landing-section-title">
          {lang === "kz" ? "Неге Талапкер?" : "Почему Талапкер"}
        </h2>
        <div className="landing-features__grid">
          <article className="landing-feature">
            <span className="material-symbols-outlined landing-feature__icon">
              quiz
            </span>
            <h3>{lang === "kz" ? "Толық ҰБТ форматы" : "Полный формат ЕНТ"}</h3>
            <p>
              {lang === "kz"
                ? "Міндетті блоктар мен бейіндік пәндер бір сессияда — нақты емтихандағыдай."
                : "Обязательные блоки и профильные предметы в одной сессии — как на настоящем экзамене."}
            </p>
          </article>
          <article className="landing-feature">
            <span className="material-symbols-outlined landing-feature__icon">
              timer
            </span>
            <h3>{lang === "kz" ? "Нақты таймер" : "Настоящий таймер"}</h3>
            <p>
              {lang === "kz"
                ? "Уақыт кері санала бастайды, ал пәндер арасында прогресті жоғалтпай ауысасыз."
                : "Обратный отсчёт по всему тесту и переключение между предметами без потери прогресса."}
            </p>
          </article>
          <article className="landing-feature">
            <span className="material-symbols-outlined landing-feature__icon">
              calculate
            </span>
            <h3>
              {lang === "kz" ? "Кірістірілген құралдар" : "Встроенные инструменты"}
            </h3>
            <p>
              {lang === "kz"
                ? "Калькулятор және толық Менделеев кестесі тест барысында қолжетімді."
                : "Калькулятор и полная таблица Менделеева прямо во время теста."}
            </p>
          </article>
          <article className="landing-feature">
            <span className="material-symbols-outlined landing-feature__icon">
              fact_check
            </span>
            <h3>{lang === "kz" ? "Жедел нәтиже" : "Мгновенный результат"}</h3>
            <p>
              {lang === "kz"
                ? "Тестті аяқтаған соң балл мен ҰБТ шкаласы бойынша баға бірден шығады."
                : "Балл и оценка по шкале ЕНТ — сразу после завершения теста."}
            </p>
          </article>
        </div>
      </section>

      <section className="landing-steps">
        <h2 className="landing-section-title">
          {lang === "kz" ? "Қалай жұмыс істейді" : "Как это работает"}
        </h2>
        <div className="landing-steps__grid">
          <article className="landing-step">
            <span className="landing-step__num">1</span>
            <h3>{lang === "kz" ? "Пәндерді таңдаңыз" : "Выберите предметы"}</h3>
            <p>
              {lang === "kz"
                ? "Бейіндік пәндер жұбын белгілеңіз — тест автоматты түрде құрылады."
                : "Отметьте пару профильных предметов — тест соберётся автоматически."}
            </p>
          </article>
          <article className="landing-step">
            <span className="landing-step__num">2</span>
            <h3>{lang === "kz" ? "Тестті тапсырыңыз" : "Пройдите тест"}</h3>
            <p>
              {lang === "kz"
                ? "Нақты уақыт режимінде жауап беріңіз, қажет болса пәндер арасында ауысыңыз."
                : "Отвечайте в реальном времени, при необходимости переключайтесь между блоками."}
            </p>
          </article>
          <article className="landing-step">
            <span className="landing-step__num">3</span>
            <h3>{lang === "kz" ? "Нәтижені көріңіз" : "Получите результат"}</h3>
            <p>
              {lang === "kz"
                ? "Балл, дұрыс жауаптар пайызы және ҰБТ шкаласы бойынша баға бірден қолжетімді."
                : "Балл, процент верных ответов и оценка по шкале ЕНТ — сразу на экране."}
            </p>
          </article>
        </div>
      </section>
    </div>
  );
}
