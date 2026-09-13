import React, { useState } from 'react';
import {
  CheckCircle,
  MessageSquare,
  Copy,
  Check,
  X,
  Printer,
  Store,
  ShieldCheck,
  ExternalLink,
  Lock,
  ArrowRight,
  FileText
} from 'lucide-react';
import { CartItem, OrderCustomerInfo } from '../types';
import { formatCOP, generateOfficialWhatsAppMessage, getWhatsAppDirectUrl } from '../utils/orderUtils';

interface OrderSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderNumber: string;
  cartItems: CartItem[];
  customerInfo: OrderCustomerInfo;
  targetPhone?: string;
}

export const OrderSuccessModal: React.FC<OrderSuccessModalProps> = ({
  isOpen,
  onClose,
  orderNumber,
  cartItems,
  customerInfo,
  targetPhone = '573113986110',
}) => {
  const [copied, setCopied] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  if (!isOpen) return null;

  const verificationUrl = `${window.location.origin}${window.location.pathname}?pedido=${orderNumber}`;

  const totalPrice = cartItems.reduce(
    (acc, item) => acc + item.product.price * item.quantity,
    0
  );

  const totalItemsCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  const handleCopyText = () => {
    const msg = generateOfficialWhatsAppMessage(
      orderNumber,
      cartItems,
      customerInfo,
      totalPrice,
      verificationUrl
    );
    navigator.clipboard.writeText(msg);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(verificationUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2500);
  };

  const handleSendWhatsApp = () => {
    const directUrl = getWhatsAppDirectUrl(
      targetPhone,
      orderNumber,
      cartItems,
      customerInfo,
      totalPrice,
      verificationUrl
    );
    window.open(directUrl, '_blank');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-gray-100 animate-in zoom-in-95 my-8">
        
        {/* Top celebratory banner */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 px-6 py-5 text-white text-center relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-emerald-100 hover:text-white p-1.5 rounded-full hover:bg-white/20 transition-colors"
            title="Cerrar comprobante"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-2 backdrop-blur-xs ring-4 ring-white/10">
            <CheckCircle className="w-8 h-8 text-white stroke-[2.5]" />
          </div>
          <h2 className="text-xl font-black tracking-tight">¡Pedido Recibido y Registrado!</h2>
          <p className="text-emerald-100 text-xs mt-0.5 font-medium">
            Folio Oficial Inalterable: <strong className="text-white font-mono bg-emerald-800/60 px-2 py-0.5 rounded-md">#{orderNumber}</strong>
          </p>
        </div>

        {/* Security & System Immutability Badge */}
        <div className="bg-emerald-50 border-b border-emerald-100 px-4 py-2.5 flex items-start gap-2.5 text-[11px] text-emerald-900">
          <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Registro Central Protegido: </span>
            <span>
              Este pedido fue registrado de manera directa e inalterable en el sistema de AYM Distribuciones. Los productos, cantidades y precios válidos son los almacenados con el Folio #{orderNumber}.
            </span>
          </div>
        </div>

        {/* Receipt details */}
        <div className="p-5 sm:p-6 space-y-4 text-xs">
          {/* Customer & Store Card */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-1.5 text-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-slate-900">
                <Store className="w-4 h-4 text-blue-600" />
                <span>{customerInfo.storeName}</span>
              </div>
              <span className="text-[10px] font-mono font-bold bg-slate-200 text-slate-700 px-2 py-0.5 rounded">
                FOLIO #{orderNumber}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 pt-1 border-t border-slate-200/60 text-[11px]">
              <div><strong>Contacto:</strong> {customerInfo.ownerName}</div>
              <div><strong>WhatsApp:</strong> {customerInfo.phone}</div>
              <div><strong>Dirección:</strong> {customerInfo.address}</div>
              <div><strong>Ciudad:</strong> {customerInfo.city}</div>
              <div className="sm:col-span-2">
                <strong>Método de pago:</strong>{' '}
                <span className="capitalize">{customerInfo.paymentMethod}</span>
              </div>
              {customerInfo.notes && (
                <div className="sm:col-span-2 text-gray-600 bg-white p-2 rounded border border-slate-200/70 mt-1">
                  <strong>Instrucciones:</strong> {customerInfo.notes}
                </div>
              )}
            </div>
          </div>

          {/* Items Summary Table */}
          <div className="border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
            <div className="bg-gray-100 px-3.5 py-2 font-bold text-gray-700 flex justify-between text-xs">
              <span>Producto ({totalItemsCount} un.)</span>
              <span>Subtotal</span>
            </div>
            <div className="divide-y divide-gray-100 max-h-48 overflow-y-auto">
              {cartItems.map((item) => (
                <div key={item.product.id} className="p-2.5 flex justify-between items-center text-gray-700 bg-white hover:bg-slate-50">
                  <div className="pr-2 min-w-0 flex-1">
                    <span className="font-semibold text-slate-900 block truncate text-xs">
                      {item.product.name}
                      {item.product.sku && (
                        <span className="ml-1.5 px-1 py-0.2 bg-slate-100 border border-slate-200 rounded text-[9.5px] font-mono text-slate-600">
                          SKU: {item.product.sku}
                        </span>
                      )}
                    </span>
                    <span className="text-[10px] text-gray-500">
                      {item.quantity} un. x {formatCOP(item.product.price)}
                    </span>
                  </div>
                  <span className="font-bold text-slate-900 flex-shrink-0 text-xs">
                    {formatCOP(item.product.price * item.quantity)}
                  </span>
                </div>
              ))}
            </div>
            <div className="bg-blue-50/90 px-3.5 py-2.5 border-t border-blue-100 flex justify-between items-center font-black text-slate-900">
              <span className="text-xs uppercase tracking-wide">TOTAL A PAGAR:</span>
              <span className="text-base text-[#0B5CAB]">{formatCOP(totalPrice)}</span>
            </div>
          </div>

          {/* Direct Verification Link Pill */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-2.5 flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <span className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                Enlace Oficial del Pedido
              </span>
              <span className="block font-mono text-[11px] text-blue-700 truncate">
                {verificationUrl}
              </span>
            </div>
            <button
              onClick={handleCopyLink}
              className="px-2.5 py-1.5 bg-white hover:bg-gray-100 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 flex items-center gap-1 transition-colors flex-shrink-0"
              title="Copiar enlace"
            >
              {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedUrl ? 'Copiado' : 'Copiar Link'}</span>
            </button>
          </div>

          {/* Action buttons */}
          <div className="space-y-2 pt-1">
            <button
              onClick={handleSendWhatsApp}
              className="w-full py-3 px-4 bg-[#25D366] hover:bg-[#20bd5a] active:scale-[0.99] text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Abrir WhatsApp del Distribuidor (311 398 6110)</span>
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleCopyText}
                className="py-2.5 px-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? '¡Copiado!' : 'Copiar Texto'}</span>
              </button>

              <button
                onClick={handlePrint}
                className="py-2.5 px-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors"
              >
                <Printer className="w-4 h-4 text-gray-600" />
                <span>Imprimir / PDF</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-gray-50 border-t border-gray-200 text-center">
          <button
            onClick={onClose}
            className="text-xs font-bold text-[#0B4EA2] hover:underline"
          >
            ← Volver al Catálogo de Productos
          </button>
        </div>
      </div>
    </div>
  );
};

