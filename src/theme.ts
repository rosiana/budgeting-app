import { Platform } from 'react-native';
import {
  Category,
  CategoryId,
  IncomeCategory,
  IncomeCategoryId,
  Source,
  SourceId,
  Transaction,
  Who,
  WhoId,
} from './types';

// MoMoney — cute pastel palette with a warm caramel "monkey" brown.
export const colors = {
  primary: '#B07D56', // warm caramel/mocha
  primaryDark: '#8E6242', // cocoa, for gradients/pressed
  primaryLight: '#F4E7DA', // soft latte tint
  accent: '#F2A99B', // pastel peachy-coral
  bg: '#FBF6F0', // warm cream
  card: '#FFFFFF',
  text: '#4A3A2E', // warm dark brown
  textMuted: '#A18C7B', // soft taupe
  border: '#EEE3D8', // warm light
  danger: '#E08576', // soft coral red
  warning: '#E6A94F', // warm amber
  success: '#6BB98A', // pastel sage green
  white: '#FFFFFF',
  /** Light text/caption color for use on the primary brown background. */
  onPrimary: '#F4E7DA',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

// Unified corner radius (matches the "Tagihan Kartu Kredit" card).
export const radius = {
  sm: 16,
  md: 16,
  lg: 16,
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
  { id: 'cicilan', label: 'KPR', icon: 'home', color: '#E0567A' },
  { id: 'utilitas', label: 'Utilitas', icon: 'flash', color: '#F4A259' },
  { id: 'transportasi', label: 'Transportasi', icon: 'car', color: '#4C8BF5' },
  { id: 'skincare', label: 'Personal Care', icon: 'sparkles', color: '#B65BC9' },
  { id: 'makan', label: 'Makan & Minum', icon: 'fast-food', color: '#2E9E5B' },
  { id: 'langganan', label: 'Langganan', icon: 'repeat', color: '#7A6BF5' },
  { id: 'art', label: 'ART', icon: 'people', color: '#C9893B' },
  { id: 'sekolah', label: 'Sekolah', icon: 'school', color: '#3FA7D6' },
  { id: 'fun', label: 'Hobi & Hiburan', icon: 'sunglasses', iconSet: 'mci', color: '#EF6F6C' },
  { id: 'rumah', label: 'Kebutuhan Rumah', icon: 'cart', color: '#5AA469' },
  { id: 'perabot', label: 'Perabot & Peralatan', icon: 'bed', color: '#13A89E' },
  { id: 'fashion', label: 'Fashion', icon: 'shirt', color: '#D6749B' },
  { id: 'rokok', label: 'Rokok & Alkohol', icon: 'wine', color: '#8C6242' },
  { id: 'sedekah', label: 'Sedekah & Hadiah', icon: 'heart', color: '#EC6F9C' },
  { id: 'lainnya', label: 'Lainnya', icon: 'ellipsis-horizontal', color: '#8A9A95' },
];

/** Old category ids → current ones (Listrik/Air/Internet merged into Utilitas). */
export const CATEGORY_MIGRATION: Record<string, CategoryId> = {
  listrik: 'utilitas',
  air: 'utilitas',
  internet: 'utilitas',
};

export function migrateCategory(id: string): CategoryId {
  return (CATEGORY_MIGRATION[id] ?? id) as CategoryId;
}

/** Status color for a budget usage ratio (0..1+): green safe, amber close, red over. */
export function budgetStatusColor(pct: number): string {
  if (pct >= 1) return colors.danger;
  if (pct >= 0.8) return colors.warning;
  return colors.success;
}

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

export const INCOME_CATEGORIES: IncomeCategory[] = [
  { id: 'gaji', label: 'Gaji', icon: 'cash', color: '#2E9E5B' },
  { id: 'bonus', label: 'Bonus', icon: 'gift', color: '#F4A259' },
  { id: 'investasi', label: 'Untung Investasi', icon: 'trending-up', color: '#19B6A7' },
  { id: 'jualan', label: 'Jualan', icon: 'pricetag', color: '#4C8BF5' },
  { id: 'bunga', label: 'Bunga', icon: 'add-circle', color: '#7A6BF5' },
  { id: 'transfer_in', label: 'Transfer Masuk', icon: 'swap-horizontal', color: '#5AA469' },
  { id: 'lainnya_in', label: 'Lainnya', icon: 'ellipsis-horizontal', color: '#8A9A95' },
];

export const INCOME_CATEGORY_MAP: Record<IncomeCategoryId, IncomeCategory> =
  INCOME_CATEGORIES.reduce((acc, c) => {
    acc[c.id] = c;
    return acc;
  }, {} as Record<IncomeCategoryId, IncomeCategory>);

export function incomeCategoryOf(id: IncomeCategoryId): IncomeCategory {
  return INCOME_CATEGORY_MAP[id] ?? INCOME_CATEGORY_MAP.lainnya_in;
}

/** Default credit-card billing config (BCA-style: cutoff ~12, due 27). */
export const DEFAULT_CREDIT_CARD = {
  statementDay: 12,
  dueDay: 27,
  paymentSource: 'bca' as SourceId,
};

export const WHO: Who[] = [
  { id: 'rosi', label: 'Rosi', color: '#B65BC9', emoji: '👩' },
  { id: 'rizal', label: 'Rizal', color: '#4C8BF5', emoji: '👨' },
  { id: 'nonik', label: 'Nonik', color: '#F4A259', emoji: '👶' },
  { id: 'rumah', label: 'Rumah', color: '#0E7C66', emoji: '🏠' },
  { id: 'lainnya', label: 'Lainnya', color: '#8A9A95', emoji: '👥' },
];

export const WHO_MAP: Record<WhoId, Who> = WHO.reduce((acc, w) => {
  acc[w.id] = w;
  return acc;
}, {} as Record<WhoId, Who>);

export function whoOf(id: WhoId): Who {
  return WHO_MAP[id] ?? WHO_MAP.lainnya;
}

export const SOURCES: Source[] = [
  // Rosi's accounts
  { id: 'bca', label: 'BCA', icon: 'card', color: '#1B4DB1', owner: 'rosi' },
  { id: 'seabank', label: 'SeaBank', icon: 'card', color: '#E1542B', owner: 'rosi' },
  { id: 'ovo', label: 'OVO', icon: 'phone-portrait', color: '#4B2A8A', owner: 'rosi' },
  { id: 'shopeepay_rosi', label: 'ShopeePay', icon: 'phone-portrait', color: '#EE4D2D', owner: 'rosi' },
  { id: 'gopay_rosi', label: 'GoPay', icon: 'phone-portrait', color: '#00AAD2', owner: 'rosi' },
  { id: 'bibit', label: 'Bibit', icon: 'trending-up', color: '#1AAE6F', owner: 'rosi' },
  { id: 'ajaib', label: 'Ajaib', icon: 'trending-up', color: '#5A4BE6', owner: 'rosi' },
  { id: 'emas', label: 'Emas', icon: 'diamond', color: '#D4A017', owner: 'rosi' },
  { id: 'tunai_rosi', label: 'Tunai', icon: 'cash', color: '#2E9E5B', owner: 'rosi' },
  // Rizal's accounts
  { id: 'bsi', label: 'BSI', icon: 'card', color: '#00936B', owner: 'rizal' },
  { id: 'mandiri', label: 'Mandiri', icon: 'card', color: '#0A3D8F', owner: 'rizal' },
  { id: 'bni', label: 'BNI', icon: 'card', color: '#E97A1A', owner: 'rizal' },
  { id: 'shopeepay_rizal', label: 'ShopeePay', icon: 'phone-portrait', color: '#EE4D2D', owner: 'rizal' },
  { id: 'gopay_rizal', label: 'GoPay', icon: 'phone-portrait', color: '#00AAD2', owner: 'rizal' },
  { id: 'tunai_rizal', label: 'Tunai', icon: 'cash', color: '#2E9E5B', owner: 'rizal' },
];

export const SOURCE_MAP: Record<SourceId, Source> = SOURCES.reduce(
  (acc, s) => {
    acc[s.id] = s;
    return acc;
  },
  {} as Record<SourceId, Source>
);

export function sourceOf(id: SourceId): Source {
  return SOURCE_MAP[id] ?? SOURCE_MAP.tunai_rosi;
}

/** Sources a person can pay from (their own accounts). */
export function sourcesForPerson(person: 'rosi' | 'rizal'): Source[] {
  return SOURCES.filter((s) => s.owner === person);
}

/** Map an old shared source id to a per-person one, guided by `who` when known. */
export function migrateSource(id: string, who?: string): SourceId {
  if (SOURCE_MAP[id as SourceId]) return id as SourceId;
  const person = who === 'rizal' ? 'rizal' : 'rosi';
  if (id === 'shopeepay') return `shopeepay_${person}` as SourceId;
  if (id === 'gopay') return `gopay_${person}` as SourceId;
  if (id === 'tunai') return `tunai_${person}` as SourceId;
  return 'bca';
}

/** The person using this device (Rosi on iOS, Rizal on Android). */
export const DEVICE_PERSON: 'rosi' | 'rizal' =
  Platform.OS === 'ios' ? 'rosi' : 'rizal';

/** Display icon/label/color for any transaction, income or expense. */
export function txVisual(
  tx: Transaction
): { label: string; icon: string; iconSet?: 'ion' | 'mci'; color: string } {
  if (tx.type === 'income') {
    const c = incomeCategoryOf(tx.incomeCategory ?? 'lainnya_in');
    return { label: c.label, icon: c.icon, color: c.color };
  }
  const c = categoryOf(tx.category);
  return { label: c.label, icon: c.icon, iconSet: c.iconSet, color: c.color };
}
