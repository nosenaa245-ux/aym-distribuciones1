import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Clock,
  CheckCircle2,
  Truck,
  XCircle,
  AlertCircle,
  Phone,
  MessageSquare,
  MapPin,
  Store,
  CreditCard,
  Search,
  Trash2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  DollarSign,
  PackageCheck,
  Database,
  RotateCcw,
  Undo2,
  HelpCircle,
  FileText,
  Boxes,
  Printer
} from 'lucide-react';
import { OrderRecord, OrderStatus, CartItem, StoreBranding } from '../types';
import { OrderPrintModal } from './OrderPrintModal';
import {
  subscribeToOrders,
  updateOrderStatusInCloud,
  deleteOrderFromCloud,
  returnOrderItemInCloud,
  cancelOrderAndRestoreStockInCloud,
  returnAllOrderStockAndDeleteInCloud
} from '../lib/localDatabase';

const STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; color: string; bg: string; border: string; icon: React.ElementType }
> = {
  pendiente: {
    label: 'Pendiente',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    icon: Clock,
  },
  confirmado: {
    label: 'Confirmado',
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: CheckCircle2,
  },
  en_camino: {
    label: 'En Camino',
    color: 'text-purple-700',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    icon: Truck,
  },
  entregado: {
    label: 'Entregado',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    icon: PackageCheck,
  },
  cancelado: {
    label: 'Cancelado',
    color: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-200',
    icon: XCircle,
  },
};

interface OrdersAdminTabProps {
  branding: StoreBranding;
}

export const OrdersAdminTab: React.FC<OrdersAdminTabProps> = ({ branding }) => {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todas');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [actionSuccessNotice, setActionSuccessNotice] = useState<string | null>(null);
  
  // Printing states
  const [printingOrder, setPrintingOrder] = useState<OrderRecord | null>(null);
  const [isPrintingBatch, setIsPrintingBatch] = useState<boolean>(false);

  // Return item modal state
  const [returningItemState, setReturningItemState] = useState<{
    order: OrderRecord;
    item: CartItem;
    returnQty: number;
    reason: string;
    customReason: string;
    deleteInvoiceTotally: boolean;
    restoreAllOtherItemsToo: boolean;
  } | null>(null);
  const [isProcessingReturn, setIsProcessingReturn] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToOrders(
      (data) => {
        setOrders(data);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching orders from local database:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const formatCOP = (val: number) => `$${val.toLocaleString('es-CO')} COP`;

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('es-CO', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  const handleStatusChange = async (order: OrderRecord, newStatus: OrderStatus) => {
    const prevStatus = order.status;
    if (prevStatus === newStatus) return;

    if (newStatus === 'cancelado') {
      const activeUnits = order.items.reduce(
        (acc, it) => acc + Math.max(0, it.quantity - (it.returnedQuantity || 0)),
        0
      );
      const confirmMsg = `¿Deseas devolver todo el stock y borrar la factura #${order.orderNumber} totalmente?\n\n• Se reintegrarán ${activeUnits} unidades de sus productos al inventario en la nube.\n• La factura #${order.orderNumber} se eliminará por completo de la base de datos.`;
      if (!window.confirm(confirmMsg)) return;

      try {
        const { restoredItemsCount } = await returnAllOrderStockAndDeleteInCloud(order.id, order);
        setActionSuccessNotice(`✓ ¡Stock devuelto (${restoredItemsCount} unid.) y factura #${order.orderNumber} borrada totalmente!`);
        setTimeout(() => setActionSuccessNotice(null), 4000);
        return;
      } catch (e: any) {
        alert(`Error al devolver stock y borrar factura: ${e.message}`);
        return;
      }
    }

    try {
      await updateOrderStatusInCloud(order.id, newStatus, prevStatus, order);
      if (prevStatus === 'cancelado') {
        setActionSuccessNotice(`Pedido #${order.orderNumber} reactivado como "${STATUS_CONFIG[newStatus].label}": El stock fue descontado nuevamente.`);
      } else {
        setActionSuccessNotice(`Estado del pedido actualizado a "${STATUS_CONFIG[newStatus].label}"`);
      }
      setTimeout(() => setActionSuccessNotice(null), 4000);
    } catch (e: any) {
      alert(`Error al actualizar estado: ${e.message}`);
    }
  };

  const handleQuickCancelAndRestore = async (order: OrderRecord) => {
    const activeUnits = order.items.reduce(
      (acc, it) => acc + Math.max(0, it.quantity - (it.returnedQuantity || 0)),
      0
    );
    const confirmMsg = `¿Deseas devolver todo el stock y borrar la factura #${order.orderNumber} totalmente?\n\n• Se reintegrarán las ${activeUnits} unidades de sus productos al inventario disponible en la nube.\n• El registro de la factura #${order.orderNumber} se eliminará por completo de la base de datos.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const { restoredItemsCount } = await returnAllOrderStockAndDeleteInCloud(order.id, order);
      setActionSuccessNotice(
        `✓ ¡Stock reintegrado al inventario (${restoredItemsCount} unid.) y factura #${order.orderNumber} borrada totalmente!`
      );
      setTimeout(() => setActionSuccessNotice(null), 4000);
    } catch (e: any) {
      alert(`Error al devolver stock y borrar factura: ${e.message}`);
    }
  };

  const handleDelete = async (orderId: string, orderNumber: string, orderObj?: OrderRecord) => {
    const targetOrder = orderObj || orders.find((o) => o.id === orderId);
    const activeUnits = targetOrder?.items.reduce(
      (acc, it) => acc + Math.max(0, it.quantity - (it.returnedQuantity || 0)),
      0
    ) || 0;

    let restoreStock = false;
    if (activeUnits > 0 && targetOrder && targetOrder.status !== 'cancelado') {
      restoreStock = window.confirm(
        `¿Deseas devolver las ${activeUnits} unidades al stock del inventario antes de borrar la factura #${orderNumber}?\n\n• Clic en ACEPTAR para DEVOLVER los productos al stock y borrar la factura totalmente.\n• Clic en CANCELAR para borrar solo el registro sin alterar el inventario.`
      );
    } else {
      if (!window.confirm(`¿Seguro que deseas eliminar el registro de la factura #${orderNumber}? Esta acción no se puede deshacer.`)) {
        return;
      }
    }

    try {
      if (restoreStock && targetOrder) {
        const { restoredItemsCount } = await returnAllOrderStockAndDeleteInCloud(orderId, targetOrder);
        setActionSuccessNotice(`✓ ¡Stock devuelto (${restoredItemsCount} unid.) y factura #${orderNumber} eliminada totalmente!`);
      } else {
        await deleteOrderFromCloud(orderId);
        setActionSuccessNotice(`Factura #${orderNumber} eliminada de la base de datos.`);
      }
      setTimeout(() => setActionSuccessNotice(null), 3000);
    } catch (e: any) {
      alert(`Error al eliminar factura: ${e.message}`);
    }
  };

  const handleOpenWhatsAppCustomer = (order: OrderRecord) => {
    const rawPhone = order.customer.phone.replace(/\D/g, '');
    const phoneToUse = rawPhone.length === 10 ? `57${rawPhone}` : rawPhone;
    const greetingMsg = encodeURIComponent(
      `¡Hola ${order.customer.ownerName}! 👋 Te escribimos de AYM Distribuciones respecto a tu pedido *#${order.orderNumber}* para la tienda *${order.customer.storeName}*. Estado actual: *${STATUS_CONFIG[order.status].label}*. ¿Cómo estás?`
    );
    window.open(`https://api.whatsapp.com/send?phone=${phoneToUse}&text=${greetingMsg}`, '_blank');
  };

  const handleOpenReturnModal = (order: OrderRecord, item: CartItem) => {
    const availableToReturn = Math.max(0, item.quantity - (item.returnedQuantity || 0));
    if (availableToReturn <= 0) {
      alert('Todas las unidades de este producto ya han sido devueltas al inventario.');
      return;
    }

    setReturningItemState({
      order,
      item,
      returnQty: availableToReturn,
      reason: 'Devolución solicitada por el cliente',
      customReason: '',
      deleteInvoiceTotally: false,
      restoreAllOtherItemsToo: false,
    });
  };

  const handleConfirmReturnItem = async () => {
    if (!returningItemState) return;
    const {
      order,
      item,
      returnQty,
      reason,
      customReason,
      deleteInvoiceTotally,
      restoreAllOtherItemsToo,
    } = returningItemState;
    const finalReason = reason === 'Otro motivo' ? (customReason.trim() || 'Otro motivo') : reason;

    setIsProcessingReturn(true);
    try {
      if (deleteInvoiceTotally && restoreAllOtherItemsToo && order.items.length > 1) {
        const { restoredItemsCount } = await returnAllOrderStockAndDeleteInCloud(order.id, order);
        setReturningItemState(null);
        setActionSuccessNotice(
          `✓ ¡Stock devuelto al inventario (${restoredItemsCount} unid.) y factura #${order.orderNumber} borrada totalmente!`
        );
      } else {
        const res = await returnOrderItemInCloud(order.id, item.product.id, returnQty, finalReason, {
          deleteInvoiceTotally,
        });
        setReturningItemState(null);
        if (res.invoiceDeleted) {
          setActionSuccessNotice(
            `✓ ¡"${item.product.name}" devuelto al stock y factura #${order.orderNumber} eliminada totalmente de la base de datos!`
          );
        } else {
          setActionSuccessNotice(
            `✓ ¡${res.returnedQuantity} unid. de "${item.product.name}" devueltas al stock y eliminadas totalmente de la factura #${order.orderNumber}!`
          );
        }
      }
      setTimeout(() => setActionSuccessNotice(null), 4000);
    } catch (e: any) {
      alert(`Error al procesar devolución: ${e.message}`);
    } finally {
      setIsProcessingReturn(false);
    }
  };

  // Metrics
  const totalRevenue = orders.reduce((acc, o) => (o.status !== 'cancelado' ? acc + o.totalPrice : acc), 0);
  const pendingCount = orders.filter((o) => o.status === 'pendiente').length;
  const deliveredCount = orders.filter((o) => o.status === 'entregado').length;

  // Filtered orders
  const filteredOrders = orders.filter((order) => {
    if (statusFilter !== 'todas' && order.status !== statusFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNumber = order.orderNumber.toLowerCase().includes(q);
      const matchStore = order.customer.storeName.toLowerCase().includes(q);
      const matchOwner = order.customer.ownerName.toLowerCase().includes(q);
      const matchCity = order.customer.city.toLowerCase().includes(q);
      const matchPhone = order.customer.phone.toLowerCase().includes(q);
      if (!matchNumber && !matchStore && !matchOwner && !matchCity && !matchPhone) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Cloud indicator & Metrics bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-gray-500 font-semibold mb-1">
            <span>Total Pedidos</span>
            <ShoppingBag className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-xl font-extrabold text-slate-900">{orders.length}</div>
          <div className="text-[10px] text-gray-400">Base de datos local</div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-gray-500 font-semibold mb-1">
            <span>Ventas Activas</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-lg font-black text-[#0B5CAB] truncate">{formatCOP(totalRevenue)}</div>
          <div className="text-[10px] text-gray-400">Excluye pedidos cancelados</div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-gray-500 font-semibold mb-1">
            <span>Por Despachar</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-xl font-extrabold text-amber-700">{pendingCount}</div>
          <div className="text-[10px] text-amber-600 font-medium">Pendientes de envío</div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-gray-500 font-semibold mb-1">
            <span>Entregados</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-extrabold text-emerald-700">{deliveredCount}</div>
          <div className="text-[10px] text-emerald-600 font-medium">Completados con éxito</div>
        </div>
      </div>

      {actionSuccessNotice && (
        <div className="p-3 bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-2.5 shadow-md animate-in fade-in slide-in-from-top-1">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{actionSuccessNotice}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-2xs flex flex-wrap items-center justify-between gap-2.5">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por orden, tienda, cliente o ciudad..."
            className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
          />
        </div>

        {/* Status filters & Print List Action */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-semibold">
            {['todas', 'pendiente', 'confirmado', 'en_camino', 'entregado', 'cancelado'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1.5 rounded-lg capitalize transition-colors whitespace-nowrap ${
                  statusFilter === st
                    ? 'bg-slate-900 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {st === 'todas' ? 'Todos' : STATUS_CONFIG[st as OrderStatus]?.label || st}
              </button>
            ))}
          </div>

          {filteredOrders.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setPrintingOrder(null);
                setIsPrintingBatch(true);
              }}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
              title="Imprimir manifiesto / listado de pedidos en nube"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir Listado ({filteredOrders.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mx-auto mb-2" />
          <p className="text-xs text-gray-500 font-semibold">Cargando pedidos de la base de datos local...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-14 bg-white rounded-xl border border-gray-200 space-y-2">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <Database className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-slate-800 text-sm">No hay pedidos registrados</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            {orders.length === 0
              ? 'Cuando los clientes finalicen sus compras en el catálogo web, los pedidos aparecerán aquí automáticamente en tiempo real.'
              : 'No hay pedidos que coincidan con la búsqueda o filtro seleccionado.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const statusMeta = STATUS_CONFIG[order.status] || STATUS_CONFIG.pendiente;
            const StatusIcon = statusMeta.icon;
            const isExpanded = expandedOrderId === order.id;
            const isCancelled = order.status === 'cancelado';
            const totalReturnedUnitsInOrder = (order.items || []).reduce((acc, it) => acc + (it.returnedQuantity || 0), 0);

            return (
              <div
                key={order.id}
                className={`bg-white border rounded-xl overflow-hidden shadow-2xs transition-all ${
                  isCancelled ? 'border-red-200 bg-red-50/10' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {/* Order Header Summary Card */}
                <div className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50/50">
                  <div className="flex items-start sm:items-center gap-3">
                    <div className={`p-2.5 rounded-xl border flex-shrink-0 ${
                      isCancelled ? 'bg-red-50 text-red-700 border-red-200' : 'bg-blue-50 text-blue-700 border-blue-100'
                    }`}>
                      <Store className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-extrabold text-sm text-slate-900">
                          #{order.orderNumber}
                        </span>
                        <div
                          className={`flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${statusMeta.bg} ${statusMeta.color} ${statusMeta.border}`}
                        >
                          <StatusIcon className="w-3 h-3" />
                          <span>{statusMeta.label}</span>
                        </div>

                        {totalReturnedUnitsInOrder > 0 && (
                          <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                            <RotateCcw className="w-3 h-3" />
                            {totalReturnedUnitsInOrder} {totalReturnedUnitsInOrder === 1 ? 'unidad devuelta' : 'unidades devueltas'}
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-800 font-bold mt-0.5">
                        {order.customer.storeName}{' '}
                        <span className="font-normal text-gray-500">
                          • {order.customer.ownerName} ({order.customer.city})
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        {formatDate(order.createdAt)} • {order.items.length} productos ({order.totalItemsCount} unid. activas)
                      </div>
                    </div>
                  </div>

                  {/* Price & Fast Actions */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100">
                    <div className="text-left sm:text-right">
                      <div className="text-xs text-gray-500 font-medium">Total Pedido:</div>
                      <div className={`text-base font-black ${isCancelled ? 'line-through text-gray-400' : 'text-[#0B5CAB]'}`}>
                        {formatCOP(order.totalPrice)}
                      </div>
                      {isCancelled && (
                        <div className="text-[10px] font-bold text-red-600">Stock devuelto</div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          setPrintingOrder(order);
                          setIsPrintingBatch(false);
                        }}
                        className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                        title="Imprimir comprobante / factura de este pedido"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Imprimir</span>
                      </button>

                      <button
                        onClick={() => handleOpenWhatsAppCustomer(order)}
                        className="px-2.5 py-1.5 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-colors"
                        title="Contactar al cliente por WhatsApp"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">WhatsApp</span>
                      </button>

                      <button
                        onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                        className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-xs font-semibold flex items-center gap-1"
                        title="Ver detalle del pedido"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Details Section */}
                {isExpanded && (
                  <div className="p-4 border-t border-gray-200 bg-white space-y-3 text-xs animate-in fade-in">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-gray-50 p-3 rounded-xl border border-gray-200">
                      <div>
                        <div className="text-[11px] font-bold text-gray-500 uppercase">Datos de Despacho</div>
                        <div className="mt-1 space-y-0.5 text-slate-800">
                          <div><strong>Dirección:</strong> {order.customer.address}</div>
                          <div><strong>Ciudad:</strong> {order.customer.city}</div>
                          <div><strong>Teléfono:</strong> {order.customer.phone}</div>
                          {order.customer.notes && (
                            <div className="text-amber-800 bg-amber-50 p-1.5 rounded-lg border border-amber-200 mt-1.5">
                              <strong>Notas / Horario:</strong> {order.customer.notes}
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <div className="text-[11px] font-bold text-gray-500 uppercase">Gestión de Orden y Stock</div>
                        <div className="mt-1 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-gray-700">Cambiar estado:</span>
                            <select
                              value={order.status}
                              onChange={(e) => handleStatusChange(order, e.target.value as OrderStatus)}
                              className="px-2.5 py-1 bg-white border border-gray-300 rounded-lg text-xs font-bold focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                            >
                              <option value="pendiente">🟡 Pendiente</option>
                              <option value="confirmado">🔵 Confirmado</option>
                              <option value="en_camino">🟣 En Camino</option>
                              <option value="entregado">🟢 Entregado</option>
                              <option value="cancelado">🔴 Cancelado (Devuelve al stock)</option>
                            </select>
                          </div>

                          <div className="text-slate-700">
                            <strong>Método de pago acordado:</strong>{' '}
                            <span className="capitalize font-semibold">{order.customer.paymentMethod}</span>
                          </div>

                          {/* Print Invoice Button */}
                          <div className="pt-1 flex items-center gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() => {
                                setPrintingOrder(order);
                                setIsPrintingBatch(false);
                              }}
                              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                              title="Imprimir formato de factura, remisión o ticket POS"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>Imprimir Factura / Ticket POS</span>
                            </button>
                          </div>

                          {/* Quick Return Stock and Delete Invoice Button */}
                          {!isCancelled && (
                            <div className="pt-0.5">
                              <button
                                onClick={() => handleQuickCancelAndRestore(order)}
                                className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                                title="Devolver todos los productos al inventario y borrar el registro de la factura totalmente"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Devolver todo el stock y borrar factura</span>
                              </button>
                            </div>
                          )}

                          <div className="pt-1 flex items-center gap-3">
                            <button
                              onClick={() => handleDelete(order.id, order.orderNumber, order)}
                              className="text-gray-500 hover:text-red-700 hover:underline flex items-center gap-1 font-semibold text-[11px] cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Eliminar factura
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Notification about auto stock return */}
                    {isCancelled && (
                      <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-red-900 flex items-center gap-2 text-xs">
                        <RotateCcw className="w-4 h-4 text-red-600 flex-shrink-0" />
                        <div>
                          <strong>Pedido cancelado:</strong> Todas las unidades de esta factura fueron reincorporadas automáticamente al inventario disponible.
                        </div>
                      </div>
                    )}

                    {/* Items table with individual item return button */}
                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                      <div className="bg-slate-100 px-3 py-2 text-[11px] font-bold text-slate-700 uppercase flex justify-between items-center">
                        <span className="flex items-center gap-1.5">
                          <Boxes className="w-3.5 h-3.5 text-slate-500" />
                          Productos en Factura / Pedido
                        </span>
                        <span>Acción & Subtotal</span>
                      </div>
                      <div className="divide-y divide-gray-100">
                        {order.items
                          .filter((item) => Math.max(0, item.quantity - (item.returnedQuantity || 0)) > 0)
                          .map((item, idx) => {
                            const activeQty = Math.max(0, item.quantity - (item.returnedQuantity || 0));

                            return (
                              <div key={idx} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-gray-700 hover:bg-slate-50/50">
                                <div className="flex-1">
                                  <div className="font-bold text-slate-900 uppercase text-xs flex items-center gap-2 flex-wrap">
                                    <span>{item.product.name}</span>
                                  </div>
                                  <div className="text-[11px] text-gray-500 mt-0.5">
                                    <span>Cantidad: <strong>{activeQty}</strong> ({item.product.packaging})</span>
                                    {' • '}
                                    <span>Precio unitario: {formatCOP(item.product.price)}</span>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between sm:justify-end gap-3 pt-1 sm:pt-0">
                                  {/* Return item button */}
                                  {!isCancelled && activeQty > 0 && (
                                    <button
                                      onClick={() => handleOpenReturnModal(order, item)}
                                      className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg font-bold text-[11px] flex items-center gap-1.5 transition-colors active:scale-95 cursor-pointer"
                                      title="Devolver unidades de este producto al stock y eliminarlo de la factura"
                                    >
                                      <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                                      <span>Devolver al Stock</span>
                                    </button>
                                  )}

                                  <div className="text-right">
                                    <div className="font-bold text-xs text-slate-900">
                                      {formatCOP(item.product.price * activeQty)}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>

                      <div className="bg-blue-50/70 px-3 py-2.5 border-t border-blue-100 flex justify-between items-center font-extrabold text-slate-900 text-xs">
                        <span>TOTAL COMPRA ACTUAL:</span>
                        <span className="text-sm text-[#0B5CAB]">{formatCOP(order.totalPrice)}</span>
                      </div>
                    </div>

                    {/* Return logs if any */}
                    {order.returns && order.returns.length > 0 && (
                      <div className="border border-amber-200 bg-amber-50/40 rounded-xl p-3 space-y-1.5">
                        <div className="text-[11px] font-bold text-amber-900 flex items-center gap-1.5 uppercase">
                          <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
                          Historial de Devoluciones Reintegradas al Stock
                        </div>
                        <div className="space-y-1">
                          {order.returns.map((ret) => (
                            <div key={ret.id} className="text-[11px] text-amber-900 bg-white p-2 rounded-lg border border-amber-200/80 flex items-center justify-between flex-wrap gap-1">
                              <div>
                                <span className="font-bold">{ret.returnedQuantity} unid.</span> de <strong>{ret.productName}</strong>
                                {ret.reason && <span className="text-gray-600"> — {ret.reason}</span>}
                              </div>
                              <div className="text-gray-500 font-mono text-[10px]">
                                {formatDate(ret.returnedAt)} • {formatCOP(ret.totalRefund)} reingresado al stock
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Return Item Modal */}
      {returningItemState && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-md w-full overflow-hidden animate-in zoom-in-95">
            {/* Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-amber-500/20 text-amber-400 rounded-lg">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm">Devolución de Producto</h3>
                  <p className="text-[11px] text-slate-300">
                    Factura #{returningItemState.order.orderNumber} • {returningItemState.order.customer.storeName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setReturningItemState(null)}
                className="text-slate-400 hover:text-white text-lg font-bold p-1 leading-none"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 text-xs text-slate-800">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-1">
                <div className="text-slate-900 font-extrabold text-sm uppercase">
                  {returningItemState.item.product.name}
                </div>
                <div className="text-gray-600 flex items-center justify-between text-xs">
                  <span>Presentación: {returningItemState.item.product.packaging}</span>
                  <span>Precio: {formatCOP(returningItemState.item.product.price)}</span>
                </div>
                <div className="text-gray-600 flex items-center justify-between text-xs font-semibold pt-1 border-t border-blue-100">
                  <span>Cantidad original en pedido:</span>
                  <span>{returningItemState.item.quantity} unid.</span>
                </div>
                {returningItemState.item.returnedQuantity && (
                  <div className="text-amber-800 text-xs font-semibold flex items-center justify-between">
                    <span>Ya devueltas anteriormente:</span>
                    <span>{returningItemState.item.returnedQuantity} unid.</span>
                  </div>
                )}
                <div className="text-emerald-800 text-xs font-black flex items-center justify-between">
                  <span>Disponibles para devolver:</span>
                  <span>
                    {Math.max(
                      0,
                      returningItemState.item.quantity - (returningItemState.item.returnedQuantity || 0)
                    )}{' '}
                    unid.
                  </span>
                </div>
              </div>

              {/* Quantity selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Cantidad de unidades a devolver al inventario:
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={1}
                    max={Math.max(
                      1,
                      returningItemState.item.quantity - (returningItemState.item.returnedQuantity || 0)
                    )}
                    value={returningItemState.returnQty}
                    onChange={(e) => {
                      const max = Math.max(
                        1,
                        returningItemState.item.quantity - (returningItemState.item.returnedQuantity || 0)
                      );
                      const val = Math.max(1, Math.min(max, parseInt(e.target.value) || 1));
                      setReturningItemState({ ...returningItemState, returnQty: val });
                    }}
                    className="w-24 px-3 py-2 border border-gray-300 rounded-xl font-black text-center text-sm focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  />
                  <div className="text-xs text-gray-500">
                    Monto a deducir de la factura:{' '}
                    <strong className="text-slate-900">
                      {formatCOP(returningItemState.item.product.price * returningItemState.returnQty)}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Reason selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Motivo de la devolución:
                </label>
                <select
                  value={returningItemState.reason}
                  onChange={(e) => setReturningItemState({ ...returningItemState, reason: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                >
                  <option value="Devolución solicitada por el cliente">Cliente desistió del producto</option>
                  <option value="Producto averiado o defectuoso">Producto averiado / dañado / defectuoso</option>
                  <option value="Error en despacho / Facturación">Error en despacho / Producto equivocado</option>
                  <option value="Vencimiento o fecha límite">Fecha de vencimiento próxima</option>
                  <option value="Otro motivo">Otro motivo personalizado...</option>
                </select>
              </div>

              {returningItemState.reason === 'Otro motivo' && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Especifique el motivo:
                  </label>
                  <input
                    type="text"
                    value={returningItemState.customReason}
                    onChange={(e) => setReturningItemState({ ...returningItemState, customReason: e.target.value })}
                    placeholder="Ej. Cambio de sabor por petición de la tienda..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  />
                </div>
              )}

              {/* Deletion of product from invoice explanation */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-1.5 text-xs text-blue-900">
                <div className="font-bold flex items-center gap-1.5 text-blue-950">
                  <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
                  <span>Eliminación directa del producto en la factura</span>
                </div>
                <div className="text-[11.5px] text-blue-800 leading-relaxed">
                  Al devolver las unidades al stock, <strong>el registro de este producto se eliminará totalmente de la descripción de la factura</strong>.
                  {returningItemState.order.items.length > 1 ? (
                    <span> Las demás referencias permanecerán en la factura y el total se recalculará automáticamente.</span>
                  ) : (
                    <span> Como es el único producto de esta orden, la factura completa se eliminará de la base de datos.</span>
                  )}
                </div>
              </div>

              {/* Deletion of entire invoice option (if multi-item) */}
              {returningItemState.order.items.length > 1 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl space-y-2">
                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={returningItemState.deleteInvoiceTotally}
                      onChange={(e) =>
                        setReturningItemState({
                          ...returningItemState,
                          deleteInvoiceTotally: e.target.checked,
                          restoreAllOtherItemsToo: e.target.checked,
                        })
                      }
                      className="mt-0.5 w-4 h-4 rounded text-red-600 focus:ring-red-500 border-gray-300 cursor-pointer"
                    />
                    <div>
                      <span className="text-xs font-black text-red-900 block">
                        Borrar también la factura completa
                      </span>
                      <span className="text-[11px] text-red-700 leading-tight block mt-0.5">
                        Devuelve también al stock todas las demás referencias y elimina el pedido #{returningItemState.order.orderNumber} por completo.
                      </span>
                    </div>
                  </label>
                </div>
              )}

              {/* Auto Stock Replenish Notice */}
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <div>
                  <strong>Reintegro automático de stock:</strong> Las unidades se sumarán instantáneamente al stock del producto en la nube.
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setReturningItemState(null)}
                disabled={isProcessingReturn}
                className="px-4 py-2 border border-gray-300 rounded-xl text-gray-700 font-semibold hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleConfirmReturnItem}
                disabled={isProcessingReturn}
                className={`px-4 py-2 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer ${
                  returningItemState.deleteInvoiceTotally
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isProcessingReturn ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Procesando...</span>
                  </>
                ) : returningItemState.deleteInvoiceTotally ? (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Devolver Todo y Borrar Factura</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    <span>Devolver al Stock y Eliminar de Factura</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cloud Order Print Modal (Single Order or Batch List) */}
      <OrderPrintModal
        isOpen={Boolean(printingOrder || isPrintingBatch)}
        onClose={() => {
          setPrintingOrder(null);
          setIsPrintingBatch(false);
        }}
        order={printingOrder}
        ordersList={isPrintingBatch ? filteredOrders : undefined}
        brandingName={branding.name}
        brandingSubtitle={branding.subtitle}
        storePhone={branding.whatsappNumber || '3113986110'}
      />
    </div>
  );
};

