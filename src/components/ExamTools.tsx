import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Lang } from "../i18n/strings";

type ToolId = "calculator" | "mendeleev" | null;

interface ExamToolsProps {
  lang: Lang;
}

interface ElementDef {
  z: number;
  symbol: string;
  nameRu: string;
  nameKz: string;
  mass: string;
  group?: number;
  period: number;
}

const MAIN_ELEMENTS: ElementDef[] = [
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
  { z: 37, symbol: "Rb", nameRu: "Рубидий", nameKz: "Рубидий", mass: "85.47", group: 1, period: 5 },
  { z: 38, symbol: "Sr", nameRu: "Стронций", nameKz: "Стронций", mass: "87.62", group: 2, period: 5 },
  { z: 39, symbol: "Y", nameRu: "Иттрий", nameKz: "Иттрий", mass: "88.91", group: 3, period: 5 },
  { z: 40, symbol: "Zr", nameRu: "Цирконий", nameKz: "Цирконий", mass: "91.22", group: 4, period: 5 },
  { z: 41, symbol: "Nb", nameRu: "Ниобий", nameKz: "Ниобий", mass: "92.91", group: 5, period: 5 },
  { z: 42, symbol: "Mo", nameRu: "Молибден", nameKz: "Молибден", mass: "95.95", group: 6, period: 5 },
  { z: 43, symbol: "Tc", nameRu: "Технеций", nameKz: "Технеций", mass: "98", group: 7, period: 5 },
  { z: 44, symbol: "Ru", nameRu: "Рутений", nameKz: "Рутений", mass: "101.1", group: 8, period: 5 },
  { z: 45, symbol: "Rh", nameRu: "Родий", nameKz: "Родий", mass: "102.9", group: 9, period: 5 },
  { z: 46, symbol: "Pd", nameRu: "Палладий", nameKz: "Палладий", mass: "106.4", group: 10, period: 5 },
  { z: 47, symbol: "Ag", nameRu: "Серебро", nameKz: "Күміс", mass: "107.9", group: 11, period: 5 },
  { z: 48, symbol: "Cd", nameRu: "Кадмий", nameKz: "Кадмий", mass: "112.4", group: 12, period: 5 },
  { z: 49, symbol: "In", nameRu: "Индий", nameKz: "Индий", mass: "114.8", group: 13, period: 5 },
  { z: 50, symbol: "Sn", nameRu: "Олово", nameKz: "Қалайы", mass: "118.7", group: 14, period: 5 },
  { z: 51, symbol: "Sb", nameRu: "Сурьма", nameKz: "Сурьма", mass: "121.8", group: 15, period: 5 },
  { z: 52, symbol: "Te", nameRu: "Теллур", nameKz: "Теллур", mass: "127.6", group: 16, period: 5 },
  { z: 53, symbol: "I", nameRu: "Йод", nameKz: "Йод", mass: "126.9", group: 17, period: 5 },
  { z: 54, symbol: "Xe", nameRu: "Ксенон", nameKz: "Ксенон", mass: "131.3", group: 18, period: 5 },
  { z: 55, symbol: "Cs", nameRu: "Цезий", nameKz: "Цезий", mass: "132.9", group: 1, period: 6 },
  { z: 56, symbol: "Ba", nameRu: "Барий", nameKz: "Барий", mass: "137.3", group: 2, period: 6 },
  { z: 72, symbol: "Hf", nameRu: "Гафний", nameKz: "Гафний", mass: "178.5", group: 4, period: 6 },
  { z: 73, symbol: "Ta", nameRu: "Тантал", nameKz: "Тантал", mass: "180.9", group: 5, period: 6 },
  { z: 74, symbol: "W", nameRu: "Вольфрам", nameKz: "Вольфрам", mass: "183.8", group: 6, period: 6 },
  { z: 75, symbol: "Re", nameRu: "Рений", nameKz: "Рений", mass: "186.2", group: 7, period: 6 },
  { z: 76, symbol: "Os", nameRu: "Осмий", nameKz: "Осмий", mass: "190.2", group: 8, period: 6 },
  { z: 77, symbol: "Ir", nameRu: "Иридий", nameKz: "Иридий", mass: "192.2", group: 9, period: 6 },
  { z: 78, symbol: "Pt", nameRu: "Платина", nameKz: "Платина", mass: "195.1", group: 10, period: 6 },
  { z: 79, symbol: "Au", nameRu: "Золото", nameKz: "Алтын", mass: "197.0", group: 11, period: 6 },
  { z: 80, symbol: "Hg", nameRu: "Ртуть", nameKz: "Сынап", mass: "200.6", group: 12, period: 6 },
  { z: 81, symbol: "Tl", nameRu: "Таллий", nameKz: "Таллий", mass: "204.4", group: 13, period: 6 },
  { z: 82, symbol: "Pb", nameRu: "Свинец", nameKz: "Қорғасын", mass: "207.2", group: 14, period: 6 },
  { z: 83, symbol: "Bi", nameRu: "Висмут", nameKz: "Висмут", mass: "209.0", group: 15, period: 6 },
  { z: 84, symbol: "Po", nameRu: "Полоний", nameKz: "Полоний", mass: "209", group: 16, period: 6 },
  { z: 85, symbol: "At", nameRu: "Астат", nameKz: "Астат", mass: "210", group: 17, period: 6 },
  { z: 86, symbol: "Rn", nameRu: "Радон", nameKz: "Радон", mass: "222", group: 18, period: 6 },
  { z: 87, symbol: "Fr", nameRu: "Франций", nameKz: "Франций", mass: "223", group: 1, period: 7 },
  { z: 88, symbol: "Ra", nameRu: "Радий", nameKz: "Радий", mass: "226", group: 2, period: 7 },
  { z: 104, symbol: "Rf", nameRu: "Резерфордий", nameKz: "Резерфордий", mass: "267", group: 4, period: 7 },
  { z: 105, symbol: "Db", nameRu: "Дубний", nameKz: "Дубний", mass: "268", group: 5, period: 7 },
  { z: 106, symbol: "Sg", nameRu: "Сиборгий", nameKz: "Сиборгий", mass: "269", group: 6, period: 7 },
  { z: 107, symbol: "Bh", nameRu: "Борий", nameKz: "Борий", mass: "270", group: 7, period: 7 },
  { z: 108, symbol: "Hs", nameRu: "Хассий", nameKz: "Хассий", mass: "269", group: 8, period: 7 },
  { z: 109, symbol: "Mt", nameRu: "Мейтнерий", nameKz: "Мейтнерий", mass: "278", group: 9, period: 7 },
  { z: 110, symbol: "Ds", nameRu: "Дармштадтий", nameKz: "Дармштадтий", mass: "281", group: 10, period: 7 },
  { z: 111, symbol: "Rg", nameRu: "Рентгений", nameKz: "Рентгений", mass: "282", group: 11, period: 7 },
  { z: 112, symbol: "Cn", nameRu: "Коперниций", nameKz: "Коперниций", mass: "285", group: 12, period: 7 },
  { z: 113, symbol: "Nh", nameRu: "Нихоний", nameKz: "Нихоний", mass: "286", group: 13, period: 7 },
  { z: 114, symbol: "Fl", nameRu: "Флеровий", nameKz: "Флеровий", mass: "289", group: 14, period: 7 },
  { z: 115, symbol: "Mc", nameRu: "Московий", nameKz: "Московий", mass: "290", group: 15, period: 7 },
  { z: 116, symbol: "Lv", nameRu: "Ливерморий", nameKz: "Ливерморий", mass: "293", group: 16, period: 7 },
  { z: 117, symbol: "Ts", nameRu: "Теннессин", nameKz: "Теннессин", mass: "294", group: 17, period: 7 },
  { z: 118, symbol: "Og", nameRu: "Оганесон", nameKz: "Оганесон", mass: "294", group: 18, period: 7 },
];

const LANTHANIDES: ElementDef[] = [
  { z: 57, symbol: "La", nameRu: "Лантан", nameKz: "Лантан", mass: "138.9", period: 9 },
  { z: 58, symbol: "Ce", nameRu: "Церий", nameKz: "Церий", mass: "140.1", period: 9 },
  { z: 59, symbol: "Pr", nameRu: "Празеодим", nameKz: "Празеодим", mass: "140.9", period: 9 },
  { z: 60, symbol: "Nd", nameRu: "Неодим", nameKz: "Неодим", mass: "144.2", period: 9 },
  { z: 61, symbol: "Pm", nameRu: "Прометий", nameKz: "Прометий", mass: "145", period: 9 },
  { z: 62, symbol: "Sm", nameRu: "Самарий", nameKz: "Самарий", mass: "150.4", period: 9 },
  { z: 63, symbol: "Eu", nameRu: "Европий", nameKz: "Европий", mass: "152.0", period: 9 },
  { z: 64, symbol: "Gd", nameRu: "Гадолиний", nameKz: "Гадолиний", mass: "157.3", period: 9 },
  { z: 65, symbol: "Tb", nameRu: "Тербий", nameKz: "Тербий", mass: "158.9", period: 9 },
  { z: 66, symbol: "Dy", nameRu: "Диспрозий", nameKz: "Диспрозий", mass: "162.5", period: 9 },
  { z: 67, symbol: "Ho", nameRu: "Гольмий", nameKz: "Гольмий", mass: "164.9", period: 9 },
  { z: 68, symbol: "Er", nameRu: "Эрбий", nameKz: "Эрбий", mass: "167.3", period: 9 },
  { z: 69, symbol: "Tm", nameRu: "Тулий", nameKz: "Тулий", mass: "168.9", period: 9 },
  { z: 70, symbol: "Yb", nameRu: "Иттербий", nameKz: "Иттербий", mass: "173.0", period: 9 },
  { z: 71, symbol: "Lu", nameRu: "Лютеций", nameKz: "Лютеций", mass: "175.0", period: 9 },
].map((el, i) => ({ ...el, group: i + 3 }));

const ACTINIDES: ElementDef[] = [
  { z: 89, symbol: "Ac", nameRu: "Актиний", nameKz: "Актиний", mass: "227", period: 10 },
  { z: 90, symbol: "Th", nameRu: "Торий", nameKz: "Торий", mass: "232.0", period: 10 },
  { z: 91, symbol: "Pa", nameRu: "Протактиний", nameKz: "Протактиний", mass: "231.0", period: 10 },
  { z: 92, symbol: "U", nameRu: "Уран", nameKz: "Уран", mass: "238.0", period: 10 },
  { z: 93, symbol: "Np", nameRu: "Нептуний", nameKz: "Нептуний", mass: "237", period: 10 },
  { z: 94, symbol: "Pu", nameRu: "Плутоний", nameKz: "Плутоний", mass: "244", period: 10 },
  { z: 95, symbol: "Am", nameRu: "Америций", nameKz: "Америций", mass: "243", period: 10 },
  { z: 96, symbol: "Cm", nameRu: "Кюрий", nameKz: "Кюрий", mass: "247", period: 10 },
  { z: 97, symbol: "Bk", nameRu: "Берклий", nameKz: "Берклий", mass: "247", period: 10 },
  { z: 98, symbol: "Cf", nameRu: "Калифорний", nameKz: "Калифорний", mass: "251", period: 10 },
  { z: 99, symbol: "Es", nameRu: "Эйнштейний", nameKz: "Эйнштейний", mass: "252", period: 10 },
  { z: 100, symbol: "Fm", nameRu: "Фермий", nameKz: "Фермий", mass: "257", period: 10 },
  { z: 101, symbol: "Md", nameRu: "Менделевий", nameKz: "Менделевий", mass: "258", period: 10 },
  { z: 102, symbol: "No", nameRu: "Нобелий", nameKz: "Нобелий", mass: "259", period: 10 },
  { z: 103, symbol: "Lr", nameRu: "Лоуренсий", nameKz: "Лоуренсий", mass: "266", period: 10 },
].map((el, i) => ({ ...el, group: i + 3 }));

const ELEMENTS: ElementDef[] = [...MAIN_ELEMENTS, ...LANTHANIDES, ...ACTINIDES];

function CalculatorPanel() {
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
        <div
          className="exam-mendeleev__ref"
          style={{ gridColumn: 3, gridRow: 6 }}
        >
          57–71
        </div>
        <div
          className="exam-mendeleev__ref"
          style={{ gridColumn: 3, gridRow: 7 }}
        >
          89–103
        </div>
        <div className="exam-mendeleev__spacer" style={{ gridRow: 8 }} />
      </div>
    </div>
  );
}

export function ExamTools({ lang }: ExamToolsProps) {
  const [open, setOpen] = useState<ToolId>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const pick = (tool: ToolId) => {
    setOpen(tool);
    setExpanded(false);
  };

  return (
    <div
      className={`exam-tools ${expanded ? "exam-tools--expanded" : ""}`}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      <button
        type="button"
        className="exam-tools__fab"
        aria-label={lang === "kz" ? "Құралдар" : "Инструменты"}
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="material-symbols-outlined">construction</span>
      </button>
      <div className="exam-tools__panel">
        <div className="exam-tools__label">
          {lang === "kz" ? "ҚҰРАЛДАР" : "ИНСТРУМЕНТЫ"}
        </div>
        <button
          type="button"
          className={`exam-tools__btn ${open === "calculator" ? "active" : ""}`}
          onClick={() => pick(open === "calculator" ? null : "calculator")}
        >
          <span className="material-symbols-outlined">calculate</span>
          {lang === "kz" ? "Калькулятор" : "Калькулятор"}
        </button>
        <button
          type="button"
          className={`exam-tools__btn ${open === "mendeleev" ? "active" : ""}`}
          onClick={() => pick(open === "mendeleev" ? null : "mendeleev")}
        >
          <span className="material-symbols-outlined">science</span>
          {lang === "kz" ? "Менделеев" : "Менделеев"}
        </button>
      </div>

      {open &&
        createPortal(
          <div className="exam-tools__overlay" onClick={() => setOpen(null)}>
            <div
              className={`exam-tools__modal ${
                open === "mendeleev" ? "exam-tools__modal--wide" : ""
              }`}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
            >
              <div className="exam-tools__modal-head">
                <h3>
                  {open === "calculator"
                    ? "Калькулятор"
                    : lang === "kz"
                      ? "Менделеев кестесі"
                      : "Таблица Менделеева"}
                </h3>
                <button type="button" onClick={() => setOpen(null)}>
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              {open === "calculator" ? (
                <CalculatorPanel />
              ) : (
                <MendeleevPanel lang={lang} />
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
