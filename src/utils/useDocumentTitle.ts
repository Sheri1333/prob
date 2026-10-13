import { useEffect } from "react";

const DEFAULT_TITLE = "Талапкер — Пробное тестирование ЕНТ";

/** Sets the tab title for the current page; no title means the site default. */
export function useDocumentTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} — Талапкер` : DEFAULT_TITLE;
  }, [title]);
}
