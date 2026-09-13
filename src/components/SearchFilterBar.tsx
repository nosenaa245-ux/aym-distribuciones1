import React, { useRef, useState, useEffect } from 'react';
import { Search, X, Sparkles, SlidersHorizontal, ChevronLeft, ChevronRight } from 'lucide-react';
import { CATEGORIES } from '../data/products';

interface SearchFilterBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  isSearchOpen: boolean;
  onCloseSearch?: () => void;
  sortBy: string;
  onSortChange: (sort: string) => void;
  onlyPromos: boolean;
  onToggleOnlyPromos: () => void;
  totalResults: number;
  categories?: string[];
}

export const SearchFilterBar: React.FC<SearchFilterBarProps> = ({
  searchQuery,
  onSearchChange,
  selectedCategory,
  onSelectCategory,
  isSearchOpen,
  onCloseSearch,
  sortBy,
  onSortChange,
  onlyPromos,
  onToggleOnlyPromos,
  totalResults,
  categories = CATEGORIES,
}) => {
  const displayCategories = categories && categories.length > 0 ? categories : CATEGORIES;
  const categoriesRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  // Auto-focus search input whenever search opens or is triggered
  useEffect(() => {
    if (isSearchOpen) {
      const focusInput = () => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
          searchInputRef.current.select();
        }
      };

      // Immediate attempt
      focusInput();

      // Double-check with a short timeout to account for animations and DOM rendering
      const timer = setTimeout(focusInput, 30);
      return () => clearTimeout(timer);
    }
  }, [isSearchOpen]);

  const checkCategoryScroll = () => {
    const el = categoriesRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 5);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 5);
  };

  useEffect(() => {
    const el = categoriesRef.current;
    if (!el) return;
    checkCategoryScroll();
    el.addEventListener('scroll', checkCategoryScroll, { passive: true });
    window.addEventListener('resize', checkCategoryScroll);
    return () => {
      el.removeEventListener('scroll', checkCategoryScroll);
      window.removeEventListener('resize', checkCategoryScroll);
    };
  }, [displayCategories]);

  const slideCategories = (direction: 'left' | 'right') => {
    const el = categoriesRef.current;
    if (!el) return;
    const scrollAmount = 240;
    el.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  return (
    <div className="bg-white pt-2 pb-1 border-b border-gray-100/80 sticky top-14 z-20 shadow-2xs">
      <div className="max-w-4xl mx-auto px-4 space-y-2.5">
        {/* Search Bar Input (collapsible or permanent when search is toggled) */}
        {isSearchOpen && (
          <div className="relative animate-in slide-in-from-top-2 duration-150">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              ref={searchInputRef}
              id="input-catalog-search"
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'F10' || e.code === 'F10' || e.keyCode === 121) {
                  e.preventDefault();
                  e.stopPropagation();
                  e.currentTarget.select();
                } else if (e.key === 'Escape') {
                  if (searchQuery) {
                    onSearchChange('');
                  } else if (onCloseSearch) {
                    onCloseSearch();
                  }
                }
              }}
              placeholder="Buscar por producto, marca, código... (F10)"
              className="w-full pl-10 pr-20 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all text-slate-800 shadow-2xs font-medium"
              autoFocus
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  className="text-gray-400 hover:text-gray-600 p-0.5 cursor-pointer"
                  title="Limpiar búsqueda"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <span
                className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-bold text-gray-500 bg-gray-200/80 border border-gray-300/80 rounded select-none shadow-2xs"
                title="Atajo de teclado: F10"
              >
                F10
              </span>
            </div>
          </div>
        )}

        {/* Category horizontal scroll bar with Left and Right slide buttons */}
        <div className="relative flex items-center group/catbar">
          {/* Left Arrow Button */}
          {canScrollLeft && (
            <button
              onClick={() => slideCategories('left')}
              className="absolute left-0 z-10 w-7 h-7 rounded-full bg-white/95 shadow-md border border-gray-200 text-slate-700 hover:text-blue-600 hover:bg-white flex items-center justify-center -translate-x-1 sm:translate-x-0 transition-all cursor-pointer"
              title="Deslizar categorías a la izquierda"
              aria-label="Deslizar categorías a la izquierda"
            >
              <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
            </button>
          )}

          <div
            ref={categoriesRef}
            className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-none no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 scroll-smooth w-full"
          >
            {displayCategories.map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => onSelectCategory(cat)}
                  className={`whitespace-nowrap px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 flex-shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-slate-900 text-white shadow-xs scale-[1.02]'
                      : 'bg-gray-100/90 text-gray-600 hover:bg-gray-200/80 hover:text-gray-900'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          {/* Right Arrow Button */}
          {canScrollRight && (
            <button
              onClick={() => slideCategories('right')}
              className="absolute right-0 z-10 w-7 h-7 rounded-full bg-white/95 shadow-md border border-gray-200 text-slate-700 hover:text-blue-600 hover:bg-white flex items-center justify-center translate-x-1 sm:translate-x-0 transition-all cursor-pointer"
              title="Deslizar categorías a la derecha"
              aria-label="Deslizar categorías a la derecha"
            >
              <ChevronRight className="w-4 h-4 stroke-[2.5]" />
            </button>
          )}
        </div>

        {/* Secondary Sub-filters / Sorting Bar */}
        <div className="flex items-center justify-between text-xs text-gray-500 pt-0.5 pb-1 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-700">
              {totalResults} {totalResults === 1 ? 'producto' : 'productos'}
            </span>
            {searchQuery && (
              <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[11px] font-medium">
                "{searchQuery}"
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Promo only toggle */}
            <button
              onClick={onToggleOnlyPromos}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                onlyPromos
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
              }`}
            >
              <Sparkles className="w-3 h-3 text-emerald-600" />
              Solo Promos
            </button>

            {/* Sort selector */}
            <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1">
              <SlidersHorizontal className="w-3 h-3 text-gray-400" />
              <select
                id="select-catalog-sort"
                value={sortBy}
                onChange={(e) => onSortChange(e.target.value)}
                className="bg-transparent text-[11px] font-medium text-gray-700 focus:outline-hidden cursor-pointer"
              >
                <option value="featured">Destacados</option>
                <option value="discount">Mayor descuento</option>
                <option value="price-asc">Menor precio</option>
                <option value="price-desc">Mayor precio</option>
                <option value="name">Nombre A-Z</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
