import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import {
  api,
  KASPI_PAY_URL,
  type EntPricing,
  type PaymentPlan,
  type PaymentRequest,
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

/**
 * Kaspi QR "Оплата услуги" has no callback: the student pays in Kaspi, then
 * tells us here. An admin finds the transfer by name and amount and confirms.
 */
export function PaymentPage({ lang, onToggleLang }: PaymentPageProps) {
  const kz = lang === "kz";
  useDocumentTitle(kz ? "Kaspi арқылы төлеу" : "Оплата через Kaspi");
  const { plan } = useParams<{ plan: string }>();
  const { user, loading } = useAuth();
  const [pricing, setPricing] = useState<EntPricing | null>(null);
  const [payerName, setPayerName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState<PaymentRequest | null>(null);

  useEffect(() => {
    api
      .getPricing()
      .then(setPricing)
      .catch(() => setError(kz ? "Бағаны жүктеу мүмкін болмады." : "Не удалось загрузить цену."));
    // The price does not depend on the language.
  }, []);

  // Reached from the plans further down the home page; start at the top.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (user && !payerName) setPayerName(user.name);
  }, [user, payerName]);

  if (!isPlan(plan)) return <Navigate to="/#plans" replace />;
  if (loading) return null;
  if (!user) {
    return <Navigate to="/login" replace state={{ from: `/pay/${plan}`, notice: "pricing" }} />;
  }

  const amount = pricing
    ? plan === "single"
      ? pricing.singlePriceTenge
      : pricing.bundlePriceTenge
    : null;
  const amountText = amount === null ? "… ₸" : `${amount.toLocaleString("ru-RU")} ₸`;
  const sessions = plan === "single" ? 1 : 3;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      setSent(await api.createPayment({ plan: plan as PaymentPlan, payerName }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page v2">
      <SiteHeader lang={lang} onToggleLang={onToggleLang}>
        <Link to="/">{kz ? "Басты бет" : "Главная"}</Link>
        <Link to="/profile">{kz ? "Профиль" : "Профиль"}</Link>
      </SiteHeader>

      <section className="pay-head">
        <h1>{kz ? PLAN_TITLE[plan].kz : PLAN_TITLE[plan].ru}</h1>
        <p className="pay-head__amount">{amountText}</p>
        <p className="pay-head__note">
          {kz
            ? `Төлем расталған соң профильге ${sessions} толық ҰБТ қосылады.`
            : `После подтверждения оплаты в профиль добавится ${sessions === 1 ? "1 полный ЕНТ" : "3 полных ЕНТ"}.`}
        </p>
      </section>

      {sent ? (
        <section className="pay-done" role="status">
          <h2>{kz ? "Төлем тексерілуде" : "Оплата на проверке"}</h2>
          <p>
            {kz
              ? `Kaspi-дегі «${sent.payerName}» атынан ${amountText} төлемін тексереміз. Расталған соң ҰБТ профиліңізде пайда болады.`
              : `Проверим перевод ${amountText} от «${sent.payerName}» в Kaspi. После подтверждения ЕНТ появятся в профиле.`}
          </p>
          <Link to="/profile" className="v2-btn">
            {kz ? "Профильге өту" : "Перейти в профиль"}
          </Link>
        </section>
      ) : (
        <div className="pay-layout">
          <ol className="pay-steps">
            <li>
              <h2>{kz ? "Kaspi-де төлеңіз" : "Оплатите в Kaspi"}</h2>
              <p>
                {kz
                  ? "Телефоннан батырманы басыңыз, ал компьютерден QR-кодты Kaspi қосымшасымен сканерлеңіз."
                  : "С телефона нажмите кнопку, с компьютера отсканируйте QR-код в приложении Kaspi."}
              </p>
              <a
                className="v2-btn pay-steps__kaspi"
                href={KASPI_PAY_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                {kz ? "Kaspi-де ашу" : "Открыть Kaspi"}
              </a>
            </li>
            <li>
              <h2>{kz ? "Дәл осы деректерді жазыңыз" : "Укажите в Kaspi ровно это"}</h2>
              <dl className="pay-facts">
                <div>
                  <dt>{kz ? "Сома" : "Сумма"}</dt>
                  <dd>{amountText}</dd>
                </div>
                <div>
                  <dt>{kz ? "Аты-жөні" : "ФИО"}</dt>
                  <dd>{payerName || user.name}</dd>
                </div>
              </dl>
              <p>
                {kz
                  ? "Төлемді аты-жөні мен сомасы бойынша табамыз, сондықтан екеуі де сәйкес келуі керек."
                  : "Мы находим перевод по имени и сумме, поэтому оба должны совпадать."}
              </p>
            </li>
            <li>
              <h2>{kz ? "Төлегеніңізді хабарлаңыз" : "Сообщите об оплате"}</h2>
              <form className="pay-form" onSubmit={onSubmit}>
                <label className="field">
                  <span className="field__label">
                    {kz ? "Kaspi-де жазған аты-жөніңіз" : "ФИО, которое вы указали в Kaspi"}
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
                {error && (
                  <p className="v2-error" role="alert">
                    {error}
                  </p>
                )}
                <button type="submit" className="v2-btn" disabled={busy || amount === null}>
                  {busy
                    ? kz
                      ? "Жіберілуде…"
                      : "Отправляем…"
                    : kz
                      ? "Төледім"
                      : "Я оплатил"}
                </button>
              </form>
            </li>
          </ol>

          <figure className="pay-qr">
            <img
              src="/kaspi-qr.png"
              width={350}
              height={354}
              alt={kz ? "Талапкер үшін Kaspi QR коды" : "Kaspi QR-код для оплаты Талапкер"}
            />
            <figcaption>
              {kz
                ? "Kaspi қосымшасында «Kaspi QR» арқылы сканерлеңіз"
                : "Отсканируйте через «Kaspi QR» в приложении Kaspi"}
            </figcaption>
          </figure>
        </div>
      )}
    </div>
  );
}
