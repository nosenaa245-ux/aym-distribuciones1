import React, { useState, useEffect } from 'react';
import {
  Phone,
  Store,
  MapPin,
  CheckCircle2,
  X,
  Search,
  UserCheck,
  UserPlus,
  ArrowRight,
  ShieldCheck,
  LogOut,
  Building2,
  User,
  UserX,
  Sparkles,
  Percent,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { Customer } from '../types';
import {
  findCustomerByPhoneLocal,
  searchCustomersLocal,
  normalizePhone,
  saveCustomerLocal
} from '../lib/localDatabase';

interface CustomerIdentificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCustomer: Customer | null;
  onCustomerIdentified: (customer: Customer | null) => void;
}

export const CustomerIdentificationModal: React.FC<CustomerIdentificationModalProps> = ({
  isOpen,
  onClose,
  currentCustomer,
  onCustomerIdentified,
}) => {
  // Search query input (can be phone, store name, or owner name)
  const [searchInput, setSearchInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [matchedCustomers, setMatchedCustomers] = useState<Customer[]>([]);
  const [searchedCustomer, setSearchedCustomer] = useState<Customer | null>(null);
  const [isNewRegistration, setIsNewRegistration] = useState(false);
  const [searchAttempted, setSearchAttempted] = useState(false);
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  // New registration form state
  const [regStoreName, setRegStoreName] = useState('');
  const [regOwnerName, setRegOwnerName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [regCity, setRegCity] = useState('Bucaramanga');
  const [regPaymentMethod, setRegPaymentMethod] = useState<'contraentrega' | 'transferencia' | 'credito'>('contraentrega');
  const [regNotes, setRegNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSearchInput(currentCustomer?.phone || currentCustomer?.storeName || '');
      setSearchedCustomer(currentCustomer || null);
      setMatchedCustomers(currentCustomer ? [currentCustomer] : []);
      setIsNewRegistration(false);
      setSearchAttempted(false);
      setFormError(null);
      setFeedbackNotice(null);
    }
  }, [isOpen, currentCustomer]);

  if (!isOpen) return null;

  const performSearch = async (termToSearch?: string) => {
    const raw = (termToSearch !== undefined ? termToSearch : searchInput).trim();
    if (!raw || raw.length < 2) {
      setFormError('Por favor escribe al menos 2 caracteres (nombre de tu tienda, contacto o WhatsApp).');
      return;
    }

    setFormError(null);
    setFeedbackNotice(null);
    setIsSearching(true);
    setSearchAttempted(true);

    try {
      // 1. If it's a pure 10-digit number, try exact phone lookup first
      const cleanDigits = normalizePhone(raw);
      if (cleanDigits.length >= 7 && /^\d+$/.test(raw.replace(/\D/g, ''))) {
        const exactPhone = await findCustomerByPhoneLocal(cleanDigits);
        if (exactPhone) {
          setSearchedCustomer(exactPhone);
          setMatchedCustomers([exactPhone]);
          setIsNewRegistration(false);
          setIsSearching(false);
          return;
        }
      }

      // 2. Otherwise or in addition, do multi-field search (store name, owner name, phone, city)
      const results = await searchCustomersLocal(raw);
      setMatchedCustomers(results);

      if (results.length === 1) {
        setSearchedCustomer(results[0]);
        setIsNewRegistration(false);
      } else if (results.length > 1) {
        setSearchedCustomer(null);
        setIsNewRegistration(false);
      } else {
        // No results found -> offer registration
        setSearchedCustomer(null);
        setIsNewRegistration(true);

        // Pre-fill fields intelligently
        if (cleanDigits && cleanDigits.length >= 7) {
          setRegPhone(cleanDigits);
        } else {
          setRegStoreName(raw);
        }
      }
    } catch (e) {
      console.error(e);
      setFormError('Error al buscar. Inténtalo de nuevo.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchInput(val);
    setSearchAttempted(false);
    setFormError(null);

    // If typing 10 digits directly, auto-search
    const cleanDigits = normalizePhone(val);
    if (cleanDigits.length === 10 && /^\d+$/.test(val.replace(/\s|-/g, ''))) {
      performSearch(cleanDigits);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      performSearch();
    }
  };

  const handleConfirmCustomer = (cust: Customer) => {
    onCustomerIdentified(cust);
    onClose();
  };

  const handleStartNewRegistration = () => {
    setIsNewRegistration(true);
    setSearchedCustomer(null);
    setMatchedCustomers([]);
    setSearchAttempted(true);

    const clean = normalizePhone(searchInput);
    if (clean && clean.length >= 7) {
      setRegPhone(clean);
    } else if (searchInput.trim()) {
      setRegStoreName(searchInput.trim());
    }
  };

  const handleRegisterNewCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = normalizePhone(regPhone || searchInput);
    if (!cleanPhone || cleanPhone.length < 7) {
      setFormError('Ingresa un número de WhatsApp válido (mínimo 7 a 10 dígitos).');
      return;
    }
    if (!regStoreName.trim()) {
      setFormError('Ingresa el nombre de tu tienda o negocio.');
      return;
    }
    if (!regOwnerName.trim()) {
      setFormError('Ingresa el nombre del propietario o contacto.');
      return;
    }
    if (!regAddress.trim()) {
      setFormError('Ingresa la dirección de entrega.');
      return;
    }

    try {
      const newCust: Customer = {
        id: `cli-${cleanPhone}`,
        phone: cleanPhone,
        storeName: regStoreName.trim(),
        ownerName: regOwnerName.trim(),
        address: regAddress.trim(),
        city: regCity.trim() || 'Bucaramanga',
        paymentMethod: regPaymentMethod,
        notes: regNotes.trim(),
        status: 'active',
        ordersCount: 0,
        totalSpent: 0,
        createdAt: new Date().toISOString(),
      };

      await saveCustomerLocal(newCust);
      onCustomerIdentified(newCust);
      onClose();
    } catch (err: any) {
      console.error('Error registering customer:', err);
      setFormError(`Error al guardar: ${err?.message || 'Inténtalo de nuevo'}`);
    }
  };

  // Explicitly remove the customer because of a mistake or logout
  const handleRemoveCustomer = () => {
    onCustomerIdentified(null);
    setSearchedCustomer(null);
    setMatchedCustomers([]);
    setSearchInput('');
    setIsNewRegistration(false);
    setSearchAttempted(false);
    setFeedbackNotice('El cliente ha sido desvinculado con éxito. Ahora puedes buscar otro o hacer un pedido manual.');
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 max-w-lg w-full overflow-hidden animate-in zoom-in-95 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-[#0B4EA2] text-white p-5 relative shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base tracking-tight">Identificación de Cliente</h3>
              <span className="text-blue-200 text-xs font-medium">AYM Distribuciones</span>
            </div>
          </div>
          <p className="text-xs text-blue-100 mt-2 leading-relaxed">
            Busca tu negocio por <strong>Nombre</strong> o <strong>WhatsApp</strong> para cargar automáticamente tus datos en cada pedido.
          </p>
        </div>

        <div className="p-5 space-y-4 text-xs overflow-y-auto flex-1">
          {/* Feedback notice when customer is removed */}
          {feedbackNotice && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-3 rounded-2xl flex items-center justify-between gap-2 animate-in fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-[11.5px] font-semibold">{feedbackNotice}</span>
              </div>
              <button
                type="button"
                onClick={() => setFeedbackNotice(null)}
                className="text-emerald-700 hover:text-emerald-950 font-bold p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Active Identified Customer Badge if already logged in */}
          {currentCustomer && !searchAttempted && !searchedCustomer && (
            <div className="bg-emerald-50/90 border border-emerald-200 rounded-2xl p-4 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-800 uppercase flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-emerald-600" />
                  Cliente Activo en Sesión
                </span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                  Identificado
                </span>
              </div>
              <div className="bg-white/80 p-3 rounded-xl border border-emerald-100 space-y-1">
                <h4 className="text-sm font-black text-slate-900">{currentCustomer.storeName}</h4>
                <p className="text-gray-600 text-xs">
                  {currentCustomer.ownerName} • {currentCustomer.address}, {currentCustomer.city}
                </p>
                <div className="text-emerald-700 font-bold text-[11px] flex items-center gap-1">
                  <Phone className="w-3 h-3 text-emerald-600" />
                  +57 {currentCustomer.phone}
                </div>
              </div>

              {/* Action buttons including Quitar Cliente */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Continuar Comprando</span>
                </button>

                <button
                  type="button"
                  onClick={handleRemoveCustomer}
                  className="py-2.5 px-3 bg-white hover:bg-rose-50 text-rose-700 hover:text-rose-800 border border-rose-200 hover:border-rose-300 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                  title="Quitar este cliente si te has equivocado de negocio"
                >
                  <UserX className="w-4 h-4 text-rose-600" />
                  <span>Quitar Cliente (Me equivoqué)</span>
                </button>
              </div>
            </div>
          )}

          {/* Search Bar Input (Name or Phone) */}
          <div>
            <label className="block font-bold text-gray-700 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Search className="w-3.5 h-3.5 text-blue-600" />
                Buscar por Nombre, Negocio o WhatsApp
              </span>
              {currentCustomer && (
                <button
                  type="button"
                  onClick={handleRemoveCustomer}
                  className="text-rose-600 hover:text-rose-800 font-bold text-[11px] underline flex items-center gap-0.5 cursor-pointer"
                >
                  <UserX className="w-3 h-3" />
                  <span>Quitar cliente actual</span>
                </button>
              )}
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  id="input-customer-search"
                  type="text"
                  value={searchInput}
                  onChange={handleSearchInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Ej: Don Pedro, María, 3113986110... (F10)"
                  className="w-full pl-3.5 pr-3 py-2.5 bg-slate-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:bg-white focus:outline-hidden font-bold text-sm tracking-normal text-slate-900 placeholder:text-gray-400"
                />
              </div>
              <button
                type="button"
                onClick={() => performSearch()}
                disabled={isSearching}
                className="py-2.5 px-4 bg-[#0B4EA2] hover:bg-[#093e82] active:scale-95 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
              >
                {isSearching ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                <span>{isSearching ? 'Buscando...' : 'Buscar'}</span>
              </button>
            </div>
            {formError && (
              <p className="text-red-600 font-bold text-[11px] mt-1.5 bg-red-50 p-2 rounded-lg border border-red-100 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{formError}</span>
              </p>
            )}
          </div>

          {/* Result: Multiple matching customers list */}
          {matchedCustomers.length > 1 && !isNewRegistration && (
            <div className="space-y-2.5 animate-in fade-in">
              <div className="flex items-center justify-between text-xs text-gray-600 font-bold px-1">
                <span>{matchedCustomers.length} clientes encontrados:</span>
                <span className="text-[11px] text-blue-600 font-normal">Toca el tuyo para seleccionarlo</span>
              </div>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {matchedCustomers.map((cust) => (
                  <div
                    key={cust.id}
                    className="p-3 bg-slate-50 hover:bg-blue-50/70 border border-gray-200 hover:border-blue-300 rounded-xl transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                  >
                    <div className="space-y-0.5">
                      <div className="font-black text-sm text-slate-900 flex items-center gap-1.5">
                        <Store className="w-3.5 h-3.5 text-[#0B4EA2] shrink-0" />
                        <span>{cust.storeName}</span>
                      </div>
                      <div className="text-gray-600 text-xs flex items-center gap-1">
                        <User className="w-3 h-3 text-gray-400 shrink-0" />
                        <span>{cust.ownerName}</span>
                      </div>
                      <div className="text-emerald-700 font-bold text-[11px] flex items-center gap-1">
                        <Phone className="w-3 h-3 text-emerald-600 shrink-0" />
                        <span>+57 {cust.phone}</span>
                        <span className="text-gray-400 font-normal ml-1">• {cust.city}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleConfirmCustomer(cust)}
                      className="py-1.5 px-3 bg-[#0B4EA2] hover:bg-[#093e82] text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1 shadow-2xs transition-all shrink-0 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Seleccionar</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Result: Single Existing Customer Found! */}
          {searchedCustomer && !isNewRegistration && (
            <div className="bg-blue-50/80 border border-blue-200 rounded-2xl p-4 space-y-3 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-blue-800 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ¡Cliente Registrado Encontrado!
                </span>
                <span className="text-[10px] bg-blue-200/80 text-blue-900 font-bold px-2 py-0.5 rounded-full">
                  Verificado
                </span>
              </div>

              <div className="bg-white rounded-xl p-3 border border-blue-100 shadow-2xs space-y-1.5">
                <div className="font-black text-sm text-slate-900 flex items-center gap-1.5">
                  <Store className="w-4 h-4 text-[#0B4EA2]" />
                  <span>{searchedCustomer.storeName}</span>
                </div>
                <div className="text-gray-600 text-xs">
                  Propietario / Contacto: <strong>{searchedCustomer.ownerName}</strong>
                </div>
                <div className="text-emerald-700 font-bold text-xs flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-emerald-600" />
                  <span>WhatsApp: +57 {searchedCustomer.phone}</span>
                </div>
                <div className="text-gray-500 text-[11px] flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-red-500 shrink-0" />
                  <span>{searchedCustomer.address}, {searchedCustomer.city}</span>
                </div>
                {searchedCustomer.notes && (
                  <div className="text-[10.5px] text-gray-500 italic mt-1 bg-slate-50 p-1.5 rounded">
                    "{searchedCustomer.notes}"
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => handleConfirmCustomer(searchedCustomer)}
                  className="w-full py-3 bg-[#0B4EA2] hover:bg-[#093e82] text-white font-black text-xs uppercase tracking-wide rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
                >
                  <span>Usar mis datos en la tienda</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <div className="flex items-center justify-between text-xs pt-1 px-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSearchedCustomer(null);
                      setMatchedCustomers([]);
                      setSearchInput('');
                    }}
                    className="text-gray-500 hover:text-gray-800 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>Buscar otro negocio</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleRemoveCustomer}
                    className="text-rose-600 hover:text-rose-800 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <UserX className="w-3.5 h-3.5" />
                    <span>No soy yo / Quitar</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Quick link to register if not in registration mode */}
          {!isNewRegistration && !searchedCustomer && matchedCustomers.length === 0 && searchAttempted && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3 text-center animate-in fade-in">
              <div className="w-10 h-10 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto">
                <Store className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-xs">No encontramos clientes con "{searchInput}"</h4>
                <p className="text-gray-600 text-[11px] mt-0.5">
                  ¿Es la primera vez que compras en AYM Distribuciones? Regístrate en 30 segundos.
                </p>
              </div>
              <button
                type="button"
                onClick={handleStartNewRegistration}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>Registrar mi tienda ahora</span>
              </button>
            </div>
          )}

          {/* Manual Register Link for convenience */}
          {!isNewRegistration && !searchedCustomer && (
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={handleStartNewRegistration}
                className="text-xs font-bold text-blue-700 hover:text-blue-900 hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>¿Primera vez? Regístrate como cliente nuevo aquí</span>
              </button>
            </div>
          )}

          {/* Result 2: New Customer Self-Registration Form */}
          {isNewRegistration && (
            <form onSubmit={handleRegisterNewCustomer} className="space-y-3 pt-2 border-t border-gray-100 animate-in fade-in">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-emerald-950 flex items-start justify-between gap-2">
                <div>
                  <div className="font-bold flex items-center gap-1.5 text-xs mb-0.5">
                    <UserPlus className="w-4 h-4 text-emerald-700" />
                    <span>Registro de Nuevo Cliente</span>
                  </div>
                  <p className="text-[11px] text-emerald-800 leading-snug">
                    Completa los datos de tu tienda una sola vez y quedarán guardados para todos tus pedidos.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsNewRegistration(false);
                    setSearchAttempted(false);
                  }}
                  className="text-xs text-gray-500 hover:text-gray-800 font-bold underline cursor-pointer"
                >
                  Volver
                </button>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Nombre de tu Tienda / Negocio *</label>
                <input
                  type="text"
                  required
                  value={regStoreName}
                  onChange={(e) => setRegStoreName(e.target.value)}
                  placeholder="Ej. Tienda Los Álamos / Autoservicio Central"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-hidden text-xs font-semibold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Nombre de Contacto *</label>
                  <input
                    type="text"
                    required
                    value={regOwnerName}
                    onChange={(e) => setRegOwnerName(e.target.value)}
                    placeholder="Ej. Carlos Ramírez"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-hidden text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Número de WhatsApp *</label>
                  <input
                    type="tel"
                    required
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="3113986110"
                    maxLength={12}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-hidden text-xs font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Dirección de Entrega *</label>
                  <input
                    type="text"
                    required
                    value={regAddress}
                    onChange={(e) => setRegAddress(e.target.value)}
                    placeholder="Calle 45 # 12-34 Barrio..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-hidden text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Ciudad / Municipio *</label>
                  <input
                    type="text"
                    required
                    value={regCity}
                    onChange={(e) => setRegCity(e.target.value)}
                    placeholder="Bucaramanga"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-hidden text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Método de Pago Habitual</label>
                <select
                  value={regPaymentMethod}
                  onChange={(e) => setRegPaymentMethod(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-hidden bg-white text-xs"
                >
                  <option value="contraentrega">💵 Contraentrega (Efectivo al recibir pedido)</option>
                  <option value="transferencia">🏦 Transferencia Bancolombia / Nequi</option>
                  <option value="credito">💳 Crédito Comercial AYM</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Observaciones o Horario (Opcional)</label>
                <input
                  type="text"
                  value={regNotes}
                  onChange={(e) => setRegNotes(e.target.value)}
                  placeholder="Ej. Reciben pedidos de 8:00 am a 12:00 m"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-hidden text-xs"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-black text-xs uppercase tracking-wide rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Guardar y Usar Mis Datos</span>
              </button>
            </form>
          )}

          <div className="pt-2 text-center text-gray-400 text-[11px] flex items-center justify-center gap-1 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Datos protegidos y sincronizados directamente con AYM Distribuciones</span>
          </div>
        </div>
      </div>
    </div>
  );
};

