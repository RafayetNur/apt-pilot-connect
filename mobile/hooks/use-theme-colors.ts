import { useColorScheme } from '@/hooks/use-color-scheme';

/**
 * Ported from the Sanjida reference UI's `useThemeColors` (mobile/hooks/useThemeColors.ts).
 * The color tokens and values are unchanged; only the source of the light/dark
 * decision changed, from a Zustand `theme` field to the device color scheme via
 * the project's existing `useColorScheme` hook (matches `constants/theme.ts`'s
 * light/dark split, so it composes with `@react-navigation`'s ThemeProvider).
 */
export type ThemeColors = {
  background: string;
  card: string;
  text: string;
  textSub: string;
  border: string;
  primary: string;
  danger: string;
  dangerBg: string;
  success: string;
  successBg: string;
  warning: string;
  warningBg: string;
  surface: string;
};

const darkColors: ThemeColors = {
  background: '#0F172A',
  card: '#1E293B',
  text: '#F8FAFC',
  textSub: '#94A3B8',
  border: '#334155',
  primary: '#3B82F6',
  danger: '#EF4444',
  dangerBg: '#451A1A',
  success: '#10B981',
  successBg: '#064E3B',
  warning: '#F59E0B',
  warningBg: '#78350F',
  surface: '#293548',
};

const lightColors: ThemeColors = {
  background: '#F8FAFC',
  card: '#ffffff',
  text: '#0F172A',
  textSub: '#64748B',
  border: '#E2E8F0',
  primary: '#3B82F6',
  danger: '#EF4444',
  dangerBg: '#FEF2F2',
  success: '#16A34A',
  successBg: '#DCFCE7',
  warning: '#CA8A04',
  warningBg: '#FEF9C3',
  surface: '#EFF6FF',
};

export function useThemeColors(): ThemeColors {
  const scheme = useColorScheme();
  return scheme === 'dark' ? darkColors : lightColors;
}
