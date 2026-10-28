import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import {
  api,
  API_BASE,
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

function kaspiLink(attempt: PaymentAttempt, payerName: string): string {
  const url = new URL(attempt.linkUrl);
  const name = cleanName(payerName);
  if (name.length >= 2) url.searchParams.set("name", name);
  return url.toString();
}

function openedHow(vias: PaymentAttempt["vias"], kz: boolean): string {
  const link = vias.includes("link");
  const qr = vias.includes("qr");
  if (link && qr) {
    return kz
      ? "Сілтемені ашқаныңызды және QR сканерлегеніңізді көрдік."
      : "Видим, что вы открыли ссылку и отсканировали QR.";
  }
  if (qr) return kz ? "QR сканерлегеніңізді көрдік." : "Видим, что вы отсканировали QR.";
  return kz ? "Сілтемені ашқаныңызды көрдік." : "Видим, что вы открыли ссылку.";
}

/**
 * Kaspi has no callback. Opening the link or the personal QR records the
 * attempt and asks the admin in Telegram. This page watches until they decide.
 */
export function PaymentPage({ lang, onToggleLang }: PaymentPageProps) {
  const kz = lang === "kz";
  useDocumentTitle(kz ? "Kaspi арқылы төлеу" : "Оплата через Kaspi");
  const { plan } = useParams<{ plan: string }>();
  const { user, loading } = useAuth();
  const [pricing, setPricing] = useState<EntPricing | null>(null);
  const [attempt, setAttempt] = useState<PaymentAttempt | null>(null);
  const [payerName, setPayerName] = useState("");
  const [nameReady, setNameReady] = useState(false);
  const [rejectedNote, setRejectedNote] = useState(false);
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
    if (!user || !isPlan(plan)) return;
    let gone = false;
    api
      .openPaymentAttempt(plan)
      .then((row) => {
        if (!gone) setAttempt(row);
      })
      .catch((err) => {
        if (!gone) setError(err instanceof Error ? err.message : "Ошибка");
      });
    return () => {
      gone = true;
    };
  }, [user, plan]);

  useEffect(() => {
    if (attempt && !nameReady) {
      setPayerName(attempt.payerName);
      setNameReady(true);
    }
  }, [attempt, nameReady]);

  useEffect(() => {
    if (!attempt || !isPlan(plan)) return;
    if (attempt.status === "confirmed" || attempt.status === "rejected") return;
    const token = attempt.token;
    const timer = window.setInterval(() => {
      api
        .paymentAttempt(token)
        .then(async (row) => {
          if (row.status === "rejected") {
            setRejectedNote(true);
            try {
              setAttempt(await api.openPaymentAttempt(plan));
            } catch {
              setAttempt(row);
            }
            return;
          }
          setAttempt(row);
        })
        .catch(() => undefined);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [attempt?.token, attempt?.status, plan]);

  useEffect(() => {
    if (!attempt || attempt.status === "confirmed" || attempt.status === "rejected") return;
    const name = cleanName(payerName);
    if (name.length < 2 || name === attempt.payerName) return;
    const token = attempt.token;
    const timer = window.setTimeout(() => {
      api
        .updatePaymentAttempt(token, name)
        .then((row) => setAttempt(row))
        .catch(() => undefined);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [payerName, attempt]);

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
  const waiting = attempt?.status === "pending";
  const paid = attempt?.status === "confirmed";

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
      ) : (
        <div className="pay-layout">
          {rejectedNote && (
            <p className="v2-error" role="status">
              {kz
                ? "Алдыңғы төлем табылмады. Қайта төлесеңіз, жаңа өтінім тексеруге түседі."
                : "Прошлый перевод не найден. Если оплатите снова, новая заявка уйдёт на проверку."}
            </p>
          )}
          {waiting && attempt && (
            <p className="pay-live" role="status">
              {openedHow(attempt.vias, kz)}{" "}
              {kz
                ? "Kaspi-дегі аударманы тексеріп жатырмыз. Расталған соң ҰБТ осы бетте пайда болады."
                : "Проверяем перевод в Kaspi. После подтверждения ЕНТ появятся на этой странице."}
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
                  ? "Телефоннан батырманы басыңыз, ал компьютерден QR-кодты Kaspi қосымшасымен сканерлеңіз. Өтінім осы сәтте өзі тексеруге түседі."
                  : "С телефона нажмите кнопку, с компьютера отсканируйте QR в приложении Kaspi. Заявка в этот момент сама уйдёт на проверку."}
              </p>
              {attempt ? (
                <a
                  className="v2-btn pay-steps__kaspi"
                  href={kaspiLink(attempt, payerName)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {kz ? "Kaspi-де ашу" : "Открыть Kaspi"}
                </a>
              ) : (
                <button type="button" className="v2-btn pay-steps__kaspi" disabled>
                  {kz ? "Сілтеме дайындалуда…" : "Готовим ссылку…"}
                </button>
              )}
            </li>
            <li>
              <h2>{kz ? "Дәл осы деректерді жазыңыз" : "Укажите в Kaspi ровно это"}</h2>
              <dl className="pay-facts">
                <div>
                  <dt>{kz ? "Сома" : "Сумма"}</dt>
                  <dd>{amountText}</dd>
                </div>
              </dl>
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
            </li>
          </ol>

          <figure className="pay-qr">
            {attempt ? (
              <img
                src={`${API_BASE}/api/payments/qr/${attempt.token}`}
                width={350}
                height={350}
                alt={kz ? "Осы төлемге арналған Kaspi QR коды" : "QR-код этой оплаты"}
              />
            ) : (
              <img
                alt=""
                width={350}
                height={350}
                src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
              />
            )}
            <figcaption>
              {kz
                ? "Kaspi қосымшасында «Kaspi QR» арқылы сканерлеңіз. Сканды көріп, тексеруге жібереміз."
                : "Отсканируйте через «Kaspi QR» в приложении Kaspi. Мы увидим скан и отправим его на проверку."}
            </figcaption>
          </figure>
        </div>
      )}
    </div>
  );
}
