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
  const [comboId, setComboId] = useState("");
  const [starting, setStarting] = useState(false);
  const [comboModalOpen, setComboModalOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const { toasts, push: toast, dismiss: dismissToast } = useToasts();

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

  const choosePlan = () => {
    if (!user) {
      navigate("/login", { state: { from: "/", notice: "pricing" } });
      return;
    }
    toast(
      "ok",
      lang === "kz"
        ? "Төлем жүйесі жақында қосылады"
        : "Оплата пока недоступна — скоро подключим",
    );
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

      <section className="impact-stats">
        <div className="impact-stat">
          <strong>
            <AnimatedNumber value={10000} suffix="+" />
          </strong>
          <span>{lang === "kz" ? "оқушы" : "учеников"}</span>
        </div>
        <div className="impact-stat">
          <strong>
            <AnimatedNumber value={500} suffix="+" />
          </strong>
          <span>{lang === "kz" ? "тест" : "тестов"}</span>
        </div>
        <div className="impact-stat">
          <strong>
            <AnimatedNumber value={20000} suffix="+" />
          </strong>
          <span>{lang === "kz" ? "сұрақ" : "вопросов"}</span>
        </div>
        <div className="impact-stat">
          <strong>24/7</strong>
          <span>{lang === "kz" ? "қолжетімділік" : "доступности"}</span>
        </div>
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
              <button
                type="button"
                className="ent-combo-card"
                onClick={() => setComboModalOpen(true)}
              >
                <div className="ent-combo-card__text">
                  <strong>
                    {selected
                      ? lang === "kz"
                        ? selected.labelKz
                        : selected.labelRu
                      : lang === "kz"
                        ? "Комбинацияны таңдаңыз"
                        : "Выберите комбинацию"}
                  </strong>
                  {selected && (
                    <span>
                      {selected.ready
                        ? lang === "kz"
                          ? `Пәндер: ${translateSubject(selected.subject1, lang)} + ${translateSubject(selected.subject2, lang)}`
                          : `Предметы: ${selected.subject1} + ${selected.subject2}`
                        : lang === "kz"
                          ? "Бұл комбинация үшін админкада тесттер жоқ"
                          : "Для этой комбинации ещё нет тестов в админке"}
                    </span>
                  )}
                </div>
                <span className="material-symbols-outlined">tune</span>
              </button>
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
                    className={`combo-modal__item ${c.id === comboId ? "active" : ""}`}
                    onClick={() => {
                      setComboId(c.id);
                      setComboModalOpen(false);
                    }}
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

      <section className="landing-features">
        <h2 className="landing-section-title">
          {lang === "kz" ? "Тағы неге ыңғайлы" : "Ещё несколько причин"}
        </h2>
        <div className="landing-features__grid">
          <article className="landing-feature">
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
          <article className="landing-feature">
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
          <article className="landing-feature">
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

      <section className="pricing">
        <h2 className="landing-section-title">
          {lang === "kz" ? "Тарифтер" : "Тарифы"}
        </h2>
        <div className="pricing__grid">
          <div className="pricing-card">
            <span className="pricing-card__badge">
              {lang === "kz" ? "Қазір қолжетімді" : "Доступно сейчас"}
            </span>
            <h3 className="pricing-card__name">
              {lang === "kz" ? "Тегін" : "Бесплатный"}
            </h3>
            <div className="pricing-card__price">
              0 ₸<small>{lang === "kz" ? " / әрдайым" : " / навсегда"}</small>
            </div>
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
            </ul>
            <button
              type="button"
              className="test-card__cta pricing-card__cta"
              onClick={choosePlan}
            >
              {lang === "kz" ? "Пайдалану" : "Пользоваться"}
            </button>
          </div>

          <div className="pricing-card pricing-card--soon">
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
