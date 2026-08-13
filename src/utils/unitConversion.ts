/**
 * Utility for automatic unit conversion in Inventory & POS
 * Standard conversions:
 *  1000 g = 1 kg
 *  1000 ml = 1 L
 *  1 dozen = 12 pcs
 */

export interface UnitConversionRule {
  from: string;
  to: string;
  factor: number; // multiply 'from' qty by factor to get 'to' qty
}

const DEFAULT_CONVERSIONS: Record<string, { baseUnit: string; factor: number }> = {
  // Mass (Base: kg)
  kg: { baseUnit: 'kg', factor: 1 },
  kilogram: { baseUnit: 'kg', factor: 1 },
  kilograms: { baseUnit: 'kg', factor: 1 },
  g: { baseUnit: 'kg', factor: 0.001 },
  gram: { baseUnit: 'kg', factor: 0.001 },
  grams: { baseUnit: 'kg', factor: 0.001 },
  mg: { baseUnit: 'kg', factor: 0.000001 },

  // Volume (Base: L)
  l: { baseUnit: 'l', factor: 1 },
  liter: { baseUnit: 'l', factor: 1 },
  liters: { baseUnit: 'l', factor: 1 },
  litre: { baseUnit: 'l', factor: 1 },
  ml: { baseUnit: 'l', factor: 0.001 },
  milliliter: { baseUnit: 'l', factor: 0.001 },

  // Count (Base: pcs)
  piece: { baseUnit: 'pcs', factor: 1 },
  pieces: { baseUnit: 'pcs', factor: 1 },
  pcs: { baseUnit: 'pcs', factor: 1 },
  pc: { baseUnit: 'pcs', factor: 1 },
  dozen: { baseUnit: 'pcs', factor: 12 },
  doz: { baseUnit: 'pcs', factor: 12 },
};

/**
 * Convert a quantity from one unit to another.
 * Returns null if units are incompatible.
 */
export function convertUnit(
  quantity: number,
  fromUnit: string,
  toUnit: string
): number | null {
  if (!fromUnit || !toUnit) return quantity;

  const cleanFrom = fromUnit.trim().toLowerCase();
  const cleanTo = toUnit.trim().toLowerCase();

  if (cleanFrom === cleanTo) return quantity;

  const fromInfo = DEFAULT_CONVERSIONS[cleanFrom];
  const toInfo = DEFAULT_CONVERSIONS[cleanTo];

  if (fromInfo && toInfo && fromInfo.baseUnit === toInfo.baseUnit) {
    // Convert from -> baseUnit -> to
    const baseQuantity = quantity * fromInfo.factor;
    return baseQuantity / toInfo.factor;
  }

  return null; // Incompatible units
}

/**
 * Formats quantity with unit intelligently.
 * e.g., 1500 g -> "1.5 kg", 500 g -> "500 g"
 */
export function formatSmartUnit(quantity: number, unit: string): string {
  const cleanUnit = (unit || '').trim().toLowerCase();

  if (cleanUnit === 'g' || cleanUnit === 'gram' || cleanUnit === 'grams') {
    if (quantity >= 1000) {
      return `${(quantity / 1000).toLocaleString('en-US', { maximumFractionDigits: 3 })} kg`;
    }
  } else if (cleanUnit === 'ml' || cleanUnit === 'milliliter') {
    if (quantity >= 1000) {
      return `${(quantity / 1000).toLocaleString('en-US', { maximumFractionDigits: 3 })} L`;
    }
  }

  return `${quantity.toLocaleString('en-US', { maximumFractionDigits: 3 })} ${unit}`;
}
