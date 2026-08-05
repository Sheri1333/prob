import type { Lang } from "../../i18n/strings";
import type { TestOption } from "../../types/test";

interface SingleChoiceQuestionProps {
  options: TestOption[];
  value?: string;
  onChange: (value: string) => void;
}

export function SingleChoiceQuestion({
  options,
  value,
  onChange,
}: SingleChoiceQuestionProps) {
  return (
    <div className="options-list">
      {options.map((option) => (
        <label key={option.id} className="option-row">
          <input
            type="radio"
            name="single-choice"
            checked={value === option.id}
            onChange={() => onChange(option.id)}
          />
          <span className="option-row__label">
            {option.id}) {option.label}
          </span>
        </label>
      ))}
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
    <div className="options-list options-list--checkbox">
      {options.map((option) => (
        <label key={option.id} className="option-row">
          <input
            type="checkbox"
            checked={value.includes(option.id)}
            onChange={() => toggle(option.id)}
          />
          <span className="option-row__label">
            {option.id}) {option.label}
          </span>
        </label>
      ))}
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

  return (
    <div className="matching-table">
      {rows.map((row) => (
        <div key={row.id} className="matching-row">
          <div className="matching-row__term">
            {row.id}) {row.label}
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
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}
