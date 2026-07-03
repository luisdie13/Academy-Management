import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api from '../services/api';
import { applyPalette } from '../utils/colorPalette';

const ThemeContext = createContext({
  primaryColor: '#0284c7',
  secondaryColor: '#10B981',
  updateTheme: () => {},
});

const STORAGE_KEY = 'academy_theme';

function applyTheme(primaryColor, secondaryColor) {
  applyPalette(primaryColor);
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
    return { primaryColor: '#0284c7', secondaryColor: '#10B981' };
  });

  const updateTheme = useCallback((primaryColor, secondaryColor) => {
    applyTheme(primaryColor, secondaryColor);
    const newTheme = { primaryColor, secondaryColor };
    setTheme(newTheme);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newTheme));
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    api.get('/academies/settings', {
      skipAuthRedirect: true,    // prevents 401 → /login redirect loop on public pages
      signal: controller.signal, // cancels the in-flight request on unmount
    })
      .then(({ data }) => {
        const { primary_color, secondary_color } = data.data;
        updateTheme(primary_color, secondary_color);
      })
      .catch((err) => {
        if (err.code === 'ERR_CANCELED') return; // unmount cleanup, not a real error
        // 401 on public pages: silently keep cached/default colors
      });

    return () => controller.abort();
  }, [updateTheme]);

  return (
    <ThemeContext.Provider value={{ ...theme, updateTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
