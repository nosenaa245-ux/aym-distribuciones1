import ExcelJS from 'exceljs';
import { Product, Customer } from '../types';
import { parseFlexiblePrice } from './priceUtils';
import { normalizePhone } from '../lib/localDatabase';

export const EXCEL_COLUMNS = [
  { header: 'ID', key: 'id', width: 22 },
  { header: 'Nombre del Producto', key: 'name', width: 32 },
  { header: 'Categoría', key: 'category', width: 20 },
  { header: 'Código SKU', key: 'sku', width: 18 },
  { header: 'Código de Barras (EAN / Barcode)', key: 'barcode', width: 24 },
  { header: 'Precio de Costo ($ COP)', key: 'costPrice', width: 22 },
  { header: 'Precio de Venta ($ COP)', key: 'price', width: 22 },
  { header: 'Precio Original ($ COP)', key: 'originalPrice', width: 22 },
  { header: 'Presentación / Empaque', key: 'packaging', width: 22 },
  { header: 'Etiqueta Promocional', key: 'promoBadge', width: 24 },
  { header: 'Tipo de Etiqueta (discount / gift / combo / bonus)', key: 'badgeType', width: 26 },
  { header: 'Imagen / Clave Visual / URL', key: 'imageUrl', width: 26 },
  { header: 'Descripción', key: 'description', width: 36 },
  { header: 'Stock / Cantidad', key: 'stock', width: 16 },
  { header: 'Destacado (SI / NO)', key: 'featured', width: 16 },
];

/**
 * Exports products array to a styled Excel .xlsx file and triggers download
 */
export async function exportProductsToExcel(products: Product[], filename?: string): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'AYM Distribuciones';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Catálogo de Productos', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  worksheet.columns = EXCEL_COLUMNS;

  // Header row styling
  const headerRow = worksheet.getRow(1);
  headerRow.height = 28;
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Segoe UI' };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0B4EA2' }, // Corporate brand blue
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

  // Populate data rows
  products.forEach((product) => {
    const row = worksheet.addRow({
      id: product.id,
      name: product.name,
      category: product.category,
      sku: product.sku || '',
      barcode: product.barcode || '',
      costPrice: product.costPrice ?? '',
      price: product.price,
      originalPrice: product.originalPrice ?? '',
      packaging: product.packaging || 'Unidad',
      promoBadge: product.promoBadge || '',
      badgeType: product.badgeType || 'discount',
      imageUrl: product.imageUrl || 'bilac',
      description: product.description || '',
      stock: product.stock ?? 100,
      featured: product.featured ? 'SI' : 'NO',
    });

    row.height = 22;
    row.alignment = { vertical: 'middle' };

    // Format cost price
    if (product.costPrice !== undefined) {
      const costCell = row.getCell('costPrice');
      costCell.numFmt = '$#,##0';
      costCell.alignment = { vertical: 'middle', horizontal: 'right' };
    }

    // Format sales price
    const priceCell = row.getCell('price');
    priceCell.numFmt = '$#,##0';
    priceCell.alignment = { vertical: 'middle', horizontal: 'right' };

    if (product.originalPrice) {
      const origPriceCell = row.getCell('originalPrice');
      origPriceCell.numFmt = '$#,##0';
      origPriceCell.alignment = { vertical: 'middle', horizontal: 'right' };
    }

    if (typeof product.stock === 'number') {
      const stockCell = row.getCell('stock');
      stockCell.numFmt = '#,##0';
      stockCell.alignment = { vertical: 'middle', horizontal: 'right' };
    }

    // Format Image cell with clickable hyperlink if it is a web URL
    const imgCell = row.getCell('imageUrl');
    if (product.imageUrl && (product.imageUrl.startsWith('http://') || product.imageUrl.startsWith('https://'))) {
      imgCell.value = {
        text: product.imageUrl,
        hyperlink: product.imageUrl,
        tooltip: `Clic para ver imagen de ${product.name}`,
      };
      imgCell.font = { color: { argb: 'FF0B4EA2' }, underline: true };
    }
  });

  // Borders for all cells
  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    });
  });

  const nameToUse = filename || `aym-catalogo-productos-${new Date().toISOString().slice(0, 10)}.xlsx`;
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nameToUse;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Generates and downloads a clean Excel template with sample rows and guidelines
 */
export async function downloadExcelTemplate(): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'AYM Distribuciones';

  // Sheet 1: Template
  const worksheet = workbook.addWorksheet('Plantilla Productos', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  worksheet.columns = EXCEL_COLUMNS;

  const headerRow = worksheet.getRow(1);
  headerRow.height = 28;
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0B4EA2' },
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

  // Sample Rows
  const sample1 = worksheet.addRow({
    id: 'prod-ejemplo-1',
    name: 'Café Tostao Selecto 40g',
    category: 'Café',
    costPrice: 2400,
    price: 3200,
    originalPrice: 4000,
    packaging: 'Plegadiza x 12',
    promoBadge: '20.00% de descuento',
    badgeType: 'discount',
    imageUrl: 'tostao-intenso',
    description: 'Café tostado y molido 100% colombiano de alta calidad.',
    sku: 'CAF-001',
    stock: 120,
    featured: 'SI',
  });
  sample1.height = 22;

  const sample2 = worksheet.addRow({
    id: '', // Empty ID will auto-generate on import
    name: 'Aceite Premier Girasol 1000ml',
    category: 'Abarrotes',
    costPrice: 6800,
    price: 8500,
    originalPrice: 9900,
    packaging: 'Botella x 1000ml',
    promoBadge: 'Super Precio',
    badgeType: 'gift',
    imageUrl: 'aceite-premier',
    description: 'Aceite 100% puro para cocina.',
    sku: 'ACE-002',
    stock: 50,
    featured: 'NO',
  });
  sample2.height = 22;

  // Sheet 2: Help & Guidelines
  const helpSheet = workbook.addWorksheet('Guía de Columnas');
  helpSheet.columns = [
    { header: 'Columna', key: 'col', width: 24 },
    { header: 'Obligatorio', key: 'req', width: 14 },
    { header: 'Descripción y Valores Permitidos', key: 'desc', width: 65 },
  ];

  const helpHeader = helpSheet.getRow(1);
  helpHeader.height = 26;
  helpHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  helpHeader.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E293B' },
  };

  const guides = [
    { col: 'ID', req: 'Opcional', desc: 'Identificador único. Si se deja vacío, el sistema creará uno nuevo automáticamente.' },
    { col: 'Nombre del Producto', req: 'OBLIGATORIO', desc: 'Nombre comercial del producto. Acepta mayúsculas y minúsculas.' },
    { col: 'Categoría', req: 'OBLIGATORIO', desc: 'Categoría (ej: Lácteos, Café, Bebidas, Abarrotes, Dulcería, Limpieza). Si no existe, se creará automáticamente.' },
    { col: 'Precio de Costo ($ COP)', req: 'Opcional', desc: 'Precio de compra (acepta números con o sin puntos y comas de miles/decimales, ej: 2.400 o 2400 o 2,400.00).' },
    { col: 'Precio de Venta ($ COP)', req: 'OBLIGATORIO', desc: 'Precio de venta (acepta separadores de punto o coma, ej: 3.200 o 3,200 o $3.200 COP).' },
    { col: 'Precio Original ($ COP)', req: 'Opcional', desc: 'Precio anterior para descuento tachado (acepta puntos y comas, ej: 4.000 o 4,000).' },
    { col: 'Presentación / Empaque', req: 'Recomendado', desc: 'Ej: Caja x 12, Plegadiza x 24, Botella 1000ml, Pack x 6.' },
    { col: 'Etiqueta Promocional', req: 'Opcional', desc: 'Texto del banner promocional (ej: "20.00% de descuento", "Lleva 3 Paga 2", "Paga 10 Lleva 12").' },
    { col: 'Tipo de Etiqueta', req: 'Opcional', desc: 'Valores en mayúsculas o minúsculas: discount (azul), gift (verde), combo (ámbar), bonus (morado).' },
    { col: 'Imagen / Clave / URL', req: 'Opcional', desc: 'URL directa de imagen (https://...) o clave visual (bilac, tostao-intenso, tostao-suave, speedmax, festival, aceite-premier, arroz-diana, atun-vancamps, jet, fab-detergente, cocacola, alqueria).' },
    { col: 'Descripción', req: 'Opcional', desc: 'Detalles descriptivos del producto para la vista ampliada.' },
    { col: 'SKU / Código', req: 'Opcional', desc: 'Código de referencia interno para búsqueda rápida.' },
    { col: 'Código de Barras (EAN / Barcode)', req: 'Opcional', desc: 'Código de barras de 8, 12 o 13 dígitos para lectura con pistola lectora o escáner.' },
    { col: 'Stock / Cantidad', req: 'Opcional', desc: 'Cantidad de unidades disponibles (acepta números con o sin separadores, ej: 100, 1.000 o 1,000).' },
    { col: 'Destacado', req: 'Opcional', desc: 'Acepta "SI", "NO", "si", "no", "yes", "true", "1".' },
  ];

  guides.forEach((g) => {
    helpSheet.addRow(g);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'plantilla-productos-aym.xlsx';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface ExcelImportResult {
  products: Product[];
  newCategories: string[];
  totalRows: number;
  validRows: number;
  errors: string[];
}

/**
 * Recursively extracts plain primitive (string, number, boolean) from any ExcelJS cell value
 * Handles richText arrays, formula objects, hyperlink objects, error objects, etc.
 * Guarantees that neither "[object Object]" nor raw object references are ever returned.
 */
export function extractCellValue(val: any): any {
  if (val === null || val === undefined) return '';

  if (typeof val === 'number' || typeof val === 'boolean') {
    return val;
  }

  if (typeof val === 'string') {
    const trimmed = val.trim();
    return trimmed === '[object Object]' || trimmed === 'object object' ? '' : trimmed;
  }

  if (val instanceof Date) {
    return isNaN(val.getTime()) ? '' : val.toISOString();
  }

  if (typeof val === 'object') {
    // 1. Rich Text: { richText: [{ text: 'Arroz' }, { text: ' Diana' }] }
    if (Array.isArray(val.richText)) {
      const combined = val.richText
        .map((item: any) => {
          if (!item) return '';
          if (typeof item === 'string') return item;
          if (typeof item === 'object') {
            if ('text' in item) return extractCellText(item.text);
            return '';
          }
          return String(item || '');
        })
        .join('')
        .trim();
      return combined;
    }

    // 2. Formula with computed result: { formula: 'A1*B1', result: 12500 }
    if ('result' in val) {
      if (val.result !== undefined && val.result !== null) {
        return extractCellValue(val.result);
      }
      return '';
    }

    // 3. Hyperlink: { text: 'Link Text', hyperlink: 'http://...' }
    if ('text' in val && val.text !== undefined && val.text !== null) {
      const res = extractCellValue(val.text);
      if (res) return res;
    }
    if ('hyperlink' in val && val.hyperlink) {
      return String(val.hyperlink).trim();
    }

    // 4. Excel error: { error: '#N/A' }
    if ('error' in val) {
      return '';
    }

    // 5. Nested value property
    if ('value' in val && val.value !== val) {
      return extractCellValue(val.value);
    }

    // 6. Array of items
    if (Array.isArray(val)) {
      return val.map(extractCellText).filter(Boolean).join(' ');
    }

    // 7. Check common properties in generic objects
    for (const key of ['formattedValue', 'text', 'result', 'value', 'label', 'name', 'title', 'val']) {
      if (key in val && val[key] !== undefined && val[key] !== null) {
        const candidate = extractCellValue(val[key]);
        if (candidate !== '' && candidate !== '[object Object]') return candidate;
      }
    }
  }

  const str = String(val).trim();
  return str === '[object Object]' || str === 'object object' ? '' : str;
}

/**
 * Extracts a clean string from any cell, guaranteed free of "[object Object]"
 */
export function extractCellText(val: any): string {
  const extracted = extractCellValue(val);
  if (extracted === null || extracted === undefined) return '';
  const str = String(extracted).trim();
  return str === '[object Object]' || str === 'object object' ? '' : str;
}

/**
 * Normalizes header string removing accents, special characters, whitespace and lowercasing
 */
function normalizeHeaderKey(raw: any): string {
  const text = extractCellText(raw);
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9]/g, ''); // remove non-alphanumeric
}

/**
 * Matches a category name case-insensitively and accent-insensitively against existing categories
 */
function matchCategoryCasing(rawCategory: string, existingList: string[]): string {
  const norm = rawCategory.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (!norm || norm === 'general' || norm === 'objectobject') return existingList[0] || 'General';

  for (const existing of existingList) {
    const existingNorm = existing.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (existingNorm === norm) {
      return existing; // Match exact existing category casing
    }
  }
  return rawCategory.trim();
}

/**
 * Parses an Excel .xlsx or .xls file from a File object
 * Fully case-insensitive (UPPERCASE, lowercase, Mixed), accent-insensitive,
 * and accepts commas and dots as thousands/decimal separators.
 */
export async function parseProductsFromExcel(
  file: File,
  existingCategories: string[]
): Promise<ExcelImportResult> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);

  // Find the first worksheet that actually has rows
  let worksheet = workbook.worksheets.find((ws) => ws && ws.rowCount > 0);
  if (!worksheet && workbook.worksheets.length > 0) {
    worksheet = workbook.worksheets[0];
  }
  if (!worksheet) {
    throw new Error('El archivo de Excel no contiene ninguna hoja de datos.');
  }

  // Header aliases definition (all normalized)
  const HEADER_ALIASES: Record<string, string[]> = {
    id: ['id', 'codigo', 'cod', 'identificador', 'clave', 'itemid', 'productid', 'idproducto', 'codigoproducto', 'refid'],
    name: ['nombre', 'nombredelproducto', 'producto', 'name', 'productname', 'titulo', 'title', 'item', 'articulo', 'articulonombre', 'descripcioncorta', 'denominacion', 'nom'],
    category: ['categoria', 'category', 'cat', 'departamento', 'seccion', 'grupo', 'linea', 'rubro', 'familia', 'clasificacion'],
    costPrice: ['costo', 'preciocosto', 'preciodecosto', 'costprice', 'cost', 'compra', 'preciocompra', 'preciodecompra', 'valorcosto', 'valorcompra', 'pcosto', 'pcompra', 'costounitario', 'preciodecompraunitario', 'valordecompra'],
    originalPrice: ['preciooriginal', 'precioanterior', 'precioregular', 'tachado', 'preciotachado', 'precioantes', 'antes', 'originalprice', 'oldprice', 'regularprice', 'preciopromoantes', 'valoranterior', 'preciotachadocop'],
    price: ['precio', 'precioventa', 'preciodeventa', 'venta', 'price', 'valor', 'valorventa', 'preciomayorista', 'pventa', 'pvp', 'sellingprice', 'preciofinal', 'unitprice', 'preciounitario', 'valortotalunitario', 'preciocop', 'valordeventa'],
    packaging: ['presentacion', 'empaque', 'unidad', 'present', 'pack', 'envase', 'formato', 'unidaddemedida', 'medida', 'embalaje', 'packaging', 'presentacionempaque', 'presentacionunidad', 'tipoempaque'],
    badgeType: ['tipoetiqueta', 'tipodeetiqueta', 'badgetype', 'tipopromo', 'tipopromocion', 'tipodescuento', 'coloretiqueta', 'badgecolor', 'tipobadge'],
    promoBadge: ['etiqueta', 'etiquetapromocional', 'promocion', 'promo', 'badge', 'descuento', 'textopromo', 'oferta', 'banner', 'etiquetadescuento', 'textopromocional', 'rotulo'],
    imageUrl: ['imagen', 'imagenclaveurl', 'url', 'image', 'foto', 'fotourl', 'linkimagen', 'fotoproducto', 'img', 'picture', 'link', 'imagenurl', 'urlimagen'],
    description: ['descripcion', 'detalle', 'detalles', 'description', 'info', 'caracteristicas', 'observaciones', 'nota', 'notas', 'especificaciones'],
    sku: ['sku', 'referencia', 'ref', 'codigointerno', 'itemcode', 'codigodereferencia', 'codigoarticulo'],
    barcode: ['codigodebarras', 'codigobarras', 'barcode', 'barras', 'ean', 'upc', 'ean13', 'ean8', 'gtin', 'codbarras', 'codigoean'],
    stock: ['stock', 'cantidad', 'existencias', 'existencia', 'inventario', 'unidades', 'stockdisponible', 'disponible', 'qty', 'stockactual', 'saldo', 'cant'],
    featured: ['destacado', 'featured', 'esdestacado', 'destacados', 'estrella', 'top', 'destacar', 'promovido'],
  };

  // Auto-detect header row (Scan up to first 10 rows to locate real header)
  let headerRowNumber = 1;
  let headerMap: Record<string, number> = {};
  let bestMatchCount = 0;

  const maxScanRows = Math.min(10, worksheet.rowCount || 10);
  for (let r = 1; r <= maxScanRows; r++) {
    const row = worksheet.getRow(r);
    const currentHeaderMap: Record<string, number> = {};
    let matchCount = 0;

    row.eachCell((cell, colNumber) => {
      const normalizedVal = normalizeHeaderKey(cell.value);
      if (!normalizedVal) return;

      for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
        if (currentHeaderMap[key]) continue; // Already mapped
        const isMatch = aliases.some((alias) => normalizedVal.includes(alias) || alias.includes(normalizedVal));
        if (isMatch) {
          currentHeaderMap[key] = colNumber;
          matchCount++;
          break;
        }
      }
    });

    if (matchCount > bestMatchCount && (currentHeaderMap['name'] || currentHeaderMap['price'] || matchCount >= 2)) {
      bestMatchCount = matchCount;
      headerMap = currentHeaderMap;
      headerRowNumber = r;
    }
  }

  // Fallback defaults if no header matched
  if (!headerMap['name'] && !headerMap['price']) {
    headerMap = {
      id: 1,
      name: 2,
      category: 3,
      costPrice: 4,
      price: 5,
      originalPrice: 6,
      packaging: 7,
      promoBadge: 8,
      badgeType: 9,
      imageUrl: 10,
      description: 11,
      sku: 12,
      barcode: 13,
      stock: 14,
      featured: 15,
    };
  }

  const parsedProducts: Product[] = [];
  const discoveredCategories = new Map<string, string>(); // normalizedKey -> canonicalName
  const errors: string[] = [];
  let totalRows = 0;

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRowNumber) return; // Skip header row and any preceding rows
    if (!row.hasValues) return;

    totalRows++;

    const getRawCellValue = (key: string): any => {
      const col = headerMap[key];
      if (!col) return '';
      const cell = row.getCell(col);
      return extractCellValue(cell.value);
    };

    const getCellString = (key: string): string => {
      const col = headerMap[key];
      if (!col) return '';
      const cell = row.getCell(col);
      return extractCellText(cell.value);
    };

    const rawName = getCellString('name');
    if (!rawName || rawName.toLowerCase() === '[object object]' || rawName.toLowerCase() === 'object object') {
      // Empty row or missing name, skip
      return;
    }

    // Flexible Price Parsing (Supports uppercase COP, dots, commas, e.g. "12.500", "12,500", "1.250.000,00", "$12.500")
    const rawPrice = getRawCellValue('price');
    const price = parseFlexiblePrice(rawPrice, true);

    if (price <= 0) {
      errors.push(`Fila ${rowNumber} ("${rawName}"): Precio de venta inválido o no especificado.`);
    }

    // Cost Price (optional)
    const rawCostPrice = getRawCellValue('costPrice');
    let costPrice: number | undefined = undefined;
    if (rawCostPrice !== undefined && rawCostPrice !== '') {
      const parsedCost = parseFlexiblePrice(rawCostPrice, true);
      if (parsedCost > 0) costPrice = parsedCost;
    }

    // Original / Regular Price (optional)
    const rawOrigPrice = getRawCellValue('originalPrice');
    let originalPrice: number | undefined = undefined;
    if (rawOrigPrice !== undefined && rawOrigPrice !== '') {
      const parsedOrig = parseFlexiblePrice(rawOrigPrice, true);
      if (parsedOrig > 0) originalPrice = parsedOrig;
    }

    // Category with case-insensitive & accent-insensitive matching
    const rawCat = getCellString('category');
    const finalCategory = matchCategoryCasing(rawCat, existingCategories);
    const catNormKey = finalCategory.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (!discoveredCategories.has(catNormKey)) {
      discoveredCategories.set(catNormKey, finalCategory);
    }

    // ID
    const rawId = getCellString('id');
    const id = rawId || `prod-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    // Packaging / Presentation
    const packaging = getCellString('packaging') || 'Unidad';

    // Promo Badge
    const promoBadge = getCellString('promoBadge') || (originalPrice && originalPrice > price ? `${Math.round(((originalPrice - price) / originalPrice) * 100)}% de descuento` : '');
    
    // Badge Type (Case & Accent Insensitive)
    let badgeType: 'discount' | 'gift' | 'combo' | 'bonus' = 'discount';
    const rawBadgeType = normalizeHeaderKey(getRawCellValue('badgeType'));
    if (rawBadgeType.includes('gift') || rawBadgeType.includes('regalo') || rawBadgeType.includes('verde') || rawBadgeType.includes('green') || rawBadgeType.includes('obsequio')) {
      badgeType = 'gift';
    } else if (rawBadgeType.includes('combo') || rawBadgeType.includes('ambar') || rawBadgeType.includes('naranja') || rawBadgeType.includes('orange') || rawBadgeType.includes('pack')) {
      badgeType = 'combo';
    } else if (rawBadgeType.includes('bonus') || rawBadgeType.includes('morado') || rawBadgeType.includes('purple') || rawBadgeType.includes('plus') || rawBadgeType.includes('extra')) {
      badgeType = 'bonus';
    }

    // Image, Description, SKU, Barcode
    // Note: Do NOT force default 'bilac' here if the cell is blank.
    // Keeping rawImageUrl allows "Fusionar y Actualizar" to preserve existing product images.
    const rawImageUrl = getCellString('imageUrl').trim();
    const imageUrl = rawImageUrl;
    const description = getCellString('description');
    const sku = getCellString('sku');
    const barcode = getCellString('barcode');

    // Stock / Quantity (Supports "1.000", "1,000", "500,00", "100", 50, etc.)
    const rawStock = getRawCellValue('stock');
    let stock = 100;
    if (rawStock !== '' && rawStock !== undefined && rawStock !== null) {
      const parsedStock = parseFlexiblePrice(rawStock, true);
      stock = isNaN(parsedStock) ? 0 : parsedStock;
    }

    // Featured (Case & Accent Insensitive: SI, SÍ, YES, TRUE, 1, VERDADERO, etc.)
    const normFeatured = normalizeHeaderKey(getRawCellValue('featured'));
    const featured = ['si', 'yes', 'true', 'verdadero', '1', 'x', 's', 'y', 'destacado', 'ok'].includes(normFeatured);

    parsedProducts.push({
      id,
      name: rawName,
      category: finalCategory,
      costPrice,
      price,
      originalPrice,
      packaging,
      promoBadge,
      badgeType,
      imageUrl,
      description,
      sku: sku || undefined,
      barcode: barcode || undefined,
      stock,
      featured,
    });
  });

  const existingCatLower = new Set(
    existingCategories.map((c) => c.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
  );
  
  const newCategories = Array.from(discoveredCategories.values()).filter(
    (c) => !existingCatLower.has(c.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
  );

  return {
    products: parsedProducts,
    newCategories,
    totalRows,
    validRows: parsedProducts.length,
    errors,
  };
}

export interface UnsoldReportExportParams {
  monthLabel: string;
  selectedYear: number;
  selectedMonth: number;
  unsoldProducts: Array<{
    product: Product;
    stock: number;
    costPrice: number;
    price: number;
    immobilizedCost: number;
    immobilizedRetail: number;
    historicalLastSale?: { date: Date; orderNumber: string };
    daysSinceLastSale: number | null;
  }>;
  lowRotationProducts?: Array<{
    product: Product;
    stock: number;
    unitsSold: number;
    revenue: number;
    costPrice: number;
    price: number;
    immobilizedCost: number;
  }>;
  soldProducts: Array<{
    product: Product;
    stock: number;
    unitsSold: number;
    revenue: number;
    costPrice: number;
    price: number;
    ordersCount: number;
  }>;
  categoryStats: Array<{
    category: string;
    totalProducts: number;
    unsoldCount: number;
    soldCount: number;
    unsoldCapitalCost: number;
    unitsSold: number;
    revenue: number;
  }>;
  kpis: {
    totalCatalog: number;
    unsoldCount: number;
    soldCount: number;
    rotationRate: number;
    totalImmobilizedCost: number;
    totalImmobilizedRetail: number;
    totalUnsoldStockUnits: number;
    totalMonthRevenue: number;
    totalOrdersCount: number;
  };
}

/**
 * Exports a comprehensive monthly report of unsold products, rotation analysis, and KPIs
 */
export async function exportUnsoldProductsReportToExcel(params: UnsoldReportExportParams): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'AYM Distribuciones Mayoristas';
  workbook.created = new Date();

  // -------------------------------------------------------------
  // SHEET 1: PRODUCTOS SIN VENTAS
  // -------------------------------------------------------------
  const wsUnsold = workbook.addWorksheet('Productos Sin Ventas', {
    views: [{ state: 'frozen', ySplit: 2 }],
  });

  // Title header banner
  wsUnsold.mergeCells('A1:I1');
  const titleCell = wsUnsold.getCell('A1');
  titleCell.value = `REPORTE MENSUAL DE PRODUCTOS SIN VENTAS — ${params.monthLabel.toUpperCase()}`;
  titleCell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 13, name: 'Segoe UI' };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE11D48' }, // Rose-600 alert color
  };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  wsUnsold.getRow(1).height = 32;

  // Table columns
  wsUnsold.columns = [
    { key: 'name', width: 34 },
    { key: 'category', width: 20 },
    { key: 'sku', width: 16 },
    { key: 'barcode', width: 20 },
    { key: 'stock', width: 14 },
    { key: 'costPrice', width: 20 },
    { key: 'price', width: 20 },
    { key: 'immobilizedCost', width: 24 },
    { key: 'lastSale', width: 26 },
  ];

  // Column headers in Row 2
  const colHeaderRow = wsUnsold.getRow(2);
  colHeaderRow.values = [
    'Producto / Referencia',
    'Categoría',
    'Código SKU',
    'Código de Barras (EAN)',
    'Stock en Bodega',
    'Costo Unitario ($ COP)',
    'Precio Venta ($ COP)',
    'Capital Inmovilizado ($ COP)',
    'Última Venta Registrada',
  ];
  colHeaderRow.height = 26;
  colHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10, name: 'Segoe UI' };
  colHeaderRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E293B' }, // Slate-800
  };
  colHeaderRow.alignment = { vertical: 'middle', horizontal: 'center' };

  // Add data rows
  params.unsoldProducts.forEach((item) => {
    const lastSaleText = item.historicalLastSale
      ? `${item.historicalLastSale.date.toISOString().slice(0, 10)} (hace ${item.daysSinceLastSale} d)`
      : 'Sin ventas históricas';

    const row = wsUnsold.addRow({
      name: item.product.name,
      category: item.product.category,
      sku: item.product.sku || '',
      barcode: item.product.barcode || '',
      stock: item.stock,
      costPrice: item.costPrice,
      price: item.price,
      immobilizedCost: item.immobilizedCost,
      lastSale: lastSaleText,
    });

    row.height = 22;
    row.alignment = { vertical: 'middle' };

    // Format currency
    const costCell = row.getCell('costPrice');
    costCell.numFmt = '$#,##0';
    costCell.alignment = { vertical: 'middle', horizontal: 'right' };

    const priceCell = row.getCell('price');
    priceCell.numFmt = '$#,##0';
    priceCell.alignment = { vertical: 'middle', horizontal: 'right' };

    const immobCell = row.getCell('immobilizedCost');
    immobCell.numFmt = '$#,##0';
    immobCell.font = { bold: true, color: { argb: 'FFE11D48' } };
    immobCell.alignment = { vertical: 'middle', horizontal: 'right' };

    const stockCell = row.getCell('stock');
    stockCell.numFmt = '#,##0';
    stockCell.alignment = { vertical: 'middle', horizontal: 'right' };
  });

  // Total Summary Row
  const totalRow = wsUnsold.addRow({
    name: `TOTALES (${params.unsoldProducts.length} PRODUCTOS SIN VENTA)`,
    category: '',
    sku: '',
    barcode: '',
    stock: params.kpis.totalUnsoldStockUnits,
    costPrice: '',
    price: '',
    immobilizedCost: params.kpis.totalImmobilizedCost,
    lastSale: '',
  });
  totalRow.height = 26;
  totalRow.font = { bold: true, size: 11, color: { argb: 'FF0F172A' } };
  totalRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFEE2E2' }, // Soft red
  };
  totalRow.getCell('stock').numFmt = '#,##0';
  totalRow.getCell('stock').alignment = { vertical: 'middle', horizontal: 'right' };
  totalRow.getCell('immobilizedCost').numFmt = '$#,##0';
  totalRow.getCell('immobilizedCost').alignment = { vertical: 'middle', horizontal: 'right' };

  // Borders
  wsUnsold.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    });
  });

  // -------------------------------------------------------------
  // SHEET 2: RESUMEN EJECUTIVO Y POR CATEGORÍA
  // -------------------------------------------------------------
  const wsSummary = workbook.addWorksheet('Resumen y Categorías', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  wsSummary.columns = [
    { key: 'col1', width: 30 },
    { key: 'col2', width: 18 },
    { key: 'col3', width: 18 },
    { key: 'col4', width: 18 },
    { key: 'col5', width: 22 },
    { key: 'col6', width: 22 },
  ];

  // Header
  const summaryHeader = wsSummary.getRow(1);
  summaryHeader.values = ['Categoría', 'Total Catálogo', 'Sin Venta', 'Con Venta', 'Capital Inmovilizado ($)', 'Ingresos Generados ($)'];
  summaryHeader.height = 28;
  summaryHeader.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
  summaryHeader.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0B4EA2' }, // Corporate blue
  };
  summaryHeader.alignment = { vertical: 'middle', horizontal: 'center' };

  params.categoryStats.forEach((cat) => {
    const r = wsSummary.addRow({
      col1: cat.category,
      col2: cat.totalProducts,
      col3: cat.unsoldCount,
      col4: cat.soldCount,
      col5: cat.unsoldCapitalCost,
      col6: cat.revenue,
    });
    r.height = 22;
    r.alignment = { vertical: 'middle' };
    r.getCell('col2').alignment = { vertical: 'middle', horizontal: 'center' };
    r.getCell('col3').alignment = { vertical: 'middle', horizontal: 'center' };
    r.getCell('col4').alignment = { vertical: 'middle', horizontal: 'center' };
    r.getCell('col5').numFmt = '$#,##0';
    r.getCell('col5').alignment = { vertical: 'middle', horizontal: 'right' };
    r.getCell('col6').numFmt = '$#,##0';
    r.getCell('col6').alignment = { vertical: 'middle', horizontal: 'right' };
  });

  // KPI Summary box below
  wsSummary.addRow({});
  const kpiTitleRow = wsSummary.addRow(['INDICADORES CLAVE DEL MES']);
  kpiTitleRow.font = { bold: true, size: 12, color: { argb: 'FF0B4EA2' } };

  wsSummary.addRow(['Período Analizado:', params.monthLabel]);
  wsSummary.addRow(['Total Productos en Catálogo:', params.kpis.totalCatalog]);
  wsSummary.addRow(['Productos Sin Ventas:', `${params.kpis.unsoldCount} (${Math.round((params.kpis.unsoldCount / (params.kpis.totalCatalog || 1)) * 100)}%)`]);
  wsSummary.addRow(['Productos Con Ventas:', `${params.kpis.soldCount} (${params.kpis.rotationRate}%)`]);
  wsSummary.addRow(['Capital Inmovilizado al Costo:', params.kpis.totalImmobilizedCost]);
  wsSummary.getCell(`B${wsSummary.rowCount}`).numFmt = '$#,##0';
  wsSummary.addRow(['Total Pedidos Registrados:', params.kpis.totalOrdersCount]);
  wsSummary.addRow(['Ingresos Totales por Ventas:', params.kpis.totalMonthRevenue]);
  wsSummary.getCell(`B${wsSummary.rowCount}`).numFmt = '$#,##0';

  // -------------------------------------------------------------
  // SHEET 3: PRODUCTOS VENDIDOS
  // -------------------------------------------------------------
  const wsSold = workbook.addWorksheet('Productos Vendidos', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  wsSold.columns = [
    { key: 'name', width: 34 },
    { key: 'category', width: 20 },
    { key: 'sku', width: 16 },
    { key: 'unitsSold', width: 16 },
    { key: 'ordersCount', width: 16 },
    { key: 'revenue', width: 22 },
    { key: 'stock', width: 16 },
  ];

  const soldHeader = wsSold.getRow(1);
  soldHeader.values = ['Producto', 'Categoría', 'Código SKU', 'Unid. Vendidas', 'No. Pedidos', 'Ingresos Generados ($)', 'Stock Actual'];
  soldHeader.height = 28;
  soldHeader.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
  soldHeader.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF059669' }, // Emerald-600
  };
  soldHeader.alignment = { vertical: 'middle', horizontal: 'center' };

  params.soldProducts
    .sort((a, b) => b.unitsSold - a.unitsSold)
    .forEach((item) => {
      const r = wsSold.addRow({
        name: item.product.name,
        category: item.product.category,
        sku: item.product.sku || '',
        unitsSold: item.unitsSold,
        ordersCount: item.ordersCount,
        revenue: item.revenue,
        stock: item.stock,
      });
      r.height = 22;
      r.alignment = { vertical: 'middle' };
      r.getCell('unitsSold').numFmt = '#,##0';
      r.getCell('unitsSold').alignment = { vertical: 'middle', horizontal: 'right' };
      r.getCell('ordersCount').alignment = { vertical: 'middle', horizontal: 'center' };
      r.getCell('revenue').numFmt = '$#,##0';
      r.getCell('revenue').alignment = { vertical: 'middle', horizontal: 'right' };
      r.getCell('stock').numFmt = '#,##0';
      r.getCell('stock').alignment = { vertical: 'middle', horizontal: 'right' };
    });

  // Export and download
  const filename = `aym-reporte-productos-sin-venta-${params.monthLabel.toLowerCase().replace(/\s+/g, '-')}.xlsx`;
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============================================================================
// CUSTOMERS (CLIENTES) - EXCEL EXPORT, TEMPLATE & IMPORT
// ============================================================================

export const EXCEL_CUSTOMER_COLUMNS = [
  { header: 'ID Cliente', key: 'id', width: 22 },
  { header: 'Número WhatsApp / Celular', key: 'phone', width: 26 },
  { header: 'Nombre Tienda / Negocio', key: 'storeName', width: 34 },
  { header: 'Contacto / Dueño', key: 'ownerName', width: 28 },
  { header: 'Dirección de Entrega', key: 'address', width: 36 },
  { header: 'Ciudad / Municipio', key: 'city', width: 22 },
  { header: 'Método de Pago (contraentrega / transferencia / credito)', key: 'paymentMethod', width: 32 },
  { header: 'Descuento Especial (%)', key: 'discountPercentage', width: 22 },
  { header: 'Cupo Límite de Crédito ($ COP)', key: 'creditLimit', width: 28 },
  { header: 'Estado (active / inactive)', key: 'status', width: 20 },
  { header: 'Total Pedidos', key: 'ordersCount', width: 18 },
  { header: 'Total Comprado ($ COP)', key: 'totalSpent', width: 24 },
  { header: 'Notas / Observaciones', key: 'notes', width: 36 },
];

/**
 * Exports customers list to a styled Excel .xlsx file
 */
export async function exportCustomersToExcel(customers: Customer[], filename?: string): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'AYM Distribuciones';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Directorio de Clientes', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  worksheet.columns = EXCEL_CUSTOMER_COLUMNS;

  // Header row styling
  const headerRow = worksheet.getRow(1);
  headerRow.height = 28;
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10.5, name: 'Segoe UI' };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0F766E' }, // Corporate teal/emerald
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

  // Data rows
  customers.forEach((c) => {
    const row = worksheet.addRow({
      id: c.id || `cli-${c.phone}`,
      phone: c.phone,
      storeName: c.storeName,
      ownerName: c.ownerName || c.storeName,
      address: c.address || '',
      city: c.city || 'Bucaramanga',
      paymentMethod: c.paymentMethod || 'contraentrega',
      discountPercentage: c.discountPercentage ? Number(c.discountPercentage) : '',
      creditLimit: c.creditLimit ? Number(c.creditLimit) : '',
      status: c.status || 'active',
      ordersCount: c.ordersCount || 0,
      totalSpent: c.totalSpent || 0,
      notes: c.notes || '',
    });

    row.height = 22;
    row.alignment = { vertical: 'middle' };

    // Format phone as text with left alignment
    const phoneCell = row.getCell('phone');
    phoneCell.alignment = { vertical: 'middle', horizontal: 'left' };

    // Format discount
    if (c.discountPercentage) {
      const discCell = row.getCell('discountPercentage');
      discCell.numFmt = '0.0"%"';
      discCell.alignment = { vertical: 'middle', horizontal: 'right' };
    }

    // Format credit limit
    if (c.creditLimit) {
      const creditCell = row.getCell('creditLimit');
      creditCell.numFmt = '$#,##0';
      creditCell.alignment = { vertical: 'middle', horizontal: 'right' };
    }

    // Format orders count
    const ordersCell = row.getCell('ordersCount');
    ordersCell.numFmt = '#,##0';
    ordersCell.alignment = { vertical: 'middle', horizontal: 'center' };

    // Format total spent
    const spentCell = row.getCell('totalSpent');
    spentCell.numFmt = '$#,##0';
    spentCell.alignment = { vertical: 'middle', horizontal: 'right' };
  });

  // Borders for all cells
  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    });
  });

  const totalSpentSum = customers.reduce((acc, c) => acc + (c.totalSpent || 0), 0);
  const totalOrdersSum = customers.reduce((acc, c) => acc + (c.ordersCount || 0), 0);

  // Summary Row at the bottom
  const summaryRow = worksheet.addRow({
    id: `TOTALES (${customers.length} CLIENTES)`,
    phone: '',
    storeName: '',
    ownerName: '',
    address: '',
    city: '',
    paymentMethod: '',
    discountPercentage: '',
    creditLimit: '',
    status: '',
    ordersCount: totalOrdersSum,
    totalSpent: totalSpentSum,
    notes: '',
  });

  summaryRow.height = 26;
  summaryRow.font = { bold: true, size: 11, color: { argb: 'FF0F172A' } };
  summaryRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF0FDF4' }, // Light emerald
  };
  summaryRow.getCell('ordersCount').numFmt = '#,##0';
  summaryRow.getCell('ordersCount').alignment = { vertical: 'middle', horizontal: 'center' };
  summaryRow.getCell('totalSpent').numFmt = '$#,##0';
  summaryRow.getCell('totalSpent').alignment = { vertical: 'middle', horizontal: 'right' };

  const nameToUse = filename || `aym-directorio-clientes-${new Date().toISOString().slice(0, 10)}.xlsx`;
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nameToUse;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Downloads a clean Excel template with sample rows and guidelines for Customers
 */
export async function downloadCustomerExcelTemplate(): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'AYM Distribuciones';

  // Sheet 1: Template
  const worksheet = workbook.addWorksheet('Plantilla Clientes', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  worksheet.columns = EXCEL_CUSTOMER_COLUMNS;

  const headerRow = worksheet.getRow(1);
  headerRow.height = 28;
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10.5 };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0F766E' }, // Corporate teal
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

  // Sample Rows
  const sample1 = worksheet.addRow({
    id: 'cli-3113986110',
    phone: '3113986110',
    storeName: 'Tienda La Bendición',
    ownerName: 'Carlos Gómez',
    address: 'Calle 45 # 23-10 Barrio Centro',
    city: 'Bucaramanga',
    paymentMethod: 'contraentrega',
    discountPercentage: 5,
    creditLimit: 500000,
    status: 'active',
    ordersCount: 0,
    totalSpent: 0,
    notes: 'Entregar en las mañanas de 8am a 12pm.',
  });
  sample1.height = 22;

  const sample2 = worksheet.addRow({
    id: '', // Auto-generated
    phone: '3157890123',
    storeName: 'Minimarket Express El Ahorro',
    ownerName: 'María Rodríguez',
    address: 'Carrera 33 # 52-40 Barrio Cabecera',
    city: 'Bucaramanga',
    paymentMethod: 'transferencia',
    discountPercentage: 0,
    creditLimit: 1200000,
    status: 'active',
    ordersCount: 0,
    totalSpent: 0,
    notes: 'Paga por transferencia Bancolombia / Nequi.',
  });
  sample2.height = 22;

  const sample3 = worksheet.addRow({
    id: '',
    phone: '3184567890',
    storeName: 'Supermercado San José',
    ownerName: 'José Pérez',
    address: 'Av. Circunvalar # 12-05',
    city: 'Floridablanca',
    paymentMethod: 'credito',
    discountPercentage: 7.5,
    creditLimit: 3000000,
    status: 'active',
    ordersCount: 0,
    totalSpent: 0,
    notes: 'Cliente mayorista con crédito a 15 días.',
  });
  sample3.height = 22;

  // Sheet 2: Guidelines
  const wsGuide = workbook.addWorksheet('Guía de Columnas');
  wsGuide.columns = [
    { header: 'Columna', key: 'col', width: 32 },
    { header: 'Obligatorio / Opcional', key: 'req', width: 22 },
    { header: 'Descripción y Valores Permitidos', key: 'desc', width: 65 },
  ];

  const guideHeader = wsGuide.getRow(1);
  guideHeader.height = 26;
  guideHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  guideHeader.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E293B' },
  };
  guideHeader.alignment = { vertical: 'middle', horizontal: 'center' };

  const guides = [
    { col: 'ID Cliente', req: 'Opcional', desc: 'Identificador único. Si se deja vacío, se generará como cli-<WhatsApp>.' },
    { col: 'Número WhatsApp / Celular', req: 'OBLIGATORIO', desc: 'Número celular o WhatsApp de 10 dígitos (ej: 3113986110 o +57 311 3986110).' },
    { col: 'Nombre Tienda / Negocio', req: 'OBLIGATORIO', desc: 'Razón social o nombre comercial de la tienda/negocio.' },
    { col: 'Contacto / Dueño', req: 'Recomendado', desc: 'Nombre de la persona de contacto o propietario del negocio.' },
    { col: 'Dirección de Entrega', req: 'Recomendado', desc: 'Dirección física y barrio de entrega del pedido.' },
    { col: 'Ciudad / Municipio', req: 'Opcional', desc: 'Ciudad de ubicación (ej: Bucaramanga, Floridablanca, Girón, Piedecuesta).' },
    { col: 'Método de Pago', req: 'Opcional', desc: 'Valores aceptados: contraentrega, transferencia, credito (o crédito).' },
    { col: 'Descuento Especial (%)', req: 'Opcional', desc: 'Porcentaje de descuento para este cliente (ej: 5, 7.5, 10).' },
    { col: 'Cupo Límite de Crédito ($ COP)', req: 'Opcional', desc: 'Monto máximo de crédito disponible en pesos (ej: 500000, 1.000.000).' },
    { col: 'Estado', req: 'Opcional', desc: 'Valores: active (activo) o inactive (inactivo).' },
    { col: 'Total Pedidos', req: 'Opcional', desc: 'Historial de número de pedidos realizados (número entero).' },
    { col: 'Total Comprado ($ COP)', req: 'Opcional', desc: 'Historial de compras acumuladas en pesos (ej: 1250000).' },
    { col: 'Notas / Observaciones', req: 'Opcional', desc: 'Instrucciones de entrega, horarios de atención, etc.' },
  ];

  guides.forEach((g) => {
    const r = wsGuide.addRow(g);
    r.height = 20;
    r.alignment = { vertical: 'middle' };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'plantilla-clientes-aym.xlsx';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface ParsedCustomersResult {
  customers: Customer[];
  totalRows: number;
  validRows: number;
  cities: string[];
  errors: string[];
}

/**
 * Parses a Customer Excel .xlsx or .xls file
 * Case-insensitive, accent-insensitive, and safely unwraps RichText / formula objects.
 */
export async function parseCustomersFromExcel(file: File): Promise<ParsedCustomersResult> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);

  let worksheet = workbook.worksheets.find((ws) => ws && ws.rowCount > 0);
  if (!worksheet && workbook.worksheets.length > 0) {
    worksheet = workbook.worksheets[0];
  }
  if (!worksheet) {
    throw new Error('El archivo de Excel no contiene ninguna hoja de datos.');
  }

  const HEADER_ALIASES: Record<string, string[]> = {
    id: ['id', 'idcliente', 'codigo', 'cod', 'nit', 'rut', 'cedula', 'documento', 'identificador'],
    phone: ['whatsapp', 'telefono', 'tel', 'celular', 'movil', 'phone', 'contacto', 'cel', 'numero', 'numerotelefono', 'wa', 'wpp', 'numerowhatsapp', 'telefonocontacto'],
    storeName: ['nombretienda', 'tienda', 'negocio', 'nombrenegocio', 'establecimiento', 'razonsocial', 'empresa', 'cliente', 'nombrecliente', 'store', 'storename', 'nombrecomercial'],
    ownerName: ['contacto', 'dueno', 'propietario', 'nombredueño', 'nombrecontacto', 'representante', 'titular', 'responsable', 'owner', 'ownername', 'nombre', 'propietarioresponsable'],
    address: ['direccion', 'direcciondeentrega', 'dir', 'domicilio', 'ubicacion', 'address', 'direccioncompleta', 'barrio', 'direcc'],
    city: ['ciudad', 'municipio', 'poblacion', 'departamento', 'city', 'localidad', 'zona', 'ciudadmunicipio'],
    paymentMethod: ['metodopago', 'formapago', 'metododepago', 'formadepago', 'medio', 'pago', 'paymentmethod', 'condicionpago', 'tipopago'],
    discountPercentage: ['descuento', 'porcentajedescuento', 'desc', 'descuentoporcentaje', 'descuentocliente', 'discount', 'descuentoespecial'],
    creditLimit: ['cupocredito', 'limitecredito', 'credito', 'cupo', 'creditlimit', 'limite', 'cupomaximo', 'cupolimitedecredito', 'valorcredito'],
    status: ['estado', 'status', 'activo', 'state', 'situacion', 'condicion', 'estadocliente'],
    notes: ['notas', 'observaciones', 'nota', 'comentarios', 'comentario', 'notes', 'detalles', 'notasobservaciones', 'info'],
    ordersCount: ['totalpedidos', 'pedidos', 'compras', 'numeropedidos', 'orderscount', 'cantpedidos'],
    totalSpent: ['totalcomprado', 'totalventas', 'totalconsumo', 'valorcompras', 'totalspent', 'compratotal', 'gastototal'],
  };

  // Header detection
  let headerRowNumber = 1;
  let headerMap: Record<string, number> = {};
  let bestMatchCount = 0;

  const maxScanRows = Math.min(10, worksheet.rowCount || 10);
  for (let r = 1; r <= maxScanRows; r++) {
    const row = worksheet.getRow(r);
    const currentHeaderMap: Record<string, number> = {};
    let matchCount = 0;

    row.eachCell((cell, colNumber) => {
      const normalizedVal = normalizeHeaderKey(cell.value);
      if (!normalizedVal) return;

      for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
        if (currentHeaderMap[key]) continue;
        const isMatch = aliases.some((alias) => normalizedVal.includes(alias) || alias.includes(normalizedVal));
        if (isMatch) {
          currentHeaderMap[key] = colNumber;
          matchCount++;
          break;
        }
      }
    });

    if (matchCount > bestMatchCount && (currentHeaderMap['storeName'] || currentHeaderMap['phone'] || matchCount >= 2)) {
      bestMatchCount = matchCount;
      headerMap = currentHeaderMap;
      headerRowNumber = r;
    }
  }

  // Fallback defaults
  if (!headerMap['storeName'] && !headerMap['phone']) {
    headerMap = {
      id: 1,
      phone: 2,
      storeName: 3,
      ownerName: 4,
      address: 5,
      city: 6,
      paymentMethod: 7,
      discountPercentage: 8,
      creditLimit: 9,
      status: 10,
      ordersCount: 11,
      totalSpent: 12,
      notes: 13,
    };
  }

  const parsedCustomers: Customer[] = [];
  const discoveredCities = new Set<string>();
  const errors: string[] = [];
  let totalRows = 0;

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRowNumber) return;
    if (!row.hasValues) return;

    totalRows++;

    const getRawCellValue = (key: string): any => {
      const col = headerMap[key];
      if (!col) return '';
      const cell = row.getCell(col);
      return extractCellValue(cell.value);
    };

    const getCellString = (key: string): string => {
      const col = headerMap[key];
      if (!col) return '';
      const cell = row.getCell(col);
      return extractCellText(cell.value);
    };

    const rawStoreName = getCellString('storeName');
    const rawOwnerName = getCellString('ownerName');
    const rawPhone = getCellString('phone');

    if (!rawStoreName && !rawPhone) {
      // Empty row, skip
      return;
    }

    const storeName = rawStoreName || rawOwnerName || 'Cliente Sin Nombre';
    const ownerName = rawOwnerName || rawStoreName || 'Dueño / Contacto';

    // Normalize phone number
    const normalizedPhoneNumber = normalizePhone(rawPhone);
    if (!normalizedPhoneNumber || normalizedPhoneNumber.length < 7) {
      errors.push(`Fila ${rowNumber} ("${storeName}"): Número de WhatsApp/teléfono inválido ("${rawPhone}").`);
      return;
    }

    const address = getCellString('address') || 'Dirección por confirmar';
    const city = getCellString('city') || 'Bucaramanga';
    discoveredCities.add(city);

    // Payment method normalization
    const rawPayMethod = normalizeHeaderKey(getRawCellValue('paymentMethod'));
    let paymentMethod: 'contraentrega' | 'transferencia' | 'credito' = 'contraentrega';
    if (rawPayMethod.includes('transf') || rawPayMethod.includes('banco') || rawPayMethod.includes('nequi') || rawPayMethod.includes('davi')) {
      paymentMethod = 'transferencia';
    } else if (rawPayMethod.includes('cred') || rawPayMethod.includes('plazo') || rawPayMethod.includes('dias')) {
      paymentMethod = 'credito';
    }

    // Status normalization
    const rawStatus = normalizeHeaderKey(getRawCellValue('status'));
    let status: 'active' | 'inactive' = 'active';
    if (rawStatus.includes('inact') || rawStatus.includes('bloq') || rawStatus.includes('desact') || rawStatus === 'no' || rawStatus === 'false' || rawStatus === '0') {
      status = 'inactive';
    }

    // Financial numbers
    const discountPercentage = parseFlexiblePrice(getRawCellValue('discountPercentage'), false) || 0;
    const creditLimit = parseFlexiblePrice(getRawCellValue('creditLimit'), true) || 0;
    const ordersCount = parseFlexiblePrice(getRawCellValue('ordersCount'), true) || 0;
    const totalSpent = parseFlexiblePrice(getRawCellValue('totalSpent'), true) || 0;

    const notes = getCellString('notes');
    const rawId = getCellString('id');
    const id = rawId || `cli-${normalizedPhoneNumber}`;

    parsedCustomers.push({
      id,
      phone: normalizedPhoneNumber,
      storeName,
      ownerName,
      address,
      city,
      paymentMethod,
      discountPercentage: discountPercentage > 0 ? discountPercentage : undefined,
      creditLimit: creditLimit > 0 ? creditLimit : undefined,
      status,
      ordersCount,
      totalSpent,
      notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });

  return {
    customers: parsedCustomers,
    totalRows,
    validRows: parsedCustomers.length,
    cities: Array.from(discoveredCities),
    errors,
  };
}
