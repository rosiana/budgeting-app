import {
  Fredoka_400Regular,
  Fredoka_500Medium,
  Fredoka_600SemiBold,
  Fredoka_700Bold,
  useFonts,
} from '@expo-google-fonts/fredoka';
import React from 'react';
import { StyleSheet, Text as RNText, TextInput as RNTextInput } from 'react-native';

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

function familyFor(style: any): string {
  const flat = StyleSheet.flatten(style) || {};
  const w = flat.fontWeight != null ? String(flat.fontWeight) : 'normal';
  return FAMILY[w] || 'Fredoka_500Medium';
}

let patched = false;

/**
 * Make Fredoka (rounded) the default family on every Text and TextInput by
 * patching the forwardRef's render. Wrapped with cloneElement so the family
 * applies even when the component supplies its own `style` prop.
 *
 * Called both at module load AND after fonts resolve to be defensive about
 * timing — the patch itself is idempotent.
 */
export function applyRoundedFont() {
  if (patched) return;
  patched = true;
  for (const Comp of [RNText, RNTextInput] as any[]) {
    const orig = Comp.render;
    if (typeof orig !== 'function') continue;
    Comp.render = function (props: any, ref: any) {
      const el = orig.call(this, props, ref);
      if (!el || !React.isValidElement(el)) return el;
      const elStyle = (el.props as any).style;
      return React.cloneElement(el as any, {
        // user style first → user can still override fontFamily if they want.
        // BUT we put the font LAST below so it ALWAYS wins; the only reason to
        // ever override would be to force a non-Fredoka font, which we don't.
        style: [elStyle, { fontFamily: familyFor(elStyle) }],
      });
    };
  }
}

const fontMap = {
  Fredoka_400Regular,
  Fredoka_500Medium,
  Fredoka_600SemiBold,
  Fredoka_700Bold,
};

export function useAppFonts(): boolean {
  const [loaded] = useFonts(fontMap);
  return loaded;
}
