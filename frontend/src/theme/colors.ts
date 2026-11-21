// Source of truth: the "MotoRadar App Design" project (MotoRadar.dc.html)
export const colors = {
  void: '#08080A',
  charcoal: '#111214',
  speedGreen: '#63FF4D',
  sosRed: '#FF2D46',
  assistAmber: '#FFB020',
  ghostSlate: '#3C5A78', // Ghost Mode — deliberately cold, never neon green (green = live)

  white: '#FFFFFF',
  textPrimary: 'rgba(255,255,255,0.9)',
  textSecondary: 'rgba(255,255,255,0.55)',
  textTertiary: 'rgba(255,255,255,0.4)',
  hairline: 'rgba(255,255,255,0.12)',
} as const;

export type ColorToken = keyof typeof colors;
