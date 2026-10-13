import type { ReactNode } from "react";
import type { Lang } from "../i18n/strings";

interface Ion {
  base: string;
  sub?: string;
  charge: string;
}

const ion = (base: string, charge: string, sub?: string): Ion => ({ base, sub, charge });

const CATIONS: Ion[] = [
  ion("H", "+"),
  ion("NH", "+", "4"),
  ion("K", "+"),
  ion("Na", "+"),
  ion("Ag", "+"),
  ion("Ba", "2+"),
  ion("Ca", "2+"),
  ion("Mg", "2+"),
  ion("Mn", "2+"),
  ion("Zn", "2+"),
  ion("Ni", "2+"),
  ion("Sn", "2+"),
  ion("Pb", "2+"),
  ion("Cu", "2+"),
  ion("Hg", "2+"),
  ion("Hg", "2+", "2"),
  ion("Fe", "2+"),
  ion("Fe", "3+"),
  ion("Al", "3+"),
  ion("Cr", "3+"),
];

// One string per anion, one letter per cation column above.
// Р soluble, М slightly soluble, Н insoluble, – does not exist / decomposed by water.
const ROWS: Array<[Ion, string]> = [
  [ion("OH", "−"), " РРР–РММНННННН––НННН"],
  [ion("NO", "−", "3"), "РРРРРРРРРРРРРРР–РРРР"],
  [ion("F", "−"), "РРРРРМНМРМРРМР–ММНММ"],
  [ion("Cl", "−"), "РРРРНРРРРРРРМРРНРРРР"],
  [ion("Br", "−"), "РРРРНРРРРРРРМРМНРРРР"],
  [ion("I", "−"), "РРРРНРРРРРРРН–ННР–РР"],
  [ion("S", "2−"), "РРРРН–––НННННННННН––"],
  [ion("SO", "2−", "3"), "РРРРММММНМН–Н–––М–––"],
  [ion("SO", "2−", "4"), "РРРРМНМРРРРРНРРМРРРР"],
  [ion("CO", "2−", "3"), "РРРРНННННН––Н––НН–––"],
  [ion("SiO", "2−", "3"), "Н–РРННННННН–Н–––Н–––"],
  [ion("PO", "3−", "4"), "РРРРНННННННННННННННН"],
  [ion("CH₃COO", "−"), "РРРРРРРРРРРРРРРМРРРР"],
];

const ELECTRONEGATIVITY: Array<[string, string]> = [
  ["Cs", "0,8"], ["K", "0,8"], ["Na", "0,9"], ["Ca", "1,0"], ["Mg", "1,2"], ["Al", "1,6"],
  ["B", "2,0"], ["P", "2,1"], ["H", "2,1"], ["C", "2,5"], ["S", "2,5"], ["I", "2,6"],
  ["Br", "2,8"], ["Cl", "3,0"], ["N", "3,0"], ["O", "3,5"], ["F", "4,0"],
];

const ACTIVITY_SERIES = [
  "Li", "Rb", "K", "Cs", "Ba", "Sr", "Ca", "Na", "Mg", "Be", "Al", "Mn", "Zn", "Cr", "Fe",
  "Cd", "Co", "Ni", "Sn", "Pb", "(H)", "Cu", "Hg", "Ag", "Pt", "Au",
];

const CELL_CLASS: Record<string, string> = {
  Р: "sol--r",
  М: "sol--m",
  Н: "sol--n",
  "–": "sol--x",
};

function IonLabel({ value }: { value: Ion }): ReactNode {
  return (
    <>
      {value.base}
      {value.sub && <sub>{value.sub}</sub>}
      <sup>{value.charge}</sup>
    </>
  );
}

export function SolubilityPanel({ lang }: { lang: Lang }) {
  const kz = lang === "kz";
  return (
    <div className="sol">
      <div className="sol__scroll">
        <table className="sol__table">
          <thead>
            <tr>
              <th className="sol__corner">{kz ? "Иондар" : "Ионы"}</th>
              {CATIONS.map((c, i) => (
                <th key={i}>
                  <IonLabel value={c} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map(([anion, cells], r) => (
              <tr key={r}>
                <th>
                  <IonLabel value={anion} />
                </th>
                {[...cells].map((v, i) => (
                  <td key={i} className={CELL_CLASS[v] ?? ""}>
                    {v.trim()}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="sol__legend">
        <span className="sol--r">Р</span> {kz ? "ериді" : "растворимо"}
        <span className="sol--m">М</span> {kz ? "аз ериді" : "малорастворимо"}
        <span className="sol--n">Н</span> {kz ? "ерімейді" : "нерастворимо"}
        <span className="sol--x">–</span>{" "}
        {kz ? "жоқ немесе суда ыдырайды" : "не существует или разлагается водой"}
      </p>

      <h4 className="sol__subtitle">
        {kz ? "Салыстырмалы электртерістілік (Полинг)" : "Относительная электроотрицательность (по Полингу)"}
      </h4>
      <div className="sol__scroll">
        <table className="sol__table sol__table--compact">
          <tbody>
            <tr>
              {ELECTRONEGATIVITY.map(([el]) => (
                <th key={el}>{el}</th>
              ))}
            </tr>
            <tr>
              {ELECTRONEGATIVITY.map(([el, v]) => (
                <td key={el}>{v}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <h4 className="sol__subtitle">
        {kz ? "Металдардың активтілік қатары" : "Ряд активности металлов"}
      </h4>
      <div className="sol__scroll">
        <div className="sol__series">
          {ACTIVITY_SERIES.map((el) => (
            <span key={el}>{el}</span>
          ))}
        </div>
      </div>
      <p className="sol__arrow">
        {kz ? "Металдардың активтілігі кемиді →" : "Активность металлов уменьшается →"}
      </p>
    </div>
  );
}
