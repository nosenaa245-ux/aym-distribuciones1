import React, { useState } from 'react';
import {
  Printer,
  X,
  FileText,
  Receipt,
  Store,
  MapPin,
  Phone,
  Calendar,
  CheckCircle2,
  Clock,
  Truck,
  RotateCcw,
  Boxes,
  CreditCard,
  Building2,
  Copy,
  Check
} from 'lucide-react';
import { OrderRecord } from '../types';

interface OrderPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  order?: OrderRecord | null;
  ordersList?: OrderRecord[];
  brandingName?: string;
  brandingSubtitle?: string;
  storePhone?: string;
}

export const OrderPrintModal: React.FC<OrderPrintModalProps> = ({
  isOpen,
  onClose,
  order,
  ordersList,
  brandingName = 'AYM DISTRIBUCIONES',
  brandingSubtitle = 'aym-distribuciones.verse.app',
  storePhone = '3113986110',
}) => {
  const [printFormat, setPrintFormat] = useState<'letter' | 'pos80' | 'pos58' | 'batch_list'>('letter');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const isBatchMode = Boolean(ordersList && ordersList.length > 0 && !order);
  const activeOrder = order || (ordersList && ordersList.length > 0 ? ordersList[0] : null);

  const formatCOP = (val: number) => `$${Math.round(val).toLocaleString('es-CO')} COP`;

  const formatDate = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('es-CO', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCopyText = () => {
    if (!activeOrder) return;
    let text = `📦 *PEDIDO #${activeOrder.orderNumber} - ${brandingName}*\n`;
    text += `📅 Fecha: ${formatDate(activeOrder.createdAt)}\n`;
    text += `🏪 Tienda: ${activeOrder.customer.storeName}\n`;
    text += `👤 Propietario: ${activeOrder.customer.ownerName}\n`;
    text += `📍 Dirección: ${activeOrder.customer.address}, ${activeOrder.customer.city}\n`;
    text += `📞 Teléfono: ${activeOrder.customer.phone}\n`;
    text += `💳 Pago: ${activeOrder.customer.paymentMethod}\n`;
    text += `\n*ARTÍCULOS:*\n`;
    activeOrder.items.forEach((it, idx) => {
      const activeQty = Math.max(0, it.quantity - (it.returnedQuantity || 0));
      text += `${idx + 1}. ${it.product.name} (${it.product.packaging}) x ${activeQty} = ${formatCOP(it.product.price * activeQty)}\n`;
    });
    text += `\n💰 *TOTAL:* ${formatCOP(activeOrder.totalPrice)}\n`;
    if (activeOrder.customer.notes) {
      text += `📝 *Notas:* ${activeOrder.customer.notes}\n`;
    }
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 print:p-0 print:bg-white print:static print:overflow-visible">
      {/* Modal Card */}
      <div className="bg-white rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl border border-gray-200 animate-in zoom-in-95 my-4 print:shadow-none print:border-none print:max-w-none print:m-0 print:w-full">
        {/* Screen Toolbar (Hidden on print) */}
        <div className="bg-slate-900 text-white p-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-600 rounded-xl text-white">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-white">
                {isBatchMode ? 'Imprimir Listado de Pedidos en Nube' : `Imprimir Pedido #${activeOrder?.orderNumber}`}
              </h3>
              <p className="text-[11px] text-slate-300">
                Selecciona el formato y haz clic en "Imprimir Ahora"
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isBatchMode && (
              <button
                type="button"
                onClick={handleCopyText}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition-colors"
                title="Copiar resumen del pedido"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copiado' : 'Copiar'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Ahora</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              title="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Format Selector Tabs (Screen Only) */}
        <div className="bg-slate-100 p-2.5 border-b border-gray-200 flex items-center gap-2 overflow-x-auto print:hidden">
          <span className="text-xs font-bold text-slate-600 px-2 whitespace-nowrap">Formato:</span>

          {!isBatchMode && (
            <>
              <button
                type="button"
                onClick={() => setPrintFormat('letter')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                  printFormat === 'letter'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-200 border border-gray-200'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Factura / Remisión (Carta / A4)</span>
              </button>

              <button
                type="button"
                onClick={() => setPrintFormat('pos80')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                  printFormat === 'pos80'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-200 border border-gray-200'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Ticket POS (80mm)</span>
              </button>

              <button
                type="button"
                onClick={() => setPrintFormat('pos58')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                  printFormat === 'pos58'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-200 border border-gray-200'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Ticket POS Mini (58mm)</span>
              </button>
            </>
          )}

          {isBatchMode && (
            <button
              type="button"
              onClick={() => setPrintFormat('batch_list')}
              className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 bg-blue-600 text-white shadow-xs"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Manifiesto de Despacho ({ordersList?.length} Pedidos)</span>
            </button>
          )}
        </div>

        {/* PRINTABLE PREVIEW CONTAINER */}
        <div className="p-4 sm:p-6 max-h-[75vh] overflow-y-auto bg-slate-50 print:bg-white print:p-0 print:max-h-none print:overflow-visible">
          {/* FORMAT 1: FULL LETTER / A4 INVOICE */}
          {(!isBatchMode && printFormat === 'letter' && activeOrder) && (
            <div className="bg-white p-6 sm:p-8 rounded-xl border border-gray-200 shadow-sm print:shadow-none print:border-none print:p-0 max-w-2xl mx-auto text-slate-900">
              {/* Invoice Header */}
              <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
                <div>
                  <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-950">
                    {brandingName}
                  </h1>
                  <p className="text-xs font-semibold text-slate-600">{brandingSubtitle}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    WhatsApp Despachos: <strong>+{storePhone}</strong>
                  </p>
                </div>

                <div className="text-right">
                  <div className="inline-block bg-slate-950 text-white text-xs font-mono font-black px-3 py-1 rounded">
                    ORDEN #{activeOrder.orderNumber}
                  </div>
                  <div className="text-[11px] text-slate-600 mt-1.5">
                    <strong>Fecha:</strong> {formatDate(activeOrder.createdAt)}
                  </div>
                  <div className="text-[11px] font-bold text-slate-800 uppercase mt-0.5">
                    Estado: {activeOrder.status}
                  </div>
                </div>
              </div>

              {/* Customer & Dispatch Info */}
              <div className="grid grid-cols-2 gap-4 my-4 p-3.5 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Datos del Cliente / Negocio
                  </div>
                  <div className="font-extrabold text-slate-900 text-sm">{activeOrder.customer.storeName}</div>
                  <div className="text-slate-700"><strong>Propietario:</strong> {activeOrder.customer.ownerName}</div>
                  <div className="text-slate-700"><strong>Teléfono:</strong> {activeOrder.customer.phone}</div>
                </div>

                <div>
                  <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Lugar de Entrega & Pago
                  </div>
                  <div className="text-slate-800"><strong>Dirección:</strong> {activeOrder.customer.address}</div>
                  <div className="text-slate-800"><strong>Ciudad:</strong> {activeOrder.customer.city}</div>
                  <div className="text-slate-800"><strong>Método de Pago:</strong> <span className="capitalize">{activeOrder.customer.paymentMethod}</span></div>
                  {activeOrder.customer.notes && (
                    <div className="mt-1 text-slate-700 italic bg-white p-1.5 rounded border border-slate-200 text-[11px]">
                      <strong>Nota:</strong> {activeOrder.customer.notes}
                    </div>
                  )}
                </div>
              </div>

              {/* Items Table */}
              <div className="my-4">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-white font-bold uppercase text-[10.5px]">
                      <th className="py-2 px-2.5 text-center w-8">#</th>
                      <th className="py-2 px-2.5">Descripción del Producto</th>
                      <th className="py-2 px-2.5 text-center">Empaque</th>
                      <th className="py-2 px-2.5 text-center">Cant.</th>
                      <th className="py-2 px-2.5 text-right">Precio Unit.</th>
                      <th className="py-2 px-2.5 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 border-b border-slate-300">
                    {activeOrder.items
                      .filter((item) => Math.max(0, item.quantity - (item.returnedQuantity || 0)) > 0)
                      .map((item, idx) => {
                        const activeQty = Math.max(0, item.quantity - (item.returnedQuantity || 0));
                        return (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-2 px-2.5 text-center text-slate-500 font-mono">{idx + 1}</td>
                            <td className="py-2 px-2.5">
                              <div className="font-bold text-slate-900">{item.product.name}</div>
                              {item.product.category && (
                                <div className="text-[10px] text-slate-500">{item.product.category}</div>
                              )}
                            </td>
                            <td className="py-2 px-2.5 text-center text-slate-600">{item.product.packaging}</td>
                            <td className="py-2 px-2.5 text-center font-bold text-slate-900">{activeQty}</td>
                            <td className="py-2 px-2.5 text-right font-mono text-slate-700">
                              {formatCOP(item.product.price)}
                            </td>
                            <td className="py-2 px-2.5 text-right font-mono font-bold text-slate-900">
                              {formatCOP(item.product.price * activeQty)}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>

              {/* Totals Section */}
              <div className="flex justify-between items-start pt-2 border-t border-slate-200">
                <div className="text-[11px] text-slate-500 max-w-xs space-y-1">
                  <div>* Comprobante generado desde la plataforma oficial de {brandingName}.</div>
                  <div>* Revisa tu pedido al momento de la entrega.</div>
                </div>

                <div className="w-56 space-y-1 text-xs text-right">
                  <div className="flex justify-between text-slate-600">
                    <span>Unidades activas:</span>
                    <span className="font-bold text-slate-900">{activeOrder.totalItemsCount} unid.</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Artículos distintos:</span>
                    <span className="font-bold text-slate-900">{activeOrder.items.length}</span>
                  </div>
                  <div className="flex justify-between text-base font-black text-slate-950 pt-2 border-t-2 border-slate-900">
                    <span>TOTAL:</span>
                    <span>{formatCOP(activeOrder.totalPrice)}</span>
                  </div>
                </div>
              </div>

              {/* Signature area */}
              <div className="grid grid-cols-2 gap-8 mt-10 pt-6 border-t border-dashed border-slate-300 text-center text-xs">
                <div>
                  <div className="h-10"></div>
                  <div className="border-t border-slate-400 pt-1 font-bold text-slate-700">
                    Entregado por (Despachador)
                  </div>
                  <div className="text-[10px] text-slate-400">Firma y Cédula</div>
                </div>
                <div>
                  <div className="h-10"></div>
                  <div className="border-t border-slate-400 pt-1 font-bold text-slate-700">
                    Recibido Conforme (Cliente)
                  </div>
                  <div className="text-[10px] text-slate-400">Firma y Sello / Cédula</div>
                </div>
              </div>
            </div>
          )}

          {/* FORMAT 2 & 3: THERMAL POS TICKET (80mm or 58mm) */}
          {(!isBatchMode && (printFormat === 'pos80' || printFormat === 'pos58') && activeOrder) && (
            <div
              className={`bg-white p-4 rounded-xl border border-gray-300 shadow-xs print:shadow-none print:border-none print:p-0 mx-auto text-slate-900 font-mono ${
                printFormat === 'pos58' ? 'max-w-[240px] text-[10px]' : 'max-w-[320px] text-xs'
              }`}
            >
              {/* Thermal Header */}
              <div className="text-center pb-2 border-b border-dashed border-slate-400 space-y-0.5">
                <div className="font-black text-sm uppercase">{brandingName}</div>
                <div className="text-[10px]">{brandingSubtitle}</div>
                <div className="text-[10px]">Tel / WhatsApp: {storePhone}</div>
                <div className="text-[10px] font-bold mt-1">*** COMPROBANTE DE DESPACHO ***</div>
              </div>

              {/* Order and Customer info */}
              <div className="py-2 border-b border-dashed border-slate-400 space-y-1 text-[11px]">
                <div className="font-bold">ORDEN: #{activeOrder.orderNumber}</div>
                <div>FECHA: {formatDate(activeOrder.createdAt)}</div>
                <div>ESTADO: {activeOrder.status.toUpperCase()}</div>
                <div className="pt-1 border-t border-slate-200">
                  <div className="font-bold">TIENDA: {activeOrder.customer.storeName}</div>
                  <div>CLIENTE: {activeOrder.customer.ownerName}</div>
                  <div>TEL: {activeOrder.customer.phone}</div>
                  <div>DIR: {activeOrder.customer.address}</div>
                  <div>CIUDAD: {activeOrder.customer.city}</div>
                  <div>PAGO: {activeOrder.customer.paymentMethod.toUpperCase()}</div>
                  {activeOrder.customer.notes && (
                    <div className="italic">OBS: {activeOrder.customer.notes}</div>
                  )}
                </div>
              </div>

              {/* Thermal Items List */}
              <div className="py-2 border-b border-dashed border-slate-400">
                <div className="flex justify-between font-bold text-[10px] border-b border-slate-200 pb-1 mb-1">
                  <span>CANT / PRODUCTO</span>
                  <span>TOTAL</span>
                </div>
                <div className="space-y-1.5">
                  {activeOrder.items
                    .filter((it) => Math.max(0, it.quantity - (it.returnedQuantity || 0)) > 0)
                    .map((it, idx) => {
                      const activeQty = Math.max(0, it.quantity - (it.returnedQuantity || 0));
                      return (
                        <div key={idx} className="space-y-0.5">
                          <div className="font-bold leading-tight">{it.product.name}</div>
                          <div className="flex justify-between text-[10.5px] text-slate-700">
                            <span>{activeQty} x {formatCOP(it.product.price)}</span>
                            <span className="font-bold">{formatCOP(it.product.price * activeQty)}</span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Thermal Totals */}
              <div className="py-2 space-y-1">
                <div className="flex justify-between text-xs font-black text-slate-900 border-t border-slate-900 pt-1">
                  <span>TOTAL A PAGAR:</span>
                  <span>{formatCOP(activeOrder.totalPrice)}</span>
                </div>
                <div className="text-[10px] text-center text-slate-600 mt-2">
                  Total {activeOrder.totalItemsCount} unidades entregadas
                </div>
              </div>

              {/* Thermal Footer */}
              <div className="text-center pt-3 border-t border-dashed border-slate-400 text-[10px] space-y-1">
                <div>¡Gracias por tu compra mayorista!</div>
                <div className="font-bold">{brandingSubtitle}</div>
                <div className="h-6"></div>
                <div className="border-t border-slate-300 pt-1">Firma del Cliente Recibido</div>
              </div>
            </div>
          )}

          {/* FORMAT 4: BATCH ORDERS REPORT / DISPATCH MANIFEST */}
          {(isBatchMode || printFormat === 'batch_list') && ordersList && (
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm print:shadow-none print:border-none print:p-0 max-w-4xl mx-auto text-slate-900">
              <div className="flex justify-between items-start border-b-2 border-slate-900 pb-3 mb-4">
                <div>
                  <h1 className="text-xl font-black text-slate-950">{brandingName}</h1>
                  <p className="text-xs font-semibold text-slate-600">
                    Manifiesto de Despacho & Consolidado de Pedidos en Nube
                  </p>
                </div>
                <div className="text-right text-xs">
                  <div className="font-bold text-slate-900">Total: {ordersList.length} Pedidos</div>
                  <div className="text-slate-500">{new Date().toLocaleString('es-CO')}</div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-white font-bold uppercase text-[10px]">
                      <th className="py-2 px-2 text-center">#</th>
                      <th className="py-2 px-2">Orden</th>
                      <th className="py-2 px-2">Cliente / Tienda</th>
                      <th className="py-2 px-2">Ciudad & Dirección</th>
                      <th className="py-2 px-2">Teléfono</th>
                      <th className="py-2 px-2 text-center">Unid.</th>
                      <th className="py-2 px-2 text-right">Total</th>
                      <th className="py-2 px-2 text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {ordersList.map((ord, idx) => (
                      <tr key={ord.id} className="hover:bg-slate-50">
                        <td className="py-2 px-2 text-center font-mono text-slate-500">{idx + 1}</td>
                        <td className="py-2 px-2 font-mono font-bold text-slate-900">#{ord.orderNumber}</td>
                        <td className="py-2 px-2">
                          <div className="font-bold text-slate-900">{ord.customer.storeName}</div>
                          <div className="text-[10px] text-slate-500">{ord.customer.ownerName}</div>
                        </td>
                        <td className="py-2 px-2">
                          <div>{ord.customer.address}</div>
                          <div className="text-[10px] font-semibold text-slate-600">{ord.customer.city}</div>
                        </td>
                        <td className="py-2 px-2 font-mono text-slate-700">{ord.customer.phone}</td>
                        <td className="py-2 px-2 text-center font-bold">{ord.totalItemsCount}</td>
                        <td className="py-2 px-2 text-right font-mono font-bold text-slate-900">
                          {formatCOP(ord.totalPrice)}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-800">
                            {ord.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 font-bold border-t-2 border-slate-900 text-xs">
                      <td colSpan={5} className="py-2 px-2 text-right">TOTAL GENERAL:</td>
                      <td className="py-2 px-2 text-center font-black">
                        {ordersList.reduce((sum, o) => sum + o.totalItemsCount, 0)}
                      </td>
                      <td className="py-2 px-2 text-right font-black text-blue-700">
                        {formatCOP(ordersList.reduce((sum, o) => (o.status !== 'cancelado' ? sum + o.totalPrice : sum), 0))}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions (Screen Only) */}
        <div className="p-4 bg-slate-100 border-t border-gray-200 flex items-center justify-between gap-3 print:hidden">
          <div className="text-xs text-slate-500 hidden sm:block">
            💡 <strong>Consejo:</strong> En el diálogo de impresión de tu navegador, puedes seleccionar tu impresora térmica o guardar como PDF.
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-white transition-colors"
            >
              Cerrar
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
