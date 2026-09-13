/**
 * Price & Number Parsing and Formatting Utilities
 * Supports uppercase, lowercase, and interchangeable dots (.) and commas (,)
 * as thousands and decimal separators (e.g. "$12.500", "12,500", "12.500,50", "12,500.00",
 * "1.250.000", "1,250,000", "12500 COP", "cop 12.500", "12500.00", "12500,00", "12500").
 */

/**
 * Unpacks any object (ExcelJS richText, formula result, hyperlink) into primitive value
 */
function unpackValue(val: any): any {
  if (val === null || val === undefined) return '';
  if (typeof val === 'number' || typeof val === 'boolean') return val;
  if (typeof val === 'string') return val;

  if (typeof val === 'object') {
    if (Array.isArray(val.richText)) {
      return val.richText.map((t: any) => (t && typeof t === 'object' ? t.text || '' : String(t || ''))).join('');
    }
    if ('result' in val && val.result !== undefined && val.result !== null) {
      return unpackValue(val.result);
    }
    if ('text' in val && val.text !== undefined && val.text !== null) {
      return unpackValue(val.text);
    }
    if ('hyperlink' in val) {
      return String(val.hyperlink || '');
    }
    if ('value' in val && val.value !== val) {
      return unpackValue(val.value);
    }
    if (Array.isArray(val)) {
      return val.map(unpackValue).join(' ');
    }
  }

  const str = String(val);
  return str === '[object Object]' ? '' : str;
}

/**
 * Universal price & number parser that flexibly interprets numeric strings with any combination of . and ,
 * Case-insensitive, strips currency symbols, spaces, accents, and letters safely.
 */
export function parseFlexiblePrice(value: any, roundToInteger: boolean = true): number {
  if (value === null || value === undefined) return 0;
  
  const unpacked = unpackValue(value);
  if (typeof unpacked === 'number') {
    if (isNaN(unpacked) || !isFinite(unpacked)) return 0;
    return roundToInteger ? Math.round(unpacked) : unpacked;
  }

  let str = String(unpacked).trim();
  if (!str || str === '[object Object]') return 0;

  // Normalize Unicode and lower-case for currency checks
  str = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

  // Check if string is scientific notation (e.g. "1.5e4", "2E5")
  if (/^[+-]?\d+(?:\.\d+)?[eE][+-]?\d+$/.test(str)) {
    const parsedSci = parseFloat(str);
    if (!isNaN(parsedSci) && isFinite(parsedSci)) {
      return roundToInteger ? Math.round(parsedSci) : parsedSci;
    }
  }

  const isNegative = str.startsWith('-') || str.includes('( -') || str.includes('(-');

  // Remove currency signs ($ € £), words like COP, col$, pesos, usd, eur, and all letters/spaces
  // Keep only digits, dots and commas
  str = str.replace(/[a-zA-Z$€£¥\s\u00A0_-]/g, '').trim();
  if (!str || str === '-' || str === '.' || str === ',' || str === '[object Object]') return 0;

  const hasDot = str.includes('.');
  const hasComma = str.includes(',');

  let finalNumber = 0;

  if (hasDot && hasComma) {
    // Both separators exist (e.g. 1.250.000,50 or 1,250,000.50 or 12.500,00 or 12,500.00)
    const lastDot = str.lastIndexOf('.');
    const lastComma = str.lastIndexOf(',');

    if (lastDot < lastComma) {
      // Last separator is comma -> Dot is thousands separator, Comma is decimal separator (e.g. 1.250.000,50)
      const normalized = str.replace(/\./g, '').replace(',', '.');
      finalNumber = parseFloat(normalized);
    } else {
      // Last separator is dot -> Comma is thousands separator, Dot is decimal separator (e.g. 1,250,000.50)
      const normalized = str.replace(/,/g, '');
      finalNumber = parseFloat(normalized);
    }
  } else if (hasDot && !hasComma) {
    // Only dot(s) exist (e.g. 1.250.000 or 12.500 or 12500.00 or 12.50 or 0.500)
    const parts = str.split('.');
    if (parts.length > 2) {
      // Multiple dots -> All are thousand separators (e.g. 1.250.000)
      finalNumber = parseFloat(str.replace(/\./g, ''));
    } else {
      // Single dot: e.g. "12.500" vs "12500.00" vs "12.50" vs "0.500"
      const [left, right] = parts;
      if (right.length === 3 && left !== '0') {
        // In COP accounting notation, 3 digits after dot (e.g. 12.500, 1.500) represents thousands!
        finalNumber = parseFloat(left + right);
      } else {
        // Standard decimal (e.g. 12500.00, 12.50, 0.500)
        finalNumber = parseFloat(str);
      }
    }
  } else if (!hasDot && hasComma) {
    // Only comma(s) exist (e.g. 1,250,000 or 12,500 or 12500,00 or 12,50 or 0,500)
    const parts = str.split(',');
    if (parts.length > 2) {
      // Multiple commas -> All are thousand separators (e.g. 1,250,000)
      finalNumber = parseFloat(str.replace(/,/g, ''));
    } else {
      // Single comma: e.g. "12,500" vs "12500,00" vs "12,50" vs "0,500"
      const [left, right] = parts;
      if (right.length === 3 && left !== '0') {
        // In COP accounting notation, 3 digits after comma (e.g. 12,500, 1,500) represents thousands!
        finalNumber = parseFloat(left + right);
      } else {
        // Standard decimal with comma (e.g. 12500,00, 12,50, 0,500)
        finalNumber = parseFloat(`${left}.${right}`);
      }
    }
  } else {
    // Plain digits (e.g. "12500")
    finalNumber = parseFloat(str);
  }

  if (isNaN(finalNumber) || !isFinite(finalNumber)) return 0;
  if (isNegative) finalNumber = -finalNumber;

  return roundToInteger ? Math.round(finalNumber) : finalNumber;
}

/**
 * Format a number to standard Colombian Peso format with $ symbol ($12.500)
 */
export function formatCOP(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) return '$0';
  return `$${Math.round(amount).toLocaleString('es-CO')}`;
}

/**
 * Format a number for text inputs with thousand dots (e.g. 12.500)
 */
export function formatInputPrice(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount) || amount === 0) return '';
  return Math.round(amount).toLocaleString('es-CO');
}

