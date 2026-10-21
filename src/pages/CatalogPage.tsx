import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { api, type EntPricing } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { SiteFooter } from "../components/SiteFooter";
import { ThemeToggle } from "../components/ThemeToggle";
import { ToastHost, useToasts } from "../components/Toast";
import { translateSubject } from "../i18n/subjects";
import type { Lang } from "../i18n/strings";
import { loadExamDraft } from "../utils/examDraft";
import { useDocumentTitle } from "../utils/useDocumentTitle";
import "../styles/home.css";

interface CatalogPageProps {
  lang: Lang;
  onToggleLang: () => void;
}

/** Official ҰБТ point split: 20 + 10 + 10 + 50 + 50 = 140. */
const ENT_BLOCKS = [
  { points: 20, profile: false, kz: "Қазақстан тарихы", ru: "История Казахстана" },
  { points: 10, profile: false, kz: "Оқу сауаттылығы", ru: "Грамотность чтения" },
  { points: 10, profile: false, kz: "Математикалық сауаттылық", ru: "Математическая грамотность" },
  { points: 50, profile: true, kz: "1-бейіндік пән", ru: "Профильный предмет 1" },
  { points: 50, profile: true, kz: "2-бейіндік пән", ru: "Профильный предмет 2" },
];

export function CatalogPage({ lang, onToggleLang }: CatalogPageProps) {
  useDocumentTitle();
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [blueprint, setBlueprint] = useState<Awaited<
    ReturnType<typeof api.getExamBlueprint>
  > | null>(null);
  // Null until /pricing answers, so stale hard-coded prices never flash.
  const [pricingData, setPricing] = useState<EntPricing | null>(null);
  const pricing = pricingData ?? {
    trialEnabled: true,
    singlePriceTenge: 0,
    bundlePriceTenge: 0,
  };
  const [comboModalOpen, setComboModalOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(
    () => loadExamDraft()?.sessionId ?? null,
  );
  const { toasts, push: toast, dismiss: dismissToast } = useToasts();

  useEffect(() => {
    let cancelled = false;
    api
      .getExamBlueprint()
      .then((bp) => {
        if (!cancelled) setBlueprint(bp);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : "Не удалось загрузить ЕНТ",
          );
        }
      });
    api
      .getPricing()
      .then((p) => {
        if (!cancelled) setPricing(p);
      })
      .catch(() => undefined);
    api
      .examActive()
      .then(({ session }) => {
        if (!cancelled) setActiveSessionId(session?.sessionId ?? null);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const openFreePlan = () => {
    if (!user) {
      navigate("/login", { state: { from: "/", notice: "pricing" } });
      return;
    }
    if (!blueprint) return;
    if (!blueprint.ready) {
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

  const buySoon = () => {
    if (!user) {
      navigate("/login", { state: { from: "/", notice: "pricing" } });
      return;
    }
    toast(
      "ok",
      lang === "kz"
        ? "Төлем жақында қосылады"
        : "Оплата скоро подключится",
    );
  };

  const resumeExam = () => {
    if (!user) {
      navigate("/login", { state: { from: "/exam" } });
      return;
    }
    navigate(activeSessionId ? `/exam/${activeSessionId}` : "/exam");
  };

  const scrollToPlans = () => {
    document.getElementById("plans")?.scrollIntoView({ behavior: "smooth" });
  };

  const kz = lang === "kz";
  const sessionMinutes = blueprint?.durationMinutes ?? 240;
  const comboCount = blueprint?.combinations.length ?? 17;
  const bundleSavings = Math.max(
    0,
    pricing.singlePriceTenge * 3 - pricing.bundlePriceTenge,
  );
  const formatTenge = (n: number) =>
    pricingData ? `${n.toLocaleString("ru-RU")} ₸` : "… ₸";

  return (
    <div className="page v2">
      <header className="v2-header">
        <div className="site-header__brand">
          <div className="site-header__logo">Талапкер</div>
          <ThemeToggle />
        </div>
        <nav className="v2-nav">
          <button
            type="button"
            className="v2-nav__lang"
            onClick={onToggleLang}
            aria-label={kz ? "Тілді ауыстыру" : "Сменить язык"}
          >
            {kz ? "Рус" : "Қаз"}
          </button>
          {user ? (
            <>
              {isAdmin && (
                <Link to="/admin">{kz ? "Әкімші" : "Админка"}</Link>
              )}
              <Link to="/profile">{user.name}</Link>
              <button type="button" onClick={() => setConfirmLogout(true)}>
                {kz ? "Шығу" : "Выйти"}
              </button>
            </>
          ) : (
            <>
              <Link to="/login">{kz ? "Кіру" : "Войти"}</Link>
              <Link to="/register" className="v2-nav__primary">
                {kz ? "Тіркелу" : "Регистрация"}
              </Link>
            </>
          )}
        </nav>
      </header>

      <section className="v2-hero">
        <h1>
          {user
            ? kz
              ? `Сәлем, ${user.name.split(/\s+/)[0]}!`
              : `Привет, ${user.name.split(/\s+/)[0]}!`
            : kz
              ? "ҰБТ-ға онлайн дайындық"
              : "Онлайн-подготовка к ЕНТ"}
        </h1>
        <p className="v2-hero__lead">
          {kz
            ? "Толық ҰБТ-ны үйде тапсырып, нағыз емтиханға дейін балыңды біліп ал."
            : "Пройдите полный ЕНТ дома и узнайте свой балл до настоящего экзамена."}
        </p>
        <div className="v2-hero__actions">
          {pricing.trialEnabled ? (
            <>
              <button type="button" className="v2-btn" onClick={openFreePlan}>
                {kz ? "Тегін ҰБТ тапсыру" : "Пройти ЕНТ бесплатно"}
              </button>
              <span className="v2-hero__note">
                {kz ? "Бір рет, төлемсіз" : "Один раз, без оплаты"}
              </span>
            </>
          ) : (
            <button type="button" className="v2-btn" onClick={scrollToPlans}>
              {kz ? "Тарифті таңдау" : "Выбрать тариф"}
            </button>
          )}
        </div>

        {activeSessionId && (
          <div className="v2-resume">
            <p>
              {kz
                ? "Сізде аяқталмаған ҰБТ бар."
                : "У вас есть незавершённый ЕНТ."}
            </p>
            <button
              type="button"
              className="v2-btn v2-btn--quiet"
              onClick={resumeExam}
            >
              {kz ? "Жалғастыру" : "Продолжить"}
            </button>
          </div>
        )}

        {error && (
          <p className="v2-error" style={{ marginTop: "1.5rem" }}>
            {kz
              ? "Сервер уақытша қолжетімсіз. Бірнеше минуттан кейін бетті жаңартыңыз."
              : "Сервер временно недоступен. Обновите страницу через пару минут."}
          </p>
        )}

        <figure className="ent-scale">
          <figcaption className="ent-scale__caption">
            {kz ? (
              <>
                <strong>Сынақ нағыз ҰБТ-мен бірдей:</strong> 5 пән, 140 балл,{" "}
                {sessionMinutes} минут.
              </>
            ) : (
              <>
                <strong>Пробник устроен как настоящий ЕНТ:</strong> 5 предметов,
                140 баллов, {sessionMinutes} минут.
              </>
            )}
          </figcaption>
          <div className="ent-scale__bar" aria-hidden="true">
            {ENT_BLOCKS.map((b) => (
              <div
                key={b.ru}
                className={`ent-scale__seg${b.profile ? " ent-scale__seg--profile" : ""}`}
                style={{ flexGrow: b.points }}
                title={`${kz ? b.kz : b.ru}: ${b.points}`}
              >
                {b.points}
              </div>
            ))}
          </div>
          <div className="ent-scale__ticks" aria-hidden="true">
            <span>0</span>
            <span>140</span>
          </div>
          <div className="ent-scale__key">
            <div className="ent-scale__group">
              <h3>{kz ? "Міндетті пәндер, 40 балл" : "Обязательные, 40 баллов"}</h3>
              <ul>
                {ENT_BLOCKS.filter((b) => !b.profile).map((b) => (
                  <li key={b.ru}>
                    {kz ? b.kz : b.ru}, {b.points}
                  </li>
                ))}
              </ul>
            </div>
            <div className="ent-scale__group ent-scale__group--profile">
              <h3>{kz ? "Бейіндік пәндер, 100 балл" : "Профильные, 100 баллов"}</h3>
              <p>
                {kz
                  ? `Екі пән, әрқайсысы 50 балл. ${comboCount} комбинацияның кез келгенін таңдауға болады.`
                  : `Два предмета по 50 баллов. Можно выбрать любую из ${comboCount} комбинаций.`}
              </p>
            </div>
          </div>
        </figure>
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
                  {kz
                    ? "Бейіндік пәндерді таңдаңыз"
                    : "Выберите профильные предметы"}
                </h3>
                <button
                  type="button"
                  aria-label={kz ? "Жабу" : "Закрыть"}
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
                    <strong>{kz ? c.labelKz : c.labelRu}</strong>
                    <span>
                      {translateSubject(c.subject1, lang)} +{" "}
                      {translateSubject(c.subject2, lang)}
                      {!c.ready ? (kz ? ", тест жоқ" : ", нет теста") : ""}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>,
          document.body,
        )}

      <section className="v2-section" id="plans">
        <h2>{kz ? "Тарифтер" : "Тарифы"}</h2>
        <ul className="plans">
          {pricing.trialEnabled && (
            <li className="plan">
              <h3 className="plan__name">
                {kz ? "Тегін сынақ" : "Бесплатный пробник"}
              </h3>
              <p className="plan__desc">
                {kz
                  ? "Толық ҰБТ бір рет, кез келген бейіндік комбинациямен."
                  : "Полный ЕНТ один раз, с любой профильной комбинацией."}
              </p>
              <span className="plan__price">0 ₸</span>
              <button
                type="button"
                className="v2-btn v2-btn--quiet"
                onClick={openFreePlan}
              >
                {kz ? "Бастау" : "Начать"}
              </button>
            </li>
          )}
          <li className="plan">
            <h3 className="plan__name">{kz ? "Толық ҰБТ" : "Полный ЕНТ"}</h3>
            <p className="plan__desc">
              {kz
                ? "Бір сессия. Соңында балл және әр қатенің талдауы."
                : "Одна сессия. В конце балл и разбор каждой ошибки."}
            </p>
            <span className="plan__price">
              {formatTenge(pricing.singlePriceTenge)}
            </span>
            <button
              type="button"
              className="v2-btn v2-btn--quiet"
              onClick={buySoon}
            >
              {kz ? "Сатып алу" : "Купить"}
            </button>
          </li>
          <li className="plan plan--best">
            <h3 className="plan__name">{kz ? "3 толық ҰБТ" : "3 полных ЕНТ"}</h3>
            <p className="plan__desc">
              {bundleSavings > 0 && (
                <strong>
                  {kz
                    ? `Жеке алғаннан ${formatTenge(bundleSavings)} арзан. `
                    : `На ${formatTenge(bundleSavings)} дешевле, чем по одному. `}
                </strong>
              )}
              {kz
                ? "Қайта тапсырып, балл қалай өскенін көріңіз."
                : "Пересдавайте и смотрите, как растёт балл."}
            </p>
            <span className="plan__price">
              {formatTenge(pricing.bundlePriceTenge)}
            </span>
            <button type="button" className="v2-btn" onClick={buySoon}>
              {kz ? "Сатып алу" : "Купить"}
            </button>
          </li>
        </ul>
      </section>

      <section className="v2-section">
        <h2>{kz ? "Қалай өтеді" : "Как это проходит"}</h2>
        <ol className="steps">
          <li>
            <h3>{kz ? "Пәндерді таңдаңыз" : "Выберите предметы"}</h3>
            <p>
              {kz
                ? "Екі бейіндік пәнді белгілеңіз, тест өзі құрылады."
                : "Отметьте два профильных предмета, и тест соберётся сам."}
            </p>
          </li>
          <li>
            <h3>{kz ? "Тестті тапсырыңыз" : "Пройдите тест"}</h3>
            <p>
              {kz
                ? `${sessionMinutes} минут бүкіл тестке. Пәндер арасында кез келген уақытта ауысуға болады.`
                : `${sessionMinutes} минут на весь тест. Между предметами можно переключаться в любой момент.`}
            </p>
          </li>
          <li>
            <h3>{kz ? "Нәтижені көріңіз" : "Смотрите результат"}</h3>
            <p>
              {kz
                ? "Балл әр пән бойынша бірден шығады, қателерді сол жерде талдайсыз."
                : "Балл по каждому предмету появится сразу, ошибки можно разобрать там же."}
            </p>
          </li>
        </ol>
      </section>

      <section className="v2-section">
        <h2>{kz ? "Тест кезінде" : "Во время теста"}</h2>
        <dl className="facts">
          <div>
            <dt>{kz ? "Калькулятор мен кестелер" : "Калькулятор и таблицы"}</dt>
            <dd>
              {kz
                ? "Калькулятор, Менделеев кестесі және ерігіштік кестесі қолыңыздың астында."
                : "Под рукой калькулятор, таблица Менделеева и таблица растворимости."}
            </dd>
          </div>
          <div>
            <dt>{kz ? "Жауаптар жоғалмайды" : "Ответы не теряются"}</dt>
            <dd>
              {kz
                ? "Жауаптар құрылғыда сақталады, бетті жаңартсаңыз да ештеңе өшпейді."
                : "Ответы сохраняются на устройстве, после обновления страницы всё останется на месте."}
            </dd>
          </div>
          <div>
            <dt>{kz ? "Тек браузер керек" : "Нужен только браузер"}</dt>
            <dd>
              {kz
                ? "Ештеңе орнатпайсыз: сайтты телефоннан не компьютерден ашасыз."
                : "Ставить ничего не нужно: откройте сайт с телефона или компьютера."}
            </dd>
          </div>
          <div>
            <dt>{kz ? "Жарнама жоқ" : "Без рекламы"}</dt>
            <dd>
              {kz
                ? "Баннерлер мен қалқымалы терезелер тестке кедергі жасамайды."
                : "Баннеры и всплывающие окна не мешают проходить тест."}
            </dd>
          </div>
        </dl>
      </section>

      <SiteFooter lang={lang} />

      {confirmLogout && (
        <ConfirmDialog
          title={kz ? "Аккаунттан шығу" : "Выйти из аккаунта"}
          message={
            kz
              ? "Аккаунттан шыққыңыз келетініне сенімдісіз бе?"
              : "Вы уверены, что хотите выйти из аккаунта?"
          }
          confirmLabel={kz ? "Шығу" : "Выйти"}
          cancelLabel={kz ? "Болдырмау" : "Отмена"}
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
