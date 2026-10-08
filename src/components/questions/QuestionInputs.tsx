import { mediaUrl } from "../../api/client";
import type { Lang } from "../../i18n/strings";
import { t } from "../../i18n/strings";
import type { MatchingRow, TestOption } from "../../types/test";

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
  rows: MatchingRow[];
  options: TestOption[];
  value: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
  onZoom?: (src: string) => void;
}

export function MatchingQuestion({
  lang,
  rows,
  options,
  value,
  onChange,
  onZoom,
}: MatchingQuestionProps) {
  const picked = (rowId: string) =>
    (value[rowId] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  // A row may take one or several options (ҰБТ: "A — 3, 4").
  const toggle = (rowId: string, optionId: string) => {
    const current = picked(rowId);
    const next = current.includes(optionId)
      ? current.filter((id) => id !== optionId)
      : [...current, optionId].sort();
    onChange({ ...value, [rowId]: next.join(",") });
  };
  const hint =
    lang === "kz"
      ? "Әр жолға бір немесе бірнеше жауап таңдаңыз"
      : "Для каждой строки выберите один или несколько ответов";

  return (
    <div className="matching-block">
      <p className="matching-hint">{hint}</p>
      <div className="matching-legend">
        {options.map((opt) => (
          <div key={opt.id} className="matching-legend__item">
            <span className="matching-legend__id">{opt.id})</span>
            <span>{opt.label}</span>
          </div>
        ))}
      </div>
      <div className="matching-table">
        {rows.map((row) => {
          const imageUrl = row.image ? mediaUrl(row.image) : "";
          return (
            <div
              key={row.id}
              className={`matching-row${imageUrl ? " matching-row--media" : ""}`}
            >
              <div className="matching-row__term">
                <span className="matching-row__id">{row.id})</span>
                <div className="matching-row__prompt">
                  {imageUrl && (
                    <div className="matching-row__figure">
                      <img src={imageUrl} alt="" />
                      {onZoom && (
                        <button
                          type="button"
                          className="exam-card__zoom"
                          onClick={() => onZoom(imageUrl)}
                        >
                          <span className="material-symbols-outlined">
                            zoom_in
                          </span>
                          {t("zoomImage", lang)}
                        </button>
                      )}
                    </div>
                  )}
                  {row.label ? <span>{row.label}</span> : null}
                </div>
              </div>
              <div
                className="matching-row__choices"
                role="group"
                aria-label={row.label || row.id}
              >
                {options.map((opt) => {
                  const on = picked(row.id).includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      aria-pressed={on}
                      title={opt.label}
                      className={`matching-chip${on ? " is-on" : ""}`}
                      onClick={() => toggle(row.id, opt.id)}
                    >
                      {opt.id}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
