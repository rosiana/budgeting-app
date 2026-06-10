import { Category, CategoryId } from './types';

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
  { id: 'groceries', label: 'Groceries', icon: 'cart', color: '#2E9E5B' },
  { id: 'dining', label: 'Dining', icon: 'restaurant', color: '#F4A259' },
  { id: 'transport', label: 'Transport', icon: 'car', color: '#4C8BF5' },
  { id: 'shopping', label: 'Shopping', icon: 'bag-handle', color: '#B65BC9' },
  { id: 'bills', label: 'Bills', icon: 'receipt', color: '#E0567A' },
  { id: 'health', label: 'Health', icon: 'fitness', color: '#19B6A7' },
  { id: 'entertainment', label: 'Fun', icon: 'game-controller', color: '#7A6BF5' },
  { id: 'other', label: 'Other', icon: 'ellipsis-horizontal', color: '#8A9A95' },
];

export const CATEGORY_MAP: Record<CategoryId, Category> = CATEGORIES.reduce(
  (acc, c) => {
    acc[c.id] = c;
    return acc;
  },
  {} as Record<CategoryId, Category>
);

export function categoryOf(id: CategoryId): Category {
  return CATEGORY_MAP[id] ?? CATEGORY_MAP.other;
}
