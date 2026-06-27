import {
  Quicksand_400Regular,
  Quicksand_500Medium,
  Quicksand_600SemiBold,
  Quicksand_700Bold,
  useFonts,
} from '@expo-google-fonts/quicksand';
import React from 'react';
import { StyleSheet, Text as RNText, TextInput as RNTextInput } from 'react-native';

const FAMILY: Record<string, string> = {
  '100': 'Quicksand_400Regular',
  '200': 'Quicksand_400Regular',
  '300': 'Quicksand_400Regular',
  '400': 'Quicksand_400Regular',
  normal: 'Quicksand_400Regular',
  '500': 'Quicksand_500Medium',
  '600': 'Quicksand_600SemiBold',
  '700': 'Quicksand_700Bold',
  '800': 'Quicksand_700Bold',
  '900': 'Quicksand_700Bold',
  bold: 'Quicksand_700Bold',
};

function familyFor(style: any): string {
  const flat = StyleSheet.flatten(style) || {};
  const w = flat.fontWeight != null ? String(flat.fontWeight) : 'normal';
  return FAMILY[w] || 'Quicksand_500Medium';
}

let patched = false;

/**
 * Inject the Quicksand family into every Text/TextInput, mapped by fontWeight.
 * Patches the forwardRef's `render` so the family applies even when the
 * component sets its own `style` (defaultProps merging would NOT work because
 * React replaces, not merges, defaultProps for style).
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
        // Family placed AFTER user style so it wins unless they explicitly
        // override fontFamily (rare). fontWeight is left alone so the layout
        // engine still picks the right variant.
        style: [elStyle, { fontFamily: familyFor(elStyle) }],
      });
    };
  }
}

const fontMap = {
  Quicksand_400Regular,
  Quicksand_500Medium,
  Quicksand_600SemiBold,
  Quicksand_700Bold,
};

export function useAppFonts(): boolean {
  const [loaded] = useFonts(fontMap);
  return loaded;
}
