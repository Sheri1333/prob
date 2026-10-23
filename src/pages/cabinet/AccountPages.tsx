import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { api, type EntPricing } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { useDocumentTitle } from "../../utils/useDocumentTitle";
import { formatDate, type CabinetData } from "./data";

export function PaymentsPage() {
  const { lang, wallet } = useOutletContext<CabinetData>();
  const kz = lang === "kz";
  useDocumentTitle(kz ? "Төлемдер" : "Оплаты");
  const [pricing, setPricing] = useState<EntPricing | null>(null);

  useEffect(() => {
    api.getPricing().then(setPricing).catch(() => undefined);
  }, []);

  const tenge = (n: number | undefined) => (n === undefined ? "… ₸" : `${n.toLocaleString("ru-RU")} ₸`);
  const pending = wallet?.requests.filter((r) => r.status === "pending").length ?? 0;
  const confirmedSessions =
    wallet?.requests.filter((r) => r.status === "confirmed").reduce((s, r) => s + r.sessions, 0) ?? 0;

  return (
    <>
      <header className="cab-title">
        <div>
          <h1>{kz ? "Төлемдер" : "Оплаты"}</h1>
          <p>{kz ? "Kaspi арқылы төлем және ҰБТ балансы" : "Оплата через Kaspi и баланс ЕНТ"}</p>
        </div>
      </header>

      <ul className="hero-stats cab-kpis cab-kpis--3">
        <li className="hero-stats__item">
          <span className="hero-stats__icon material-symbols-outlined" aria-hidden="true">
            confirmation_number
          </span>
          <span className="hero-stats__text">
            <strong>{wallet ? (wallet.unlimited ? "∞" : wallet.credits) : "…"}</strong>
            <span>{kz ? "қолжетімді ҰБТ" : "доступно ЕНТ"}</span>
          </span>
        </li>
        <li className="hero-stats__item">
          <span className="hero-stats__icon material-symbols-outlined" aria-hidden="true">
            hourglass_top
          </span>
          <span className="hero-stats__text">
            <strong>{pending}</strong>
            <span>{kz ? "тексерілуде" : "на проверке"}</span>
          </span>
        </li>
        <li className="hero-stats__item">
          <span className="hero-stats__icon material-symbols-outlined" aria-hidden="true">
            verified
          </span>
          <span className="hero-stats__text">
            <strong>{confirmedSessions}</strong>
            <span>{kz ? "барлығы сатып алынды" : "куплено всего"}</span>
          </span>
        </li>
      </ul>

      {wallet && !wallet.unlimited && (
        <section className="cab-card">
          <h2>{kz ? "ҰБТ сатып алу" : "Купить ЕНТ"}</h2>
          <ul className="buy-list">
            <li>
              <span>
                <strong>{kz ? "Толық ҰБТ" : "Полный ЕНТ"}</strong>
                <small>{kz ? "1 сессия" : "1 сессия"}</small>
              </span>
              <span className="buy-list__price">{tenge(pricing?.singlePriceTenge)}</span>
              <Link to="/pay/single" className="v2-btn v2-btn--quiet">
                {kz ? "Төлеу" : "Оплатить"}
              </Link>
            </li>
            <li className="is-best">
              <span>
                <strong>{kz ? "3 толық ҰБТ" : "3 полных ЕНТ"}</strong>
                <small>
                  {pricing && pricing.singlePriceTenge * 3 > pricing.bundlePriceTenge
                    ? kz
                      ? `${tenge(pricing.singlePriceTenge * 3 - pricing.bundlePriceTenge)} үнем`
                      : `экономия ${tenge(pricing.singlePriceTenge * 3 - pricing.bundlePriceTenge)}`
                    : kz
                      ? "3 сессия"
                      : "3 сессии"}
                </small>
              </span>
              <span className="buy-list__price">{tenge(pricing?.bundlePriceTenge)}</span>
              <Link to="/pay/bundle" className="v2-btn">
                {kz ? "Төлеу" : "Оплатить"}
              </Link>
            </li>
          </ul>
        </section>
      )}

      <section className="cab-card">
        <h2>{kz ? "Төлемдер тарихы" : "История оплат"}</h2>
        {!wallet || wallet.requests.length === 0 ? (
          <p className="cab-empty">
            {kz
              ? "Төлем әлі болған жоқ. Kaspi арқылы төлеп, «Төледім» батырмасын бассаңыз, ол осында шығады."
              : "Оплат пока не было. Когда оплатите через Kaspi и нажмёте «Я оплатил», она появится здесь."}
          </p>
        ) : (
          <>
            <ul className="payments-list">
              {wallet.requests.map((r) => (
                <li key={r.id}>
                  <span className="payments-list__what">
                    {r.sessions === 1
                      ? kz
                        ? "1 толық ҰБТ"
                        : "1 полный ЕНТ"
                      : kz
                        ? `${r.sessions} толық ҰБТ`
                        : `${r.sessions} полных ЕНТ`}
                    , {r.amountTenge.toLocaleString("ru-RU")} ₸
                  </span>
                  <span className="payments-list__meta">
                    {formatDate(r.createdAt)}, {kz ? "Kaspi-дегі аты" : "имя в Kaspi"}: {r.payerName}
                  </span>
                  <span className={`payments-list__status payments-list__status--${r.status}`}>
                    {r.status === "pending"
                      ? kz
                        ? "Тексерілуде"
                        : "На проверке"
                      : r.status === "confirmed"
                        ? kz
                          ? "Расталды"
                          : "Подтверждена"
                        : kz
                          ? "Табылмады"
                          : "Не найдена"}
                  </span>
                </li>
              ))}
            </ul>
            {wallet.requests.some((r) => r.status === "rejected") && (
              <p className="cab-card__sub" style={{ marginTop: "0.9rem" }}>
                {kz
                  ? "«Табылмады» дегеніміз Kaspi-де осы аты-жөні мен сомадағы төлем табылмады. Төлеген болсаңыз, бізге жазыңыз."
                  : "«Не найдена» значит, что перевода с таким именем и суммой в Kaspi нет. Если вы платили, напишите нам."}
              </p>
            )}
          </>
        )}
      </section>
    </>
  );
}

export function SettingsPage() {
  const { lang, onToggleLang, askLogout } = useOutletContext<CabinetData>();
  const kz = lang === "kz";
  useDocumentTitle(kz ? "Баптаулар" : "Настройки");
  const { user } = useAuth();
  if (!user) return null;

  return (
    <>
      <header className="cab-title">
        <div>
          <h1>{kz ? "Баптаулар" : "Настройки"}</h1>
          <p>{kz ? "Аккаунт деректері" : "Данные аккаунта"}</p>
        </div>
      </header>
      <section className="cab-card">
        <dl className="facts">
          <div>
            <dt>{kz ? "Аты-жөні" : "Имя"}</dt>
            <dd>{user.name}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>
              {user.email}{" "}
              <span className={`cab-badge${user.emailVerified === false ? " is-warn" : ""}`}>
                {user.emailVerified === false
                  ? kz
                    ? "расталмаған"
                    : "не подтверждён"
                  : kz
                    ? "расталған"
                    : "подтверждён"}
              </span>
            </dd>
          </div>
          <div>
            <dt>{kz ? "Құпиясөз" : "Пароль"}</dt>
            <dd>
              <Link to="/forgot" className="cab-link">
                {kz ? "Құпиясөзді өзгерту" : "Сменить пароль"}
              </Link>
              <span className="cab-hint">
                {kz ? " Поштаңызға сілтеме жібереміз." : " Пришлём ссылку на почту."}
              </span>
            </dd>
          </div>
          <div>
            <dt>{kz ? "Сайт тілі" : "Язык сайта"}</dt>
            <dd>
              {kz ? "Қазақша" : "Русский"}{" "}
              <button type="button" className="link-btn cab-link" onClick={onToggleLang}>
                {kz ? "Орысшаға ауыстыру" : "Переключить на казахский"}
              </button>
            </dd>
          </div>
        </dl>
        <button type="button" className="v2-btn v2-btn--quiet cab-logout" onClick={askLogout}>
          {kz ? "Аккаунттан шығу" : "Выйти из аккаунта"}
        </button>
      </section>
    </>
  );
}
