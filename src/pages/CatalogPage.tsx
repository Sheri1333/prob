import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { AnimatedNumber } from "../components/AnimatedNumber";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ThemeToggle } from "../components/ThemeToggle";
import { ToastHost, useToasts } from "../components/Toast";
import { translateSubject } from "../i18n/subjects";
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
  const [comboModalOpen, setComboModalOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const { toasts, push: toast, dismiss: dismissToast } = useToasts();

  useEffect(() => {
    api
      .getExamBlueprint()
      .then((bp) => setBlueprint(bp))
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Не удалось загрузить ЕНТ"),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>(".reveal");
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.15 },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const openFreePlan = () => {
    if (!user) {
      navigate("/login", { state: { from: "/", notice: "pricing" } });
      return;
    }
    if (!blueprint || !blueprint.ready) {
      toast(
        "error",
        lang === "kz"
          ? "Әзірге тесттер дайын емес"
          : "Тесты пока не готовы",
      );
      return;
    }
    setComboModalOpen(true);
  };

  const pickCombo = (comboId: string, ready: boolean) => {
    if (!ready) return;
    setComboModalOpen(false);
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
              <button
                type="button"
                className="link-btn"
                onClick={() => setConfirmLogout(true)}
              >
                Выйти
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="header-btn header-btn--ghost">
                Кіру
              </Link>
              <Link to="/register" className="header-btn header-btn--primary">
                Тіркелу
              </Link>
            </>
          )}
        </nav>
      </header>

      <section className="hero">
        <p>
          {lang === "kz"
            ? "Талапкер — Қазақстан оқушыларына арналған тегін онлайн платформа. Мұнда сіз ұлттық бірыңғай тестілеуді нақты форматта тапсырып көресіз, ал әр әрекеттен кейін балл мен қателерге толық талдау аласыз."
            : "Талапкер — бесплатная онлайн-платформа для подготовки школьников Казахстана к ЕНТ. Здесь можно пройти экзамен в реальном формате и сразу после попытки получить балл и разбор ошибок."}
        </p>
      </section>

      {loading && <p className="page">Загрузка...</p>}
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
          <button type="button" className="test-card__cta" onClick={resumeExam}>
            {lang === "kz" ? "Жалғастыру" : "Продолжить"}
          </button>
        </div>
      )}

      {comboModalOpen &&
        blueprint &&
        createPortal(
          <div
            className="combo-modal-overlay"
            onClick={() => setComboModalOpen(false)}
          >
            <div className="combo-modal" onClick={(e) => e.stopPropagation()}>
              <div className="combo-modal__head">
                <h3>
                  {lang === "kz"
                    ? "Бейіндік пәндерді таңдаңыз"
                    : "Выберите профильные предметы"}
                </h3>
                <button
                  type="button"
                  onClick={() => setComboModalOpen(false)}
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <div className="combo-modal__list">
                {blueprint.combinations.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    disabled={!c.ready}
                    className="combo-modal__item"
                    onClick={() => pickCombo(c.id, c.ready)}
                  >
                    <strong>{lang === "kz" ? c.labelKz : c.labelRu}</strong>
                    <span>
                      {translateSubject(c.subject1, lang)} +{" "}
                      {translateSubject(c.subject2, lang)}
                      {!c.ready
                        ? lang === "kz"
                          ? " · тест жоқ"
                          : " · нет теста"
                        : ""}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>,
          document.body,
        )}

      <section className="pricing">
        <h2 className="landing-section-title">Прайс</h2>
        <div className="pricing__grid">
          <div className="pricing-card reveal">
            <span className="pricing-card__badge">
              {lang === "kz" ? "Қазір қолжетімді" : "Доступно сейчас"}
            </span>
            <h3 className="pricing-card__name">
              {lang === "kz" ? "Тегін" : "Бесплатный"}
            </h3>
            <div className="pricing-card__price">0 ₸</div>
            <ul className="pricing-card__list">
              <li className="ok">
                <span className="material-symbols-outlined">check_circle</span>
                {lang === "kz" ? "Толық пробный ҰБТ" : "Полный пробный ЕНТ"}
              </li>
              <li className="ok">
                <span className="material-symbols-outlined">check_circle</span>
                {lang === "kz"
                  ? "Барлық бейіндік комбинациялар"
                  : "Все профильные комбинации"}
              </li>
              <li className="ok">
                <span className="material-symbols-outlined">check_circle</span>
                {lang === "kz"
                  ? "Жедел нәтиже және талдау"
                  : "Мгновенный результат и разбор"}
              </li>
              <li className="ok">
                <span className="material-symbols-outlined">check_circle</span>
                {lang === "kz"
                  ? "Калькулятор және Менделеев кестесі"
                  : "Калькулятор и таблица Менделеева"}
              </li>
              {blueprint && (
                <li className="ok">
                  <span className="material-symbols-outlined">check_circle</span>
                  {lang === "kz"
                    ? `Толық сессия — ${blueprint.durationMinutes} ${t("minutes", lang)}`
                    : `Полная сессия — ${blueprint.durationMinutes} ${t("minutes", lang)}`}
                </li>
              )}
            </ul>
            <button
              type="button"
              className="test-card__cta pricing-card__cta"
              onClick={openFreePlan}
            >
              {lang === "kz" ? "Пайдалану" : "Пользоваться"}
            </button>
          </div>

          <div className="pricing-card pricing-card--soon reveal">
            <span className="pricing-card__badge">
              {lang === "kz" ? "Жақында" : "Скоро"}
            </span>
            <h3 className="pricing-card__name">Premium</h3>
            <div className="pricing-card__price">
              —
              <small>
                {lang === "kz" ? " бағасы белгіленбеген" : " цена не определена"}
              </small>
            </div>
            <ul className="pricing-card__list">
              <li className="soon">
                <span className="material-symbols-outlined">schedule</span>
                {lang === "kz"
                  ? "Шектеусіз қайталау мүмкіндігі"
                  : "Безлимитные повторные попытки"}
              </li>
              <li className="soon">
                <span className="material-symbols-outlined">schedule</span>
                {lang === "kz"
                  ? "Толық статистика тарихы"
                  : "Расширенная статистика по истории"}
              </li>
              <li className="soon">
                <span className="material-symbols-outlined">schedule</span>
                {lang === "kz" ? "PDF есеп жүктеу" : "Экспорт результатов в PDF"}
              </li>
            </ul>
            <button
              type="button"
              className="test-card__cta pricing-card__cta"
              disabled
            >
              {lang === "kz" ? "Жақында қолжетімді болады" : "Скоро будет доступно"}
            </button>
          </div>
        </div>
      </section>

      <section className="landing-stats">
        <div className="landing-stat reveal">
          <strong>
            <AnimatedNumber value={10000} suffix="+" />
          </strong>
          <span>{lang === "kz" ? "оқушы" : "учеников"}</span>
        </div>
        <div className="landing-stat reveal">
          <strong>
            <AnimatedNumber value={500} suffix="+" />
          </strong>
          <span>{lang === "kz" ? "тест" : "тестов"}</span>
        </div>
        <div className="landing-stat reveal">
          <strong>
            <AnimatedNumber value={20000} suffix="+" />
          </strong>
          <span>{lang === "kz" ? "сұрақ" : "вопросов"}</span>
        </div>
        <div className="landing-stat reveal">
          <strong>24/7</strong>
          <span>{lang === "kz" ? "қолжетімділік" : "доступности"}</span>
        </div>
      </section>

      <section className="landing-features">
        <h2 className="landing-section-title">
          {lang === "kz" ? "Неге Талапкер?" : "Почему Талапкер"}
        </h2>
        <div className="landing-features__grid">
          <article className="landing-feature reveal">
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
          <article className="landing-feature reveal">
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
          <article className="landing-feature reveal">
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
          <article className="landing-feature reveal">
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

      <section className="landing-features">
        <h2 className="landing-section-title">
          {lang === "kz" ? "Қалай жұмыс істейді" : "Как это работает"}
        </h2>
        <div className="landing-features__grid landing-features__grid--wide">
          <article className="landing-feature reveal">
            <span className="material-symbols-outlined landing-feature__icon">
              checklist
            </span>
            <h3>{lang === "kz" ? "Пәндерді таңдаңыз" : "Выберите предметы"}</h3>
            <p>
              {lang === "kz"
                ? "Бейіндік пәндер жұбын белгілеңіз — тест автоматты түрде құрылады."
                : "Отметьте пару профильных предметов — тест соберётся автоматически."}
            </p>
          </article>
          <article className="landing-feature reveal">
            <span className="material-symbols-outlined landing-feature__icon">
              play_circle
            </span>
            <h3>{lang === "kz" ? "Тестті тапсырыңыз" : "Пройдите тест"}</h3>
            <p>
              {lang === "kz"
                ? "Нақты уақыт режимінде жауап беріңіз, қажет болса пәндер арасында ауысыңыз."
                : "Отвечайте в реальном времени, при необходимости переключайтесь между блоками."}
            </p>
          </article>
          <article className="landing-feature reveal">
            <span className="material-symbols-outlined landing-feature__icon">
              leaderboard
            </span>
            <h3>{lang === "kz" ? "Нәтижені көріңіз" : "Получите результат"}</h3>
            <p>
              {lang === "kz"
                ? "Балл, дұрыс жауаптар пайызы және ҰБТ шкаласы бойынша баға бірден қолжетімді."
                : "Балл, процент верных ответов и оценка по шкале ЕНТ — сразу на экране."}
            </p>
          </article>
          <article className="landing-feature reveal">
            <span className="material-symbols-outlined landing-feature__icon">
              laptop_mac
            </span>
            <h3>{lang === "kz" ? "Тек браузер керек" : "Нужен только браузер"}</h3>
            <p>
              {lang === "kz"
                ? "Ешнәрсе орнатудың қажеті жоқ — сайтқа кез келген құрылғыдан кіріп, дайындықты бастай беріңіз."
                : "Ничего не нужно устанавливать — открывайте сайт с любого устройства и начинайте готовиться."}
            </p>
          </article>
          <article className="landing-feature reveal">
            <span className="material-symbols-outlined landing-feature__icon">
              block
            </span>
            <h3>{lang === "kz" ? "Жарнамасыз" : "Без рекламы"}</h3>
            <p>
              {lang === "kz"
                ? "Назарыңызды бөлетін баннерлер мен қалқымалы терезелер жоқ — тек дайындыққа арналған кеңістік."
                : "Никаких баннеров и всплывающих окон — только чистое пространство для подготовки."}
            </p>
          </article>
          <article className="landing-feature reveal">
            <span className="material-symbols-outlined landing-feature__icon">
              cloud_done
            </span>
            <h3>{lang === "kz" ? "Прогресс жоғалмайды" : "Прогресс не теряется"}</h3>
            <p>
              {lang === "kz"
                ? "Жауаптарыңыз құрылғыда автоматты сақталады — бетті жаңартсаңыз да жұмысыңыз жоғалмайды."
                : "Ваши ответы автоматически сохраняются на устройстве — обновление страницы не сотрёт прогресс."}
            </p>
          </article>
        </div>
      </section>

      {confirmLogout && (
        <ConfirmDialog
          title={lang === "kz" ? "Аккаунттан шығу" : "Выйти из аккаунта"}
          message={
            lang === "kz"
              ? "Аккаунттан шыққыңыз келетініне сенімдісіз бе?"
              : "Вы уверены, что хотите выйти из аккаунта?"
          }
          confirmLabel={lang === "kz" ? "Шығу" : "Выйти"}
          cancelLabel={lang === "kz" ? "Болдырмау" : "Отмена"}
          danger
          onCancel={() => setConfirmLogout(false)}
          onConfirm={() => {
            setConfirmLogout(false);
            logout();
          }}
        />
      )}

      <ToastHost toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
