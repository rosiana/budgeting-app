import {
  Quicksand_400Regular,
  Quicksand_500Medium,
  Quicksand_600SemiBold,
  Quicksand_700Bold,
  useFonts,
} from '@expo-google-fonts/quicksand';
import React from 'react';
import { StyleSheet, Text as RNText, TextInput as RNTextInput } from 'react-native';

const fontMap = {
  Quicksand_400Regular,
  Quicksand_500Medium,
  Quicksand_600SemiBold,
  Quicksand_700Bold,
};

/** Map a fontWeight to the matching Quicksand family (it's rounded on the ends). */
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
  const weight = flat.fontWeight != null ? String(flat.fontWeight) : 'normal';
  return FAMILY[weight] || 'Quicksand_500Medium';
}

let patched = false;
/** Inject the rounded font into every Text/TextInput, keyed by their weight. */
export function applyRoundedFont() {
  if (patched) return;
  patched = true;
  for (const Comp of [RNText, RNTextInput] as any[]) {
    const orig = Comp.render;
    if (typeof orig !== 'function') continue;
    Comp.render = function (...args: any[]) {
      const el = orig.apply(this, args);
      return React.cloneElement(el, {
        style: [el.props.style, { fontFamily: familyFor(el.props.style), fontWeight: 'normal' }],
      });
    };
  }
}

export function useAppFonts(): boolean {
  const [loaded] = useFonts(fontMap);
  return loaded;
}
