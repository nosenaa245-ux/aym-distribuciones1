import { Product, Customer, AdminUser, OrderRecord, OrderStatus, CartItem, StoreBranding } from '../types';
import {
  LOCAL_DATABASE,
  INITIAL_PRODUCTS,
  INITIAL_CUSTOMERS,
  DEFAULT_ADMINS,
  INITIAL_ORDERS,
  DEFAULT_BASE_CATEGORIES,
  DEFAULT_BRANDING,
  EmbeddedDatabase,
} from '../data/localDatabase';
import { getIdbItem, setIdbItem } from './indexedDbStorage';

export { DEFAULT_ADMINS };

export const STORAGE_KEYS = {
  PRODUCTS: 'aym_local_db_products',
  CUSTOMERS: 'aym_local_db_customers',
  ADMINS: 'glux_admins_list',
  ORDERS: 'aym_local_db_orders',
  BRANDING: 'aym_store_branding',
  CATEGORIES: 'aym_store_categories',
  ACTIVE_CUSTOMER: 'aym_active_customer',
  LAST_SYNC: 'aym_local_db_last_sync',
};

export type DataMode = 'local' | 'cloud';
export function getDataMode(): DataMode {
  return 'local';
}
export function setDataMode(_mode: DataMode): void {}

// ==================== PHONE UTILS ====================
export function normalizePhone(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  // If starts with 57 and has 12 digits (Colombia country code), normalize to 10 digits
  if (digits.startsWith('57') && digits.length === 12) {
    return digits.substring(2);
  }
  return digits;
}

// ==================== REACTIVE LISTENERS ====================
type Listener<T> = (data: T) => void;
const productListeners = new Set<Listener<Product[]>>();
const customerListeners = new Set<Listener<Customer[]>>();
const orderListeners = new Set<Listener<OrderRecord[]>>();
const adminListeners = new Set<Listener<AdminUser[]>>();
const categoryListeners = new Set<Listener<string[]>>();
const brandingListeners = new Set<Listener<StoreBranding>>();

// In-memory runtime caches for instant synchronous access
let memoryProductsCache: Product[] | null = null;
let memoryCategoriesCache: string[] | null = null;
let memoryBrandingCache: StoreBranding | null = null;
let memoryCustomersCache: Customer[] | null = null;
let memoryOrdersCache: OrderRecord[] | null = null;
let memoryAdminsCache: AdminUser[] | null = null;
let hasLoadedPersistedProducts = false;

function syncToServer(endpoint: string, payload: any): Promise<Response | void> {
  if (typeof window === 'undefined') return Promise.resolve();
  return fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch((err) => {
    console.warn(`[LocalDatabase] Server disk sync notice (${endpoint}):`, err);
  });
}

function notifyProductListeners(products: Product[]) {
  productListeners.forEach((fn) => {
    try {
      fn(products);
    } catch (e) {
      console.error(e);
    }
  });
}

// ==================== PRODUCTS ====================
export function getLocalProducts(): Product[] {
  if (memoryProductsCache && memoryProductsCache.length > 0) {
    return memoryProductsCache;
  }
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        memoryProductsCache = parsed;
        return parsed;
      }
    }
  } catch (e) {
    console.warn('[LocalDatabase] Error reading local products cache:', e);
  }
  if (!memoryProductsCache) {
    memoryProductsCache = INITIAL_PRODUCTS;
  }
  return memoryProductsCache;
}

export async function getLocalProductsAsync(): Promise<Product[]> {
  // If we already loaded from IndexedDB or the server, return memoryProductsCache
  if (hasLoadedPersistedProducts && memoryProductsCache && memoryProductsCache.length > 0) {
    return memoryProductsCache;
  }

  // 1. Check IndexedDB first (near-instant local storage)
  try {
    const fromIdb = await getIdbItem<Product[]>(STORAGE_KEYS.PRODUCTS);
    if (Array.isArray(fromIdb) && fromIdb.length > 0) {
      memoryProductsCache = fromIdb;
      hasLoadedPersistedProducts = true;
      notifyProductListeners(fromIdb);
    }
  } catch (e) {
    console.warn('[LocalDatabase] Error reading products from IndexedDB:', e);
  }

  // 2. Query persistent server-disk database
  try {
    const res = await fetch('/api/db/products');
    if (res.ok) {
      const serverProds = await res.json();
      if (Array.isArray(serverProds) && serverProds.length > 0) {
        memoryProductsCache = serverProds;
        hasLoadedPersistedProducts = true;
        setIdbItem(STORAGE_KEYS.PRODUCTS, serverProds).catch(() => {});
        notifyProductListeners(serverProds);
        return serverProds;
      }
    }
  } catch (e) {}

  return memoryProductsCache || INITIAL_PRODUCTS;
}

export function saveLocalProducts(products: Product[]): void {
  memoryProductsCache = products;
  hasLoadedPersistedProducts = true;

  // 1. Persist to IndexedDB asynchronously (handles large 16MB+ catalog smoothly)
  setIdbItem(STORAGE_KEYS.PRODUCTS, products).catch((e) => {
    console.warn('[LocalDatabase] Error saving products to IndexedDB:', e);
  });

  // 2. Persist to localStorage if within safe quota
  try {
    const json = JSON.stringify(products);
    if (json.length < 4.5 * 1024 * 1024) {
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, json);
    }
  } catch (e) {}

  // 3. Persist permanently to server filesystem disk
  syncToServer('/api/db/products', { products });

  // 4. Notify all UI listeners immediately
  notifyProductListeners(products);
}

export async function saveProductsBatchLocal(products: Product[]): Promise<void> {
  memoryProductsCache = products;
  hasLoadedPersistedProducts = true;
  setIdbItem(STORAGE_KEYS.PRODUCTS, products).catch(() => {});
  try {
    const json = JSON.stringify(products);
    if (json.length < 4.5 * 1024 * 1024) {
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, json);
    }
  } catch (e) {}

  try {
    await fetch('/api/db/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ products }),
    });
  } catch (e) {
    console.warn('[LocalDatabase] Error saving products batch to server:', e);
  }
  notifyProductListeners(products);
}

export async function saveProductLocal(product: Product): Promise<void> {
  const prodId = product.id || `prod_${Date.now()}`;
  const updatedProduct = { ...product, id: prodId };

  // 1. Update in-memory list
  const current = memoryProductsCache || getLocalProducts();
  const idx = current.findIndex((p) => p.id === prodId);
  let updatedList: Product[];
  if (idx >= 0) {
    updatedList = [...current];
    updatedList[idx] = updatedProduct;
  } else {
    updatedList = [updatedProduct, ...current];
  }
  memoryProductsCache = updatedList;
  hasLoadedPersistedProducts = true;

  // 2. Persist in IndexedDB
  setIdbItem(STORAGE_KEYS.PRODUCTS, updatedList).catch(() => {});
  try {
    const json = JSON.stringify(updatedList);
    if (json.length < 4.5 * 1024 * 1024) {
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, json);
    }
  } catch (e) {}

  // 3. Persist to server disk via dedicated single-product endpoint
  try {
    await fetch('/api/db/product', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedProduct),
    });
  } catch (err) {
    console.warn('[LocalDatabase] Error persisting product to server disk:', err);
  }

  // 4. Notify UI listeners
  notifyProductListeners(updatedList);
}

export async function deleteProductLocal(productId: string): Promise<void> {
  const current = memoryProductsCache || getLocalProducts();
  const updatedList = current.filter((p) => p.id !== productId);
  memoryProductsCache = updatedList;
  hasLoadedPersistedProducts = true;

  setIdbItem(STORAGE_KEYS.PRODUCTS, updatedList).catch(() => {});
  try {
    const json = JSON.stringify(updatedList);
    if (json.length < 4.5 * 1024 * 1024) {
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, json);
    }
  } catch (e) {}

  try {
    await fetch(`/api/db/product/${encodeURIComponent(productId)}`, {
      method: 'DELETE',
    });
  } catch (err) {
    console.warn('[LocalDatabase] Error deleting product on server disk:', err);
  }

  notifyProductListeners(updatedList);
}

export async function resetProductsLocal(): Promise<void> {
  saveLocalProducts(INITIAL_PRODUCTS);
}

export async function clearAllProductsLocal(): Promise<void> {
  saveLocalProducts([]);
}

export async function importProductsLocal(
  newProducts: Product[],
  mode: 'merge' | 'replace' = 'merge',
  onProgress?: (processed: number, total: number, message: string) => void
): Promise<void> {
  const current = mode === 'replace' ? [] : await getLocalProductsAsync();
  const total = newProducts.length;

  if (onProgress) onProgress(0, total, 'Iniciando importación local...');

  const productMap = new Map<string, Product>();
  current.forEach((p) => productMap.set(p.id, p));

  newProducts.forEach((p, index) => {
    const id = p.id || `prod_${Date.now()}_${index}`;
    productMap.set(id, { ...p, id });
    if (onProgress && index % 100 === 0) {
      onProgress(index, total, `Procesando producto ${index + 1} de ${total}...`);
    }
  });

  const merged = Array.from(productMap.values());
  saveLocalProducts(merged);

  if (onProgress) onProgress(total, total, '¡Importación local completada con éxito!');
}

export async function decrementProductsStockLocal(
  items: { product: { id: string }; quantity: number }[]
): Promise<void> {
  const products = await getLocalProductsAsync();
  let modified = false;

  const updated = products.map((prod) => {
    const item = items.find((it) => it.product.id === prod.id);
    if (item && item.quantity > 0) {
      modified = true;
      const currentStock = typeof prod.stock === 'number' ? prod.stock : 100;
      const newStock = Math.max(0, currentStock - item.quantity);
      return { ...prod, stock: newStock };
    }
    return prod;
  });

  if (modified) {
    saveLocalProducts(updated);
  }
}

export async function incrementProductsStockLocal(
  items: { productId: string; quantity: number }[]
): Promise<void> {
  const products = await getLocalProductsAsync();
  let modified = false;

  const updated = products.map((prod) => {
    const item = items.find((it) => it.productId === prod.id);
    if (item && item.quantity > 0) {
      modified = true;
      const currentStock = typeof prod.stock === 'number' ? prod.stock : 100;
      return { ...prod, stock: currentStock + item.quantity };
    }
    return prod;
  });

  if (modified) {
    saveLocalProducts(updated);
  }
}

export function subscribeToProducts(
  onData: (products: Product[]) => void,
  _onError?: (err: Error) => void
): () => void {
  productListeners.add(onData);
  onData(getLocalProducts());
  getLocalProductsAsync().then((prods) => {
    if (prods && prods.length > 0) {
      onData(prods);
    }
  });
  return () => {
    productListeners.delete(onData);
  };
}

// ==================== CUSTOMERS ====================
export function getLocalCustomers(): Customer[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('[LocalDatabase] Error reading local customers cache:', e);
  }
  return INITIAL_CUSTOMERS;
}

export function saveLocalCustomers(customers: Customer[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
  } catch (e) {
    console.warn('[LocalDatabase] Error saving customers to local storage:', e);
  }
  setIdbItem(STORAGE_KEYS.CUSTOMERS, customers).catch(() => {});
  syncToServer('/api/db/customers', { customers });

  customerListeners.forEach((fn) => {
    try {
      fn(customers);
    } catch (e) {
      console.error(e);
    }
  });
}

export async function saveCustomerLocal(customerData: Partial<Customer>): Promise<Customer> {
  const customers = getLocalCustomers();
  const cleanPhone = normalizePhone(customerData.phone || '');
  const id =
    customerData.id ||
    (cleanPhone ? `cli-${cleanPhone}` : `cli-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`);

  const now = new Date().toISOString();
  const existingIdx = customers.findIndex(
    (c) => c.id === id || (cleanPhone && normalizePhone(c.phone) === cleanPhone)
  );

  let updatedCustomer: Customer;
  let updatedList: Customer[];

  if (existingIdx >= 0) {
    const prev = customers[existingIdx];
    updatedCustomer = {
      ...prev,
      ...customerData,
      id: prev.id,
      phone: cleanPhone || customerData.phone || prev.phone,
      updatedAt: now,
    };
    updatedList = [...customers];
    updatedList[existingIdx] = updatedCustomer;
  } else {
    updatedCustomer = {
      id,
      storeName: customerData.storeName || '',
      ownerName: customerData.ownerName || '',
      phone: cleanPhone || customerData.phone || '',
      documentType: customerData.documentType || 'CC',
      documentNumber: customerData.documentNumber || '',
      address: customerData.address || '',
      neighborhood: customerData.neighborhood || '',
      city: customerData.city || 'Medellín',
      department: customerData.department || 'Antioquia',
      paymentMethod: customerData.paymentMethod || 'contraentrega',
      notes: customerData.notes || '',
      status: customerData.status || 'active',
      ordersCount: customerData.ordersCount || 0,
      totalSpent: customerData.totalSpent || 0,
      createdAt: now,
      updatedAt: now,
    };
    updatedList = [updatedCustomer, ...customers];
  }

  saveLocalCustomers(updatedList);
  return updatedCustomer;
}

export async function deleteCustomerLocal(customerId: string): Promise<void> {
  const customers = getLocalCustomers();
  const updated = customers.filter((c) => c.id !== customerId);
  saveLocalCustomers(updated);
}

export async function findCustomerByPhoneLocal(phone: string): Promise<Customer | null> {
  const normalized = normalizePhone(phone);
  if (!normalized || normalized.length < 7) return null;

  const customers = getLocalCustomers();
  const match = customers.find((c) => normalizePhone(c.phone) === normalized);
  return match || null;
}

export async function searchCustomersLocal(searchTerm: string): Promise<Customer[]> {
  const term = searchTerm.trim().toLowerCase();
  if (!term) return [];

  const cleanNum = normalizePhone(searchTerm);
  const customers = getLocalCustomers();

  return customers.filter((c) => {
    const matchStore = (c.storeName || '').toLowerCase().includes(term);
    const matchOwner = (c.ownerName || '').toLowerCase().includes(term);
    const matchCity = (c.city || '').toLowerCase().includes(term);
    const matchAddress = (c.address || '').toLowerCase().includes(term);
    const matchPhone = cleanNum ? (c.phone || '').includes(cleanNum) : (c.phone || '').includes(term);
    return matchStore || matchOwner || matchCity || matchAddress || matchPhone;
  });
}

export async function batchImportCustomersLocal(
  newCustomers: Customer[],
  mode: 'merge' | 'replace' = 'merge',
  onProgress?: (processed: number, total: number, message: string) => void
): Promise<void> {
  const total = newCustomers.length;
  if (onProgress) onProgress(0, total, 'Iniciando importación local de clientes...');

  const current = mode === 'replace' ? [] : getLocalCustomers();
  const customerMap = new Map<string, Customer>();
  current.forEach((c) => {
    const key = normalizePhone(c.phone) || c.id;
    customerMap.set(key, c);
  });

  newCustomers.forEach((cust, index) => {
    const cleanPhone = normalizePhone(cust.phone);
    const id = cust.id || (cleanPhone ? `cli-${cleanPhone}` : `cli-${Date.now()}-${index}`);
    const key = cleanPhone || id;

    customerMap.set(key, {
      ...cust,
      id,
      phone: cleanPhone || cust.phone,
      updatedAt: new Date().toISOString(),
    });

    if (onProgress && index % 50 === 0) {
      onProgress(index, total, `Importando cliente ${index + 1} de ${total}...`);
    }
  });

  const merged = Array.from(customerMap.values());
  saveLocalCustomers(merged);
  if (onProgress) onProgress(total, total, '¡Directorio de clientes actualizado con éxito!');
}

export function subscribeToCustomers(
  onData: (customers: Customer[]) => void,
  _onError?: (err: Error) => void
): () => void {
  customerListeners.add(onData);
  onData(getLocalCustomers());
  return () => {
    customerListeners.delete(onData);
  };
}

// ==================== ADMINS ====================
export function getLocalAdmins(): AdminUser[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.ADMINS);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('[LocalDatabase] Error reading local admins cache:', e);
  }
  return DEFAULT_ADMINS;
}

export function saveLocalAdmins(admins: AdminUser[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ADMINS, JSON.stringify(admins));
  } catch (e) {
    console.warn('[LocalDatabase] Error saving admins to local storage:', e);
  }
  setIdbItem(STORAGE_KEYS.ADMINS, admins).catch(() => {});
  syncToServer('/api/db/admins', { admins });

  adminListeners.forEach((fn) => {
    try {
      fn(admins);
    } catch (e) {
      console.error(e);
    }
  });
}

export async function saveAdminLocal(admin: AdminUser): Promise<void> {
  const admins = getLocalAdmins();
  const id = admin.id || `admin-${Date.now()}`;
  const updatedAdmin = { ...admin, id };

  const idx = admins.findIndex((a) => a.id === id);
  let updatedList: AdminUser[];
  if (idx >= 0) {
    updatedList = [...admins];
    updatedList[idx] = updatedAdmin;
  } else {
    updatedList = [...admins, updatedAdmin];
  }
  saveLocalAdmins(updatedList);
}

export async function deleteAdminLocal(adminId: string): Promise<void> {
  const admins = getLocalAdmins();
  const updatedList = admins.filter((a) => a.id !== adminId);
  saveLocalAdmins(updatedList);
}

export async function updateAdminLastLogin(adminId: string): Promise<void> {
  const admins = getLocalAdmins();
  const now = new Date().toISOString();
  const updated = admins.map((a) => (a.id === adminId ? { ...a, lastLoginAt: now } : a));
  saveLocalAdmins(updated);
}

export function subscribeToAdmins(
  onData: (admins: AdminUser[]) => void,
  _onError?: (err: Error) => void
): () => void {
  adminListeners.add(onData);
  onData(getLocalAdmins());
  return () => {
    adminListeners.delete(onData);
  };
}

// ==================== ORDERS ====================
export function getLocalOrders(): OrderRecord[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.ORDERS);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('[LocalDatabase] Error reading local orders cache:', e);
  }
  return INITIAL_ORDERS;
}

export function saveLocalOrders(orders: OrderRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
  } catch (e) {
    console.warn('[LocalDatabase] Error saving orders to local storage:', e);
  }
  setIdbItem(STORAGE_KEYS.ORDERS, orders).catch(() => {});
  syncToServer('/api/db/orders', { orders });

  orderListeners.forEach((fn) => {
    try {
      fn(orders);
    } catch (e) {
      console.error(e);
    }
  });
}

export async function createOrderLocal(
  orderData: Omit<OrderRecord, 'id' | 'createdAt' | 'status'> & { id?: string; status?: OrderStatus }
): Promise<string> {
  const orders = getLocalOrders();
  const id = orderData.id || `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const newOrder: OrderRecord = {
    status: orderData.status || 'pendiente',
    ...orderData,
    id,
    createdAt: now,
  };

  const updatedOrders = [newOrder, ...orders];
  saveLocalOrders(updatedOrders);

  // Decrement stock in local products
  if (orderData.items && orderData.items.length > 0) {
    await decrementProductsStockLocal(orderData.items);
  }

  // Update customer order stats if customer is attached
  if (orderData.customer?.phone) {
    const cleanPhone = normalizePhone(orderData.customer.phone);
    const existingCust = await findCustomerByPhoneLocal(cleanPhone);
    if (existingCust) {
      await saveCustomerLocal({
        ...existingCust,
        ordersCount: (existingCust.ordersCount || 0) + 1,
        totalSpent: (existingCust.totalSpent || 0) + (orderData.totalPrice || 0),
        lastOrderAt: now,
      });
    }
  }

  return id;
}

export async function updateOrderStatusLocal(
  orderId: string,
  newStatus: OrderStatus,
  prevStatusOrOptions?: OrderStatus | { returnStockIfCancelled?: boolean },
  orderRecord?: OrderRecord
): Promise<void> {
  const orders = getLocalOrders();
  const orderIndex = orders.findIndex((o) => o.id === orderId);
  if (orderIndex === -1) {
    throw new Error('No se encontró el pedido en la base de datos local.');
  }

  const order = orders[orderIndex];
  const prevStatus = typeof prevStatusOrOptions === 'string' ? prevStatusOrOptions : order.status;
  const returnStock =
    typeof prevStatusOrOptions === 'object' && prevStatusOrOptions !== null
      ? Boolean(prevStatusOrOptions.returnStockIfCancelled)
      : false;
  const now = new Date().toISOString();

  // If cancelling and returnStock is true, restore stock
  if (newStatus === 'cancelado' && prevStatus !== 'cancelado' && returnStock) {
    if (order.items && order.items.length > 0) {
      const itemsToRestore = order.items
        .map((it) => ({
          productId: it.product.id,
          quantity: Math.max(0, it.quantity - (it.returnedQuantity || 0)),
        }))
        .filter((it) => it.quantity > 0);

      await incrementProductsStockLocal(itemsToRestore);
    }
  }

  // If re-activating a previously cancelled order
  if (prevStatus === 'cancelado' && newStatus !== 'cancelado') {
    if (order.items && order.items.length > 0) {
      const itemsToDeduct = order.items
        .map((it) => ({
          product: { id: it.product.id },
          quantity: Math.max(0, it.quantity - (it.returnedQuantity || 0)),
        }))
        .filter((it) => it.quantity > 0);

      await decrementProductsStockLocal(itemsToDeduct);
    }
  }

  const updatedOrder: OrderRecord = {
    ...order,
    status: newStatus,
    updatedAt: now,
  };

  const updatedOrders = [...orders];
  updatedOrders[orderIndex] = updatedOrder;
  saveLocalOrders(updatedOrders);
}

export async function deleteOrderLocal(orderId: string): Promise<void> {
  const orders = getLocalOrders();
  const updatedOrders = orders.filter((o) => o.id !== orderId);
  saveLocalOrders(updatedOrders);
}

export async function returnAllOrderStockAndDeleteLocal(
  orderId: string,
  orderData?: OrderRecord
): Promise<{ restoredItemsCount: number; restoredProducts: number }> {
  const orders = getLocalOrders();
  const order = orderData || orders.find((o) => o.id === orderId);
  if (!order) {
    throw new Error('No se encontró el pedido en la base de datos local.');
  }

  let restoredItemsCount = 0;
  let restoredProducts = 0;

  if (order.items && order.items.length > 0) {
    const itemsToRestore = order.items
      .map((it) => ({
        productId: it.product.id,
        quantity: Math.max(0, it.quantity - (it.returnedQuantity || 0)),
      }))
      .filter((it) => it.quantity > 0);

    if (itemsToRestore.length > 0) {
      await incrementProductsStockLocal(itemsToRestore);
      restoredItemsCount = itemsToRestore.reduce((acc, it) => acc + it.quantity, 0);
      restoredProducts = itemsToRestore.length;
    }
  }

  await deleteOrderLocal(orderId);
  return { restoredItemsCount, restoredProducts };
}

export async function returnOrderItemLocal(
  orderId: string,
  productId: string,
  returnQty: number,
  reason?: string,
  options?: {
    deleteInvoiceTotally?: boolean;
    restoreAllOtherItemsToo?: boolean;
  }
): Promise<{
  success: boolean;
  returnedQuantity: number;
  remainingOrderTotal: number;
  invoiceDeleted: boolean;
  productRemovedTotally: boolean;
}> {
  const orders = getLocalOrders();
  const orderIndex = orders.findIndex((o) => o.id === orderId);
  if (orderIndex === -1) {
    throw new Error('No se encontró el pedido en la base de datos local.');
  }

  const order = orders[orderIndex];

  if (options?.deleteInvoiceTotally && options?.restoreAllOtherItemsToo) {
    const { restoredItemsCount } = await returnAllOrderStockAndDeleteLocal(orderId, order);
    return {
      success: true,
      returnedQuantity: restoredItemsCount,
      remainingOrderTotal: 0,
      invoiceDeleted: true,
      productRemovedTotally: true,
    };
  }

  const targetItemIndex = order.items.findIndex((it) => it.product.id === productId);
  if (targetItemIndex === -1) {
    throw new Error('El producto no forma parte de este pedido.');
  }

  const item = order.items[targetItemIndex];
  const currentAvailableQty = Math.max(0, item.quantity - (item.returnedQuantity || 0));

  if (returnQty <= 0 || returnQty > currentAvailableQty) {
    throw new Error(`La cantidad a devolver debe ser entre 1 y ${currentAvailableQty} unidades.`);
  }

  // 1. Replenish product stock locally
  await incrementProductsStockLocal([{ productId, quantity: returnQty }]);

  if (options?.deleteInvoiceTotally) {
    await deleteOrderLocal(orderId);
    return {
      success: true,
      returnedQuantity: returnQty,
      remainingOrderTotal: 0,
      invoiceDeleted: true,
      productRemovedTotally: true,
    };
  }

  // 2. Adjust invoice items
  const remainingQty = currentAvailableQty - returnQty;
  let productRemovedTotally = false;
  let updatedItems: CartItem[] = [];

  if (remainingQty <= 0) {
    updatedItems = order.items.filter((it) => it.product.id !== productId);
    productRemovedTotally = true;
  } else {
    updatedItems = order.items.map((it) => {
      if (it.product.id === productId) {
        return {
          ...it,
          quantity: remainingQty,
          returnedQuantity: 0,
        };
      }
      return it;
    });
  }

  const activeItemsCount = updatedItems.reduce(
    (acc, it) => acc + Math.max(0, it.quantity - (it.returnedQuantity || 0)),
    0
  );
  const activeTotalPrice = updatedItems.reduce(
    (acc, it) => acc + Math.max(0, it.quantity - (it.returnedQuantity || 0)) * (it.product.price || 0),
    0
  );

  if (updatedItems.length === 0 || activeItemsCount === 0) {
    await deleteOrderLocal(orderId);
    return {
      success: true,
      returnedQuantity: returnQty,
      remainingOrderTotal: 0,
      invoiceDeleted: true,
      productRemovedTotally: true,
    };
  }

  const newReturnLog = {
    id: `ret-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    productId,
    productName: item.product.name,
    returnedQuantity: returnQty,
    unitPrice: item.product.price || 0,
    totalRefund: (item.product.price || 0) * returnQty,
    reason: reason || 'Devolución de producto al stock',
    returnedAt: new Date().toISOString(),
  };

  const updatedReturns = [newReturnLog, ...(order.returns || [])];

  const updatedOrder: OrderRecord = {
    ...order,
    items: updatedItems,
    totalItemsCount: activeItemsCount,
    totalPrice: activeTotalPrice,
    returns: updatedReturns,
    updatedAt: new Date().toISOString(),
  };

  const updatedOrders = [...orders];
  updatedOrders[orderIndex] = updatedOrder;
  saveLocalOrders(updatedOrders);

  return {
    success: true,
    returnedQuantity: returnQty,
    remainingOrderTotal: activeTotalPrice,
    invoiceDeleted: false,
    productRemovedTotally,
  };
}

export async function cancelOrderAndRestoreStockLocal(orderId: string): Promise<void> {
  await returnAllOrderStockAndDeleteLocal(orderId);
}

export async function getOrderByNumberLocal(orderNumber: string): Promise<OrderRecord | null> {
  const orders = getLocalOrders();
  const match = orders.find((o) => o.orderNumber === orderNumber || o.id === orderNumber);
  return match || null;
}

export function subscribeToOrders(
  onData: (orders: OrderRecord[]) => void,
  _onError?: (err: Error) => void
): () => void {
  orderListeners.add(onData);
  onData(getLocalOrders());
  return () => {
    orderListeners.delete(onData);
  };
}

// ==================== BRANDING & CATEGORIES ====================
export function getLocalBranding(): StoreBranding {
  if (memoryBrandingCache && memoryBrandingCache.name) {
    return memoryBrandingCache;
  }
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.BRANDING);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.name) {
        memoryBrandingCache = parsed;
        return parsed;
      }
    }
  } catch (e) {}
  return DEFAULT_BRANDING;
}

export function saveLocalBranding(branding: StoreBranding): void {
  saveBrandingLocal(branding).catch(() => {});
}

export async function saveBrandingLocal(branding: StoreBranding): Promise<void> {
  memoryBrandingCache = branding;
  try {
    localStorage.setItem(STORAGE_KEYS.BRANDING, JSON.stringify(branding));
  } catch (e) {}
  setIdbItem(STORAGE_KEYS.BRANDING, branding).catch(() => {});

  try {
    await fetch('/api/db/branding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branding }),
    });
  } catch (e) {
    console.warn('[LocalDatabase] Error saving branding to server disk:', e);
  }

  brandingListeners.forEach((fn) => {
    try {
      fn(branding);
    } catch (e) {
      console.error(e);
    }
  });
}

export function subscribeToBranding(
  onData: (branding: StoreBranding) => void,
  _onError?: (err: Error) => void
): () => void {
  brandingListeners.add(onData);
  onData(getLocalBranding());
  return () => {
    brandingListeners.delete(onData);
  };
}

export function getLocalCategories(): string[] {
  if (memoryCategoriesCache && memoryCategoriesCache.length > 0) {
    return memoryCategoriesCache;
  }
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        memoryCategoriesCache = parsed;
        return parsed;
      }
    }
  } catch (e) {}
  return DEFAULT_BASE_CATEGORIES;
}

export function saveLocalCategories(categories: string[]): void {
  saveCategoriesLocal(categories).catch(() => {});
}

export async function saveCategoriesLocal(categories: string[]): Promise<void> {
  memoryCategoriesCache = categories;
  try {
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
  } catch (e) {}
  setIdbItem(STORAGE_KEYS.CATEGORIES, categories).catch(() => {});

  try {
    await fetch('/api/db/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categories }),
    });
  } catch (e) {
    console.warn('[LocalDatabase] Error saving categories to server disk:', e);
  }

  categoryListeners.forEach((fn) => {
    try {
      fn(categories);
    } catch (e) {
      console.error(e);
    }
  });
}

export function subscribeToCategories(
  onData: (categories: string[]) => void,
  _onError?: (err: Error) => void
): () => void {
  categoryListeners.add(onData);
  onData(getLocalCategories());
  return () => {
    categoryListeners.delete(onData);
  };
}

// ==================== BASE DE DATOS COMPLETA ====================
export function getCompleteLocalDatabase(): EmbeddedDatabase {
  return {
    version: '2.0.0-in-code',
    name: 'AYM DISTRIBUCIONES - Base de Datos Local',
    updatedAt: new Date().toISOString(),
    branding: getLocalBranding(),
    categories: getLocalCategories(),
    products: getLocalProducts(),
    customers: getLocalCustomers(),
    admins: getLocalAdmins(),
    orders: getLocalOrders(),
  };
}

/**
 * Restaura toda la base de datos a los valores predeterminados codificados en el código fuente.
 */
export function resetLocalDatabaseToCode(): EmbeddedDatabase {
  try {
    localStorage.removeItem(STORAGE_KEYS.PRODUCTS);
    localStorage.removeItem(STORAGE_KEYS.CUSTOMERS);
    localStorage.removeItem(STORAGE_KEYS.ADMINS);
    localStorage.removeItem(STORAGE_KEYS.ORDERS);
    localStorage.removeItem(STORAGE_KEYS.BRANDING);
    localStorage.removeItem(STORAGE_KEYS.CATEGORIES);
  } catch (e) {
    console.warn('[LocalDatabase] Could not clear localStorage:', e);
  }

  saveLocalProducts(INITIAL_PRODUCTS);
  saveLocalCustomers(INITIAL_CUSTOMERS);
  saveLocalAdmins(DEFAULT_ADMINS);
  saveLocalOrders(INITIAL_ORDERS);
  saveLocalCategories(DEFAULT_BASE_CATEGORIES);
  saveLocalBranding(DEFAULT_BRANDING);

  return { ...LOCAL_DATABASE };
}

/**
 * Descarga una copia de seguridad JSON completa de la base de datos local.
 */
export function downloadLocalDatabaseBackup(): void {
  const dbData = getCompleteLocalDatabase();
  const jsonStr = JSON.stringify(dbData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().split('T')[0];
  a.href = url;
  a.download = `aym-base-de-datos-local-${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Importa y valida una copia de seguridad JSON de la base de datos.
 */
export function importLocalDatabaseFromJSON(jsonString: string): {
  success: boolean;
  message: string;
  data?: EmbeddedDatabase;
} {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed || typeof parsed !== 'object') {
      return { success: false, message: 'El archivo no contiene un objeto JSON válido.' };
    }

    if (Array.isArray(parsed.products)) {
      saveLocalProducts(parsed.products);
    }
    if (Array.isArray(parsed.customers)) {
      saveLocalCustomers(parsed.customers);
    }
    if (Array.isArray(parsed.admins)) {
      saveLocalAdmins(parsed.admins);
    }
    if (Array.isArray(parsed.orders)) {
      saveLocalOrders(parsed.orders);
    }
    if (parsed.branding && typeof parsed.branding === 'object') {
      saveLocalBranding(parsed.branding);
    }
    if (Array.isArray(parsed.categories)) {
      saveLocalCategories(parsed.categories);
    }

    const complete = getCompleteLocalDatabase();
    syncToServer('/api/db/sync', complete);

    return {
      success: true,
      message: '¡Base de datos local importada y guardada permanentemente!',
      data: complete,
    };
  } catch (e: any) {
    return {
      success: false,
      message: 'Error al interpretar el archivo JSON: ' + (e?.message || 'Formato inválido'),
    };
  }
}

/**
 * Obtiene estadísticas de la base de datos local embebida en el código.
 */
export function getLocalDatabaseStats() {
  const prods = getLocalProducts();
  const custs = getLocalCustomers();
  const adms = getLocalAdmins();
  const ords = getLocalOrders();
  const cats = getLocalCategories();

  const withImagesCount = prods.filter(
    (p) => p.imageUrl && (p.imageUrl.startsWith('data:image') || p.imageUrl.startsWith('http'))
  ).length;

  return {
    productsCount: prods.length,
    customersCount: custs.length,
    adminsCount: adms.length,
    ordersCount: ords.length,
    categoriesCount: cats.length,
    withImagesCount,
    inCodeProductsCount: INITIAL_PRODUCTS.length,
    inCodeCustomersCount: INITIAL_CUSTOMERS.length,
    inCodeAdminsCount: DEFAULT_ADMINS.length,
    inCodeOrdersCount: INITIAL_ORDERS.length,
  };
}

// ==================== ALIASES PARA COMPATIBILIDAD ====================
export const saveProductToCloud = saveProductLocal;
export const deleteProductFromCloud = deleteProductLocal;
export const resetProductsInCloud = resetProductsLocal;
export const importProductsToCloud = importProductsLocal;
export const clearAllProductsInCloud = clearAllProductsLocal;
export const saveCategoriesToCloud = saveCategoriesLocal;
export const saveBrandingToCloud = saveBrandingLocal;
export const createOrderInCloud = createOrderLocal;
export const updateOrderStatusInCloud = updateOrderStatusLocal;
export const deleteOrderFromCloud = deleteOrderLocal;
export const returnOrderItemInCloud = returnOrderItemLocal;
export const cancelOrderAndRestoreStockInCloud = cancelOrderAndRestoreStockLocal;
export const returnAllOrderStockAndDeleteInCloud = returnAllOrderStockAndDeleteLocal;
export const getOrderByNumberFromCloud = getOrderByNumberLocal;
export const saveCustomerToCloud = saveCustomerLocal;
export const deleteCustomerFromCloud = deleteCustomerLocal;
export const findCustomerByPhoneInCloud = findCustomerByPhoneLocal;
export const searchCustomersInCloud = searchCustomersLocal;
export const batchImportCustomersToCloud = batchImportCustomersLocal;
export const saveAdminToCloud = saveAdminLocal;
export const deleteAdminFromCloud = deleteAdminLocal;
export const decrementProductsStockInCloud = decrementProductsStockLocal;
export const incrementProductsStockInCloud = incrementProductsStockLocal;

// ==================== AUTO INITIALIZE DATABASE SYNC ====================
let hasInitializedSync = false;

export async function initializeDatabaseSync(): Promise<void> {
  if (hasInitializedSync) return;
  hasInitializedSync = true;

  // 1. Immediately hydrate from IndexedDB
  try {
    const [idbProds, idbCusts, idbOrders, idbCats, idbBrand, idbAdmins] = await Promise.all([
      getIdbItem<Product[]>(STORAGE_KEYS.PRODUCTS),
      getIdbItem<Customer[]>(STORAGE_KEYS.CUSTOMERS),
      getIdbItem<OrderRecord[]>(STORAGE_KEYS.ORDERS),
      getIdbItem<string[]>(STORAGE_KEYS.CATEGORIES),
      getIdbItem<StoreBranding>(STORAGE_KEYS.BRANDING),
      getIdbItem<AdminUser[]>(STORAGE_KEYS.ADMINS),
    ]);

    if (Array.isArray(idbProds) && idbProds.length > 0) {
      memoryProductsCache = idbProds;
      hasLoadedPersistedProducts = true;
      notifyProductListeners(idbProds);
    }
    if (Array.isArray(idbCusts) && idbCusts.length > 0) {
      customerListeners.forEach((fn) => fn(idbCusts));
    }
    if (Array.isArray(idbOrders) && idbOrders.length > 0) {
      orderListeners.forEach((fn) => fn(idbOrders));
    }
    if (Array.isArray(idbCats) && idbCats.length > 0) {
      categoryListeners.forEach((fn) => fn(idbCats));
    }
    if (idbBrand && idbBrand.name) {
      brandingListeners.forEach((fn) => fn(idbBrand));
    }
    if (Array.isArray(idbAdmins) && idbAdmins.length > 0) {
      adminListeners.forEach((fn) => fn(idbAdmins));
    }
  } catch (e) {
    console.warn('[LocalDatabase] IndexedDB initial hydration note:', e);
  }

  // 2. Hydrate from permanent Server Disk Database (/api/db)
  await loadCompleteDatabase();
}

export async function loadCompleteDatabase(): Promise<{
  products: Product[];
  categories: string[];
  branding: StoreBranding;
  customers: Customer[];
  orders: OrderRecord[];
  admins: AdminUser[];
} | null> {
  try {
    const res = await fetch('/api/db');
    if (res.ok) {
      const db = await res.json();
      if (db) {
        if (Array.isArray(db.products) && db.products.length > 0) {
          memoryProductsCache = db.products;
          hasLoadedPersistedProducts = true;
          setIdbItem(STORAGE_KEYS.PRODUCTS, db.products).catch(() => {});
          notifyProductListeners(db.products);
        }
        if (Array.isArray(db.customers) && db.customers.length > 0) {
          memoryCustomersCache = db.customers;
          try {
            localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(db.customers));
          } catch {}
          setIdbItem(STORAGE_KEYS.CUSTOMERS, db.customers).catch(() => {});
          customerListeners.forEach((fn) => fn(db.customers));
        }
        if (Array.isArray(db.orders) && db.orders.length > 0) {
          memoryOrdersCache = db.orders;
          try {
            localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(db.orders));
          } catch {}
          setIdbItem(STORAGE_KEYS.ORDERS, db.orders).catch(() => {});
          orderListeners.forEach((fn) => fn(db.orders));
        }
        if (Array.isArray(db.categories) && db.categories.length > 0) {
          memoryCategoriesCache = db.categories;
          try {
            localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(db.categories));
          } catch {}
          setIdbItem(STORAGE_KEYS.CATEGORIES, db.categories).catch(() => {});
          categoryListeners.forEach((fn) => fn(db.categories));
        }
        if (db.branding && db.branding.name) {
          memoryBrandingCache = db.branding;
          try {
            localStorage.setItem(STORAGE_KEYS.BRANDING, JSON.stringify(db.branding));
          } catch {}
          setIdbItem(STORAGE_KEYS.BRANDING, db.branding).catch(() => {});
          brandingListeners.forEach((fn) => fn(db.branding));
        }
        if (Array.isArray(db.admins) && db.admins.length > 0) {
          memoryAdminsCache = db.admins;
          try {
            localStorage.setItem(STORAGE_KEYS.ADMINS, JSON.stringify(db.admins));
          } catch {}
          setIdbItem(STORAGE_KEYS.ADMINS, db.admins).catch(() => {});
          adminListeners.forEach((fn) => fn(db.admins));
        }
        return db;
      }
    }
  } catch (e) {
    console.warn('[LocalDatabase] Server disk load note:', e);
  }
  return null;
}

// Automatically initiate sync in the browser
if (typeof window !== 'undefined') {
  setTimeout(() => {
    initializeDatabaseSync().catch(() => {});
  }, 10);
}
