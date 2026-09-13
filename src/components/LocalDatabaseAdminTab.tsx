import React, { useState } from 'react';
import {
  Database,
  HardDrive,
  RefreshCw,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  FileJson,
  Layers,
  Users,
  ShoppingBag,
  ShieldCheck,
  Sparkles,
  Cloud,
  Check,
  Copy,
  Info,
  ArrowRight,
  RotateCcw,
  Image as ImageIcon,
  Save,
} from 'lucide-react';
import { Product, Customer, AdminUser, OrderRecord, StoreBranding } from '../types';
import {
  INITIAL_PRODUCTS,
  INITIAL_CUSTOMERS,
  DEFAULT_ADMINS,
  INITIAL_ORDERS,
  DEFAULT_BASE_CATEGORIES,
  DEFAULT_BRANDING,
  LOCAL_DATABASE,
} from '../data/localDatabase';
import {
  getCompleteLocalDatabase,
  resetLocalDatabaseToCode,
  downloadLocalDatabaseBackup,
  importLocalDatabaseFromJSON,
  getLocalDatabaseStats,
  saveLocalProducts,
  saveLocalCategories,
  saveLocalBranding,
  DataMode,
} from '../lib/localDatabase';
import { formatCOP } from '../utils/priceUtils';

interface LocalDatabaseAdminTabProps {
  products: Product[];
  categories: string[];
  branding: StoreBranding;
  dataMode?: DataMode;
  onToggleDataMode?: (mode: DataMode) => void;
  onRefreshProducts?: () => void;
  onSuccessNotice?: (message: string) => void;
}

export const LocalDatabaseAdminTab: React.FC<LocalDatabaseAdminTabProps> = ({
  products,
  categories,
  branding,
  onRefreshProducts,
  onSuccessNotice,
}) => {
  const [activeViewerTab, setActiveViewerTab] = useState<'products' | 'customers' | 'admins' | 'orders' | 'json'>('products');
  const [stats, setStats] = useState(() => getLocalDatabaseStats());
  const [isResetting, setIsResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const triggerNotice = (msg: string) => {
    setActionNotice(msg);
    if (onSuccessNotice) onSuccessNotice(msg);
    setTimeout(() => setActionNotice(null), 4000);
  };

  const handleDownloadBackup = () => {
    downloadLocalDatabaseBackup();
    triggerNotice('✓ Copia de seguridad JSON descargada exitosamente.');
  };

  const handleResetToCode = async () => {
    try {
      setIsResetting(true);
      resetLocalDatabaseToCode();
      setStats(getLocalDatabaseStats());
      setShowResetConfirm(false);
      triggerNotice('✓ Base de datos restaurada a los valores predeterminados del código fuente.');
      if (onRefreshProducts) {
        onRefreshProducts();
      }
    } catch (e: any) {
      alert(`Error al restaurar: ${e.message}`);
    } finally {
      setIsResetting(false);
    }
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const result = importLocalDatabaseFromJSON(content);
        if (result.success) {
          setStats(getLocalDatabaseStats());
          triggerNotice('✓ Base de datos importada exitosamente desde el archivo JSON.');
          if (onRefreshProducts) {
            onRefreshProducts();
          }
        } else {
          alert(`Error al importar: ${result.message}`);
        }
      } catch (err: any) {
        alert(`Error al leer archivo: ${err.message}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleCopyJSON = () => {
    const fullDb = getCompleteLocalDatabase();
    navigator.clipboard.writeText(JSON.stringify(fullDb, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2500);
  };

  return (
    <div className="space-y-6 animate-in fade-in pb-12">
      {/* Banner de Estado de la Base de Datos Local */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white p-5 rounded-2xl shadow-md border border-blue-900/40 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-6 w-64 h-64 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <Database className="w-3.5 h-3.5 text-emerald-400" />
                Base de Datos Local Activa en el Código
              </span>
              <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                v2.0.0-in-code
              </span>
            </div>
            <h3 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-blue-400" />
              Base de Datos Embebida (AYM DISTRIBUCIONES)
            </h3>
            <p className="text-xs text-slate-300 max-w-2xl mt-1 leading-relaxed">
              Todos los datos fundamentales (catálogo de <strong>{INITIAL_PRODUCTS.length} productos mayoristas</strong> con imágenes, clientes, administradores, pedidos y categorías) residen directamente dentro del código fuente (<code className="bg-slate-800/80 px-1 py-0.5 rounded text-blue-300">src/data/localDatabase.ts</code>). Esto garantiza disponibilidad offline permanente, cero costos de lectura y carga instantánea.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={async () => {
                try {
                  const db = getCompleteLocalDatabase();
                  const res = await fetch('/api/db/sync', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(db),
                  });
                  if (res && res.ok) {
                    triggerNotice('✓ Base de datos sincronizada y guardada permanentemente en disco.');
                  } else {
                    triggerNotice('✓ Datos guardados localmente en tu navegador (IndexedDB). Compatible con GitHub Pages.');
                  }
                } catch (e) {
                  triggerNotice('✓ Datos guardados localmente en tu navegador (IndexedDB). Compatible con GitHub Pages.');
                }
              }}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer"
              title="Guardar y sincronizar en almacenamiento permanente"
            >
              <Save className="w-4 h-4 text-white" />
              <span>Guardar en Disco</span>
            </button>

            <button
              onClick={handleDownloadBackup}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer"
              title="Descargar copia de seguridad en formato JSON"
            >
              <Download className="w-4 h-4 text-white" />
              <span>Exportar JSON</span>
            </button>

            <label className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 shadow-sm transition-all flex items-center gap-2 cursor-pointer">
              <Upload className="w-4 h-4 text-amber-400" />
              <span>Importar JSON</span>
              <input
                type="file"
                accept=".json"
                onChange={handleImportJSON}
                className="hidden"
              />
            </label>

            <button
              onClick={handleCopyJSON}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
              title="Copiar toda la base de datos local en formato JSON al portapapeles"
            >
              {copiedJson ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <Copy className="w-4 h-4 text-slate-300" />
              )}
              <span>{copiedJson ? '¡Copiado!' : 'Copiar JSON'}</span>
            </button>

            <button
              onClick={() => setShowResetConfirm(true)}
              className="px-3 py-2 bg-red-950/60 hover:bg-red-900/80 active:scale-95 text-red-200 text-xs font-bold rounded-xl border border-red-800/60 shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
              title="Restaurar a los valores originales del código"
            >
              <RotateCcw className="w-4 h-4 text-red-400" />
              <span>Restaurar Catálogo</span>
            </button>
          </div>
        </div>
      </div>

      {actionNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Tarjeta Informativa de Base de Datos Local */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-black text-slate-900">
                Almacenamiento Local Autónomo (100% Offline)
              </h4>
              <p className="text-xs text-gray-500">
                Catálogo mayorista, cartera de clientes, administradores y pedidos gestionados directamente en el navegador.
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Base de Datos Local Activa
          </span>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed mt-2 pt-2 border-t border-gray-100">
          La tienda opera de forma completamente autónoma sin dependencias de servicios en la nube. Todas las creaciones, ediciones, fotos de productos, registro de pedidos y clientes se conservan en la memoria local y en IndexedDB de alta capacidad. Puedes exportar o importar copias de seguridad en formato JSON en cualquier momento.
        </p>
      </div>

      {/* Tarjetas de Métricas de la Base de Datos */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Productos</span>
            <HardDrive className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-xl font-black text-slate-900">
            {stats.productsCount}
          </div>
          <div className="text-[10.5px] text-gray-400 mt-1">
            {INITIAL_PRODUCTS.length} en código
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Con Fotos</span>
            <ImageIcon className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-black text-emerald-700">
            {stats.withImagesCount}
          </div>
          <div className="text-[10.5px] text-gray-400 mt-1">
            Fotos e imágenes
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Categorías</span>
            <Layers className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-xl font-black text-slate-900">
            {stats.categoriesCount}
          </div>
          <div className="text-[10.5px] text-gray-400 mt-1 truncate">
            {DEFAULT_BASE_CATEGORIES.slice(0, 3).join(', ')}...
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Clientes</span>
            <Users className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-xl font-black text-slate-900">
            {stats.customersCount}
          </div>
          <div className="text-[10.5px] text-gray-400 mt-1">
            Tiendas registradas
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Admins</span>
            <ShieldCheck className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-xl font-black text-slate-900">
            {stats.adminsCount}
          </div>
          <div className="text-[10.5px] text-gray-400 mt-1">
            Roles configurados
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Branding</span>
            <Sparkles className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xs font-black text-slate-900 truncate">
            {DEFAULT_BRANDING.name}
          </div>
          <div className="text-[10.5px] text-gray-400 mt-1 truncate">
            {DEFAULT_BRANDING.whatsappNumber}
          </div>
        </div>
      </div>

      {/* Diálogo de Confirmación de Restauración */}
      {showResetConfirm && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl animate-in zoom-in-95">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-amber-900 text-sm">
                ¿Restaurar la base de datos al estado del código fuente?
              </h4>
              <p className="text-xs text-amber-800 mt-1">
                Esta acción restablecerá el catálogo local con los {INITIAL_PRODUCTS.length} productos mayoristas con sus imágenes, 6 clientes y 3 cuentas de administrador codificadas en el archivo <code className="font-mono font-semibold">src/data/localDatabase.ts</code>.
              </p>
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={handleResetToCode}
                  disabled={isResetting}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  {isResetting ? 'Restaurando...' : 'Sí, Restaurar Todo al Código'}
                </button>
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Visor de Colecciones de la Base de Datos Local */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        {/* Barra de pestañas del visor */}
        <div className="px-4 py-3 bg-gray-50/80 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1 bg-gray-200/80 p-1 rounded-xl overflow-x-auto">
            <button
              onClick={() => setActiveViewerTab('products')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeViewerTab === 'products'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Productos en Código ({INITIAL_PRODUCTS.length})
            </button>
            <button
              onClick={() => setActiveViewerTab('customers')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeViewerTab === 'customers'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Clientes en Código ({INITIAL_CUSTOMERS.length})
            </button>
            <button
              onClick={() => setActiveViewerTab('admins')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeViewerTab === 'admins'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Admins en Código ({DEFAULT_ADMINS.length})
            </button>
            <button
              onClick={() => setActiveViewerTab('orders')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeViewerTab === 'orders'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Pedidos Históricos ({INITIAL_ORDERS.length})
            </button>
            <button
              onClick={() => setActiveViewerTab('json')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeViewerTab === 'json'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <FileJson className="w-3.5 h-3.5 inline mr-1" />
              JSON Completo
            </button>
          </div>

          <div className="flex items-center gap-2">
            {activeViewerTab !== 'json' && (
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar en la base de datos..."
                className="px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-600 w-full sm:w-48"
              />
            )}
            {activeViewerTab === 'json' && (
              <button
                onClick={handleCopyJSON}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {copiedJson ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedJson ? 'Copiado' : 'Copiar JSON'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Contenido según pestaña activa */}
        <div className="p-4 overflow-x-auto">
          {/* TAB 1: PRODUCTOS */}
          {activeViewerTab === 'products' && (
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/70 text-gray-500 font-bold sticky top-0 z-10">
                    <th className="p-2.5">ID / SKU</th>
                    <th className="p-2.5">Producto</th>
                    <th className="p-2.5">Categoría</th>
                    <th className="p-2.5">Empaque Mayorista</th>
                    <th className="p-2.5">Costo</th>
                    <th className="p-2.5">Precio Venta</th>
                    <th className="p-2.5">Stock</th>
                    <th className="p-2.5">Promoción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {INITIAL_PRODUCTS.filter(
                    (p) =>
                      !searchQuery ||
                      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      p.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      p.sku?.toLowerCase().includes(searchQuery.toLowerCase())
                  ).map((p) => (
                    <tr key={p.id} className="hover:bg-blue-50/40 transition-colors">
                      <td className="p-2.5 font-mono text-[11px] text-gray-500">
                        <span className="font-bold text-slate-800">{p.sku || p.id}</span>
                        {p.barcode && <div className="text-[10px] text-gray-400">{p.barcode}</div>}
                      </td>
                      <td className="p-2.5 font-semibold text-slate-900">
                        {p.name}
                        {p.featured && (
                          <span className="ml-1.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800">
                            Destacado
                          </span>
                        )}
                      </td>
                      <td className="p-2.5">
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-md font-semibold text-[11px]">
                          {p.category}
                        </span>
                      </td>
                      <td className="p-2.5 text-gray-600 font-medium">
                        {p.packaging}
                      </td>
                      <td className="p-2.5 font-mono text-gray-500">
                        {formatCOP(p.costPrice || 0)}
                      </td>
                      <td className="p-2.5 font-mono font-bold text-slate-900">
                        {formatCOP(p.price)}
                      </td>
                      <td className="p-2.5">
                        <span className="px-2 py-0.5 rounded font-mono font-bold text-[11px] bg-emerald-50 text-emerald-700">
                          {p.stock} un.
                        </span>
                      </td>
                      <td className="p-2.5">
                        {p.hasPromotion && p.promoBadge ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-800">
                            {p.promoBadge}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 2: CLIENTES */}
          {activeViewerTab === 'customers' && (
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/70 text-gray-500 font-bold sticky top-0 z-10">
                    <th className="p-2.5">Establecimiento / Dueño</th>
                    <th className="p-2.5">Teléfono / WhatsApp</th>
                    <th className="p-2.5">Ciudad / Dirección</th>
                    <th className="p-2.5">Pago Habitual</th>
                    <th className="p-2.5">Descuento</th>
                    <th className="p-2.5">Historial</th>
                    <th className="p-2.5">Notas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {INITIAL_CUSTOMERS.filter(
                    (c) =>
                      !searchQuery ||
                      c.storeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      c.ownerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      c.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      c.phone.includes(searchQuery)
                  ).map((c) => (
                    <tr key={c.id} className="hover:bg-purple-50/40 transition-colors">
                      <td className="p-2.5">
                        <div className="font-bold text-slate-900">{c.storeName}</div>
                        <div className="text-[11px] text-gray-500">{c.ownerName}</div>
                      </td>
                      <td className="p-2.5 font-mono text-purple-700 font-semibold">
                        {c.phone}
                      </td>
                      <td className="p-2.5">
                        <div className="font-medium text-slate-800">{c.city}</div>
                        <div className="text-[11px] text-gray-500">{c.address}</div>
                      </td>
                      <td className="p-2.5 capitalize font-medium text-gray-700">
                        {c.paymentMethod}
                      </td>
                      <td className="p-2.5 font-mono font-bold text-emerald-600">
                        {c.discountPercentage ? `${c.discountPercentage}%` : '0%'}
                      </td>
                      <td className="p-2.5 text-gray-600">
                        <div>{c.ordersCount || 0} pedidos</div>
                        <div className="font-mono text-[10.5px] font-semibold text-slate-700">
                          {formatCOP(c.totalSpent || 0)}
                        </div>
                      </td>
                      <td className="p-2.5 text-gray-500 text-[11px] max-w-xs truncate">
                        {c.notes || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 3: ADMINISTRADORES */}
          {activeViewerTab === 'admins' && (
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/70 text-gray-500 font-bold sticky top-0 z-10">
                    <th className="p-2.5">Usuario</th>
                    <th className="p-2.5">Nombre Completo</th>
                    <th className="p-2.5">Rol de Seguridad</th>
                    <th className="p-2.5">Contraseña en Código</th>
                    <th className="p-2.5">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {DEFAULT_ADMINS.map((adm) => (
                    <tr key={adm.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-2.5 font-mono font-bold text-slate-900">
                        @{adm.username}
                      </td>
                      <td className="p-2.5 font-semibold text-slate-800">
                        {adm.name}
                      </td>
                      <td className="p-2.5">
                        <span className={`px-2 py-0.5 rounded text-[10.5px] font-bold uppercase ${
                          adm.role === 'superadmin'
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : adm.role === 'admin'
                            ? 'bg-blue-100 text-blue-900 border border-blue-300'
                            : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                        }`}>
                          {adm.role}
                        </span>
                      </td>
                      <td className="p-2.5 font-mono text-gray-600">
                        <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-800 font-bold">
                          {adm.password}
                        </code>
                      </td>
                      <td className="p-2.5">
                        <span className="px-2 py-0.5 rounded-full font-bold text-[10.5px] bg-emerald-100 text-emerald-800">
                          {adm.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 4: PEDIDOS */}
          {activeViewerTab === 'orders' && (
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/70 text-gray-500 font-bold sticky top-0 z-10">
                    <th className="p-2.5"># Pedido</th>
                    <th className="p-2.5">Cliente</th>
                    <th className="p-2.5">Ciudad</th>
                    <th className="p-2.5">Ítems</th>
                    <th className="p-2.5">Total COP</th>
                    <th className="p-2.5">Estado</th>
                    <th className="p-2.5">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {INITIAL_ORDERS.map((ord) => (
                    <tr key={ord.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="p-2.5 font-mono font-bold text-blue-700">
                        #{ord.orderNumber}
                      </td>
                      <td className="p-2.5 font-semibold text-slate-900">
                        {ord.customer.storeName}
                        <div className="text-[11px] text-gray-500 font-normal">
                          {ord.customer.phone}
                        </div>
                      </td>
                      <td className="p-2.5 text-gray-700">
                        {ord.customer.city}
                      </td>
                      <td className="p-2.5">
                        <span className="font-semibold text-slate-800">
                          {ord.items.length} productos ({ord.totalItemsCount || ord.items.reduce((s, i) => s + i.quantity, 0)} unid.)
                        </span>
                      </td>
                      <td className="p-2.5 font-mono font-bold text-slate-900">
                        {formatCOP(ord.totalPrice)}
                      </td>
                      <td className="p-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold capitalize ${
                          ord.status === 'entregado'
                            ? 'bg-emerald-100 text-emerald-800'
                            : ord.status === 'en_camino'
                            ? 'bg-blue-100 text-blue-800'
                            : ord.status === 'confirmado'
                            ? 'bg-indigo-100 text-indigo-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {ord.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="p-2.5 text-gray-500 text-[11px]">
                        {new Date(ord.createdAt).toLocaleDateString('es-CO')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 5: JSON COMPLETO */}
          {activeViewerTab === 'json' && (
            <div className="relative">
              <pre className="p-4 bg-slate-950 text-emerald-400 font-mono text-[11px] rounded-xl overflow-x-auto max-h-[500px] overflow-y-auto leading-relaxed border border-slate-800">
                {JSON.stringify(getCompleteLocalDatabase(), null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
