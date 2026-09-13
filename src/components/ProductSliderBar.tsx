import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Sparkles, ArrowRight, ArrowLeft, Sliders } from 'lucide-react';
import { Product } from '../types';
import { ProductCard } from './ProductCard';

interface ProductSliderBarProps {
  title?: string;
  subtitle?: string;
  badge?: string;
  products: Product[];
  quantityMap: Map<string, number>;
  onUpdateQuantity: (productId: string, delta: number) => void;
  onSetQuantity?: (productId: string, quantity: number) => void;
  onOpenDetails: (product: Product) => void;
  onEditProduct?: (product: Product) => void;
  onViewAll?: () => void;
}

export const ProductSliderBar: React.FC<ProductSliderBarProps> = ({
  title = 'Productos Destacados',
  subtitle,
  badge,
  products,
  quantityMap,
  onUpdateQuantity,
  onSetQuantity,
  onOpenDetails,
  onEditProduct,
  onViewAll,
}) => {
  const sliderRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [scrollProgress, setScrollProgress] = useState(0);

  // Mouse Drag to Scroll State
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeftState, setScrollLeftState] = useState(0);

  // Check scroll positions
  const checkScroll = useCallback(() => {
    const el = sliderRef.current;
    if (!el) return;

    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 5);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 5);

    const maxScroll = scrollWidth - clientWidth;
    if (maxScroll > 0) {
      setScrollProgress(Math.min(100, Math.max(0, (scrollLeft / maxScroll) * 100)));
    } else {
      setScrollProgress(0);
    }
  }, []);

  useEffect(() => {
    const el = sliderRef.current;
    if (!el) return;

    checkScroll();
    el.addEventListener('scroll', checkScroll, { passive: true });
    window.addEventListener('resize', checkScroll);

    return () => {
      el.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [products, checkScroll]);

  // Slide Left / Right handlers
  const handleScrollLeft = () => {
    const el = sliderRef.current;
    if (!el) return;
    const cardWidth = Math.max(240, el.clientWidth * 0.75);
    const targetLeft = Math.max(0, el.scrollLeft - cardWidth);
    el.scrollTo({ left: targetLeft, behavior: 'smooth' });
    setTimeout(checkScroll, 100);
  };

  const handleScrollRight = () => {
    const el = sliderRef.current;
    if (!el) return;
    const cardWidth = Math.max(240, el.clientWidth * 0.75);
    const targetLeft = Math.min(el.scrollWidth - el.clientWidth, el.scrollLeft + cardWidth);
    el.scrollTo({ left: targetLeft, behavior: 'smooth' });
    setTimeout(checkScroll, 100);
  };

  const handleSliderProgressChange = (percent: number) => {
    setScrollProgress(percent);
    const el = sliderRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    if (maxScroll > 0) {
      el.scrollLeft = (percent / 100) * maxScroll;
    }
  };

  // Drag-to-scroll handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    const el = sliderRef.current;
    if (!el) return;
    setIsDragging(true);
    setStartX(e.pageX - el.offsetLeft);
    setScrollLeftState(el.scrollLeft);
  };

  const handleMouseLeaveOrUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    const el = sliderRef.current;
    if (!el) return;
    const x = e.pageX - el.offsetLeft;
    const walk = (x - startX) * 1.5; // Scroll speed multiplier
    el.scrollLeft = scrollLeftState - walk;
  };

  if (!products || products.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-gray-200/90 p-4 sm:p-5 shadow-xs mb-6 relative overflow-hidden group/slider">
      {/* Header with Title and Left/Right Navigation Buttons */}
      <div className="flex items-center justify-between gap-3 mb-3.5 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#0B4EA2] flex items-center justify-center font-bold">
            <Sparkles className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                {title}
              </h2>
              {badge && (
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300/80 rounded-full">
                  {badge}
                </span>
              )}
            </div>
            {subtitle ? (
              <p className="text-xs text-gray-500 font-medium mt-0.5">{subtitle}</p>
            ) : (
              <p className="text-[11px] text-gray-400 font-medium">
                Desliza hacia los lados con las flechas o arrastrando con el dedo/ratón ({products.length} productos)
              </p>
            )}
          </div>
        </div>

        {/* Controls: Left and Right buttons & View all */}
        <div className="flex items-center gap-2 ml-auto">
          {onViewAll && (
            <button
              onClick={onViewAll}
              className="text-xs font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1 transition-colors px-2 py-1"
            >
              <span>Ver todos</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Left Arrow Button */}
          <button
            id="btn-slide-left"
            onClick={handleScrollLeft}
            aria-label="Deslizar a la izquierda"
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-blue-600 hover:text-white active:scale-90 text-slate-700 flex items-center justify-center transition-all shadow-2xs cursor-pointer border border-slate-200"
            title="Deslizar hacia la izquierda"
          >
            <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
          </button>

          {/* Right Arrow Button */}
          <button
            id="btn-slide-right"
            onClick={handleScrollRight}
            aria-label="Deslizar a la derecha"
            className="w-9 h-9 rounded-xl bg-[#0B4EA2] hover:bg-[#083b7c] active:scale-90 text-white flex items-center justify-center transition-all shadow-xs cursor-pointer"
            title="Deslizar hacia la derecha"
          >
            <ChevronRight className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>
      </div>

      {/* Horizontal Sliding Track Container */}
      <div className="relative group/track">
        {/* Left floating action button */}
        <button
          type="button"
          onClick={handleScrollLeft}
          className={`absolute left-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white/95 text-slate-800 hover:bg-[#0B4EA2] hover:text-white shadow-lg border border-gray-200 flex items-center justify-center transition-all cursor-pointer ${
            canScrollLeft ? 'opacity-100' : 'opacity-40 hover:opacity-100'
          }`}
          title="Deslizar a la izquierda"
        >
          <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
        </button>

        {/* Right floating action button */}
        <button
          type="button"
          onClick={handleScrollRight}
          className={`absolute right-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white/95 text-slate-800 hover:bg-[#0B4EA2] hover:text-white shadow-lg border border-gray-200 flex items-center justify-center transition-all cursor-pointer ${
            canScrollRight ? 'opacity-100' : 'opacity-40 hover:opacity-100'
          }`}
          title="Deslizar a la derecha"
        >
          <ChevronRight className="w-4 h-4 stroke-[2.5]" />
        </button>

        <div
          ref={sliderRef}
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseLeaveOrUp}
          onMouseUp={handleMouseLeaveOrUp}
          onMouseMove={handleMouseMove}
          className={`flex items-stretch gap-3 sm:gap-4 overflow-x-auto pb-3 pt-1 scroll-smooth snap-x snap-mandatory ${
            isDragging ? 'cursor-grabbing select-none' : 'cursor-grab'
          } [-webkit-overflow-scrolling:touch]`}
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: '#0B4EA2 #E2E8F0',
          }}
        >
          {products.map((product) => (
            <div
              key={product.id}
              className="w-52 sm:w-60 flex-shrink-0 snap-start flex flex-col"
            >
              <ProductCard
                product={product}
                quantity={quantityMap.get(product.id) || 0}
                onUpdateQuantity={onUpdateQuantity}
                onSetQuantity={onSetQuantity}
                onOpenDetails={onOpenDetails}
                onEditProduct={onEditProduct}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Visual Scrollbar / Interactive Slider Progress Track at Bottom */}
      <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between gap-3 text-xs text-gray-500 flex-wrap">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
          <ArrowLeft className="w-3.5 h-3.5 text-[#0B4EA2]" />
          <span>Desliza a la izquierda</span>
          <span>•</span>
          <span>Desliza a la derecha</span>
          <ArrowRight className="w-3.5 h-3.5 text-[#0B4EA2]" />
        </div>

        {/* Interactive Progress Range Slider */}
        <div className="flex items-center gap-2 flex-1 max-w-[160px] sm:max-w-[240px]">
          <span className="text-[10px] text-gray-400 font-mono">0%</span>
          <input
            type="range"
            min={0}
            max={100}
            value={scrollProgress}
            onInput={(e) => handleSliderProgressChange(Number((e.target as HTMLInputElement).value))}
            onChange={(e) => handleSliderProgressChange(Number(e.target.value))}
            className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#0B4EA2]"
            title="Deslizar carrusel hacia la izquierda o derecha"
          />
          <span className="text-[10px] text-gray-400 font-mono">100%</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleScrollLeft}
            className="p-1 rounded-md bg-slate-100 hover:bg-blue-600 hover:text-white border border-slate-200 text-slate-700 transition-all cursor-pointer"
            title="Deslizar izquierda"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleScrollRight}
            className="p-1 rounded-md bg-[#0B4EA2] hover:bg-[#083b7c] text-white transition-all cursor-pointer"
            title="Deslizar derecha"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10.5px] font-bold text-slate-600 font-mono ml-1">
            {products.length} {products.length === 1 ? 'artículo' : 'artículos'}
          </span>
        </div>
      </div>
    </div>
  );
};
