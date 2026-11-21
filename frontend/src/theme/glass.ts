// "Liquid Glass" recipe, lifted directly from the design source:
// blur(26-34px) saturate(180%) · bg white 5->13% vertical gradient
// border white 15% · inset highlight white 30% · shadow 0 22px 50px black 55%
import { ViewStyle } from 'react-native';

export const glass = {
  intensity: 30, // expo-blur intensity, maps to ~28px blur
  tint: 'dark' as const,

  panel: {
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(255,255,255,0.06)', // flat fallback under the BlurView
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 22 },
    shadowOpacity: 0.55,
    shadowRadius: 50,
    elevation: 12,
  } satisfies ViewStyle,

  insetHighlight: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.30)',
  } satisfies ViewStyle,

  hairline: 'rgba(255,255,255,0.16)',
} as const;
