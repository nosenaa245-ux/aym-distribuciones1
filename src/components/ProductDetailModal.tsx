import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Minus,
  Package,
  ShoppingCart,
  Barcode,
  Ban,
  AlertCircle,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Check,
  Tag,
  ArrowLeft,
  Edit2,
} from 'lucide-react';
import { Product } from '../types';
import { ProductVisual } from './ProductVisual';

interface ProductDetailModalProps {
  product: Product | null;
  quantity: number;
  onClose: () => void;
  onUpdateQuantity: (productId: string, delta: number) => void;
  onSetQuantity?: (productId: string, quantity: number) => void;
  onAddToCart?: (productId: string, quantity: number) => void;
  onEditProduct?: (product: Product) => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  quantity,
  onClose,
  onUpdateQuantity,
  onSetQuantity,
  onAddToCart,
  onEditProduct,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxZoom, setLightboxZoom] = useState(1);

  // Reset zoom and states when product changes
  useEffect(() => {
    setIsLightboxOpen(false);
    setLightboxZoom(1);
  }, [product?.id]);

  // Handle ESC key to close lightbox or modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isLightboxOpen) {
          setIsLightboxOpen(false);
        } else if (isExpanded) {
          setIsExpanded(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLightboxOpen, isExpanded, onClose]);

  if (!product) return null;

  const formatCOP = (val: number) => `$${val.toLocaleString('es-CO')} COP`;

  const isOutOfStock = typeof product.stock === 'number' ? product.stock <= 0 : false;
  const availableStock = typeof product.stock === 'number' ? product.stock : 100;
  const isLowStock = !isOutOfStock && typeof product.stock === 'number' && product.stock <= 10;
  const discountAmount = product.originalPrice && product.originalPrice > product.price
    ? product.originalPrice - product.price
    : 0;
  const discountPercent = product.originalPrice && product.originalPrice > product.price
    ? Math.round((discountAmount / product.originalPrice) * 100)
    : 0;

  const currentTotalCOP = quantity * product.price;

  return (
    <>
      {/* Main Product View Modal */}
      <div className="fixed inset-0 z-50 overflow-y-auto bg-black/65 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in">
        <div
          className={`bg-white rounded-2xl md:rounded-3xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col transition-all duration-300 ${
            isExpanded
              ? 'w-full max-w-5xl h-[95vh] md:h-[90vh]'
              : 'w-full max-w-lg sm:max-w-xl max-h-[92vh]'
          }`}
        >
          {/* Header Bar */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 bg-slate-900 text-white shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              {isExpanded && (
                <button
                  type="button"
                  onClick={() => setIsExpanded(false)}
                  className="p-1 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer mr-1"
                  title="Volver a vista estándar"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
              <span className="text-xs font-bold uppercase tracking-wider text-blue-300 truncate">
                {product.category}
              </span>
              {product.sku && (
                <>
                  <span className="text-slate-600">•</span>
                  <span className="text-[11px] font-mono text-slate-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                    SKU: {product.sku}
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {/* Direct Edit Pencil Button */}
              {onEditProduct && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onEditProduct(product);
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-600/90 hover:bg-blue-600 text-white transition-all cursor-pointer shadow-2xs"
                  title="Modificar este producto directamente en el panel"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Modificar</span>
                </button>
              )}

              {/* Expand / Minimize Toggle Button */}
              <button
                type="button"
                onClick={() => setIsExpanded((prev) => !prev)}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition-all cursor-pointer shadow-2xs"
                title={isExpanded ? 'Reducir tamaño de ventana' : 'Entrar a la página completa para verla más grande'}
              >
                {isExpanded ? (
                  <>
                    <Minimize2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Vista Estándar</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-3.5 h-3.5 text-blue-400" />
                    <span>Ver más grande</span>
                  </>
                )}
              </button>

              {/* Close Button */}
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer ml-1"
                title="Cerrar (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Modal Content - Adapts dynamically between Standard and Full-Page Mode */}
          <div className="overflow-y-auto flex-1 p-4 sm:p-6 md:p-8">
            {isExpanded ? (
              /* Expanded / Full Page View - 2 Columns on Desktop */
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8 items-start h-full">
                {/* Left Column: Big Product Showcase */}
                <div className="md:col-span-6 lg:col-span-7 flex flex-col gap-3">
                  <div
                    onClick={() => setIsLightboxOpen(true)}
                    className={`w-full min-h-[340px] sm:min-h-[420px] md:min-h-[460px] bg-gradient-to-b from-slate-50 via-gray-50 to-slate-100/80 rounded-2xl border border-slate-200/90 flex items-center justify-center p-6 relative cursor-zoom-in group shadow-xs transition-all ${
                      isOutOfStock ? 'opacity-70 grayscale-[30%]' : 'hover:border-blue-300'
                    }`}
                    title="Haz clic para ver imagen en pantalla completa con zoom ultra-grande"
                  >
                    <ProductVisual
                      type={product.imageUrl}
                      name={product.name}
                      className="max-h-[380px] w-auto drop-shadow-md group-hover:scale-105 transition-transform duration-300"
                    />

                    {/* Barcode badge */}
                    {product.barcode && (
                      <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-xs px-2.5 py-1 rounded-lg text-xs font-mono text-slate-800 border border-gray-200 shadow-sm flex items-center gap-1.5">
                        <Barcode className="w-4 h-4 text-blue-600" />
                        <span>{product.barcode}</span>
                      </div>
                    )}

                    {/* Out of stock badge */}
                    {isOutOfStock && (
                      <div className="absolute top-3 right-3 bg-rose-600 text-white text-xs font-black uppercase tracking-wider px-3 py-1 rounded-lg flex items-center gap-1.5 shadow-md">
                        <Ban className="w-4 h-4" />
                        <span>Agotado</span>
                      </div>
                    )}

                    {/* Promo badge */}
                    {product.hasPromotion !== false && Boolean(product.promoBadge && product.promoBadge.trim()) && !isOutOfStock && (
                      <div className="absolute top-3 left-3 bg-[#D8F3DC] text-[#1E7E34] text-xs font-bold px-3 py-1 rounded-lg border border-[#B7E4C7] shadow-2xs">
                        {product.promoBadge}
                      </div>
                    )}

                    {/* Zoom Overlay Hint */}
                    <div className="absolute bottom-3 right-3 bg-slate-900/85 hover:bg-blue-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 backdrop-blur-xs shadow-md transition-colors">
                      <ZoomIn className="w-3.5 h-3.5 text-blue-300" />
                      <span>Ampliar foto</span>
                    </div>
                  </div>

                  <p className="text-center text-xs text-gray-500 italic">
                    💡 Haz clic en la imagen del producto para verla en pantalla completa en alta resolución con zoom.
                  </p>
                </div>

                {/* Right Column: Complete Specs, Pricing & Purchase Controls */}
                <div className="md:col-span-6 lg:col-span-5 flex flex-col justify-between space-y-4">
                  <div className="space-y-4">
                    {/* Category & Badges */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="bg-blue-50 text-[#0B4EA2] text-xs font-bold px-2.5 py-1 rounded-lg border border-blue-200/80">
                        {product.category}
                      </span>
                      <span className="bg-gray-100 text-gray-700 text-xs font-semibold px-2.5 py-1 rounded-lg flex items-center gap-1 border border-gray-200">
                        <Package className="w-3.5 h-3.5 text-gray-500" />
                        {product.packaging}
                      </span>
                      {isOutOfStock ? (
                        <span className="bg-rose-100 text-rose-800 text-xs font-bold px-2.5 py-1 rounded-lg border border-rose-200 flex items-center gap-1">
                          <Ban className="w-3.5 h-3.5 text-rose-600" />
                          Sin existencias
                        </span>
                      ) : isLowStock ? (
                        <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-1 rounded-lg border border-amber-200 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                          Últimas {product.stock} un. disponibles
                        </span>
                      ) : typeof product.stock === 'number' ? (
                        <span className="bg-emerald-50 text-emerald-800 text-xs font-bold px-2.5 py-1 rounded-lg border border-emerald-200 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          {product.stock} un. disponibles en bodega
                        </span>
                      ) : null}
                    </div>

                    {/* Product Name */}
                    <h1 className={`text-xl sm:text-2xl font-black uppercase tracking-tight leading-snug ${
                      isOutOfStock ? 'text-slate-600 line-through decoration-rose-300' : 'text-slate-900'
                    }`}>
                      {product.name}
                    </h1>

                    {/* Price Card */}
                    <div className={`p-4 rounded-2xl border ${
                      isOutOfStock ? 'bg-rose-50/60 border-rose-200' : 'bg-blue-50/80 border-blue-200'
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-blue-900">
                          Precio Mayorista
                        </span>
                        {discountPercent > 0 && (
                          <span className="bg-rose-600 text-white text-[11px] font-black px-2 py-0.5 rounded-md flex items-center gap-1">
                            <Tag className="w-3 h-3" />
                            {discountPercent}% OFF
                          </span>
                        )}
                      </div>

                      <div className="flex items-baseline gap-3 mt-1">
                        <span className={`text-2xl sm:text-3xl font-black ${
                          isOutOfStock ? 'text-slate-600' : 'text-[#0B5CAB]'
                        }`}>
                          {formatCOP(product.price)}
                        </span>
                        {product.originalPrice && product.originalPrice > product.price && (
                          <span className="text-sm line-through text-gray-400 font-semibold">
                            {formatCOP(product.originalPrice)}
                          </span>
                        )}
                      </div>

                      {discountAmount > 0 && (
                        <p className="text-xs text-emerald-700 font-semibold mt-1">
                          Ahorras {formatCOP(discountAmount)} por cada unidad
                        </p>
                      )}
                    </div>

                    {/* Product Description */}
                    {product.description && (
                      <div className="space-y-1.5 border-t border-gray-100 pt-3">
                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                          Descripción y Detalles
                        </h3>
                        <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                          {product.description}
                        </p>
                      </div>
                    )}

                    {/* Wholesale Packaging Packs */}
                    {!isOutOfStock && (
                      <div className="space-y-1.5 border-t border-gray-100 pt-3">
                        <div className="flex items-center justify-between text-xs font-bold text-gray-600">
                          <span>Sumar por empaques cerrados:</span>
                          <span className="text-gray-400 font-normal text-[11px]">Acceso rápido</span>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          {[
                            { label: '+6 und', amount: 6 },
                            { label: '+12 caja', amount: 12 },
                            { label: '+24 pack', amount: 24 },
                            { label: '+60 bulto', amount: 60 },
                          ].map((pack) => {
                            const isPackDisabled = quantity + pack.amount > availableStock;
                            return (
                              <button
                                key={pack.amount}
                                type="button"
                                disabled={isPackDisabled}
                                onClick={() => onUpdateQuantity(product.id, pack.amount)}
                                className="py-2 px-1 bg-blue-50 hover:bg-blue-100 disabled:opacity-35 disabled:cursor-not-allowed border border-blue-200 text-[#0B4EA2] rounded-xl text-xs font-bold transition-all active:scale-95 text-center cursor-pointer shadow-2xs"
                                title={isPackDisabled ? `Supera stock (${availableStock} un.)` : `Sumar ${pack.amount} unidades`}
                              >
                                {pack.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Quantity and Add to Cart Section */}
                  <div className="pt-4 border-t border-gray-200 space-y-3">
                    {isOutOfStock ? (
                      <div className="w-full py-3.5 px-4 bg-rose-50 border border-rose-200 text-rose-700 font-bold text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 select-none">
                        <Ban className="w-4 h-4" />
                        <span>Producto Sin Existencias (Agotado)</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-700">Cantidad a pedir:</span>
                          {quantity > 0 && (
                            <span className="text-xs font-bold text-blue-900">
                              Subtotal: <strong className="text-sm text-[#0B5CAB]">{formatCOP(currentTotalCOP)}</strong>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3">
                          {/* Stepper */}
                          <div className="flex items-center border border-gray-300 rounded-xl bg-white p-1 shadow-2xs">
                            <button
                              type="button"
                              onClick={() => onUpdateQuantity(product.id, -1)}
                              disabled={quantity <= 0}
                              className="w-9 h-9 rounded-lg hover:bg-gray-100 text-gray-700 disabled:opacity-30 flex items-center justify-center transition-colors cursor-pointer"
                              title="Restar 1 unidad"
                            >
                              <Minus className="w-4 h-4" />
                            </button>

                            <input
                              type="number"
                              min="0"
                              max={availableStock}
                              value={quantity === 0 ? '0' : quantity}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                const sanitized = isNaN(val) ? 0 : Math.max(0, Math.min(val, availableStock));
                                if (onSetQuantity) {
                                  onSetQuantity(product.id, sanitized);
                                } else {
                                  onUpdateQuantity(product.id, sanitized - quantity);
                                }
                              }}
                              onClick={(e) => (e.target as HTMLInputElement).select()}
                              className="w-14 h-9 text-center font-black text-slate-900 text-base focus:bg-blue-50/40 focus:outline-hidden rounded transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              title={quantity >= availableStock ? `Stock máximo (${availableStock} un.)` : 'Escribe la cantidad exacta'}
                            />

                            <button
                              type="button"
                              onClick={() => onUpdateQuantity(product.id, 1)}
                              disabled={quantity >= availableStock}
                              className="w-9 h-9 rounded-lg bg-black hover:bg-neutral-800 disabled:opacity-35 disabled:cursor-not-allowed text-white flex items-center justify-center transition-colors cursor-pointer"
                              title={quantity >= availableStock ? `Stock máximo (${availableStock} un.)` : 'Sumar 1 unidad'}
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>

                          {/* CTA Button */}
                          <button
                            type="button"
                            onClick={() => {
                              if (quantity === 0 && availableStock > 0) {
                                onUpdateQuantity(product.id, 1);
                              }
                              onClose();
                            }}
                            className="flex-1 py-3.5 px-4 bg-[#0B4EA2] hover:bg-[#093e82] text-white font-bold text-sm uppercase tracking-wider rounded-xl shadow-md flex items-center justify-center gap-2 transition-all active:scale-[0.99] cursor-pointer"
                          >
                            <ShoppingCart className="w-4 h-4" />
                            <span>{quantity > 0 ? `Listo (${quantity} un. en pedido)` : 'Agregar al Pedido'}</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* Standard Modal View - Spacious and Clean */
              <div className="space-y-4">
                {/* Visual Showcase Box */}
                <div
                  onClick={() => setIsLightboxOpen(true)}
                  className={`w-full h-52 sm:h-64 bg-gradient-to-b from-slate-50 via-gray-50 to-slate-100/70 rounded-2xl flex items-center justify-center p-4 border border-slate-200/90 relative cursor-zoom-in group shadow-xs transition-all ${
                    isOutOfStock ? 'opacity-65 grayscale-[35%]' : 'hover:border-blue-300'
                  }`}
                  title="Haz clic para ver imagen en pantalla completa con zoom"
                >
                  <ProductVisual
                    type={product.imageUrl}
                    name={product.name}
                    className="max-h-44 sm:max-h-56 w-auto object-contain group-hover:scale-105 transition-transform duration-200"
                  />

                  {product.barcode && (
                    <div className="absolute bottom-2 left-2 bg-white/90 backdrop-blur-xs px-2 py-0.5 rounded text-[10.5px] font-mono text-slate-800 border border-gray-200 shadow-2xs flex items-center gap-1">
                      <Barcode className="w-3.5 h-3.5 text-blue-600" />
                      <span>{product.barcode}</span>
                    </div>
                  )}

                  {isOutOfStock && (
                    <div className="absolute top-2 right-2 bg-rose-600 text-white text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md flex items-center gap-1 shadow-sm">
                      <Ban className="w-3.5 h-3.5" />
                      <span>Agotado</span>
                    </div>
                  )}

                  {/* Promo Badge */}
                  {product.hasPromotion !== false && Boolean(product.promoBadge && product.promoBadge.trim()) && !isOutOfStock && (
                    <div className="absolute top-2 left-2 bg-[#D8F3DC] text-[#1E7E34] text-[10.5px] font-bold px-2 py-0.5 rounded-md border border-[#B7E4C7]">
                      {product.promoBadge}
                    </div>
                  )}

                  {/* Zoom hint overlay */}
                  <div className="absolute bottom-2 right-2 bg-slate-900/80 hover:bg-blue-600 text-white px-2 py-1 rounded-lg text-[10.5px] font-bold flex items-center gap-1 backdrop-blur-xs shadow-2xs transition-colors">
                    <ZoomIn className="w-3 h-3 text-blue-300" />
                    <span>Zoom</span>
                  </div>
                </div>

                {/* Title & Badges */}
                <div>
                  <h2 className={`text-base sm:text-lg font-black uppercase tracking-tight leading-snug ${
                    isOutOfStock ? 'text-slate-600 line-through decoration-rose-300' : 'text-slate-900'
                  }`}>
                    {product.name}
                  </h2>

                  <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                    {isOutOfStock ? (
                      <span className="bg-rose-100 text-rose-800 text-[10.5px] font-bold px-2 py-0.5 rounded-md border border-rose-200 flex items-center gap-1">
                        <Ban className="w-3 h-3 text-rose-600" />
                        Sin existencias (Agotado)
                      </span>
                    ) : isLowStock ? (
                      <span className="bg-amber-100 text-amber-800 text-[10.5px] font-bold px-2 py-0.5 rounded-md border border-amber-200 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 text-amber-600" />
                        Últimas {product.stock} un. disponibles
                      </span>
                    ) : typeof product.stock === 'number' ? (
                      <span className="bg-emerald-50 text-emerald-800 text-[10.5px] font-bold px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1">
                        <Check className="w-3 h-3 text-emerald-600" />
                        {product.stock} un. disponibles
                      </span>
                    ) : null}

                    <span className="bg-gray-100 text-gray-700 text-[10.5px] font-semibold px-2 py-0.5 rounded-md flex items-center gap-1">
                      <Package className="w-3 h-3 text-gray-500" />
                      {product.packaging}
                    </span>
                  </div>
                </div>

                {/* Price Box */}
                <div className={`border rounded-xl p-3 flex items-center justify-between ${
                  isOutOfStock ? 'bg-rose-50/60 border-rose-100' : 'bg-blue-50/70 border-blue-100'
                }`}>
                  <div>
                    <div className={`text-[10.5px] font-semibold uppercase ${
                      isOutOfStock ? 'text-rose-900' : 'text-blue-900'
                    }`}>
                      Precio Mayorista
                    </div>
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <span className={`text-xl sm:text-2xl font-black ${
                        isOutOfStock ? 'text-slate-600' : 'text-[#0B5CAB]'
                      }`}>
                        {formatCOP(product.price)}
                      </span>
                      {product.originalPrice && product.originalPrice > product.price && (
                        <span className="text-xs line-through text-gray-400 font-medium">
                          {formatCOP(product.originalPrice)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => setIsExpanded(true)}
                      className="text-xs font-bold text-[#0B4EA2] hover:text-blue-800 flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors shadow-2xs cursor-pointer"
                    >
                      <Maximize2 className="w-3 h-3" />
                      <span>Ver más grande</span>
                    </button>
                  </div>
                </div>

                {/* Description */}
                {product.description && (
                  <div className="text-xs text-gray-600 leading-relaxed border-t border-gray-100 pt-2 line-clamp-3">
                    <span className="font-semibold text-gray-800 mr-1">Detalles:</span>
                    {product.description}
                  </div>
                )}

                {/* Packaging increments */}
                {!isOutOfStock && (
                  <div className="pt-1">
                    <div className="text-[10.5px] font-bold text-gray-500 mb-1 flex items-center justify-between">
                      <span>Sumar por empaques:</span>
                      <span className="text-gray-400 font-normal text-[10px]">Acceso rápido</span>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { label: '+6 und', amount: 6 },
                        { label: '+12 caja', amount: 12 },
                        { label: '+24 pack', amount: 24 },
                        { label: '+60 bulto', amount: 60 },
                      ].map((pack) => {
                        const isPackDisabled = quantity + pack.amount > availableStock;
                        return (
                          <button
                            key={pack.amount}
                            type="button"
                            disabled={isPackDisabled}
                            onClick={() => onUpdateQuantity(product.id, pack.amount)}
                            className="py-1.5 px-1 bg-blue-50/80 hover:bg-blue-100 disabled:opacity-35 disabled:cursor-not-allowed border border-blue-200 text-[#0B4EA2] rounded-lg text-[11px] font-bold transition-all active:scale-95 text-center cursor-pointer shadow-2xs"
                            title={isPackDisabled ? `Supera stock (${availableStock} un.)` : `Sumar ${pack.amount} unidades`}
                          >
                            {pack.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Quantity & Add Action */}
                <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                  {isOutOfStock ? (
                    <div className="w-full py-3 px-3 bg-rose-50 border border-rose-200 text-rose-700 font-bold text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 select-none">
                      <Ban className="w-4 h-4" />
                      <span>Producto Sin Existencias (Agotado)</span>
                    </div>
                  ) : (
                    <>
                      {/* Stepper */}
                      <div className="flex items-center border border-gray-300 rounded-xl bg-white p-0.5 shadow-2xs">
                        <button
                          type="button"
                          onClick={() => onUpdateQuantity(product.id, -1)}
                          disabled={quantity <= 0}
                          className="w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-700 disabled:opacity-30 flex items-center justify-center transition-colors cursor-pointer"
                          title="Restar 1 unidad"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>

                        <input
                          type="number"
                          min="0"
                          max={availableStock}
                          value={quantity === 0 ? '0' : quantity}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            const sanitized = isNaN(val) ? 0 : Math.max(0, Math.min(val, availableStock));
                            if (onSetQuantity) {
                              onSetQuantity(product.id, sanitized);
                            } else {
                              onUpdateQuantity(product.id, sanitized - quantity);
                            }
                          }}
                          onClick={(e) => (e.target as HTMLInputElement).select()}
                          className="w-12 h-8 text-center font-black text-slate-800 text-sm focus:bg-blue-50/30 focus:outline-hidden rounded transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          title={quantity >= availableStock ? `Stock máximo (${availableStock} un.)` : 'Escribe la cantidad exacta'}
                        />

                        <button
                          type="button"
                          onClick={() => onUpdateQuantity(product.id, 1)}
                          disabled={quantity >= availableStock}
                          className="w-8 h-8 rounded-lg bg-black hover:bg-neutral-800 disabled:opacity-35 disabled:cursor-not-allowed text-white flex items-center justify-center transition-colors cursor-pointer"
                          title={quantity >= availableStock ? `Stock máximo (${availableStock} un.)` : 'Sumar 1 unidad'}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Add Button */}
                      <button
                        type="button"
                        onClick={() => {
                          if (quantity === 0 && availableStock > 0) {
                            onUpdateQuantity(product.id, 1);
                          }
                          onClose();
                        }}
                        className="flex-1 py-3 px-3 bg-[#0B4EA2] hover:bg-[#093e82] text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-all active:scale-[0.99] cursor-pointer"
                      >
                        <ShoppingCart className="w-4 h-4" />
                        <span>{quantity > 0 ? `Listo (${quantity})` : 'Agregar'}</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* High-Resolution Fullscreen Image Lightbox Modal */}
      {isLightboxOpen && (
        <div
          onClick={() => setIsLightboxOpen(false)}
          className="fixed inset-0 z-[60] bg-black/95 flex flex-col justify-between p-3 sm:p-6 animate-in fade-in cursor-default"
        >
          {/* Lightbox Header Bar */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex items-center justify-between text-white w-full max-w-5xl mx-auto bg-slate-900/80 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-black uppercase text-white truncate max-w-[200px] sm:max-w-md">
                {product.name}
              </span>
              <span className="text-xs text-blue-300 font-mono hidden sm:inline">
                ({product.category})
              </span>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-slate-800/80 rounded-xl p-0.5 border border-white/10">
                <button
                  type="button"
                  onClick={() => setLightboxZoom((prev) => Math.max(0.6, prev - 0.25))}
                  className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                  title="Alejar (-)"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono px-2 text-slate-200">
                  {Math.round(lightboxZoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setLightboxZoom((prev) => Math.min(3, prev + 0.25))}
                  className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                  title="Acercar (+)"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setLightboxZoom(1)}
                  className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors cursor-pointer ml-0.5"
                  title="Restablecer tamaño (100%)"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsLightboxOpen(false)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-red-600 text-white transition-colors cursor-pointer ml-1"
                title="Cerrar visor (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Lightbox Center Image Showcase */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex-1 flex items-center justify-center overflow-auto p-4 my-2 select-none"
          >
            <div
              style={{ transform: `scale(${lightboxZoom})`, transition: 'transform 0.15s ease-out' }}
              className="max-w-4xl max-h-[75vh] flex items-center justify-center cursor-grab active:cursor-grabbing"
              onClick={() => setLightboxZoom((prev) => (prev > 1.2 ? 1 : 1.8))}
              title="Haz clic para alternar zoom rápido"
            >
              <ProductVisual
                type={product.imageUrl}
                name={product.name}
                className="max-h-[70vh] w-auto max-w-[85vw] object-contain drop-shadow-2xl"
              />
            </div>
          </div>

          {/* Lightbox Footer Note */}
          <div className="text-center text-xs text-slate-400">
            <span>Haz clic en la imagen o usa los controles para acercar. Presiona <strong>Esc</strong> para volver.</span>
          </div>
        </div>
      )}
    </>
  );
};
