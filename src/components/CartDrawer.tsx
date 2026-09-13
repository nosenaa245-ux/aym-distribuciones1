import React, { useState, useEffect } from 'react';
import {
  X,
  Trash2,
  Plus,
  Minus,
  Send,
  ShoppingBag,
  Tag,
  Store,
  CreditCard,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Phone,
  Search,
  UserCheck,
  UserX,
  Sparkles,
  MapPin
} from 'lucide-react';
import { CartItem, OrderCustomerInfo, Customer } from '../types';
import { ProductVisual } from './ProductVisual';
import { findCustomerByPhoneLocal, normalizePhone, saveCustomerLocal } from '../lib/localDatabase';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  onUpdateQuantity: (productId: string, delta: number) => void;
  onSetQuantity?: (productId: string, quantity: number) => void;
  onRemoveItem: (productId: string) => void;
  onClearCart: () => void;
  onProceedOrder: (info: OrderCustomerInfo) => void;
  activeCustomer?: Customer | null;
  onCustomerIdentified?: (customer: Customer | null) => void;
  onOpenCustomerModal?: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  cartItems,
  onUpdateQuantity,
  onSetQuantity,
  onRemoveItem,
  onClearCart,
  onProceedOrder,
  activeCustomer,
  onCustomerIdentified,
  onOpenCustomerModal,
}) => {
  const [customerInfo, setCustomerInfo] = useState<OrderCustomerInfo>({
    storeName: '',
    ownerName: '',
    phone: '',
    address: '',
    city: 'Bucaramanga',
    notes: '',
    paymentMethod: 'contraentrega',
  });

  const [showCheckoutForm, setShowCheckoutForm] = useState(true);
  const [isSearchingPhone, setIsSearchingPhone] = useState(false);
  const [autoFilledStore, setAutoFilledStore] = useState<string | null>(null);

  // Sync active customer if passed
  useEffect(() => {
    if (activeCustomer) {
      setCustomerInfo({
        storeName: activeCustomer.storeName || '',
        ownerName: activeCustomer.ownerName || '',
        phone: activeCustomer.phone || '',
        address: activeCustomer.address || '',
        city: activeCustomer.city || 'Bucaramanga',
        notes: activeCustomer.notes || '',
        paymentMethod: activeCustomer.paymentMethod || 'contraentrega',
      });
      setAutoFilledStore(activeCustomer.storeName);
    } else {
      // Default placeholder if no active customer
      setCustomerInfo((prev) => ({
        ...prev,
        storeName: prev.storeName || '',
        ownerName: prev.ownerName || '',
        phone: prev.phone || '',
        address: prev.address || '',
        city: prev.city || 'Bucaramanga',
      }));
    }
  }, [activeCustomer, isOpen]);

  if (!isOpen) return null;

  const formatCOP = (val: number) => `$${val.toLocaleString('es-CO')} COP`;

  // Total calculations
  const totalItemsCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);
  
  const totalPrice = cartItems.reduce(
    (acc, item) => acc + item.product.price * item.quantity,
    0
  );

  const originalTotalPrice = cartItems.reduce(
    (acc, item) =>
      acc + (item.product.originalPrice || item.product.price) * item.quantity,
    0
  );

  const totalDiscount = Math.max(0, originalTotalPrice - totalPrice);

  const handleLookupPhone = async (phoneToLook: string) => {
    const clean = normalizePhone(phoneToLook);
    if (!clean || clean.length < 7) return;

    setIsSearchingPhone(true);
    try {
      const found = await findCustomerByPhoneLocal(clean);
      if (found) {
        setCustomerInfo({
          storeName: found.storeName || '',
          ownerName: found.ownerName || '',
          phone: found.phone || clean,
          address: found.address || '',
          city: found.city || 'Bucaramanga',
          notes: found.notes || '',
          paymentMethod: found.paymentMethod || 'contraentrega',
        });
        setAutoFilledStore(found.storeName);
        if (onCustomerIdentified) {
          onCustomerIdentified(found);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearchingPhone(false);
    }
  };

  const handleClearCustomer = () => {
    setAutoFilledStore(null);
    setCustomerInfo({
      storeName: '',
      ownerName: '',
      phone: '',
      address: '',
      city: 'Bucaramanga',
      notes: '',
      paymentMethod: 'contraentrega',
    });
    if (onCustomerIdentified) {
      onCustomerIdentified(null);
    }
  };

  const handleInputChange = (field: keyof OrderCustomerInfo, val: string) => {
    setCustomerInfo((prev) => ({ ...prev, [field]: val }));

    // If phone field is typed, auto check when 10 digits
    if (field === 'phone') {
      const clean = normalizePhone(val);
      if (clean.length === 10) {
        handleLookupPhone(clean);
      }
    }
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerInfo.phone?.trim() || !customerInfo.storeName?.trim()) {
      setShowCheckoutForm(true);
      alert('Por favor ingresa tu número de WhatsApp y el nombre de tu tienda.');
      return;
    }

    // Auto-save or update customer in directory to keep database fresh
    try {
      const clean = normalizePhone(customerInfo.phone);
      if (clean) {
        await saveCustomerLocal({
          id: `cli-${clean}`,
          phone: clean,
          storeName: customerInfo.storeName,
          ownerName: customerInfo.ownerName || customerInfo.storeName,
          address: customerInfo.address || '',
          city: customerInfo.city || 'Bucaramanga',
          paymentMethod: customerInfo.paymentMethod,
          notes: customerInfo.notes || '',
          status: 'active',
          createdAt: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.warn('Silent customer auto-save notice:', e);
    }

    onProceedOrder(customerInfo);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in"
      />

      <div className="absolute inset-y-0 right-0 max-w-full flex pl-0 sm:pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200">
          
          {/* Header */}
          <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between bg-slate-900 text-white">
            <div className="flex items-center gap-2.5">
              <ShoppingBag className="w-5 h-5 text-blue-400" />
              <div>
                <h2 className="font-bold text-base tracking-tight">Tu Pedido AYM Distribuciones</h2>
                <p className="text-xs text-slate-300">
                  {totalItemsCount} {totalItemsCount === 1 ? 'artículo' : 'artículos'} seleccionados
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
              aria-label="Cerrar carrito"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {cartItems.length === 0 ? (
              <div className="text-center py-16 px-4 space-y-3">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto text-gray-400">
                  <ShoppingBag className="w-8 h-8" />
                </div>
                <h3 className="font-bold text-slate-800 text-lg">Tu carrito está vacío</h3>
                <p className="text-xs text-gray-500 max-w-xs mx-auto">
                  Agrega productos en promoción desde el catálogo para iniciar tu pedido mayorista.
                </p>
                <button
                  onClick={onClose}
                  className="mt-4 px-5 py-2.5 bg-[#0B4EA2] text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors shadow-xs"
                >
                  Explorar Promociones
                </button>
              </div>
            ) : (
              <>
                {/* List of Cart Items */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-gray-500 font-semibold px-1">
                    <span>PRODUCTOS ({cartItems.length})</span>
                    <button
                      onClick={onClearCart}
                      className="text-red-600 hover:text-red-700 flex items-center gap-1 hover:underline"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Vaciar
                    </button>
                  </div>

                  {cartItems.map((item) => (
                    <div
                      key={item.product.id}
                      className="bg-gray-50/80 rounded-xl p-3 border border-gray-200/70 flex gap-3 items-center justify-between"
                    >
                      {/* Thumbnail visual */}
                      <div className="w-14 h-16 bg-white rounded-lg p-1 border border-gray-100 flex items-center justify-center flex-shrink-0">
                        <ProductVisual type={item.product.imageUrl} name={item.product.name} className="scale-65" />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0 pr-2">
                        <h4 className="text-xs font-bold text-slate-900 truncate uppercase">
                          {item.product.name}
                        </h4>
                        <div className="flex items-center gap-2 text-[11px] text-gray-500">
                          <span>{item.product.packaging}</span>
                          {(item.product.sku || item.product.barcode) && (
                            <span className="text-[9.5px] font-mono px-1 py-0.2 bg-slate-200/70 rounded text-slate-700 font-semibold">
                              SKU: {item.product.sku || item.product.barcode}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-xs font-black text-[#0B5CAB]">
                            {formatCOP(item.product.price)}
                          </span>
                          {item.product.originalPrice && item.product.originalPrice > item.product.price && (
                            <span className="line-through text-gray-400 text-[10px]">
                              {formatCOP(item.product.originalPrice)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Quantity control */}
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        {typeof item.product.stock === 'number' && item.product.stock <= 0 ? (
                          <div className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-1 rounded border border-rose-200">
                            Agotado
                          </div>
                        ) : (
                          <div className="flex items-center border border-gray-300 rounded-lg bg-white overflow-hidden shadow-2xs">
                            <button
                              type="button"
                              onClick={() => onUpdateQuantity(item.product.id, -1)}
                              className="p-1 hover:bg-gray-100 text-gray-700 transition-colors cursor-pointer"
                              title="Restar 1 unidad"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            
                            <input
                              type="number"
                              min="1"
                              max={typeof item.product.stock === 'number' ? item.product.stock : 9999}
                              value={item.quantity}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                const maxStock = typeof item.product.stock === 'number' ? item.product.stock : 9999;
                                const sanitized = isNaN(val) ? 0 : Math.max(0, Math.min(val, maxStock));
                                if (onSetQuantity) {
                                  onSetQuantity(item.product.id, sanitized);
                                } else {
                                  onUpdateQuantity(item.product.id, sanitized - item.quantity);
                                }
                              }}
                              onClick={(e) => (e.target as HTMLInputElement).select()}
                              className="w-8 text-center text-xs font-bold text-slate-800 bg-transparent focus:bg-blue-50 focus:outline-hidden [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              title="Editar cantidad"
                            />

                            <button
                              type="button"
                              onClick={() => onUpdateQuantity(item.product.id, 1)}
                              disabled={typeof item.product.stock === 'number' && item.quantity >= item.product.stock}
                              className="p-1 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-gray-700 transition-colors cursor-pointer"
                              title={typeof item.product.stock === 'number' && item.quantity >= item.product.stock ? 'Stock máximo alcanzado' : 'Sumar 1 unidad'}
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        )}

                        <span className="text-xs font-bold text-slate-900">
                          {formatCOP(item.product.price * item.quantity)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Customer / Store Details Collapsible Form */}
                <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setShowCheckoutForm(!showCheckoutForm)}
                    className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-xs font-bold text-slate-800 transition-colors border-b border-gray-200/80"
                  >
                    <div className="flex items-center gap-2">
                      <Store className="w-4 h-4 text-blue-600" />
                      <span>Datos del Negocio y Entrega</span>
                      {autoFilledStore && (
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
                          Cliente Reconocido
                        </span>
                      )}
                    </div>
                    {showCheckoutForm ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {showCheckoutForm && (
                    <div className="p-4 space-y-3.5 text-xs bg-white animate-in slide-in-from-top-1">
                      {/* Customer Found Banner */}
                      {autoFilledStore ? (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between gap-2 text-emerald-900 animate-in fade-in">
                          <div className="flex items-center gap-2 min-w-0">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <div className="text-[11px] leading-tight truncate">
                              <span className="text-emerald-700 font-semibold block text-[10px]">Cliente asignado:</span>
                              <strong className="text-slate-900 font-black">{autoFilledStore}</strong>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {onOpenCustomerModal && (
                              <button
                                type="button"
                                onClick={onOpenCustomerModal}
                                className="px-2 py-1 bg-white hover:bg-blue-50 text-[#0B4EA2] border border-blue-200 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                                title="Cambiar a otro cliente"
                              >
                                Cambiar
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={handleClearCustomer}
                              className="px-2 py-1 bg-white hover:bg-rose-50 text-rose-700 hover:text-rose-800 border border-rose-200 hover:border-rose-300 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                              title="Quitar este cliente si te has equivocado y limpiar los datos"
                            >
                              <UserX className="w-3.5 h-3.5 text-rose-600" />
                              <span>Quitar</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        onOpenCustomerModal && (
                          <button
                            type="button"
                            onClick={onOpenCustomerModal}
                            className="w-full py-2 px-3 bg-blue-50/80 hover:bg-blue-100/80 border border-blue-200 text-[#0B4EA2] rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Search className="w-3.5 h-3.5" />
                            <span>Buscar cliente por Nombre o WhatsApp</span>
                          </button>
                        )
                      )}

                      {/* WhatsApp Phone - Key identification field */}
                      <div>
                        <label className="block font-bold text-gray-700 mb-1 flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5 text-emerald-600" />
                            Teléfono WhatsApp *
                          </span>
                          <span className="text-[10px] text-gray-400 font-normal">Carga tus datos al escribir 10 dígitos</span>
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-400 text-xs">+57</span>
                          <input
                            type="tel"
                            value={customerInfo.phone}
                            onChange={(e) => handleInputChange('phone', e.target.value)}
                            className="w-full pl-11 pr-20 py-2 border border-gray-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                            placeholder="3113986110"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => handleLookupPhone(customerInfo.phone)}
                            disabled={isSearchingPhone}
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-[10.5px] font-bold transition-colors"
                          >
                            {isSearchingPhone ? '...' : 'Buscar'}
                          </button>
                        </div>
                      </div>

                      {/* Store & Contact Names */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block font-semibold text-gray-700 mb-1">Nombre Tienda / Negocio *</label>
                          <input
                            type="text"
                            value={customerInfo.storeName}
                            onChange={(e) => handleInputChange('storeName', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-medium"
                            placeholder="Ej: Minimarket Don Pedro"
                            required
                          />
                        </div>

                        <div>
                          <label className="block font-semibold text-gray-700 mb-1">Nombre Contacto / Dueño *</label>
                          <input
                            type="text"
                            value={customerInfo.ownerName}
                            onChange={(e) => handleInputChange('ownerName', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                            placeholder="Ej: Pedro Gómez"
                            required
                          />
                        </div>
                      </div>

                      {/* Address & City */}
                      <div className="grid grid-cols-3 gap-2.5">
                        <div className="col-span-2">
                          <label className="block font-semibold text-gray-700 mb-1">Dirección de Entrega *</label>
                          <input
                            type="text"
                            value={customerInfo.address}
                            onChange={(e) => handleInputChange('address', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                            placeholder="Carrera 15 # 45-20"
                            required
                          />
                        </div>

                        <div>
                          <label className="block font-semibold text-gray-700 mb-1">Ciudad *</label>
                          <input
                            type="text"
                            value={customerInfo.city}
                            onChange={(e) => handleInputChange('city', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                            placeholder="Bucaramanga"
                            required
                          />
                        </div>
                      </div>

                      {/* Payment method */}
                      <div>
                        <label className="block font-semibold text-gray-700 mb-1">Método de Pago</label>
                        <select
                          value={customerInfo.paymentMethod}
                          onChange={(e) => handleInputChange('paymentMethod', e.target.value as any)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden bg-white"
                        >
                          <option value="contraentrega">💵 Contra entrega en efectivo</option>
                          <option value="transferencia">📲 Transferencia Nequi / Daviplata / Bancolombia</option>
                          <option value="credito">📄 Crédito de Tienda AYM Distribuciones (30 días)</option>
                        </select>
                      </div>

                      {/* Delivery Instructions */}
                      <div>
                        <label className="block font-semibold text-gray-700 mb-1">Instrucciones o Referencias (Opcional)</label>
                        <textarea
                          rows={2}
                          value={customerInfo.notes}
                          onChange={(e) => handleInputChange('notes', e.target.value)}
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                          placeholder="Horarios de recepción, referencias para el transportador..."
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Price Breakdown summary */}
                <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-200/80 space-y-2 text-xs">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal de productos:</span>
                    <span className="font-semibold text-slate-800">{formatCOP(originalTotalPrice)}</span>
                  </div>

                  {totalDiscount > 0 && (
                    <div className="flex justify-between text-emerald-700 font-semibold">
                      <span className="flex items-center gap-1">
                        <Tag className="w-3.5 h-3.5" /> Descuentos Promocionales:
                      </span>
                      <span>-{formatCOP(totalDiscount)}</span>
                    </div>
                  )}

                  <div className="border-t border-gray-200 pt-2 flex justify-between items-baseline">
                    <span className="text-sm font-black text-slate-900">TOTAL A PAGAR:</span>
                    <span className="text-base font-black text-[#0B5CAB]">
                      {formatCOP(totalPrice)}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Footer Checkout Buttons */}
          {cartItems.length > 0 && (
            <div className="p-4 bg-white border-t border-gray-200 space-y-2">
              <button
                id="btn-checkout-confirm"
                onClick={handleSubmitOrder}
                className="w-full py-3.5 px-4 bg-[#0B4EA2] hover:bg-[#093e82] active:scale-[0.99] text-white font-black text-sm uppercase tracking-wide rounded-xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Confirmar y Enviar Pedido Directo</span>
              </button>

              <div className="text-center">
                <span className="text-[10px] text-gray-500 flex items-center justify-center gap-1 font-medium">
                  🔒 Registro directo en sistema con Folio Oficial Inalterable
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
