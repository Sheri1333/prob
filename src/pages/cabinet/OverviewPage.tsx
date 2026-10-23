import { useMemo } from "react";
import { Link, useNavigate, useOutletContext } from "react-router-dom";
import { ScoreLine } from "../../components/Charts";
import { translateSubject } from "../../i18n/subjects";
import { useDocumentTitle } from "../../utils/useDocumentTitle";
import { formatDate, grade, shortDate, subjectKey, subjectStats, type CabinetData } from "./data";

function formatLeft(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}:${String(m).padStart(2, "0")}`;
}

function isAnswered(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.values(value).some(Boolean);
  return false;
}

export function OverviewPage() {
  const { lang, loading, exams, wallet, variants, active } = useOutletContext<CabinetData>();
  const kz = lang === "kz";
  useDocumentTitle(kz ? "Жеке кабинет" : "Личный кабинет");
  const navigate = useNavigate();

  const grades = exams.map(grade);
  const best = grades.length ? Math.max(...grades) : null;
  const last = grades.length ? grades[grades.length - 1] : null;
  const prev = grades.length > 1 ? grades[grades.length - 2] : null;
  const avg = grades.length ? Math.round(grades.reduce((s, g) => s + g, 0) / grades.length) : null;
  const canStart = !!wallet && (wallet.unlimited || wallet.credits > 0);

  const subjects = useMemo(() => subjectStats(exams).sort((a, b) => a.avgPct - b.avgPct), [exams]);
  const weakest = subjects.slice(0, 3);

  // The profile pair being prepared: the running exam, else the latest one.
  const mySubjects = active?.profileSubjects?.length
    ? active.profileSubjects
    : (exams[exams.length - 1]?.profileSubjects ?? []);
  const freshRows = useMemo(() => {
    if (!variants) return [];
    const rows = variants.mandatory.map((m) => ({
      name: kz ? m.label.kz : m.label.ru,
      total: m.total,
      fresh: m.fresh,
    }));
    for (const subject of mySubjects) {
      const pool = variants.profile.find((p) => subjectKey(p.subject) === subjectKey(subject));
      rows.push({ name: translateSubject(subject, lang), total: pool?.total ?? 0, fresh: pool?.fresh ?? 0 });
    }
    return rows;
  }, [variants, mySubjects, kz, lang]);
  const repeats = freshRows.filter((r) => r.total > 0 && r.fresh === 0);

  const progress = active
    ? active.sections.reduce(
        (acc, s) => {
          acc.total += s.questions.length;
          acc.done += Object.values(active.answersByTest?.[s.testId] ?? {}).filter(isAnswered).length;
          return acc;
        },
        { done: 0, total: 0 },
      )
    : null;

  return (
    <>
      <header className="cab-title">
        <div>
          <h1>{kz ? "Шолу" : "Обзор"}</h1>
          <p>{kz ? "Дайындықтың негізгі көрсеткіштері" : "Главное о вашей подготовке"}</p>
        </div>
        <div className="cab-title__actions">
          {canStart && (
            <Link to="/" className="v2-btn">
              {kz ? "Жаңа ҰБТ бастау" : "Начать новый ЕНТ"}
            </Link>
          )}
          {wallet && !wallet.unlimited && (
            <Link to="/pay/bundle" className={`v2-btn${canStart ? " v2-btn--quiet" : ""}`}>
              {kz ? "ҰБТ сатып алу" : "Купить ЕНТ"}
            </Link>
          )}
        </div>
      </header>

      {active && progress && (
        <section className="cab-active">
          <div>
            <strong>{kz ? "Аяқталмаған ҰБТ" : "Незавершённый ЕНТ"}</strong>
            <span>
              {active.profileSubjects?.length
                ? active.profileSubjects.map((s) => translateSubject(s, lang)).join(" + ") + ". "
                : ""}
              {kz
                ? `Жауап берілді: ${progress.done} / ${progress.total}. Қалған уақыт: ${formatLeft(active.remainingSeconds ?? 0)}.`
                : `Отвечено: ${progress.done} из ${progress.total}. Осталось времени: ${formatLeft(active.remainingSeconds ?? 0)}.`}
            </span>
            <span className="cab-active__bar" aria-hidden="true">
              <span style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
            </span>
          </div>
          <Link to={`/exam/${active.sessionId}`} className="v2-btn">
            {kz ? "Жалғастыру" : "Продолжить"}
          </Link>
        </section>
      )}

      <ul className="hero-stats cab-kpis">
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
            <strong>{best ?? "—"}</strong>
            <span>{kz ? "үздік балл" : "лучший балл"}</span>
          </span>
        </li>
        <li className="hero-stats__item">
          <span className="hero-stats__icon material-symbols-outlined" aria-hidden="true">
            trending_up
          </span>
          <span className="hero-stats__text">
            <strong>
              {last ?? "—"}
              {last !== null && prev !== null && last !== prev && (
                <em className={last > prev ? "is-up" : "is-down"}>
                  {last > prev ? `+${last - prev}` : last - prev}
                </em>
              )}
            </strong>
            <span>{kz ? "соңғы балл" : "последний балл"}</span>
          </span>
        </li>
        <li className="hero-stats__item">
          <span className="hero-stats__icon material-symbols-outlined" aria-hidden="true">
            functions
          </span>
          <span className="hero-stats__text">
            <strong>{avg ?? "—"}</strong>
            <span>
              {kz ? `орташа, ${exams.length} ҰБТ` : `средний, ${exams.length} ЕНТ`}
            </span>
          </span>
        </li>
      </ul>

      <section className="cab-card">
        <div className="cab-card__head">
          <h2>{kz ? "Балл динамикасы" : "Динамика баллов"}</h2>
          {exams.length > 0 && (
            <Link to="/cabinet/results" className="cab-more">
              {kz ? "Барлық нәтижелер" : "Все результаты"}
            </Link>
          )}
        </div>
        {loading ? (
          <p className="cab-empty">{kz ? "Жүктелуде…" : "Загрузка…"}</p>
        ) : exams.length === 0 ? (
          <p className="cab-empty">
            {kz
              ? "Бірінші ҰБТ-дан кейін мұнда әр тапсырудың балы 140 балдық шкалада сызық болып шығады."
              : "После первого ЕНТ здесь появится линия ваших баллов по шкале из 140."}
          </p>
        ) : (
          <>
            <p className="cab-card__sub">
              {kz
                ? "Әр нүкте бір ҰБТ. Талдауын ашу үшін нүктені басыңыз."
                : "Каждая точка — один ЕНТ. Нажмите на точку, чтобы открыть разбор."}
            </p>
            <ScoreLine
              points={exams.map((e) => ({
                id: e.sessionId,
                label: shortDate(e.finishedAt),
                value: grade(e),
              }))}
              max={140}
              ticks={[0, 35, 70, 105, 140]}
              unit={kz ? "балл" : "балл"}
              onPick={(p) => navigate(`/exam/results/${p.id}`)}
            />
          </>
        )}
      </section>

      <div className="cab-grid">
        <section className="cab-card">
          <div className="cab-card__head">
            <h2>{kz ? "Көбірек дайындалу керек" : "Что подтянуть"}</h2>
            {weakest.length > 0 && (
              <Link to="/cabinet/subjects" className="cab-more">
                {kz ? "Пәндер талдауы" : "Разбор по предметам"}
              </Link>
            )}
          </div>
          {weakest.length === 0 ? (
            <p className="cab-empty">
              {kz
                ? "Тапсырғаннан кейін ең төмен нәтиже берген пәндерді көрсетеміз."
                : "После первого ЕНТ покажем предметы с самым низким результатом."}
            </p>
          ) : (
            <ol className="weak-list">
              {weakest.map((s) => (
                <li key={s.key}>
                  <Link to={`/cabinet/subjects?s=${encodeURIComponent(s.key)}`}>
                    <span>{translateSubject(s.name, lang)}</span>
                    <strong>{s.avgPct}%</strong>
                  </Link>
                  <span className="weak-list__track" aria-hidden="true">
                    <span style={{ width: `${s.avgPct}%` }} />
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="cab-card">
          <div className="cab-card__head">
            <h2>{kz ? "Келесі ҰБТ" : "Следующий ЕНТ"}</h2>
          </div>
          {freshRows.length === 0 ? (
            <p className="cab-empty">{kz ? "Жүктелуде…" : "Загрузка…"}</p>
          ) : (
            <>
              <p className="cab-card__sub">
                {kz ? "Бұрын көрмеген нұсқалар саны:" : "Сколько вариантов вы ещё не видели:"}
              </p>
              <ul className="fresh-list">
                {freshRows.map((r) => (
                  <li key={r.name} className={r.total > 0 && r.fresh === 0 ? "is-out" : ""}>
                    <span>{r.name}</span>
                    <strong>
                      {r.total === 0
                        ? kz
                          ? "нұсқа жоқ"
                          : "нет вариантов"
                        : kz
                          ? `${r.fresh} / ${r.total}`
                          : `${r.fresh} из ${r.total}`}
                    </strong>
                  </li>
                ))}
              </ul>
              {repeats.length > 0 && (
                <p className="fresh__warn">
                  {kz
                    ? `Қайталанады: ${repeats.map((r) => r.name).join(", ")}. Бұл жағдайда ең ерте тапсырған нұсқа беріледі.`
                    : `Повторятся: ${repeats.map((r) => r.name).join(", ")}. В этом случае дадим вариант, который был давнее всего.`}
                </p>
              )}
            </>
          )}
        </section>
      </div>

      {exams.length > 0 && (
        <section className="cab-card">
          <div className="cab-card__head">
            <h2>{kz ? "Соңғы ҰБТ" : "Последние ЕНТ"}</h2>
            <Link to="/cabinet/results" className="cab-more">
              {kz ? "Барлығы" : "Все"}
            </Link>
          </div>
          <ul className="recent">
            {[...exams]
              .reverse()
              .slice(0, 3)
              .map((e) => (
                <li key={e.sessionId}>
                  <Link to={`/exam/results/${e.sessionId}`}>
                    <span>
                      <strong>{formatDate(e.finishedAt)}</strong>
                      <small>
                        {e.profileSubjects.length
                          ? e.profileSubjects.map((s) => translateSubject(s, lang)).join(" + ")
                          : kz
                            ? "ҰБТ"
                            : "ЕНТ"}
                      </small>
                    </span>
                    <span className="recent__score">
                      {grade(e)}
                      <small> / 140</small>
                    </span>
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      )}
    </>
  );
}
