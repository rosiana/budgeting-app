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

export const radius = {
  sm: 10,
  md: 16,
  lg: 26,
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
  { id: 'gopay', label: 'GoPay', icon: 'phone-portrait', color: '#00AAD2' },
  { id: 'bibit', label: 'Bibit', icon: 'trending-up', color: '#1AAE6F' },
  { id: 'ajaib', label: 'Ajaib', icon: 'trending-up', color: '#5A4BE6' },
  { id: 'emas', label: 'Emas', icon: 'diamond', color: '#D4A017' },
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

/** Display icon/label/color for any transaction, income or expense. */
export function txVisual(tx: Transaction): { label: string; icon: string; color: string } {
  if (tx.type === 'income') {
    const c = incomeCategoryOf(tx.incomeCategory ?? 'lainnya_in');
    return { label: c.label, icon: c.icon, color: c.color };
  }
  const c = categoryOf(tx.category);
  return { label: c.label, icon: c.icon, color: c.color };
}
