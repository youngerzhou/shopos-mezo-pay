
/**
 * Mock Mezo Passport Level Detection
 * Returns a level (1, 2, or 3) based on the address.
 * For demo, we use the character codes to semi-randomly assign a level.
 */
export function getPassportLevel(address: string): 1 | 2 | 3 {
  const cleanAddress = address.toLowerCase().trim();
  // Simple deterministic logic for demo
  const charSum = cleanAddress.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const mod = charSum % 3;
  return (mod + 1) as 1 | 2 | 3;
}

/**
 * Discount Mapping based on Mezo Passport Levels
 */
export const PASSPORT_DISCOUNTS = {
  1: { rate: 0.05, label: "5% OFF (95折)" },
  2: { rate: 0.10, label: "10% OFF (9折)" },
  3: { rate: 0.12, label: "12% OFF (88折)" },
} as const;

export function calculateDiscountedPrice(originalPrice: number, level: 1 | 2 | 3) {
  const discount = PASSPORT_DISCOUNTS[level];
  const discountAmount = originalPrice * discount.rate;
  const finalPrice = originalPrice - discountAmount;
  
  return {
    originalPrice,
    discountRate: discount.rate,
    discountAmount,
    finalPrice,
    label: discount.label
  };
}
