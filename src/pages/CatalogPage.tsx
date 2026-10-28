import { Link, useLocation, useNavigate } from "react-router-dom";
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

export function CatalogPage({ lang, onToggleLang }: CatalogPageProps) {
  useDocumentTitle();
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState("");
  const [blueprint, setBlueprint] = useState<Awaited<
    ReturnType<typeof api.getExamBlueprint>
  > | null>(null);
  // Null until /pricing answers, so stale hard-coded prices never flash.
  const [pricingData, setPricing] = useState<EntPricing | null>(null);
  const pricing = pricingData ?? {
    singlePriceTenge: 0,
    bundlePriceTenge: 0,
  };
  // Paid ENT sessions left; null until known (or when signed out).
  const [balance, setBalance] = useState<{ credits: number; unlimited: boolean } | null>(
    null,
  );
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

  // Links such as "/#plans" from the exam and payment pages land on the plans.
  useEffect(() => {
    if (location.hash === "#plans") {
      document.getElementById("plans")?.scrollIntoView();
    }
  }, [location.hash]);

  useEffect(() => {
    if (!user) {
      setBalance(null);
      return;
    }
    let cancelled = false;
    api
      .myPayments()
      .then(({ credits, unlimited }) => {
        if (!cancelled) setBalance({ credits, unlimited });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [user]);

  const canStart = !!balance && (balance.unlimited || balance.credits > 0);

  const openStart = () => {
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
    if (!canStart) {
      scrollToPlans();
      return;
    }
    setComboModalOpen(true);
  };

  const pickCombo = (comboId: string, ready: boolean) => {
    if (!ready) return;
    setComboModalOpen(false);
    navigate(`/exam?combo=${encodeURIComponent(comboId)}`);
  };

  const buy = (plan: "single" | "bundle") => {
    if (!user) {
      navigate("/login", { state: { from: `/pay/${plan}`, notice: "pricing" } });
      return;
    }
    navigate(`/pay/${plan}`);
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
              <Link to="/cabinet">{kz ? "Жеке кабинет" : "Личный кабинет"}</Link>
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
          {canStart ? (
            <>
              <button type="button" className="v2-btn" onClick={openStart}>
                {kz ? "ҰБТ бастау" : "Начать ЕНТ"}
              </button>
              {balance && !balance.unlimited && (
                <span className="v2-hero__note">
                  {kz
                    ? `Төленген ҰБТ: ${balance.credits}`
                    : `Оплачено ЕНТ: ${balance.credits}`}
                </span>
              )}
            </>
          ) : (
            <>
              <button type="button" className="v2-btn" onClick={scrollToPlans}>
                {kz ? "Тарифті таңдау" : "Выбрать тариф"}
              </button>
              <span className="v2-hero__note">
                {kz ? "Kaspi арқылы төлем" : "Оплата через Kaspi"}
              </span>
            </>
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

        <ul className="hero-stats">
          {[
            {
              icon: "menu_book",
              value: "5",
              label: kz ? "пән бір сессияда" : "предметов за сессию",
            },
            {
              icon: "workspace_premium",
              value: "140",
              label: kz ? "максимал балл" : "максимальный балл",
            },
            {
              icon: "timer",
              value: String(sessionMinutes),
              label: kz ? "минут уақыт" : "минут на тест",
            },
            {
              icon: "call_split",
              value: String(comboCount),
              label: kz ? "бейіндік комбинация" : "профильных комбинаций",
            },
          ].map((item) => (
            <li key={item.icon} className="hero-stats__item">
              <span className="hero-stats__icon material-symbols-outlined" aria-hidden="true">
                {item.icon}
              </span>
              <span className="hero-stats__text">
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </span>
            </li>
          ))}
        </ul>
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
        <p className="v2-section__intro">
          {kz
            ? "Kaspi QR арқылы төлейсіз. Төлем тексерілген соң ҰБТ жеке кабинетіңізге қосылады."
            : "Оплата через Kaspi QR. После проверки оплаты ЕНТ появятся в личном кабинете."}
        </p>
        <ul className="plans">
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
              onClick={() => buy("single")}
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
            <button type="button" className="v2-btn" onClick={() => buy("bundle")}>
              {kz ? "Сатып алу" : "Купить"}
            </button>
          </li>
        </ul>
      </section>

      <section className="v2-section">
        <h2>{kz ? "Қалай өтеді" : "Как это проходит"}</h2>
        <ol className="steps">
          <li>
            <h3>{kz ? "Тарифті төлеңіз" : "Оплатите тариф"}</h3>
            <p>
              {kz
                ? "Kaspi QR арқылы төлеп, сайтта «Төлеу» батырмасын басыңыз."
                : "Оплатите через Kaspi QR и нажмите на сайте «Оплатить»."}
            </p>
          </li>
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
