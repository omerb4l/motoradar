// Archivo = display/UI text. JetBrains Mono = numerals, labels, telemetry (tabular-nums).
export const fonts = {
  display: 'Archivo_800ExtraBold',
  displaySemibold: 'Archivo_600SemiBold',
  body: 'Archivo_400Regular',
  bodyMedium: 'Archivo_500Medium',
  mono: 'JetBrainsMono_500Medium',
  monoBold: 'JetBrainsMono_700Bold',
} as const;

// The source design's CSS line-heights (e.g. "font:700 78px/.82") are tight
// on purpose, but a CSS line-box can let glyphs overflow it — React Native's
// Text clips to lineHeight instead, so a literal port here chops the tops
// off tall numerals. Keeping lineHeight >= fontSize avoids that; letting the
// numerals sit a little taller than the web version is the acceptable trade.
export const type = {
  hudSpeed: { fontFamily: fonts.monoBold, fontSize: 150, lineHeight: 156, letterSpacing: -8 },
  widgetSpeed: { fontFamily: fonts.monoBold, fontSize: 78, lineHeight: 82, letterSpacing: -4 },
  metricValue: { fontFamily: fonts.monoBold, fontSize: 46, lineHeight: 50, letterSpacing: -2 },
  label: { fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase' as const },
  tabLabel: { fontFamily: fonts.monoBold, fontSize: 11, letterSpacing: 1.1, textTransform: 'uppercase' as const },
  title: { fontFamily: fonts.display, fontSize: 34, letterSpacing: -0.7 },
} as const;
