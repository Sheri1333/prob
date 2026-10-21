import { Link } from "react-router-dom";
import { SiteHeader } from "../components/SiteHeader";
import type { Lang } from "../i18n/strings";
import { useDocumentTitle } from "../utils/useDocumentTitle";
import "../styles/home.css";

const COPY = {
  faq: {
    titleKz: "Жиі қойылатын сұрақтар",
    titleRu: "Частые вопросы",
    bodyKz:
      "Бұл бет әлі толтырылып жатыр. Кейін мұнда ҰБТ форматы, төлем және нәтижелер туралы жазамыз.",
    bodyRu:
      "Страница пока пустая. Позже напишем здесь про формат ЕНТ, оплату и результаты.",
  },
  terms: {
    titleKz: "Пайдаланушы келісімі",
    titleRu: "Пользовательское соглашение",
    bodyKz: "Мәтін кейін қосылады. Платформаны пайдалана отырып, сіз шарттармен келісесіз.",
    bodyRu:
      "Текст появится позже. Пользуясь платформой, вы соглашаетесь с условиями сервиса.",
  },
  privacy: {
    titleKz: "Құпиялылық саясаты",
    titleRu: "Политика конфиденциальности",
    bodyKz:
      "Мәтін кейін қосылады. Біз аккаунт пен нәтижелерді тек дайындық үшін сақтаймыз.",
    bodyRu:
      "Текст появится позже. Мы храним аккаунт и результаты только для подготовки.",
  },
} as const;

const ORDER = ["faq", "terms", "privacy"] as const;

interface LegalPageProps {
  lang: Lang;
  onToggleLang: () => void;
  kind: keyof typeof COPY;
}

export function LegalPage({ lang, onToggleLang, kind }: LegalPageProps) {
  const kz = lang === "kz";
  const copy = COPY[kind];
  const title = kz ? copy.titleKz : copy.titleRu;
  const body = kz ? copy.bodyKz : copy.bodyRu;
  useDocumentTitle(title);

  return (
    <div className="page v2">
      <SiteHeader lang={lang} onToggleLang={onToggleLang}>
        <Link to="/">{kz ? "Басты бет" : "Главная"}</Link>
      </SiteHeader>
      <div className="doc-layout">
        <nav className="doc-nav" aria-label={kz ? "Құжаттар" : "Документы"}>
          {ORDER.map((k) => (
            <Link
              key={k}
              to={`/${k}`}
              aria-current={k === kind ? "page" : undefined}
            >
              {kz ? COPY[k].titleKz : COPY[k].titleRu}
            </Link>
          ))}
        </nav>
        <article className="doc">
          <h1>{title}</h1>
          <p>{body}</p>
        </article>
      </div>
    </div>
  );
}
