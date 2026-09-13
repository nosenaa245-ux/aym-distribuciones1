import JSZip from 'jszip';
import { Product } from '../types';

export interface ImageExportProgress {
  processed: number;
  total: number;
  percent: number;
  currentProduct?: string;
  message: string;
}

export interface ImageExportResult {
  total: number;
  exportedImagesCount: number;
  remoteUrlsCount: number;
  dataUrlsCount: number;
  presetsCount: number;
  corsErrorsCount: number;
  zipName: string;
}

/**
 * Sanitizes a filename string removing invalid characters
 */
function sanitizeFilename(str: string): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/__+/g, '_')
    .trim()
    .slice(0, 45);
}

/**
 * Generates an SVG representation for preset product types
 */
function generatePresetSvg(type: string, name: string): string {
  const safeName = (name || 'Producto').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  
  let bgGradient = '<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#0B4EA2"/><stop offset="100%" stop-color="#072F61"/></linearGradient>';
  let brandColor = '#FFFFFF';
  let brandText = 'AYM Distribuciones';
  let badgeColor = '#F59E0B';
  let badgeText = type.toUpperCase();

  switch (type) {
    case 'bilac':
      bgGradient = '<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#FACC15"/><stop offset="50%" stop-color="#FDE68A"/><stop offset="100%" stop-color="#78350F"/></linearGradient>';
      brandText = 'BILAC';
      badgeText = 'CHOCOLATE 180ml';
      badgeColor = '#DC2626';
      break;
    case 'tostao-intenso':
      bgGradient = '<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#18181B"/><stop offset="60%" stop-color="#27272A"/><stop offset="100%" stop-color="#B91C1C"/></linearGradient>';
      brandText = "TOSTAO'";
      badgeText = 'SELECTO INTENSO';
      badgeColor = '#DC2626';
      break;
    case 'tostao-suave':
      bgGradient = '<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#18181B"/><stop offset="60%" stop-color="#27272A"/><stop offset="100%" stop-color="#047857"/></linearGradient>';
      brandText = "TOSTAO'";
      badgeText = 'SELECTO SUAVE';
      badgeColor = '#059669';
      break;
    case 'speedmax':
      bgGradient = '<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#09090B"/><stop offset="60%" stop-color="#18181B"/><stop offset="100%" stop-color="#D97706"/></linearGradient>';
      brandText = 'SPEED MAX';
      badgeText = 'ENERGIZANTE';
      badgeColor = '#F59E0B';
      break;
    case 'festival':
      bgGradient = '<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#2563EB"/><stop offset="100%" stop-color="#1D4ED8"/></linearGradient>';
      brandText = 'FESTIVAL';
      badgeText = 'GALLETAS';
      badgeColor = '#FBBF24';
      break;
    case 'aceite-premier':
      bgGradient = '<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#FEF08A"/><stop offset="100%" stop-color="#EAB308"/></linearGradient>';
      brandText = 'PREMIER';
      badgeText = 'ACEITE VEGETAL';
      badgeColor = '#15803D';
      break;
    case 'arroz-diana':
      bgGradient = '<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#FFFFFF"/><stop offset="100%" stop-color="#DC2626"/></linearGradient>';
      brandText = 'DIANA';
      badgeText = 'ARROZ BLANCO';
      badgeColor = '#DC2626';
      break;
    case 'atun-vancamps':
      bgGradient = '<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#1E3A8A"/><stop offset="100%" stop-color="#F59E0B"/></linearGradient>';
      brandText = "VAN CAMP'S";
      badgeText = 'LOMITOS EN ACEITE';
      badgeColor = '#F59E0B';
      break;
    case 'jet':
      bgGradient = '<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#1D4ED8"/><stop offset="100%" stop-color="#1E293B"/></linearGradient>';
      brandText = 'CHOCOLATINA JET';
      badgeText = 'TRADICIONAL';
      badgeColor = '#EF4444';
      break;
    case 'fab-detergente':
      bgGradient = '<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#2563EB"/><stop offset="100%" stop-color="#0284C7"/></linearGradient>';
      brandText = 'FAB';
      badgeText = 'DETERGENTE';
      badgeColor = '#F97316';
      break;
    case 'cocacola':
      bgGradient = '<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#DC2626"/><stop offset="100%" stop-color="#991B1B"/></linearGradient>';
      brandText = 'Coca-Cola';
      badgeText = 'ORIGINAL';
      badgeColor = '#FFFFFF';
      brandColor = '#FFFFFF';
      break;
    case 'alqueria':
      bgGradient = '<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#FFFFFF"/><stop offset="100%" stop-color="#EF4444"/></linearGradient>';
      brandText = 'Alquería';
      badgeText = 'LECHE ENTERA';
      badgeColor = '#DC2626';
      break;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="500" height="500">
  <defs>
    ${bgGradient}
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-opacity="0.25"/>
    </filter>
  </defs>
  <rect width="500" height="500" rx="28" fill="url(#bg)" />
  <rect x="25" y="25" width="450" height="450" rx="20" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="3"/>
  <circle cx="250" cy="180" r="90" fill="rgba(255,255,255,0.15)" />
  <text x="250" y="195" font-family="'Segoe UI', Arial, sans-serif" font-size="34" font-weight="900" fill="${brandColor}" text-anchor="middle" letter-spacing="1">
    ${brandText}
  </text>
  <rect x="125" y="290" width="250" height="40" rx="20" fill="${badgeColor}" filter="url(#shadow)" />
  <text x="250" y="316" font-family="'Segoe UI', Arial, sans-serif" font-size="16" font-weight="800" fill="#FFFFFF" text-anchor="middle" letter-spacing="1">
    ${badgeText}
  </text>
  <text x="250" y="380" font-family="'Segoe UI', Arial, sans-serif" font-size="20" font-weight="700" fill="#FFFFFF" text-anchor="middle" filter="url(#shadow)">
    ${safeName}
  </text>
  <text x="250" y="440" font-family="'Segoe UI', Arial, sans-serif" font-size="13" font-weight="600" fill="rgba(255,255,255,0.75)" text-anchor="middle">
    AYM DISTRIBUCIONES
  </text>
</svg>`;
}

/**
 * Downloads a ZIP package containing all product images, indices, and gallery
 */
export async function exportProductImagesToZip(
  products: Product[],
  onProgress?: (progress: ImageExportProgress) => void
): Promise<ImageExportResult> {
  const zip = new JSZip();
  const imgFolder = zip.folder('imagenes');

  let exportedImagesCount = 0;
  let remoteUrlsCount = 0;
  let dataUrlsCount = 0;
  let presetsCount = 0;
  let corsErrorsCount = 0;

  const total = products.length;
  const indexRows: Array<{
    id: string;
    name: string;
    category: string;
    sku: string;
    barcode: string;
    filename: string;
    imageUrl: string;
    type: string;
    status: string;
  }> = [];

  const directUrlsList: string[] = [];

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    const rawImage = (product.imageUrl || '').trim();
    const safeName = sanitizeFilename(product.name || `producto_${product.id}`);
    const codePrefix = product.sku
      ? `${sanitizeFilename(product.sku)}_`
      : product.barcode
      ? `${sanitizeFilename(product.barcode)}_`
      : `${sanitizeFilename(product.id)}_`;

    onProgress?.({
      processed: i + 1,
      total,
      percent: Math.round(((i + 1) / total) * 100),
      currentProduct: product.name,
      message: `Procesando imagen ${i + 1} de ${total}: ${product.name}`,
    });

    let filename = '';
    let imageType = 'Desconocido';
    let status = 'Correcto';

    // 1. Data URLs (Base64 images uploaded by user)
    if (rawImage.startsWith('data:image/')) {
      dataUrlsCount++;
      imageType = 'Subida Local (Base64)';
      const mimeMatch = rawImage.match(/^data:image\/([a-zA-Z0-9+]+);base64,/);
      let ext = 'png';
      if (mimeMatch && mimeMatch[1]) {
        ext = mimeMatch[1].replace('jpeg', 'jpg').replace('svg+xml', 'svg');
      }
      filename = `${codePrefix}${safeName}.${ext}`;
      const base64Data = rawImage.replace(/^data:image\/[a-zA-Z0-9+]+;base64,/, '');

      if (imgFolder) {
        imgFolder.file(filename, base64Data, { base64: true });
        exportedImagesCount++;
      }
    }
    // 2. HTTP or HTTPS remote URLs
    else if (rawImage.startsWith('http://') || rawImage.startsWith('https://')) {
      remoteUrlsCount++;
      imageType = 'URL Externa (Web)';
      directUrlsList.push(`${product.name}: ${rawImage}`);

      // Attempt to infer extension from URL
      let ext = 'jpg';
      try {
        const cleanUrl = rawImage.split('?')[0].split('#')[0];
        const match = cleanUrl.match(/\.(png|jpg|jpeg|webp|svg|gif|avif)$/i);
        if (match) {
          ext = match[1].toLowerCase().replace('jpeg', 'jpg');
        }
      } catch (e) {}

      filename = `${codePrefix}${safeName}.${ext}`;

      // Try fetching image bytes (if CORS allows)
      let fetchedSuccessfully = false;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout per image

        const res = await fetch(rawImage, {
          signal: controller.signal,
          mode: 'cors',
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const blob = await res.blob();
          if (imgFolder && blob.size > 0) {
            imgFolder.file(filename, blob);
            exportedImagesCount++;
            fetchedSuccessfully = true;
          }
        }
      } catch (err) {
        // Fetch failed due to CORS or timeout
      }

      if (!fetchedSuccessfully) {
        corsErrorsCount++;
        status = 'Enlace Web (Abrir en Navegador)';
        // Provide an SVG fallback bookmark inside the folder
        const svgFallback = generatePresetSvg('web-image', product.name);
        if (imgFolder) {
          imgFolder.file(`${codePrefix}${safeName}.svg`, svgFallback);
        }
      }
    }
    // 3. Preset visual keys (bilac, tostao-intenso, speedmax, etc.) or fallback
    else {
      presetsCount++;
      const presetKey = rawImage || 'bilac';
      imageType = `Clave Visual (${presetKey})`;
      filename = `${codePrefix}${safeName}.svg`;

      const svgContent = generatePresetSvg(presetKey, product.name);
      if (imgFolder) {
        imgFolder.file(filename, svgContent);
        exportedImagesCount++;
      }
    }

    indexRows.push({
      id: product.id,
      name: product.name,
      category: product.category,
      sku: product.sku || '',
      barcode: product.barcode || '',
      filename,
      imageUrl: rawImage,
      type: imageType,
      status,
    });
  }

  // 4. Generate CSV Index
  const csvHeaders = ['ID', 'Nombre', 'Categoría', 'SKU', 'Código de Barras', 'Archivo en ZIP', 'Clave / URL Imagen', 'Tipo', 'Estado'];
  const csvContent = [
    csvHeaders.join(';'),
    ...indexRows.map((r) =>
      [
        `"${r.id}"`,
        `"${(r.name || '').replace(/"/g, '""')}"`,
        `"${(r.category || '').replace(/"/g, '""')}"`,
        `"${r.sku}"`,
        `"${r.barcode}"`,
        `"${r.filename}"`,
        `"${(r.imageUrl || '').replace(/"/g, '""')}"`,
        `"${r.type}"`,
        `"${r.status}"`,
      ].join(';')
    ),
  ].join('\r\n');

  zip.file('indice_imagenes_catalogo.csv', '\uFEFF' + csvContent); // Add UTF-8 BOM for Excel compatibility

  // 5. Generate Text List of Direct URLs
  if (directUrlsList.length > 0) {
    const urlsText = [
      '========================================================================',
      'AYM DISTRIBUCIONES - LISTA DE ENLACES DIRECTOS A IMÁGENES DE PRODUCTOS',
      `Fecha de exportación: ${new Date().toLocaleString('es-CO')}`,
      `Total enlaces web: ${directUrlsList.length}`,
      '========================================================================\r\n',
      ...directUrlsList,
    ].join('\r\n');

    zip.file('enlaces_directos_imagenes.txt', urlsText);
  }

  // 6. Generate Standalone HTML Photo Gallery
  const htmlGallery = generateOfflineHtmlGallery(products);
  zip.file('catalogo_galeria_imagenes.html', htmlGallery);

  // 7. Compress and trigger download
  onProgress?.({
    processed: total,
    total,
    percent: 100,
    message: 'Comprimiendo archivo ZIP de imágenes...',
  });

  const zipBlob = await zip.generateAsync(
    {
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    },
    (meta) => {
      onProgress?.({
        processed: total,
        total,
        percent: Math.round(meta.percent),
        message: `Generando archivo ZIP... ${Math.round(meta.percent)}%`,
      });
    }
  );

  const zipName = `aym-imagenes-catalogo-${new Date().toISOString().slice(0, 10)}.zip`;
  const downloadUrl = URL.createObjectURL(zipBlob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = zipName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(downloadUrl);

  return {
    total,
    exportedImagesCount,
    remoteUrlsCount,
    dataUrlsCount,
    presetsCount,
    corsErrorsCount,
    zipName,
  };
}

/**
 * Builds a self-contained offline HTML photo gallery file that opens directly in any browser
 */
function generateOfflineHtmlGallery(products: Product[]): string {
  const itemsHtml = products
    .map((p) => {
      const img = p.imageUrl || 'bilac';
      let imgTag = '';
      if (img.startsWith('data:image/') || img.startsWith('http://') || img.startsWith('https://')) {
        imgTag = `<img src="${img}" alt="${p.name}" class="product-img" loading="lazy" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'100\\' height=\\'100\\'><rect fill=\\'%23e2e8f0\\' width=\\'100\\' height=\\'100\\'/><text fill=\\'%2364748b\\' x=\\'50%\\' y=\\'50%\\' dominant-baseline=\\'middle\\' text-anchor=\\'middle\\' font-size=\\'12\\'>Sin Imagen</text></svg>'"/>`;
      } else {
        imgTag = `<div class="preset-badge"><span class="preset-name">${img.toUpperCase()}</span><span class="preset-label">Clave Visual</span></div>`;
      }

      return `
      <div class="card">
        <div class="img-wrapper">
          ${imgTag}
        </div>
        <div class="card-info">
          <span class="category">${p.category}</span>
          <h3 class="title">${p.name}</h3>
          <div class="price-row">
            <span class="price">$${p.price.toLocaleString('es-CO')}</span>
            ${p.sku ? `<span class="sku">SKU: ${p.sku}</span>` : ''}
          </div>
          ${p.barcode ? `<span class="barcode">EAN: ${p.barcode}</span>` : ''}
          <div class="url-copy">
            <span class="url-text">${img.slice(0, 40)}${img.length > 40 ? '...' : ''}</span>
          </div>
        </div>
      </div>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Galería de Imágenes - AYM Distribuciones</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f8fafc; color: #1e293b; padding: 24px; }
    header { max-width: 1200px; margin: 0 auto 24px; background: #0B4EA2; color: #fff; padding: 24px; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
    h1 { font-size: 24px; font-weight: 900; margin-bottom: 6px; }
    p { font-size: 14px; opacity: 0.9; }
    .stats { display: flex; gap: 16px; margin-top: 16px; flex-wrap: wrap; }
    .stat-pill { background: rgba(255,255,255,0.2); padding: 6px 14px; border-radius: 9999px; font-size: 12px; font-weight: 700; }
    .grid { max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
    .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 1px 3px rgba(0,0,0,0.05); transition: transform 0.15s; }
    .card:hover { transform: translateY(-3px); box-shadow: 0 6px 12px rgba(0,0,0,0.08); }
    .img-wrapper { height: 180px; background: #f1f5f9; display: flex; align-items: center; justify-content: center; overflow: hidden; padding: 12px; }
    .product-img { max-width: 100%; max-height: 100%; object-fit: contain; }
    .preset-badge { display: flex; flex-direction: column; align-items: center; justify-content: center; background: #0B4EA2; color: #fff; width: 100%; height: 100%; border-radius: 8px; text-align: center; padding: 8px; }
    .preset-name { font-size: 14px; font-weight: 900; }
    .preset-label { font-size: 10px; opacity: 0.8; margin-top: 4px; }
    .card-info { padding: 12px; display: flex; flex-direction: column; gap: 4px; flex: 1; }
    .category { font-size: 10px; font-weight: 800; color: #0B4EA2; text-transform: uppercase; }
    .title { font-size: 13px; font-weight: 700; line-height: 1.3; color: #0f172a; min-height: 34px; }
    .price-row { display: flex; justify-content: space-between; align-items: center; margin-top: auto; padding-top: 8px; }
    .price { font-size: 14px; font-weight: 900; color: #047857; }
    .sku, .barcode { font-size: 10px; color: #64748b; }
    .url-copy { font-size: 9px; color: #94a3b8; word-break: break-all; margin-top: 4px; border-top: 1px dashed #e2e8f0; padding-top: 4px; }
  </style>
</head>
<body>
  <header>
    <h1>Catálogo de Productos con Imágenes</h1>
    <p>AYM Distribuciones • Archivo exportado el ${new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
    <div class="stats">
      <div class="stat-pill">Total: ${products.length} productos</div>
      <div class="stat-pill">Precios en Pesos Colombianos ($ COP)</div>
    </div>
  </header>
  <main class="grid">
    ${itemsHtml}
  </main>
</body>
</html>`;
}
