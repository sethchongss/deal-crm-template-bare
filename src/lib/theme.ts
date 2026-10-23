/** Explicit light/dark choice. Bumped from "theme", which the old hook saved on load while defaulting to dark. */
export const THEME_STORAGE_KEY = "theme-v2";

/** Blocking boot script. Dark only when this key is "dark"; otherwise the server cookie, which is unset until a toggle. */
export function themeBootScript(serverDark: boolean) {
  const key = JSON.stringify(THEME_STORAGE_KEY);
  const fallback = serverDark ? "true" : "false";
  return `try{var t=localStorage.getItem(${key});var dark=t?t==="dark":${fallback};document.documentElement.classList.toggle("dark",dark);}catch(e){}`;
}
