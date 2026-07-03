import { createContext, useContext, useEffect, useState } from 'react';
import api from '../services/api';

const ThemeContext = createContext({
  primaryColor: '#3B82F6',
  secondaryColor: '#10B981',
});

const STORAGE_KEY = 'academy_theme';

function applyTheme(primaryColor, secondaryColor) {
  document.documentElement.style.setProperty('--primary-color', primaryColor);
  document.documentElement.style.setProperty('--secondary-color', secondaryColor);
}

function readCachedTheme() {
  try {
    const cached = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (cached.primaryColor && cached.secondaryColor) return cached;
  } catch {}
  return null;
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    // Synchronous: apply cached colors before first render to avoid flicker
    const cached = readCachedTheme();
    if (cached) {
      applyTheme(cached.primaryColor, cached.secondaryColor);
      return cached;
    }
    return { primaryColor: '#3B82F6', secondaryColor: '#10B981' };
  });

  useEffect(() => {
    const controller = new AbortController();

    api.get('/academies/settings', {
      skipAuthRedirect: true,    // prevents 401 → /login redirect loop on public pages
      signal: controller.signal, // cancels the in-flight request on unmount
    })
      .then(({ data }) => {
        const { primary_color, secondary_color } = data.data;
        applyTheme(primary_color, secondary_color);
        const newTheme = { primaryColor: primary_color, secondaryColor: secondary_color };
        setTheme(newTheme);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newTheme));
      })
      .catch((err) => {
        if (err.code === 'ERR_CANCELED') return; // unmount cleanup, not a real error
        // 401 on public pages: silently keep cached/default colors
      });

    return () => controller.abort();
  }, []);

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
