import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

const PORT = 3000;
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'app_database.json');
const CATEGORIES_FILE = path.join(DATA_DIR, 'categories.json');
const BRANDING_FILE = path.join(DATA_DIR, 'branding.json');
const CUSTOMERS_FILE = path.join(DATA_DIR, 'customers.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const ADMINS_FILE = path.join(DATA_DIR, 'admins.json');

const SRC_DATA_DIR = path.join(process.cwd(), 'src', 'data');
const CATALOG_JSON_FILE = path.join(SRC_DATA_DIR, 'products_catalog.json');
const SRC_CATEGORIES_FILE = path.join(SRC_DATA_DIR, 'categories.json');
const SRC_BRANDING_FILE = path.join(SRC_DATA_DIR, 'branding.json');

// Interface for persistent store
interface PersistentDB {
  products: any[];
  categories: string[];
  branding: any;
  customers: any[];
  orders: any[];
  admins: any[];
  lastUpdated: string;
}

let inMemoryDB: PersistentDB | null = null;
let isFlushingFullDb = false;
let pendingFullDbFlush = false;

function writeJsonFileSync(filePath: string, data: any): void {
  try {
    const parentDir = path.dirname(filePath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    const tmp = `${filePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data), 'utf-8');
    fs.renameSync(tmp, filePath);
  } catch (e) {
    console.error(`[Server DB] Failed to write ${filePath}:`, e);
  }
}

function flushDatabaseToDisk(db: PersistentDB): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    // 1. Instantly write modular metadata files to data/ and src/data/ (< 1ms)
    writeJsonFileSync(CATEGORIES_FILE, db.categories);
    writeJsonFileSync(SRC_CATEGORIES_FILE, db.categories);

    writeJsonFileSync(BRANDING_FILE, db.branding);
    writeJsonFileSync(SRC_BRANDING_FILE, db.branding);

    writeJsonFileSync(CUSTOMERS_FILE, db.customers);
    writeJsonFileSync(ORDERS_FILE, db.orders);
    writeJsonFileSync(ADMINS_FILE, db.admins);

    // 2. Schedule non-blocking async flush for complete catalog (16MB+)
    scheduleFullDatabaseFlush();
  } catch (e) {
    console.error('[Server DB] Failed to flush to disk:', e);
  }
}

function scheduleFullDatabaseFlush(): void {
  if (isFlushingFullDb) {
    pendingFullDbFlush = true;
    return;
  }
  isFlushingFullDb = true;
  pendingFullDbFlush = false;

  setImmediate(async () => {
    try {
      if (!inMemoryDB) return;
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const tmp = `${DB_FILE}.tmp`;
      const json = JSON.stringify(inMemoryDB);
      await fs.promises.writeFile(tmp, json, 'utf-8');
      await fs.promises.rename(tmp, DB_FILE);

      // Permanently update src/data/products_catalog.json as well
      const catalogTmp = `${CATALOG_JSON_FILE}.tmp`;
      const catalogJson = JSON.stringify(inMemoryDB.products);
      await fs.promises.writeFile(catalogTmp, catalogJson, 'utf-8');
      await fs.promises.rename(catalogTmp, CATALOG_JSON_FILE);

      console.log(`[Server DB] Full database successfully synced to ${DB_FILE} & ${CATALOG_JSON_FILE} (${inMemoryDB.products.length} products)`);
    } catch (e) {
      console.error('[Server DB] Full database flush error:', e);
    } finally {
      isFlushingFullDb = false;
      if (pendingFullDbFlush) {
        scheduleFullDatabaseFlush();
      }
    }
  });
}

function getInitialDefaults(): PersistentDB {
  let products: any[] = [];
  try {
    if (fs.existsSync(CATALOG_JSON_FILE)) {
      const raw = fs.readFileSync(CATALOG_JSON_FILE, 'utf-8');
      products = JSON.parse(raw);
    }
  } catch (e) {
    console.error('[Server] Error loading initial catalog:', e);
  }

  let defaultCategories: string[] = [
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

  if (fs.existsSync(SRC_CATEGORIES_FILE)) {
    try {
      const srcCats = JSON.parse(fs.readFileSync(SRC_CATEGORIES_FILE, 'utf-8'));
      if (Array.isArray(srcCats) && srcCats.length > 0) {
        defaultCategories = srcCats;
      }
    } catch {}
  }

  let defaultBranding = {
    name: 'AYM DISTRIBUCIONES',
    subtitle: 'aym-distribuciones.verse.app',
    logoUrl: '',
    whatsappNumber: '3113986110',
  };

  if (fs.existsSync(SRC_BRANDING_FILE)) {
    try {
      const srcBrand = JSON.parse(fs.readFileSync(SRC_BRANDING_FILE, 'utf-8'));
      if (srcBrand && srcBrand.name) {
        defaultBranding = srcBrand;
      }
    } catch {}
  }

  const defaultAdmins = [
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
    },
  ];

  const defaultCustomers = [
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
  ];

  const defaultOrders = [
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
        { product: products[0] || { id: 'p0', name: 'Item 1', price: 10000 }, quantity: 3 },
      ],
      totalPrice: 442400,
      totalItemsCount: 3,
      createdAt: '2025-03-08T09:30:00.000Z',
    },
  ];

  return {
    products,
    categories: defaultCategories,
    branding: defaultBranding,
    customers: defaultCustomers,
    orders: defaultOrders,
    admins: defaultAdmins,
    lastUpdated: new Date().toISOString(),
  };
}

function loadDatabaseFromDisk(): PersistentDB {
  let db: PersistentDB | null = null;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (parsed && Array.isArray(parsed.products)) {
        db = parsed;
        console.log(`[Server DB] Loaded from disk: ${parsed.products.length} products, ${parsed.orders?.length || 0} orders`);
      }
    }
  } catch (e) {
    console.error('[Server DB] Error reading DB from disk, falling back to defaults:', e);
  }

  if (!db) {
    db = getInitialDefaults();
    flushDatabaseToDisk(db);
    return db;
  }

  // Overlay modular files if they exist (allows individual component state durability)
  try {
    const catFile = fs.existsSync(CATEGORIES_FILE) ? CATEGORIES_FILE : (fs.existsSync(SRC_CATEGORIES_FILE) ? SRC_CATEGORIES_FILE : null);
    if (catFile) {
      const catData = JSON.parse(fs.readFileSync(catFile, 'utf-8'));
      if (Array.isArray(catData) && catData.length > 0) db.categories = catData;
    }
    const brandFile = fs.existsSync(BRANDING_FILE) ? BRANDING_FILE : (fs.existsSync(SRC_BRANDING_FILE) ? SRC_BRANDING_FILE : null);
    if (brandFile) {
      const brandData = JSON.parse(fs.readFileSync(brandFile, 'utf-8'));
      if (brandData && typeof brandData === 'object' && brandData.name) db.branding = brandData;
    }
    if (fs.existsSync(CUSTOMERS_FILE)) {
      const custData = JSON.parse(fs.readFileSync(CUSTOMERS_FILE, 'utf-8'));
      if (Array.isArray(custData)) db.customers = custData;
    }
    if (fs.existsSync(ORDERS_FILE)) {
      const ordData = JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf-8'));
      if (Array.isArray(ordData)) db.orders = ordData;
    }
    if (fs.existsSync(ADMINS_FILE)) {
      const admData = JSON.parse(fs.readFileSync(ADMINS_FILE, 'utf-8'));
      if (Array.isArray(admData)) db.admins = admData;
    }
  } catch (e) {
    console.warn('[Server DB] Note reading modular overlay files:', e);
  }

  return db;
}

async function startServer() {
  const app = express();

  // Support large base64 images
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ extended: true, limit: '100mb' }));

  // Load database into memory and ensure files in src/data and data/ are in sync
  inMemoryDB = loadDatabaseFromDisk();
  flushDatabaseToDisk(inMemoryDB);

  // API Health
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      productsCount: inMemoryDB?.products.length || 0,
      ordersCount: inMemoryDB?.orders.length || 0,
      customersCount: inMemoryDB?.customers.length || 0,
      lastUpdated: inMemoryDB?.lastUpdated,
    });
  });

  // GET complete database
  app.get('/api/db', (req, res) => {
    if (!inMemoryDB) inMemoryDB = loadDatabaseFromDisk();
    res.json(inMemoryDB);
  });

  // GET products only
  app.get('/api/db/products', (req, res) => {
    if (!inMemoryDB) inMemoryDB = loadDatabaseFromDisk();
    res.json(inMemoryDB.products);
  });

  // GET categories only
  app.get('/api/db/categories', (req, res) => {
    if (!inMemoryDB) inMemoryDB = loadDatabaseFromDisk();
    res.json(inMemoryDB.categories || []);
  });

  // GET branding only
  app.get('/api/db/branding', (req, res) => {
    if (!inMemoryDB) inMemoryDB = loadDatabaseFromDisk();
    res.json(inMemoryDB.branding || {});
  });

  // GET customers only
  app.get('/api/db/customers', (req, res) => {
    if (!inMemoryDB) inMemoryDB = loadDatabaseFromDisk();
    res.json(inMemoryDB.customers || []);
  });

  // GET orders only
  app.get('/api/db/orders', (req, res) => {
    if (!inMemoryDB) inMemoryDB = loadDatabaseFromDisk();
    res.json(inMemoryDB.orders || []);
  });

  // GET admins only
  app.get('/api/db/admins', (req, res) => {
    if (!inMemoryDB) inMemoryDB = loadDatabaseFromDisk();
    res.json(inMemoryDB.admins || []);
  });

  // POST update all products
  app.post('/api/db/products', (req, res) => {
    if (!inMemoryDB) inMemoryDB = loadDatabaseFromDisk();
    const { products } = req.body;
    if (Array.isArray(products)) {
      inMemoryDB.products = products;
      inMemoryDB.lastUpdated = new Date().toISOString();
      flushDatabaseToDisk(inMemoryDB);
      res.json({ success: true, count: products.length });
    } else {
      res.status(400).json({ error: 'Expected products array' });
    }
  });

  // POST single product (create or update)
  app.post('/api/db/product', (req, res) => {
    if (!inMemoryDB) inMemoryDB = loadDatabaseFromDisk();
    const product = req.body;
    if (!product || !product.id) {
      res.status(400).json({ error: 'Product id is required' });
      return;
    }
    const idx = inMemoryDB.products.findIndex((p: any) => p.id === product.id);
    if (idx >= 0) {
      inMemoryDB.products[idx] = product;
    } else {
      inMemoryDB.products.unshift(product);
    }
    inMemoryDB.lastUpdated = new Date().toISOString();
    flushDatabaseToDisk(inMemoryDB);
    res.json({ success: true, product });
  });

  // DELETE single product
  app.delete('/api/db/product/:id', (req, res) => {
    if (!inMemoryDB) inMemoryDB = loadDatabaseFromDisk();
    const { id } = req.params;
    inMemoryDB.products = inMemoryDB.products.filter((p: any) => p.id !== id);
    inMemoryDB.lastUpdated = new Date().toISOString();
    flushDatabaseToDisk(inMemoryDB);
    res.json({ success: true, deletedId: id });
  });

  // POST categories
  app.post('/api/db/categories', (req, res) => {
    if (!inMemoryDB) inMemoryDB = loadDatabaseFromDisk();
    const { categories } = req.body;
    if (Array.isArray(categories)) {
      inMemoryDB.categories = categories;
      inMemoryDB.lastUpdated = new Date().toISOString();
      flushDatabaseToDisk(inMemoryDB);
      res.json({ success: true, categories });
    } else {
      res.status(400).json({ error: 'Expected categories array' });
    }
  });

  // POST branding
  app.post('/api/db/branding', (req, res) => {
    if (!inMemoryDB) inMemoryDB = loadDatabaseFromDisk();
    const { branding } = req.body;
    if (branding && typeof branding === 'object') {
      inMemoryDB.branding = { ...inMemoryDB.branding, ...branding };
      inMemoryDB.lastUpdated = new Date().toISOString();
      flushDatabaseToDisk(inMemoryDB);
      res.json({ success: true, branding: inMemoryDB.branding });
    } else {
      res.status(400).json({ error: 'Expected branding object' });
    }
  });

  // POST customers
  app.post('/api/db/customers', (req, res) => {
    if (!inMemoryDB) inMemoryDB = loadDatabaseFromDisk();
    const { customers } = req.body;
    if (Array.isArray(customers)) {
      inMemoryDB.customers = customers;
      inMemoryDB.lastUpdated = new Date().toISOString();
      flushDatabaseToDisk(inMemoryDB);
      res.json({ success: true, count: customers.length });
    } else {
      res.status(400).json({ error: 'Expected customers array' });
    }
  });

  // POST single customer
  app.post('/api/db/customer', (req, res) => {
    if (!inMemoryDB) inMemoryDB = loadDatabaseFromDisk();
    const customer = req.body;
    if (!customer || !customer.id) {
      res.status(400).json({ error: 'Customer id is required' });
      return;
    }
    const idx = inMemoryDB.customers.findIndex((c: any) => c.id === customer.id);
    if (idx >= 0) {
      inMemoryDB.customers[idx] = customer;
    } else {
      inMemoryDB.customers.unshift(customer);
    }
    inMemoryDB.lastUpdated = new Date().toISOString();
    flushDatabaseToDisk(inMemoryDB);
    res.json({ success: true, customer });
  });

  // DELETE single customer
  app.delete('/api/db/customer/:id', (req, res) => {
    if (!inMemoryDB) inMemoryDB = loadDatabaseFromDisk();
    const { id } = req.params;
    inMemoryDB.customers = inMemoryDB.customers.filter((c: any) => c.id !== id);
    inMemoryDB.lastUpdated = new Date().toISOString();
    flushDatabaseToDisk(inMemoryDB);
    res.json({ success: true, deletedId: id });
  });

  // POST orders
  app.post('/api/db/orders', (req, res) => {
    if (!inMemoryDB) inMemoryDB = loadDatabaseFromDisk();
    const { orders } = req.body;
    if (Array.isArray(orders)) {
      inMemoryDB.orders = orders;
      inMemoryDB.lastUpdated = new Date().toISOString();
      flushDatabaseToDisk(inMemoryDB);
      res.json({ success: true, count: orders.length });
    } else {
      res.status(400).json({ error: 'Expected orders array' });
    }
  });

  // POST single order
  app.post('/api/db/order', (req, res) => {
    if (!inMemoryDB) inMemoryDB = loadDatabaseFromDisk();
    const order = req.body;
    if (!order || !order.id) {
      res.status(400).json({ error: 'Order id is required' });
      return;
    }
    const idx = inMemoryDB.orders.findIndex((o: any) => o.id === order.id);
    if (idx >= 0) {
      inMemoryDB.orders[idx] = order;
    } else {
      inMemoryDB.orders.unshift(order);
    }
    inMemoryDB.lastUpdated = new Date().toISOString();
    flushDatabaseToDisk(inMemoryDB);
    res.json({ success: true, order });
  });

  // DELETE single order
  app.delete('/api/db/order/:id', (req, res) => {
    if (!inMemoryDB) inMemoryDB = loadDatabaseFromDisk();
    const { id } = req.params;
    inMemoryDB.orders = inMemoryDB.orders.filter((o: any) => o.id !== id);
    inMemoryDB.lastUpdated = new Date().toISOString();
    flushDatabaseToDisk(inMemoryDB);
    res.json({ success: true, deletedId: id });
  });

  // POST admins
  app.post('/api/db/admins', (req, res) => {
    if (!inMemoryDB) inMemoryDB = loadDatabaseFromDisk();
    const { admins } = req.body;
    if (Array.isArray(admins)) {
      inMemoryDB.admins = admins;
      inMemoryDB.lastUpdated = new Date().toISOString();
      flushDatabaseToDisk(inMemoryDB);
      res.json({ success: true, count: admins.length });
    } else {
      res.status(400).json({ error: 'Expected admins array' });
    }
  });

  // POST single admin
  app.post('/api/db/admin', (req, res) => {
    if (!inMemoryDB) inMemoryDB = loadDatabaseFromDisk();
    const admin = req.body;
    if (!admin || !admin.id) {
      res.status(400).json({ error: 'Admin id is required' });
      return;
    }
    const idx = inMemoryDB.admins.findIndex((a: any) => a.id === admin.id);
    if (idx >= 0) {
      inMemoryDB.admins[idx] = admin;
    } else {
      inMemoryDB.admins.push(admin);
    }
    inMemoryDB.lastUpdated = new Date().toISOString();
    flushDatabaseToDisk(inMemoryDB);
    res.json({ success: true, admin });
  });

  // DELETE single admin
  app.delete('/api/db/admin/:id', (req, res) => {
    if (!inMemoryDB) inMemoryDB = loadDatabaseFromDisk();
    const { id } = req.params;
    inMemoryDB.admins = inMemoryDB.admins.filter((a: any) => a.id !== id);
    inMemoryDB.lastUpdated = new Date().toISOString();
    flushDatabaseToDisk(inMemoryDB);
    res.json({ success: true, deletedId: id });
  });

  // POST full sync from client
  app.post('/api/db/sync', (req, res) => {
    if (!inMemoryDB) inMemoryDB = loadDatabaseFromDisk();
    const incoming = req.body;
    if (incoming) {
      if (Array.isArray(incoming.products) && incoming.products.length > 0) inMemoryDB.products = incoming.products;
      if (Array.isArray(incoming.categories) && incoming.categories.length > 0) inMemoryDB.categories = incoming.categories;
      if (incoming.branding && typeof incoming.branding === 'object') inMemoryDB.branding = incoming.branding;
      if (Array.isArray(incoming.customers)) inMemoryDB.customers = incoming.customers;
      if (Array.isArray(incoming.orders)) inMemoryDB.orders = incoming.orders;
      if (Array.isArray(incoming.admins) && incoming.admins.length > 0) inMemoryDB.admins = incoming.admins;
      inMemoryDB.lastUpdated = new Date().toISOString();
      flushDatabaseToDisk(inMemoryDB);
      res.json({ success: true, message: 'Database synced to disk permanently', lastUpdated: inMemoryDB.lastUpdated });
      return;
    }
    res.status(400).json({ error: 'Invalid sync payload' });
  });

  // POST reset to factory defaults
  app.post('/api/db/reset', (req, res) => {
    inMemoryDB = getInitialDefaults();
    flushDatabaseToDisk(inMemoryDB);
    res.json({ success: true, message: 'Reset to factory defaults successfully', db: inMemoryDB });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
