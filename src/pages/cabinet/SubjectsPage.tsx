import { useMemo } from "react";
import { useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import { PercentBars, ScoreLine, StackBar } from "../../components/Charts";
import { translateSubject } from "../../i18n/subjects";
import { useDocumentTitle } from "../../utils/useDocumentTitle";
import { bySheetOrder, pct, shortDate, subjectStats, type CabinetData, type SubjectStat } from "./data";

const TYPE_LABEL = {
  single_choice: { kz: "Бір жауапты", ru: "С одним ответом" },
  multiple_choice: { kz: "Бірнеше жауапты", ru: "С несколькими ответами" },
  matching: { kz: "Сәйкестендіру", ru: "На соответствие" },
} as const;

/** Advice built from this subject's own numbers; nothing generic. */
function tipsFor(s: SubjectStat, kz: boolean): string[] {
  const tips: string[] = [];
  const answeredAll = s.totals.correct + s.totals.partial + s.totals.wrong + s.totals.skipped;
  if (s.totals.skipped > 0) {
    tips.push(
      kz
        ? `${s.totals.skipped} сұрақ жауапсыз қалды (${pct(s.totals.skipped, answeredAll)}%). ҰБТ-да қате жауап үшін балл шегерілмейді, сондықтан әр сұрақты белгілеңіз.`
        : `${s.totals.skipped} вопросов остались без ответа (${pct(s.totals.skipped, answeredAll)}%). На ЕНТ за неверный ответ баллы не снимают, так что отмечайте ответ в каждом вопросе.`,
    );
  }
  if (s.totals.partial > 0) {
    tips.push(
      kz
        ? `${s.totals.partial} тапсырмадан жартылай балл алдыңыз: 2 балдық тапсырмада бір қате 1 балл қалдырады. Әр нұсқаны соңына дейін тексеріңіз.`
        : `В ${s.totals.partial} заданиях вы получили часть баллов: в 2-балльном задании одна ошибка оставляет 1 балл. Проверяйте каждый вариант до конца.`,
    );
  }
  const single = s.byType.single_choice;
  const multi = s.byType.multiple_choice;
  if (single.total >= 5 && multi.total >= 3 && pct(multi.correct, multi.total) + 15 < pct(single.correct, single.total)) {
    tips.push(
      kz
        ? "Бірнеше жауапты сұрақтар бір жауаптыларға қарағанда әлсіз. Мұндай сұрақта бір емес, бірнеше дұрыс жауап болуы мүмкін екенін ұмытпаңыз."
        : "Вопросы с несколькими ответами даются хуже, чем с одним. Помните, что верных ответов там может быть больше одного.",
    );
  }
  if (s.byWeight && s.byWeight.two.total >= 3) {
    const one = pct(s.byWeight.one.correct, s.byWeight.one.total);
    const two = pct(s.byWeight.two.correct, s.byWeight.two.total);
    if (two + 10 < one) {
      tips.push(
        kz
          ? `31–40 тапсырмалар екі есе қымбат, бірақ олардағы нәтиже ${two}%, ал 1–30-да ${one}%. Уақыттың бір бөлігін соңғы он тапсырмаға қалдырыңыз.`
          : `Задания 31–40 стоят вдвое больше, но в них ${two}% против ${one}% в 1–30. Оставляйте часть времени на последние десять.`,
      );
    }
  }
  if (s.change !== null && s.change >= 10) {
    tips.push(
      kz
        ? `Бірінші тапсырудан бері +${s.change} пайыздық тармақ. Осы қарқынмен жалғастырыңыз.`
        : `С первой попытки +${s.change} процентных пунктов. Продолжайте в том же темпе.`,
    );
  }
  return tips;
}

export function SubjectsPage() {
  const { lang, loading, exams } = useOutletContext<CabinetData>();
  const kz = lang === "kz";
  useDocumentTitle(kz ? "Пәндер" : "Предметы");
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();

  const subjects = useMemo(() => subjectStats(exams).sort(bySheetOrder), [exams]);
  const weakest = useMemo(
    () => [...subjects].sort((a, b) => a.avgPct - b.avgPct)[0],
    [subjects],
  );
  const selected = subjects.find((s) => s.key === params.get("s")) ?? weakest;

  if (loading) return <p className="cab-empty">{kz ? "Жүктелуде…" : "Загрузка…"}</p>;

  if (!selected) {
    return (
      <>
        <header className="cab-title">
          <div>
            <h1>{kz ? "Пәндер" : "Предметы"}</h1>
          </div>
        </header>
        <section className="cab-card">
          <p className="cab-empty">
            {kz
              ? "Бірінші ҰБТ-дан кейін мұнда әр пәннің талдауы шығады: динамика, қате түрлері, сұрақ түрлері бойынша дәлдік."
              : "После первого ЕНТ здесь появится разбор каждого предмета: динамика, типы ошибок, точность по типам вопросов."}
          </p>
        </section>
      </>
    );
  }

  const name = translateSubject(selected.name, lang);
  const tips = tipsFor(selected, kz);
  const typeRows = (Object.keys(TYPE_LABEL) as Array<keyof typeof TYPE_LABEL>)
    .filter((t) => selected.byType[t].total > 0)
    .map((t) => ({
      key: t,
      label: kz ? TYPE_LABEL[t].kz : TYPE_LABEL[t].ru,
      pct: pct(selected.byType[t].correct, selected.byType[t].total),
      note: kz
        ? `${selected.byType[t].correct} / ${selected.byType[t].total} дұрыс`
        : `${selected.byType[t].correct} из ${selected.byType[t].total} верно`,
    }));
  const lowestType = typeRows.length > 1 ? Math.min(...typeRows.map((r) => r.pct)) : null;
  const hasDetail =
    selected.totals.correct + selected.totals.partial + selected.totals.wrong + selected.totals.skipped > 0;

  return (
    <>
      <header className="cab-title">
        <div>
          <h1>{kz ? "Пәндер" : "Предметы"}</h1>
          <p>{kz ? "Барлық тапсырған ҰБТ бойынша талдау" : "Разбор по всем пройденным ЕНТ"}</p>
        </div>
      </header>

      <div className="subject-pills" role="tablist" aria-label={kz ? "Пән таңдау" : "Выбор предмета"}>
        {subjects.map((s) => (
          <button
            key={s.key}
            type="button"
            role="tab"
            aria-selected={s.key === selected.key}
            className={s.key === selected.key ? "is-on" : ""}
            onClick={() => setParams({ s: s.key }, { replace: true })}
          >
            {translateSubject(s.name, lang)}
            <span>{s.avgPct}%</span>
          </button>
        ))}
      </div>

      <section className="cab-card">
        <div className="subject-head">
          <h2>{name}</h2>
          <dl>
            <div>
              <dt>{kz ? "орташа" : "в среднем"}</dt>
              <dd>{selected.avgPct}%</dd>
            </div>
            <div>
              <dt>{kz ? "үздік" : "лучший"}</dt>
              <dd>{selected.bestPct}%</dd>
            </div>
            <div>
              <dt>{kz ? "соңғы" : "последний"}</dt>
              <dd>
                {selected.lastPct}%
                {selected.change !== null && selected.change !== 0 && (
                  <em className={selected.change > 0 ? "is-up" : "is-down"}>
                    {selected.change > 0 ? `+${selected.change}` : selected.change}
                  </em>
                )}
              </dd>
            </div>
            <div>
              <dt>{kz ? "тапсырылды" : "попыток"}</dt>
              <dd>{selected.attempts.length}</dd>
            </div>
          </dl>
        </div>

        {selected.attempts.length > 1 ? (
          <>
            <h3 className="cab-h3">{kz ? "Пайыз бойынша динамика" : "Динамика в процентах"}</h3>
            <ScoreLine
              points={selected.attempts.map((a) => ({
                id: a.sessionId,
                label: shortDate(a.finishedAt),
                value: a.pct,
              }))}
              max={100}
              ticks={[0, 25, 50, 75, 100]}
              unit="%"
              height={200}
              formatValue={(v) => `${v}`}
              onPick={(p) => navigate(`/exam/results/${p.id}`)}
            />
          </>
        ) : (
          <p className="cab-card__sub">
            {kz
              ? `Бір рет тапсырылды: ${selected.attempts[0].score} / ${selected.attempts[0].maxScore}. Динамика екінші тапсырудан кейін шығады.`
              : `Сдано один раз: ${selected.attempts[0].score} из ${selected.attempts[0].maxScore}. Динамика появится после второй попытки.`}
          </p>
        )}
      </section>

      {hasDetail && (
        <div className="cab-grid">
          <section className="cab-card">
            <h2>{kz ? "Жауаптар" : "Ответы"}</h2>
            <p className="cab-card__sub">
              {kz ? "Барлық тапсыру бойынша барлық сұрақтар" : "Все вопросы за все попытки"}
            </p>
            <StackBar
              parts={[
                { key: "correct", label: kz ? "Дұрыс" : "Верно", value: selected.totals.correct },
                { key: "partial", label: kz ? "Жартылай" : "Частично", value: selected.totals.partial },
                { key: "wrong", label: kz ? "Қате" : "Неверно", value: selected.totals.wrong },
                { key: "skipped", label: kz ? "Жауапсыз" : "Без ответа", value: selected.totals.skipped },
              ]}
            />
          </section>

          <section className="cab-card">
            <h2>{kz ? "Сұрақ түрлері" : "Типы вопросов"}</h2>
            <p className="cab-card__sub">{kz ? "Толық дұрыс жауаптар үлесі" : "Доля полностью верных ответов"}</p>
            <PercentBars
              rows={typeRows.map((r) => ({ ...r, highlight: lowestType !== null && r.pct === lowestType }))}
            />
            {selected.byWeight && selected.byWeight.two.total > 0 && (
              <>
                <h3 className="cab-h3">{kz ? "Тапсырма құны" : "Цена задания"}</h3>
                <PercentBars
                  rows={[
                    {
                      key: "one",
                      label: kz ? "1–30, 1 балл" : "1–30, 1 балл",
                      pct: pct(selected.byWeight.one.correct, selected.byWeight.one.total),
                      note: kz
                        ? `${selected.byWeight.one.correct} / ${selected.byWeight.one.total} дұрыс`
                        : `${selected.byWeight.one.correct} из ${selected.byWeight.one.total} верно`,
                    },
                    {
                      key: "two",
                      label: kz ? "31–40, 2 балл" : "31–40, 2 балла",
                      pct: pct(selected.byWeight.two.correct, selected.byWeight.two.total),
                      note: kz
                        ? `${selected.byWeight.two.correct} / ${selected.byWeight.two.total} дұрыс`
                        : `${selected.byWeight.two.correct} из ${selected.byWeight.two.total} верно`,
                    },
                  ]}
                />
              </>
            )}
          </section>
        </div>
      )}

      {tips.length > 0 && (
        <section className="cab-card">
          <h2>{kz ? "Не істеу керек" : "Что делать"}</h2>
          <ul className="tips">
            {tips.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
