import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Phone,
  Store,
  MapPin,
  Building2,
  DollarSign,
  MessageSquare,
  Edit,
  Trash2,
  CheckCircle2,
  XCircle,
  FileSpreadsheet,
  Download,
  Upload,
  RefreshCw,
  Clock,
  Sparkles,
  Percent,
  CreditCard,
  X,
  AlertTriangle,
  ExternalLink,
  Table,
  Check,
  Layers,
  ArrowRight,
  Info
} from 'lucide-react';
import { Customer } from '../types';
import {
  subscribeToCustomers,
  saveCustomerToCloud,
  deleteCustomerFromCloud,
  normalizePhone,
  batchImportCustomersToCloud,
} from '../lib/localDatabase';
import {
  exportCustomersToExcel,
  downloadCustomerExcelTemplate,
  parseCustomersFromExcel,
  ParsedCustomersResult,
} from '../utils/excelUtils';

export const CustomersAdminTab: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [actionSuccessNotice, setActionSuccessNotice] = useState<string | null>(null);

  // Excel Export & Template State
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);

  // Excel Import State
  const [isImportingExcel, setIsImportingExcel] = useState(false);
  const [showExcelImportModal, setShowExcelImportModal] = useState(false);
  const [excelImportResult, setExcelImportResult] = useState<ParsedCustomersResult | null>(null);
  const [excelImportFile, setExcelImportFile] = useState<File | null>(null);
  const [excelImportMode, setExcelImportMode] = useState<'merge' | 'replace'>('merge');
  const [isImportingCustomers, setIsImportingCustomers] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    processed: number;
    total: number;
    percent: number;
    message: string;
  } | null>(null);
  const [importMethodTab, setImportMethodTab] = useState<'excel' | 'text'>('excel');
  const [importPreviewSearch, setImportPreviewSearch] = useState('');

  // Quick Text Import State
  const [importText, setImportText] = useState('');
  const [importStatus, setImportStatus] = useState<string | null>(null);

  // Edit / Create Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState<Customer>({
    id: '',
    phone: '',
    storeName: '',
    ownerName: '',
    address: '',
    city: 'Bucaramanga',
    paymentMethod: 'contraentrega',
    notes: '',
    discountPercentage: 0,
    creditLimit: 0,
    status: 'active',
    ordersCount: 0,
    totalSpent: 0,
    createdAt: '',
  });
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  // Delete Confirm State
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToCustomers(
      (data) => {
        setCustomers(data);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching customers from local database:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const showNotification = (msg: string) => {
    setActionSuccessNotice(msg);
    setTimeout(() => setActionSuccessNotice(null), 3500);
  };

  // Extract unique cities
  const uniqueCities = Array.from(
    new Set(customers.map((c) => c.city?.trim()).filter(Boolean))
  ).sort();

  // Filter customers
  const filteredCustomers = customers.filter((c) => {
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !query ||
      c.storeName?.toLowerCase().includes(query) ||
      c.ownerName?.toLowerCase().includes(query) ||
      c.phone?.includes(query) ||
      c.address?.toLowerCase().includes(query) ||
      c.city?.toLowerCase().includes(query) ||
      c.notes?.toLowerCase().includes(query);

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && c.status !== 'inactive') ||
      (statusFilter === 'inactive' && c.status === 'inactive');

    const matchesCity = cityFilter === 'all' || c.city?.toLowerCase() === cityFilter.toLowerCase();

    return matchesSearch && matchesStatus && matchesCity;
  });

  // Financial & Client KPI calculations
  const totalCustomers = customers.length;
  const activeCustomers = customers.filter((c) => c.status !== 'inactive').length;
  const totalOrdersPlaced = customers.reduce((acc, c) => acc + (c.ordersCount || 0), 0);
  const totalSalesFromClients = customers.reduce((acc, c) => acc + (c.totalSpent || 0), 0);

  const formatCOP = (val: number) => `$${(val || 0).toLocaleString('es-CO')} COP`;

  // Open modal for new customer
  const handleOpenNewCustomer = () => {
    setEditingCustomer(null);
    setFormData({
      id: '',
      phone: '',
      storeName: '',
      ownerName: '',
      address: '',
      city: 'Bucaramanga',
      paymentMethod: 'contraentrega',
      notes: '',
      discountPercentage: 0,
      creditLimit: 0,
      status: 'active',
      ordersCount: 0,
      totalSpent: 0,
      createdAt: new Date().toISOString(),
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  // Open modal for editing existing customer
  const handleOpenEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      ...customer,
      discountPercentage: customer.discountPercentage || 0,
      creditLimit: customer.creditLimit || 0,
      notes: customer.notes || '',
      status: customer.status || 'active',
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  // Validate and submit customer
  const handleSubmitCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: { [key: string]: string } = {};

    const cleanPhone = normalizePhone(formData.phone);
    if (!cleanPhone || cleanPhone.length < 7) {
      errors.phone = 'Ingresa un número de WhatsApp válido (mínimo 7 a 10 dígitos).';
    }

    if (!formData.storeName?.trim()) {
      errors.storeName = 'El nombre de la tienda o negocio es obligatorio.';
    }

    if (!formData.ownerName?.trim()) {
      errors.ownerName = 'El nombre del contacto o dueño es obligatorio.';
    }

    if (!formData.address?.trim()) {
      errors.address = 'La dirección de entrega es obligatoria.';
    }

    if (!formData.city?.trim()) {
      errors.city = 'La ciudad o municipio es obligatorio.';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      const customerToSave: Customer = {
        ...formData,
        phone: cleanPhone,
        id: editingCustomer ? editingCustomer.id : `cli-${cleanPhone}`,
        createdAt: editingCustomer ? editingCustomer.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await saveCustomerToCloud(customerToSave);
      setIsModalOpen(false);
      showNotification(
        editingCustomer
          ? `¡Cliente "${customerToSave.storeName}" actualizado correctamente!`
          : `¡Cliente "${customerToSave.storeName}" registrado exitosamente!`
      );
    } catch (err: any) {
      console.error('Error saving customer:', err);
      alert(`Error al guardar cliente: ${err?.message || 'Error desconocido'}`);
    }
  };

  // Delete customer
  const handleDeleteCustomer = async (customerId: string, storeName: string) => {
    try {
      await deleteCustomerFromCloud(customerId);
      setDeleteConfirmId(null);
      showNotification(`Cliente "${storeName}" eliminado del directorio.`);
    } catch (err: any) {
      console.error('Error deleting customer:', err);
      alert(`Error al eliminar cliente: ${err?.message || 'Error desconocido'}`);
    }
  };

  // -------------------------------------------------------------
  // EXCEL EXPORT & TEMPLATE
  // -------------------------------------------------------------
  const handleExportExcel = async () => {
    if (customers.length === 0) {
      alert('No hay clientes registrados para exportar.');
      return;
    }
    try {
      setIsExportingExcel(true);
      await exportCustomersToExcel(customers);
      showNotification(`¡Directorio de ${customers.length} clientes exportado a Excel (.xlsx) exitosamente!`);
    } catch (err: any) {
      console.error('Error exporting customers to Excel:', err);
      alert(`Error al exportar clientes a Excel: ${err?.message || 'Error desconocido'}`);
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      setIsDownloadingTemplate(true);
      await downloadCustomerExcelTemplate();
      showNotification('¡Plantilla oficial de clientes (.xlsx) descargada con éxito!');
    } catch (err: any) {
      console.error('Error downloading customer Excel template:', err);
      alert(`Error al descargar plantilla de clientes: ${err?.message || 'Error desconocido'}`);
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  // -------------------------------------------------------------
  // EXCEL IMPORT WORKFLOW
  // -------------------------------------------------------------
  const handleSelectExcelFile = async (file: File) => {
    try {
      setIsImportingExcel(true);
      const result = await parseCustomersFromExcel(file);
      if (result.validRows === 0) {
        alert(
          result.errors.length > 0
            ? `No se encontraron clientes válidos en el archivo.\n\nDetalles:\n${result.errors.slice(0, 5).join('\n')}`
            : 'El archivo no contiene filas con datos de clientes válidos (se requiere al menos WhatsApp y Nombre de Tienda).'
        );
        return;
      }
      setExcelImportResult(result);
      setExcelImportFile(file);
      setShowExcelImportModal(true);
    } catch (err: any) {
      console.error('Error parsing customer Excel file:', err);
      alert(`Error al leer archivo Excel: ${err?.message || 'Archivo no compatible o formato inválido'}`);
    } finally {
      setIsImportingExcel(false);
    }
  };

  const handleConfirmExcelImport = async () => {
    if (!excelImportResult || isImportingCustomers) return;

    try {
      setIsImportingCustomers(true);
      setImportProgress({
        processed: 0,
        total: excelImportResult.customers.length,
        percent: 0,
        message: 'Preparando sincronización y validando registros...',
      });

      await batchImportCustomersToCloud(
        excelImportResult.customers,
        excelImportMode,
        (processed, total, message) => {
          const percent = total > 0 ? Math.round((processed / total) * 100) : 0;
          setImportProgress({ processed, total, percent, message });
        }
      );

      setShowExcelImportModal(false);
      setExcelImportResult(null);
      setExcelImportFile(null);
      setImportProgress(null);

      showNotification(
        excelImportMode === 'replace'
          ? `¡Directorio reemplazado con ${excelImportResult.customers.length.toLocaleString('es-CO')} clientes desde Excel!`
          : `¡${excelImportResult.customers.length.toLocaleString('es-CO')} clientes importados y actualizados exitosamente!`
      );
    } catch (err: any) {
      console.error('Error during customer batch import:', err);
      alert(`Error al importar clientes a la base de datos: ${err?.message || 'Error desconocido'}`);
    } finally {
      setIsImportingCustomers(false);
    }
  };

  // Bulk import from pasted text
  const handleBulkImportText = async () => {
    if (!importText.trim()) {
      setImportStatus('Pega o escribe al menos una línea de datos.');
      return;
    }

    try {
      setIsImportingCustomers(true);
      const lines = importText.split('\n').filter((l) => l.trim().length > 0);
      const parsedCustomers: Customer[] = [];

      for (const line of lines) {
        // Supports tab-separated (from Excel) or comma/semicolon separated
        const parts = line.includes('\t')
          ? line.split('\t')
          : line.includes(';')
          ? line.split(';')
          : line.split(',');

        if (parts.length >= 2) {
          const phone = normalizePhone(parts[0].trim());
          const storeName = parts[1]?.trim();
          const ownerName = parts[2]?.trim() || storeName;
          const address = parts[3]?.trim() || 'Dirección por confirmar';
          const city = parts[4]?.trim() || 'Bucaramanga';
          const paymentMethod = (parts[5]?.trim().toLowerCase() as any) || 'contraentrega';
          const notes = parts[6]?.trim() || '';

          if (phone && storeName) {
            parsedCustomers.push({
              id: `cli-${phone}`,
              phone,
              storeName,
              ownerName,
              address,
              city,
              paymentMethod: ['contraentrega', 'transferencia', 'credito'].includes(paymentMethod)
                ? paymentMethod
                : 'contraentrega',
              notes,
              status: 'active',
              ordersCount: 0,
              totalSpent: 0,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }
        }
      }

      if (parsedCustomers.length === 0) {
        setImportStatus('No se detectaron clientes válidos. Formato: WhatsApp, Tienda, Dueño, Dirección, Ciudad');
        setIsImportingCustomers(false);
        return;
      }

      await batchImportCustomersToCloud(parsedCustomers, 'merge');
      setShowExcelImportModal(false);
      setImportText('');
      setImportStatus(null);
      showNotification(`¡Se importaron ${parsedCustomers.length} clientes correctamente a la base de datos!`);
    } catch (err: any) {
      console.error('Error importing customers from text:', err);
      setImportStatus(`Error al importar: ${err?.message || 'Error desconocido'}`);
    } finally {
      setIsImportingCustomers(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Action Notification Banner */}
      {actionSuccessNotice && (
        <div className="bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 animate-in fade-in shadow-xs">
          <CheckCircle2 className="w-4 h-4" />
          <span>{actionSuccessNotice}</span>
        </div>
      )}

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="bg-white border border-gray-200/80 rounded-xl p-3 shadow-2xs">
          <div className="flex items-center justify-between text-gray-500 mb-1">
            <span className="text-[10px] uppercase font-bold tracking-wider">Total Clientes</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900">{totalCustomers}</div>
          <span className="text-[10px] text-emerald-600 font-semibold">{activeCustomers} activos</span>
        </div>

        <div className="bg-white border border-gray-200/80 rounded-xl p-3 shadow-2xs">
          <div className="flex items-center justify-between text-gray-500 mb-1">
            <span className="text-[10px] uppercase font-bold tracking-wider">Ciudades / Zonas</span>
            <MapPin className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900">{uniqueCities.length || 1}</div>
          <span className="text-[10px] text-gray-400 font-medium truncate block max-w-full">
            {uniqueCities.slice(0, 2).join(', ')} {uniqueCities.length > 2 ? `+${uniqueCities.length - 2}` : ''}
          </span>
        </div>

        <div className="bg-white border border-gray-200/80 rounded-xl p-3 shadow-2xs">
          <div className="flex items-center justify-between text-gray-500 mb-1">
            <span className="text-[10px] uppercase font-bold tracking-wider">Pedidos Totales</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900">{totalOrdersPlaced}</div>
          <span className="text-[10px] text-gray-400 font-medium">Registrados en sistema</span>
        </div>

        <div className="bg-white border border-emerald-200/80 rounded-xl p-3 shadow-2xs bg-emerald-50/20">
          <div className="flex items-center justify-between text-emerald-800 mb-1">
            <span className="text-[10px] uppercase font-bold tracking-wider">Ventas Acumuladas</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-base sm:text-lg font-black text-emerald-700">
            {formatCOP(totalSalesFromClients)}
          </div>
          <span className="text-[10px] text-emerald-600/70 font-semibold">Valor clientes registrados</span>
        </div>
      </div>

      {/* Control Bar: Search, Filters & Action Buttons */}
      <div className="bg-white border border-gray-200/90 rounded-2xl p-4 shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por Nombre de Tienda, Dueño, WhatsApp o Ciudad..."
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-600 focus:bg-white focus:outline-hidden transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* New Customer Button */}
            <button
              onClick={handleOpenNewCustomer}
              className="py-2 px-3.5 bg-[#0B4EA2] hover:bg-[#093e82] active:scale-95 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer shrink-0"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ Nuevo Cliente</span>
            </button>

            {/* Download Template Button */}
            <button
              onClick={handleDownloadTemplate}
              disabled={isDownloadingTemplate}
              className="py-2 px-3 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shrink-0"
              title="Descargar plantilla oficial de Excel con ejemplos y guía"
            >
              {isDownloadingTemplate ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-600" />
              ) : (
                <Download className="w-3.5 h-3.5 text-slate-500" />
              )}
              <span className="hidden sm:inline">Plantilla Excel</span>
            </button>

            {/* Export to Excel (.xlsx) Button */}
            <button
              onClick={handleExportExcel}
              disabled={isExportingExcel || customers.length === 0}
              className="py-2 px-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50 shrink-0"
              title="Exportar base de clientes a Excel (.xlsx) formateado"
            >
              {isExportingExcel ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-3.5 h-3.5" />
              )}
              <span>Exportar Excel</span>
            </button>

            {/* Import from Excel Button with Hidden File Input */}
            <label
              className={`py-2 px-3 bg-teal-700 hover:bg-teal-800 active:scale-95 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer shrink-0 ${
                isImportingExcel ? 'opacity-60 pointer-events-none' : ''
              }`}
              title="Importar clientes desde archivo Excel (.xlsx / .xls / .csv)"
            >
              {isImportingExcel ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5" />
              )}
              <span>Importar Excel</span>
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleSelectExcelFile(file);
                    e.target.value = '';
                  }
                }}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 flex-wrap text-xs pt-1 border-t border-gray-100">
          <span className="text-[11px] font-bold text-gray-500 mr-1">Filtrar:</span>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                statusFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              Todos ({customers.length})
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                statusFilter === 'active' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-emerald-700 hover:text-emerald-900'
              }`}
            >
              Activos ({activeCustomers})
            </button>
            <button
              onClick={() => setStatusFilter('inactive')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                statusFilter === 'inactive' ? 'bg-red-600 text-white shadow-2xs' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              Inactivos ({customers.length - activeCustomers})
            </button>
          </div>

          {/* City selector if multiple cities */}
          {uniqueCities.length > 1 && (
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-100 border border-gray-200 rounded-lg text-[11px] font-semibold text-gray-700 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">Todas las Ciudades ({uniqueCities.length})</option>
              {uniqueCities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          )}

          <div className="ml-auto text-[11px] text-gray-400 font-medium">
            Mostrando {filteredCustomers.length} de {customers.length} clientes
          </div>
        </div>
      </div>

      {/* Customer List / Table */}
      {loading ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center text-gray-400 text-xs flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-7 h-7 text-blue-600 animate-spin" />
          <span className="font-semibold text-gray-600">Cargando directorio de clientes...</span>
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-12 text-center space-y-3">
          <Users className="w-10 h-10 text-gray-300 mx-auto" />
          <div className="text-sm font-bold text-slate-800">No se encontraron clientes</div>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            {searchQuery
              ? `No hay clientes que coincidan con "${searchQuery}". Prueba ajustando el término de búsqueda.`
              : 'Aún no has registrado clientes. Haz clic en "+ Nuevo Cliente" o "Importar Excel" para cargar tu directorio.'}
          </p>
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              onClick={handleOpenNewCustomer}
              className="px-4 py-2 bg-[#0B4EA2] text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5"
            >
              <UserPlus className="w-4 h-4" />
              <span>Crear Primer Cliente</span>
            </button>
            <label className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer">
              <Upload className="w-4 h-4" />
              <span>Importar Excel</span>
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleSelectExcelFile(file);
                    e.target.value = '';
                  }
                }}
                className="hidden"
              />
            </label>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filteredCustomers.map((cust) => {
            const isInactive = cust.status === 'inactive';
            const rawPhone = cust.phone || '';
            const waNumber = rawPhone.startsWith('57') ? rawPhone : `57${rawPhone}`;
            const waLink = `https://wa.me/${waNumber}?text=${encodeURIComponent(
              `Hola ${cust.ownerName || cust.storeName}, te saludamos de AYM Distribuciones (aym-districuciones.com). ¿En qué podemos colaborarte hoy con tu pedido?`
            )}`;

            return (
              <div
                key={cust.id}
                className={`bg-white border rounded-2xl p-4 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between ${
                  isInactive ? 'border-gray-200 bg-gray-50/50 opacity-80' : 'border-gray-200/90'
                }`}
              >
                <div>
                  {/* Top Bar: Store Name & Status Badge */}
                  <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#0B4EA2] flex items-center justify-center font-black text-sm shrink-0">
                        <Store className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-xs sm:text-sm leading-tight line-clamp-1">
                          {cust.storeName}
                        </h4>
                        <span className="text-[11px] text-gray-500 font-medium flex items-center gap-1">
                          👤 {cust.ownerName}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                        isInactive
                          ? 'bg-red-50 text-red-700 border border-red-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      {isInactive ? 'Inactivo' : 'Activo'}
                    </span>
                  </div>

                  {/* Customer Information Details */}
                  <div className="py-2.5 space-y-1.5 text-xs text-gray-600">
                    {/* WhatsApp Phone */}
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-gray-400 font-medium">WhatsApp:</span>
                      <a
                        href={waLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-lg flex items-center gap-1 transition-colors"
                        title="Abrir chat directo en WhatsApp"
                      >
                        <Phone className="w-3 h-3 text-emerald-600" />
                        <span>{cust.phone}</span>
                        <ExternalLink className="w-2.5 h-2.5 text-emerald-500" />
                      </a>
                    </div>

                    {/* Address & City */}
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[11px] text-gray-400 font-medium shrink-0">Dirección:</span>
                      <div className="text-right font-medium text-slate-800 text-[11.5px] line-clamp-2">
                        {cust.address}, <span className="font-bold text-blue-700">{cust.city}</span>
                      </div>
                    </div>

                    {/* Payment Method */}
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-gray-400 font-medium">Método de Pago:</span>
                      <span className="font-semibold text-slate-700 capitalize bg-slate-100 px-2 py-0.5 rounded-md text-[10.5px]">
                        {cust.paymentMethod === 'contraentrega'
                          ? '💵 Contraentrega'
                          : cust.paymentMethod === 'transferencia'
                          ? '🏦 Transferencia'
                          : '💳 Crédito'}
                      </span>
                    </div>

                    {/* Special Discount & Credit Limit */}
                    {(cust.discountPercentage || cust.creditLimit) && (
                      <div className="flex items-center justify-between pt-1 border-t border-dashed border-gray-100">
                        {cust.discountPercentage ? (
                          <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-bold">
                            VIP: {cust.discountPercentage}% OFF
                          </span>
                        ) : (
                          <span />
                        )}
                        {cust.creditLimit ? (
                          <span className="text-[10px] text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded font-bold">
                            Cupo: {formatCOP(cust.creditLimit)}
                          </span>
                        ) : null}
                      </div>
                    )}

                    {/* Delivery Notes */}
                    {cust.notes && (
                      <div className="pt-1.5 mt-1 border-t border-gray-100 text-[10.5px] text-gray-500 italic line-clamp-2">
                        💬 "{cust.notes}"
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Footer Actions */}
                <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                  <div className="text-[10px] text-gray-400">
                    <span>{cust.ordersCount || 0} pedidos</span>
                    {cust.totalSpent ? ` • ${formatCOP(cust.totalSpent)}` : ''}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEditCustomer(cust)}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Editar cliente"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    {deleteConfirmId === cust.id ? (
                      <div className="flex items-center gap-1 bg-red-50 p-1 rounded-lg border border-red-200">
                        <span className="text-[10px] font-bold text-red-700">¿Borrar?</span>
                        <button
                          onClick={() => handleDeleteCustomer(cust.id, cust.storeName)}
                          className="p-1 bg-red-600 text-white rounded text-[10px] font-bold hover:bg-red-700"
                        >
                          Sí
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="p-1 bg-gray-200 text-gray-700 rounded text-[10px] font-bold"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirmId(cust.id)}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Eliminar cliente"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT CUSTOMER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-lg w-full overflow-hidden animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Store className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-sm">
                  {editingCustomer ? 'Editar Cliente' : 'Registrar Nuevo Cliente'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-gray-400 hover:text-white rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitCustomer} className="p-5 space-y-3.5 text-xs max-h-[80vh] overflow-y-auto">
              {/* WhatsApp Phone */}
              <div>
                <label className="block font-bold text-gray-700 mb-1 flex items-center justify-between">
                  <span>Número de WhatsApp / Celular *</span>
                  <span className="text-[10px] text-gray-400 font-normal">Identificador único</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-emerald-600 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="Ej. 3113986110"
                    className={`w-full pl-9 pr-3 py-2 border rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-hidden ${
                      formErrors.phone ? 'border-red-500 bg-red-50/20' : 'border-gray-300'
                    }`}
                  />
                </div>
                {formErrors.phone && <p className="text-red-500 text-[10px] mt-1 font-semibold">{formErrors.phone}</p>}
              </div>

              {/* Store Name & Owner Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Nombre Tienda / Negocio *</label>
                  <input
                    type="text"
                    required
                    value={formData.storeName}
                    onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                    placeholder="Ej. Minimarket La 33"
                    className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-hidden ${
                      formErrors.storeName ? 'border-red-500 bg-red-50/20' : 'border-gray-300'
                    }`}
                  />
                  {formErrors.storeName && (
                    <p className="text-red-500 text-[10px] mt-1 font-semibold">{formErrors.storeName}</p>
                  )}
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Nombre del Contacto / Dueño *</label>
                  <input
                    type="text"
                    required
                    value={formData.ownerName}
                    onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                    placeholder="Ej. Carlos Mendoza"
                    className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-hidden ${
                      formErrors.ownerName ? 'border-red-500 bg-red-50/20' : 'border-gray-300'
                    }`}
                  />
                  {formErrors.ownerName && (
                    <p className="text-red-500 text-[10px] mt-1 font-semibold">{formErrors.ownerName}</p>
                  )}
                </div>
              </div>

              {/* Address & City */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-bold text-gray-700 mb-1">Dirección de Entrega *</label>
                  <input
                    type="text"
                    required
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Ej. Calle 36 # 22-15 Barrio San Alonso"
                    className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-hidden ${
                      formErrors.address ? 'border-red-500 bg-red-50/20' : 'border-gray-300'
                    }`}
                  />
                  {formErrors.address && (
                    <p className="text-red-500 text-[10px] mt-1 font-semibold">{formErrors.address}</p>
                  )}
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Ciudad *</label>
                  <input
                    type="text"
                    required
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="Bucaramanga"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Payment Method & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Método de Pago Preferido</label>
                  <select
                    value={formData.paymentMethod}
                    onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  >
                    <option value="contraentrega">💵 Contraentrega (Efectivo)</option>
                    <option value="transferencia">🏦 Transferencia (Bancolombia / Nequi)</option>
                    <option value="credito">💳 Crédito Comercial</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Estado de la Cuenta</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  >
                    <option value="active">🟢 Activo (Puede realizar pedidos)</option>
                    <option value="inactive">🔴 Inactivo / Bloqueado</option>
                  </select>
                </div>
              </div>

              {/* Financial Custom Settings */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-gray-100">
                <div>
                  <label className="block font-bold text-gray-700 mb-1 flex items-center gap-1">
                    <Percent className="w-3.5 h-3.5 text-amber-600" />
                    <span>Descuento VIP (%) (Opcional)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={formData.discountPercentage || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, discountPercentage: parseFloat(e.target.value) || 0 })
                    }
                    placeholder="0%"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1 flex items-center gap-1">
                    <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                    <span>Cupo de Crédito (COP) (Opcional)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="50000"
                    value={formData.creditLimit || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, creditLimit: parseInt(e.target.value, 10) || 0 })
                    }
                    placeholder="$0 COP"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Delivery Notes / Special instructions */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">Notas de Entrega / Horarios de Atención</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Ej. Reciben pedidos antes de las 11am, preguntar por Don Pedro en caja..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                />
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0B4EA2] hover:bg-[#093e82] text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{editingCustomer ? 'Guardar Cambios' : 'Registrar Cliente'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EXCEL & BULK IMPORT MODAL */}
      {showExcelImportModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-gray-200 animate-in zoom-in-95">
            {/* Header */}
            <div className="bg-slate-900 text-white p-4 px-5 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Importar Directorio de Clientes</h3>
                  <p className="text-[11px] text-slate-300">
                    {excelImportFile ? (
                      <>
                        Archivo: <span className="font-semibold text-teal-300">{excelImportFile.name}</span>
                      </>
                    ) : (
                      'Carga masiva vía Excel (.xlsx / .xls) o texto'
                    )}
                  </p>
                </div>
              </div>
              <button
                disabled={isImportingCustomers}
                onClick={() => {
                  setShowExcelImportModal(false);
                  setExcelImportResult(null);
                  setExcelImportFile(null);
                  setImportStatus(null);
                }}
                className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Method Tabs */}
            <div className="bg-slate-100 px-5 pt-2 flex items-center gap-2 border-b border-gray-200 flex-shrink-0">
              <button
                onClick={() => setImportMethodTab('excel')}
                className={`px-4 py-2 font-bold text-xs rounded-t-xl transition-all border-b-2 flex items-center gap-1.5 ${
                  importMethodTab === 'excel'
                    ? 'bg-white text-teal-800 border-teal-600 shadow-2xs'
                    : 'text-gray-500 border-transparent hover:text-gray-800'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4 text-teal-600" />
                <span>Archivo Excel (.xlsx / .xls)</span>
              </button>
              <button
                onClick={() => setImportMethodTab('text')}
                className={`px-4 py-2 font-bold text-xs rounded-t-xl transition-all border-b-2 flex items-center gap-1.5 ${
                  importMethodTab === 'text'
                    ? 'bg-white text-blue-800 border-blue-600 shadow-2xs'
                    : 'text-gray-500 border-transparent hover:text-gray-800'
                }`}
              >
                <Table className="w-4 h-4 text-blue-600" />
                <span>Copiar y Pegar Texto</span>
              </button>
            </div>

            {/* Body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
              {importMethodTab === 'excel' ? (
                <>
                  {excelImportResult ? (
                    <>
                      {/* Stats Summary Cards */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                        <div className="bg-teal-50 border border-teal-200 rounded-xl p-2.5">
                          <span className="text-[10px] uppercase font-bold text-teal-800 block">
                            Clientes Válidos
                          </span>
                          <span className="text-lg font-black text-teal-700">
                            {excelImportResult.validRows.toLocaleString('es-CO')}
                          </span>
                        </div>

                        <div className="bg-purple-50 border border-purple-200 rounded-xl p-2.5">
                          <span className="text-[10px] uppercase font-bold text-purple-800 block">
                            Ciudades Detectadas
                          </span>
                          <span className="text-lg font-black text-purple-700">
                            {excelImportResult.cities.length}
                          </span>
                        </div>

                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                          <span className="text-[10px] uppercase font-bold text-slate-600 block">Total Filas</span>
                          <span className="text-lg font-black text-slate-800">
                            {excelImportResult.totalRows.toLocaleString('es-CO')}
                          </span>
                        </div>

                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5">
                          <span className="text-[10px] uppercase font-bold text-amber-800 block">
                            Directorio Actual
                          </span>
                          <span className="text-lg font-black text-amber-700">
                            {customers.length.toLocaleString('es-CO')}
                          </span>
                        </div>
                      </div>

                      {/* Cities Badge List */}
                      {excelImportResult.cities.length > 0 && (
                        <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl text-purple-900">
                          <span className="font-bold block mb-1">
                            📍 Ciudades y zonas encontradas en el archivo:
                          </span>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {excelImportResult.cities.map((city, idx) => (
                              <span
                                key={idx}
                                className="bg-white border border-purple-300 text-purple-800 px-2 py-0.5 rounded-full font-bold text-[10px]"
                              >
                                {city}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Errors or Skipped Rows Notice */}
                      {excelImportResult.errors.length > 0 && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 space-y-1">
                          <div className="flex items-center gap-1.5 font-bold text-amber-800">
                            <AlertTriangle className="w-4 h-4 text-amber-600" />
                            <span>{excelImportResult.errors.length} filas omitidas por datos incompletos o número inválido:</span>
                          </div>
                          <div className="max-h-24 overflow-y-auto divide-y divide-amber-200/60 font-mono text-[10.5px]">
                            {excelImportResult.errors.map((err, idx) => (
                              <div key={idx} className="py-1">
                                • {err}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Mode Selector */}
                      <div className="space-y-2">
                        <label className="font-bold text-slate-900 block text-xs">
                          ¿Cómo deseas procesar los clientes importados?
                        </label>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div
                            onClick={() => setExcelImportMode('merge')}
                            className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
                              excelImportMode === 'merge'
                                ? 'border-teal-600 bg-teal-50/60 shadow-xs'
                                : 'border-gray-200 hover:border-gray-300 bg-white'
                            }`}
                          >
                            <div className="flex items-center gap-2 font-bold text-slate-900">
                              <input
                                type="radio"
                                name="customerImportMode"
                                checked={excelImportMode === 'merge'}
                                onChange={() => setExcelImportMode('merge')}
                                className="text-teal-600 focus:ring-teal-500"
                              />
                              <span>Fusionar y Actualizar (Recomendado)</span>
                            </div>
                            <p className="text-[11px] text-gray-500 mt-1 pl-5">
                              Actualiza información de clientes existentes (por WhatsApp/ID) y agrega a los clientes nuevos sin borrar los actuales.
                            </p>
                          </div>

                          <div
                            onClick={() => setExcelImportMode('replace')}
                            className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
                              excelImportMode === 'replace'
                                ? 'border-red-600 bg-red-50/60 shadow-xs'
                                : 'border-gray-200 hover:border-gray-300 bg-white'
                            }`}
                          >
                            <div className="flex items-center gap-2 font-bold text-slate-900">
                              <input
                                type="radio"
                                name="customerImportMode"
                                checked={excelImportMode === 'replace'}
                                onChange={() => setExcelImportMode('replace')}
                                className="text-red-600 focus:ring-red-500"
                              />
                              <span>Reemplazar Directorio Completo</span>
                            </div>
                            <p className="text-[11px] text-gray-500 mt-1 pl-5">
                              Elimina todos los clientes actuales de la base de datos y los sustituye exclusivamente por los de este archivo Excel.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Preview Table of Rows */}
                      <div className="border border-gray-200 rounded-xl overflow-hidden">
                        <div className="bg-slate-100 px-3 py-2 border-b border-gray-200 font-bold text-slate-700 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 text-[11px]">
                          <span>
                            Vista previa ({Math.min(10, excelImportResult.customers.length)} de{' '}
                            {excelImportResult.customers.length} clientes detectados):
                          </span>
                          <input
                            type="text"
                            value={importPreviewSearch}
                            onChange={(e) => setImportPreviewSearch(e.target.value)}
                            placeholder="Filtrar en vista previa..."
                            className="px-2 py-1 bg-white border border-gray-300 rounded text-[11px] max-w-xs focus:outline-hidden"
                          />
                        </div>
                        <div className="divide-y divide-gray-100 max-h-52 overflow-y-auto">
                          {excelImportResult.customers
                            .filter((c) => {
                              if (!importPreviewSearch.trim()) return true;
                              const q = importPreviewSearch.toLowerCase();
                              return (
                                c.storeName.toLowerCase().includes(q) ||
                                c.ownerName.toLowerCase().includes(q) ||
                                c.phone.includes(q) ||
                                c.city.toLowerCase().includes(q)
                              );
                            })
                            .slice(0, 15)
                            .map((c, idx) => (
                              <div
                                key={idx}
                                className="p-2.5 flex items-center justify-between text-xs hover:bg-gray-50 gap-2"
                              >
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-slate-900 truncate">{c.storeName}</span>
                                    <span className="text-[10px] text-gray-400 shrink-0">({c.ownerName})</span>
                                  </div>
                                  <div className="text-[10.5px] text-gray-500 flex items-center gap-2 flex-wrap">
                                    <span>📍 {c.address}, {c.city}</span>
                                    <span>•</span>
                                    <span className="capitalize">{c.paymentMethod}</span>
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <span className="font-mono font-bold text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded text-[10.5px] block">
                                    📱 {c.phone}
                                  </span>
                                  {(c.discountPercentage || c.creditLimit) && (
                                    <div className="text-[9.5px] text-amber-700 font-bold mt-0.5">
                                      {c.discountPercentage ? `${c.discountPercentage}% OFF ` : ''}
                                      {c.creditLimit ? `Cupo: ${formatCOP(c.creditLimit)}` : ''}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    /* Dropzone & Upload Picker */
                    <div className="space-y-4">
                      <div className="border-2 border-dashed border-teal-300 hover:border-teal-500 rounded-2xl p-8 text-center bg-teal-50/30 transition-colors">
                        <div className="w-12 h-12 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center mx-auto mb-3">
                          <FileSpreadsheet className="w-6 h-6" />
                        </div>
                        <h4 className="font-bold text-sm text-slate-800 mb-1">
                          Selecciona o arrastra tu archivo Excel de Clientes
                        </h4>
                        <p className="text-xs text-gray-500 max-w-md mx-auto mb-4">
                          Soporta hojas de cálculo en formato <strong>.xlsx</strong>, <strong>.xls</strong> o <strong>.csv</strong>. Reconoce automáticamente columnas sin importar mayúsculas, minúsculas o tildes.
                        </p>
                        <div className="flex items-center justify-center gap-2 flex-wrap">
                          <label className="px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-xl text-xs flex items-center gap-2 cursor-pointer shadow-sm transition-all">
                            <Upload className="w-4 h-4" />
                            <span>Cargar Archivo Excel</span>
                            <input
                              type="file"
                              accept=".xlsx, .xls, .csv"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  handleSelectExcelFile(file);
                                  e.target.value = '';
                                }
                              }}
                              className="hidden"
                            />
                          </label>
                          <button
                            type="button"
                            onClick={handleDownloadTemplate}
                            disabled={isDownloadingTemplate}
                            className="px-4 py-2.5 bg-white border border-gray-300 hover:bg-gray-50 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors"
                          >
                            <Download className="w-3.5 h-3.5 text-slate-500" />
                            <span>Descargar Plantilla Oficial</span>
                          </button>
                        </div>
                      </div>

                      {/* Structure Guidelines reference table */}
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                        <h5 className="font-bold text-slate-800 text-xs flex items-center gap-1.5 mb-2">
                          <Info className="w-4 h-4 text-blue-600" />
                          Columnas reconocidas automáticamente en el Excel:
                        </h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-gray-600">
                          <div>• <strong>WhatsApp / Celular:</strong> 10 dígitos (Obligatorio)</div>
                          <div>• <strong>Nombre Tienda / Negocio:</strong> Nombre comercial (Obligatorio)</div>
                          <div>• <strong>Contacto / Dueño:</strong> Nombre persona (Recomendado)</div>
                          <div>• <strong>Dirección de Entrega:</strong> Calle y barrio (Recomendado)</div>
                          <div>• <strong>Ciudad / Municipio:</strong> Bucaramanga, Floridablanca, etc.</div>
                          <div>• <strong>Método de Pago:</strong> contraentrega, transferencia, credito</div>
                          <div>• <strong>Descuento VIP (%):</strong> ej. 5 o 10</div>
                          <div>• <strong>Cupo Crédito ($ COP):</strong> ej. 500000 o 1000000</div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* Text Bulk Import Tab */
                <div className="space-y-3">
                  <p className="text-gray-600 leading-relaxed">
                    Pega tus clientes directamente copiados desde Excel o un bloc de notas.
                    <br />
                    <strong>Columnas sugeridas por fila:</strong>{' '}
                    <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-700 font-mono">
                      WhatsApp, Nombre Tienda, Nombre Dueño, Dirección, Ciudad, Método Pago, Notas
                    </code>
                  </p>

                  {importStatus && (
                    <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs font-semibold">
                      {importStatus}
                    </div>
                  )}

                  <textarea
                    rows={8}
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    placeholder="3113986110	Minimarket Don Pedro	Pedro Gomez	Carrera 15 # 45-20	Bucaramanga	contraentrega&#10;3158742190	Tienda La Esquina	Maria Restrepo	Calle 32 # 18-50	Floridablanca	transferencia"
                    className="w-full p-3 font-mono text-[11px] bg-slate-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:bg-white focus:outline-hidden"
                  />
                </div>
              )}

              {/* Real-time Progress Bar */}
              {isImportingCustomers && importProgress && (
                <div className="bg-slate-900 text-white p-4 rounded-xl space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-teal-300">{importProgress.message}</span>
                    <span className="text-white font-mono">{importProgress.percent}%</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-teal-500 h-2 transition-all duration-300 rounded-full"
                      style={{ width: `${importProgress.percent}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-slate-400 text-right font-mono">
                    {importProgress.processed} de {importProgress.total} registros guardados
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-5 py-3 border-t border-gray-200 flex items-center justify-between flex-shrink-0">
              <button
                type="button"
                disabled={isImportingCustomers}
                onClick={() => {
                  setShowExcelImportModal(false);
                  setExcelImportResult(null);
                  setExcelImportFile(null);
                  setImportStatus(null);
                }}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-xl text-xs disabled:opacity-50 transition-colors"
              >
                Cancelar
              </button>

              {importMethodTab === 'excel' && excelImportResult ? (
                <button
                  type="button"
                  disabled={isImportingCustomers}
                  onClick={handleConfirmExcelImport}
                  className={`px-5 py-2 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer text-white ${
                    excelImportMode === 'replace'
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-teal-700 hover:bg-teal-800'
                  } disabled:opacity-50`}
                >
                  {isImportingCustomers ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Guardando en base local...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>
                        {excelImportMode === 'replace'
                          ? `Reemplazar con ${excelImportResult.customers.length} Clientes`
                          : `Importar ${excelImportResult.customers.length} Clientes`}
                      </span>
                    </>
                  )}
                </button>
              ) : importMethodTab === 'text' ? (
                <button
                  type="button"
                  disabled={isImportingCustomers || !importText.trim()}
                  onClick={handleBulkImportText}
                  className="px-5 py-2 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  {isImportingCustomers ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Importando...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span>Procesar Texto e Importar</span>
                    </>
                  )}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
