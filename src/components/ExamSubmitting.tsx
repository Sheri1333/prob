import { useEffect, useState } from "react";
import type { Lang } from "../i18n/strings";

const STEPS = {
  kz: ["Жауаптар жиналуда", "Жауаптар тексерілуде", "Балл есептелуде", "Нәтиже дайындалуда"],
  ru: ["Собираем ответы", "Проверяем ответы", "Считаем баллы", "Готовим результат"],
};

/** Full-screen "calculating your result" screen shown while the exam is submitted. */
export function ExamSubmitting({ lang }: { lang: Lang }) {
  const steps = STEPS[lang];
  const [step, setStep] = useState(0);

  useEffect(() => {
    const id = window.setInterval(
      () => setStep((s) => Math.min(s + 1, steps.length - 1)),
      800,
    );
    return () => window.clearInterval(id);
  }, [steps.length]);

  return (
    <div className="exam-submitting" role="status" aria-live="polite">
      <div className="exam-submitting__card">
        <div className="exam-submitting__spinner" aria-hidden />
        <h2>{lang === "kz" ? "ҰБТ аяқталды" : "ЕНТ завершён"}</h2>
        <ul className="exam-submitting__steps">
          {steps.map((label, i) => (
            <li
              key={label}
              className={i < step ? "is-done" : i === step ? "is-active" : ""}
            >
              <span className="material-symbols-outlined">
                {i < step ? "check_circle" : "radio_button_unchecked"}
              </span>
              {label}
            </li>
          ))}
        </ul>
        <div className="exam-submitting__bar">
          <span style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
        </div>
      </div>
    </div>
  );
}
