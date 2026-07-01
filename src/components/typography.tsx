import React from 'react';
import {
  Platform,
  StyleSheet,
  Text as RNText,
  TextInput as RNTextInput,
  TextInputProps,
  TextProps,
} from 'react-native';

/**
 * Wrapped Text / TextInput that force the Fredoka rounded family. Imported in
 * every screen so the font definitely takes effect — we don't rely on the
 * `Text.render` patch (which isn't reliable on RN 0.83 / React 19 forwardRef).
 *
 * Android specifics: setting `fontFamily` + `fontWeight` at the same time
 * makes Android's font resolver ignore the family and fall back to the
 * system Bold face (Roboto), which is why Rizal's phone showed a sans-serif
 * bold instead of Fredoka bold. The fix is to translate `fontWeight` into
 * a family-family variant (Fredoka_700Bold) AND wipe the fontWeight to
 * 'normal' on Android so the resolver honors the custom family.
 */

const FAMILY: Record<string, string> = {
  '100': 'Fredoka_400Regular',
  '200': 'Fredoka_400Regular',
  '300': 'Fredoka_400Regular',
  '400': 'Fredoka_400Regular',
  normal: 'Fredoka_400Regular',
  '500': 'Fredoka_500Medium',
  '600': 'Fredoka_600SemiBold',
  '700': 'Fredoka_700Bold',
  '800': 'Fredoka_700Bold',
  '900': 'Fredoka_700Bold',
  bold: 'Fredoka_700Bold',
};

function familyFor(style: TextProps['style']): string {
  const flat = StyleSheet.flatten(style as any) || {};
  const w =
    (flat as any).fontWeight != null ? String((flat as any).fontWeight) : 'normal';
  return FAMILY[w] || 'Fredoka_500Medium';
}

// On Android we override fontWeight to 'normal' so the resolver honors our
// custom family (see comment above). On iOS the resolver uses the family
// name including weight, and setting weight helps CoreText pick the right
// PostScript face — leave it alone there.
const WEIGHT_RESET = Platform.OS === 'android' ? { fontWeight: 'normal' as const } : undefined;

export function Text(props: TextProps) {
  return (
    <RNText
      {...props}
      style={[props.style, WEIGHT_RESET, { fontFamily: familyFor(props.style) }]}
    />
  );
}

export function TextInput(props: TextInputProps) {
  return (
    <RNTextInput
      {...props}
      style={[props.style, WEIGHT_RESET, { fontFamily: familyFor(props.style) }]}
    />
  );
}
