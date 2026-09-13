import React from 'react';
import { ShoppingBag, ChevronRight } from 'lucide-react';

interface BottomStickyCartBarProps {
  totalItems: number;
  totalPrice: number;
  originalTotalPrice: number;
  onOpenCart: () => void;
}

export const BottomStickyCartBar: React.FC<BottomStickyCartBarProps> = ({
  totalItems,
  totalPrice,
  originalTotalPrice,
  onOpenCart,
}) => {
  // Format Colombian Peso
  const formatCOP = (val: number) => {
    return `$${val.toLocaleString('es-CO')}`;
  };

  const savings = Math.max(0, originalTotalPrice - totalPrice);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#0B4EA2] text-white shadow-[0_-4px_20px_rgba(11,78,162,0.25)] border-t border-blue-900/40">
      <div 
        id="btn-bottom-ver-carrito"
        onClick={onOpenCart}
        className="max-w-4xl mx-auto px-4 py-3.5 flex items-center justify-between cursor-pointer select-none active:bg-[#093e82] transition-colors"
      >
        {/* Left: Badge with total item count (matching "(121)" in screenshot) */}
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full border-2 border-white/90 flex items-center justify-center font-bold text-xs sm:text-sm tracking-tight bg-white/10 backdrop-blur-xs">
            {totalItems}
          </div>
        </div>

        {/* Center: VER CARRITO */}
        <div className="flex items-center gap-1.5 font-black text-sm sm:text-base uppercase tracking-wider text-center">
          <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
          <span>VER CARRITO</span>
          <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
        </div>

        {/* Right: Total Price + Strikethrough Original Price (matching "$279,100 / $285,100" in screenshot) */}
        <div className="text-right flex flex-col items-end leading-tight">
          <span className="font-black text-base sm:text-lg tracking-tight">
            {formatCOP(totalPrice)}
          </span>
          {originalTotalPrice > totalPrice ? (
            <span className="text-[11px] sm:text-xs text-blue-200/90 line-through font-medium">
              {formatCOP(originalTotalPrice)}
            </span>
          ) : (
            <span className="text-[10px] text-blue-200/80 uppercase font-medium">
              COP
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
