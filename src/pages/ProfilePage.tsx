import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { api, type PaymentRequest } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { SiteHeader } from "../components/SiteHeader";
import type { Lang } from "../i18n/strings";
import { entScoreToGrade } from "../utils/testUtils";
import { useDocumentTitle } from "../utils/useDocumentTitle";
import "../styles/home.css";

interface ProfilePageProps {
  lang: Lang;
  onToggleLang: () => void;
}

/** Position on the 0–140 ҰБТ scale as a CSS percentage. */
function onScale(grade: number): string {
  return `${(Math.min(140, Math.max(0, grade)) / 140) * 100}%`;
}

export function ProfilePage({ lang, onToggleLang }: ProfilePageProps) {
  useDocumentTitle("Профиль");
  const { user, loading, isAdmin, logout } = useAuth();
  const [sessions, setSessions] = useState<
    Awaited<ReturnType<typeof api.examHistory>>["sessions"]
  >([]);
  const [error, setError] = useState("");
  const [loadingAttempts, setLoadingAttempts] = useState(true);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [verifyNotice, setVerifyNotice] = useState("");
  const [wallet, setWallet] = useState<{
    credits: number;
    unlimited: boolean;
    requests: PaymentRequest[];
  } | null>(null);

  useEffect(() => {
    if (!user) return;
    api
      .myPayments()
      .then(setWallet)
      .catch(() => undefined);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    api
      .examHistory()
      .then(({ sessions: list }) => setSessions(list))
      .catch((e) => setError(e instanceof Error ? e.message : "Ошибка"))
      .finally(() => setLoadingAttempts(false));
  }, [user]);

  const stats = useMemo(() => {
    if (sessions.length === 0) return null;
    const grades = sessions.map((a) => entScoreToGrade(a.score, a.maxScore));
    const avgGrade = Math.round(
      grades.reduce((sum, g) => sum + g, 0) / grades.length,
    );
    const bestGrade = Math.max(...grades);
    return {
      count: sessions.length,
      grades,
      avgGrade,
      bestGrade,
      bestIndex: grades.indexOf(bestGrade),
    };
  }, [sessions]);

  if (loading) return <div className="page page--center">Загрузка...</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: "/profile" }} />;

  const kz = lang === "kz";
  const formatDate = (iso: string) => new Date(iso).toLocaleDateString("ru-RU");

  const resendVerify = () => {
    setVerifyBusy(true);
    api
      .resendVerify()
      .then(() => setVerifyNotice(kz ? "Хат жіберілді." : "Письмо отправлено."))
      .catch((e) => setError(e instanceof Error ? e.message : "Ошибка"))
      .finally(() => setVerifyBusy(false));
  };

  return (
    <div className="page v2">
      <SiteHeader lang={lang} onToggleLang={onToggleLang}>
        {isAdmin && <Link to="/admin">{kz ? "Әкімші" : "Админка"}</Link>}
        <Link to="/">{kz ? "Басты бет" : "Главная"}</Link>
        <button type="button" onClick={() => setConfirmLogout(true)}>
          {kz ? "Шығу" : "Выйти"}
        </button>
      </SiteHeader>

      <section className="v2-profile-head">
        <h1>
          {user.name}
          {isAdmin && <span className="v2-tag">{kz ? "Әкімші" : "Админ"}</span>}
        </h1>
        <p>{user.email}</p>
      </section>

      {user.emailVerified === false && (
        <p className="v2-notice">
          {kz
            ? "Email әлі расталмаған. Нәтижелерді алу және парольді қалпына келтіру үшін поштаңызды растаңыз."
            : "Email ещё не подтверждён. Подтвердите почту, чтобы получать результаты и сбрасывать пароль."}{" "}
          {verifyNotice ? (
            <strong>{verifyNotice}</strong>
          ) : (
            <button
              type="button"
              className="link-btn"
              disabled={verifyBusy}
              onClick={resendVerify}
            >
              {verifyBusy
                ? kz
                  ? "Жіберілуде…"
                  : "Отправляем…"
                : kz
                  ? "Хатты қайта жіберу"
                  : "Отправить письмо ещё раз"}
            </button>
          )}
        </p>
      )}

      {error && <p className="v2-error">{error}</p>}

      {wallet && (
        <section className="balance" aria-live="polite">
          <div className="balance__text">
            <strong>
              {wallet.unlimited
                ? kz
                  ? "Әкімші: шектеусіз"
                  : "Админ: без ограничений"
                : kz
                  ? `Төленген ҰБТ: ${wallet.credits}`
                  : `Оплачено ЕНТ: ${wallet.credits}`}
            </strong>
            <span>
              {wallet.unlimited
                ? kz
                  ? "Тексеру үшін ҰБТ-ны төлемсіз бастай аласыз."
                  : "Для проверки ЕНТ запускается без оплаты."
                : wallet.credits > 0
                  ? kz
                    ? "Әр ҰБТ басталғанда біреуі есептен шығады."
                    : "При старте каждого ЕНТ списывается одна попытка."
                  : kz
                    ? "ҰБТ тапсыру үшін тарифті Kaspi арқылы төлеңіз."
                    : "Чтобы пройти ЕНТ, оплатите тариф через Kaspi."}
            </span>
          </div>
          <div className="balance__actions">
            {(wallet.unlimited || wallet.credits > 0) && (
              <Link to="/" className="v2-btn">
                {kz ? "ҰБТ бастау" : "Начать ЕНТ"}
              </Link>
            )}
            {!wallet.unlimited && (
              <Link
                to="/pay/bundle"
                className={`v2-btn${wallet.credits > 0 ? " v2-btn--quiet" : ""}`}
              >
                {kz ? "ҰБТ сатып алу" : "Купить ЕНТ"}
              </Link>
            )}
          </div>
        </section>
      )}

      {stats && (
        <dl className="score-summary">
          <div className="score-summary__best">
            <dt>{kz ? "Үздік балл" : "Лучший балл"}</dt>
            <dd>
              {stats.bestGrade}
              <small>/ 140</small>
            </dd>
          </div>
          <div>
            <dt>{kz ? "Орташа балл" : "Средний балл"}</dt>
            <dd>{stats.avgGrade}</dd>
          </div>
          <div>
            <dt>{kz ? "Тапсырылған ҰБТ" : "Пройдено ЕНТ"}</dt>
            <dd>{stats.count}</dd>
          </div>
        </dl>
      )}

      <section className="v2-section">
        <h2>{kz ? "ҰБТ тарихы" : "История ЕНТ"}</h2>
        {loadingAttempts ? (
          <p className="v2-section__intro">{kz ? "Жүктелуде…" : "Загрузка…"}</p>
        ) : !stats ? (
          <div className="history-empty">
            <p>
              {kz
                ? "Әзірге тапсырылған ҰБТ жоқ. Алғашқы сынақтан кейін әр нәтиже осында 140 балдық шкалада көрінеді."
                : "Пока нет пройденных ЕНТ. После первого пробника каждый результат появится здесь на шкале из 140 баллов."}
            </p>
            <Link to="/" className="v2-btn">
              {kz ? "ҰБТ тапсыру" : "Пройти ЕНТ"}
            </Link>
          </div>
        ) : (
          <>
            <ol className="history">
              <li className="history__axis" aria-hidden="true">
                <div className="history__axis-scale">
                  <span>0</span>
                  <span>70</span>
                  <span>140</span>
                </div>
              </li>
              {sessions.map((a, i) => {
                const grade = stats.grades[i];
                const isBest = i === stats.bestIndex;
                return (
                  <li key={a.sessionId}>
                    <Link
                      to={`/exam/results/${a.sessionId}`}
                      className={`history__row${isBest ? " history__row--best" : ""}`}
                      aria-label={`${formatDate(a.finishedAt)}: ${grade} / 140`}
                    >
                      <span className="history__date">
                        {formatDate(a.finishedAt)}{" "}
                        <span>
                          {a.sectionCount} {kz ? "пән" : "предм."}
                        </span>
                      </span>
                      <span className="history__track">
                        <span
                          className="history__fill"
                          style={{ width: onScale(grade) }}
                        />
                        {stats.count > 1 && (
                          <span
                            className="history__avg"
                            style={{ left: onScale(stats.avgGrade) }}
                          />
                        )}
                      </span>
                      <span className="history__score">{grade}</span>
                    </Link>
                  </li>
                );
              })}
            </ol>
            {stats.count > 1 && (
              <p className="history__legend">
                <i />
                {kz
                  ? `орташа балл, ${stats.avgGrade}. Сары жолақ — үздік нәтиже.`
                  : `средний балл, ${stats.avgGrade}. Жёлтая полоса — лучший результат.`}
              </p>
            )}
          </>
        )}
      </section>

      {wallet && wallet.requests.length > 0 && (
        <section className="v2-section">
          <h2>{kz ? "Төлемдер" : "Оплаты"}</h2>
          <ul className="payments-list">
            {wallet.requests.map((r) => (
              <li key={r.id}>
                <span className="payments-list__what">
                  {r.sessions === 1
                    ? kz
                      ? "1 толық ҰБТ"
                      : "1 полный ЕНТ"
                    : kz
                      ? `${r.sessions} толық ҰБТ`
                      : `${r.sessions} полных ЕНТ`}
                  , {r.amountTenge.toLocaleString("ru-RU")} ₸
                </span>
                <span className="payments-list__meta">
                  {formatDate(r.createdAt)}, {kz ? "Kaspi-дегі аты" : "имя в Kaspi"}: {r.payerName}
                </span>
                <span className={`payments-list__status payments-list__status--${r.status}`}>
                  {r.status === "pending"
                    ? kz
                      ? "Тексерілуде"
                      : "На проверке"
                    : r.status === "confirmed"
                      ? kz
                        ? "Расталды"
                        : "Подтверждена"
                      : kz
                        ? "Табылмады"
                        : "Не найдена"}
                </span>
              </li>
            ))}
          </ul>
          {wallet.requests.some((r) => r.status === "rejected") && (
            <p className="history__legend">
              {kz
                ? "«Табылмады» дегеніміз Kaspi-де осы аты-жөні мен сомадағы төлем табылмады. Төлеген болсаңыз, бізге жазыңыз."
                : "«Не найдена» значит, что перевода с таким именем и суммой в Kaspi нет. Если вы платили, напишите нам."}
            </p>
          )}
        </section>
      )}

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
    </div>
  );
}
