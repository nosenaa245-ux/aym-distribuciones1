import React, { useState, useMemo, useEffect, useCallback, useDeferredValue, useRef } from 'react';
import { INITIAL_PRODUCTS, DEFAULT_BASE_CATEGORIES, DEFAULT_BRANDING } from './data/products';
import { Product, CartItem, OrderCustomerInfo, StoreBranding, Customer } from './types';
import {
  subscribeToProducts,
  subscribeToBranding,
  subscribeToCategories,
  saveProductLocal,
  deleteProductLocal,
  resetProductsLocal,
  importProductsLocal,
  saveCategoriesLocal,
  saveBrandingLocal,
  createOrderLocal,
  getOrderByNumberLocal,
  decrementProductsStockLocal,
  getLocalProducts,
  getLocalProductsAsync,
  getLocalCategories,
  getLocalBranding,
  saveLocalProducts,
  saveLocalCategories,
  saveLocalBranding,
  saveProductsBatchLocal,
  loadCompleteDatabase,
  DataMode,
} from './lib/localDatabase';
import { getWhatsAppDirectUrl } from './utils/orderUtils';
import { WhatsAppBar } from './components/WhatsAppBar';
import { TopHeader } from './components/TopHeader';
import { SearchFilterBar } from './components/SearchFilterBar';
import { ProductCard } from './components/ProductCard';
import { BottomStickyCartBar } from './components/BottomStickyCartBar';
import { CartDrawer } from './components/CartDrawer';
import { ProductDetailModal } from './components/ProductDetailModal';
import { OrderSuccessModal } from './components/OrderSuccessModal';
import { AdminPanelModal } from './components/AdminPanelModal';
import { CustomerIdentificationModal } from './components/CustomerIdentificationModal';
import { ProductSliderBar } from './components/ProductSliderBar';
import { Tag, AlertCircle, Sliders, Plus, ChevronDown, Zap, LayoutGrid, SlidersHorizontal, HardDrive, Database } from 'lucide-react';

const PRODUCTS_STORAGE_KEY = 'glux_products_catalog';
const BRANDING_STORAGE_KEY = 'aym_store_branding';
const CATEGORIES_STORAGE_KEY = 'aym_store_categories';
const CUSTOMER_STORAGE_KEY = 'aym_active_customer';
const VIEW_MODE_STORAGE_KEY = 'aym_product_view_mode';

const INITIAL_BATCH_SIZE = 48;
const BATCH_INCREMENT = 48;

export default function App() {
  const [dataMode, setDataModeState] = useState<DataMode>('local');
  const [adminInitialTab, setAdminInitialTab] = useState<
    | 'list'
    | 'editor'
    | 'categories'
    | 'customers'
    | 'orders'
    | 'excel'
    | 'unsold_report'
    | 'branding'
    | 'admins'
    | 'local_database'
  >('list');

  // 1. Store Branding (Name, subtitle, logo)
  const [branding, setBranding] = useState<StoreBranding>(() => {
    return getLocalBranding();
  });

  // 2. Dynamic Categories
  const [categories, setCategories] = useState<string[]>(() => {
    return getLocalCategories();
  });

  // 3. Load products from local Database
  const [products, setProducts] = useState<Product[]>(() => {
    return getLocalProducts();
  });

  // Hydrate full database from permanent server disk on mount and on page reload
  useEffect(() => {
    let isMounted = true;
    loadCompleteDatabase().then((db) => {
      if (!isMounted || !db) return;
      if (Array.isArray(db.products) && db.products.length > 0) {
        setProducts(db.products);
      }
      if (Array.isArray(db.categories) && db.categories.length > 0) {
        setCategories(db.categories);
      }
      if (db.branding && db.branding.name) {
        setBranding(db.branding);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleToggleDataMode = async (mode: DataMode) => {
    setDataModeState(mode);
    const localProds = await getLocalProductsAsync();
    setProducts(localProds);
    const localCats = getLocalCategories();
    setCategories(localCats);
    const localBranding = getLocalBranding();
    setBranding(localBranding);
  };

  // Products Map for O(1) super-fast lookup
  const productsMap = useMemo(() => {
    const map = new Map<string, Product>();
    for (let i = 0; i < products.length; i++) {
      map.set(products[i].id, products[i]);
    }
    return map;
  }, [products]);

  // ==================== LOCAL DATABASE LISTENERS ====================
  useEffect(() => {
    // 1. Subscribe to Products
    const unsubProducts = subscribeToProducts(
      (localProducts) => {
        if (Array.isArray(localProducts) && localProducts.length > 0) {
          setProducts(localProducts);
        }
      },
      (err) => {
        console.warn('Error reading local catalog:', err);
      }
    );

    // 2. Subscribe to Branding
    const unsubBranding = subscribeToBranding((localBranding) => {
      if (localBranding) {
        setBranding(localBranding);
      }
    });

    // 3. Subscribe to Categories
    const unsubCategories = subscribeToCategories((localCategories) => {
      if (localCategories && localCategories.length > 0) {
        setCategories(localCategories);
      }
    });

    // 4. Check for ?pedido=AYM-XXXX in URL
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const pedidoParam = urlParams.get('pedido');
      if (pedidoParam) {
        getOrderByNumberLocal(pedidoParam).then((record) => {
          if (record) {
            setOrderCompleted({
              orderNumber: record.orderNumber,
              items: record.items,
              customer: record.customer,
            });
          }
        });
      }
    } catch (e) {}

    return () => {
      unsubProducts();
      unsubBranding();
      unsubCategories();
    };
  }, []);

  // Cart state
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  // React 18 useDeferredValue ensures typing in search remains 100% fluid with 10k products
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [sortBy, setSortBy] = useState('featured');
  const [onlyPromos, setOnlyPromos] = useState(false);

  // Progressive infinite scroll visible count
  const [visibleLimit, setVisibleLimit] = useState(INITIAL_BATCH_SIZE);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // View Mode State: 'grid' (cuadrícula) or 'slider' (carrusel deslizable)
  const [viewMode, setViewMode] = useState<'grid' | 'slider'>(() => {
    try {
      const saved = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
      if (saved === 'slider' || saved === 'grid') return saved;
    } catch (e) {}
    return 'grid';
  });

  const handleToggleViewMode = (mode: 'grid' | 'slider') => {
    setViewMode(mode);
    try {
      localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
    } catch (e) {}
  };

  // Modals state
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [activeCustomer, setActiveCustomer] = useState<Customer | null>(() => {
    try {
      const saved = localStorage.getItem(CUSTOMER_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {}
    return null;
  });
  const [selectedProductDetails, setSelectedProductDetails] = useState<Product | null>(null);
  const [orderCompleted, setOrderCompleted] = useState<{
    orderNumber: string;
    items: CartItem[];
    customer: OrderCustomerInfo;
  } | null>(null);

  // Quantities map for ultra-fast lookup
  const quantityMap = useMemo(() => {
    const map = new Map<string, number>();
    cartItems.forEach((item) => {
      map.set(item.product.id, item.quantity);
    });
    return map;
  }, [cartItems]);

  // Total item count in cart
  const totalItemsCount = useMemo(() => {
    return cartItems.reduce((acc, item) => acc + item.quantity, 0);
  }, [cartItems]);

  // Total price in COP
  const totalPrice = useMemo(() => {
    return cartItems.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
  }, [cartItems]);

  // Original total price in COP
  const originalTotalPrice = useMemo(() => {
    return cartItems.reduce((acc, item) => {
      const regular = item.product.originalPrice || item.product.price;
      return acc + regular * item.quantity;
    }, 0);
  }, [cartItems]);

  // Cart operations (Delta +/- and Exact Quantity Setters) - memoized with useCallback
  const handleUpdateQuantity = useCallback(
    (productId: string, delta: number) => {
      const targetProduct = productsMap.get(productId);
      if (!targetProduct) return;

      const maxStock = typeof targetProduct.stock === 'number' ? targetProduct.stock : 100;
      if (maxStock <= 0 && delta > 0) return; // Block adding out-of-stock items

      setCartItems((prev) => {
        const existsIndex = prev.findIndex((item) => item.product.id === productId);
        if (existsIndex >= 0) {
          const currentQty = prev[existsIndex].quantity;
          let newQty = currentQty + delta;
          if (newQty > maxStock) newQty = maxStock;
          if (newQty <= 0) {
            return prev.filter((item) => item.product.id !== productId);
          }
          const next = [...prev];
          next[existsIndex] = { ...next[existsIndex], quantity: newQty };
          return next;
        } else {
          if (delta <= 0) return prev;
          const initialQty = Math.min(delta, maxStock);
          if (initialQty <= 0) return prev;
          return [...prev, { product: targetProduct, quantity: initialQty }];
        }
      });
    },
    [productsMap]
  );

  const handleSetQuantity = useCallback(
    (productId: string, exactQuantity: number) => {
      if (exactQuantity <= 0) {
        setCartItems((prev) => prev.filter((item) => item.product.id !== productId));
        return;
      }

      const targetProduct = productsMap.get(productId);
      if (!targetProduct) return;

      const maxStock = typeof targetProduct.stock === 'number' ? targetProduct.stock : 100;
      if (maxStock <= 0) {
        setCartItems((prev) => prev.filter((item) => item.product.id !== productId));
        return;
      }

      const cappedQty = Math.min(exactQuantity, maxStock);

      setCartItems((prev) => {
        const existsIndex = prev.findIndex((item) => item.product.id === productId);
        if (existsIndex >= 0) {
          const next = [...prev];
          next[existsIndex] = { ...next[existsIndex], quantity: cappedQty };
          return next;
        }
        return [...prev, { product: targetProduct, quantity: cappedQty }];
      });
    },
    [productsMap]
  );

  const handleRemoveItem = useCallback((productId: string) => {
    setCartItems((prev) => prev.filter((item) => item.product.id !== productId));
  }, []);

  const handleClearCart = useCallback(() => {
    setCartItems([]);
  }, []);

  const handleResetView = useCallback(() => {
    setSearchQuery('');
    setSelectedCategory('Todas');
    setOnlyPromos(false);
    setVisibleLimit(INITIAL_BATCH_SIZE);
  }, []);

  const handleOpenDetails = useCallback((prod: Product) => {
    setSelectedProductDetails(prod);
    try {
      window.history.replaceState(null, '', `#producto-${prod.id}`);
    } catch (e) {}
  }, []);

  const handleCloseDetails = useCallback(() => {
    setSelectedProductDetails(null);
    try {
      if (window.location.hash.startsWith('#producto-')) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    } catch (e) {}
  }, []);

  // Sync details modal with URL hash if user opens or navigates directly
  useEffect(() => {
    const handleHashSync = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#producto-')) {
        const prodId = hash.replace('#producto-', '');
        const found = products.find((p) => p.id === prodId);
        if (found) {
          setSelectedProductDetails(found);
        }
      }
    };
    if (products.length > 0) {
      handleHashSync();
    }
    window.addEventListener('hashchange', handleHashSync);
    return () => window.removeEventListener('hashchange', handleHashSync);
  }, [products]);

  // Focus catalog search input helper with multiple retries for instant & reliable focus
  const focusCatalogSearchInput = useCallback(() => {
    setIsSearchOpen(true);

    const tryFocus = () => {
      const el = document.getElementById('input-catalog-search') as HTMLInputElement | null;
      if (el) {
        el.focus();
        el.select();
        try {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } catch (e) {}
        return true;
      }
      return false;
    };

    // Try immediately
    if (!tryFocus()) {
      // Retry in next frame and progressive timeouts to account for React state mount
      requestAnimationFrame(() => {
        if (!tryFocus()) {
          setTimeout(tryFocus, 25);
          setTimeout(tryFocus, 75);
          setTimeout(tryFocus, 180);
          setTimeout(tryFocus, 350);
        }
      });
    }
  }, []);

  // Global F10 shortcut for "Buscar" (Search option)
  useEffect(() => {
    const isF10Event = (e: KeyboardEvent) => {
      return (
        e.key === 'F10' ||
        e.code === 'F10' ||
        e.keyCode === 121 ||
        e.which === 121
      );
    };

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (isF10Event(e)) {
        // Prevent default browser behavior (like opening browser menu bar on Windows)
        e.preventDefault();
        e.stopPropagation();

        // 1. If customer identification modal is open, focus customer search input
        if (isCustomerModalOpen) {
          const custInput = document.getElementById('input-customer-search') as HTMLInputElement | null;
          if (custInput) {
            custInput.focus();
            custInput.select();
            return;
          }
        }

        // 2. If the Admin Panel modal is open, focus the active search/filter input within it
        if (isAdminOpen) {
          const adminSearchInput = (document.getElementById('input-admin-search') ||
            document.querySelector<HTMLInputElement>(
              'input[placeholder*="iltrar"], input[placeholder*="uscar"]'
            )) as HTMLInputElement | null;
          if (adminSearchInput) {
            adminSearchInput.focus();
            adminSearchInput.select();
            return;
          }
        }

        // 3. Otherwise, always enter into the catalog search box!
        focusCatalogSearchInput();
      }
    };

    const handleGlobalKeyUp = (e: KeyboardEvent) => {
      if (isF10Event(e)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    // Use capture: true to intercept before default browser function key behavior
    window.addEventListener('keydown', handleGlobalKeyDown, true);
    window.addEventListener('keyup', handleGlobalKeyUp, true);
    document.addEventListener('keydown', handleGlobalKeyDown, true);
    document.addEventListener('keyup', handleGlobalKeyUp, true);

    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown, true);
      window.removeEventListener('keyup', handleGlobalKeyUp, true);
      document.removeEventListener('keydown', handleGlobalKeyDown, true);
      document.removeEventListener('keyup', handleGlobalKeyUp, true);
    };
  }, [isAdminOpen, isCustomerModalOpen, focusCatalogSearchInput]);

  const handleToggleSearch = useCallback(() => {
    setIsSearchOpen((prev) => {
      if (!prev) {
        focusCatalogSearchInput();
        return true;
      }
      const input = document.getElementById('input-catalog-search') as HTMLInputElement | null;
      if (input && document.activeElement !== input) {
        input.focus();
        input.select();
        return true;
      }
      return false;
    });
  }, [focusCatalogSearchInput]);

  const [productToEdit, setProductToEdit] = useState<Product | null>(null);

  const handleEditProduct = useCallback((prod: Product) => {
    setProductToEdit(prod);
    setIsAdminOpen(true);
  }, []);

  const handleCloseAdmin = useCallback(() => {
    setIsAdminOpen(false);
    setProductToEdit(null);
    setAdminInitialTab('list');
  }, []);

  // Admin Catalog & Category Handlers (Permanent Server Disk + Local persistence)
  const handleSaveProduct = async (updatedProduct: Product) => {
    // 1. Optimistic UI update
    setProducts((prev) => {
      const index = prev.findIndex((p) => p.id === updatedProduct.id);
      if (index >= 0) {
        const next = [...prev];
        next[index] = updatedProduct;
        return next;
      }
      return [updatedProduct, ...prev];
    });

    // Sync cart item if present
    setCartItems((prev) =>
      prev.map((item) =>
        item.product.id === updatedProduct.id
          ? { ...item, product: updatedProduct }
          : item
      )
    );

    // 2. Persist to local database and server disk (guaranteed)
    await saveProductLocal(updatedProduct);
  };

  const handleDeleteProduct = async (productId: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== productId));
    setCartItems((prev) => prev.filter((item) => item.product.id !== productId));
    await deleteProductLocal(productId);
  };

  const handleResetToDefaults = async () => {
    try {
      await fetch('/api/db/reset', { method: 'POST' });
    } catch (e) {}
    setProducts(INITIAL_PRODUCTS);
    setCategories(DEFAULT_BASE_CATEGORIES);
    setBranding(DEFAULT_BRANDING);
    try {
      localStorage.removeItem(PRODUCTS_STORAGE_KEY);
      localStorage.removeItem('aym_local_db_products');
      localStorage.removeItem(CATEGORIES_STORAGE_KEY);
      localStorage.removeItem('aym_store_categories');
      localStorage.removeItem(BRANDING_STORAGE_KEY);
      localStorage.removeItem('aym_store_branding');
    } catch (e) {}

    await resetProductsLocal();
    await saveCategoriesLocal(DEFAULT_BASE_CATEGORIES);
    await saveBrandingLocal(DEFAULT_BRANDING);
  };

  const handleImportProducts = async (
    newProducts: Product[],
    mode: 'merge' | 'replace' = 'merge',
    onProgress?: (processed: number, total: number, message: string) => void
  ) => {
    await importProductsLocal(newProducts, mode, onProgress);
    const fresh = await getLocalProductsAsync();
    setProducts(fresh);
  };

  const handleSaveCategories = async (newCategories: string[]) => {
    setCategories(newCategories);
    await saveCategoriesLocal(newCategories);
  };

  const handleRenameCategory = async (oldCategory: string, newCategory: string) => {
    // Automatically update all products that belonged to oldCategory
    const updatedProducts = products.map((prod) =>
      prod.category === oldCategory ? { ...prod, category: newCategory } : prod
    );
    setProducts(updatedProducts);
    await saveProductsBatchLocal(updatedProducts);
  };

  const handleSaveBranding = async (newBranding: StoreBranding) => {
    setBranding(newBranding);
    await saveBrandingLocal(newBranding);
  };

  // Filtered & sorted product list (Optimized for 10,000 items with non-blocking deferred query)
  const filteredProducts = useMemo(() => {
    const q = deferredSearchQuery.trim().toLowerCase();
    const isSearchActive = q.length > 0;
    const isCategoryAll = selectedCategory === 'Todas';
    const isCategoryPromo = selectedCategory === 'Promociones 🔥';

    const result: Product[] = [];

    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      const isProductPromoActive =
        product.hasPromotion === true ||
        (product.hasPromotion !== false && Boolean(product.promoBadge && product.promoBadge.trim().length > 0));

      // Category filter
      if (isCategoryPromo) {
        if (!isProductPromoActive) continue;
      } else if (!isCategoryAll && product.category !== selectedCategory) {
        continue;
      }

      // Only promos toggle
      if (onlyPromos && !isProductPromoActive) {
        continue;
      }

      // Search query
      if (isSearchActive) {
        const matchName = product.name.toLowerCase().includes(q);
        const matchCategory = product.category.toLowerCase().includes(q);
        const matchPromo = product.promoBadge?.toLowerCase().includes(q);
        const matchSku = product.sku?.toLowerCase().includes(q);
        const matchBarcode = product.barcode?.toLowerCase().includes(q);
        if (!matchName && !matchCategory && !matchPromo && !matchSku && !matchBarcode) {
          continue;
        }
      }

      result.push(product);
    }

    // Sort result
    if (sortBy === 'discount') {
      result.sort((a, b) => {
        const discountA = a.originalPrice ? (a.originalPrice - a.price) / a.originalPrice : 0;
        const discountB = b.originalPrice ? (b.originalPrice - b.price) / b.originalPrice : 0;
        return discountB - discountA;
      });
    } else if (sortBy === 'price-asc') {
      result.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price-desc') {
      result.sort((a, b) => b.price - a.price);
    } else if (sortBy === 'name') {
      result.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      // featured
      result.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
    }

    return result;
  }, [products, deferredSearchQuery, selectedCategory, onlyPromos, sortBy]);

  // Featured and promotional products for horizontal slider showcase
  const featuredPromoProducts = useMemo(() => {
    return products.filter(
      (p) =>
        p.featured ||
        p.hasPromotion === true ||
        (Boolean(p.promoBadge) && p.promoBadge!.trim().length > 0)
    );
  }, [products]);

  // Reset visible limit on filter changes
  useEffect(() => {
    setVisibleLimit(INITIAL_BATCH_SIZE);
  }, [deferredSearchQuery, selectedCategory, onlyPromos, sortBy]);

  // Visible products slice (progressive rendering keeps DOM light & responsive)
  const visibleProducts = useMemo(() => {
    return filteredProducts.slice(0, visibleLimit);
  }, [filteredProducts, visibleLimit]);

  const hasMoreProducts = visibleLimit < filteredProducts.length;

  // IntersectionObserver for 60fps infinite progressive loading
  useEffect(() => {
    if (!hasMoreProducts) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleLimit((prev) => Math.min(prev + BATCH_INCREMENT, filteredProducts.length));
        }
      },
      {
        root: null,
        rootMargin: '400px', // Pre-fetch 400px before reaching bottom
        threshold: 0.1,
      }
    );

    const target = sentinelRef.current;
    if (target) {
      observer.observe(target);
    }

    return () => {
      if (target) observer.unobserve(target);
    };
  }, [hasMoreProducts, filteredProducts.length]);

  const handleLoadAllProducts = () => {
    setVisibleLimit(filteredProducts.length);
  };

  const handleLoadMoreBatch = () => {
    setVisibleLimit((prev) => Math.min(prev + BATCH_INCREMENT, filteredProducts.length));
  };

  const handleProceedOrder = async (customerInfo: OrderCustomerInfo) => {
    const randomOrderNum = Math.floor(1000 + Math.random() * 9000);
    const orderNumStr = `AYM-${randomOrderNum}`;
    const itemsSnapshot = [...cartItems];
    const currentTotalPrice = totalPrice;
    const currentTotalItems = totalItemsCount;

    // 1. Direct Verification Link
    const verificationUrl = `${window.location.origin}${window.location.pathname}?pedido=${orderNumStr}`;

    // 2. Direct WhatsApp URL
    const cleanPhone = (branding.whatsappNumber || '3113986110').replace(/\D/g, '');
    const defaultPrefix = cleanPhone.startsWith('57') ? '' : '57';
    const finalWhatsAppNumber = `${defaultPrefix}${cleanPhone}`;

    const directWhatsAppUrl = getWhatsAppDirectUrl(
      finalWhatsAppNumber,
      orderNumStr,
      itemsSnapshot,
      customerInfo,
      currentTotalPrice,
      verificationUrl
    );

    // 3. Immediately launch WhatsApp
    try {
      window.open(directWhatsAppUrl, '_blank');
    } catch (e) {
      console.warn('Auto-popup notice:', e);
    }

    // 4. Update local stock immediately (optimistic UI update)
    setProducts((prev) =>
      prev.map((p) => {
        const orderedItem = itemsSnapshot.find((it) => it.product.id === p.id);
        if (orderedItem) {
          const currentStock = typeof p.stock === 'number' ? p.stock : 100;
          const newStock = Math.max(0, currentStock - orderedItem.quantity);
          return { ...p, stock: newStock };
        }
        return p;
      })
    );

    // 5. Save order into Local Database & Decrement Local Stock
    try {
      await createOrderLocal({
        orderNumber: orderNumStr,
        items: itemsSnapshot,
        customer: customerInfo,
        totalPrice: currentTotalPrice,
        totalItemsCount: currentTotalItems,
      });
      await decrementProductsStockLocal(itemsSnapshot);
    } catch (e) {
      console.error('Error saving order/stock locally:', e);
    }

    // 6. Open Official Receipt Modal and clear cart
    setOrderCompleted({
      orderNumber: orderNumStr,
      items: itemsSnapshot,
      customer: customerInfo,
    });
    setIsCartOpen(false);
    setCartItems([]);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans text-slate-900 antialiased pb-24 relative">
      {/* 1. WhatsApp Webview top simulation bar */}
      <WhatsAppBar
        totalItemsCount={totalItemsCount}
        onOpenCart={() => setIsCartOpen(true)}
        onResetOrder={handleClearCart}
        onOpenAdmin={() => setIsAdminOpen(true)}
        whatsappNumber={branding.whatsappNumber}
      />

      {/* 2. Top Header with Logo / Title, Search toggle, Customer & Admin */}
      <TopHeader
        totalItemsCount={totalItemsCount}
        onOpenCart={() => setIsCartOpen(true)}
        onToggleSearch={handleToggleSearch}
        isSearchOpen={isSearchOpen}
        onResetView={handleResetView}
        onOpenAdmin={() => setIsAdminOpen(true)}
        branding={branding}
        activeCustomer={activeCustomer}
        onOpenCustomerModal={() => setIsCustomerModalOpen(true)}
        onClearCustomer={() => {
          setActiveCustomer(null);
          try {
            localStorage.removeItem(CUSTOMER_STORAGE_KEY);
          } catch (e) {}
        }}
      />

      {/* 3. Search and Category filter chips */}
      <SearchFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        categories={categories}
        isSearchOpen={isSearchOpen}
        onCloseSearch={() => setIsSearchOpen(false)}
        sortBy={sortBy}
        onSortChange={setSortBy}
        onlyPromos={onlyPromos}
        onToggleOnlyPromos={() => setOnlyPromos((prev) => !prev)}
        totalResults={filteredProducts.length}
      />

      {/* Main Content Area */}
      <main className="max-w-4xl mx-auto w-full px-4 pt-4 pb-8 flex-1">
        {/* Section Heading & Controls (View Mode, Admin, etc.) */}
        <div className="flex items-start sm:items-center justify-between mb-4 gap-2.5">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
              <span className="truncate">{selectedCategory === 'Todas' ? 'Catálogo de Productos' : selectedCategory}</span>
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
            </h1>
            
            {/* Subtitle & Badges - Locked in a fixed, stable row on mobile that never shifts or jumps */}
            <div className="mt-1 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-xs text-gray-500">
              <span className="truncate text-gray-600">
                Precios preferenciales para tiendas ({products.length.toLocaleString('es-CO')} productos)
              </span>
              <div className="flex items-center gap-1.5 flex-nowrap flex-shrink-0">
                <span className="hidden sm:inline text-gray-300">•</span>
                <button
                  onClick={() => {
                    setAdminInitialTab('local_database');
                    setIsAdminOpen(true);
                  }}
                  className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-2.5 py-0.5 rounded-full border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors cursor-pointer whitespace-nowrap flex-shrink-0"
                  title="Base de datos local activa. Clic para gestionar o exportar copia de seguridad."
                >
                  <Database className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                  <span>Base Local Activa</span>
                </button>
                {products.length >= 1000 && (
                  <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 whitespace-nowrap flex-shrink-0">
                    <Zap className="w-3 h-3 text-amber-600 flex-shrink-0" />
                    <span>Modo Rápido</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* View Mode Switcher: Grid vs Horizontal Slider */}
            <div className="flex items-center bg-gray-100/90 p-0.5 rounded-xl border border-gray-200 shadow-2xs">
              <button
                id="btn-view-grid"
                onClick={() => handleToggleViewMode('grid')}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-gray-500 hover:text-slate-800'
                }`}
                title="Vista Cuadrícula"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Cuadrícula</span>
              </button>

              <button
                id="btn-view-slider"
                onClick={() => handleToggleViewMode('slider')}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'slider'
                    ? 'bg-[#0B4EA2] text-white shadow-xs'
                    : 'text-gray-500 hover:text-slate-800'
                }`}
                title="Vista Barra Deslizable (Izquierda y Derecha)"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Deslizable</span>
              </button>
            </div>

            <button
              onClick={() => {
                setProductToEdit(null);
                setIsAdminOpen(true);
              }}
              className="flex items-center gap-1.5 text-xs font-bold text-[#0B4EA2] bg-blue-50 hover:bg-blue-100 active:scale-95 px-3 py-1.5 rounded-xl border border-blue-200 shadow-2xs transition-all cursor-pointer"
              title="Abrir panel de administración"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Panel Admin</span>
            </button>

            <div className="hidden lg:flex items-center gap-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
              <Tag className="w-3.5 h-3.5 text-emerald-600" />
              <span>Descuentos mayoristas</span>
            </div>
          </div>
        </div>

        {/* 1. Featured / Promotions Horizontal Slider Bar (shown on general view when not searching) */}
        {!searchQuery && selectedCategory === 'Todas' && !onlyPromos && featuredPromoProducts.length > 0 && viewMode === 'grid' && (
          <ProductSliderBar
            title="⚡ Promociones y Ofertas Destacadas"
            subtitle="Desliza con las flechas o con el dedo hacia la derecha e izquierda"
            badge="Super Descuentos"
            products={featuredPromoProducts}
            quantityMap={quantityMap}
            onUpdateQuantity={handleUpdateQuantity}
            onSetQuantity={handleSetQuantity}
            onOpenDetails={handleOpenDetails}
            onEditProduct={handleEditProduct}
            onViewAll={() => setOnlyPromos(true)}
          />
        )}

        {/* 2. Products List (Grid or Horizontal Slider Bar) */}
        {filteredProducts.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center border border-gray-200 my-6 shadow-xs">
            <AlertCircle className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">No se encontraron productos</h3>
            <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
              No hay artículos que coincidan con los filtros seleccionados. Intenta con otra búsqueda o categoría.
            </p>
            <div className="flex items-center justify-center gap-2 mt-4">
              <button
                onClick={handleResetView}
                className="px-4 py-2 bg-slate-900 hover:bg-black text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Ver todas las promociones
              </button>
              <button
                onClick={() => {
                  setProductToEdit(null);
                  setIsAdminOpen(true);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Agregar Producto
              </button>
            </div>
          </div>
        ) : viewMode === 'slider' ? (
          /* Full Horizontal Slider Bar Mode */
          <div className="space-y-4">
            <ProductSliderBar
              title={selectedCategory === 'Todas' ? 'Todos los Productos' : selectedCategory}
              subtitle="Navega arrastrando horizontalmente o haciendo clic en las flechas laterales"
              products={filteredProducts}
              quantityMap={quantityMap}
              onUpdateQuantity={handleUpdateQuantity}
              onSetQuantity={handleSetQuantity}
              onOpenDetails={handleOpenDetails}
              onEditProduct={handleEditProduct}
            />

            {/* Quick helper note */}
            <div className="flex items-center justify-between bg-blue-50/70 border border-blue-200/80 rounded-xl p-3 text-xs text-blue-800">
              <span>💡 ¿Prefieres ver los productos en cuadrícula?</span>
              <button
                onClick={() => handleToggleViewMode('grid')}
                className="font-bold underline hover:text-blue-950 cursor-pointer"
              >
                Cambiar a cuadrícula
              </button>
            </div>
          </div>
        ) : (
          /* Standard Responsive Grid Mode */
          <>
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {visibleProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  quantity={quantityMap.get(product.id) || 0}
                  onUpdateQuantity={handleUpdateQuantity}
                  onSetQuantity={handleSetQuantity}
                  onOpenDetails={handleOpenDetails}
                  onEditProduct={handleEditProduct}
                />
              ))}
            </div>

            {/* Progressive Loading & Status Bar */}
            {filteredProducts.length > INITIAL_BATCH_SIZE && (
              <div className="mt-8 pt-4 pb-2 text-center border-t border-slate-200">
                <div className="inline-flex items-center gap-2 text-xs text-slate-600 bg-white px-4 py-2 rounded-full border border-slate-200 shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                  <span>
                    Mostrando <strong className="text-slate-900">{visibleProducts.length.toLocaleString('es-CO')}</strong> de{' '}
                    <strong className="text-slate-900">{filteredProducts.length.toLocaleString('es-CO')}</strong> productos
                  </span>
                </div>

                {hasMoreProducts && (
                  <div className="mt-3 flex items-center justify-center gap-2">
                    <button
                      onClick={handleLoadMoreBatch}
                      className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold rounded-xl border border-slate-300 shadow-xs transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
                    >
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                      <span>Cargar {Math.min(BATCH_INCREMENT, filteredProducts.length - visibleLimit)} más</span>
                    </button>
                    <button
                      onClick={handleLoadAllProducts}
                      className="px-4 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
                    >
                      Cargar todos ({filteredProducts.length.toLocaleString('es-CO')})
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Infinite Scroll Sentinel for automatic loading */}
            {hasMoreProducts && <div ref={sentinelRef} className="h-12 w-full pointer-events-none" />}
          </>
        )}
      </main>

      {/* 4. Bottom Sticky Cart Bar */}
      {totalItemsCount > 0 && (
        <BottomStickyCartBar
          totalItems={totalItemsCount}
          totalPrice={totalPrice}
          originalTotalPrice={originalTotalPrice}
          onOpenCart={() => setIsCartOpen(true)}
        />
      )}

      {/* 5. Cart Drawer with WhatsApp checkout */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartItems={cartItems}
        onUpdateQuantity={handleUpdateQuantity}
        onSetQuantity={handleSetQuantity}
        onRemoveItem={handleRemoveItem}
        onClearCart={handleClearCart}
        onProceedOrder={handleProceedOrder}
        activeCustomer={activeCustomer}
        onOpenCustomerModal={() => setIsCustomerModalOpen(true)}
        onCustomerIdentified={(cust) => {
          setActiveCustomer(cust);
          try {
            if (cust) {
              localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(cust));
            } else {
              localStorage.removeItem(CUSTOMER_STORAGE_KEY);
            }
          } catch (e) {}
        }}
      />

      {/* 6. Customer Identification Modal */}
      <CustomerIdentificationModal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        currentCustomer={activeCustomer}
        onCustomerIdentified={(cust) => {
          setActiveCustomer(cust);
          try {
            if (cust) {
              localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(cust));
            } else {
              localStorage.removeItem(CUSTOMER_STORAGE_KEY);
            }
          } catch (e) {}
        }}
      />

      {/* 6. Product Details Inspection Modal */}
      <ProductDetailModal
        product={selectedProductDetails}
        quantity={selectedProductDetails ? quantityMap.get(selectedProductDetails.id) || 0 : 0}
        onClose={handleCloseDetails}
        onUpdateQuantity={handleUpdateQuantity}
        onSetQuantity={handleSetQuantity}
        onAddToCart={(prodId, qty) => handleSetQuantity(prodId, qty)}
        onEditProduct={handleEditProduct}
      />

      {/* 7. Order Confirmation & WhatsApp Ticket Modal */}
      {orderCompleted && (
        <OrderSuccessModal
          isOpen={true}
          onClose={() => setOrderCompleted(null)}
          orderNumber={orderCompleted.orderNumber}
          cartItems={orderCompleted.items}
          customerInfo={orderCompleted.customer}
          targetPhone={branding.whatsappNumber || '3113986110'}
        />
      )}

      {/* 8. Visual Admin Panel Modal */}
      <AdminPanelModal
        isOpen={isAdminOpen}
        onClose={handleCloseAdmin}
        products={products}
        onSaveProduct={handleSaveProduct}
        onDeleteProduct={handleDeleteProduct}
        onResetToDefaults={handleResetToDefaults}
        onImportProducts={handleImportProducts}
        categories={categories}
        onSaveCategories={handleSaveCategories}
        onRenameCategory={handleRenameCategory}
        branding={branding}
        onSaveBranding={handleSaveBranding}
        initialEditProduct={productToEdit}
        onClearInitialEditProduct={() => setProductToEdit(null)}
        initialTab={adminInitialTab}
        dataMode={dataMode}
        onToggleDataMode={handleToggleDataMode}
      />
    </div>
  );
}
