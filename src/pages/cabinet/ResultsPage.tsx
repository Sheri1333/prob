import { Link, useOutletContext } from "react-router-dom";
import type { ExamAnalytics, SectionAnalytics } from "../../api/client";
import { translateSubject } from "../../i18n/subjects";
import { useDocumentTitle } from "../../utils/useDocumentTitle";
import { formatDate, grade, type CabinetData } from "./data";

type Column = {
  key: string;
  kz: string;
  ru: string;
  max: number;
  pick: (e: ExamAnalytics) => SectionAnalytics | undefined;
};

const bySubject = (block: SectionAnalytics["block"]) => (e: ExamAnalytics) =>
  e.sections.find((s) => s.block === block);
const profileAt = (n: number) => (e: ExamAnalytics) =>
  e.sections.filter((s) => s.block === "profile")[n];

const COLUMNS: Column[] = [
  { key: "history", kz: "Тарих", ru: "История", max: 20, pick: bySubject("history") },
  { key: "reading", kz: "Оқу", ru: "Чтение", max: 10, pick: bySubject("reading") },
  { key: "math", kz: "Мат. сауат.", ru: "Мат. грам.", max: 10, pick: bySubject("math_literacy") },
  { key: "p1", kz: "1-бейіндік", ru: "Профиль 1", max: 50, pick: profileAt(0) },
  { key: "p2", kz: "2-бейіндік", ru: "Профиль 2", max: 50, pick: profileAt(1) },
];

export function ResultsPage() {
  const { lang, loading, exams } = useOutletContext<CabinetData>();
  const kz = lang === "kz";
  useDocumentTitle(kz ? "Нәтижелер" : "Результаты");

  const rows = [...exams].reverse();
  const grades = exams.map(grade);
  const best = grades.length ? Math.max(...grades) : null;
  const avgOf = (col: Column) => {
    const vals = exams.map(col.pick).filter((s): s is SectionAnalytics => !!s);
    return vals.length ? (vals.reduce((sum, s) => sum + s.score, 0) / vals.length).toFixed(1) : "—";
  };
  const avgTotal = grades.length ? (grades.reduce((s, g) => s + g, 0) / grades.length).toFixed(1) : "—";
  const avgMinutes = exams.length
    ? Math.round(exams.reduce((s, e) => s + e.durationMin, 0) / exams.length)
    : 0;

  return (
    <>
      <header className="cab-title">
        <div>
          <h1>{kz ? "Нәтижелер" : "Результаты"}</h1>
          <p>
            {kz
              ? "Әр ҰБТ бөлімдер бойынша. Толық талдау үшін жолды ашыңыз."
              : "Каждый ЕНТ по разделам. Откройте строку для полного разбора."}
          </p>
        </div>
      </header>

      {loading ? (
        <p className="cab-empty">{kz ? "Жүктелуде…" : "Загрузка…"}</p>
      ) : exams.length === 0 ? (
        <section className="cab-card">
          <p className="cab-empty">
            {kz
              ? "Әзірге тапсырылған ҰБТ жоқ. Бірінші тапсырудан кейін мұнда әр бөлімнің балы шығады."
              : "Пока нет пройденных ЕНТ. После первого здесь появятся баллы по каждому разделу."}
          </p>
        </section>
      ) : (
        <>
          <section className="cab-card cab-card--flush">
            <div className="results-scroll">
              <table className="results-table">
                <thead>
                  <tr>
                    <th scope="col">{kz ? "Күні" : "Дата"}</th>
                    {COLUMNS.map((c) => (
                      <th key={c.key} scope="col" className="num">
                        {kz ? c.kz : c.ru}
                        <small>/ {c.max}</small>
                      </th>
                    ))}
                    <th scope="col" className="num">
                      {kz ? "Барлығы" : "Итого"}
                      <small>/ 140</small>
                    </th>
                    <th scope="col" className="num">
                      {kz ? "Уақыт" : "Время"}
                      <small>{kz ? "мин" : "мин"}</small>
                    </th>
                    <th scope="col">
                      <span className="visually-hidden">{kz ? "Талдау" : "Разбор"}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((e) => {
                    const g = grade(e);
                    return (
                      <tr key={e.sessionId}>
                        <th scope="row">
                          {formatDate(e.finishedAt)}
                          <small>
                            {e.profileSubjects.map((s) => translateSubject(s, lang)).join(" + ")}
                          </small>
                        </th>
                        {COLUMNS.map((c) => {
                          const s = c.pick(e);
                          return (
                            <td key={c.key} className="num">
                              {s ? s.score : "—"}
                            </td>
                          );
                        })}
                        <td className="num results-table__total">
                          {g === best && <i className="results-table__best" title={kz ? "Үздік" : "Лучший"} />}
                          {g}
                        </td>
                        <td className="num">
                          <span className="time-cell">
                            <span className="time-cell__track" aria-hidden="true">
                              <span style={{ width: `${(e.durationMin / 240) * 100}%` }} />
                            </span>
                            {e.durationMin}
                          </span>
                        </td>
                        <td>
                          <Link to={`/exam/results/${e.sessionId}`} className="cab-more">
                            {kz ? "Талдау" : "Разбор"}
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row">{kz ? "Орташа" : "Среднее"}</th>
                    {COLUMNS.map((c) => (
                      <td key={c.key} className="num">
                        {avgOf(c)}
                      </td>
                    ))}
                    <td className="num results-table__total">{avgTotal}</td>
                    <td className="num">{avgMinutes}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          <section className="cab-card">
            <h2>{kz ? "Уақытты пайдалану" : "Как вы тратите время"}</h2>
            <p className="cab-card__sub">
              {avgMinutes < 150
                ? kz
                  ? `Орташа ${avgMinutes} минут 240-тан. Уақыт көп қалады: аяқтамас бұрын жауапсыз және күмәнді сұрақтарды қайта қараңыз.`
                  : `В среднем ${avgMinutes} минут из 240. Времени остаётся много: перед завершением пройдитесь по пропущенным и сомнительным вопросам.`
                : avgMinutes > 225
                  ? kz
                    ? `Орташа ${avgMinutes} минут 240-тан. Уақыт шегіне жақын: қиын сұраққа тұрып қалмай, соңына қалдырыңыз.`
                    : `В среднем ${avgMinutes} минут из 240. Это почти весь лимит: не застревайте на трудных вопросах, оставляйте их на конец.`
                  : kz
                    ? `Орташа ${avgMinutes} минут 240-тан. Уақыт қалыпты бөлінген.`
                    : `В среднем ${avgMinutes} минут из 240. Время распределено нормально.`}
            </p>
          </section>
        </>
      )}
    </>
  );
}
