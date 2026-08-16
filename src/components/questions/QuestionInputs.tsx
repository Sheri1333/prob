import type { Lang } from "../../i18n/strings";
import type { TestOption } from "../../types/test";

interface SingleChoiceQuestionProps {
  name: string;
  options: TestOption[];
  value?: string;
  onChange: (value: string) => void;
}

export function SingleChoiceQuestion({
  name,
  options,
  value,
  onChange,
}: SingleChoiceQuestionProps) {
  return (
    <div className="option-grid">
      {options.map((option) => {
        const selected = value === option.id;
        return (
          <label
            key={option.id}
            className={`option-card ${selected ? "option-card--selected" : ""}`}
          >
            <input
              className="option-card__input"
              type="radio"
              name={name}
              checked={selected}
              onChange={() => onChange(option.id)}
            />
            <span className="option-card__letter">{option.id}</span>
            <span className="option-card__text">{option.label}</span>
          </label>
        );
      })}
    </div>
  );
}

interface MultipleChoiceQuestionProps {
  options: TestOption[];
  value: string[];
  onChange: (value: string[]) => void;
}

export function MultipleChoiceQuestion({
  options,
  value,
  onChange,
}: MultipleChoiceQuestionProps) {
  const toggle = (id: string) => {
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id));
    } else {
      onChange([...value, id]);
    }
  };

  return (
    <div className="option-grid">
      {options.map((option) => {
        const selected = value.includes(option.id);
        return (
          <label
            key={option.id}
            className={`option-card ${selected ? "option-card--selected" : ""}`}
          >
            <input
              className="option-card__input"
              type="checkbox"
              checked={selected}
              onChange={() => toggle(option.id)}
            />
            <span className="option-card__letter">{option.id}</span>
            <span className="option-card__text">{option.label}</span>
          </label>
        );
      })}
    </div>
  );
}

interface MatchingQuestionProps {
  lang: Lang;
  rows: { id: string; label: string }[];
  options: TestOption[];
  value: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
}

export function MatchingQuestion({
  lang,
  rows,
  options,
  value,
  onChange,
}: MatchingQuestionProps) {
  const placeholder = lang === "kz" ? "Жауапты таңдаңыз" : "Выберите ответ";
  const used = new Set(
    Object.entries(value)
      .filter(([, optionId]) => optionId)
      .map(([, optionId]) => optionId),
  );

  return (
    <div className="matching-block">
      <div className="matching-legend">
        {options.map((opt) => (
          <div key={opt.id} className="matching-legend__item">
            <span className="matching-legend__id">{opt.id})</span>
            <span>{opt.label}</span>
          </div>
        ))}
      </div>
      <div className="matching-table">
        {rows.map((row) => (
          <div key={row.id} className="matching-row">
            <div className="matching-row__term">
              {row.id}. {row.label}
            </div>
            <select
              className="matching-row__select"
              value={value[row.id] ?? ""}
              onChange={(e) =>
                onChange({ ...value, [row.id]: e.target.value })
              }
            >
              <option value="">{placeholder}</option>
              {options.map((opt) => (
                <option
                  key={opt.id}
                  value={opt.id}
                  disabled={used.has(opt.id) && value[row.id] !== opt.id}
                >
                  {opt.id}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}
