import { Product, Customer, AdminUser, OrderRecord, StoreBranding } from '../types';
import productsCatalogJson from './products_catalog.json';

/**
 * =========================================================================
 * BASE DE DATOS LOCAL EMBEBIDA EN EL CÓDIGO (AYM DISTRIBUCIONES)
 * =========================================================================
 * Esta base de datos reside directamente en el código fuente de la aplicación,
 * conteniendo el catálogo completo de productos mayoristas con todas sus
 * imágenes (URLs y Base64), precios, categorías y stocks.
 */

export const DEFAULT_BASE_CATEGORIES: string[] = [
  'REPUESTOS',
  'JAPANI MEDELLIN',
  'FC RIOS',
  'BERNAL',
  'ECUADOR',
  '- Sin Departamento -',
  'ANDRES MEDELLIN',
  'FANALCA',
  'BAJAJ',
  'COY',
  'STEVE MOTOS MEDELLIN',
  'BOGOTA',
  'DUNAS',
  'OKLA',
  'ALEJANDRO NEIVA',
  'A2R',
  'MONICA',
  'DON RICHAR',
  'ANA FACTORY',
  'AKT',
  'FERRERIOS BOGOTA',
  'MOTOPLASTICO BOGOTA',
  'LUJOS',
  'ACEITES',
  'YAMAHA',
  'HONDA',
  'SUZUKI',
  'TVS',
  'HERO',
  'AUTECO',
  'KTM',
  'PULSAR',
  'BOXER',
  'DISCOVER',
  'APACHE',
  'NMAX',
  'FZ',
  'GIXXER',
  'NKD',
  'LIBERO',
  'VICTORY',
  'KYMCO',
  'ACCESORIOS',
  'CASCOS',
  'LLANTAS',
  'BATERIAS',
  'FRENOS',
  'CADENAS',
  'ILUMINACION',
  'HERRAMIENTAS',
  'OTROS',
];

export const CATEGORIES = [
  'Todas',
  'Promociones 🔥',
  ...DEFAULT_BASE_CATEGORIES
];

export const DEFAULT_BRANDING: StoreBranding = {
  name: 'AYM DISTRIBUCIONES',
  subtitle: 'aym-distribuciones.verse.app',
  logoUrl: '',
  whatsappNumber: '3113986110',
};

// ==================== PRODUCTOS EMBEBIDOS (CATÁLOGO REAL CON IMÁGENES) ====================
export const INITIAL_PRODUCTS: Product[] = (productsCatalogJson as unknown) as Product[];

// ==================== CLIENTES EMBEBIDOS (DIRECTORIO LOCAL) ====================
export const INITIAL_CUSTOMERS: Customer[] = [
  {
    id: 'cli-3113986110',
    phone: '3113986110',
    storeName: 'Minimarket Don Pedro',
    ownerName: 'Pedro José Gómez',
    address: 'Carrera 15 # 45-20',
    city: 'Bucaramanga',
    paymentMethod: 'contraentrega',
    notes: 'Entregar en la mañana antes de las 11:00 am. Recibe en mostrador principal.',
    discountPercentage: 0,
    status: 'active',
    ordersCount: 3,
    totalSpent: 485000,
    createdAt: '2025-01-10T10:00:00.000Z',
  },
  {
    id: 'cli-3158742190',
    phone: '3158742190',
    storeName: 'Tienda La Esquina del Ahorro',
    ownerName: 'María Elena Restrepo',
    address: 'Calle 32 # 18-50 Barrio Centro',
    city: 'Floridablanca',
    paymentMethod: 'transferencia',
    notes: 'Confirmar pedido por WhatsApp antes de despachar el camión.',
    discountPercentage: 2,
    status: 'active',
    ordersCount: 5,
    totalSpent: 890000,
    createdAt: '2025-01-15T14:30:00.000Z',
  },
  {
    id: 'cli-3209876543',
    phone: '3209876543',
    storeName: 'Supermercado Los Pinos',
    ownerName: 'Carlos Arturo Ramírez',
    address: 'Avenida Libertador # 10-34',
    city: 'Girón',
    paymentMethod: 'credito',
    notes: 'Recibe en bodega trasera. Horario de descargue: 7:00 am - 12:00 m.',
    discountPercentage: 5,
    creditLimit: 2000000,
    status: 'active',
    ordersCount: 8,
    totalSpent: 2450000,
    createdAt: '2025-01-20T09:15:00.000Z',
  },
  {
    id: 'cli-3104567890',
    phone: '3104567890',
    storeName: 'Autoservicio El Paisa',
    ownerName: 'Javier Darío Osorio',
    address: 'Carrera 27 # 52-14',
    city: 'Bucaramanga',
    paymentMethod: 'contraentrega',
    notes: 'Cliente puntual. Avisar media hora antes de la entrega.',
    discountPercentage: 3,
    status: 'active',
    ordersCount: 4,
    totalSpent: 720000,
    createdAt: '2025-02-01T11:00:00.000Z',
  },
  {
    id: 'cli-3176543210',
    phone: '3176543210',
    storeName: 'Cigarrería y Variedades San Jorge',
    ownerName: 'Jorge Eliécer Medina',
    address: 'Calle 11 # 24-08',
    city: 'Piedecuesta',
    paymentMethod: 'transferencia',
    notes: 'Priorizar bebidas energizantes y golosinas.',
    discountPercentage: 0,
    status: 'active',
    ordersCount: 2,
    totalSpent: 310000,
    createdAt: '2025-02-12T16:20:00.000Z',
  },
  {
    id: 'cli-3129871234',
    phone: '3129871234',
    storeName: 'Droguería y Minimercado La Floresta',
    ownerName: 'Sandra Milena Villamizar',
    address: 'Transversal 72 # 15-40',
    city: 'Bucaramanga',
    paymentMethod: 'contraentrega',
    notes: 'Requiere factura física impresa para recepción.',
    discountPercentage: 2,
    status: 'active',
    ordersCount: 3,
    totalSpent: 540000,
    createdAt: '2025-02-20T10:45:00.000Z',
  }
];

// ==================== ADMINISTRADORES EMBEBIDOS ====================
export const DEFAULT_ADMINS: AdminUser[] = [
  {
    id: 'admin-master',
    username: 'admin',
    name: 'Administrador Principal (Gerencia)',
    password: 'admin123',
    role: 'superadmin',
    status: 'active',
    createdAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'admin-supervisor',
    username: 'supervisor',
    name: 'Supervisor de Bodega y Despacho',
    password: 'super2025',
    role: 'admin',
    status: 'active',
    createdAt: '2025-01-05T00:00:00.000Z',
  },
  {
    id: 'admin-ventas',
    username: 'ventas',
    name: 'Asesor Comercial y Pedidos',
    password: 'ventas123',
    role: 'editor',
    status: 'active',
    createdAt: '2025-01-10T00:00:00.000Z',
  }
];

// ==================== PEDIDOS HISTÓRICOS EMBEBIDOS ====================
export const INITIAL_ORDERS: OrderRecord[] = [
  {
    id: 'ord-aym-7821',
    orderNumber: 'AYM-7821',
    status: 'entregado',
    customer: {
      storeName: 'Minimarket Don Pedro',
      ownerName: 'Pedro José Gómez',
      phone: '3113986110',
      address: 'Carrera 15 # 45-20',
      city: 'Bucaramanga',
      notes: 'Entregado a satisfacción en mostrador',
      paymentMethod: 'contraentrega',
    },
    items: [
      { product: INITIAL_PRODUCTS[0], quantity: 3 }, // Leche Alquería x3
      { product: INITIAL_PRODUCTS[6], quantity: 2 }, // Café Tostao Intenso x2
      { product: INITIAL_PRODUCTS[18], quantity: 2 }, // Arroz Diana x2
    ],
    totalPrice: 442400,
    totalItemsCount: 7,
    createdAt: '2025-03-08T09:30:00.000Z',
  },
  {
    id: 'ord-aym-7822',
    orderNumber: 'AYM-7822',
    status: 'confirmado',
    customer: {
      storeName: 'Tienda La Esquina del Ahorro',
      ownerName: 'María Elena Restrepo',
      phone: '3158742190',
      address: 'Calle 32 # 18-50 Barrio Centro',
      city: 'Floridablanca',
      notes: 'Confirmado por WhatsApp para ruta de hoy',
      paymentMethod: 'transferencia',
    },
    items: [
      { product: INITIAL_PRODUCTS[12], quantity: 4 }, // Speed Max x4
      { product: INITIAL_PRODUCTS[13], quantity: 3 }, // Coca Cola 400ml x3
      { product: INITIAL_PRODUCTS[25], quantity: 2 }, // Festival x2
    ],
    totalPrice: 368400,
    totalItemsCount: 9,
    createdAt: '2025-03-09T14:15:00.000Z',
  },
  {
    id: 'ord-aym-7823',
    orderNumber: 'AYM-7823',
    status: 'pendiente',
    customer: {
      storeName: 'Supermercado Los Pinos',
      ownerName: 'Carlos Arturo Ramírez',
      phone: '3209876543',
      address: 'Avenida Libertador # 10-34',
      city: 'Girón',
      notes: 'Entregar en bodega trasera temprano',
      paymentMethod: 'credito',
    },
    items: [
      { product: INITIAL_PRODUCTS[19], quantity: 2 }, // Aceite Premier x2
      { product: INITIAL_PRODUCTS[20], quantity: 1 }, // Atún Van Camps x1
      { product: INITIAL_PRODUCTS[31], quantity: 2 }, // FAB Detergente x2
    ],
    totalPrice: 544000,
    totalItemsCount: 5,
    createdAt: '2025-03-10T11:00:00.000Z',
  },
  {
    id: 'ord-aym-7824',
    orderNumber: 'AYM-7824',
    status: 'en_camino',
    customer: {
      storeName: 'Autoservicio El Paisa',
      ownerName: 'Javier Darío Osorio',
      phone: '3104567890',
      address: 'Carrera 27 # 52-14',
      city: 'Bucaramanga',
      notes: 'En camión de reparto #2',
      paymentMethod: 'contraentrega',
    },
    items: [
      { product: INITIAL_PRODUCTS[26], quantity: 3 }, // Jet x3
      { product: INITIAL_PRODUCTS[27], quantity: 3 }, // Chocoramo Mini x3
      { product: INITIAL_PRODUCTS[1], quantity: 2 },  // Bilac x2
    ],
    totalPrice: 242500,
    totalItemsCount: 8,
    createdAt: '2025-03-11T08:30:00.000Z',
  }
];

// ==================== ESTRUCTURA DE LA BASE DE DATOS COMPLETA ====================
export interface EmbeddedDatabase {
  version: string;
  name: string;
  updatedAt: string;
  branding: StoreBranding;
  categories: string[];
  products: Product[];
  customers: Customer[];
  admins: AdminUser[];
  orders: OrderRecord[];
}

export const LOCAL_DATABASE: EmbeddedDatabase = {
  version: '2.0.0-in-code',
  name: 'Base de Datos Local AYM DISTRIBUCIONES',
  updatedAt: '2025-03-11T12:00:00.000Z',
  branding: DEFAULT_BRANDING,
  categories: DEFAULT_BASE_CATEGORIES,
  products: INITIAL_PRODUCTS,
  customers: INITIAL_CUSTOMERS,
  admins: DEFAULT_ADMINS,
  orders: INITIAL_ORDERS,
};
