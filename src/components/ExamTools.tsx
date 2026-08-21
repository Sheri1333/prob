import { useEffect, useState } from "react";
import type { Lang } from "../i18n/strings";

type ToolId = "calculator" | "mendeleev" | null;

interface ExamToolsProps {
  lang: Lang;
}

const ELEMENTS: Array<{
  z: number;
  symbol: string;
  nameRu: string;
  nameKz: string;
  mass: string;
  group?: number;
  period: number;
}> = [
  { z: 1, symbol: "H", nameRu: "Водород", nameKz: "Сутек", mass: "1.008", group: 1, period: 1 },
  { z: 2, symbol: "He", nameRu: "Гелий", nameKz: "Гелий", mass: "4.003", group: 18, period: 1 },
  { z: 3, symbol: "Li", nameRu: "Литий", nameKz: "Литий", mass: "6.94", group: 1, period: 2 },
  { z: 4, symbol: "Be", nameRu: "Бериллий", nameKz: "Бериллий", mass: "9.012", group: 2, period: 2 },
  { z: 5, symbol: "B", nameRu: "Бор", nameKz: "Бор", mass: "10.81", group: 13, period: 2 },
  { z: 6, symbol: "C", nameRu: "Углерод", nameKz: "Көміртек", mass: "12.01", group: 14, period: 2 },
  { z: 7, symbol: "N", nameRu: "Азот", nameKz: "Азот", mass: "14.01", group: 15, period: 2 },
  { z: 8, symbol: "O", nameRu: "Кислород", nameKz: "Оттек", mass: "16.00", group: 16, period: 2 },
  { z: 9, symbol: "F", nameRu: "Фтор", nameKz: "Фтор", mass: "19.00", group: 17, period: 2 },
  { z: 10, symbol: "Ne", nameRu: "Неон", nameKz: "Неон", mass: "20.18", group: 18, period: 2 },
  { z: 11, symbol: "Na", nameRu: "Натрий", nameKz: "Натрий", mass: "22.99", group: 1, period: 3 },
  { z: 12, symbol: "Mg", nameRu: "Магний", nameKz: "Магний", mass: "24.31", group: 2, period: 3 },
  { z: 13, symbol: "Al", nameRu: "Алюминий", nameKz: "Алюминий", mass: "26.98", group: 13, period: 3 },
  { z: 14, symbol: "Si", nameRu: "Кремний", nameKz: "Кремний", mass: "28.09", group: 14, period: 3 },
  { z: 15, symbol: "P", nameRu: "Фосфор", nameKz: "Фосфор", mass: "30.97", group: 15, period: 3 },
  { z: 16, symbol: "S", nameRu: "Сера", nameKz: "Күкірт", mass: "32.06", group: 16, period: 3 },
  { z: 17, symbol: "Cl", nameRu: "Хлор", nameKz: "Хлор", mass: "35.45", group: 17, period: 3 },
  { z: 18, symbol: "Ar", nameRu: "Аргон", nameKz: "Аргон", mass: "39.95", group: 18, period: 3 },
  { z: 19, symbol: "K", nameRu: "Калий", nameKz: "Калий", mass: "39.10", group: 1, period: 4 },
  { z: 20, symbol: "Ca", nameRu: "Кальций", nameKz: "Кальций", mass: "40.08", group: 2, period: 4 },
  { z: 21, symbol: "Sc", nameRu: "Скандий", nameKz: "Скандий", mass: "44.96", group: 3, period: 4 },
  { z: 22, symbol: "Ti", nameRu: "Титан", nameKz: "Титан", mass: "47.87", group: 4, period: 4 },
  { z: 23, symbol: "V", nameRu: "Ванадий", nameKz: "Ванадий", mass: "50.94", group: 5, period: 4 },
  { z: 24, symbol: "Cr", nameRu: "Хром", nameKz: "Хром", mass: "52.00", group: 6, period: 4 },
  { z: 25, symbol: "Mn", nameRu: "Марганец", nameKz: "Марганец", mass: "54.94", group: 7, period: 4 },
  { z: 26, symbol: "Fe", nameRu: "Железо", nameKz: "Темір", mass: "55.85", group: 8, period: 4 },
  { z: 27, symbol: "Co", nameRu: "Кобальт", nameKz: "Кобальт", mass: "58.93", group: 9, period: 4 },
  { z: 28, symbol: "Ni", nameRu: "Никель", nameKz: "Никель", mass: "58.69", group: 10, period: 4 },
  { z: 29, symbol: "Cu", nameRu: "Медь", nameKz: "Мыс", mass: "63.55", group: 11, period: 4 },
  { z: 30, symbol: "Zn", nameRu: "Цинк", nameKz: "Мырыш", mass: "65.38", group: 12, period: 4 },
  { z: 31, symbol: "Ga", nameRu: "Галлий", nameKz: "Галлий", mass: "69.72", group: 13, period: 4 },
  { z: 32, symbol: "Ge", nameRu: "Германий", nameKz: "Германий", mass: "72.63", group: 14, period: 4 },
  { z: 33, symbol: "As", nameRu: "Мышьяк", nameKz: "Күшәла", mass: "74.92", group: 15, period: 4 },
  { z: 34, symbol: "Se", nameRu: "Селен", nameKz: "Селен", mass: "78.97", group: 16, period: 4 },
  { z: 35, symbol: "Br", nameRu: "Бром", nameKz: "Бром", mass: "79.90", group: 17, period: 4 },
  { z: 36, symbol: "Kr", nameRu: "Криптон", nameKz: "Криптон", mass: "83.80", group: 18, period: 4 },
];

function CalculatorPanel({ lang }: { lang: Lang }) {
  const [display, setDisplay] = useState("0");
  const [acc, setAcc] = useState<number | null>(null);
  const [op, setOp] = useState<string | null>(null);
  const [fresh, setFresh] = useState(true);

  const inputDigit = (d: string) => {
    setDisplay((prev) => {
      if (fresh || prev === "0") return d;
      if (prev.length >= 14) return prev;
      return prev + d;
    });
    setFresh(false);
  };

  const inputDot = () => {
    setDisplay((prev) => {
      if (fresh) return "0.";
      if (prev.includes(".")) return prev;
      return prev + ".";
    });
    setFresh(false);
  };

  const clear = () => {
    setDisplay("0");
    setAcc(null);
    setOp(null);
    setFresh(true);
  };

  const applyOp = (nextOp: string) => {
    const n = Number(display);
    if (acc === null || op === null || fresh) {
      setAcc(n);
    } else {
      const result = compute(acc, n, op);
      setAcc(result);
      setDisplay(formatNum(result));
    }
    setOp(nextOp);
    setFresh(true);
  };

  const equals = () => {
    if (acc === null || op === null) return;
    const result = compute(acc, Number(display), op);
    setDisplay(formatNum(result));
    setAcc(null);
    setOp(null);
    setFresh(true);
  };

  return (
    <div className="exam-tool-panel exam-calc">
      <div className="exam-calc__display" aria-live="polite">
        {display}
      </div>
      <div className="exam-calc__keys">
        <button type="button" onClick={clear}>
          C
        </button>
        <button type="button" onClick={() => applyOp("/")}>
          ÷
        </button>
        <button type="button" onClick={() => applyOp("*")}>
          ×
        </button>
        <button type="button" onClick={() => setDisplay((p) => formatNum(-Number(p)))}>
          ±
        </button>
        {["7", "8", "9"].map((d) => (
          <button key={d} type="button" onClick={() => inputDigit(d)}>
            {d}
          </button>
        ))}
        <button type="button" onClick={() => applyOp("-")}>
          −
        </button>
        {["4", "5", "6"].map((d) => (
          <button key={d} type="button" onClick={() => inputDigit(d)}>
            {d}
          </button>
        ))}
        <button type="button" onClick={() => applyOp("+")}>
          +
        </button>
        {["1", "2", "3"].map((d) => (
          <button key={d} type="button" onClick={() => inputDigit(d)}>
            {d}
          </button>
        ))}
        <button type="button" className="exam-calc__eq" onClick={equals}>
          =
        </button>
        <button type="button" className="exam-calc__zero" onClick={() => inputDigit("0")}>
          0
        </button>
        <button type="button" onClick={inputDot}>
          .
        </button>
      </div>
      <p className="exam-tool-panel__hint">
        {lang === "kz" ? "Қарапайым калькулятор" : "Простой калькулятор"}
      </p>
    </div>
  );
}

function compute(a: number, b: number, op: string): number {
  switch (op) {
    case "+":
      return a + b;
    case "-":
      return a - b;
    case "*":
      return a * b;
    case "/":
      return b === 0 ? NaN : a / b;
    default:
      return b;
  }
}

function formatNum(n: number): string {
  if (!Number.isFinite(n)) return "Error";
  const s = String(Number(n.toPrecision(12)));
  return s.length > 14 ? n.toExponential(6) : s;
}

function MendeleevPanel({ lang }: { lang: Lang }) {
  return (
    <div className="exam-tool-panel exam-mendeleev">
      <div className="exam-mendeleev__grid">
        {ELEMENTS.map((el) => (
          <div
            key={el.z}
            className="exam-mendeleev__el"
            style={{
              gridColumn: el.group,
              gridRow: el.period,
            }}
            title={lang === "kz" ? el.nameKz : el.nameRu}
          >
            <span className="exam-mendeleev__z">{el.z}</span>
            <strong>{el.symbol}</strong>
            <span className="exam-mendeleev__mass">{el.mass}</span>
          </div>
        ))}
      </div>
      <p className="exam-tool-panel__hint">
        {lang === "kz"
          ? "Негізгі элементтер (1–36). Толық кесте кейін қосылады."
          : "Основные элементы (1–36). Полная таблица — позже."}
      </p>
    </div>
  );
}

export function ExamTools({ lang }: ExamToolsProps) {
  const [open, setOpen] = useState<ToolId>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="exam-tools">
      <div className="exam-tools__label">
        {lang === "kz" ? "ҚҰРАЛДАР" : "ИНСТРУМЕНТЫ"}
      </div>
      <button
        type="button"
        className={`exam-tools__btn ${open === "calculator" ? "active" : ""}`}
        onClick={() => setOpen((v) => (v === "calculator" ? null : "calculator"))}
      >
        <span className="material-symbols-outlined">calculate</span>
        {lang === "kz" ? "Калькулятор" : "Калькулятор"}
      </button>
      <button
        type="button"
        className={`exam-tools__btn ${open === "mendeleev" ? "active" : ""}`}
        onClick={() => setOpen((v) => (v === "mendeleev" ? null : "mendeleev"))}
      >
        <span className="material-symbols-outlined">science</span>
        {lang === "kz" ? "Менделеев" : "Менделеев"}
      </button>

      {open && (
        <div className="exam-tools__overlay" onClick={() => setOpen(null)}>
          <div
            className="exam-tools__modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
          >
            <div className="exam-tools__modal-head">
              <h3>
                {open === "calculator"
                  ? lang === "kz"
                    ? "Калькулятор"
                    : "Калькулятор"
                  : lang === "kz"
                    ? "Менделеев кестесі"
                    : "Таблица Менделеева"}
              </h3>
              <button type="button" onClick={() => setOpen(null)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            {open === "calculator" ? (
              <CalculatorPanel lang={lang} />
            ) : (
              <MendeleevPanel lang={lang} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
