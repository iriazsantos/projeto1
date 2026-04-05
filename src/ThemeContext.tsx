import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Theme Types
export type ThemeId = 'light' | 'dark' | 'blue';

export interface Theme {
  id: ThemeId;
  name: string;
  icon: string;
  description: string;
  colors: {
    primary: string;
    primaryDark: string;
    primaryLight: string;
    gradient: string;
    gradientFrom: string;
    gradientVia: string;
    gradientTo: string;
    ring: string;
    bg: string;
    text: string;
    sidebar: string;
    cardBg: string;
    cardBorder: string;
    // Premium Glassmorphism Variables
    mainBg: string;
    glassBg: string;
    glassBorder: string;
    textMain: string;
    textMuted: string;
    glow1: string;
    glow2: string;
  };
}

// Theme Definitions
export const THEMES: Theme[] = [
  {
    id: 'light',
    name: 'Branco',
    icon: '☀️',
    description: 'Minimalista e claro com efeito de vidro opalescente',
    colors: {
      primary: 'cyan-500',
      primaryDark: 'cyan-600',
      primaryLight: 'cyan-400',
      gradient: 'from-cyan-400 via-blue-500 to-emerald-500',
      gradientFrom: 'cyan-400',
      gradientVia: 'blue-500',
      gradientTo: 'emerald-500',
      ring: 'cyan-200',
      bg: 'white',
      text: 'slate-700',
      sidebar: 'from-white via-cyan-50 to-emerald-50',
      cardBg: 'rgba(255, 255, 255, 0.95)',
      cardBorder: 'rgba(103, 232, 249, 0.34)',
      
      mainBg: '#f8fafc',
      glassBg: 'rgba(255, 255, 255, 0.6)',
      glassBorder: 'rgba(255, 255, 255, 0.8)',
      textMain: '#1e293b',
      textMuted: '#64748b',
      glow1: 'rgba(99, 102, 241, 0.08)',
      glow2: 'rgba(16, 185, 129, 0.08)'
    },
  },
  {
    id: 'dark',
    name: 'Preto',
    icon: '🌑',
    description: 'Sofisticação noturna com contraste e neons sutis',
    colors: {
      primary: 'zinc-100',
      primaryDark: 'zinc-300',
      primaryLight: 'zinc-50',
      gradient: 'from-zinc-950 via-zinc-900 to-black',
      gradientFrom: 'zinc-950',
      gradientVia: 'zinc-900',
      gradientTo: 'black',
      ring: 'zinc-200/30',
      bg: 'black',
      text: 'zinc-100',
      sidebar: 'from-[#000000] via-[#0a0a0a] to-[#000000]',
      cardBg: 'rgba(8, 8, 8, 0.94)',
      cardBorder: 'rgba(255, 255, 255, 0.16)',

      mainBg: '#050505',
      glassBg: 'rgba(255, 255, 255, 0.04)',
      glassBorder: 'rgba(255, 255, 255, 0.12)',
      textMain: '#ffffff',
      textMuted: '#a1a1aa',
      glow1: 'rgba(99, 102, 241, 0.15)',
      glow2: 'rgba(6, 182, 212, 0.15)'
    },
  },
  {
    id: 'blue',
    name: 'Azul',
    icon: '🌊',
    description: 'Imersivo e moderno com tons de oceano profundo',
    colors: {
      primary: 'sky-500',
      primaryDark: 'sky-600',
      primaryLight: 'sky-400',
      gradient: 'from-blue-600 via-sky-600 to-indigo-600',
      gradientFrom: 'blue-600',
      gradientVia: 'sky-600',
      gradientTo: 'indigo-600',
      ring: 'sky-200/30',
      bg: 'slate-950',
      text: 'sky-100',
      sidebar: 'from-slate-950 via-blue-950 to-slate-950',
      cardBg: 'rgba(15, 23, 42, 0.94)',
      cardBorder: 'rgba(56, 189, 248, 0.2)',

      mainBg: '#020617',
      glassBg: 'rgba(14, 165, 233, 0.06)',
      glassBorder: 'rgba(56, 189, 248, 0.20)',
      textMain: '#ffffff',
      textMuted: '#7dd3fc',
      glow1: 'rgba(56, 189, 248, 0.20)',
      glow2: 'rgba(129, 140, 248, 0.20)'
    },
  }
];

// Context
interface ThemeContextType {
  currentTheme: Theme;
  setTheme: (themeId: ThemeId) => void;
  themes: Theme[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Provider
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [currentTheme, setCurrentTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('inovatech-theme');
    return THEMES.find(t => t.id === saved) || THEMES.find(t => t.id === 'dark') || THEMES[0];
  });

  useEffect(() => {
    localStorage.setItem('inovatech-theme', currentTheme.id);
    document.documentElement.setAttribute('data-theme', currentTheme.id);

    const paletteByTheme: Record<ThemeId, {
      primary: string;
      accent: string;
      accentSolid: string;
      accentHover: string;
      accentSoft: string;
      accentText: string;
      focusRing: string;
    }> = {
      light: {
        primary: '#06b6d4',
        accent: 'linear-gradient(135deg, #06b6d4 0%, #2563eb 48%, #10b981 100%)',
        accentSolid: '#06b6d4',
        accentHover: '#0284c7',
        accentSoft: 'rgba(6, 182, 212, 0.2)',
        accentText: '#ffffff',
        focusRing: 'rgba(6, 182, 212, 0.24)'
      },
      dark: {
        primary: '#ffffff',
        accent: 'linear-gradient(135deg, #ffffff 0%, #d4d4d8 48%, #a1a1aa 100%)',
        accentSolid: '#ffffff',
        accentHover: '#e4e4e7',
        accentSoft: 'rgba(255, 255, 255, 0.2)',
        accentText: '#000000',
        focusRing: 'rgba(255, 255, 255, 0.26)'
      },
      blue: {
        primary: '#38bdf8',
        accent: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 50%, #818cf8 100%)',
        accentSolid: '#0ea5e9',
        accentHover: '#0284c7',
        accentSoft: 'rgba(56, 189, 248, 0.2)',
        accentText: '#ffffff',
        focusRing: 'rgba(56, 189, 248, 0.3)'
      }
    };

    const palette = paletteByTheme[currentTheme.id] || paletteByTheme['dark'];
    const root = document.documentElement;
    root.style.setProperty('--theme-primary', palette.primary);
    root.style.setProperty('--theme-accent', palette.accent);
    root.style.setProperty('--theme-accent-solid', palette.accentSolid);
    root.style.setProperty('--theme-accent-hover', palette.accentHover);
    root.style.setProperty('--theme-accent-soft', palette.accentSoft);
    root.style.setProperty('--theme-accent-text', palette.accentText);
    root.style.setProperty('--theme-focus-ring', palette.focusRing);
    root.style.setProperty('--main-bg', currentTheme.colors.mainBg);
    root.style.setProperty('--card-bg', currentTheme.colors.cardBg);
    root.style.setProperty('--card-border', currentTheme.colors.cardBorder);
    root.style.setProperty('--text-primary', currentTheme.colors.textMain);
    // Bind premium properties
    root.style.setProperty('--glass-bg', currentTheme.colors.glassBg);
    root.style.setProperty('--glass-border', currentTheme.colors.glassBorder);
    root.style.setProperty('--text-muted', currentTheme.colors.textMuted);
    root.style.setProperty('--glow-1', currentTheme.colors.glow1);
    root.style.setProperty('--glow-2', currentTheme.colors.glow2);
  }, [currentTheme]);

  return (
    <ThemeContext.Provider value={{ currentTheme, setTheme: (id) => {
      const theme = THEMES.find(t => t.id === id);
      if (theme) setCurrentTheme(theme);
    }, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

// Hook
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}

// Theme Utility Classes
export function getThemeClasses(theme: Theme) {
  return {
    gradient: `bg-gradient-to-r ${theme.colors.gradient}`,
    gradientText: `bg-gradient-to-r ${theme.colors.gradient} bg-clip-text text-transparent`,
    primaryButton: `bg-gradient-to-r ${theme.colors.gradient} text-white font-bold shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all`,
    secondaryButton: `border-2 border-gray-200 bg-white text-gray-700 font-semibold hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 transition-all`,
    inputFocus: `focus:border-${theme.colors.primary} focus:ring-${theme.colors.ring}`,
    sidebar: `bg-gradient-to-b ${theme.colors.sidebar}`,
    badge: `bg-${theme.colors.bg} text-${theme.colors.text}`,
  };
}
