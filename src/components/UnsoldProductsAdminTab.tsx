import React, { useState, useEffect, useMemo, useDeferredValue } from 'react';
import {
  TrendingDown,
  Calendar,
  DollarSign,
  PackageX,
  PackageCheck,
  AlertTriangle,
  FileSpreadsheet,
  Copy,
  Check,
  Search,
  Filter,
  ArrowUpDown,
  RefreshCw,
  Tag,
  Sparkles,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
  Info,
  Clock,
  Layers,
  Barcode,
  ShoppingBag,
  Percent,
  CheckCircle2,
  Printer
} from 'lucide-react';
import { Product, OrderRecord, OrderStatus } from '../types';
import { subscribeToOrders } from '../lib/localDatabase';
import { exportUnsoldProductsReportToExcel } from '../utils/excelUtils';

interface UnsoldProductsAdminTabProps {
  products: Product[];
  categories: string[];
  onEditProduct?: (product: Product) => void;
}

const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

export const UnsoldProductsAdminTab: React.FC<UnsoldProductsAdminTabProps> = ({
  products,
  categories,
  onEditProduct,
}) => {
  // Stable reference for initial date to prevent perpetual recalculations on every render
  const now = useMemo(() => new Date(), []);
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentTimestamp = now.getTime();

  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth); // 0 - 11
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loadingOrders, setLoadingOrders] = useState<boolean>(true);

  // Filters & State
  const [activeSubTab, setActiveSubTab] = useState<'unsold' | 'low_rotation' | 'sold' | 'categories'>('unsold');
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearch = useDeferredValue(searchQuery);

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [excludeCancelled, setExcludeCancelled] = useState<boolean>(true);
  const [lowRotationThreshold, setLowRotationThreshold] = useState<number>(3);
  const [sortBy, setSortBy] = useState<'capital_desc' | 'stock_desc' | 'price_desc' | 'price_asc' | 'name_asc' | 'days_desc'>('capital_desc');
  const [copiedNotice, setCopiedNotice] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Reset page when any filter or tab changes
  useEffect(() => {
    setCurrentPage(1);
  }, [deferredSearch, selectedCategory, sortBy, activeSubTab, selectedMonth, selectedYear, lowRotationThreshold]);

  // Fetch orders from local database
  useEffect(() => {
    const unsubscribe = subscribeToOrders(
      (data) => {
        setOrders(data);
        setLoadingOrders(false);
      },
      (err) => {
        console.error('Error loading orders in UnsoldProductsAdminTab:', err);
        setLoadingOrders(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Format currency
  const formatCOP = (val: number) => `$${Math.round(val).toLocaleString('es-CO')} COP`;

  // Pre-parse and normalize orders into high-speed index structures
  const parsedOrders = useMemo(() => {
    const list: Array<{
      id: string;
      orderNumber: string;
      status: string;
      date: Date;
      time: number;
      year: number;
      month: number;
      items: Array<{
        productId: string;
        quantity: number;
        price: number;
        costPrice: number;
      }>;
    }> = [];

    for (let i = 0; i < orders.length; i++) {
      const ord = orders[i];
      if (!ord || !ord.createdAt) continue;
      if (excludeCancelled && ord.status === 'cancelado') continue;

      const date = new Date(ord.createdAt);
      const time = date.getTime();
      if (isNaN(time)) continue;

      const items: Array<{
        productId: string;
        quantity: number;
        price: number;
        costPrice: number;
      }> = [];

      if (ord.items && ord.items.length > 0) {
        for (let j = 0; j < ord.items.length; j++) {
          const it = ord.items[j];
          if (!it || !it.product || !it.product.id) continue;
          const returnedQty = it.returnedQuantity || 0;
          const activeQty = Math.max(0, (it.quantity || 0) - returnedQty);
          if (activeQty <= 0) continue;

          items.push({
            productId: it.product.id,
            quantity: activeQty,
            price: it.product.price || 0,
            costPrice: it.product.costPrice || Math.round((it.product.price || 0) * 0.75),
          });
        }
      }

      list.push({
        id: ord.id,
        orderNumber: ord.orderNumber,
        status: ord.status,
        date,
        time,
        year: date.getFullYear(),
        month: date.getMonth(),
        items,
      });
    }

    return list;
  }, [orders, excludeCancelled]);

  // Determine available years from pre-parsed orders (fast & stable)
  const availableYears = useMemo(() => {
    const yearSet = new Set<number>();
    yearSet.add(currentYear);
    yearSet.add(currentYear - 1);
    for (let i = 0; i < parsedOrders.length; i++) {
      yearSet.add(parsedOrders[i].year);
    }
    return Array.from(yearSet).sort((a, b) => b - a);
  }, [parsedOrders, currentYear]);

  // Fast pre-calculated map of historical last sale across all orders
  const historicalLastSaleMap = useMemo(() => {
    const map = new Map<string, { date: Date; time: number; orderNumber: string }>();
    for (let i = 0; i < parsedOrders.length; i++) {
      const ord = parsedOrders[i];
      for (let j = 0; j < ord.items.length; j++) {
        const it = ord.items[j];
        const existing = map.get(it.productId);
        if (!existing || ord.time > existing.time) {
          map.set(it.productId, {
            date: ord.date,
            time: ord.time,
            orderNumber: ord.orderNumber,
          });
        }
      }
    }
    return map;
  }, [parsedOrders]);

  // Calculate monthly stats in a single fast pass
  const analysis = useMemo(() => {
    // 1. Filter orders matching selected year & month (instant integer comparison)
    const monthlyOrders: typeof parsedOrders = [];
    for (let i = 0; i < parsedOrders.length; i++) {
      const ord = parsedOrders[i];
      if (ord.year === selectedYear && ord.month === selectedMonth) {
        monthlyOrders.push(ord);
      }
    }

    // 2. Aggregate monthly sales by product
    const monthlyProductSalesMap = new Map<
      string,
      {
        unitsSold: number;
        revenue: number;
        cost: number;
        ordersCount: number;
        lastSaleDateInMonth?: Date;
      }
    >();

    let totalMonthRevenue = 0;
    let totalUnitsSoldInMonth = 0;

    for (let i = 0; i < monthlyOrders.length; i++) {
      const ord = monthlyOrders[i];
      for (let j = 0; j < ord.items.length; j++) {
        const it = ord.items[j];
        const revenue = it.price * it.quantity;
        const cost = it.costPrice * it.quantity;

        totalMonthRevenue += revenue;
        totalUnitsSoldInMonth += it.quantity;

        let existing = monthlyProductSalesMap.get(it.productId);
        if (!existing) {
          existing = {
            unitsSold: 0,
            revenue: 0,
            cost: 0,
            ordersCount: 0,
          };
          monthlyProductSalesMap.set(it.productId, existing);
        }

        existing.unitsSold += it.quantity;
        existing.revenue += revenue;
        existing.cost += cost;
        existing.ordersCount += 1;
        if (!existing.lastSaleDateInMonth || ord.date > existing.lastSaleDateInMonth) {
          existing.lastSaleDateInMonth = ord.date;
        }
      }
    }

    // 3. Classify all products in catalog
    const unsoldList: Array<{
      product: Product;
      stock: number;
      costPrice: number;
      price: number;
      immobilizedCost: number;
      immobilizedRetail: number;
      historicalLastSale?: { date: Date; orderNumber: string };
      daysSinceLastSale: number | null;
    }> = [];

    const lowRotationList: Array<{
      product: Product;
      stock: number;
      unitsSold: number;
      revenue: number;
      costPrice: number;
      price: number;
      immobilizedCost: number;
      historicalLastSale?: { date: Date; orderNumber: string };
    }> = [];

    const soldList: Array<{
      product: Product;
      stock: number;
      unitsSold: number;
      revenue: number;
      costPrice: number;
      price: number;
      ordersCount: number;
      lastSaleDateInMonth?: Date;
    }> = [];

    const categoryStatsMap = new Map<
      string,
      {
        totalProducts: number;
        unsoldCount: number;
        soldCount: number;
        unsoldCapitalCost: number;
        unitsSold: number;
        revenue: number;
      }
    >();

    for (let i = 0; i < products.length; i++) {
      const prod = products[i];
      const sales = monthlyProductSalesMap.get(prod.id);
      const stock = prod.stock ?? 0;
      const costPrice = prod.costPrice ?? Math.round((prod.price || 0) * 0.75);
      const price = prod.price || 0;
      const immobilizedCost = stock * costPrice;
      const immobilizedRetail = stock * price;

      const histSale = historicalLastSaleMap.get(prod.id);
      let daysSinceLastSale: number | null = null;
      if (histSale) {
        const diffMs = currentTimestamp - histSale.time;
        daysSinceLastSale = Math.max(0, Math.floor(diffMs / 86400000));
      }

      const cat = prod.category || 'Sin Categoría';
      let catStat = categoryStatsMap.get(cat);
      if (!catStat) {
        catStat = {
          totalProducts: 0,
          unsoldCount: 0,
          soldCount: 0,
          unsoldCapitalCost: 0,
          unitsSold: 0,
          revenue: 0,
        };
        categoryStatsMap.set(cat, catStat);
      }
      catStat.totalProducts += 1;

      if (!sales || sales.unitsSold === 0) {
        catStat.unsoldCount += 1;
        catStat.unsoldCapitalCost += immobilizedCost;

        unsoldList.push({
          product: prod,
          stock,
          costPrice,
          price,
          immobilizedCost,
          immobilizedRetail,
          historicalLastSale: histSale ? { date: histSale.date, orderNumber: histSale.orderNumber } : undefined,
          daysSinceLastSale,
        });
      } else {
        catStat.soldCount += 1;
        catStat.unitsSold += sales.unitsSold;
        catStat.revenue += sales.revenue;

        soldList.push({
          product: prod,
          stock,
          unitsSold: sales.unitsSold,
          revenue: sales.revenue,
          costPrice,
          price,
          ordersCount: sales.ordersCount,
          lastSaleDateInMonth: sales.lastSaleDateInMonth,
        });

        if (sales.unitsSold <= lowRotationThreshold) {
          lowRotationList.push({
            product: prod,
            stock,
            unitsSold: sales.unitsSold,
            revenue: sales.revenue,
            costPrice,
            price,
            immobilizedCost,
            historicalLastSale: histSale ? { date: histSale.date, orderNumber: histSale.orderNumber } : undefined,
          });
        }
      }
    }

    let totalImmobilizedCost = 0;
    let totalImmobilizedRetail = 0;
    let totalUnsoldStockUnits = 0;

    for (let i = 0; i < unsoldList.length; i++) {
      totalImmobilizedCost += unsoldList[i].immobilizedCost;
      totalImmobilizedRetail += unsoldList[i].immobilizedRetail;
      totalUnsoldStockUnits += unsoldList[i].stock;
    }

    const catalogRotationRate =
      products.length > 0 ? Math.round((soldList.length / products.length) * 100) : 0;

    return {
      monthlyOrdersCount: monthlyOrders.length,
      totalMonthRevenue,
      totalUnitsSoldInMonth,
      unsoldList,
      lowRotationList,
      soldList,
      categoryStats: Array.from(categoryStatsMap.entries()).map(([cat, stat]) => ({
        category: cat,
        ...stat,
      })),
      totalImmobilizedCost,
      totalImmobilizedRetail,
      totalUnsoldStockUnits,
      catalogRotationRate,
    };
  }, [
    products,
    parsedOrders,
    selectedYear,
    selectedMonth,
    lowRotationThreshold,
    historicalLastSaleMap,
    currentTimestamp,
  ]);

  // Filtering & Sorting for Unsold list (using fast deferredSearch)
  const filteredUnsoldList = useMemo(() => {
    let list = analysis.unsoldList;

    if (deferredSearch.trim()) {
      const q = deferredSearch.toLowerCase().trim();
      list = list.filter(
        (i) =>
          i.product.name.toLowerCase().includes(q) ||
          i.product.category.toLowerCase().includes(q) ||
          (i.product.sku && i.product.sku.toLowerCase().includes(q)) ||
          (i.product.barcode && i.product.barcode.toLowerCase().includes(q))
      );
    }

    if (selectedCategory !== 'all') {
      list = list.filter((i) => i.product.category === selectedCategory);
    }

    const sorted = [...list];
    sorted.sort((a, b) => {
      switch (sortBy) {
        case 'capital_desc':
          return b.immobilizedCost - a.immobilizedCost;
        case 'stock_desc':
          return b.stock - a.stock;
        case 'price_desc':
          return b.price - a.price;
        case 'price_asc':
          return a.price - b.price;
        case 'name_asc':
          return a.product.name.localeCompare(b.product.name);
        case 'days_desc':
          return (b.daysSinceLastSale ?? 9999) - (a.daysSinceLastSale ?? 9999);
        default:
          return 0;
      }
    });

    return sorted;
  }, [analysis.unsoldList, deferredSearch, selectedCategory, sortBy]);

  // Filtered Low Rotation list
  const filteredLowRotationList = useMemo(() => {
    let list = analysis.lowRotationList;

    if (deferredSearch.trim()) {
      const q = deferredSearch.toLowerCase().trim();
      list = list.filter(
        (i) =>
          i.product.name.toLowerCase().includes(q) ||
          i.product.category.toLowerCase().includes(q) ||
          (i.product.sku && i.product.sku.toLowerCase().includes(q)) ||
          (i.product.barcode && i.product.barcode.toLowerCase().includes(q))
      );
    }

    if (selectedCategory !== 'all') {
      list = list.filter((i) => i.product.category === selectedCategory);
    }

    return list;
  }, [analysis.lowRotationList, deferredSearch, selectedCategory]);

  // Filtered Sold list
  const filteredSoldList = useMemo(() => {
    let list = analysis.soldList;

    if (deferredSearch.trim()) {
      const q = deferredSearch.toLowerCase().trim();
      list = list.filter(
        (i) =>
          i.product.name.toLowerCase().includes(q) ||
          i.product.category.toLowerCase().includes(q) ||
          (i.product.sku && i.product.sku.toLowerCase().includes(q)) ||
          (i.product.barcode && i.product.barcode.toLowerCase().includes(q))
      );
    }

    if (selectedCategory !== 'all') {
      list = list.filter((i) => i.product.category === selectedCategory);
    }

    const sorted = [...list];
    sorted.sort((a, b) => b.unitsSold - a.unitsSold);
    return sorted;
  }, [analysis.soldList, deferredSearch, selectedCategory]);

  // Pre-calculated total capital for filtered unsold list (instant)
  const filteredUnsoldCapitalCost = useMemo(() => {
    let sum = 0;
    for (let i = 0; i < filteredUnsoldList.length; i++) {
      sum += filteredUnsoldList[i].immobilizedCost;
    }
    return sum;
  }, [filteredUnsoldList]);

  // Sliced lists for high-speed DOM rendering
  const paginatedUnsoldList = useMemo(() => {
    if (pageSize >= 9999) return filteredUnsoldList;
    const start = (currentPage - 1) * pageSize;
    return filteredUnsoldList.slice(start, start + pageSize);
  }, [filteredUnsoldList, currentPage, pageSize]);

  const paginatedLowRotationList = useMemo(() => {
    if (pageSize >= 9999) return filteredLowRotationList;
    const start = (currentPage - 1) * pageSize;
    return filteredLowRotationList.slice(start, start + pageSize);
  }, [filteredLowRotationList, currentPage, pageSize]);

  const paginatedSoldList = useMemo(() => {
    if (pageSize >= 9999) return filteredSoldList;
    const start = (currentPage - 1) * pageSize;
    return filteredSoldList.slice(start, start + pageSize);
  }, [filteredSoldList, currentPage, pageSize]);

  // Render pagination bar
  const renderPagination = (totalItems: number) => {
    if (totalItems <= 0) return null;
    const totalPages = pageSize >= 9999 ? 1 : Math.max(1, Math.ceil(totalItems / pageSize));
    const startItem = (currentPage - 1) * pageSize + 1;
    const endItem = Math.min(currentPage * pageSize, totalItems);

    return (
      <div className="p-3 bg-slate-50/90 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="text-gray-600 font-medium">
          Mostrando <span className="font-bold text-slate-900">{startItem}</span> -{' '}
          <span className="font-bold text-slate-900">{endItem}</span> de{' '}
          <span className="font-bold text-slate-900">{totalItems}</span> referencias
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-gray-500">
            <span>Por pág:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-white border border-gray-300 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 focus:outline-hidden"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={9999}>Todos</option>
            </select>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                title="Primera página"
              >
                <ChevronsLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                title="Página anterior"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <span className="px-2 font-bold text-slate-800 text-xs">
                {currentPage} / {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                title="Página siguiente"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                title="Última página"
              >
                <ChevronsRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Quick Preset Handlers
  const handleSetCurrentMonth = () => {
    setSelectedYear(currentYear);
    setSelectedMonth(currentMonth);
  };

  const handleSetPreviousMonth = () => {
    if (currentMonth === 0) {
      setSelectedYear(currentYear - 1);
      setSelectedMonth(11);
    } else {
      setSelectedYear(currentYear);
      setSelectedMonth(currentMonth - 1);
    }
  };

  // Export Excel Handler
  const handleExportExcel = async () => {
    try {
      setIsExporting(true);
      const monthLabel = `${MONTH_NAMES[selectedMonth]} ${selectedYear}`;
      await exportUnsoldProductsReportToExcel({
        monthLabel,
        selectedYear,
        selectedMonth: selectedMonth + 1,
        unsoldProducts: analysis.unsoldList,
        lowRotationProducts: analysis.lowRotationList,
        soldProducts: analysis.soldList,
        categoryStats: analysis.categoryStats,
        kpis: {
          totalCatalog: products.length,
          unsoldCount: analysis.unsoldList.length,
          soldCount: analysis.soldList.length,
          rotationRate: analysis.catalogRotationRate,
          totalImmobilizedCost: analysis.totalImmobilizedCost,
          totalImmobilizedRetail: analysis.totalImmobilizedRetail,
          totalUnsoldStockUnits: analysis.totalUnsoldStockUnits,
          totalMonthRevenue: analysis.totalMonthRevenue,
          totalOrdersCount: analysis.monthlyOrdersCount,
        },
      });
    } catch (e) {
      console.error('Error exporting unsold products report:', e);
      alert('Hubo un inconveniente al generar el archivo Excel.');
    } finally {
      setIsExporting(false);
    }
  };

  // Copy Summary to Clipboard for WhatsApp / Management
  const handleCopyWhatsAppSummary = () => {
    const monthLabel = `${MONTH_NAMES[selectedMonth]} ${selectedYear}`;
    const topUnsold = analysis.unsoldList.slice(0, 10);

    let text = `📊 *REPORTE MENSUAL DE PRODUCTOS SIN VENTA*\n`;
    text += `📅 *Período:* ${monthLabel}\n`;
    text += `🏢 *AYM Distribuciones Mayoristas*\n\n`;
    text += `🔴 *Productos sin rotación:* ${analysis.unsoldList.length} de ${products.length} (${Math.round((analysis.unsoldList.length / (products.length || 1)) * 100)}% del catálogo)\n`;
    text += `💰 *Capital inmovilizado al costo:* ${formatCOP(analysis.totalImmobilizedCost)}\n`;
    text += `📦 *Unidades estancadas en bodega:* ${analysis.totalUnsoldStockUnits.toLocaleString()} unid.\n`;
    text += `🟢 *Tasa de rotación del mes:* ${analysis.catalogRotationRate}% (${analysis.soldList.length} productos con ventas)\n\n`;

    if (topUnsold.length > 0) {
      text += `*⚠️ TOP PRODUCTOS ESTANCADOS (Mayor Capital Inmovilizado):*\n`;
      topUnsold.forEach((item, idx) => {
        text += `${idx + 1}. *${item.product.name}*\n`;
        text += `   • Stock: ${item.stock} unid. | Cat: ${item.product.category}\n`;
        text += `   • Valor inmovilizado: ${formatCOP(item.immobilizedCost)}\n`;
        if (item.daysSinceLastSale !== null) {
          text += `   • Última venta hace: ${item.daysSinceLastSale} días\n`;
        } else {
          text += `   • Sin ventas históricas registradas\n`;
        }
      });
    }

    text += `\n💡 *Recomendación comercial:* Aplicar descuentos de liquidación, combos 'Pague 1 Lleve 2' o destacarlos en la portada de la tienda.`;

    navigator.clipboard.writeText(text);
    setCopiedNotice(true);
    setTimeout(() => setCopiedNotice(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* 1. TOP HEADER & MONTH/YEAR SELECTOR */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-5 shadow-lg border border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 bg-rose-500/20 text-rose-300 rounded-lg border border-rose-500/30">
                <TrendingDown className="w-4 h-4" />
              </span>
              <span className="text-xs font-bold text-rose-400 tracking-wider uppercase">
                Auditoría de Inventario & Rotación
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              Reporte Mensual de Productos Sin Venta
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl">
              Identifica oportunamente qué referencias no han tenido pedidos en el mes seleccionado,
              mide el capital inmovilizado y toma decisiones comerciales para reactivar su rotación.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleCopyWhatsAppSummary}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition-all active:scale-95 shadow-xs"
              title="Copiar informe estructurado para enviar por WhatsApp"
            >
              {copiedNotice ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">¡Copiado al portapapeles!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-300" />
                  <span>Copiar para WhatsApp</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition-all active:scale-95 cursor-pointer"
              title="Imprimir vista de reporte de rotación e inventario"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Reporte</span>
            </button>

            <button
              onClick={handleExportExcel}
              disabled={isExporting}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition-all active:scale-95"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>{isExporting ? 'Generando Excel...' : 'Descargar Reporte Excel'}</span>
            </button>
          </div>
        </div>

        {/* Month, Year & Date Range Bar */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-slate-800/90 px-3 py-1.5 rounded-xl border border-slate-700">
              <Calendar className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-semibold text-slate-300">Mes:</span>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="bg-slate-900 text-white text-xs font-bold rounded-lg px-2 py-1 border border-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                {MONTH_NAMES.map((m, idx) => (
                  <option key={m} value={idx}>
                    {m}
                  </option>
                ))}
              </select>

              <span className="text-xs font-semibold text-slate-300 ml-1">Año:</span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="bg-slate-900 text-white text-xs font-bold rounded-lg px-2 py-1 border border-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                {availableYears.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            {/* Quick Presets */}
            <button
              onClick={handleSetCurrentMonth}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedMonth === currentMonth && selectedYear === currentYear
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Mes Actual ({MONTH_NAMES[currentMonth]})
            </button>
            <button
              onClick={handleSetPreviousMonth}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition-all"
            >
              Mes Anterior
            </button>
          </div>

          {/* Toggle: Exclude Cancelled Orders */}
          <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-300 bg-slate-800/60 px-3 py-1.5 rounded-xl border border-slate-700/60 hover:bg-slate-800">
            <input
              type="checkbox"
              checked={excludeCancelled}
              onChange={(e) => setExcludeCancelled(e.target.checked)}
              className="w-3.5 h-3.5 text-indigo-600 rounded bg-slate-900 border-slate-700 focus:ring-indigo-500"
            />
            <span>Excluir pedidos cancelados del conteo</span>
          </label>
        </div>
      </div>

      {/* 2. EXECUTIVE KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* KPI 1: Unsold Products */}
        <div className="bg-white rounded-2xl p-4 border border-rose-100 shadow-xs flex items-center gap-3.5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-50 rounded-full -mr-6 -mt-6 pointer-events-none" />
          <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
            <PackageX className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">
              Sin Ventas en {MONTH_NAMES[selectedMonth]}
            </div>
            <div className="text-2xl font-black text-slate-900 flex items-baseline gap-1.5">
              <span>{analysis.unsoldList.length}</span>
              <span className="text-xs font-semibold text-gray-500">
                de {products.length} ({products.length > 0 ? Math.round((analysis.unsoldList.length / products.length) * 100) : 0}%)
              </span>
            </div>
            <div className="text-[11px] text-gray-500 mt-0.5">
              {analysis.totalUnsoldStockUnits.toLocaleString()} unidades en bodega
            </div>
          </div>
        </div>

        {/* KPI 2: Immobilized Capital */}
        <div className="bg-white rounded-2xl p-4 border border-amber-100 shadow-xs flex items-center gap-3.5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50 rounded-full -mr-6 -mt-6 pointer-events-none" />
          <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">
              Capital Inmovilizado (Costo)
            </div>
            <div className="text-xl font-black text-slate-900">
              {formatCOP(analysis.totalImmobilizedCost)}
            </div>
            <div className="text-[11px] text-gray-500 mt-0.5">
              Valor venta estimado: {formatCOP(analysis.totalImmobilizedRetail)}
            </div>
          </div>
        </div>

        {/* KPI 3: Products with Sales */}
        <div className="bg-white rounded-2xl p-4 border border-emerald-100 shadow-xs flex items-center gap-3.5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-full -mr-6 -mt-6 pointer-events-none" />
          <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <PackageCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
              Con Ventas en el Mes
            </div>
            <div className="text-2xl font-black text-slate-900 flex items-baseline gap-1.5">
              <span>{analysis.soldList.length}</span>
              <span className="text-xs font-semibold text-emerald-600">
                ({analysis.catalogRotationRate}% rotación)
              </span>
            </div>
            <div className="text-[11px] text-gray-500 mt-0.5">
              {analysis.totalUnitsSoldInMonth.toLocaleString()} unid. vendidas en {analysis.monthlyOrdersCount} pedidos
            </div>
          </div>
        </div>

        {/* KPI 4: Monthly Sales Revenue */}
        <div className="bg-white rounded-2xl p-4 border border-blue-100 shadow-xs flex items-center gap-3.5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-full -mr-6 -mt-6 pointer-events-none" />
          <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">
              Ventas Totales del Mes
            </div>
            <div className="text-xl font-black text-slate-900">
              {formatCOP(analysis.totalMonthRevenue)}
            </div>
            <div className="text-[11px] text-gray-500 mt-0.5">
              Período: {MONTH_NAMES[selectedMonth]} {selectedYear}
            </div>
          </div>
        </div>
      </div>

      {/* 3. SUB-TABS NAVIGATION & FILTERS */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-gray-100 pb-3">
          {/* Subtabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            <button
              onClick={() => setActiveSubTab('unsold')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                activeSubTab === 'unsold'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
              }`}
            >
              <PackageX className="w-3.5 h-3.5" />
              <span>Sin Ventas ({analysis.unsoldList.length})</span>
            </button>

            <button
              onClick={() => setActiveSubTab('low_rotation')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                activeSubTab === 'low_rotation'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Baja Rotación (≤{lowRotationThreshold} unid: {analysis.lowRotationList.length})</span>
            </button>

            <button
              onClick={() => setActiveSubTab('sold')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                activeSubTab === 'sold'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              <PackageCheck className="w-3.5 h-3.5" />
              <span>Con Ventas ({analysis.soldList.length})</span>
            </button>

            <button
              onClick={() => setActiveSubTab('categories')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                activeSubTab === 'categories'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-indigo-50 text-indigo-800 hover:bg-indigo-100'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Por Categoría ({analysis.categoryStats.length})</span>
            </button>
          </div>

          {/* Quick Threshold control for low rotation */}
          {activeSubTab === 'low_rotation' && (
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <span>Umbral baja rotación:</span>
              <select
                value={lowRotationThreshold}
                onChange={(e) => setLowRotationThreshold(Number(e.target.value))}
                className="bg-gray-50 border border-gray-300 rounded-lg px-2 py-1 font-bold text-slate-800"
              >
                <option value={1}>Máximo 1 unidad</option>
                <option value={2}>Máximo 2 unidades</option>
                <option value={3}>Máximo 3 unidades</option>
                <option value={5}>Máximo 5 unidades</option>
                <option value={10}>Máximo 10 unidades</option>
              </select>
            </div>
          )}
        </div>

        {/* Search, Category & Sort Filter Toolbar (for unsold/low_rotation/sold tabs) */}
        {activeSubTab !== 'categories' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {/* Search Input */}
            <div className="relative sm:col-span-2 lg:col-span-2">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nombre, SKU, código de barras..."
                className="w-full pl-9 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-hidden"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 cursor-pointer"
                  title="Limpiar búsqueda"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Category Filter */}
            <div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              >
                <option value="all">Todas las Categorías ({categories.length})</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort Filter */}
            <div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              >
                <option value="capital_desc">Mayor Capital Inmovilizado</option>
                <option value="stock_desc">Mayor Stock en Bodega</option>
                <option value="days_desc">Mayor Tiempo sin Venta</option>
                <option value="price_desc">Mayor Precio de Venta</option>
                <option value="price_asc">Menor Precio de Venta</option>
                <option value="name_asc">Nombre (A - Z)</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* 4. MAIN CONTENT AREA ACCORDING TO SUB-TAB */}
      {loadingOrders ? (
        <div className="bg-white rounded-2xl p-12 border border-gray-200 text-center">
          <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-800">Analizando pedidos y rotación local...</p>
        </div>
      ) : activeSubTab === 'unsold' ? (
        /* TAB 1: UNSOLD PRODUCTS TABLE */
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-gray-200 flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span>Listado de Productos Sin Ventas en {MONTH_NAMES[selectedMonth]} {selectedYear}</span>
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Mostrando {filteredUnsoldList.length} de {analysis.unsoldList.length} productos sin rotación
              </p>
            </div>

            {filteredUnsoldList.length > 0 && (
              <div className="text-xs font-bold text-rose-700 bg-rose-100/70 px-3 py-1 rounded-lg border border-rose-200">
                Capital Estancado: {formatCOP(filteredUnsoldCapitalCost)}
              </div>
            )}
          </div>

          {filteredUnsoldList.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="text-base font-bold text-slate-800">¡Excelente rotación!</h4>
              <p className="text-xs text-gray-500 max-w-md mx-auto mt-1">
                {searchQuery || selectedCategory !== 'all'
                  ? 'No hay productos sin ventas que coincidan con los filtros aplicados.'
                  : `Todos los productos de tu catálogo registraron ventas durante ${MONTH_NAMES[selectedMonth]} ${selectedYear}.`}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-gray-100/80 text-gray-600 font-bold border-b border-gray-200">
                      <th className="py-3 px-3">Producto / Referencia</th>
                      <th className="py-3 px-3">Categoría</th>
                      <th className="py-3 px-3 text-right">Stock</th>
                      <th className="py-3 px-3 text-right">Costo Unit.</th>
                      <th className="py-3 px-3 text-right">Precio Venta</th>
                      <th className="py-3 px-3 text-right">Capital Inmovilizado</th>
                      <th className="py-3 px-3 text-center">Última Venta Histórica</th>
                      <th className="py-3 px-3 text-center">Estrategia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {paginatedUnsoldList.map((item) => (
                      <tr key={item.product.id} className="hover:bg-rose-50/40 transition-colors">
                        {/* Product Name & SKU / Barcode */}
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-900">{item.product.name}</div>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            {item.product.sku && (
                              <span className="text-[10px] font-mono text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">
                                SKU: {item.product.sku}
                              </span>
                            )}
                            {item.product.barcode && (
                              <span className="text-[10px] font-mono text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 flex items-center gap-0.5">
                                <Barcode className="w-2.5 h-2.5 text-blue-600" />
                                {item.product.barcode}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Category */}
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-700 font-semibold rounded-md text-[11px]">
                            {item.product.category}
                          </span>
                        </td>

                        {/* Stock */}
                        <td className="py-3 px-3 text-right">
                          <span
                            className={`font-black ${
                              item.stock > 50
                                ? 'text-rose-700'
                                : item.stock > 0
                                ? 'text-slate-800'
                                : 'text-gray-400'
                            }`}
                          >
                            {item.stock} unid.
                          </span>
                        </td>

                        {/* Cost */}
                        <td className="py-3 px-3 text-right text-gray-600 font-mono">
                          {formatCOP(item.costPrice)}
                        </td>

                        {/* Sales Price */}
                        <td className="py-3 px-3 text-right font-bold text-slate-900 font-mono">
                          {formatCOP(item.price)}
                        </td>

                        {/* Immobilized Capital */}
                        <td className="py-3 px-3 text-right font-mono">
                          <div className="font-black text-rose-700">
                            {formatCOP(item.immobilizedCost)}
                          </div>
                          <div className="text-[10px] text-gray-400">
                            Venta: {formatCOP(item.immobilizedRetail)}
                          </div>
                        </td>

                        {/* Historical Last Sale */}
                        <td className="py-3 px-3 text-center">
                          {item.historicalLastSale ? (
                            <div>
                              <div className="text-[11px] font-semibold text-slate-700">
                                {item.historicalLastSale.date.toLocaleDateString('es-CO', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </div>
                              <div className="text-[10px] text-amber-700 font-medium">
                                Hace {item.daysSinceLastSale} días
                              </div>
                            </div>
                          ) : (
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-[10px] rounded-full font-medium">
                              Sin registro
                            </span>
                          )}
                        </td>

                        {/* Action */}
                        <td className="py-3 px-3 text-center">
                          {onEditProduct ? (
                            <button
                              type="button"
                              onClick={() => onEditProduct(item.product)}
                              className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold inline-flex items-center gap-1 border border-indigo-200 transition-all cursor-pointer"
                              title="Editar producto para aplicar descuento o promocionarlo"
                            >
                              <Tag className="w-3 h-3 text-indigo-600" />
                              <span>Crear Promo</span>
                            </button>
                          ) : (
                            <span className="text-gray-400 text-[11px]">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {renderPagination(filteredUnsoldList.length)}
            </>
          )}
        </div>
      ) : activeSubTab === 'low_rotation' ? (
        /* TAB 2: LOW ROTATION PRODUCTS TABLE */
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-amber-50/60 border-b border-amber-100 flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Productos de Baja Rotación (≤ {lowRotationThreshold} unidades vendidas)</span>
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Mostrando {filteredLowRotationList.length} de {analysis.lowRotationList.length} productos con baja rotación
              </p>
            </div>
          </div>

          {filteredLowRotationList.length === 0 ? (
            <div className="p-10 text-center text-xs text-gray-500">
              No hay productos con baja rotación en este umbral durante el mes seleccionado.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-gray-100/80 text-gray-600 font-bold border-b border-gray-200">
                      <th className="py-3 px-3">Producto</th>
                      <th className="py-3 px-3">Categoría</th>
                      <th className="py-3 px-3 text-right">Unid. Vendidas</th>
                      <th className="py-3 px-3 text-right">Venta Generada</th>
                      <th className="py-3 px-3 text-right">Stock Restante</th>
                      <th className="py-3 px-3 text-right">Capital en Bodega</th>
                      <th className="py-3 px-3 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {paginatedLowRotationList.map((item) => (
                      <tr key={item.product.id} className="hover:bg-amber-50/40 transition-colors">
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-900">{item.product.name}</div>
                          {item.product.sku && (
                            <div className="text-[10px] text-gray-400">SKU: {item.product.sku}</div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-gray-600">{item.product.category}</td>
                        <td className="py-3 px-3 text-right font-bold text-amber-700">
                          {item.unitsSold} unid.
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                          {formatCOP(item.revenue)}
                        </td>
                        <td className="py-3 px-3 text-right font-semibold text-slate-700">
                          {item.stock} unid.
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-gray-700">
                          {formatCOP(item.immobilizedCost)}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {onEditProduct && (
                            <button
                              type="button"
                              onClick={() => onEditProduct(item.product)}
                              className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-xs font-bold border border-amber-200 transition-all cursor-pointer"
                            >
                              Impulsar
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {renderPagination(filteredLowRotationList.length)}
            </>
          )}
        </div>
      ) : activeSubTab === 'sold' ? (
        /* TAB 3: PRODUCTS WITH ACTIVE SALES TABLE */
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-emerald-50/60 border-b border-emerald-100 flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <PackageCheck className="w-4 h-4 text-emerald-600" />
                <span>Ranking de Productos Vendidos en {MONTH_NAMES[selectedMonth]} {selectedYear}</span>
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Mostrando {filteredSoldList.length} de {analysis.soldList.length} productos con rotación activa este mes
              </p>
            </div>
          </div>

          {filteredSoldList.length === 0 ? (
            <div className="p-10 text-center text-xs text-gray-500">
              No se registraron ventas en el período seleccionado.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-gray-100/80 text-gray-600 font-bold border-b border-gray-200">
                      <th className="py-3 px-3">Producto</th>
                      <th className="py-3 px-3">Categoría</th>
                      <th className="py-3 px-3 text-right">Unid. Vendidas</th>
                      <th className="py-3 px-3 text-right">Pedidos</th>
                      <th className="py-3 px-3 text-right">Ingresos ($ COP)</th>
                      <th className="py-3 px-3 text-right">Stock Disponible</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {paginatedSoldList.map((item, idx) => (
                      <tr key={item.product.id} className="hover:bg-emerald-50/30 transition-colors">
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black flex items-center justify-center shrink-0">
                              {(currentPage - 1) * pageSize + idx + 1}
                            </span>
                            <div>
                              <div className="font-bold text-slate-900">{item.product.name}</div>
                              {item.product.sku && (
                                <div className="text-[10px] text-gray-400">SKU: {item.product.sku}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-gray-600">{item.product.category}</td>
                        <td className="py-3 px-3 text-right font-black text-emerald-700">
                          {item.unitsSold} unid.
                        </td>
                        <td className="py-3 px-3 text-right font-semibold text-slate-700">
                          {item.ordersCount}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                          {formatCOP(item.revenue)}
                        </td>
                        <td className="py-3 px-3 text-right font-semibold text-slate-700">
                          {item.stock} unid.
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {renderPagination(filteredSoldList.length)}
            </>
          )}
        </div>
      ) : (
        /* TAB 4: CATEGORY BREAKDOWN ANALYSIS */
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-indigo-50/60 border-b border-indigo-100 flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-600" />
                <span>Desempeño y Rotación por Categoría</span>
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Compara cuáles líneas de negocio tienen mayor concentración de productos estancados
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-gray-100/80 text-gray-600 font-bold border-b border-gray-200">
                  <th className="py-3 px-3">Categoría</th>
                  <th className="py-3 px-3 text-center">Total Productos</th>
                  <th className="py-3 px-3 text-center">Sin Venta</th>
                  <th className="py-3 px-3 text-center">Con Venta</th>
                  <th className="py-3 px-3 text-right">Tasa Rotación</th>
                  <th className="py-3 px-3 text-right">Capital Inmovilizado</th>
                  <th className="py-3 px-3 text-right">Ingresos Mes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {analysis.categoryStats.map((c) => {
                  const rotRate =
                    c.totalProducts > 0 ? Math.round((c.soldCount / c.totalProducts) * 100) : 0;
                  return (
                    <tr key={c.category} className="hover:bg-indigo-50/30 transition-colors">
                      <td className="py-3 px-3 font-bold text-slate-900">{c.category}</td>
                      <td className="py-3 px-3 text-center text-slate-700 font-semibold">
                        {c.totalProducts}
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-rose-700">
                        {c.unsoldCount}
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-emerald-700">
                        {c.soldCount}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span
                          className={`font-black ${
                            rotRate >= 60
                              ? 'text-emerald-700'
                              : rotRate >= 30
                              ? 'text-amber-700'
                              : 'text-rose-700'
                          }`}
                        >
                          {rotRate}%
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-rose-700">
                        {formatCOP(c.unsoldCapitalCost)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                        {formatCOP(c.revenue)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. STRATEGIC COMMERCIAL RECOMMENDATIONS BOX */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-5 shadow-xs">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-200/80 text-amber-800 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="space-y-1.5 text-xs text-amber-900">
            <h4 className="text-sm font-black text-amber-950">
              Estrategias Comerciales Recomendadas para Productos Sin Venta:
            </h4>
            <ul className="list-disc list-inside space-y-1 text-amber-900/90 leading-relaxed">
              <li>
                <strong>Armar Combos con Productos Estrella:</strong> Empareja productos sin rotación con los más vendidos del catálogo (ej. Bilac o Café) ofreciendo precio especial por paquete.
              </li>
              <li>
                <strong>Franja de Promoción o Liquidación:</strong> Modifica la etiqueta en el panel de productos a <em>"Pague 1 Lleve 2"</em> o aplica un descuento del 10% al 15% para rotar antes de su fecha de vencimiento.
              </li>
              <li>
                <strong>Ofertas Directas por WhatsApp:</strong> Utiliza el botón <em>"Copiar para WhatsApp"</em> y difunde a los tenderos y clientes de tu cartera la lista de oportunidades del mes.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
