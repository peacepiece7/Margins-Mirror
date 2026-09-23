import { Platform, type TextStyle, type ViewStyle } from 'react-native';

export const fontFamilies = {
  sans: Platform.select({ android: 'sans-serif', default: 'System', web: 'system-ui' }),
  serif: Platform.select({ android: 'serif', default: 'AppleMyungjo', web: 'Georgia' }),
} as const;

export const colors = {
  canvas: '#F3F2F2',
  paper: '#F8F7F6',
  surface: '#EAE9E9',
  ink: '#201F1D',
  muted: '#605D5D',
  line: '#D7D3D3',
  accent: '#B68235',
  accentDeep: '#7D5411',
  accentSoft: '#EEE4D4',
  navy: '#3E4650',
  orange: '#A96731',
  statusReading: '#8D4A26',
  brass: '#B68235',
  link: '#765019',
  success: '#526B50',
  danger: '#98433F',
  dark: '#151412',
  darkSurface: '#1D1B18',
  darkLine: '#45413B',
  darkText: '#F3EFE8',
  darkMuted: '#B9B1A5',
  launchBackground: '#030303',
  launchText: '#FFFDF7',
  white: '#FFFFFF',
  transparent: 'transparent',
} as const;

export const spacing = {
  x1: 4,
  x2: 8,
  x3: 12,
  x4: 16,
  x5: 20,
  x6: 24,
  x8: 32,
} as const;

export const radius = {
  small: 2,
  medium: 4,
  large: 7,
  pill: 999,
} as const;

export const typography = {
  display: {
    fontFamily: fontFamilies.serif,
    fontSize: 36,
    lineHeight: 44,
    fontWeight: '400',
    color: colors.ink,
  } satisfies TextStyle,
  title: {
    fontFamily: fontFamilies.serif,
    fontSize: 28,
    lineHeight: 35,
    fontWeight: '500',
    color: colors.ink,
  } satisfies TextStyle,
  heading: {
    fontFamily: fontFamilies.serif,
    fontSize: 20,
    lineHeight: 27,
    fontWeight: '600',
    color: colors.ink,
  } satisfies TextStyle,
  body: {
    fontFamily: fontFamilies.serif,
    fontSize: 15,
    lineHeight: 24,
    color: colors.ink,
  } satisfies TextStyle,
  label: {
    fontFamily: fontFamilies.sans,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: colors.ink,
  } satisfies TextStyle,
  caption: {
    fontFamily: fontFamilies.sans,
    fontSize: 11,
    lineHeight: 16,
    color: colors.muted,
  } satisfies TextStyle,
  eyebrow: {
    color: colors.accentDeep,
    fontFamily: fontFamilies.sans,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    lineHeight: 15,
    textTransform: 'uppercase',
  } satisfies TextStyle,
} as const;

export const shadows = {
  paper: {
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.025,
    shadowRadius: 2,
    elevation: 0,
  } satisfies ViewStyle,
} as const;
