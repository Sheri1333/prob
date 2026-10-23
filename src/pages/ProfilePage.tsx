import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { api, type PaymentRequest } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { SiteHeader } from "../components/SiteHeader";
import { translateSubject } from "../i18n/subjects";
import type { Lang } from "../i18n/strings";
import type { ExamStartResponse } from "../utils/examDraft";
import { entScoreToGrade } from "../utils/testUtils";
import { useDocumentTitle } from "../utils/useDocumentTitle";
import "../styles/home.css";

interface ProfilePageProps {
  lang: Lang;
  onToggleLang: () => void;
}

type History = Awaited<ReturnType<typeof api.examHistory>>["sessions"];
type Variants = Awaited<ReturnType<typeof api.examVariants>>;

/** Position on the 0–140 ҰБТ scale as a CSS percentage. */
function onScale(grade: number): string {
  return `${(Math.min(140, Math.max(0, grade)) / 140) * 100}%`;
}

function share(score: number, max: number): number {
  return max > 0 ? Math.round((score / max) * 100) : 0;
}

function formatLeft(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}:${String(m).padStart(2, "0")}`;
}

/** Subject names compared in one language, case-insensitive. */
function sameSubject(a: string, b: string): boolean {
  return translateSubject(a, "ru").toLowerCase() === translateSubject(b, "ru").toLowerCase();
}

function isAnswered(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.values(value).some(Boolean);
  return false;
}

export function ProfilePage({ lang, onToggleLang }: ProfilePageProps) {
  const kz = lang === "kz";
  useDocumentTitle(kz ? "Жеке кабинет" : "Личный кабинет");
  const { user, loading, isAdmin, logout } = useAuth();
  const [sessions, setSessions] = useState<History>([]);
  const [loadingAttempts, setLoadingAttempts] = useState(true);
  const [error, setError] = useState("");
  const [wallet, setWallet] = useState<{
    credits: number;
    unlimited: boolean;
    requests: PaymentRequest[];
  } | null>(null);
  const [variants, setVariants] = useState<Variants | null>(null);
  const [active, setActive] = useState<ExamStartResponse | null>(null);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [verifyNotice, setVerifyNotice] = useState("");

  useEffect(() => {
    if (!user) return;
    api
      .examHistory()
      .then(({ sessions: list }) => setSessions(list))
      .catch((e) => setError(e instanceof Error ? e.message : "Ошибка"))
      .finally(() => setLoadingAttempts(false));
    api.myPayments().then(setWallet).catch(() => undefined);
    api.examVariants().then(setVariants).catch(() => undefined);
    api
      .examActive()
      .then(({ session }) => setActive(session))
      .catch(() => undefined);
  }, [user]);

  const stats = useMemo(() => {
    if (sessions.length === 0) return null;
    const grades = sessions.map((a) => entScoreToGrade(a.score, a.maxScore));
    const avgGrade = Math.round(grades.reduce((sum, g) => sum + g, 0) / grades.length);
    const bestGrade = Math.max(...grades);
    return {
      count: sessions.length,
      grades,
      avgGrade,
      bestGrade,
      bestIndex: grades.indexOf(bestGrade),
      last: grades[0],
      change: grades.length > 1 ? grades[0] - grades[1] : null,
    };
  }, [sessions]);

  // Score per subject over all finished exams, weakest first.
  const subjects = useMemo(() => {
    const bySubject = new Map<
      string,
      { name: string; score: number; max: number; lastScore: number; lastMax: number; count: number }
    >();
    // sessions are newest first, so the first hit is the latest result.
    for (const s of sessions) {
      for (const sec of s.sections ?? []) {
        if (!sec.subject || sec.maxScore <= 0) continue;
        const key = translateSubject(sec.subject, "ru").toLowerCase();
        const row = bySubject.get(key);
        if (row) {
          row.score += sec.score;
          row.max += sec.maxScore;
          row.count += 1;
        } else {
          bySubject.set(key, {
            name: sec.subject,
            score: sec.score,
            max: sec.maxScore,
            lastScore: sec.score,
            lastMax: sec.maxScore,
            count: 1,
          });
        }
      }
    }
    return [...bySubject.values()]
      .map((r) => ({ ...r, pct: share(r.score, r.max) }))
      .sort((a, b) => a.pct - b.pct);
  }, [sessions]);

  // The profile pair the student is working on: running exam first, else the last one.
  const mySubjects = active?.profileSubjects?.length
    ? active.profileSubjects
    : (sessions[0]?.profileSubjects ?? []);

  const freshRows = useMemo(() => {
    if (!variants) return [];
    const rows = variants.mandatory.map((m) => ({
      name: kz ? m.label.kz : m.label.ru,
      total: m.total,
      fresh: m.fresh,
    }));
    for (const subject of mySubjects) {
      const pool = variants.profile.find((p) => sameSubject(p.subject, subject));
      rows.push({
        name: translateSubject(subject, lang),
        total: pool?.total ?? 0,
        fresh: pool?.fresh ?? 0,
      });
    }
    return rows;
  }, [variants, mySubjects, kz, lang]);

  if (loading) return <div className="page page--center">Загрузка...</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: "/profile" }} />;

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString("ru-RU");
  const canStart = !!wallet && (wallet.unlimited || wallet.credits > 0);
  const nextRepeats = freshRows.filter((r) => r.total > 0 && r.fresh === 0);

  const activeProgress = active
    ? (() => {
        let done = 0;
        let total = 0;
        for (const s of active.sections) {
          total += s.questions.length;
          const answers = active.answersByTest?.[s.testId] ?? {};
          done += Object.values(answers).filter(isAnswered).length;
        }
        return { done, total };
      })()
    : null;

  const resendVerify = () => {
    setVerifyBusy(true);
    api
      .resendVerify()
      .then(() => setVerifyNotice(kz ? "Хат жіберілді." : "Письмо отправлено."))
      .catch((e) => setError(e instanceof Error ? e.message : "Ошибка"))
      .finally(() => setVerifyBusy(false));
  };

  const sectionsNav = [
    ["subjects", kz ? "Пәндер" : "Предметы"],
    ["history", kz ? "Нәтижелер" : "Результаты"],
    ["payments", kz ? "Төлемдер" : "Оплаты"],
    ["account", kz ? "Аккаунт" : "Аккаунт"],
  ] as const;

  return (
    <div className="page v2 cabinet">
      <SiteHeader lang={lang} onToggleLang={onToggleLang}>
        {isAdmin && <Link to="/admin">{kz ? "Әкімші" : "Админка"}</Link>}
        <Link to="/">{kz ? "Басты бет" : "Главная"}</Link>
        <button type="button" onClick={() => setConfirmLogout(true)}>
          {kz ? "Шығу" : "Выйти"}
        </button>
      </SiteHeader>

      <section className="cab-head">
        <div>
          <h1>
            {user.name}
            {isAdmin && <span className="v2-tag">{kz ? "Әкімші" : "Админ"}</span>}
          </h1>
          <p>{kz ? "Жеке кабинет" : "Личный кабинет"}</p>
        </div>
        <div className="cab-head__actions">
          {canStart ? (
            <Link to="/" className="v2-btn">
              {kz ? "Жаңа ҰБТ бастау" : "Начать новый ЕНТ"}
            </Link>
          ) : null}
          {wallet && !wallet.unlimited && (
            <Link to="/pay/bundle" className={`v2-btn${canStart ? " v2-btn--quiet" : ""}`}>
              {kz ? "ҰБТ сатып алу" : "Купить ЕНТ"}
            </Link>
          )}
        </div>
      </section>

      {user.emailVerified === false && (
        <p className="v2-notice">
          {kz
            ? "Email әлі расталмаған. Нәтижелерді алу және құпиясөзді қалпына келтіру үшін поштаңызды растаңыз."
            : "Email ещё не подтверждён. Подтвердите почту, чтобы получать результаты и сбрасывать пароль."}{" "}
          {verifyNotice ? (
            <strong>{verifyNotice}</strong>
          ) : (
            <button type="button" className="link-btn" disabled={verifyBusy} onClick={resendVerify}>
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

      {active && activeProgress && (
        <section className="cab-active">
          <div>
            <strong>{kz ? "Аяқталмаған ҰБТ" : "Незавершённый ЕНТ"}</strong>
            <span>
              {active.profileSubjects?.length
                ? active.profileSubjects.map((s) => translateSubject(s, lang)).join(" + ") + ". "
                : ""}
              {kz
                ? `Жауап берілді: ${activeProgress.done} / ${activeProgress.total}. Қалған уақыт: ${formatLeft(active.remainingSeconds ?? 0)}.`
                : `Отвечено: ${activeProgress.done} из ${activeProgress.total}. Осталось времени: ${formatLeft(active.remainingSeconds ?? 0)}.`}
            </span>
          </div>
          <Link to={`/exam/${active.sessionId}`} className="v2-btn">
            {kz ? "Жалғастыру" : "Продолжить"}
          </Link>
        </section>
      )}

      <ul className="hero-stats cab-stats">
        <li className="hero-stats__item">
          <span className="hero-stats__icon material-symbols-outlined" aria-hidden="true">
            confirmation_number
          </span>
          <span className="hero-stats__text">
            <strong>{wallet ? (wallet.unlimited ? "∞" : wallet.credits) : "…"}</strong>
            <span>{kz ? "төленген ҰБТ" : "оплаченных ЕНТ"}</span>
          </span>
        </li>
        <li className="hero-stats__item">
          <span className="hero-stats__icon material-symbols-outlined" aria-hidden="true">
            workspace_premium
          </span>
          <span className="hero-stats__text">
            <strong>{stats ? `${stats.bestGrade}` : "—"}</strong>
            <span>{kz ? "үздік балл" : "лучший балл"}</span>
          </span>
        </li>
        <li className="hero-stats__item">
          <span className="hero-stats__icon material-symbols-outlined" aria-hidden="true">
            trending_up
          </span>
          <span className="hero-stats__text">
            <strong>
              {stats ? stats.last : "—"}
              {stats?.change != null && stats.change !== 0 && (
                <em className={stats.change > 0 ? "is-up" : "is-down"}>
                  {stats.change > 0 ? `+${stats.change}` : stats.change}
                </em>
              )}
            </strong>
            <span>{kz ? "соңғы балл" : "последний балл"}</span>
          </span>
        </li>
        <li className="hero-stats__item">
          <span className="hero-stats__icon material-symbols-outlined" aria-hidden="true">
            task_alt
          </span>
          <span className="hero-stats__text">
            <strong>{stats ? stats.count : loadingAttempts ? "…" : 0}</strong>
            <span>{kz ? "тапсырылған ҰБТ" : "пройдено ЕНТ"}</span>
          </span>
        </li>
      </ul>

      <div className="cab-layout">
        <nav className="cab-nav" aria-label={kz ? "Кабинет бөлімдері" : "Разделы кабинета"}>
          {sectionsNav.map(([id, label]) => (
            <a key={id} href={`#${id}`}>
              {label}
            </a>
          ))}
        </nav>

        <div className="cab-main">
          <section className="cab-section" id="subjects">
            <h2>{kz ? "Пәндер бойынша" : "По предметам"}</h2>
            {subjects.length === 0 ? (
              <p className="cab-empty">
                {kz
                  ? "Бірінші ҰБТ-дан кейін әр пән бойынша нәтиже осында шығады: қай пән мықты, қайсысына көбірек дайындалу керек."
                  : "После первого ЕНТ здесь появится результат по каждому предмету: что получается, а что стоит подтянуть."}
              </p>
            ) : (
              <>
                <p className="v2-section__intro">
                  {kz
                    ? `Барлық тапсырған ҰБТ бойынша орташа. Ең әлсіз пән: ${translateSubject(subjects[0].name, lang)}.`
                    : `Среднее по всем пройденным ЕНТ. Слабее всего: ${translateSubject(subjects[0].name, lang)}.`}
                </p>
                <ul className="subject-bars">
                  {subjects.map((s, i) => (
                    <li key={s.name} className={i === 0 && subjects.length > 1 ? "is-weakest" : ""}>
                      <span className="subject-bars__name">{translateSubject(s.name, lang)}</span>
                      <span className="subject-bars__track">
                        <span style={{ width: `${s.pct}%` }} />
                      </span>
                      <span className="subject-bars__pct">{s.pct}%</span>
                      <span className="subject-bars__meta">
                        {kz
                          ? `соңғысы ${s.lastScore} / ${s.lastMax}, ${s.count} рет`
                          : `последний ${s.lastScore} из ${s.lastMax}, ${s.count} раз`}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {freshRows.length > 0 && (
              <div className="fresh">
                <h3>{kz ? "Келесі ҰБТ-ға жаңа нұсқалар" : "Новые варианты для следующего ЕНТ"}</h3>
                <p>
                  {kz
                    ? "Бұрын көрмеген нұсқаларыңыз. Жаңасы таусылса, ең ерте тапсырғаныңыз қайталанады."
                    : "Варианты, которые вы ещё не видели. Когда новые закончатся, повторится тот, что был давнее всего."}
                </p>
                <ul>
                  {freshRows.map((r) => (
                    <li key={r.name} className={r.total > 0 && r.fresh === 0 ? "is-out" : ""}>
                      <span>{r.name}</span>
                      <strong>
                        {r.total === 0
                          ? kz
                            ? "нұсқа жоқ"
                            : "нет вариантов"
                          : kz
                            ? `${r.fresh} / ${r.total} жаңа`
                            : `${r.fresh} из ${r.total} новых`}
                      </strong>
                    </li>
                  ))}
                </ul>
                {nextRepeats.length > 0 && (
                  <p className="fresh__warn">
                    {kz
                      ? `Келесі ҰБТ-да қайталанады: ${nextRepeats.map((r) => r.name).join(", ")}.`
                      : `В следующем ЕНТ повторятся: ${nextRepeats.map((r) => r.name).join(", ")}.`}
                  </p>
                )}
              </div>
            )}
          </section>

          <section className="cab-section" id="history">
            <h2>{kz ? "ҰБТ нәтижелері" : "Результаты ЕНТ"}</h2>
            {loadingAttempts ? (
              <p className="v2-section__intro">{kz ? "Жүктелуде…" : "Загрузка…"}</p>
            ) : !stats ? (
              <div className="history-empty">
                <p>
                  {kz
                    ? "Әзірге тапсырылған ҰБТ жоқ. Әр нәтиже осында 140 балдық шкалада көрінеді."
                    : "Пока нет пройденных ЕНТ. Каждый результат появится здесь на шкале из 140 баллов."}
                </p>
                <Link to={canStart ? "/" : "/pay/bundle"} className="v2-btn">
                  {canStart ? (kz ? "ҰБТ бастау" : "Начать ЕНТ") : kz ? "ҰБТ сатып алу" : "Купить ЕНТ"}
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
                              {a.profileSubjects?.length
                                ? a.profileSubjects.map((s) => translateSubject(s, lang)).join(" + ")
                                : `${a.sectionCount} ${kz ? "пән" : "предм."}`}
                            </span>
                          </span>
                          <span className="history__track">
                            <span className="history__fill" style={{ width: onScale(grade) }} />
                            {stats.count > 1 && (
                              <span className="history__avg" style={{ left: onScale(stats.avgGrade) }} />
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
                      ? `орташа балл, ${stats.avgGrade}. Сары жолақ — үздік нәтиже. Талдауды ашу үшін жолды басыңыз.`
                      : `средний балл, ${stats.avgGrade}. Жёлтая полоса — лучший результат. Нажмите на строку, чтобы открыть разбор.`}
                  </p>
                )}
              </>
            )}
          </section>

          <section className="cab-section" id="payments">
            <h2>{kz ? "Төлемдер" : "Оплаты"}</h2>
            {!wallet || wallet.requests.length === 0 ? (
              <p className="cab-empty">
                {kz
                  ? "Төлем әлі болған жоқ. Kaspi арқылы төлеп, «Төледім» батырмасын бассаңыз, ол осында шығады."
                  : "Оплат пока не было. Когда оплатите через Kaspi и нажмёте «Я оплатил», она появится здесь."}
              </p>
            ) : (
              <>
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
              </>
            )}
          </section>

          <section className="cab-section" id="account">
            <h2>{kz ? "Аккаунт" : "Аккаунт"}</h2>
            <dl className="facts">
              <div>
                <dt>{kz ? "Аты-жөні" : "Имя"}</dt>
                <dd>{user.name}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>
                  {user.email}{" "}
                  <span className={`cab-badge${user.emailVerified === false ? " is-warn" : ""}`}>
                    {user.emailVerified === false
                      ? kz
                        ? "расталмаған"
                        : "не подтверждён"
                      : kz
                        ? "расталған"
                        : "подтверждён"}
                  </span>
                </dd>
              </div>
              <div>
                <dt>{kz ? "Құпиясөз" : "Пароль"}</dt>
                <dd>
                  <Link to="/forgot" className="cab-link">
                    {kz ? "Құпиясөзді өзгерту" : "Сменить пароль"}
                  </Link>
                  <span className="cab-hint">
                    {kz ? " Поштаңызға сілтеме жібереміз." : " Пришлём ссылку на почту."}
                  </span>
                </dd>
              </div>
              <div>
                <dt>{kz ? "Сайт тілі" : "Язык сайта"}</dt>
                <dd>
                  {kz ? "Қазақша" : "Русский"}{" "}
                  <button type="button" className="link-btn cab-link" onClick={onToggleLang}>
                    {kz ? "Орысшаға ауыстыру" : "Переключить на казахский"}
                  </button>
                </dd>
              </div>
            </dl>
            <button
              type="button"
              className="v2-btn v2-btn--quiet cab-logout"
              onClick={() => setConfirmLogout(true)}
            >
              {kz ? "Аккаунттан шығу" : "Выйти из аккаунта"}
            </button>
          </section>
        </div>
      </div>

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
