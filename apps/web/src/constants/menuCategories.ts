/** Course filters shown above the included-dish list. */
export const MENU_CATEGORIES = [
  'All courses',
  'Rice',
  'Curry',
  'Grill',
  'Salads',
  'Drinks',
  'Desserts',
] as const;

/** One course filter. */
export type MenuCategory = (typeof MENU_CATEGORIES)[number];

/** Keyword patterns used to place an included dish under a course. */
const CATEGORY_PATTERNS: ReadonlyArray<readonly [Exclude<MenuCategory, 'All courses'>, RegExp]> = [
  ['Rice', /rice|biryani|pulao|pulav/i],
  ['Curry', /qorma|korma|curry|karahi|haleem|nihari|daal|\bdal\b/i],
  ['Grill', /kebab|kabab|tikka|bbq|grill|boti/i],
  ['Salads', /salad|raita/i],
  ['Drinks', /drink|juice|lassi|soda|beverage|tea/i],
  ['Desserts', /dessert|kheer|halwa|gulab|kulfi|sweet/i],
];

/**
 * Reports whether an included dish belongs to a course. The catalogue does not
 * carry course metadata yet, so this is a keyword match on the dish name; dishes
 * that match nothing appear only under "All courses".
 *
 * @param dish Dish name from the approved package.
 * @param category Selected course filter.
 * @returns True when the dish should be listed for that filter.
 */
export function dishMatchesCategory(dish: string, category: MenuCategory): boolean {
  if (category === 'All courses') {
    return true;
  }
  const match = CATEGORY_PATTERNS.find(([, pattern]) => pattern.test(dish));
  return match?.[0] === category;
}
