import {
  Category,
  CategoryId,
  Source,
  SourceId,
  Who,
  WhoId,
} from './types';

export const colors = {
  primary: '#0E7C66',
  primaryDark: '#0A5D4C',
  primaryLight: '#E3F3EF',
  accent: '#F4A259',
  bg: '#F6F8F7',
  card: '#FFFFFF',
  text: '#1B2B27',
  textMuted: '#6B7C77',
  border: '#E4EAE8',
  danger: '#D7544C',
  success: '#2E9E5B',
  white: '#FFFFFF',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 20,
  pill: 999,
};

/** Absolute-fill style (RN 0.85 dropped StyleSheet.absoluteFillObject typings). */
export const fill = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
} as const;

export const CATEGORIES: Category[] = [
  { id: 'cicilan', label: 'Cicilan Rumah', icon: 'home', color: '#E0567A' },
  { id: 'listrik', label: 'Listrik', icon: 'flash', color: '#F4A259' },
  { id: 'air', label: 'Air', icon: 'water', color: '#4C8BF5' },
  { id: 'internet', label: 'Internet', icon: 'wifi', color: '#19B6A7' },
  { id: 'skincare', label: 'Skincare', icon: 'sparkles', color: '#B65BC9' },
  { id: 'makan', label: 'Makan & Minum', icon: 'fast-food', color: '#2E9E5B' },
  { id: 'langganan', label: 'Langganan', icon: 'repeat', color: '#7A6BF5' },
  { id: 'art', label: 'ART', icon: 'people', color: '#C9893B' },
  { id: 'sekolah', label: 'Sekolah', icon: 'school', color: '#3FA7D6' },
  { id: 'fun', label: 'Fun', icon: 'game-controller', color: '#EF6F6C' },
  { id: 'rumah', label: 'Kebutuhan Rumah', icon: 'cart', color: '#5AA469' },
  { id: 'lainnya', label: 'Lainnya', icon: 'ellipsis-horizontal', color: '#8A9A95' },
];

export const CATEGORY_MAP: Record<CategoryId, Category> = CATEGORIES.reduce(
  (acc, c) => {
    acc[c.id] = c;
    return acc;
  },
  {} as Record<CategoryId, Category>
);

export function categoryOf(id: CategoryId): Category {
  return CATEGORY_MAP[id] ?? CATEGORY_MAP.lainnya;
}

export const WHO: Who[] = [
  { id: 'rosi', label: 'Rosi', color: '#B65BC9' },
  { id: 'rizal', label: 'Rizal', color: '#4C8BF5' },
  { id: 'nonik', label: 'Nonik', color: '#F4A259' },
  { id: 'rumah', label: 'Rumah', color: '#0E7C66' },
  { id: 'lainnya', label: 'Lainnya', color: '#8A9A95' },
];

export const WHO_MAP: Record<WhoId, Who> = WHO.reduce((acc, w) => {
  acc[w.id] = w;
  return acc;
}, {} as Record<WhoId, Who>);

export function whoOf(id: WhoId): Who {
  return WHO_MAP[id] ?? WHO_MAP.lainnya;
}

export const SOURCES: Source[] = [
  { id: 'bca', label: 'BCA', icon: 'card', color: '#1B4DB1' },
  { id: 'seabank', label: 'SeaBank', icon: 'card', color: '#E1542B' },
  { id: 'bsi', label: 'BSI', icon: 'card', color: '#00936B' },
  { id: 'mandiri', label: 'Mandiri', icon: 'card', color: '#0A3D8F' },
  { id: 'bni', label: 'BNI', icon: 'card', color: '#E97A1A' },
  { id: 'ovo', label: 'OVO', icon: 'phone-portrait', color: '#4B2A8A' },
  { id: 'shopeepay', label: 'ShopeePay', icon: 'phone-portrait', color: '#EE4D2D' },
  { id: 'bibit', label: 'Bibit', icon: 'trending-up', color: '#1AAE6F' },
  { id: 'ajaib', label: 'Ajaib', icon: 'trending-up', color: '#5A4BE6' },
  { id: 'tunai', label: 'Tunai', icon: 'cash', color: '#2E9E5B' },
];

export const SOURCE_MAP: Record<SourceId, Source> = SOURCES.reduce(
  (acc, s) => {
    acc[s.id] = s;
    return acc;
  },
  {} as Record<SourceId, Source>
);

export function sourceOf(id: SourceId): Source {
  return SOURCE_MAP[id] ?? SOURCE_MAP.tunai;
}
