import React from 'react';
import {
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

export function Text(props: TextProps) {
  return (
    <RNText
      {...props}
      style={[props.style, { fontFamily: familyFor(props.style) }]}
    />
  );
}

export function TextInput(props: TextInputProps) {
  return (
    <RNTextInput
      {...props}
      style={[props.style, { fontFamily: familyFor(props.style) }]}
    />
  );
}
