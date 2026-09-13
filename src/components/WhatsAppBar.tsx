import React, { useState } from 'react';
import { X, Lock, MoreVertical, Store, RefreshCw, ShieldCheck, Share2, Sliders, ShoppingCart } from 'lucide-react';

interface WhatsAppBarProps {
  totalItemsCount?: number;
  onOpenCart?: () => void;
  onResetOrder?: () => void;
  onOpenAdmin?: () => void;
  whatsappNumber?: string;
}

export const WhatsAppBar: React.FC<WhatsAppBarProps> = ({ 
  totalItemsCount = 0,
  onOpenCart,
  onResetOrder, 
  onOpenAdmin,
  whatsappNumber = '3113986110'
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);

  return (
    <div className="bg-white border-b border-gray-200 select-none text-slate-800 relative z-30">
      {/* Browser / Webview simulation bar matching screenshot */}
      <div className="flex items-center justify-between px-3 py-1.5 max-w-4xl mx-auto">
        <button 
          onClick={() => setShowInfoModal(true)}
          className="p-1 hover:bg-gray-100 rounded-full transition-colors text-gray-700 cursor-pointer"
          title="Cerrar vista"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center cursor-pointer" onClick={() => setShowInfoModal(true)}>
          <span className="font-semibold text-xs tracking-tight text-gray-900">
            WhatsApp
          </span>
          <div className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-700">
            <Lock className="w-2.5 h-2.5 text-emerald-600 inline" />
            <span className="truncate max-w-[200px]">aym-districuciones.com</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Admin button directly to the left of the 3 dots */}
          {onOpenAdmin && (
            <button
              id="btn-whatsapp-admin"
              onClick={onOpenAdmin}
              className="p-1.5 hover:bg-gray-100 active:scale-95 rounded-full transition-all text-slate-800 relative cursor-pointer flex items-center justify-center"
              aria-label="Administrar catálogo"
              title="Panel de Administración"
            >
              <Sliders className="w-5 h-5 stroke-[2.2]" />
            </button>
          )}

          <div className="relative">
            <button 
              id="btn-whatsapp-more-options"
              onClick={() => setShowMenu(!showMenu)}
              className="p-1.5 hover:bg-gray-100 active:scale-95 rounded-full transition-colors text-gray-700 cursor-pointer"
              title="Más opciones"
              aria-label="Más opciones"
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {/* Menu dropdown */}
            {showMenu && (
              <div className="absolute right-0 mt-1 w-52 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
                {onOpenCart && (
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onOpenCart();
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-center justify-between text-[#0B4EA2] font-bold border-b border-gray-100 cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="w-4 h-4 text-blue-600" />
                      <span>Ver Carrito</span>
                    </div>
                    {totalItemsCount > 0 && (
                      <span className="bg-[#0B4EA2] text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                        {totalItemsCount}
                      </span>
                    )}
                  </button>
                )}
                {onOpenAdmin && (
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onOpenAdmin();
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-center gap-2 text-[#0B4EA2] font-bold border-b border-gray-100 cursor-pointer"
                  >
                    <Sliders className="w-4 h-4 text-blue-600" />
                    Administrar Catálogo
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowMenu(false);
                    setShowInfoModal(true);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2 text-gray-700 cursor-pointer"
                >
                  <Store className="w-4 h-4 text-gray-500" />
                  Información de tienda
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    if (onResetOrder) onResetOrder();
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2 text-red-600 cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  Vaciar carrito
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    if (navigator.share) {
                      navigator.share({
                        title: 'AYM Distribuciones - Catálogo Mayorista',
                        url: 'https://aym-distribuciones.verse.app',
                      }).catch(() => {});
                    }
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2 text-gray-700 cursor-pointer"
                >
                  <Share2 className="w-4 h-4 text-gray-500" />
                  Compartir catálogo
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Info modal */}
      {showInfoModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl border border-gray-100 animate-in zoom-in-95">
            <div className="flex items-center gap-2.5 text-emerald-700 mb-3">
              <ShieldCheck className="w-6 h-6 text-emerald-600" />
              <h4 className="font-bold text-slate-900 text-base">Conexión Verificada</h4>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed mb-4">
              Estás conectado a la plataforma de pedidos oficial de <strong>AYM Distribuciones</strong> (<strong>aym-distribuciones.verse.app</strong>). Los precios y promociones están actualizados para tiendas y autoservicios.
            </p>
            <div className="bg-gray-50 p-2.5 rounded-lg text-[11px] text-gray-600 space-y-1 mb-4">
              <div>🌐 <strong>Sitio Web:</strong> aym-distribuciones.verse.app</div>
              <div>📍 <strong>Cobertura:</strong> Colombia (Nacional)</div>
              <div>🚚 <strong>Despachos:</strong> 24 a 48 horas hábiles</div>
              <div>💬 <strong>Pedidos WhatsApp:</strong> {whatsappNumber}</div>
            </div>
            <button
              onClick={() => setShowInfoModal(false)}
              className="w-full py-2.5 bg-slate-900 hover:bg-black text-white font-semibold rounded-xl text-xs transition-colors"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
