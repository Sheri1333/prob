import { useEffect, useState, type FormEvent, type MouseEvent } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import {
  api,
  KASPI_PAY_URL,
  type EntPricing,
  type PaymentAttempt,
  type PaymentPlan,
} from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { SiteHeader } from "../components/SiteHeader";
import type { Lang } from "../i18n/strings";
import { useDocumentTitle } from "../utils/useDocumentTitle";
import "../styles/home.css";

interface PaymentPageProps {
  lang: Lang;
  onToggleLang: () => void;
}

const PLAN_TITLE = {
  single: { kz: "Толық ҰБТ", ru: "Полный ЕНТ" },
  bundle: { kz: "3 толық ҰБТ", ru: "3 полных ЕНТ" },
} as const;

function isPlan(value: string | undefined): value is PaymentPlan {
  return value === "single" || value === "bundle";
}

function cleanName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function waitingKey(plan: PaymentPlan): string {
  return `talapker_pay_waiting_${plan}`;
}

/**
 * Student presses pay, Kaspi opens, and we show a short waiting screen while
 * an admin confirms the transfer in Telegram.
 */
export function PaymentPage({ lang, onToggleLang }: PaymentPageProps) {
  const kz = lang === "kz";
  useDocumentTitle(kz ? "Kaspi арқылы төлеу" : "Оплата через Kaspi");
  const { plan } = useParams<{ plan: string }>();
  const { user, loading } = useAuth();
  const [pricing, setPricing] = useState<EntPricing | null>(null);
  const [attempt, setAttempt] = useState<PaymentAttempt | null>(null);
  const [payerName, setPayerName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .getPricing()
      .then(setPricing)
      .catch(() => setError(kz ? "Бағаны жүктеу мүмкін болмады." : "Не удалось загрузить цену."));
  }, [kz]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (user && !payerName) setPayerName(user.name);
  }, [user, payerName]);

  useEffect(() => {
    if (!user || !isPlan(plan)) return;
    let gone = false;
    if (sessionStorage.getItem(waitingKey(plan))) {
      setBusy(true);
    }
    api
      .pendingPayment(plan)
      .then(({ attempt: row }) => {
        if (gone) return;
        if (row) {
          setAttempt(row);
          sessionStorage.removeItem(waitingKey(plan));
        } else {
          sessionStorage.removeItem(waitingKey(plan));
          setBusy(false);
        }
      })
      .catch(() => {
        if (!gone) setBusy(false);
      });
    return () => {
      gone = true;
    };
  }, [user, plan]);

  useEffect(() => {
    if (!attempt || attempt.status !== "pending" || !isPlan(plan)) return;
    const token = attempt.token;
    const timer = window.setInterval(() => {
      api
        .paymentAttempt(token)
        .then((row) => {
          setAttempt(row);
          if (row.status !== "pending") sessionStorage.removeItem(waitingKey(plan));
        })
        .catch(() => undefined);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [attempt?.token, attempt?.status, plan]);

  if (!isPlan(plan)) return <Navigate to="/#plans" replace />;
  if (loading) return null;
  if (!user) {
    return <Navigate to="/login" replace state={{ from: `/pay/${plan}`, notice: "pricing" }} />;
  }

  const amount = pricing
    ? plan === "single"
      ? pricing.singlePriceTenge
      : pricing.bundlePriceTenge
    : (attempt?.amountTenge ?? null);
  const amountText = amount === null ? "… ₸" : `${amount.toLocaleString("ru-RU")} ₸`;
  const sessions = plan === "single" ? 1 : 3;
  const waiting = attempt?.status === "pending" || (busy && !attempt && !error);
  const paid = attempt?.status === "confirmed";
  const rejected = attempt?.status === "rejected";

  function startKaspiPay(): boolean {
    if (!isPlan(plan)) return false;
    const name = cleanName(payerName);
    if (name.length < 2) {
      setError(kz ? "Kaspi-дегі аты-жөніңізді жазыңыз." : "Укажите ФИО для Kaspi.");
      return false;
    }
    if (amount === null) return false;
    setError("");
    sessionStorage.setItem(waitingKey(plan), "1");
    // keepalive: the page unloads into Kaspi; the request must still finish.
    void api.submitPayment({ plan, payerName: name }, { keepalive: true }).catch(() => {
      sessionStorage.removeItem(waitingKey(plan));
    });
    return true;
  }

  function onPayClick(e: MouseEvent<HTMLAnchorElement>) {
    if (!startKaspiPay()) e.preventDefault();
  }

  function onPaySubmit(e: FormEvent) {
    e.preventDefault();
    if (!startKaspiPay()) return;
    window.location.assign(KASPI_PAY_URL);
  }

  return (
    <div className="page v2">
      <SiteHeader lang={lang} onToggleLang={onToggleLang}>
        <Link to="/">{kz ? "Басты бет" : "Главная"}</Link>
        <Link to="/cabinet">{kz ? "Кабинет" : "Кабинет"}</Link>
      </SiteHeader>

      <section className="pay-head">
        <h1>{kz ? PLAN_TITLE[plan].kz : PLAN_TITLE[plan].ru}</h1>
        <p className="pay-head__amount">{amountText}</p>
        <p className="pay-head__note">
          {kz
            ? `Төлем расталған соң кабинетке ${sessions} толық ҰБТ қосылады.`
            : `После подтверждения оплаты в кабинет добавится ${sessions === 1 ? "1 полный ЕНТ" : "3 полных ЕНТ"}.`}
        </p>
      </section>

      {paid ? (
        <section className="pay-done" role="status">
          <h2>{kz ? "Төлем расталды" : "Оплата подтверждена"}</h2>
          <p>
            {kz
              ? "ҰБТ кабинетіңізге қосылды. Жаңа тестті сол жерден бастайсыз."
              : "ЕНТ добавлены в кабинет. Новый тест можно начать оттуда."}
          </p>
          <Link to="/cabinet" className="v2-btn">
            {kz ? "Кабинетке өту" : "В кабинет"}
          </Link>
        </section>
      ) : waiting ? (
        <section className="pay-done" role="status">
          <h2>{kz ? "Төлем тексерілуде" : "Проверяем оплату"}</h2>
          <p>
            {kz
              ? "Kaspi-дегі аударымды тексеріп жатырмыз. Әдетте 1–2 минут кетеді. Расталған соң ҰБТ осы бетте пайда болады."
              : "Проверяем перевод в Kaspi. Обычно это занимает 1–2 минуты. После подтверждения ЕНТ появятся на этой странице."}
          </p>
          <p className="pay-done__hint">
            {kz
              ? `Аты-жөні «${attempt?.payerName || payerName}», сома ${amountText}.`
              : `ФИО «${attempt?.payerName || payerName}», сумма ${amountText}.`}
          </p>
          <div className="pay-done__actions">
            <a className="v2-btn" href={KASPI_PAY_URL}>
              {kz ? "Kaspi-ді қайта ашу" : "Открыть Kaspi снова"}
            </a>
            <Link to="/cabinet/payments" className="v2-btn v2-btn--quiet">
              {kz ? "Төлемдерге өту" : "К оплатам"}
            </Link>
          </div>
        </section>
      ) : (
        <div className="pay-layout">
          {rejected && (
            <p className="v2-error" role="status">
              {kz
                ? "Алдыңғы төлем табылмады. Қайта төлеп, «Төлеу» батырмасын басыңыз."
                : "Прошлый перевод не найден. Оплатите снова и нажмите «Оплатить»."}
            </p>
          )}
          {error && (
            <p className="v2-error" role="alert">
              {error}
            </p>
          )}

          <ol className="pay-steps">
            <li>
              <h2>{kz ? "Kaspi-де төлеңіз" : "Оплатите в Kaspi"}</h2>
              <p>
                {kz
                  ? "«Төлеу» батырмасын басыңыз — Kaspi қосымшасы ашылады. Төлеген соң осы бетке қайтыңыз, тексеру 1–2 минутқа созылады."
                  : "Нажмите «Оплатить» — откроется приложение Kaspi. После оплаты вернитесь на эту страницу: проверка займёт 1–2 минуты."}
              </p>
              <dl className="pay-facts">
                <div>
                  <dt>{kz ? "Сома" : "Сумма"}</dt>
                  <dd>{amountText}</dd>
                </div>
              </dl>
              <form className="pay-form" onSubmit={onPaySubmit}>
                <label className="field">
                  <span className="field__label">
                    {kz ? "Kaspi-де жазатын аты-жөніңіз" : "ФИО, которое укажете в Kaspi"}
                  </span>
                  <input
                    value={payerName}
                    onChange={(e) => setPayerName(e.target.value)}
                    required
                    minLength={2}
                    maxLength={80}
                    autoComplete="name"
                  />
                </label>
                <p>
                  {kz
                    ? "Төлемді аты-жөні мен сомасы бойынша табамыз, сондықтан екеуі де сәйкес келуі керек."
                    : "Мы находим перевод по имени и сумме, поэтому оба должны совпадать."}
                </p>
                {/* Real <a href>: only a user gesture navigation opens the Kaspi app on phones. */}
                <a
                  className={`v2-btn pay-steps__kaspi${amount === null ? " is-disabled" : ""}`}
                  href={KASPI_PAY_URL}
                  onClick={onPayClick}
                  aria-disabled={amount === null}
                >
                  {kz ? "Төлеу" : "Оплатить"}
                </a>
                <button type="submit" className="visually-hidden">
                  {kz ? "Төлеу" : "Оплатить"}
                </button>
              </form>
            </li>
          </ol>
        </div>
      )}
    </div>
  );
}
