import React from 'react';
import { Minus, Plus, Eye, Edit2, Barcode, Tag, Ban, AlertCircle } from 'lucide-react';
import { Product } from '../types';
import { ProductVisual } from './ProductVisual';

interface ProductCardProps {
  product: Product;
  quantity: number;
  onUpdateQuantity: (productId: string, delta: number) => void;
  onSetQuantity?: (productId: string, quantity: number) => void;
  onOpenDetails: (product: Product) => void;
  onEditProduct?: (product: Product) => void;
}

export const ProductCard = React.memo<ProductCardProps>(
  ({
    product,
    quantity,
    onUpdateQuantity,
    onSetQuantity,
    onOpenDetails,
    onEditProduct,
  }) => {
    // Format price Colombian Peso format e.g. $1,245COP
    const formatCOP = (val: number) => {
      return `$${val.toLocaleString('es-CO')}COP`;
    };

    const isOutOfStock = typeof product.stock === 'number' ? product.stock <= 0 : false;
    const availableStock = typeof product.stock === 'number' ? product.stock : 100;
    const isLowStock = !isOutOfStock && typeof product.stock === 'number' && product.stock <= 10;

    const isPromoActive =
      product.hasPromotion !== false &&
      Boolean(product.promoBadge && product.promoBadge.trim().length > 0);

    const hasSkuOrBarcode = Boolean(product.sku?.trim() || product.barcode?.trim());

    return (
      <div
        id={`product-card-${product.id}`}
        className={`bg-white rounded-2xl border ${
          isOutOfStock ? 'border-rose-200/90 bg-slate-50/40' : 'border-gray-200/80'
        } shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-md transition-all duration-200 p-3 sm:p-4 flex flex-col justify-between h-full group relative`}
      >
        {/* Product Image Area */}
        <div 
          onClick={() => onOpenDetails(product)}
          className={`relative w-full h-36 sm:h-40 bg-gradient-to-b from-gray-50/70 to-gray-100/40 rounded-xl flex items-center justify-center cursor-pointer p-2 overflow-hidden transition-transform duration-200 group-hover:scale-[1.02] ${
            isOutOfStock ? 'opacity-65 grayscale-[35%]' : ''
          }`}
          title={isOutOfStock ? 'Producto Agotado - Clic para ver detalles' : 'Ver detalles del producto'}
        >
          <ProductVisual type={product.imageUrl} name={product.name} />
          
          {/* SKU / Barcode pill overlay at top left of image */}
          {hasSkuOrBarcode && (
            <div className="absolute top-2 left-2 bg-slate-900/80 backdrop-blur-xs text-white text-[9.5px] font-mono font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1 shadow-2xs z-10">
              <Barcode className="w-3 h-3 text-blue-300" />
              <span className="truncate max-w-[110px]">{product.barcode || product.sku}</span>
            </div>
          )}

          {/* Out of stock badge */}
          {isOutOfStock && (
            <div className="absolute top-2 right-2 group-hover:opacity-0 transition-opacity bg-rose-600 text-white text-[9.5px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm z-10 animate-in fade-in">
              <Ban className="w-3 h-3" />
              <span>Agotado</span>
            </div>
          )}

          {/* Quick action buttons on hover (and touch accessible) */}
          <div
            className={`absolute top-2 right-2 flex items-center gap-1 z-10 transition-opacity ${
              isOutOfStock ? 'opacity-0 group-hover:opacity-100' : 'opacity-85 sm:opacity-0 group-hover:opacity-100'
            }`}
          >
            {onEditProduct && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditProduct(product);
                }}
                className="bg-white/95 hover:bg-blue-600 hover:text-white backdrop-blur-xs p-1.5 rounded-full shadow-md text-blue-600 border border-blue-200 transition-all cursor-pointer"
                title="Modificar directamente este producto"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenDetails(product);
              }}
              className="bg-white/95 hover:bg-slate-900 hover:text-white backdrop-blur-xs p-1.5 rounded-full shadow-md text-gray-700 border border-gray-200 transition-all cursor-pointer"
              title="Vista de producto (Ver más grande)"
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Product Details Section */}
        <div className="flex flex-col flex-grow justify-between mt-2.5">
          {/* Product Title */}
          <h3 
            onClick={() => onOpenDetails(product)}
            className={`font-bold text-xs sm:text-[13px] tracking-tight leading-snug uppercase text-center line-clamp-2 min-h-[34px] cursor-pointer hover:text-blue-700 transition-colors ${
              isOutOfStock ? 'text-slate-600 line-through decoration-rose-300' : 'text-slate-900'
            }`}
          >
            {product.name}
          </h3>

          {/* SKU & Barcode identifiers badge row */}
          {hasSkuOrBarcode && (
            <div className="flex items-center justify-center gap-1.5 my-1 flex-wrap text-[10px] font-mono text-gray-500">
              {product.sku && (
                <span className="bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200/60" title={`SKU: ${product.sku}`}>
                  SKU: <strong className="text-slate-700">{product.sku}</strong>
                </span>
              )}
              {product.barcode && (
                <span className="bg-blue-50/80 text-blue-800 px-1.5 py-0.5 rounded border border-blue-200/60 flex items-center gap-0.5" title={`Código de barras: ${product.barcode}`}>
                  <Barcode className="w-2.5 h-2.5" />
                  <strong>{product.barcode}</strong>
                </span>
              )}
            </div>
          )}

          {/* Promo Badge or Stock Notice */}
          {isOutOfStock ? (
            <div className="my-1.5">
              <div className="bg-rose-50 text-rose-700 text-[10px] sm:text-[10.5px] font-bold px-2 py-0.5 rounded-md text-center border border-rose-200 min-h-[26px] flex items-center justify-center gap-1">
                <Ban className="w-3 h-3" />
                <span>Sin existencias disponibles</span>
              </div>
            </div>
          ) : isLowStock ? (
            <div className="my-1.5">
              <div className="bg-amber-50 text-amber-800 text-[10px] sm:text-[10.5px] font-bold px-2 py-0.5 rounded-md text-center border border-amber-200 min-h-[26px] flex items-center justify-center gap-1">
                <AlertCircle className="w-3 h-3 text-amber-600" />
                <span>¡Últimas {product.stock} unidades!</span>
              </div>
            </div>
          ) : isPromoActive ? (
            <div className="my-1.5">
              <div className="bg-[#D8F3DC] text-[#1E7E34] text-[10.5px] sm:text-[11px] font-semibold px-2 py-1 rounded-md text-center leading-tight line-clamp-2 border border-[#B7E4C7]/60 min-h-[28px] flex items-center justify-center">
                {product.promoBadge}
              </div>
            </div>
          ) : (
            <div className="h-1.5" />
          )}

          {/* Packaging / Unit */}
          <div className="text-center text-[11px] sm:text-xs text-gray-500 font-medium mb-1">
            {product.packaging}
          </div>

          {/* Price display */}
          <div className="flex items-center justify-center gap-1.5 my-1.5 flex-wrap">
            <span className={`font-extrabold text-sm sm:text-base tracking-tight ${
              isOutOfStock ? 'text-slate-500' : 'text-[#0B5CAB]'
            }`}>
              {formatCOP(product.price)}
            </span>
            {product.originalPrice && product.originalPrice > product.price && (
              <span className="line-through text-gray-400 text-[11px] sm:text-xs font-normal">
                {formatCOP(product.originalPrice)}
              </span>
            )}
          </div>

          {/* Action Area: Locked / Agotado vs Quantity Stepper */}
          {isOutOfStock ? (
            <div className="flex items-center justify-center mt-2 pt-1 border-t border-gray-100">
              <div 
                className="w-full py-1.5 px-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-black flex items-center justify-center gap-1.5 select-none cursor-not-allowed shadow-2xs"
                title="Este producto no tiene existencias disponibles actualmente"
              >
                <Ban className="w-3.5 h-3.5" />
                <span>Producto Agotado</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-1.5 mt-2 pt-1 border-t border-gray-100">
              <button
                id={`btn-minus-${product.id}`}
                type="button"
                onClick={() => onUpdateQuantity(product.id, -1)}
                disabled={quantity <= 0}
                className="w-8 h-8 rounded-lg bg-gray-200/80 hover:bg-gray-300 active:scale-95 disabled:opacity-35 disabled:cursor-not-allowed text-gray-800 flex items-center justify-center transition-all cursor-pointer"
                aria-label="Disminuir cantidad"
                title="Restar 1 unidad"
              >
                <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
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
                className="w-10 h-8 text-center font-bold text-slate-800 text-sm bg-gray-50/80 border border-gray-200 rounded-md focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-hidden transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                aria-label={`Cantidad para ${product.name}`}
                title={quantity >= availableStock ? `Stock máximo (${availableStock} un.)` : 'Escribe la cantidad deseada'}
              />

              <button
                id={`btn-plus-${product.id}`}
                type="button"
                onClick={() => onUpdateQuantity(product.id, 1)}
                disabled={quantity >= availableStock}
                className="w-8 h-8 rounded-lg bg-black hover:bg-neutral-800 active:scale-95 disabled:opacity-35 disabled:cursor-not-allowed text-white flex items-center justify-center shadow-xs transition-all cursor-pointer"
                aria-label="Aumentar cantidad"
                title={quantity >= availableStock ? `Stock máximo alcanzado (${availableStock} un.)` : 'Sumar 1 unidad'}
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  },
  (prev, next) => {
    return (
      prev.product === next.product &&
      prev.quantity === next.quantity &&
      prev.onUpdateQuantity === next.onUpdateQuantity &&
      prev.onSetQuantity === next.onSetQuantity &&
      prev.onOpenDetails === next.onOpenDetails &&
      prev.onEditProduct === next.onEditProduct
    );
  }
);
