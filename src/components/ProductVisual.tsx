import React from 'react';

interface ProductVisualProps {
  type: string;
  name: string;
  className?: string;
}

export const ProductVisual: React.FC<ProductVisualProps> = ({ type, name, className = '' }) => {
  const [imageError, setImageError] = React.useState(false);

  React.useEffect(() => {
    setImageError(false);
  }, [type]);

  const renderFallback = () => (
    <div className={`w-22 h-28 bg-gradient-to-br from-slate-100 to-slate-200 border border-slate-300/80 rounded-xl flex flex-col items-center justify-center p-2 text-center text-slate-600 shadow-2xs ${className}`}>
      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-black text-xs mb-1">
        {(name || 'P').charAt(0).toUpperCase()}
      </div>
      <span className="text-[10px] font-bold uppercase leading-tight line-clamp-2 text-slate-700">
        {(name || 'Producto').slice(0, 18)}
      </span>
      <span className="text-[8px] text-slate-400 font-semibold mt-0.5">Glux! Pack</span>
    </div>
  );

  switch (type) {
    case 'bilac':
      return (
        <div className={`relative flex items-center justify-center ${className}`}>
          {/* Bilac Chocolate Pouch representation matching screenshot */}
          <div className="w-24 h-32 bg-gradient-to-b from-yellow-300 via-amber-200 to-amber-900 rounded-lg shadow-sm border border-yellow-400/40 p-1.5 flex flex-col justify-between items-center text-center overflow-hidden relative">
            {/* Top badges */}
            <div className="w-full flex justify-between items-start">
              <span className="bg-red-600 text-[8px] font-black text-white px-1 py-0.5 rounded leading-none">
                12 <br/><span className="text-[6px]">unidades</span>
              </span>
              <div className="flex flex-col gap-0.5">
                <span className="bg-black text-[5px] text-white px-1 py-0.2 rounded font-bold">
                  EXCESO EN AZÚCARES
                </span>
                <span className="bg-black text-[5px] text-white px-1 py-0.2 rounded font-bold">
                  MINSALUD
                </span>
              </div>
            </div>

            {/* Brand */}
            <div className="my-auto">
              <span className="text-blue-700 font-extrabold text-lg tracking-tight block drop-shadow-sm italic">
                Bilac
              </span>
              <span className="bg-amber-400 text-amber-950 text-[7px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider block -mt-0.5">
                NUTRIMAX
              </span>
              <span className="text-yellow-100 font-black text-[10px] tracking-wide block uppercase mt-1 drop-shadow">
                CHOCOLATE
              </span>
            </div>

            {/* Chocolate splash base */}
            <div className="w-full bg-gradient-to-t from-amber-950 to-amber-900 text-amber-100 text-[7px] font-semibold py-0.5 rounded-b">
              180 ml x 12
            </div>
          </div>
        </div>
      );

    case 'tostao-intenso':
      return (
        <div className={`relative flex items-center justify-center ${className}`}>
          {/* Tostao Intenso pouch - Black with red lower section */}
          <div className="w-24 h-32 bg-[#1A1A1A] rounded-lg shadow-sm border border-neutral-800 p-1.5 flex flex-col justify-between items-center text-center overflow-hidden relative">
            {/* Stamp */}
            <div className="text-[6px] text-neutral-400 tracking-tighter uppercase font-medium leading-tight mt-0.5">
              HECHO POR EXPERTOS<br/>EN TOSTADO COLOMBIA
            </div>

            {/* Logo */}
            <div className="my-auto">
              <span className="text-amber-400 font-black text-base tracking-tighter block">
                TOSTAO'
              </span>
              <span className="text-[6px] text-white tracking-widest block uppercase font-light">
                CAFÉ TOSTADO Y MOLIDO
              </span>
            </div>

            {/* Red band with coffee cup */}
            <div className="w-full bg-gradient-to-r from-red-700 via-red-600 to-red-700 py-1.5 px-1 rounded-b text-center relative">
              <span className="text-white font-black text-[9px] uppercase tracking-wider block">
                SELECTO
              </span>
              <span className="text-red-200 text-[6px] font-bold block uppercase -mt-0.5">
                - INTENSO -
              </span>
              <div className="w-4 h-3 bg-neutral-900 border border-neutral-700 rounded-full mx-auto mt-0.5 flex items-center justify-center">
                <div className="w-2.5 h-1.5 bg-amber-950 rounded-full" />
              </div>
              <span className="text-[6px] text-neutral-300 absolute bottom-0.5 right-1 font-bold">
                40 g
              </span>
            </div>
          </div>
        </div>
      );

    case 'tostao-suave':
      return (
        <div className={`relative flex items-center justify-center ${className}`}>
          {/* Tostao Amarillo / Selecto pouch - Black with gold/amber lower section */}
          <div className="w-24 h-32 bg-[#1A1A1A] rounded-lg shadow-sm border border-neutral-800 p-1.5 flex flex-col justify-between items-center text-center overflow-hidden relative">
            <div className="text-[6px] text-neutral-400 tracking-tighter uppercase font-medium leading-tight mt-0.5">
              CAFÉ DE ORIGEN<br/>COLOMBIANO
            </div>

            <div className="my-auto">
              <span className="text-amber-400 font-black text-base tracking-tighter block">
                TOSTAO'
              </span>
              <span className="text-[6px] text-white tracking-widest block uppercase font-light">
                CAFÉ TOSTADO Y MOLIDO
              </span>
            </div>

            {/* Gold/Amber band */}
            <div className="w-full bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600 py-1.5 px-1 rounded-b text-center relative">
              <span className="text-neutral-950 font-black text-[9px] uppercase tracking-wider block">
                SELECTO
              </span>
              <span className="text-neutral-900 text-[6px] font-bold block uppercase -mt-0.5">
                TRADICIONAL
              </span>
              <div className="w-4 h-3 bg-neutral-900 border border-neutral-700 rounded-full mx-auto mt-0.5 flex items-center justify-center">
                <div className="w-2.5 h-1.5 bg-amber-950 rounded-full" />
              </div>
              <span className="text-[6px] text-neutral-900 absolute bottom-0.5 right-1 font-bold">
                40 g
              </span>
            </div>
          </div>
        </div>
      );

    case 'speedmax':
      return (
        <div className={`relative flex items-center justify-center ${className}`}>
          {/* Speed Max 310 ml can - Neon yellow cylinder */}
          <div className="w-14 h-32 bg-gradient-to-r from-yellow-300 via-lime-400 to-yellow-500 rounded-lg shadow-sm border border-lime-600/30 p-1 flex flex-col justify-between items-center text-center overflow-hidden relative">
            {/* Can Top rim */}
            <div className="w-10 h-2 bg-neutral-300 rounded-t-md border-b border-neutral-400" />

            {/* Warning stamps */}
            <div className="flex gap-0.5">
              <div className="bg-black text-[4px] text-white px-0.5 rounded font-bold">AZÚCAR</div>
              <div className="bg-black text-[4px] text-white px-0.5 rounded font-bold">SODIO</div>
            </div>

            {/* Vertical SPEED MAX text */}
            <div className="my-auto rotate-[-90deg] whitespace-nowrap">
              <span className="text-black font-black text-sm tracking-tight block">
                SPEED <span className="text-red-600 font-extrabold">MAX</span>
              </span>
            </div>

            {/* Bottom info */}
            <div className="text-[6px] font-bold text-neutral-900 bg-yellow-400/80 px-1 rounded">
              310 ml
            </div>
            {/* Can bottom rim */}
            <div className="w-10 h-1.5 bg-neutral-400 rounded-b-md" />
          </div>
        </div>
      );

    case 'festival':
      return (
        <div className={`relative flex items-center justify-center ${className}`}>
          <div className="w-24 h-30 bg-gradient-to-br from-blue-600 to-indigo-800 rounded-lg shadow-sm p-2 flex flex-col justify-between items-center text-white border border-blue-400/30">
            <span className="text-[8px] bg-red-600 text-white font-black px-1.5 rounded">NOEL</span>
            <div className="text-center my-auto">
              <span className="text-yellow-300 font-black text-sm block italic drop-shadow">Festival</span>
              <span className="text-[8px] font-bold text-amber-200">CHOCOLATE</span>
            </div>
            <div className="text-[8px] font-bold bg-blue-950/70 px-2 py-0.5 rounded-full">Pack x 12</div>
          </div>
        </div>
      );

    case 'aceite-premier':
      return (
        <div className={`relative flex items-center justify-center ${className}`}>
          <div className="w-16 h-32 bg-gradient-to-b from-amber-200 via-yellow-400 to-amber-500 rounded-xl shadow-sm p-1.5 flex flex-col justify-between items-center text-amber-950 border border-yellow-500">
            <div className="w-5 h-3 bg-red-600 rounded-t" />
            <div className="text-center my-auto">
              <span className="text-[7px] text-green-900 font-bold block">100% PURO</span>
              <span className="text-red-700 font-black text-xs block">PREMIER</span>
              <span className="text-[7px] font-semibold block text-neutral-800">Girasol</span>
            </div>
            <span className="text-[8px] font-black bg-amber-600 text-white px-1.5 rounded">1000 ml</span>
          </div>
        </div>
      );

    case 'arroz-diana':
      return (
        <div className={`relative flex items-center justify-center ${className}`}>
          <div className="w-22 h-30 bg-white rounded-lg shadow-sm border border-neutral-200 p-2 flex flex-col justify-between items-center text-center">
            <div className="w-full bg-red-600 text-white text-[8px] font-black py-0.5 rounded-t">
              DIANA
            </div>
            <div className="my-auto">
              <span className="text-red-600 font-black text-xs block">ARROZ</span>
              <span className="text-blue-800 font-bold text-[8px] block">PREMIUM</span>
              <span className="text-[6px] text-neutral-500 block">Grano Entero</span>
            </div>
            <span className="text-[8px] font-bold bg-neutral-100 text-neutral-800 px-1.5 rounded">1000 g</span>
          </div>
        </div>
      );

    case 'atun-vancamps':
      return (
        <div className={`relative flex items-center justify-center ${className}`}>
          <div className="w-22 h-24 bg-gradient-to-b from-yellow-400 via-amber-300 to-yellow-500 rounded-xl shadow-sm border border-yellow-600/30 p-2 flex flex-col justify-between items-center text-neutral-900">
            <div className="w-full bg-blue-900 text-white text-[7px] font-black py-0.5 rounded text-center">
              VAN CAMP'S
            </div>
            <div className="text-center my-auto">
              <span className="text-blue-950 font-black text-[10px] block">LOMITOS DE ATÚN</span>
              <span className="text-[7px] text-amber-950 font-bold">En Aceite</span>
            </div>
            <span className="text-[8px] font-bold bg-neutral-900 text-white px-1.5 rounded">160 g</span>
          </div>
        </div>
      );

    case 'jet':
      return (
        <div className={`relative flex items-center justify-center ${className}`}>
          <div className="w-24 h-26 bg-gradient-to-r from-blue-700 via-blue-600 to-blue-800 rounded-lg shadow-sm p-2 flex flex-col justify-between items-center text-white border border-blue-400">
            <span className="text-[8px] font-black text-yellow-300">COMPAÑÍA NACIONAL</span>
            <div className="text-center my-auto">
              <span className="text-yellow-300 font-black text-base italic block tracking-wider drop-shadow">JET</span>
              <span className="text-[7px] text-blue-100 font-bold">Chocolatina de Leche</span>
            </div>
            <span className="text-[8px] font-bold bg-amber-400 text-amber-950 px-2 py-0.5 rounded-full font-black">Caja x 50</span>
          </div>
        </div>
      );

    case 'fab-detergente':
      return (
        <div className={`relative flex items-center justify-center ${className}`}>
          <div className="w-18 h-30 bg-gradient-to-b from-purple-500 via-purple-600 to-indigo-700 rounded-2xl shadow-sm p-1.5 flex flex-col justify-between items-center text-white border border-purple-300">
            <div className="w-4 h-3 bg-red-500 rounded-t" />
            <div className="text-center my-auto">
              <span className="text-yellow-300 font-black text-xs block drop-shadow">FAB</span>
              <span className="text-[7px] font-bold text-pink-100">Lavado Perfecto</span>
            </div>
            <span className="text-[8px] font-bold bg-purple-900 text-purple-100 px-1.5 rounded">3000 ml</span>
          </div>
        </div>
      );

    case 'cocacola':
      return (
        <div className={`relative flex items-center justify-center ${className}`}>
          <div className="w-14 h-32 bg-gradient-to-b from-red-600 via-red-700 to-red-800 rounded-xl shadow-sm p-1 flex flex-col justify-between items-center text-white border border-red-400">
            <div className="w-4 h-2 bg-red-900 rounded-t" />
            <div className="text-center my-auto rotate-[-90deg] whitespace-nowrap">
              <span className="text-white font-black text-xs italic tracking-wider">Coca-Cola</span>
            </div>
            <span className="text-[7px] font-bold bg-black/40 text-white px-1 rounded">400 ml</span>
          </div>
        </div>
      );

    case 'alqueria':
      return (
        <div className={`relative flex items-center justify-center ${className}`}>
          <div className="w-20 h-30 bg-white rounded-lg shadow-sm border border-red-300 p-1.5 flex flex-col justify-between items-center text-center">
            <div className="w-full bg-red-600 text-white text-[8px] font-black py-0.5 rounded">
              Alquería
            </div>
            <div className="my-auto">
              <span className="text-red-700 font-black text-xs block">LECHE</span>
              <span className="text-blue-900 font-bold text-[8px] block">ENTERA</span>
            </div>
            <span className="text-[8px] font-bold bg-neutral-100 text-neutral-800 px-1 rounded">1100 ml</span>
          </div>
        </div>
      );

    default:
      if (!imageError && type && (type.startsWith('http://') || type.startsWith('https://') || type.startsWith('data:image/') || type.startsWith('blob:'))) {
        return (
          <div className={`relative flex items-center justify-center overflow-hidden w-full h-full ${className}`}>
            <img
              src={type}
              alt={name}
              className="max-h-full max-w-full w-auto h-auto object-contain rounded-md drop-shadow-xs"
              referrerPolicy="no-referrer"
              onError={() => {
                setImageError(true);
              }}
            />
          </div>
        );
      }
      return renderFallback();
  }
};
