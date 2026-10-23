import { useEffect, useState } from "react";
import { Link, Navigate, NavLink, Outlet } from "react-router-dom";
import { api, type ExamAnalytics, type PaymentRequest } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { SiteHeader } from "../../components/SiteHeader";
import type { Lang } from "../../i18n/strings";
import type { ExamStartResponse } from "../../utils/examDraft";
import type { CabinetData } from "./data";
import "../../styles/home.css";
import "../../styles/cabinet.css";

interface CabinetLayoutProps {
  lang: Lang;
  onToggleLang: () => void;
}

/** Shell of the personal cabinet: loads the student's data once for all pages. */
export function CabinetLayout({ lang, onToggleLang }: CabinetLayoutProps) {
  const kz = lang === "kz";
  const { user, loading: authLoading, isAdmin, logout } = useAuth();
  const [exams, setExams] = useState<ExamAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [wallet, setWallet] = useState<CabinetData["wallet"]>(null);
  const [variants, setVariants] = useState<CabinetData["variants"]>(null);
  const [active, setActive] = useState<ExamStartResponse | null>(null);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [verifyNotice, setVerifyNotice] = useState("");

  useEffect(() => {
    if (!user) return;
    api
      .examAnalytics()
      .then(({ exams: list }) => setExams(list))
      .catch((e) => setError(e instanceof Error ? e.message : "Ошибка"))
      .finally(() => setLoading(false));
    api
      .myPayments()
      .then((w: { credits: number; unlimited: boolean; requests: PaymentRequest[] }) => setWallet(w))
      .catch(() => undefined);
    api.examVariants().then(setVariants).catch(() => undefined);
    api
      .examActive()
      .then(({ session }) => setActive(session))
      .catch(() => undefined);
  }, [user]);

  if (authLoading) return null;
  if (!user) return <Navigate to="/login" replace state={{ from: "/cabinet" }} />;

  const resendVerify = () => {
    setVerifyBusy(true);
    api
      .resendVerify()
      .then(() => setVerifyNotice(kz ? "Хат жіберілді." : "Письмо отправлено."))
      .catch((e) => setError(e instanceof Error ? e.message : "Ошибка"))
      .finally(() => setVerifyBusy(false));
  };

  const nav = [
    { to: "/cabinet", end: true, icon: "space_dashboard", label: kz ? "Шолу" : "Обзор" },
    { to: "/cabinet/results", icon: "leaderboard", label: kz ? "Нәтижелер" : "Результаты" },
    { to: "/cabinet/subjects", icon: "menu_book", label: kz ? "Пәндер" : "Предметы" },
    { to: "/cabinet/payments", icon: "account_balance_wallet", label: kz ? "Төлемдер" : "Оплаты" },
    { to: "/cabinet/settings", icon: "manage_accounts", label: kz ? "Баптаулар" : "Настройки" },
  ];

  const data: CabinetData = {
    lang,
    onToggleLang,
    loading,
    error,
    exams,
    wallet,
    variants,
    active,
    askLogout: () => setConfirmLogout(true),
  };

  return (
    <div className="page v2 cab">
      <SiteHeader lang={lang} onToggleLang={onToggleLang}>
        {isAdmin && <Link to="/admin">{kz ? "Әкімші" : "Админка"}</Link>}
        <Link to="/">{kz ? "Басты бет" : "Главная"}</Link>
        <button type="button" onClick={() => setConfirmLogout(true)}>
          {kz ? "Шығу" : "Выйти"}
        </button>
      </SiteHeader>

      <div className="cab-shell">
        <aside className="cab-side">
          <div className="cab-side__who">
            <span className="cab-side__avatar" aria-hidden="true">
              {user.name.trim().charAt(0).toUpperCase()}
            </span>
            <span>
              <strong>{user.name}</strong>
              <small>
                {wallet
                  ? wallet.unlimited
                    ? kz
                      ? "Әкімші, шектеусіз"
                      : "Админ, без ограничений"
                    : kz
                      ? `Төленген ҰБТ: ${wallet.credits}`
                      : `Оплачено ЕНТ: ${wallet.credits}`
                  : user.email}
              </small>
            </span>
          </div>
          <nav className="cab-side__nav" aria-label={kz ? "Кабинет" : "Кабинет"}>
            {nav.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end}>
                <span className="material-symbols-outlined" aria-hidden="true">
                  {item.icon}
                </span>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="cab-content">
          {user.emailVerified === false && (
            <p className="v2-notice">
              {kz
                ? "Email әлі расталмаған. Нәтижелерді алу және құпиясөзді қалпына келтіру үшін поштаңызды растаңыз."
                : "Email ещё не подтверждён. Подтвердите почту, чтобы получать результаты и сбрасывать пароль."}{" "}
              {verifyNotice ? (
                <strong>{verifyNotice}</strong>
              ) : (
                <button type="button" className="link-btn" disabled={verifyBusy} onClick={resendVerify}>
                  {verifyBusy
                    ? kz
                      ? "Жіберілуде…"
                      : "Отправляем…"
                    : kz
                      ? "Хатты қайта жіберу"
                      : "Отправить письмо ещё раз"}
                </button>
              )}
            </p>
          )}
          {error && <p className="v2-error">{error}</p>}
          <Outlet context={data} />
        </main>
      </div>

      {confirmLogout && (
        <ConfirmDialog
          title={kz ? "Аккаунттан шығу" : "Выйти из аккаунта"}
          message={
            kz ? "Аккаунттан шыққыңыз келетініне сенімдісіз бе?" : "Вы уверены, что хотите выйти из аккаунта?"
          }
          confirmLabel={kz ? "Шығу" : "Выйти"}
          cancelLabel={kz ? "Болдырмау" : "Отмена"}
          danger
          onCancel={() => setConfirmLogout(false)}
          onConfirm={() => {
            setConfirmLogout(false);
            logout();
          }}
        />
      )}
    </div>
  );
}
