import { Link } from "react-router-dom";
import { ThemeToggle } from "../components/ThemeToggle";
import type { Lang } from "../i18n/strings";

const COPY = {
  faq: {
    titleKz: "Жиі қойылатын сұрақтар",
    titleRu: "Частые вопросы",
    bodyKz:
      "Мұнда жақында ҰБТ форматы, төлем және нәтижелер туралы жауаптар пайда болады.",
    bodyRu:
      "Здесь скоро появятся ответы про формат ЕНТ, оплату и результаты.",
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

interface LegalPageProps {
  lang: Lang;
  kind: keyof typeof COPY;
}

export function LegalPage({ lang, kind }: LegalPageProps) {
  const copy = COPY[kind];
  const title = lang === "kz" ? copy.titleKz : copy.titleRu;
  const body = lang === "kz" ? copy.bodyKz : copy.bodyRu;

  return (
    <div className="page">
      <header className="site-header">
        <div className="site-header__brand">
          <Link to="/" className="site-header__logo">
            Талапкер
          </Link>
          <ThemeToggle />
        </div>
        <nav className="site-header__nav">
          <Link to="/" className="header-btn header-btn--ghost">
            {lang === "kz" ? "Басты бет" : "На главную"}
          </Link>
        </nav>
      </header>
      <article className="legal-page">
        <h1>{title}</h1>
        <p>{body}</p>
      </article>
    </div>
  );
}
