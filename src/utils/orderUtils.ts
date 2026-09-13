import { CartItem, OrderCustomerInfo } from '../types';

export function formatCOP(val: number): string {
  return `$${val.toLocaleString('es-CO')} COP`;
}

export function generateOfficialWhatsAppMessage(
  orderNumber: string,
  items: CartItem[],
  customer: OrderCustomerInfo,
  totalPrice: number,
  verificationUrl?: string
): string {
  const dateStr = new Date().toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const totalUnits = items.reduce((acc, it) => acc + it.quantity, 0);

  let msg = `🛒 *NUEVO PEDIDO REGISTRADO EN SISTEMA - AYM DISTRIBUCIONES*\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `📄 *FOLIO OFICIAL:* #${orderNumber}\n`;
  msg += `📅 *Fecha:* ${dateStr}\n`;
  msg += `🏪 *Tienda / Negocio:* ${customer.storeName}\n`;
  msg += `👤 *Contacto:* ${customer.ownerName}\n`;
  msg += `📱 *Teléfono:* ${customer.phone}\n`;
  msg += `📍 *Dirección:* ${customer.address} (${customer.city})\n`;
  
  const paymentLabels: Record<string, string> = {
    contraentrega: 'Contra entrega en efectivo',
    transferencia: 'Transferencia (Nequi / Daviplata / Bancolombia)',
    credito: 'Crédito de Tienda AYM (30 días)',
  };
  msg += `💳 *Método de Pago:* ${paymentLabels[customer.paymentMethod] || customer.paymentMethod}\n`;

  if (customer.notes && customer.notes.trim()) {
    msg += `📝 *Observaciones:* ${customer.notes.trim()}\n`;
  }

  msg += `━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `📦 *DETALLE OFICIAL DE PRODUCTOS (${totalUnits} un.):*\n`;
  items.forEach((it, idx) => {
    const rawSku = (it.product.sku || (it.product as any).barcode || '').trim();
    const skuLabel = rawSku ? ` 🔹 *SKU:* \`${rawSku}\`` : '';
    msg += `${idx + 1}. *${it.product.name}*${skuLabel}\n   └ ${it.quantity} un. x ${formatCOP(it.product.price)} = *${formatCOP(it.product.price * it.quantity)}*\n`;
  });

  msg += `━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `💰 *TOTAL A PAGAR:* *${formatCOP(totalPrice)}*\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n`;

  if (verificationUrl) {
    msg += `🛡️ *VERIFICACIÓN OFICIAL EN LÍNEA (INALTERABLE):*\n`;
    msg += `👉 ${verificationUrl}\n\n`;
  }

  msg += `🔒 *Aviso de Integridad del Sistema:*\n`;
  msg += `_Este pedido fue ingresado directamente en la base de datos central de AYM Distribuciones. Los precios, productos y totales autorizados para despacho corresponden únicamente al Folio #${orderNumber} registrado en el servidor._`;

  return msg;
}

export function getWhatsAppDirectUrl(
  phone: string,
  orderNumber: string,
  items: CartItem[],
  customer: OrderCustomerInfo,
  totalPrice: number,
  verificationUrl?: string
): string {
  const cleanPhone = phone.replace(/\D/g, '');
  const targetPhone = cleanPhone.startsWith('57') ? cleanPhone : `57${cleanPhone}`;
  const message = generateOfficialWhatsAppMessage(
    orderNumber,
    items,
    customer,
    totalPrice,
    verificationUrl
  );
  return `https://api.whatsapp.com/send?phone=${targetPhone}&text=${encodeURIComponent(message)}`;
}
