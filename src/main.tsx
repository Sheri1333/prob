import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

// Icons are font ligatures: until the font loads they render as words like
// "check_circle", and screen readers always read those words aloud.
document.fonts
  ?.load('24px "Material Symbols Outlined"', "check")
  .then((faces) => {
    if (faces.length > 0) document.documentElement.classList.add("icons-ready");
  })
  .catch(() => undefined);

const hideIcons = (root: ParentNode) => {
  root
    .querySelectorAll(".material-symbols-outlined:not([aria-hidden])")
    .forEach((el) => el.setAttribute("aria-hidden", "true"));
};
new MutationObserver(() => hideIcons(document)).observe(document.body, {
  childList: true,
  subtree: true,
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
