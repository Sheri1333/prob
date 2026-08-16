import { mediaUrl } from "../../api/client";
import type { Question, QuestionType } from "../../types/test";
import { convertQuestionType, isAnswerKeyComplete } from "../../utils/answerKey";

const TYPE_LABEL: Record<QuestionType, string> = {
  single_choice: "Одиночный",
  matching: "Сопоставление",
  multiple_choice: "Множественный",
};

interface AnswerKeyEditorProps {
  questions: Question[];
  onChange: (questions: Question[]) => void;
  openId: number | null;
  onOpen: (id: number | null) => void;
  onlyMissing: boolean;
}

export function AnswerKeyEditor({
  questions,
  onChange,
  openId,
  onOpen,
  onlyMissing,
}: AnswerKeyEditorProps) {
  const updateAt = (index: number, next: Question) => {
    const copy = [...questions];
    copy[index] = next;
    onChange(copy);
  };

  const visible = questions
    .map((q, index) => ({ q, index }))
    .filter(({ q }) => !onlyMissing || !isAnswerKeyComplete(q));

  if (visible.length === 0) {
    return <p className="admin-hint">Все вопросы уже с ключами ответов.</p>;
  }

  return (
    <div className="admin-preview__questions">
      {visible.map(({ q, index }) => {
        const open = openId === q.id;
        const keyed = isAnswerKeyComplete(q);
        return (
          <article
            key={q.id}
            className={`admin-q ${open ? "admin-q--open" : ""} ${
              keyed ? "admin-q--keyed" : "admin-q--missing"
            }`}
          >
            <button
              type="button"
              className="admin-q__head"
              onClick={() => onOpen(open ? null : q.id)}
            >
              <span className="admin-q__num">№{q.id}</span>
              <span className="admin-q__type">{TYPE_LABEL[q.type]}</span>
              <span
                className={`admin-q__key ${keyed ? "admin-q__key--ok" : "admin-q__key--miss"}`}
              >
                {keyed ? "ключ есть" : "нет ключа"}
              </span>
              {(q.images?.length ?? 0) > 0 && (
                <span className="admin-q__img">{q.images!.length} фото</span>
              )}
              <span className="admin-q__text">{q.text || "Без текста"}</span>
            </button>
            {open && (
              <div className="admin-q__body">
                <label className="admin-q__field">
                  Тип вопроса
                  <select
                    value={q.type}
                    onChange={(e) =>
                      updateAt(
                        index,
                        convertQuestionType(q, e.target.value as QuestionType),
                      )
                    }
                  >
                    <option value="single_choice">Один ответ</option>
                    <option value="multiple_choice">Несколько ответов</option>
                    <option value="matching">Сопоставление</option>
                  </select>
                </label>
                <label className="admin-q__field">
                  Текст
                  <textarea
                    rows={3}
                    value={q.text}
                    onChange={(e) =>
                      updateAt(index, { ...q, text: e.target.value })
                    }
                  />
                </label>

                {q.images && q.images.length > 0 && (
                  <div className="admin-q__photos">
                    {q.images.map((src, i) => (
                      <img
                        key={`${q.id}-${i}`}
                        src={mediaUrl(src)}
                        alt={`Вопрос ${q.id} рис. ${i + 1}`}
                      />
                    ))}
                  </div>
                )}

                {q.type === "matching" ? (
                  <MatchingKey
                    question={q}
                    onChange={(next) => updateAt(index, next)}
                  />
                ) : (
                  <ChoiceKey
                    question={q}
                    onChange={(next) => updateAt(index, next)}
                  />
                )}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

function ChoiceKey({
  question,
  onChange,
}: {
  question: Extract<Question, { type: "single_choice" | "multiple_choice" }>;
  onChange: (q: Question) => void;
}) {
  const selected =
    question.type === "single_choice"
      ? question.correctAnswer
        ? [question.correctAnswer]
        : []
      : question.correctAnswers ?? [];

  const toggle = (id: string) => {
    if (question.type === "single_choice") {
      onChange({
        ...question,
        correctAnswer: question.correctAnswer === id ? "" : id,
      });
      return;
    }
    const next = selected.includes(id)
      ? selected.filter((v) => v !== id)
      : [...selected, id];
    onChange({ ...question, correctAnswers: next });
  };

  const updateLabel = (id: string, label: string) => {
    onChange({
      ...question,
      options: question.options.map((o) => (o.id === id ? { ...o, label } : o)),
    });
  };

  return (
    <div>
      <p className="admin-hint">
        {question.type === "single_choice"
          ? "Нажмите на правильный вариант — его отметит система как ключ."
          : "Отметьте все правильные варианты (обычно два)."}
      </p>
      <div className="admin-key-opts">
        {question.options.map((option) => {
          const on = selected.includes(option.id);
          return (
            <div
              key={option.id}
              className={`admin-key-opt ${on ? "admin-key-opt--on" : ""}`}
            >
              <button
                type="button"
                className="admin-key-opt__mark"
                onClick={() => toggle(option.id)}
              >
                <span className="admin-key-opt__letter">{option.id}</span>
                {on ? "правильный" : "отметить"}
              </button>
              <input
                value={option.label}
                onChange={(e) => updateLabel(option.id, e.target.value)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MatchingKey({
  question,
  onChange,
}: {
  question: Extract<Question, { type: "matching" }>;
  onChange: (q: Extract<Question, { type: "matching" }>) => void;
}) {
  const pairs = question.correctAnswers ?? {};
  const used = new Set(Object.values(pairs));

  const setPair = (rowId: string, optionId: string) => {
    const next = { ...pairs };
    if (!optionId) delete next[rowId];
    else next[rowId] = optionId;
    onChange({ ...question, correctAnswers: next });
  };

  const updateRow = (rowId: string, label: string) => {
    onChange({
      ...question,
      rows: question.rows.map((r) => (r.id === rowId ? { ...r, label } : r)),
    });
  };

  const addRow = () => {
    const nextNum =
      question.rows.reduce((max, r) => {
        const n = Number(r.id);
        return Number.isFinite(n) ? Math.max(max, n) : max;
      }, 0) + 1;
    onChange({
      ...question,
      rows: [...question.rows, { id: String(nextNum), label: "" }],
    });
  };

  const removeRow = (rowId: string) => {
    const nextPairs = { ...pairs };
    delete nextPairs[rowId];
    onChange({
      ...question,
      rows: question.rows.filter((r) => r.id !== rowId),
      correctAnswers: nextPairs,
    });
  };

  const updateOption = (id: string, label: string) => {
    onChange({
      ...question,
      options: question.options.map((o) => (o.id === id ? { ...o, label } : o)),
    });
  };

  return (
    <div className="admin-match">
      <p className="admin-hint">
        Слева — пункты 1, 2… Справа — варианты A, B, C, D. Для каждой строки
        выберите букву. Одна буква — только к одной строке.
      </p>
      <div className="admin-match__grid">
        <div className="admin-match__col">
          <strong>Строки</strong>
          {question.rows.map((row) => (
            <div key={row.id} className="admin-match__row">
              <span className="admin-match__id">{row.id}.</span>
              <input
                value={row.label}
                onChange={(e) => updateRow(row.id, e.target.value)}
                placeholder="Текст строки"
              />
              <select
                value={pairs[row.id] ?? ""}
                onChange={(e) => setPair(row.id, e.target.value)}
              >
                <option value="">— буква —</option>
                {question.options.map((opt) => (
                  <option
                    key={opt.id}
                    value={opt.id}
                    disabled={used.has(opt.id) && pairs[row.id] !== opt.id}
                  >
                    {opt.id}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="admin-match__remove"
                onClick={() => removeRow(row.id)}
              >
                ×
              </button>
            </div>
          ))}
          <button type="button" className="admin-match__add" onClick={addRow}>
            + строка
          </button>
        </div>
        <div className="admin-match__col">
          <strong>Варианты</strong>
          {question.options.map((opt) => {
            const pairedRow = question.rows.find((r) => pairs[r.id] === opt.id);
            return (
              <div
                key={opt.id}
                className={`admin-match__opt ${pairedRow ? "admin-match__opt--on" : ""}`}
              >
                <span className="admin-match__id">{opt.id})</span>
                <input
                  value={opt.label}
                  onChange={(e) => updateOption(opt.id, e.target.value)}
                />
                <span className="admin-match__pair">
                  {pairedRow ? `← ${pairedRow.id}` : ""}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
