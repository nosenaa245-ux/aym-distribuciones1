import React, { useState } from 'react';
import { ArrowLeft, Search, ShoppingCart, Store, UserPlus, X } from 'lucide-react';
import { StoreBranding, Customer } from '../types';

interface TopHeaderProps {
  totalItemsCount?: number;
  onOpenCart?: () => void;
  onToggleSearch: () => void;
  isSearchOpen: boolean;
  onResetView?: () => void;
  onOpenAdmin?: () => void;
  branding?: StoreBranding;
  activeCustomer?: Customer | null;
  onOpenCustomerModal?: () => void;
  onClearCustomer?: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  totalItemsCount,
  onOpenCart,
  onToggleSearch,
  isSearchOpen,
  onResetView,
  onOpenAdmin,
  branding,
  activeCustomer,
  onOpenCustomerModal,
  onClearCustomer,
}) => {
  const [imageError, setImageError] = useState(false);

  const storeName = branding?.name || 'AYM DISTRIBUCIONES';
  const detectedHost = typeof window !== 'undefined' && window.location.host ? window.location.host : '';
  const storeSubtitle =
    branding?.subtitle && branding.subtitle !== 'aym-distribuciones.verse.app'
      ? branding.subtitle
      : (detectedHost || 'Catálogo Mayorista');
  const hasLogo = Boolean(branding?.logoUrl && !imageError);

  return (
    <header className="bg-white sticky top-0 z-20 border-b border-gray-100 shadow-xs">
      <div className="max-w-4xl mx-auto px-4 py-2.5 sm:py-3 flex items-center justify-between">
        {/* Left Back Arrow */}
        <button
          id="btn-header-back"
          onClick={onResetView}
          className="p-1.5 -ml-1 text-slate-800 hover:bg-gray-100 active:scale-95 rounded-full transition-all cursor-pointer"
          aria-label="Volver atrás"
          title="Volver al inicio"
        >
          <ArrowLeft className="w-6 h-6 stroke-[2.2]" />
        </button>

        {/* Center Brand: Logo Image or Typography */}
        <div 
          onClick={onResetView}
          className="cursor-pointer select-none flex flex-col items-center justify-center max-w-[200px] sm:max-w-[300px] text-center"
        >
          {hasLogo ? (
            <div className="flex flex-col items-center">
              <img
                src={branding!.logoUrl}
                alt={storeName}
                onError={() => setImageError(true)}
                className="max-h-9 sm:max-h-11 max-w-[180px] sm:max-w-[240px] w-auto object-contain transition-transform hover:scale-102"
                referrerPolicy="no-referrer"
              />
              {storeSubtitle && (
                <span className="text-[8.5px] sm:text-[9.5px] font-semibold text-gray-400 tracking-wider hidden sm:block mt-0.5 truncate max-w-[200px]">
                  {storeSubtitle}
                </span>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center">
              <div className="flex items-center gap-1.5">
                <span className="font-black text-2xl sm:text-3xl tracking-tight text-[#0B4EA2] font-sans uppercase">
                  {storeName.split(' ')[0] || 'AYM'}
                </span>
                <span className="bg-[#0B4EA2] text-white text-[10px] sm:text-xs font-extrabold px-1.5 py-0.5 rounded tracking-wide uppercase">
                  {storeName.split(' ').slice(1).join(' ') || 'Distribuciones'}
                </span>
              </div>
              {storeSubtitle && (
                <span className="text-[9px] font-semibold text-gray-400 tracking-wider hidden sm:block">
                  {storeSubtitle}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right Action Icons */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Customer / Store WhatsApp Identification Button */}
          {onOpenCustomerModal && (
            <div
              className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold flex items-center gap-1 transition-all border ${
                activeCustomer
                  ? 'bg-emerald-50 text-emerald-950 border-emerald-400 shadow-2xs ring-1 ring-emerald-400/40 animate-in fade-in'
                  : 'bg-slate-100 text-slate-700 border-slate-200/90 hover:bg-slate-200/80 hover:border-slate-300 shadow-none'
              }`}
            >
              <button
                id="btn-header-customer"
                onClick={onOpenCustomerModal}
                className="flex items-center gap-1 cursor-pointer focus:outline-hidden"
                title={
                  activeCustomer
                    ? `Cliente identificado: ${activeCustomer.storeName}. Clic para cambiar o ver detalles.`
                    : 'Agregar o identificar cliente / negocio'
                }
              >
                {activeCustomer ? (
                  <>
                    <span className="relative flex h-1.5 w-1.5 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                    </span>
                    <Store className="w-3 h-3 text-emerald-600 shrink-0" />
                    <span className="truncate max-w-[55px] sm:max-w-[85px] font-bold text-emerald-900 leading-none">
                      {activeCustomer.storeName}
                    </span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-3 h-3 text-slate-500 shrink-0" />
                    <span className="hidden sm:inline">Cliente</span>
                    <span className="sm:hidden">+</span>
                  </>
                )}
              </button>

              {/* Quick Remove Customer Cross Button */}
              {activeCustomer && onClearCustomer && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClearCustomer();
                  }}
                  className="p-0.5 text-emerald-700 hover:text-rose-700 hover:bg-rose-100 rounded-full transition-colors cursor-pointer"
                  title="Quitar cliente (Me equivoqué)"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          )}

          {/* Shopping Cart Button */}
          {onOpenCart && (
            <button
              id="btn-header-cart"
              onClick={onOpenCart}
              className="p-1.5 rounded-full text-slate-800 hover:text-[#0B4EA2] hover:bg-blue-50 active:scale-95 transition-all relative cursor-pointer flex items-center justify-center"
              aria-label="Ver carrito de compras"
              title="Ver carrito de compras"
            >
              <ShoppingCart className="w-5 h-5 stroke-[2.2]" />
              {typeof totalItemsCount === 'number' && totalItemsCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#0B4EA2] text-white text-[9.5px] font-black px-1 py-0.2 rounded-full min-w-[17px] h-[17px] flex items-center justify-center shadow-xs">
                  {totalItemsCount > 99 ? '99+' : totalItemsCount}
                </span>
              )}
            </button>
          )}

          {/* Search Toggle Button */}
          <button
            id="btn-toggle-search"
            onClick={onToggleSearch}
            className={`p-1.5 sm:px-2 sm:py-1 rounded-full text-slate-800 hover:bg-gray-100 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 ${
              isSearchOpen ? 'bg-blue-50 text-blue-600 ring-1 ring-blue-300' : ''
            }`}
            aria-label="Buscar productos (F10)"
            title="Buscar productos (Presiona F10 para entrar a la barra de búsqueda)"
          >
            <Search className="w-5 h-5 stroke-[2.2]" />
            <span className="hidden sm:inline-flex items-center text-[10px] font-mono font-bold text-slate-600 bg-gray-100/90 hover:bg-gray-200 px-1.5 py-0.5 rounded-md border border-gray-300/80 shadow-2xs">
              F10
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};

