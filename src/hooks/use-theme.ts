"use client";

import { useEffect, useState } from "react";
import { THEME_STORAGE_KEY } from "@/lib/theme";

export function useTheme(initialDark = false) {
  const [dark, setDark] = useState(initialDark);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDark(document.documentElement.classList.contains("dark"));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const toggle = () => {
    const next = !document.documentElement.classList.contains("dark");
    const style = document.createElement("style");
    style.appendChild(document.createTextNode("*,*::before,*::after{transition:none !important}"));
    document.head.appendChild(style);
    document.documentElement.classList.toggle("dark", next);
    void document.documentElement.offsetHeight;
    const value = next ? "dark" : "light";
    localStorage.setItem(THEME_STORAGE_KEY, value);
    document.cookie = `${THEME_STORAGE_KEY}=${value};path=/;max-age=31536000;samesite=lax`;
    setDark(next);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => style.remove());
    });
  };

  return { dark, toggle };
}
