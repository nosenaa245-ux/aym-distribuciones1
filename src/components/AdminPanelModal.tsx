import React, { useState, useEffect, useRef, useMemo, useDeferredValue } from 'react';
import {
  X,
  Plus,
  Edit2,
  Trash2,
  Copy,
  RotateCcw,
  Save,
  Search,
  Upload,
  Link as LinkIcon,
  CheckCircle2,
  Download,
  FileJson,
  Sparkles,
  Sliders,
  Eye,
  EyeOff,
  AlertTriangle,
  Lock,
  User,
  KeyRound,
  LogOut,
  ShieldCheck,
  Tag,
  ImageIcon,
  ArrowUp,
  ArrowDown,
  Layers,
  HelpCircle,
  Clock,
  FileSpreadsheet,
  FileUp,
  FileDown,
  Table,
  Check,
  Cloud,
  ShoppingBag,
  DollarSign,
  Users,
  Barcode,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowLeft,
  ArrowRight,
  SlidersHorizontal,
  MoveHorizontal,
  Loader2,
  ImagePlus,
  Images,
  ImageDown,
  Database,
  HardDrive,
} from 'lucide-react';
import { Product, StoreBranding, AdminUser, AdminRole } from '../types';
import { DEFAULT_BASE_CATEGORIES, DEFAULT_BRANDING } from '../data/products';
import { ProductVisual } from './ProductVisual';
import { OrdersAdminTab } from './OrdersAdminTab';
import { CustomersAdminTab } from './CustomersAdminTab';
import { UnsoldProductsAdminTab } from './UnsoldProductsAdminTab';
import { AdminsAdminTab } from './AdminsAdminTab';
import { LocalDatabaseAdminTab } from './LocalDatabaseAdminTab';
import { parseFlexiblePrice, formatCOP, formatInputPrice } from '../utils/priceUtils';
import { compressAndResizeImage, normalizeImageUrl, formatBytes, getBase64Size } from '../utils/imageUtils';
import {
  exportProductImagesToZip,
  ImageExportProgress,
  ImageExportResult,
} from '../utils/imageExportUtils';
import {
  clearAllProductsInCloud,
  subscribeToAdmins,
  saveAdminToCloud,
  deleteAdminFromCloud,
  updateAdminLastLogin,
  DEFAULT_ADMINS,
  saveProductsBatchLocal,
  getLocalProductsAsync,
} from '../lib/localDatabase';
import {
  exportProductsToExcel,
  downloadExcelTemplate,
  parseProductsFromExcel,
  ExcelImportResult,
} from '../utils/excelUtils';

interface AdminPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onSaveProduct: (product: Product) => void | Promise<void>;
  onDeleteProduct: (productId: string) => void;
  onResetToDefaults: () => void;
  onImportProducts: (
    products: Product[],
    mode?: 'merge' | 'replace',
    onProgress?: (processed: number, total: number, message: string) => void
  ) => Promise<void> | void;
  categories: string[];
  onSaveCategories: (categories: string[]) => void;
  onRenameCategory: (oldCategory: string, newCategory: string) => void;
  branding: StoreBranding;
  onSaveBranding: (branding: StoreBranding) => void;
  initialEditProduct?: Product | null;
  onClearInitialEditProduct?: () => void;
  initialTab?:
    | 'list'
    | 'editor'
    | 'categories'
    | 'customers'
    | 'orders'
    | 'excel'
    | 'unsold_report'
    | 'branding'
    | 'admins'
    | 'local_database';
  dataMode?: 'cloud' | 'local';
  onToggleDataMode?: (mode: 'cloud' | 'local') => void;
}

const PRESET_IMAGE_OPTIONS = [
  { id: 'bilac', label: 'Leche Bilac Chocolate' },
  { id: 'tostao-intenso', label: 'Café Tostao Intenso' },
  { id: 'tostao-suave', label: 'Café Tostao Tradicional' },
  { id: 'speedmax', label: 'Speed Max Energizante' },
  { id: 'festival', label: 'Galletas Festival' },
  { id: 'aceite-premier', label: 'Aceite Premier 1000ml' },
  { id: 'arroz-diana', label: 'Arroz Diana Premium' },
  { id: 'atun-vancamps', label: 'Atún Van Camps' },
  { id: 'jet', label: 'Chocolatina Jet Caja x50' },
  { id: 'fab-detergente', label: 'Detergente Fab Líquido' },
  { id: 'cocacola', label: 'Coca Cola 400ml' },
  { id: 'alqueria', label: 'Leche Alquería Entera' },
];

const ADMIN_CREDS_KEY = 'glux_admin_credentials';
const ADMIN_SESSION_KEY = 'glux_admin_session_auth';
const ADMIN_LAST_ACTIVITY_KEY = 'glux_admin_last_activity_ts';
const INACTIVITY_LIMIT_SECONDS = 10 * 60; // 10 minutes (600 seconds)
const INACTIVITY_TIMEOUT_MS = INACTIVITY_LIMIT_SECONDS * 1000;

export const AdminPanelModal: React.FC<AdminPanelModalProps> = ({
  isOpen,
  onClose,
  products,
  onSaveProduct,
  onDeleteProduct,
  onResetToDefaults,
  onImportProducts,
  categories,
  onSaveCategories,
  onRenameCategory,
  branding,
  onSaveBranding,
  initialEditProduct,
  onClearInitialEditProduct,
  initialTab,
  dataMode = 'cloud',
  onToggleDataMode,
}) => {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      const isAuth = localStorage.getItem(ADMIN_SESSION_KEY) === 'true';
      if (!isAuth) return false;

      // Check if previous session is already expired
      const lastActivity = localStorage.getItem(ADMIN_LAST_ACTIVITY_KEY);
      if (lastActivity) {
        const elapsed = Date.now() - parseInt(lastActivity, 10);
        if (elapsed >= INACTIVITY_TIMEOUT_MS) {
          localStorage.removeItem(ADMIN_SESSION_KEY);
          localStorage.removeItem(ADMIN_LAST_ACTIVITY_KEY);
          return false;
        }
      }
      return true;
    } catch {
      return false;
    }
  });

  const [inputUsername, setInputUsername] = useState('');
  const [inputPassword, setInputPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberSession, setRememberSession] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [inactivityNotice, setInactivityNotice] = useState<string | null>(null);

  // Inactivity countdown timer
  const [inactivitySecondsLeft, setInactivitySecondsLeft] = useState<number>(INACTIVITY_LIMIT_SECONDS);
  const lastActivityRef = useRef<number>(Date.now());

  // Security Credentials & Multi-Admin State
  const [admins, setAdmins] = useState<AdminUser[]>(() => {
    try {
      const saved = localStorage.getItem('glux_admins_list');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      const oldCreds = localStorage.getItem(ADMIN_CREDS_KEY);
      if (oldCreds) {
        const parsed = JSON.parse(oldCreds);
        return [
          {
            id: 'admin-master',
            username: (parsed.user || 'admin').toLowerCase().trim(),
            name: 'Administrador Principal',
            password: parsed.pass || 'admin123',
            role: 'superadmin',
            status: 'active',
            createdAt: new Date().toISOString(),
          },
        ];
      }
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_ADMINS;
  });

  const [currentAdmin, setCurrentAdmin] = useState<AdminUser | null>(() => {
    try {
      const saved = localStorage.getItem('glux_current_admin_user');
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  });

  const [adminCredentials, setAdminCredentials] = useState<{ user: string; pass: string }>(() => {
    try {
      const saved = localStorage.getItem(ADMIN_CREDS_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error(e);
    }
    return { user: 'admin', pass: 'admin123' };
  });

  // Subscribe to Local Database Admins
  useEffect(() => {
    const unsubscribe = subscribeToAdmins(
      (localAdmins) => {
        if (localAdmins && localAdmins.length > 0) {
          setAdmins(localAdmins);
          try {
            localStorage.setItem('glux_admins_list', JSON.stringify(localAdmins));
          } catch {}
          setCurrentAdmin((prev) => {
            if (!prev) return null;
            const refreshed = localAdmins.find(
              (a) => a.id === prev.id || a.username.toLowerCase() === prev.username.toLowerCase()
            );
            return refreshed || prev;
          });
        }
      },
      (err) => {
        console.warn('[AdminPanel] Local database admins sync fallback:', err);
      }
    );
    return () => unsubscribe();
  }, []);

  // Settings tab for changing credentials
  const [showChangeCredsModal, setShowChangeCredsModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [credsSuccessNotice, setCredsSuccessNotice] = useState<string | null>(null);
  const [credsErrorNotice, setCredsErrorNotice] = useState<string | null>(null);

  // Tab State
  const [activeTab, setActiveTab] = useState<
    'list' | 'editor' | 'categories' | 'customers' | 'orders' | 'excel' | 'unsold_report' | 'branding' | 'admins' | 'local_database'
  >(() => initialTab || 'list');

  // Synchronize activeTab if initialTab changes while modal is opened
  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);
  const [searchAdminQuery, setSearchAdminQuery] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState<string | null>(null);

  // Admin Search filter & Pagination hooks (Must be called unconditionally at top)
  const deferredAdminQuery = useDeferredValue(searchAdminQuery);
  const [adminPage, setAdminPage] = useState(1);
  const [adminPageSize, setAdminPageSize] = useState(50);

  const adminFilteredProducts = useMemo(() => {
    if (!deferredAdminQuery.trim()) return products;
    const q = deferredAdminQuery.toLowerCase();
    return products.filter((p) => {
      return (
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.barcode?.toLowerCase().includes(q) ||
        p.promoBadge?.toLowerCase().includes(q)
      );
    });
  }, [products, deferredAdminQuery]);

  // Reset page to 1 whenever search query changes
  useEffect(() => {
    setAdminPage(1);
  }, [deferredAdminQuery]);

  const totalAdminPages = Math.max(1, Math.ceil(adminFilteredProducts.length / adminPageSize));
  const currentAdminPageClamped = Math.min(adminPage, totalAdminPages);

  const paginatedAdminProducts = useMemo(() => {
    const start = (currentAdminPageClamped - 1) * adminPageSize;
    return adminFilteredProducts.slice(start, start + adminPageSize);
  }, [adminFilteredProducts, currentAdminPageClamped, adminPageSize]);

  // Horizontal Table Scrolling State for Products Table (Columns: Descripción, Categoría, Promoción, Costo, Venta, etc.)
  const productsTableRef = useRef<HTMLDivElement | null>(null);
  const [canScrollTableLeft, setCanScrollTableLeft] = useState(false);
  const [canScrollTableRight, setCanScrollTableRight] = useState(true);
  const [tableScrollProgress, setTableScrollProgress] = useState(0);

  // Table Mouse Drag Scrolling State
  const [isTableDragging, setIsTableDragging] = useState(false);
  const [tableStartX, setTableStartX] = useState(0);
  const [tableScrollLeftVal, setTableScrollLeftVal] = useState(0);

  const checkTableScroll = () => {
    const el = productsTableRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollTableLeft(scrollLeft > 5);
    setCanScrollTableRight(scrollLeft < scrollWidth - clientWidth - 5);
    const maxScroll = scrollWidth - clientWidth;
    if (maxScroll > 0) {
      setTableScrollProgress(Math.min(100, Math.max(0, (scrollLeft / maxScroll) * 100)));
    } else {
      setTableScrollProgress(0);
    }
  };

  useEffect(() => {
    const el = productsTableRef.current;
    if (!el) return;
    checkTableScroll();
    el.addEventListener('scroll', checkTableScroll, { passive: true });
    window.addEventListener('resize', checkTableScroll);
    return () => {
      el.removeEventListener('scroll', checkTableScroll);
      window.removeEventListener('resize', checkTableScroll);
    };
  }, [activeTab, paginatedAdminProducts]);

  const slideTable = (direction: 'left' | 'right', step = 350) => {
    const el = productsTableRef.current;
    if (!el) return;
    const currentLeft = el.scrollLeft;
    const targetLeft =
      direction === 'left'
        ? Math.max(0, currentLeft - step)
        : Math.min(el.scrollWidth - el.clientWidth, currentLeft + step);
    el.scrollTo({
      left: targetLeft,
      behavior: 'smooth',
    });
    setTimeout(checkTableScroll, 100);
  };

  const scrollToColumnRatio = (ratio: number, smooth = true) => {
    const el = productsTableRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    const targetLeft = Math.max(0, Math.min(maxScroll, maxScroll * ratio));
    if (smooth) {
      el.scrollTo({
        left: targetLeft,
        behavior: 'smooth',
      });
    } else {
      el.scrollLeft = targetLeft;
    }
    setTimeout(checkTableScroll, 50);
  };

  const handleTableRangeSliderChange = (percent: number) => {
    setTableScrollProgress(percent);
    const el = productsTableRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    if (maxScroll > 0) {
      el.scrollLeft = (percent / 100) * maxScroll;
    }
  };

  const handleTableMouseDown = (e: React.MouseEvent) => {
    const el = productsTableRef.current;
    if (!el) return;
    setIsTableDragging(true);
    setTableStartX(e.pageX - el.offsetLeft);
    setTableScrollLeftVal(el.scrollLeft);
  };

  const handleTableMouseLeaveOrUp = () => {
    setIsTableDragging(false);
  };

  const handleTableMouseMove = (e: React.MouseEvent) => {
    if (!isTableDragging) return;
    const el = productsTableRef.current;
    if (!el) return;
    e.preventDefault();
    const x = e.pageX - el.offsetLeft;
    const walk = (x - tableStartX) * 1.5;
    el.scrollLeft = tableScrollLeftVal - walk;
  };

  // Excel Import / Export & Image Protection State
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isImportingExcel, setIsImportingExcel] = useState(false);
  const [excelImportResult, setExcelImportResult] = useState<ExcelImportResult | null>(null);
  const [excelImportFile, setExcelImportFile] = useState<File | null>(null);
  const [excelImportMode, setExcelImportMode] = useState<'merge' | 'replace'>('merge');
  const [preserveExistingImages, setPreserveExistingImages] = useState(true);
  const [showExcelImportModal, setShowExcelImportModal] = useState(false);
  const [excelDragOver, setExcelDragOver] = useState(false);
  const [isImportingProducts, setIsImportingProducts] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    processed: number;
    total: number;
    percent: number;
    message: string;
  } | null>(null);

  // Images Export State
  const [isExportingImages, setIsExportingImages] = useState(false);
  const [imageExportProgress, setImageExportProgress] = useState<ImageExportProgress | null>(null);
  const [showImageExportModal, setShowImageExportModal] = useState(false);
  const [imageExportResult, setImageExportResult] = useState<ImageExportResult | null>(null);

  // Form State for editing or creating product
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Product>({
    id: '',
    name: '',
    category: categories[0] || 'Lácteos',
    promoBadge: '20.00% de descuento',
    badgeType: 'discount',
    packaging: 'Caja x 12',
    costPrice: 1900,
    price: 2500,
    originalPrice: 3200,
    imageUrl: 'bilac',
    description: '',
    sku: '',
    barcode: '',
    stock: 100,
    featured: true,
  });

  // Flexible price string input states to support both dot and comma separators seamlessly
  const [costPriceInput, setCostPriceInput] = useState<string>('1500');
  const [priceInput, setPriceInput] = useState<string>('2000');
  const [originalPriceInput, setOriginalPriceInput] = useState<string>('2500');

  const [imageInputMode, setImageInputMode] = useState<'preset' | 'url' | 'upload'>('preset');
  const [customUrlInput, setCustomUrlInput] = useState('');
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [imageOptimizationInfo, setImageOptimizationInfo] = useState<{
    originalSize: string;
    compressedSize: string;
  } | null>(null);
  const [imageErrorNotice, setImageErrorNotice] = useState<string | null>(null);
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [saveErrorNotice, setSaveErrorNotice] = useState<string | null>(null);
  const [isDragOverImage, setIsDragOverImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Category Management State
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [editingCategoryIndex, setEditingCategoryIndex] = useState<number | null>(null);
  const [editCategoryName, setEditCategoryName] = useState('');
  const [categoryError, setCategoryError] = useState<string | null>(null);

  // Branding Management State
  const [brandForm, setBrandForm] = useState<StoreBranding>(branding);
  const [logoInputMode, setLogoInputMode] = useState<'upload' | 'url'>('upload');
  const [logoUrlInput, setLogoUrlInput] = useState(branding.logoUrl || '');

  useEffect(() => {
    setBrandForm(branding);
    setLogoUrlInput(branding.logoUrl || '');
  }, [branding]);

  const handleStartEdit = (prod: Product) => {
    setEditingId(prod.id);
    const safeProduct: Product = {
      ...prod,
      imageUrl: prod.imageUrl || 'bilac',
    };
    setFormData(safeProduct);
    setImageErrorNotice(null);
    setSaveErrorNotice(null);

    setCostPriceInput(prod.costPrice !== undefined && prod.costPrice !== null ? String(prod.costPrice) : '');
    setPriceInput(prod.price !== undefined && prod.price !== null ? String(prod.price) : '');
    setOriginalPriceInput(prod.originalPrice !== undefined && prod.originalPrice !== null ? String(prod.originalPrice) : '');

    const currentImg = prod.imageUrl || '';
    const isPreset = PRESET_IMAGE_OPTIONS.some((opt) => opt.id === currentImg);
    if (isPreset) {
      setImageInputMode('preset');
      setCustomUrlInput('');
      setImageOptimizationInfo(null);
    } else if (currentImg && currentImg.startsWith('data:image')) {
      setImageInputMode('upload');
      setCustomUrlInput('');
      const approxBytes = getBase64Size(currentImg);
      if (approxBytes > 0) {
        setImageOptimizationInfo({
          originalSize: formatBytes(approxBytes),
          compressedSize: formatBytes(approxBytes),
        });
      } else {
        setImageOptimizationInfo(null);
      }
    } else if (currentImg) {
      setImageInputMode('url');
      setCustomUrlInput(currentImg);
      setImageOptimizationInfo(null);
    } else {
      setImageInputMode('preset');
      setCustomUrlInput('');
      setImageOptimizationInfo(null);
    }

    setActiveTab('editor');
  };

  // Pending direct edit product when user needs to authenticate first
  const [pendingEditProduct, setPendingEditProduct] = useState<Product | null>(null);

  // Directly enter product modification mode if initialEditProduct was supplied
  useEffect(() => {
    if (isOpen && initialEditProduct) {
      if (isAuthenticated) {
        handleStartEdit(initialEditProduct);
      } else {
        setPendingEditProduct(initialEditProduct);
      }
    }
  }, [isOpen, initialEditProduct?.id, isAuthenticated]);

  // If user was not authenticated yet, enter edit mode immediately upon login
  useEffect(() => {
    if (isAuthenticated && pendingEditProduct) {
      handleStartEdit(pendingEditProduct);
      setPendingEditProduct(null);
    }
  }, [isAuthenticated, pendingEditProduct]);

  // Guard against browser closing, tab refresh, or accidental navigation during bulk uploads
  useEffect(() => {
    if (!isImportingProducts) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'Hay una importación masiva de productos en proceso. Si cierras la ventana, la carga se interrumpirá.';
      return e.returnValue;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isImportingProducts]);

  // Inactivity auto-logout timer and activity event listeners
  const resetInactivityTimer = () => {
    const now = Date.now();
    lastActivityRef.current = now;
    try {
      localStorage.setItem(ADMIN_LAST_ACTIVITY_KEY, String(now));
    } catch {}
    setInactivitySecondsLeft(INACTIVITY_LIMIT_SECONDS);
  };

  const handleLogout = (isAutoDueToInactivity = false) => {
    setIsAuthenticated(false);
    setInputPassword('');
    try {
      localStorage.removeItem(ADMIN_SESSION_KEY);
      localStorage.removeItem(ADMIN_LAST_ACTIVITY_KEY);
    } catch (e) {
      console.error(e);
    }
    if (isAutoDueToInactivity) {
      setInactivityNotice(
        'Tu sesión se cerró automáticamente tras 10 minutos de inactividad por motivos de seguridad.'
      );
    } else {
      setInactivityNotice(null);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;

    // Check if session has already expired based on timestamp
    const now = Date.now();
    const storedLast = localStorage.getItem(ADMIN_LAST_ACTIVITY_KEY);
    const parsedLast = storedLast ? parseInt(storedLast, 10) : now;

    if (now - parsedLast >= INACTIVITY_TIMEOUT_MS) {
      handleLogout(true);
      return;
    }

    lastActivityRef.current = parsedLast;

    const interval = setInterval(() => {
      const currentTime = Date.now();
      const elapsed = currentTime - lastActivityRef.current;
      const remainingMs = Math.max(0, INACTIVITY_TIMEOUT_MS - elapsed);
      const remainingSec = Math.ceil(remainingMs / 1000);

      setInactivitySecondsLeft(remainingSec);

      if (remainingMs <= 0) {
        handleLogout(true);
      }
    }, 1000);

    // Track user activity across window
    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    let throttleTimeout: NodeJS.Timeout | null = null;

    const handleUserActivity = () => {
      if (!throttleTimeout) {
        throttleTimeout = setTimeout(() => {
          throttleTimeout = null;
          const current = Date.now();
          lastActivityRef.current = current;
          try {
            localStorage.setItem(ADMIN_LAST_ACTIVITY_KEY, String(current));
          } catch {}
        }, 1000);
      }
    };

    activityEvents.forEach((event) => {
      window.addEventListener(event, handleUserActivity, { passive: true });
    });

    return () => {
      clearInterval(interval);
      if (throttleTimeout) clearTimeout(throttleTimeout);
      activityEvents.forEach((event) => {
        window.removeEventListener(event, handleUserActivity);
      });
    };
  }, [isAuthenticated]);

  const formatRemainingTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  if (!isOpen) return null;

  // Handle Login Authentication for Multiple Admins
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setInactivityNotice(null);

    const cleanUser = inputUsername.trim().toLowerCase();
    const cleanPass = inputPassword.trim();

    // 1. Search in multi-admins array
    const matchedAdmin = admins.find(
      (a) => a.username.toLowerCase() === cleanUser
    );

    if (matchedAdmin) {
      if (matchedAdmin.password !== cleanPass) {
        setAuthError('Contraseña incorrecta para el usuario ingresado.');
        return;
      }
      if (matchedAdmin.status === 'inactive') {
        setAuthError('Esta cuenta de administrador se encuentra desactivada. Contacta al administrador principal.');
        return;
      }

      // Success
      setIsAuthenticated(true);
      setCurrentAdmin(matchedAdmin);
      updateAdminLastLogin(matchedAdmin.id);

      const now = Date.now();
      lastActivityRef.current = now;
      setInactivitySecondsLeft(INACTIVITY_LIMIT_SECONDS);
      try {
        localStorage.setItem('glux_current_admin_user', JSON.stringify(matchedAdmin));
        if (rememberSession) {
          localStorage.setItem(ADMIN_SESSION_KEY, 'true');
        }
        localStorage.setItem(ADMIN_LAST_ACTIVITY_KEY, String(now));
      } catch (e) {
        console.error(e);
      }
      return;
    }

    // 2. Fallback legacy check for stored single adminCredentials
    const isUserValid = cleanUser === adminCredentials.user.trim().toLowerCase();
    const isPassValid = cleanPass === adminCredentials.pass;

    if (isUserValid && isPassValid) {
      const fallbackSuperAdmin: AdminUser = {
        id: 'admin-master',
        username: cleanUser,
        name: 'Administrador Principal',
        password: cleanPass,
        role: 'superadmin',
        status: 'active',
        createdAt: new Date().toISOString(),
      };

      setIsAuthenticated(true);
      setCurrentAdmin(fallbackSuperAdmin);
      saveAdminToCloud(fallbackSuperAdmin);

      const now = Date.now();
      lastActivityRef.current = now;
      setInactivitySecondsLeft(INACTIVITY_LIMIT_SECONDS);
      try {
        localStorage.setItem('glux_current_admin_user', JSON.stringify(fallbackSuperAdmin));
        if (rememberSession) {
          localStorage.setItem(ADMIN_SESSION_KEY, 'true');
        }
        localStorage.setItem(ADMIN_LAST_ACTIVITY_KEY, String(now));
      } catch (e) {
        console.error(e);
      }
    } else {
      setAuthError('Usuario o contraseña incorrectos. Verifica las credenciales ingresadas.');
    }
  };

  const handleSaveAdmin = async (admin: AdminUser): Promise<void> => {
    try {
      await saveAdminToCloud(admin);
      setAdmins((prev) => {
        const index = prev.findIndex((a) => a.id === admin.id || a.username === admin.username);
        let updated: AdminUser[];
        if (index >= 0) {
          updated = [...prev];
          updated[index] = admin;
        } else {
          updated = [...prev, admin];
        }
        try {
          localStorage.setItem('glux_admins_list', JSON.stringify(updated));
        } catch {}
        return updated;
      });

      if (currentAdmin && (currentAdmin.id === admin.id || currentAdmin.username === admin.username)) {
        setCurrentAdmin(admin);
        try {
          localStorage.setItem('glux_current_admin_user', JSON.stringify(admin));
        } catch {}
      }
    } catch (e: any) {
      console.error('Error saving admin:', e);
      throw new Error(e.message || 'Error al guardar administrador.');
    }
  };

  const handleDeleteAdmin = async (adminId: string): Promise<void> => {
    try {
      await deleteAdminFromCloud(adminId);
      setAdmins((prev) => {
        const updated = prev.filter((a) => a.id !== adminId);
        try {
          localStorage.setItem('glux_admins_list', JSON.stringify(updated));
        } catch {}
        return updated;
      });
    } catch (e: any) {
      console.error('Error deleting admin:', e);
      throw new Error(e.message || 'Error al eliminar administrador.');
    }
  };

  const handleChangeCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setCredsErrorNotice(null);
    setCredsSuccessNotice(null);

    const cleanUser = newUsername.trim().toLowerCase();

    if (!cleanUser) {
      setCredsErrorNotice('El nombre de usuario no puede estar vacío');
      return;
    }
    if (newPassword.length < 4) {
      setCredsErrorNotice('La contraseña debe tener al menos 4 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      setCredsErrorNotice('Las contraseñas no coinciden');
      return;
    }

    try {
      const targetAdmin: AdminUser = currentAdmin || {
        id: 'admin-master',
        username: cleanUser,
        name: 'Administrador Principal',
        password: newPassword,
        role: 'superadmin',
        status: 'active',
        createdAt: new Date().toISOString(),
      };

      const updatedAdmin: AdminUser = {
        ...targetAdmin,
        username: cleanUser,
        password: newPassword,
      };

      await handleSaveAdmin(updatedAdmin);

      const updatedCreds = {
        user: cleanUser,
        pass: newPassword,
      };
      setAdminCredentials(updatedCreds);
      localStorage.setItem(ADMIN_CREDS_KEY, JSON.stringify(updatedCreds));

      setCredsSuccessNotice('Credenciales de administrador actualizadas exitosamente');
      setTimeout(() => {
        setShowChangeCredsModal(false);
        setCredsSuccessNotice(null);
        setNewUsername('');
        setNewPassword('');
        setConfirmPassword('');
      }, 1200);
    } catch (e: any) {
      setCredsErrorNotice(e.message || 'Error al guardar credenciales');
    }
  };

  // Product Actions
  const handleStartCreate = () => {
    const newId = `prod-custom-${Date.now()}`;
    setEditingId(null);
    setFormData({
      id: newId,
      name: '',
      category: categories[0] || 'Lácteos',
      promoBadge: '15.00% de descuento',
      badgeType: 'discount',
      packaging: 'Unidad',
      costPrice: 1500,
      price: 2000,
      originalPrice: 2500,
      imageUrl: 'bilac',
      description: '',
      sku: `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
      barcode: '',
      stock: 50,
      featured: true,
    });
    setCostPriceInput('1500');
    setPriceInput('2000');
    setOriginalPriceInput('2500');
    setImageInputMode('preset');
    setCustomUrlInput('');
    setImageOptimizationInfo(null);
    setImageErrorNotice(null);
    setSaveErrorNotice(null);
    setActiveTab('editor');
  };

  const handleDuplicate = (prod: Product) => {
    const duplicatedProduct: Product = {
      ...prod,
      id: `prod-copy-${Date.now()}`,
      name: `${prod.name} (COPIA)`,
      sku: prod.sku ? `${prod.sku}-COPY` : undefined,
    };
    onSaveProduct(duplicatedProduct);
    setSaveSuccessNotice('¡Producto duplicado con éxito!');
    setTimeout(() => setSaveSuccessNotice(null), 3000);
  };

  const handleToggleProductPromo = (prod: Product) => {
    const isCurrentlyActive = prod.hasPromotion === true || (prod.hasPromotion !== false && Boolean(prod.promoBadge && prod.promoBadge.trim().length > 0));
    const nextActive = !isCurrentlyActive;
    const updated: Product = {
      ...prod,
      hasPromotion: nextActive,
      promoBadge: nextActive
        ? (prod.promoBadge?.trim() || '20.00% de descuento')
        : '',
    };
    onSaveProduct(updated);
    setSaveSuccessNotice(
      nextActive
        ? `🟢 Promoción ACTIVADA para "${prod.name}" (se mostrará la zona verde)`
        : `⚪ Promoción DESACTIVADA para "${prod.name}" (zona verde oculta)`
    );
    setTimeout(() => setSaveSuccessNotice(null), 3000);
  };

  const processAndSetImage = async (fileOrDataUrl: File | string) => {
    try {
      setIsProcessingImage(true);
      setImageErrorNotice(null);
      const result = await compressAndResizeImage(fileOrDataUrl, 750, 750, 0.82);
      setFormData((prev) => ({ ...prev, imageUrl: result.dataUrl }));
      setImageOptimizationInfo({
        originalSize: formatBytes(result.originalSize),
        compressedSize: formatBytes(result.compressedSize),
      });
      setImageInputMode('upload');
    } catch (err: any) {
      console.error('Error procesando imagen:', err);
      setImageErrorNotice('No se pudo procesar la imagen: ' + (err?.message || 'Formato no soportado'));
    } finally {
      setIsProcessingImage(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processAndSetImage(file);
    }
    if (e.target) {
      e.target.value = '';
    }
  };

  const handleImageDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOverImage(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      processAndSetImage(file);
    }
  };

  const handleImagePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          processAndSetImage(file);
          break;
        }
      }
    }
  };

  const handleCustomUrlChange = (val: string) => {
    setCustomUrlInput(val);
    const normalized = normalizeImageUrl(val);
    setFormData((prev) => ({ ...prev, imageUrl: normalized }));
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setIsSavingProduct(true);
    setSaveErrorNotice(null);

    try {
      let finalProduct: Product = { ...formData };
      if (imageInputMode === 'url' && customUrlInput.trim()) {
        finalProduct.imageUrl = normalizeImageUrl(customUrlInput);
      }
      if (!finalProduct.imageUrl || !finalProduct.imageUrl.trim()) {
        finalProduct.imageUrl = 'bilac';
      }

      await onSaveProduct(finalProduct);
      setSaveSuccessNotice('¡Producto e imagen guardados exitosamente!');
      setTimeout(() => setSaveSuccessNotice(null), 3500);
      setActiveTab('list');
      if (onClearInitialEditProduct) {
        onClearInitialEditProduct();
      }
    } catch (err: any) {
      console.error('Error al guardar producto:', err);
      setSaveErrorNotice(`Error al guardar producto: ${err?.message || 'Verifica la conexión'}`);
    } finally {
      setIsSavingProduct(false);
    }
  };

  const handleClearAllCatalog = async () => {
    try {
      await clearAllProductsInCloud();
      setShowClearAllConfirm(false);
      setSaveSuccessNotice('¡Catálogo vaciado completamente!');
      setTimeout(() => setSaveSuccessNotice(null), 3000);
    } catch (e) {
      console.error(e);
    }
  };

  // Export and Import JSON
  const handleExportJSON = () => {
    const exportPayload = {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      branding,
      categories,
      products,
    };
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportPayload, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `aym-distribuciones-backup-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target?.result as string);
        if (Array.isArray(parsed)) {
          // Legacy format (array of products)
          onImportProducts(parsed);
          setSaveSuccessNotice(`Se importaron ${parsed.length} productos correctamente.`);
        } else if (parsed && parsed.products && Array.isArray(parsed.products)) {
          // New format
          onImportProducts(parsed.products);
          if (Array.isArray(parsed.categories)) {
            onSaveCategories(parsed.categories);
          }
          if (parsed.branding && typeof parsed.branding === 'object') {
            onSaveBranding(parsed.branding);
          }
          setSaveSuccessNotice(`Se importaron ${parsed.products.length} productos y configuraciones con éxito.`);
        }
        setTimeout(() => setSaveSuccessNotice(null), 4000);
      } catch (err) {
        alert('Archivo JSON no válido. Verifica la estructura del archivo.');
      }
    };
    reader.readAsText(file);
  };

  // Excel Handlers
  const handleExportExcel = async () => {
    try {
      setIsExportingExcel(true);
      await exportProductsToExcel(products);
      setSaveSuccessNotice(`¡Catálogo de ${products.length} productos exportado a Excel exitosamente!`);
      setTimeout(() => setSaveSuccessNotice(null), 3500);
    } catch (err: any) {
      alert(`Error al exportar a Excel: ${err?.message || 'Ocurrió un error inesperado'}`);
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleExportImages = async () => {
    if (products.length === 0) {
      alert('No hay productos en el catálogo para exportar imágenes.');
      return;
    }

    try {
      setIsExportingImages(true);
      setShowImageExportModal(true);
      setImageExportResult(null);
      setImageExportProgress({
        processed: 0,
        total: products.length,
        percent: 0,
        message: 'Iniciando empaquetado de imágenes del catálogo...',
      });

      const result = await exportProductImagesToZip(products, (prog) => {
        setImageExportProgress(prog);
      });

      setImageExportResult(result);
      setSaveSuccessNotice(
        `¡Paquete de imágenes exportado con éxito en formato ZIP (${result.exportedImagesCount} archivos incluidos)!`
      );
      setTimeout(() => setSaveSuccessNotice(null), 4000);
    } catch (err: any) {
      console.error('Error al exportar imágenes:', err);
      alert(`Error al exportar imágenes: ${err?.message || 'Ocurrió un error inesperado al generar el archivo ZIP'}`);
      setShowImageExportModal(false);
    } finally {
      setIsExportingImages(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      await downloadExcelTemplate();
      setSaveSuccessNotice('¡Plantilla de Excel descargada con éxito!');
      setTimeout(() => setSaveSuccessNotice(null), 3000);
    } catch (err: any) {
      alert(`Error al descargar plantilla: ${err?.message || 'Error inesperado'}`);
    }
  };

  const handleSelectExcelFile = async (file: File) => {
    try {
      setIsImportingExcel(true);
      const result = await parseProductsFromExcel(file, categories);
      if (result.validRows === 0) {
        alert('No se encontraron filas de productos válidas en el archivo Excel.');
        return;
      }
      setExcelImportResult(result);
      setExcelImportFile(file);
      setShowExcelImportModal(true);
    } catch (err: any) {
      alert(`Error al leer archivo Excel: ${err?.message || 'Archivo no compatible o formato inválido'}`);
    } finally {
      setIsImportingExcel(false);
    }
  };

  const handleConfirmExcelImport = async () => {
    if (!excelImportResult || isImportingProducts) return;

    try {
      setIsImportingProducts(true);
      setImportProgress({
        processed: 0,
        total: excelImportResult.products.length,
        percent: 0,
        message: 'Preparando catálogo y validando datos...',
      });

      // 1. Automatically register new categories found in the Excel
      if (excelImportResult.newCategories.length > 0) {
        const updatedCategories = [...categories, ...excelImportResult.newCategories];
        onSaveCategories(updatedCategories);
      }

      // 2. Process products
      if (excelImportMode === 'replace') {
        // Even in replace mode, if preserveExistingImages is on, preserve existing photos if the Excel row left image empty
        const idToExistingImg = new Map<string, string>();
        const nameToExistingImg = new Map<string, string>();
        products.forEach((p) => {
          if (p.imageUrl && p.imageUrl.trim()) {
            idToExistingImg.set(p.id, p.imageUrl.trim());
            if (p.name) nameToExistingImg.set(p.name.trim().toLowerCase(), p.imageUrl.trim());
          }
        });

        const preparedProducts = excelImportResult.products.map((p) => {
          const norm = p.name ? p.name.trim().toLowerCase() : '';
          const existingImg = idToExistingImg.get(p.id) || (norm ? nameToExistingImg.get(norm) : undefined);
          const importedImg = (p.imageUrl || '').trim();

          let finalImg = importedImg;
          if (preserveExistingImages && existingImg && (!importedImg || importedImg === 'bilac')) {
            finalImg = existingImg;
          } else if (!finalImg) {
            finalImg = existingImg || 'bilac';
          }

          return {
            ...p,
            imageUrl: finalImg,
          };
        });

        await onImportProducts(
          preparedProducts,
          'replace',
          (processed, total, message) => {
            const percent = total > 0 ? Math.round((processed / total) * 100) : 0;
            setImportProgress({ processed, total, percent, message });
          }
        );
        setSaveSuccessNotice(
          `¡Catálogo reemplazado exitosamente con ${excelImportResult.products.length.toLocaleString('es-CO')} productos de Excel!`
        );
      } else {
        // Merge mode: use high-performance O(1) hash map lookups to avoid thread freeze
        setImportProgress({
          processed: 0,
          total: excelImportResult.products.length,
          percent: 0,
          message: 'Organizando y fusionando productos existentes...',
        });

        // Yield to allow UI rendering
        await new Promise((r) => setTimeout(r, 20));

        const mergedMap = new Map<string, Product>();
        const nameToIdMap = new Map<string, string>();

        products.forEach((p) => {
          mergedMap.set(p.id, p);
          if (p.name) nameToIdMap.set(p.name.trim().toLowerCase(), p.id);
        });

        excelImportResult.products.forEach((imported) => {
          const normalizedName = imported.name ? imported.name.trim().toLowerCase() : '';
          const existingIdByName = normalizedName ? nameToIdMap.get(normalizedName) : undefined;
          const existingById = mergedMap.get(imported.id) || (existingIdByName ? mergedMap.get(existingIdByName) : undefined);

          if (existingById) {
            // Determine image preservation:
            const existingImg = (existingById.imageUrl || '').trim();
            const importedImg = (imported.imageUrl || '').trim();

            let finalImage = existingImg;

            if (preserveExistingImages) {
              // PRESERVE: Never wipe out an existing image during merge!
              // If the product already has an image, keep it intact unless it had none.
              if (existingImg && existingImg !== '') {
                finalImage = existingImg;
              } else if (importedImg && importedImg !== '') {
                finalImage = importedImg;
              } else {
                finalImage = 'bilac';
              }
            } else {
              // If preservation is unchecked:
              // Only overwrite if the imported Excel cell actually provided a non-empty image (not bilac fallback)
              if (importedImg && importedImg !== '' && importedImg !== 'bilac') {
                finalImage = importedImg;
              } else {
                finalImage = existingImg || importedImg || 'bilac';
              }
            }

            mergedMap.set(existingById.id, {
              ...existingById,
              ...imported,
              id: existingById.id,
              imageUrl: finalImage,
            });
          } else {
            // Completely new product
            mergedMap.set(imported.id, {
              ...imported,
              imageUrl: (imported.imageUrl && imported.imageUrl.trim()) ? imported.imageUrl.trim() : 'bilac',
            });
            if (normalizedName) nameToIdMap.set(normalizedName, imported.id);
          }
        });

        const mergedList = Array.from(mergedMap.values());
        await onImportProducts(
          mergedList,
          'merge',
          (processed, total, message) => {
            const percent = total > 0 ? Math.round((processed / total) * 100) : 0;
            setImportProgress({ processed, total, percent, message });
          }
        );
        setSaveSuccessNotice(
          `¡${excelImportResult.products.length.toLocaleString('es-CO')} productos importados/actualizados desde Excel con éxito!`
        );
      }

      setImportProgress({
        processed: excelImportResult.products.length,
        total: excelImportResult.products.length,
        percent: 100,
        message: '¡Sincronización con la nube completada exitosamente!',
      });

      // Brief pause to show 100% completed
      await new Promise((r) => setTimeout(r, 500));

      setShowExcelImportModal(false);
      setExcelImportResult(null);
      setExcelImportFile(null);
      setTimeout(() => setSaveSuccessNotice(null), 4000);
    } catch (err: any) {
      console.error('Error during Excel import:', err);
      alert(`Error durante la importación: ${err?.message || 'Error al guardar los productos en la base de datos'}`);
    } finally {
      setIsImportingProducts(false);
      setImportProgress(null);
    }
  };

  // Category Handlers
  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    setCategoryError(null);
    const trimmed = newCategoryInput.trim();
    if (!trimmed) return;

    if (categories.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      setCategoryError(`La categoría "${trimmed}" ya existe en el catálogo.`);
      return;
    }

    const updated = [...categories, trimmed];
    onSaveCategories(updated);
    setNewCategoryInput('');
    setSaveSuccessNotice(`Categoría "${trimmed}" agregada.`);
    setTimeout(() => setSaveSuccessNotice(null), 2500);
  };

  const handleStartRenameCategory = (index: number) => {
    setEditingCategoryIndex(index);
    setEditCategoryName(categories[index]);
    setCategoryError(null);
  };

  const handleSaveRenameCategory = (index: number) => {
    const oldCat = categories[index];
    const newCat = editCategoryName.trim();
    if (!newCat || newCat === oldCat) {
      setEditingCategoryIndex(null);
      return;
    }

    if (categories.some((c, i) => i !== index && c.toLowerCase() === newCat.toLowerCase())) {
      setCategoryError(`Ya existe otra categoría con el nombre "${newCat}".`);
      return;
    }

    const updated = [...categories];
    updated[index] = newCat;
    onSaveCategories(updated);
    onRenameCategory(oldCat, newCat);
    setEditingCategoryIndex(null);
    setSaveSuccessNotice(`Categoría actualizada a "${newCat}".`);
    setTimeout(() => setSaveSuccessNotice(null), 2500);
  };

  const handleDeleteCategory = (catName: string) => {
    const productsInCat = products.filter((p) => p.category === catName).length;
    if (productsInCat > 0) {
      const confirmDelete = window.confirm(
        `Hay ${productsInCat} producto(s) en la categoría "${catName}". Si la eliminas, estos productos se asignarán a "${categories[0] || 'General'}". ¿Deseas continuar?`
      );
      if (!confirmDelete) return;
      onRenameCategory(catName, categories[0] || 'General');
    }

    const updated = categories.filter((c) => c !== catName);
    onSaveCategories(updated);
    setSaveSuccessNotice(`Categoría "${catName}" eliminada.`);
    setTimeout(() => setSaveSuccessNotice(null), 2500);
  };

  const handleMoveCategory = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= categories.length) return;

    const updated = [...categories];
    const item = updated.splice(index, 1)[0];
    updated.splice(newIndex, 0, item);
    onSaveCategories(updated);
  };

  const handleResetCategoriesToDefault = () => {
    if (window.confirm('¿Restaurar las categorías a los valores originales?')) {
      onSaveCategories(DEFAULT_BASE_CATEGORIES);
      setSaveSuccessNotice('Categorías restauradas a las predeterminadas.');
      setTimeout(() => setSaveSuccessNotice(null), 2500);
    }
  };

  // Branding & Logo Handlers
  const handleLogoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressAndResizeImage(file, 500, 500, 0.85);
        const updated = { ...brandForm, logoUrl: compressed.dataUrl };
        setBrandForm(updated);
        onSaveBranding(updated);
        setSaveSuccessNotice('¡Logo subido, optimizado y aplicado al encabezado!');
        setTimeout(() => setSaveSuccessNotice(null), 3000);
      } catch (err: any) {
        alert('No se pudo procesar el logo: ' + (err?.message || 'Error'));
      }
    }
  };

  const handleSaveBranding = (e: React.FormEvent) => {
    e.preventDefault();
    const finalBranding: StoreBranding = {
      name: brandForm.name.trim() || 'AYM Distribuciones',
      subtitle: brandForm.subtitle.trim() || 'aym-districuciones.com',
      logoUrl: logoInputMode === 'url' ? logoUrlInput.trim() : brandForm.logoUrl,
      whatsappNumber: brandForm.whatsappNumber?.trim() || '3113986110',
    };
    setBrandForm(finalBranding);
    onSaveBranding(finalBranding);
    setSaveSuccessNotice('¡Identidad y título de la tienda actualizados!');
    setTimeout(() => setSaveSuccessNotice(null), 3000);
  };

  const handleRemoveLogo = () => {
    const updated = { ...brandForm, logoUrl: '' };
    setBrandForm(updated);
    setLogoUrlInput('');
    onSaveBranding(updated);
    setSaveSuccessNotice('Logo removido. Ahora se muestra el título en texto.');
    setTimeout(() => setSaveSuccessNotice(null), 2500);
  };

  const handleResetBranding = () => {
    setBrandForm(DEFAULT_BRANDING);
    setLogoUrlInput('');
    onSaveBranding(DEFAULT_BRANDING);
    setSaveSuccessNotice('Identidad visual restaurada por defecto.');
    setTimeout(() => setSaveSuccessNotice(null), 2500);
  };

  // ==========================================
  // VIEW 1: AUTHENTICATION LOGIN FORM
  // ==========================================
  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
        <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 animate-in zoom-in-95 relative">
          
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="text-center mb-6">
            <div className="w-12 h-12 bg-blue-100 text-[#0B4EA2] rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner">
              <Lock className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">Acceso Administrativo</h2>
            <p className="text-xs text-gray-500 mt-1">
              Catálogo de AYM Distribuciones (aym-districuciones.com)
            </p>
          </div>

          {inactivityNotice && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold rounded-xl flex items-start gap-2.5 animate-in fade-in">
              <Clock className="w-4 h-4 flex-shrink-0 text-amber-600 mt-0.5" />
              <div>
                <div className="font-bold text-amber-800">Sesión Cerrada por Inactividad</div>
                <div className="text-[11px] text-amber-700 mt-0.5">{inactivityNotice}</div>
              </div>
            </div>
          )}

          {(pendingEditProduct || initialEditProduct) && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 text-blue-900 text-xs rounded-xl flex items-start gap-2.5 animate-in fade-in">
              <Edit2 className="w-4 h-4 flex-shrink-0 text-blue-600 mt-0.5" />
              <div>
                <div className="font-bold text-blue-950">
                  Modificación Directa de Producto
                </div>
                <div className="text-[11px] text-blue-700 mt-0.5">
                  Inicia sesión como administrador para editar directamente: <strong>{(pendingEditProduct || initialEditProduct)?.name}</strong>.
                </div>
              </div>
            </div>
          )}

          {authError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl flex items-center gap-2 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-600" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4" autoComplete="off">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Usuario Administrador
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  id="admin-login-username"
                  name="admin-username"
                  autoComplete="off"
                  value={inputUsername}
                  onChange={(e) => {
                    setInputUsername(e.target.value);
                    if (authError) setAuthError(null);
                    if (inactivityNotice) setInactivityNotice(null);
                  }}
                  placeholder="Ingresa tu usuario"
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs sm:text-sm font-semibold focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Contraseña
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  id="admin-login-password"
                  name="admin-password"
                  autoComplete="new-password"
                  value={inputPassword}
                  onChange={(e) => {
                    setInputPassword(e.target.value);
                    if (authError) setAuthError(null);
                    if (inactivityNotice) setInactivityNotice(null);
                  }}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs sm:text-sm font-semibold focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberSession}
                  onChange={(e) => setRememberSession(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
                <span>Recordar sesión activa</span>
              </label>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-[#0B4EA2] hover:bg-[#093e82] active:scale-[0.99] text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 mt-2 cursor-pointer"
            >
              <Lock className="w-4 h-4" />
              <span>Iniciar Sesión en Panel</span>
            </button>
          </form>

        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 2: AUTHENTICATED ADMIN PANEL
  // ==========================================
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-5xl w-full h-[92vh] max-h-[850px] flex flex-col overflow-hidden shadow-2xl border border-gray-100 animate-in zoom-in-95">
        
        {/* Modal Top Header */}
        <div className="bg-slate-900 text-white px-3 sm:px-5 py-2.5 sm:py-3.5 flex items-center justify-between border-b border-slate-800 flex-shrink-0 gap-2">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
            <div className="p-1.5 bg-[#0B4EA2] rounded-lg text-white font-bold flex-shrink-0">
              <Sliders className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              {/* Heading line */}
              <div className="flex items-center gap-2">
                <h2 className="font-extrabold text-sm sm:text-base tracking-tight text-white truncate">
                  Panel de Administración <span className="hidden md:inline">AYM Distribuciones</span>
                </h2>
                {/* Desktop Status Badges (Inline) */}
                <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-[11px] bg-blue-500/30 text-blue-300 font-semibold px-2 py-0.5 rounded-full whitespace-nowrap">
                    {products.length} productos
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full whitespace-nowrap">
                    <Database className="w-3 h-3 text-emerald-400" />
                    <span>Base Local Activa</span>
                  </span>
                </div>
              </div>

              {/* Mobile Fixed Subrow: Base Local Activa is locked in place, never moves or jumps */}
              <div className="flex sm:hidden items-center gap-1.5 mt-0.5 overflow-hidden flex-nowrap">
                <span className="inline-flex items-center gap-1 text-[9.5px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">
                  <Database className="w-2.5 h-2.5 text-emerald-400 flex-shrink-0" />
                  <span>Base Local Activa</span>
                </span>
                <span className="text-[9.5px] bg-blue-500/30 text-blue-300 font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">
                  {products.length} prods
                </span>
                <span className="text-[9.5px] text-slate-400 font-mono truncate min-w-0">
                  @{currentAdmin?.username || adminCredentials.user}
                </span>
              </div>

              {/* Desktop Subtitle */}
              <p className="hidden sm:flex text-[11px] text-slate-400 items-center gap-2 flex-wrap mt-0.5">
                <span>
                  Sesión:{' '}
                  <strong className="text-emerald-400 font-mono">
                    @{currentAdmin?.username || adminCredentials.user}
                  </strong>
                  {currentAdmin?.name && ` (${currentAdmin.name})`}
                </span>
                {currentAdmin?.role && (
                  <span className="px-1.5 py-0.2 rounded text-[9.5px] font-bold uppercase bg-slate-800 text-amber-300 border border-amber-500/30">
                    {currentAdmin.role}
                  </span>
                )}
                <span>•</span>
                <span className="hidden md:inline">aym-distribuciones.com</span>
                <span className="hidden md:inline">•</span>
                <span className="text-emerald-400 text-[10.5px]">Sincronización en tiempo real</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            {/* Inactivity Security Badge with fixed width to avoid layout shifting */}
            <div
              className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg text-xs font-mono transition-all flex-shrink-0 ${
                inactivitySecondsLeft <= 60
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-sm animate-pulse'
                  : 'bg-slate-800/90 text-slate-300 border border-slate-700/60'
              }`}
              title="La sesión se cerrará automáticamente si pasan 10 minutos sin actividad por seguridad"
            >
              <Clock className={`w-3.5 h-3.5 flex-shrink-0 ${inactivitySecondsLeft <= 60 ? 'text-amber-400' : 'text-blue-400'}`} />
              <span className="hidden sm:inline text-[10.5px] font-sans text-slate-400">Inactividad:</span>
              <span className={`font-bold text-xs tabular-nums ${inactivitySecondsLeft <= 60 ? 'text-amber-300' : 'text-emerald-400'}`}>
                {formatRemainingTime(inactivitySecondsLeft)}
              </span>
              {inactivitySecondsLeft <= 60 && (
                <button
                  type="button"
                  onClick={resetInactivityTimer}
                  className="ml-0.5 px-1 py-0.2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[9.5px] rounded font-sans transition-colors cursor-pointer"
                  title="Extender tiempo de sesión activa"
                >
                  +
                </button>
              )}
            </div>

            {/* Change credentials button / Go to Admins */}
            <button
              onClick={() => {
                setActiveTab('admins');
              }}
              className={`p-1.5 sm:px-2.5 sm:py-1 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'admins'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white'
              }`}
              title="Gestionar cuentas de administradores y claves"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden sm:inline">Administradores ({admins.length})</span>
            </button>

            {/* Logout button */}
            <button
              onClick={() => handleLogout(false)}
              className="p-1.5 sm:px-2.5 sm:py-1 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-300 hover:text-red-100 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Cerrar sesión de administrador"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Salir</span>
            </button>

            <button
              onClick={() => {
                if (isImportingProducts) {
                  alert('Hay una carga de productos en proceso hacia la nube. Por favor no cierres la ventana hasta que finalice.');
                  return;
                }
                onClose();
              }}
              className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-1 cursor-pointer"
              title="Cerrar panel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Switcher & Quick Action Bar */}
        <div className="bg-gray-100/90 px-4 py-2 border-b border-gray-200 flex items-center justify-between flex-wrap gap-2 flex-shrink-0">
          <div className="flex items-center gap-1 bg-gray-200/80 p-1 rounded-xl overflow-x-auto">
            {/* Tab 1: Products */}
            <button
              onClick={() => setActiveTab('list')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'list'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Productos ({products.length})
            </button>

            {/* Tab 2: Editor / Crear Producto */}
            <button
              onClick={handleStartCreate}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                activeTab === 'editor'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              {editingId ? 'Editar Producto' : 'Crear Producto'}
            </button>

            {/* Tab 3: Categories */}
            <button
              onClick={() => setActiveTab('categories')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'categories'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-indigo-600" />
              <span>Categorías ({categories.length})</span>
            </button>

            {/* Tab 4: Customers / Clientes (Cartera) */}
            <button
              onClick={() => setActiveTab('customers')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'customers'
                  ? 'bg-purple-700 text-white shadow-xs'
                  : 'text-purple-800 hover:text-purple-950 bg-purple-100/70 hover:bg-purple-200/80'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-purple-600" />
              <span>Clientes (Cartera)</span>
            </button>

            {/* Tab 5: Orders / Pedidos */}
            <button
              onClick={() => setActiveTab('orders')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'orders'
                  ? 'bg-blue-700 text-white shadow-xs'
                  : 'text-blue-800 hover:text-blue-950 bg-blue-100/70 hover:bg-blue-200/80'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5 text-blue-600" />
              <span>Pedidos</span>
            </button>

            {/* Tab 6: Excel Hub / Excel (Importar/Exportar) */}
            <button
              onClick={() => setActiveTab('excel')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'excel'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'text-emerald-800 hover:text-emerald-950 bg-emerald-100/70 hover:bg-emerald-200/80'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 group-hover:text-emerald-900" />
              <span>Excel (Importar/Exportar)</span>
            </button>

            {/* Tab 7: Monthly Unsold Report / Reporte Sin Ventas */}
            <button
              onClick={() => setActiveTab('unsold_report')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'unsold_report'
                  ? 'bg-rose-700 text-white shadow-xs'
                  : 'text-rose-800 hover:text-rose-950 bg-rose-100/80 hover:bg-rose-200/90'
              }`}
            >
              <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
              <span>Reporte Sin Ventas</span>
            </button>

            {/* Tab 8: Branding & Logo / Logo & Título */}
            <button
              onClick={() => setActiveTab('branding')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'branding'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
              <span>Logo & Título</span>
            </button>

            {/* Tab 9: Admins / Administradores */}
            <button
              onClick={() => setActiveTab('admins')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'admins'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-700 hover:text-slate-950 bg-slate-200/80 hover:bg-slate-300'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              <span>Administradores ({admins.length})</span>
            </button>

            {/* Tab 10: Local In-Code Database / Base de Datos Local */}
            <button
              onClick={() => setActiveTab('local_database')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'local_database'
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'text-blue-900 hover:text-blue-950 bg-blue-100/80 hover:bg-blue-200'
              }`}
            >
              <Database className="w-3.5 h-3.5 text-blue-600" />
              <span>Base de Datos Local</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-xs flex-wrap">
            {/* Quick Export Excel */}
            <button
              onClick={handleExportExcel}
              disabled={isExportingExcel}
              className="p-1.5 sm:px-2.5 sm:py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-lg flex items-center gap-1.5 font-bold transition-all shadow-xs cursor-pointer"
              title="Descargar catálogo de productos en formato Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {isExportingExcel ? 'Exportando...' : 'Exportar Excel'}
              </span>
            </button>

            {/* Quick Export Images */}
            <button
              onClick={handleExportImages}
              disabled={isExportingImages}
              className="p-1.5 sm:px-2.5 sm:py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-lg flex items-center gap-1.5 font-bold transition-all shadow-xs cursor-pointer"
              title="Descargar paquete ZIP con las fotos e imágenes de todos los productos"
            >
              <Images className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {isExportingImages ? 'Exportando...' : 'Exportar Imágenes'}
              </span>
            </button>

            {/* Quick Import Excel */}
            <label className="p-1.5 sm:px-2.5 sm:py-1.5 bg-emerald-50 border border-emerald-300 text-emerald-800 hover:bg-emerald-100 rounded-lg flex items-center gap-1.5 font-bold cursor-pointer transition-colors shadow-2xs">
              <Upload className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">
                {isImportingExcel ? 'Cargando...' : 'Importar Excel'}
              </span>
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

            {/* Export JSON */}
            <button
              onClick={handleExportJSON}
              className="p-1.5 sm:px-2.5 sm:py-1.5 bg-white border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 flex items-center gap-1 font-medium transition-colors"
              title="Descargar respaldo completo en JSON"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden md:inline">JSON</span>
            </button>

            {/* Import JSON */}
            <label className="p-1.5 sm:px-2.5 sm:py-1.5 bg-white border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 flex items-center gap-1 font-medium cursor-pointer transition-colors" title="Importar respaldo JSON">
              <FileJson className="w-3.5 h-3.5 text-slate-600" />
              <span className="hidden md:inline">Importar</span>
              <input
                type="file"
                accept=".json"
                onChange={handleImportJSON}
                className="hidden"
              />
            </label>

            {/* Guardar permanentemente en disco */}
            <button
              onClick={async () => {
                try {
                  await saveProductsBatchLocal(products);
                  setSaveSuccessNotice('✓ Todos los cambios guardados permanentemente en el disco');
                  setTimeout(() => setSaveSuccessNotice(null), 3000);
                } catch (e) {
                  console.error(e);
                }
              }}
              className="p-1.5 sm:px-2.5 sm:py-1.5 bg-emerald-50 border border-emerald-300 rounded-lg text-emerald-700 hover:bg-emerald-100 flex items-center gap-1 font-medium transition-colors cursor-pointer"
              title="Guardar todos los cambios permanentemente en el disco del servidor y base de datos"
            >
              <Save className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Guardar Permanente</span>
            </button>
          </div>
        </div>

        {/* Success Alert Banner */}
        {saveSuccessNotice && (
          <div className="bg-emerald-600 text-white px-4 py-2 text-xs font-bold flex items-center justify-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4" />
            {saveSuccessNotice}
          </div>
        )}

        {/* Change Credentials Sub-Modal */}
        {showChangeCredsModal && (
          <div className="bg-slate-50 border-b border-slate-200 p-4 animate-in fade-in">
            <div className="max-w-xl mx-auto bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between pb-2 border-b border-gray-100 mb-3">
                <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4 text-blue-600" />
                  Cambiar Usuario y Contraseña del Administrador
                </h3>
                <button
                  onClick={() => setShowChangeCredsModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {credsErrorNotice && (
                <div className="p-2 bg-red-50 text-red-700 text-xs font-medium rounded-lg mb-3">
                  {credsErrorNotice}
                </div>
              )}
              {credsSuccessNotice && (
                <div className="p-2 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-lg mb-3">
                  {credsSuccessNotice}
                </div>
              )}

              <form onSubmit={handleChangeCredentials} className="space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Nuevo Usuario</label>
                    <input
                      type="text"
                      required
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      placeholder="admin"
                      className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Nueva Clave</label>
                    <input
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Confirmar Clave</label>
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowChangeCredsModal(false)}
                    className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg"
                  >
                    Guardar Nuevas Credenciales
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Main Body Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50">

          {/* TAB 1: PRODUCT LIST */}
          {activeTab === 'list' && (
            <div className="space-y-4">
              {/* Financial & Inventory KPI Overview */}
              {(() => {
                const totalStock = products.reduce((acc, p) => acc + (p.stock || 0), 0);
                const totalCostValue = products.reduce((acc, p) => acc + ((p.costPrice || 0) * (p.stock || 0)), 0);
                const totalSalesValue = products.reduce((acc, p) => acc + ((p.price || 0) * (p.stock || 0)), 0);
                const totalProjectedProfit = totalSalesValue - totalCostValue;
                const avgMarginPct = totalSalesValue > 0 ? (totalProjectedProfit / totalSalesValue) * 100 : 0;

                return (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
                    <div className="bg-white border border-gray-200/80 rounded-xl p-3 shadow-2xs">
                      <span className="text-[10.5px] uppercase font-bold text-gray-500 block">Total en Inventario</span>
                      <div className="flex items-baseline gap-1.5 mt-0.5">
                        <span className="text-base sm:text-lg font-black text-slate-900">{products.length} ref.</span>
                        <span className="text-xs text-gray-400 font-medium">({totalStock} un.)</span>
                      </div>
                    </div>

                    <div className="bg-white border border-gray-200/80 rounded-xl p-3 shadow-2xs">
                      <span className="text-[10.5px] uppercase font-bold text-slate-500 block">Valor a Precio Costo</span>
                      <div className="text-base sm:text-lg font-black text-slate-700 mt-0.5">
                        ${totalCostValue.toLocaleString('es-CO')} <span className="text-[10px] text-gray-400 font-normal">COP</span>
                      </div>
                    </div>

                    <div className="bg-white border border-blue-200/80 rounded-xl p-3 shadow-2xs bg-blue-50/30">
                      <span className="text-[10.5px] uppercase font-bold text-[#0B4EA2] block">Valor a Precio Venta</span>
                      <div className="text-base sm:text-lg font-black text-[#0B5CAB] mt-0.5">
                        ${totalSalesValue.toLocaleString('es-CO')} <span className="text-[10px] text-blue-400 font-normal">COP</span>
                      </div>
                    </div>

                    <div className="bg-white border border-emerald-200/80 rounded-xl p-3 shadow-2xs bg-emerald-50/30">
                      <div className="flex items-center justify-between">
                        <span className="text-[10.5px] uppercase font-bold text-emerald-800">Ganancia Estimada</span>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                          {avgMarginPct.toFixed(1)}% margen
                        </span>
                      </div>
                      <div className="text-base sm:text-lg font-black text-emerald-700 mt-0.5">
                        +${totalProjectedProfit.toLocaleString('es-CO')} <span className="text-[10px] text-emerald-600/70 font-normal">COP</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Top search & counter */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px] max-w-md">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="input-admin-search"
                    type="text"
                    value={searchAdminQuery}
                    onChange={(e) => setSearchAdminQuery(e.target.value)}
                    placeholder="Filtrar por nombre, categoría o SKU... (F10)"
                    className="w-full pl-9 pr-4 py-2 bg-white border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  />
                  {searchAdminQuery && (
                    <button
                      onClick={() => setSearchAdminQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {products.length > 0 && (
                    <button
                      onClick={() => setShowClearAllConfirm(true)}
                      className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
                      title="Eliminar todos los productos del catálogo"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-600" />
                      <span>Vaciar Catálogo</span>
                    </button>
                  )}

                  <button
                    onClick={handleStartCreate}
                    className="px-4 py-2 bg-[#0B4EA2] hover:bg-[#093e82] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Agregar Producto</span>
                  </button>
                </div>
              </div>

              {/* Products Table with Horizontal Sliding Bar */}
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xs">
                {/* 1. Horizontal Slider Navigation Bar */}
                <div className="p-3 bg-slate-50 border-b border-gray-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-[#0B4EA2]" />
                      <span>Deslizar Columnas:</span>
                    </div>

                    {/* Quick column jump buttons */}
                    <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                      <button
                        type="button"
                        onClick={() => scrollToColumnRatio(0)}
                        className="px-2 py-1 bg-white hover:bg-blue-50 hover:text-blue-700 text-slate-700 text-[10.5px] font-bold rounded-lg border border-slate-200 shadow-2xs transition-all flex-shrink-0 cursor-pointer"
                        title="Ir a Descripción y Producto"
                      >
                        📦 Producto
                      </button>
                      <button
                        type="button"
                        onClick={() => scrollToColumnRatio(0.22)}
                        className="px-2 py-1 bg-white hover:bg-blue-50 hover:text-blue-700 text-slate-700 text-[10.5px] font-bold rounded-lg border border-slate-200 shadow-2xs transition-all flex-shrink-0 cursor-pointer"
                        title="Ir a Categoría"
                      >
                        🏷️ Categoría
                      </button>
                      <button
                        type="button"
                        onClick={() => scrollToColumnRatio(0.38)}
                        className="px-2 py-1 bg-white hover:bg-emerald-50 hover:text-emerald-800 text-slate-700 text-[10.5px] font-bold rounded-lg border border-slate-200 shadow-2xs transition-all flex-shrink-0 cursor-pointer"
                        title="Ir a Interruptor de Promoción"
                      >
                        🟢 Promoción
                      </button>
                      <button
                        type="button"
                        onClick={() => scrollToColumnRatio(0.60)}
                        className="px-2 py-1 bg-white hover:bg-blue-50 hover:text-blue-700 text-slate-700 text-[10.5px] font-bold rounded-lg border border-slate-200 shadow-2xs transition-all flex-shrink-0 cursor-pointer"
                        title="Ir a Costo y Precio de Venta"
                      >
                        💰 Costo / Venta
                      </button>
                      <button
                        type="button"
                        onClick={() => scrollToColumnRatio(0.80)}
                        className="px-2 py-1 bg-white hover:bg-amber-50 hover:text-amber-800 text-slate-700 text-[10.5px] font-bold rounded-lg border border-slate-200 shadow-2xs transition-all flex-shrink-0 cursor-pointer"
                        title="Ir a Ganancia y Margen"
                      >
                        📊 Margen
                      </button>
                      <button
                        type="button"
                        onClick={() => scrollToColumnRatio(1)}
                        className="px-2 py-1 bg-white hover:bg-blue-50 hover:text-blue-700 text-slate-700 text-[10.5px] font-bold rounded-lg border border-slate-200 shadow-2xs transition-all flex-shrink-0 cursor-pointer"
                        title="Ir a Stock y Acciones"
                      >
                        ⚙️ Acciones
                      </button>
                    </div>
                  </div>

                  {/* Left & Right Slide Controls + Scroll Progress Bar */}
                  <div className="flex items-center gap-2 self-end sm:self-auto ml-auto">
                    <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-gray-500 font-medium mr-1">
                      <MoveHorizontal className="w-3.5 h-3.5 text-gray-400" />
                      <span>Arrastra o desliza:</span>
                    </div>

                    {/* Progress Track */}
                    <div className="w-16 sm:w-24 h-2 bg-gray-200 rounded-full overflow-hidden relative">
                      <div
                        className="h-full bg-[#0B4EA2] rounded-full transition-all duration-150"
                        style={{ width: `${Math.max(15, tableScrollProgress)}%` }}
                      />
                    </div>

                    {/* Left Slide Button */}
                    <button
                      type="button"
                      onClick={() => slideTable('left')}
                      aria-label="Deslizar tabla a la izquierda"
                      className="w-8 h-8 rounded-xl bg-white hover:bg-blue-600 hover:text-white active:scale-90 text-slate-700 flex items-center justify-center transition-all border border-slate-300 shadow-2xs cursor-pointer"
                      title="Deslizar tabla hacia la izquierda"
                    >
                      <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
                    </button>

                    {/* Right Slide Button */}
                    <button
                      type="button"
                      onClick={() => slideTable('right')}
                      aria-label="Deslizar tabla a la derecha"
                      className="w-8 h-8 rounded-xl bg-[#0B4EA2] hover:bg-[#083b7c] active:scale-90 text-white flex items-center justify-center transition-all shadow-2xs cursor-pointer"
                      title="Deslizar tabla hacia la derecha"
                    >
                      <ChevronRight className="w-4 h-4 stroke-[2.5]" />
                    </button>
                  </div>
                </div>

                {/* 2. Table Container with Drag-to-scroll, Wheel scroll, and Floating Edge Arrows */}
                <div className="relative group/tablerow">
                  {/* Left edge floating slide button */}
                  <button
                    type="button"
                    onClick={() => slideTable('left')}
                    className={`absolute left-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white/95 text-slate-800 hover:bg-[#0B4EA2] hover:text-white shadow-lg border border-gray-200 flex items-center justify-center transition-all cursor-pointer ${
                      canScrollTableLeft ? 'opacity-100' : 'opacity-40 hover:opacity-100'
                    }`}
                    title="Deslizar tabla hacia la izquierda"
                  >
                    <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
                  </button>

                  {/* Right edge floating slide button */}
                  <button
                    type="button"
                    onClick={() => slideTable('right')}
                    className={`absolute right-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white/95 text-slate-800 hover:bg-[#0B4EA2] hover:text-white shadow-lg border border-gray-200 flex items-center justify-center transition-all cursor-pointer ${
                      canScrollTableRight ? 'opacity-100' : 'opacity-40 hover:opacity-100'
                    }`}
                    title="Deslizar tabla hacia la derecha"
                  >
                    <ChevronRight className="w-4 h-4 stroke-[2.5]" />
                  </button>

                  <div
                    ref={productsTableRef}
                    onMouseDown={handleTableMouseDown}
                    onMouseLeave={handleTableMouseLeaveOrUp}
                    onMouseUp={handleTableMouseLeaveOrUp}
                    onMouseMove={handleTableMouseMove}
                    onWheel={(e) => {
                      // Allow natural horizontal scroll or shift-wheel scroll
                      if (Math.abs(e.deltaX) > 0) {
                        // Natural trackpad horizontal scroll
                        return;
                      }
                      if (e.shiftKey && productsTableRef.current) {
                        e.preventDefault();
                        productsTableRef.current.scrollLeft += e.deltaY;
                        checkTableScroll();
                      }
                    }}
                    className={`overflow-x-auto scroll-smooth [-webkit-overflow-scrolling:touch] ${
                      isTableDragging ? 'cursor-grabbing select-none' : 'cursor-grab'
                    }`}
                    style={{
                      scrollbarWidth: 'thin',
                      scrollbarColor: '#0B4EA2 #E2E8F0',
                    }}
                  >
                    <table className="w-full text-left text-xs min-w-[950px]">
                      <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[10px] border-b border-gray-200 sticky top-0 z-10">
                        <tr>
                          <th className="py-2.5 px-3">Imagen</th>
                          <th className="py-2.5 px-3 min-w-[180px]">Producto / Descripción</th>
                          <th className="py-2.5 px-3 min-w-[120px]">Categoría</th>
                          <th className="py-2.5 px-3 min-w-[150px]">Promoción (Interruptor)</th>
                          <th className="py-2.5 px-3 min-w-[110px]">Precio Costo</th>
                          <th className="py-2.5 px-3 min-w-[110px]">Precio Venta</th>
                          <th className="py-2.5 px-3 min-w-[120px]">Ganancia / Margen</th>
                          <th className="py-2.5 px-3 min-w-[100px]">Empaque</th>
                          <th className="py-2.5 px-3 min-w-[80px]">Stock</th>
                          <th className="py-2.5 px-3 text-right min-w-[90px]">Acciones</th>
                        </tr>
                      </thead>
                    <tbody className="divide-y divide-gray-100">
                      {adminFilteredProducts.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="py-8 text-center text-gray-400 font-medium">
                            No se encontraron productos con el filtro especificado.
                          </td>
                        </tr>
                      ) : (
                        paginatedAdminProducts.map((prod) => {
                          const isPromoOn = prod.hasPromotion === true || (prod.hasPromotion !== false && Boolean(prod.promoBadge && prod.promoBadge.trim().length > 0));
                          const cost = prod.costPrice || 0;
                          const profit = prod.price - cost;
                          const marginPct = prod.price > 0 && cost > 0 ? ((profit / prod.price) * 100) : 0;
                          const isProfitable = cost > 0 ? profit > 0 : true;

                          return (
                          <tr key={prod.id} className="hover:bg-blue-50/40 transition-colors">
                            {/* Visual Thumbnail */}
                            <td className="py-2 px-3">
                              <div className="w-10 h-10 bg-gray-100 rounded-lg p-1 flex items-center justify-center border border-gray-200">
                                <ProductVisual type={prod.imageUrl} name={prod.name} />
                              </div>
                            </td>

                              {/* Product Name & SKU / Barcode */}
                              <td className="py-2.5 px-3">
                                <div className="font-bold text-slate-900 leading-tight">
                                  {prod.name}
                                </div>
                                {isPromoOn ? (
                                  <div className="text-[10px] text-emerald-700 font-semibold mt-0.5 line-clamp-1">
                                    🏷️ {prod.promoBadge}
                                  </div>
                                ) : (
                                  <div className="text-[10px] text-gray-400 font-medium mt-0.5">
                                    ⚪ Sin franja de promoción
                                  </div>
                                )}
                                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                  {prod.sku && (
                                    <span className="text-[9.5px] font-mono text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">
                                      SKU: {prod.sku}
                                    </span>
                                  )}
                                  {prod.barcode && (
                                    <span className="text-[9.5px] font-mono text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 flex items-center gap-0.5">
                                      <Barcode className="w-2.5 h-2.5 text-blue-600" />
                                      {prod.barcode}
                                    </span>
                                  )}
                                </div>
                              </td>

                            {/* Category */}
                            <td className="py-2.5 px-3">
                              <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full font-medium text-[10.5px]">
                                {prod.category}
                              </span>
                            </td>

                            {/* Promo Switch (Quick Toggle) */}
                            <td className="py-2.5 px-3">
                              <button
                                type="button"
                                onClick={() => handleToggleProductPromo(prod)}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10.5px] font-bold transition-all cursor-pointer border ${
                                  isPromoOn
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 shadow-2xs'
                                    : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'
                                }`}
                                title={
                                  isPromoOn
                                    ? 'Toca para desactivar promoción (Ocultar zona verde)'
                                    : 'Toca para activar promoción (Mostrar zona verde)'
                                }
                              >
                                <span className={`w-2 h-2 rounded-full ${
                                  isPromoOn ? 'bg-emerald-600' : 'bg-gray-400'
                                }`} />
                                <span>{isPromoOn ? '🟢 Activa' : '⚪ Desactivada'}</span>
                              </button>
                            </td>

                            {/* Cost Price */}
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              {prod.costPrice !== undefined && prod.costPrice > 0 ? (
                                <div className="font-semibold text-slate-700 text-xs">
                                  ${prod.costPrice.toLocaleString('es-CO')}
                                  <span className="text-[10px] text-gray-400 ml-0.5">COP</span>
                                </div>
                              ) : (
                                <span className="text-gray-400 italic text-[10px]">Sin costo</span>
                              )}
                            </td>

                            {/* Sales Price */}
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <div className="font-black text-[#0B5CAB]">
                                ${prod.price.toLocaleString('es-CO')} COP
                              </div>
                              {prod.originalPrice && prod.originalPrice > prod.price && (
                                <div className="line-through text-gray-400 text-[10px]">
                                  ${prod.originalPrice.toLocaleString('es-CO')} COP
                                </div>
                              )}
                            </td>

                            {/* Margin / Profit */}
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              {prod.costPrice !== undefined && prod.costPrice > 0 ? (
                                <div>
                                  <div className={`font-bold text-[11px] ${isProfitable ? 'text-emerald-700' : 'text-red-600'}`}>
                                    {isProfitable ? '+' : ''}${profit.toLocaleString('es-CO')} COP
                                  </div>
                                  <span className={`inline-block px-1.5 py-0.5 rounded text-[9.5px] font-bold ${
                                    marginPct >= 25 
                                      ? 'bg-emerald-100 text-emerald-800' 
                                      : marginPct >= 10 
                                      ? 'bg-blue-100 text-blue-800' 
                                      : marginPct > 0 
                                      ? 'bg-amber-100 text-amber-800' 
                                      : 'bg-red-100 text-red-800'
                                  }`}>
                                    {marginPct.toFixed(1)}% margen
                                  </span>
                                </div>
                              ) : (
                                <span className="text-gray-400 text-[10px]">-</span>
                              )}
                            </td>

                            {/* Packaging */}
                            <td className="py-2.5 px-3 text-gray-600 font-medium">
                              {prod.packaging}
                            </td>

                            {/* Stock */}
                            <td className="py-2.5 px-3">
                              <span className={`px-2 py-0.5 rounded text-[10.5px] font-bold ${
                                (prod.stock || 0) > 20
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-amber-50 text-amber-700'
                              }`}>
                                {prod.stock || 0} un.
                              </span>
                            </td>

                            {/* Actions */}
                            <td className="py-2.5 px-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => handleStartEdit(prod)}
                                  className="p-1.5 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors"
                                  title="Editar producto"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDuplicate(prod)}
                                  className="p-1.5 hover:bg-gray-100 text-gray-600 rounded-lg transition-colors"
                                  title="Duplicar producto"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>

                                {deleteConfirmId === prod.id ? (
                                  <div className="flex items-center gap-1 bg-red-50 p-1 rounded-lg border border-red-200 animate-in fade-in">
                                    <button
                                      onClick={() => {
                                        onDeleteProduct(prod.id);
                                        setDeleteConfirmId(null);
                                      }}
                                      className="px-2 py-0.5 bg-red-600 text-white rounded font-bold text-[10px]"
                                    >
                                      Borrar
                                    </button>
                                    <button
                                      onClick={() => setDeleteConfirmId(null)}
                                      className="text-gray-500 hover:text-gray-700 p-0.5"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setDeleteConfirmId(prod.id)}
                                    className="p-1.5 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
                                    title="Eliminar producto"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bottom Horizontal Slider Helper Bar */}
              <div className="px-3 py-2.5 bg-slate-50 border-t border-gray-200 flex items-center justify-between gap-3 text-xs flex-wrap">
                <div className="flex items-center gap-1.5 text-[11px] text-gray-600 font-semibold">
                  <ArrowLeft className="w-3.5 h-3.5 text-[#0B4EA2]" />
                  <span>Desliza a la izquierda</span>
                  <span>•</span>
                  <span>Desliza a la derecha</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#0B4EA2]" />
                </div>

                {/* Range Slider for direct horizontal scrolling */}
                <div className="flex items-center gap-2 flex-1 max-w-[220px] sm:max-w-[320px]">
                  <span className="text-[10px] text-gray-500 font-mono font-bold">0% (Inicio)</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={tableScrollProgress}
                    onInput={(e) => handleTableRangeSliderChange(Number((e.target as HTMLInputElement).value))}
                    onChange={(e) => handleTableRangeSliderChange(Number(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#0B4EA2]"
                    title="Deslizar tabla hacia la izquierda o derecha"
                  />
                  <span className="text-[10px] text-gray-500 font-mono font-bold">100% (Fin)</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => slideTable('left')}
                    className="px-2 py-1 rounded-lg bg-white hover:bg-blue-600 hover:text-white active:scale-90 border border-gray-300 text-slate-700 font-bold text-[11px] flex items-center gap-1 shadow-2xs transition-all cursor-pointer"
                    title="Mover a la izquierda"
                  >
                    <ChevronLeft className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Izquierda</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => slideTable('right')}
                    className="px-2 py-1 rounded-lg bg-[#0B4EA2] hover:bg-[#083b7c] active:scale-90 text-white font-bold text-[11px] flex items-center gap-1 shadow-2xs transition-all cursor-pointer"
                    title="Mover a la derecha"
                  >
                    <span>Derecha</span>
                    <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
                  </button>
                </div>
              </div>

                {/* Pagination Controls Bar */}
                {adminFilteredProducts.length > 0 && (
                  <div className="p-3 bg-slate-50 border-t border-gray-200 flex items-center justify-between flex-wrap gap-3 text-xs">
                    <div className="flex items-center gap-2 text-slate-600">
                      <span>
                        Mostrando{' '}
                        <strong>
                          {((currentAdminPageClamped - 1) * adminPageSize + 1).toLocaleString('es-CO')}
                        </strong>{' '}
                        a{' '}
                        <strong>
                          {Math.min(currentAdminPageClamped * adminPageSize, adminFilteredProducts.length).toLocaleString('es-CO')}
                        </strong>{' '}
                        de <strong>{adminFilteredProducts.length.toLocaleString('es-CO')}</strong> productos
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Page size selector */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-500 text-[11px]">Por página:</span>
                        <select
                          value={adminPageSize}
                          onChange={(e) => {
                            setAdminPageSize(Number(e.target.value));
                            setAdminPage(1);
                          }}
                          className="bg-white border border-gray-300 rounded-lg px-2 py-1 text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                        >
                          <option value={25}>25</option>
                          <option value={50}>50</option>
                          <option value={100}>100</option>
                          <option value={200}>200</option>
                          <option value={500}>500</option>
                        </select>
                      </div>

                      {/* Page navigation buttons */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setAdminPage(1)}
                          disabled={currentAdminPageClamped <= 1}
                          className="p-1 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                          title="Primera página"
                        >
                          <ChevronsLeft className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setAdminPage((p) => Math.max(1, p - 1))}
                          disabled={currentAdminPageClamped <= 1}
                          className="p-1 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                          title="Página anterior"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>

                        <span className="px-2.5 py-1 bg-white border border-gray-300 rounded-lg font-bold text-slate-900 text-xs">
                          {currentAdminPageClamped} / {totalAdminPages}
                        </span>

                        <button
                          type="button"
                          onClick={() => setAdminPage((p) => Math.min(totalAdminPages, p + 1))}
                          disabled={currentAdminPageClamped >= totalAdminPages}
                          className="p-1 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                          title="Página siguiente"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setAdminPage(totalAdminPages)}
                          disabled={currentAdminPageClamped >= totalAdminPages}
                          className="p-1 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                          title="Última página"
                        >
                          <ChevronsRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: PRODUCT EDITOR & LIVE PREVIEW */}
          {activeTab === 'editor' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Column: Form (8 cols) */}
              <form onSubmit={handleSubmitForm} className="lg:col-span-8 space-y-4">
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-4 text-xs">
                  <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                    <div>
                      <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                        <span>{editingId ? 'Modificar Información del Producto' : 'Crear Nuevo Producto'}</span>
                        {initialEditProduct && editingId === initialEditProduct.id && (
                          <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
                            <Edit2 className="w-3 h-3" />
                            <span>Acceso directo desde catálogo</span>
                          </span>
                        )}
                      </h3>
                      {editingId && (
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          Edita los campos y haz clic en "Guardar Cambios" para sincronizar de inmediato.
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-500 font-mono bg-gray-200/70 px-2 py-0.5 rounded">ID: {formData.id}</span>
                  </div>

                  {/* Product Name */}
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      Nombre Comercial del Producto *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ej: LECHE CHOCO BILAC 180 ML BOLSA X12"
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-semibold uppercase focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                    />
                  </div>

                  {/* Category & Packaging */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block font-bold text-slate-800">Categoría *</label>
                        <button
                          type="button"
                          onClick={() => setActiveTab('categories')}
                          className="text-[10px] text-blue-600 font-semibold hover:underline"
                        >
                          + Administrar Categorías
                        </button>
                      </div>
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600 focus:outline-hidden font-medium"
                      >
                        {categories.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-800 mb-1">
                        Presentación / Empaque *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.packaging}
                        onChange={(e) => setFormData({ ...formData, packaging: e.target.value })}
                        placeholder="Ej: Bolsa x 12, Sixpack x 400ml, Caja x 24"
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  {/* Pricing and Cost Section with Live Profit Calculator */}
                  <div className="bg-gradient-to-br from-blue-50/80 via-slate-50 to-indigo-50/50 p-4 rounded-xl border border-blue-200/90 space-y-3">
                    <div className="flex items-center justify-between border-b border-blue-200/60 pb-2">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-[#0B4EA2] text-white rounded-lg">
                          <DollarSign className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="font-extrabold text-slate-900 text-xs sm:text-sm">
                            Estructura de Precios: Costo, Venta y Rentabilidad
                          </h4>
                          <p className="text-[10.5px] text-gray-500">
                            Define tu costo de compra y el precio mayorista para calcular márgenes
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* Cost Price */}
                      <div className="bg-white p-3 rounded-lg border border-gray-300 shadow-2xs">
                        <label className="block font-bold text-slate-700 text-xs mb-1">
                          Precio de Costo ($ COP)
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={costPriceInput}
                          onChange={(e) => {
                            const raw = e.target.value;
                            setCostPriceInput(raw);
                            if (raw.trim() === '') {
                              setFormData((prev) => ({ ...prev, costPrice: undefined }));
                            } else {
                              const parsed = parseFlexiblePrice(raw);
                              if (!isNaN(parsed)) {
                                setFormData((prev) => ({ ...prev, costPrice: parsed }));
                              }
                            }
                          }}
                          onBlur={() => {
                            if (formData.costPrice !== undefined) {
                              setCostPriceInput(String(formData.costPrice));
                            }
                          }}
                          placeholder="Ej: 950 o 1.200"
                          className="w-full px-3 py-2 bg-slate-50 border border-gray-300 rounded-lg text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                        />
                        <div className="flex items-center justify-between text-[10px] text-gray-500 mt-1">
                          <span>Acepta . o ,</span>
                          {formData.costPrice !== undefined && (
                            <span className="font-bold text-slate-700 font-mono">
                              ${formData.costPrice.toLocaleString('es-CO')}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Sale Price */}
                      <div className="bg-white p-3 rounded-lg border-2 border-[#0B4EA2]/40 shadow-2xs">
                        <label className="block font-black text-[#0B4EA2] text-xs mb-1">
                          Precio de Venta Mayorista ($ COP) *
                        </label>
                        <input
                          type="text"
                          required
                          inputMode="decimal"
                          value={priceInput}
                          onChange={(e) => {
                            const raw = e.target.value;
                            setPriceInput(raw);
                            const parsed = parseFlexiblePrice(raw);
                            if (!isNaN(parsed) && parsed >= 0) {
                              setFormData((prev) => ({ ...prev, price: parsed }));
                            }
                          }}
                          onBlur={() => {
                            setPriceInput(String(formData.price));
                          }}
                          placeholder="Ej: 1245 o 2.500"
                          className="w-full px-3 py-2 bg-blue-50/50 border border-blue-300 rounded-lg text-xs font-black text-[#0B5CAB] focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                        />
                        <div className="flex items-center justify-between text-[10px] text-blue-700 font-semibold mt-1">
                          <span>Precio catálogo</span>
                          <span className="font-bold font-mono">
                            ${formData.price.toLocaleString('es-CO')} COP
                          </span>
                        </div>
                      </div>

                      {/* Regular / Original Price */}
                      <div className="bg-white p-3 rounded-lg border border-gray-300 shadow-2xs">
                        <label className="block font-bold text-gray-600 text-xs mb-1">
                          Precio Anterior / Tachado ($ COP)
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={originalPriceInput}
                          onChange={(e) => {
                            const raw = e.target.value;
                            setOriginalPriceInput(raw);
                            if (raw.trim() === '') {
                              setFormData((prev) => ({ ...prev, originalPrice: undefined }));
                            } else {
                              const parsed = parseFlexiblePrice(raw);
                              if (!isNaN(parsed)) {
                                setFormData((prev) => ({ ...prev, originalPrice: parsed }));
                              }
                            }
                          }}
                          onBlur={() => {
                            if (formData.originalPrice !== undefined) {
                              setOriginalPriceInput(String(formData.originalPrice));
                            }
                          }}
                          placeholder="Ej: 1660 o 3.200 (Opcional)"
                          className="w-full px-3 py-2 bg-slate-50 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                        />
                        <div className="flex items-center justify-between text-[10px] text-gray-400 mt-1">
                          <span>Descuento tachado</span>
                          {formData.originalPrice !== undefined && (
                            <span className="font-bold text-gray-600 line-through font-mono">
                              ${formData.originalPrice.toLocaleString('es-CO')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Quick Margin Suggestions if Cost Price is set */}
                    {formData.costPrice !== undefined && formData.costPrice > 0 && (
                      <div className="bg-white/90 p-2.5 rounded-lg border border-blue-100 flex items-center justify-between flex-wrap gap-2">
                        <span className="text-[11px] font-bold text-slate-700">
                          ⚡ Fijar Venta sugerida según margen deseado sobre costo:
                        </span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {[15, 20, 25, 30, 35, 40, 50].map((margin) => {
                            const suggestedPrice = Math.round(Number(formData.costPrice) * (1 + margin / 100));
                            return (
                              <button
                                key={margin}
                                type="button"
                                onClick={() => {
                                  setFormData({ ...formData, price: suggestedPrice });
                                  setPriceInput(String(suggestedPrice));
                                }}
                                className="px-2 py-1 bg-blue-50 hover:bg-[#0B4EA2] hover:text-white text-[#0B4EA2] rounded font-bold text-[10.5px] transition-colors border border-blue-200 cursor-pointer"
                                title={`Calcular precio de venta: $${suggestedPrice.toLocaleString('es-CO')} (+${margin}% de ganancia)`}
                              >
                                +{margin}% (${suggestedPrice.toLocaleString('es-CO')})
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Live Profit Analysis Box */}
                    {(() => {
                      const cost = formData.costPrice || 0;
                      const sale = formData.price || 0;
                      if (cost <= 0 || sale <= 0) return null;
                      const profit = sale - cost;
                      const marginOnSale = ((profit / sale) * 100);
                      const markupOnCost = ((profit / cost) * 100);
                      const isPositive = profit > 0;

                      return (
                        <div className={`p-3 rounded-xl border transition-all ${
                          isPositive ? 'bg-emerald-50/90 border-emerald-300' : 'bg-red-50/90 border-red-300'
                        }`}>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center">
                            <div>
                              <span className="text-[10px] uppercase font-bold text-gray-500 block">Ganancia Neta por Unidad</span>
                              <span className={`text-sm sm:text-base font-black ${isPositive ? 'text-emerald-700' : 'text-red-600'}`}>
                                {isPositive ? '+' : ''}${profit.toLocaleString('es-CO')} COP
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase font-bold text-gray-500 block">Margen Comercial (% Venta)</span>
                              <span className={`text-sm sm:text-base font-black ${isPositive ? 'text-emerald-700' : 'text-red-600'}`}>
                                {marginOnSale.toFixed(1)}%
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase font-bold text-gray-500 block">Rentabilidad (% Costo)</span>
                              <span className={`text-sm sm:text-base font-black ${isPositive ? 'text-emerald-700' : 'text-red-600'}`}>
                                +{markupOnCost.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* PROMOTION / DISCOUNT SWITCH & CONFIGURATION */}
                  {(() => {
                    const isPromoActive = formData.hasPromotion === true || (formData.hasPromotion !== false && Boolean(formData.promoBadge && formData.promoBadge.trim().length > 0));
                    return (
                      <div className={`p-4 rounded-xl border transition-all ${
                        isPromoActive
                          ? 'bg-emerald-50/80 border-emerald-300 shadow-2xs'
                          : 'bg-gray-100/70 border-gray-200'
                      }`}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <div className={`p-2 rounded-lg ${
                              isPromoActive
                                ? 'bg-emerald-600 text-white'
                                : 'bg-gray-300 text-gray-700'
                            }`}>
                              <Tag className="w-4 h-4" />
                            </div>
                            <div>
                              <label className="block font-black text-slate-900 text-xs">
                                Interruptor de Promoción / Descuento (Zona Verde)
                              </label>
                              <p className="text-[11px] text-gray-500">
                                {isPromoActive
                                  ? '🟢 Promoción ACTIVADA: Se mostrará la franja verde en el catálogo.'
                                  : '⚪ Promoción DESACTIVADA: NO se mostrará ninguna zona verde en este producto.'}
                              </p>
                            </div>
                          </div>

                          {/* Toggle Switch */}
                          <button
                            type="button"
                            onClick={() => {
                              if (isPromoActive) {
                                // Turn OFF
                                setFormData((prev) => ({
                                  ...prev,
                                  hasPromotion: false,
                                  promoBadge: '',
                                }));
                              } else {
                                // Turn ON
                                setFormData((prev) => ({
                                  ...prev,
                                  hasPromotion: true,
                                  promoBadge: prev.promoBadge?.trim() || '20.00% de descuento',
                                }));
                              }
                            }}
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                              isPromoActive ? 'bg-emerald-600' : 'bg-gray-300'
                            }`}
                            role="switch"
                            aria-checked={isPromoActive}
                          >
                            <span
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                                isPromoActive ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>

                        {/* Promotion Options when Switch is ON */}
                        {isPromoActive && (
                          <div className="mt-3 pt-3 border-t border-emerald-200 space-y-3 animate-in fade-in duration-150">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div className="sm:col-span-2">
                                <label className="block font-bold text-emerald-950 mb-1">
                                  Texto de la Franja Verde *
                                </label>
                                <input
                                  type="text"
                                  value={formData.promoBadge || ''}
                                  onChange={(e) => setFormData({ ...formData, promoBadge: e.target.value, hasPromotion: true })}
                                  placeholder="Ej: 20.00% de descuento o Compra 6 y lleva 1 gratis"
                                  className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-lg text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-600 focus:outline-hidden"
                                />
                              </div>

                              <div>
                                <label className="block font-bold text-emerald-950 mb-1">
                                  Tipo de Etiqueta
                                </label>
                                <select
                                  value={formData.badgeType || 'discount'}
                                  onChange={(e) =>
                                    setFormData({
                                      ...formData,
                                      badgeType: e.target.value as 'discount' | 'gift' | 'bonus' | 'combo',
                                    })
                                  }
                                  className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-600 focus:outline-hidden"
                                >
                                  <option value="discount">Descuento (%)</option>
                                  <option value="gift">Obsequio / Regalo</option>
                                  <option value="bonus">Bonus (Pagas X llevas Y)</option>
                                  <option value="combo">Combo Especial</option>
                                </select>
                              </div>
                            </div>

                            {/* Quick Promotion Generator Presets */}
                            <div>
                              <span className="text-[10px] font-bold text-emerald-900 block mb-1">
                                Plantillas rápidas para la franja promocional:
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {formData.originalPrice && formData.originalPrice > formData.price && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const pct = Math.round(((formData.originalPrice! - formData.price) / formData.originalPrice!) * 100);
                                      setFormData({
                                        ...formData,
                                        hasPromotion: true,
                                        promoBadge: `${pct}.00% de descuento`,
                                        badgeType: 'discount',
                                      });
                                    }}
                                    className="px-2.5 py-1 bg-emerald-100 hover:bg-emerald-200 border border-emerald-400 text-emerald-900 font-bold text-[10.5px] rounded-md transition-colors cursor-pointer"
                                  >
                                    ⚡ Calcular automático ({Math.round(((formData.originalPrice - formData.price) / formData.originalPrice) * 100)}% OFF)
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setFormData({ ...formData, hasPromotion: true, promoBadge: '20.00% de descuento', badgeType: 'discount' })}
                                  className="px-2 py-1 bg-white hover:bg-emerald-50 border border-emerald-300 text-emerald-800 text-[10.5px] rounded-md transition-colors cursor-pointer"
                                >
                                  🏷️ 20% de descuento
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setFormData({ ...formData, hasPromotion: true, promoBadge: 'Compra 6 y llévate 1 gratis', badgeType: 'gift' })}
                                  className="px-2 py-1 bg-white hover:bg-emerald-50 border border-emerald-300 text-emerald-800 text-[10.5px] rounded-md transition-colors cursor-pointer"
                                >
                                  🎁 Compra 6 lleva 1 gratis
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setFormData({ ...formData, hasPromotion: true, promoBadge: 'Pagas 24, llevas 30 latas', badgeType: 'bonus' })}
                                  className="px-2 py-1 bg-white hover:bg-emerald-50 border border-emerald-300 text-emerald-800 text-[10.5px] rounded-md transition-colors cursor-pointer"
                                >
                                  📦 Paga 24 lleva 30
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Stock and Min Order */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-800 mb-1">
                        Stock Disponible en Bodega
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.stock ?? 100}
                        onChange={(e) => setFormData({ ...formData, stock: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-800 mb-1">
                        Pedido Mínimo (Unidades)
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={formData.minOrder ?? 1}
                        onChange={(e) => setFormData({ ...formData, minOrder: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  {/* Image Selector / Custom Upload */}
                  <div className="border-t border-gray-200 pt-3 space-y-2">
                    <label className="block font-bold text-slate-800">
                      Imagen o Ilustración del Producto
                    </label>

                    {/* Mode selector */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setImageInputMode('preset')}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                          imageInputMode === 'preset'
                            ? 'bg-[#0B4EA2] text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        Ilustración Prediseñada
                      </button>
                      <button
                        type="button"
                        onClick={() => setImageInputMode('upload')}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 ${
                          imageInputMode === 'upload'
                            ? 'bg-[#0B4EA2] text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        <Upload className="w-3 h-3" />
                        Subir Foto
                      </button>
                      <button
                        type="button"
                        onClick={() => setImageInputMode('url')}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 ${
                          imageInputMode === 'url'
                            ? 'bg-[#0B4EA2] text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        <LinkIcon className="w-3 h-3" />
                        URL de Imagen
                      </button>
                    </div>

                    {/* Preset Selector */}
                    {imageInputMode === 'preset' && (
                      <div className="space-y-1">
                        <select
                          value={PRESET_IMAGE_OPTIONS.some((opt) => opt.id === formData.imageUrl) ? formData.imageUrl : 'bilac'}
                          onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                        >
                          {PRESET_IMAGE_OPTIONS.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.label} ({opt.id})
                            </option>
                          ))}
                        </select>
                        <p className="text-[10px] text-gray-500 italic">
                          Ilustraciones vectoriales integradas de empaques populares (Bilac, Tostao, Aceite, etc.).
                        </p>
                      </div>
                    )}

                    {/* URL Input */}
                    {imageInputMode === 'url' && (
                      <div className="space-y-1.5">
                        <div className="relative">
                          <input
                            type="url"
                            value={customUrlInput}
                            onChange={(e) => handleCustomUrlChange(e.target.value)}
                            placeholder="https://ejemplo.com/imagen.jpg o enlace de Google Drive / Dropbox"
                            className="w-full px-3 py-2 pr-16 bg-white border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                          />
                          {customUrlInput && (
                            <button
                              type="button"
                              onClick={() => {
                                setCustomUrlInput('');
                                setFormData((prev) => ({ ...prev, imageUrl: 'bilac' }));
                              }}
                              className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-0.5 text-[10px] font-semibold text-gray-500 hover:text-red-600 bg-gray-100 hover:bg-red-50 rounded"
                            >
                              Limpiar
                            </button>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-500">
                          💡 Enlaces de <strong>Google Drive</strong> o <strong>Dropbox</strong> se convierten automáticamente en enlaces directos de imagen.
                        </p>
                      </div>
                    )}

                    {/* Upload Input */}
                    {imageInputMode === 'upload' && (
                      <div className="space-y-2">
                        {/* Hidden file input */}
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleFileUpload}
                          className="hidden"
                        />

                        {/* Interactive Drag and Drop Upload Zone */}
                        <div
                          onDragOver={(e) => {
                            e.preventDefault();
                            setIsDragOverImage(true);
                          }}
                          onDragLeave={() => setIsDragOverImage(false)}
                          onDrop={handleImageDrop}
                          onPaste={handleImagePaste}
                          onClick={() => fileInputRef.current?.click()}
                          tabIndex={0}
                          className={`border-2 border-dashed rounded-xl p-3 sm:p-4 text-center cursor-pointer transition-all duration-150 focus:outline-hidden focus:ring-2 focus:ring-blue-500 ${
                            isDragOverImage
                              ? 'border-blue-500 bg-blue-50/80 scale-[1.01]'
                              : 'border-blue-300/80 hover:border-blue-500 hover:bg-blue-50/40 bg-slate-50/60'
                          }`}
                        >
                          {isProcessingImage ? (
                            <div className="flex flex-col items-center justify-center py-2 text-blue-700">
                              <Loader2 className="w-6 h-6 animate-spin mb-1 text-blue-600" />
                              <span className="text-xs font-bold">Optimizando y reduciendo imagen...</span>
                              <span className="text-[10px] text-blue-500">Asegurando que pese menos de 70KB para guardado instantáneo</span>
                            </div>
                          ) : formData.imageUrl && formData.imageUrl.startsWith('data:image') ? (
                            <div className="flex items-center justify-between gap-3 text-left">
                              <div className="flex items-center gap-2.5">
                                <div className="w-12 h-12 rounded-lg bg-white border border-gray-200 overflow-hidden flex items-center justify-center flex-shrink-0 p-1 shadow-2xs">
                                  <img
                                    src={formData.imageUrl}
                                    alt="Subida"
                                    className="max-h-full max-w-full object-contain"
                                  />
                                </div>
                                <div>
                                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                    Foto cargada y lista para guardar
                                  </span>
                                  {imageOptimizationInfo && (
                                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/80 block mt-0.5">
                                      {imageOptimizationInfo.compressedSize} (Optimizada desde {imageOptimizationInfo.originalSize})
                                    </span>
                                  )}
                                  <span className="text-[9.5px] text-gray-500 block mt-0.5">
                                    Haz clic o arrastra otra imagen para reemplazarla
                                  </span>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFormData((prev) => ({ ...prev, imageUrl: 'bilac' }));
                                  setImageOptimizationInfo(null);
                                  setImageInputMode('preset');
                                }}
                                className="px-2.5 py-1 text-[11px] font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors flex-shrink-0"
                              >
                                Quitar foto
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center py-1">
                              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mb-1.5 shadow-2xs">
                                <ImagePlus className="w-4 h-4" />
                              </div>
                              <span className="text-xs font-bold text-slate-800">
                                Haz clic aquí o arrastra una imagen desde tu equipo
                              </span>
                              <span className="text-[10.5px] text-slate-500 mt-0.5">
                                Admite fotos de cámara, JPG, PNG o WEBP. También puedes presionar <kbd className="px-1 py-0.2 bg-white rounded border border-gray-300 font-mono text-[9px]">Ctrl+V</kbd>
                              </span>
                            </div>
                          )}
                        </div>

                        {imageErrorNotice && (
                          <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-red-600 flex-shrink-0" />
                            <span>{imageErrorNotice}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* SKU, Barcode and Description */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block font-bold text-slate-800 mb-1">Código SKU</label>
                      <input
                        type="text"
                        value={formData.sku || ''}
                        onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                        placeholder="Ej: LAC-BIL-180"
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-800 mb-1 flex items-center gap-1">
                        <Barcode className="w-3.5 h-3.5 text-blue-600" />
                        <span>Código de Barras (EAN)</span>
                      </label>
                      <input
                        type="text"
                        value={formData.barcode || ''}
                        onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                        placeholder="Ej: 7701234567890"
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600 focus:outline-hidden font-mono"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block font-bold text-slate-800 mb-1">Descripción</label>
                      <input
                        type="text"
                        value={formData.description || ''}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Detalles sobre presentación, sabor o contenido"
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  {/* Destacado toggle */}
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="input-featured-product"
                      checked={formData.featured}
                      onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="input-featured-product" className="font-semibold text-slate-800 cursor-pointer">
                      Mostrar como producto destacado en la parte superior del catálogo
                    </label>
                  </div>
                </div>

                {/* Error Banner if Save Failed */}
                {saveErrorNotice && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                    <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
                    <span>{saveErrorNotice}</span>
                  </div>
                )}

                {/* Form Buttons */}
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('list');
                      if (onClearInitialEditProduct) {
                        onClearInitialEditProduct();
                      }
                    }}
                    disabled={isSavingProduct || isProcessingImage}
                    className="px-4 py-2.5 bg-gray-200 hover:bg-gray-300 disabled:opacity-60 text-gray-800 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingProduct || isProcessingImage}
                    className="px-6 py-2.5 bg-[#0B4EA2] hover:bg-[#093e82] disabled:bg-blue-400 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-md transition-colors"
                  >
                    {isSavingProduct ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Guardando en la nube...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>{editingId ? 'Guardar Cambios' : 'Crear Producto'}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Right Column: Live Visual Card Preview (4 cols) */}
              <div className="lg:col-span-4 flex flex-col items-center">
                <div className="w-full bg-slate-100 rounded-xl p-3 border border-slate-200 mb-3 text-center">
                  <span className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center justify-center gap-1">
                    <Eye className="w-3.5 h-3.5" />
                    Vista Previa en Tienda
                  </span>
                </div>

                {/* The actual product card mockup */}
                <div className="w-full max-w-[240px] bg-white rounded-2xl border border-gray-200 p-3 shadow-md flex flex-col justify-between">
                  <div className="w-full h-36 bg-gradient-to-b from-gray-50 to-gray-100/50 rounded-xl flex items-center justify-center p-2 overflow-hidden">
                    <ProductVisual
                      type={formData.imageUrl}
                      name={formData.name || 'NOMBRE PRODUCTO'}
                    />
                  </div>

                  <div className="mt-2 text-center space-y-1">
                    <h4 className="text-xs font-bold text-slate-900 uppercase line-clamp-2 min-h-[32px]">
                      {formData.name || 'NOMBRE DEL PRODUCTO'}
                    </h4>

                    {formData.hasPromotion !== false && Boolean(formData.promoBadge && formData.promoBadge.trim()) ? (
                      <div className="bg-[#D8F3DC] text-[#1E7E34] text-[10px] font-semibold px-2 py-1 rounded-md text-center leading-tight line-clamp-2 border border-[#B7E4C7]/60">
                        {formData.promoBadge}
                      </div>
                    ) : (
                      <div className="text-[10px] text-gray-400 italic py-1">
                        (Sin zona verde)
                      </div>
                    )}

                    <div className="text-[11px] text-gray-500 font-medium">
                      {formData.packaging || 'Empaque x Cantidad'}
                    </div>

                    <div className="flex items-center justify-center gap-1.5 pt-1">
                      <span className="text-[#0B5CAB] font-extrabold text-sm">
                        ${Number(formData.price || 0).toLocaleString('es-CO')}COP
                      </span>
                      {formData.originalPrice && formData.originalPrice > formData.price && (
                        <span className="line-through text-gray-400 text-[11px]">
                          ${Number(formData.originalPrice).toLocaleString('es-CO')}COP
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-center gap-2 pt-2 border-t border-gray-100 mt-2">
                      <div className="w-7 h-7 rounded bg-gray-200 text-gray-800 flex items-center justify-center text-xs font-bold">
                        -
                      </div>
                      <span className="text-xs font-bold text-slate-800">1</span>
                      <div className="w-7 h-7 rounded bg-black text-white flex items-center justify-center text-xs font-bold">
                        +
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TAB 3: CATEGORIES MANAGEMENT */}
          {activeTab === 'categories' && (
            <div className="max-w-3xl mx-auto space-y-6">
              
              {/* Header explanation */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                <Layers className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-blue-900">
                  <h4 className="font-extrabold text-sm text-blue-950 mb-0.5">Gestión de Categorías</h4>
                  <p className="leading-relaxed text-blue-800">
                    Crea, modifica el nombre, reordena o elimina las categorías del catálogo. Al renombrar una categoría, los productos asociados se actualizarán automáticamente.
                  </p>
                </div>
              </div>

              {categoryError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <span>{categoryError}</span>
                </div>
              )}

              {/* Add Category Form */}
              <form onSubmit={handleAddCategory} className="bg-white border border-gray-200 rounded-xl p-4 shadow-xs">
                <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-emerald-600" />
                  Crear Nueva Categoría
                </h4>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={newCategoryInput}
                    onChange={(e) => {
                      setNewCategoryInput(e.target.value);
                      if (categoryError) setCategoryError(null);
                    }}
                    placeholder="Ej: Licores, Aseo Personal, Congelados..."
                    className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-xs font-medium focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#0B4EA2] hover:bg-[#093e82] text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 flex-shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Agregar</span>
                  </button>
                </div>
              </form>

              {/* Categories List */}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs">
                <div className="px-4 py-3 bg-slate-50 border-b border-gray-200 flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-700">
                    Categorías Activas ({categories.length})
                  </span>
                  <button
                    type="button"
                    onClick={handleResetCategoriesToDefault}
                    className="text-[11px] font-semibold text-gray-500 hover:text-red-600 flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Restaurar Predeterminadas
                  </button>
                </div>

                <div className="divide-y divide-gray-100">
                  {categories.map((cat, index) => {
                    const count = products.filter((p) => p.category === cat).length;
                    const isEditing = editingCategoryIndex === index;

                    return (
                      <div
                        key={cat + index}
                        className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-gray-50/80 transition-colors"
                      >
                        {/* Category Name or Inline Editor */}
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <span className="w-6 text-center text-xs font-mono text-gray-400 font-bold">
                            #{index + 1}
                          </span>

                          {isEditing ? (
                            <div className="flex items-center gap-2 flex-1 max-w-sm">
                              <input
                                type="text"
                                autoFocus
                                value={editCategoryName}
                                onChange={(e) => setEditCategoryName(e.target.value)}
                                className="px-2.5 py-1 bg-white border border-blue-500 rounded text-xs font-bold text-slate-900 w-full focus:outline-hidden"
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveRenameCategory(index)}
                                className="px-2.5 py-1 bg-emerald-600 text-white rounded text-xs font-bold hover:bg-emerald-700"
                              >
                                Guardar
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingCategoryIndex(null)}
                                className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300"
                              >
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 truncate">
                              <span className="font-bold text-slate-900 text-xs sm:text-sm truncate">
                                {cat}
                              </span>
                              <span className="bg-blue-50 text-[#0B4EA2] text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-blue-100">
                                {count} {count === 1 ? 'producto' : 'productos'}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Reorder and Action Buttons */}
                        {!isEditing && (
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {/* Move Up */}
                            <button
                              type="button"
                              disabled={index === 0}
                              onClick={() => handleMoveCategory(index, 'up')}
                              className="p-1 text-gray-400 hover:text-slate-800 disabled:opacity-30 disabled:pointer-events-none rounded hover:bg-gray-200"
                              title="Mover arriba en el menú"
                            >
                              <ArrowUp className="w-4 h-4" />
                            </button>

                            {/* Move Down */}
                            <button
                              type="button"
                              disabled={index === categories.length - 1}
                              onClick={() => handleMoveCategory(index, 'down')}
                              className="p-1 text-gray-400 hover:text-slate-800 disabled:opacity-30 disabled:pointer-events-none rounded hover:bg-gray-200"
                              title="Mover abajo en el menú"
                            >
                              <ArrowDown className="w-4 h-4" />
                            </button>

                            {/* Rename */}
                            <button
                              type="button"
                              onClick={() => handleStartRenameCategory(index)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg ml-1"
                              title="Renombrar categoría"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete */}
                            <button
                              type="button"
                              onClick={() => handleDeleteCategory(cat)}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                              title="Eliminar categoría"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: BRANDING & TITLE IMAGE MANAGEMENT */}
          {activeTab === 'branding' && (
            <div className="max-w-3xl mx-auto space-y-6">
              
              {/* Header Guide */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                <ImageIcon className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-blue-900">
                  <h4 className="font-extrabold text-sm text-blue-950 mb-0.5">Identidad Visual y Logo de Cabecera</h4>
                  <p className="leading-relaxed text-blue-800">
                    Sube una imagen de tu logotipo para que aparezca en el título superior de la página en lugar del texto predeterminado. También puedes modificar el nombre comercial y el dominio que ven los clientes.
                  </p>
                </div>
              </div>

              {/* Live Preview Box */}
              <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs">
                <div className="text-xs font-black text-slate-700 uppercase tracking-wider mb-3 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Eye className="w-4 h-4 text-blue-600" />
                    Vista Previa del Encabezado
                  </span>
                  {brandForm.logoUrl && (
                    <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-bold">
                      Logo Activo
                    </span>
                  )}
                </div>

                {/* Simulated Header Bar */}
                <div className="bg-white border border-gray-200 rounded-xl p-3.5 shadow-inner flex items-center justify-between">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                    ←
                  </div>

                  {/* Brand Preview */}
                  <div className="flex flex-col items-center justify-center text-center max-w-[280px]">
                    {brandForm.logoUrl ? (
                      <div className="flex flex-col items-center">
                        <img
                          src={brandForm.logoUrl}
                          alt={brandForm.name}
                          className="max-h-10 sm:max-h-12 max-w-[200px] object-contain"
                          referrerPolicy="no-referrer"
                        />
                        {brandForm.subtitle && (
                          <span className="text-[9px] font-semibold text-gray-400 tracking-wider mt-0.5">
                            {brandForm.subtitle}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center">
                        <div className="flex items-center gap-1.5">
                          <span className="font-black text-xl sm:text-2xl tracking-tight text-[#0B4EA2] font-sans uppercase">
                            {brandForm.name.split(' ')[0] || 'AYM'}
                          </span>
                          <span className="bg-[#0B4EA2] text-white text-[9px] sm:text-xs font-extrabold px-1.5 py-0.5 rounded tracking-wide uppercase">
                            {brandForm.name.split(' ').slice(1).join(' ') || 'Distribuciones'}
                          </span>
                        </div>
                        {brandForm.subtitle && (
                          <span className="text-[9px] font-semibold text-gray-400 tracking-wider mt-0.5">
                            {brandForm.subtitle}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 text-xs">
                      🔍
                    </div>
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 text-xs">
                      🛒
                    </div>
                  </div>
                </div>
              </div>

              {/* Logo Upload & Configuration Form */}
              <form onSubmit={handleSaveBranding} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs space-y-4 text-xs">
                
                {/* 1. Logo Upload / URL Selector */}
                <div className="space-y-2">
                  <label className="block font-bold text-slate-800 text-xs">
                    Subir Imagen del Logo / Título
                  </label>

                  <div className="flex items-center gap-2 pb-1">
                    <button
                      type="button"
                      onClick={() => setLogoInputMode('upload')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                        logoInputMode === 'upload'
                          ? 'bg-[#0B4EA2] text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Subir Archivo desde Computador / Celular
                    </button>
                    <button
                      type="button"
                      onClick={() => setLogoInputMode('url')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                        logoInputMode === 'url'
                          ? 'bg-[#0B4EA2] text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      <LinkIcon className="w-3.5 h-3.5" />
                      Ingresar URL de Imagen
                    </button>
                  </div>

                  {logoInputMode === 'upload' ? (
                    <div className="border-2 border-dashed border-gray-300 hover:border-blue-500 rounded-xl p-6 text-center bg-gray-50/50 hover:bg-blue-50/30 transition-all cursor-pointer relative">
                      <input
                        type="file"
                        accept="image/png, image/jpeg, image/webp, image/svg+xml"
                        onChange={handleLogoFileUpload}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                      <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="font-bold text-slate-800 text-xs">
                        Haz clic o arrastra una imagen de logotipo aquí
                      </p>
                      <p className="text-[11px] text-gray-400 mt-1">
                        Formatos: PNG, JPG, WEBP, SVG (Recomendado: fondo transparente, hasta 2MB)
                      </p>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={logoUrlInput}
                        onChange={(e) => {
                          setLogoUrlInput(e.target.value);
                          setBrandForm((prev) => ({ ...prev, logoUrl: e.target.value }));
                        }}
                        placeholder="https://tu-sitio.com/logo.png"
                        className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-xs focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                      />
                    </div>
                  )}

                  {brandForm.logoUrl && (
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-emerald-600 font-semibold">
                        ✓ Logo cargado correctamente
                      </span>
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="text-[11px] font-bold text-red-600 hover:underline flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        Eliminar Logo y usar Texto
                      </button>
                    </div>
                  )}
                </div>

                {/* 2. Store Text Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-gray-200">
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      Nombre Comercial de la Empresa / Tienda
                    </label>
                    <input
                      type="text"
                      required
                      value={brandForm.name}
                      onChange={(e) => setBrandForm({ ...brandForm, name: e.target.value })}
                      placeholder="AYM Distribuciones"
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      Subtítulo / Dominio Web
                    </label>
                    <input
                      type="text"
                      value={brandForm.subtitle}
                      onChange={(e) => setBrandForm({ ...brandForm, subtitle: e.target.value })}
                      placeholder="aym-distribuciones.verse.app"
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      Número de WhatsApp (para recepción de pedidos)
                    </label>
                    <input
                      type="text"
                      required
                      value={brandForm.whatsappNumber || ''}
                      onChange={(e) => setBrandForm({ ...brandForm, whatsappNumber: e.target.value })}
                      placeholder="Ej. 3113986110"
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                    />
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={handleResetBranding}
                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-xs flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restaurar Predeterminado</span>
                  </button>

                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-[#0B4EA2] hover:bg-[#093e82] text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-md transition-colors"
                  >
                    <Save className="w-4 h-4" />
                    <span>Guardar Cambios de Identidad</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 5: EXCEL IMPORT & EXPORT HUB */}
          {activeTab === 'excel' && (
            <div className="space-y-5">
              {/* Header Banner */}
              <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-emerald-900 rounded-2xl p-5 text-white shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white shadow-inner flex-shrink-0">
                    <FileSpreadsheet className="w-7 h-7 text-emerald-300" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                      Importar y Exportar por Excel
                      <span className="text-[10px] uppercase font-bold bg-emerald-500/30 text-emerald-200 px-2 py-0.5 rounded-full border border-emerald-400/30">
                        .XLSX & CSV
                      </span>
                    </h2>
                    <p className="text-xs text-emerald-100/80 mt-0.5">
                      Edita masivamente precios, inventarios, empaques y categorías en Microsoft Excel o Google Sheets.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="px-4 py-2 bg-white text-emerald-900 hover:bg-emerald-50 font-bold rounded-xl text-xs flex items-center gap-2 shadow-sm transition-all flex-shrink-0 active:scale-95"
                >
                  <Download className="w-4 h-4 text-emerald-700" />
                  <span>Descargar Plantilla Oficial (.xlsx)</span>
                </button>
              </div>

              {/* Action Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                {/* 1. EXPORT CARD */}
                <div className="bg-white border border-emerald-200/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                          <FileDown className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 text-sm">Exportar Catálogo a Excel</h3>
                          <p className="text-[11px] text-gray-500">Genera una hoja de cálculo con formato y fórmulas</p>
                        </div>
                      </div>
                      <span className="text-xs font-black bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full">
                        {products.length} productos
                      </span>
                    </div>

                    <div className="space-y-2.5 my-4 text-xs text-slate-600">
                      <div className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>Columnas completas con nombres, precios actuales y precios anteriores.</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>Incluye empaques, descuentos, claves de imagen, SKU y existencias.</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>Celdas con formato monetario y encabezados fijados listos para imprimir o compartir.</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleExportExcel}
                    disabled={isExportingExcel}
                    className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-98"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>{isExportingExcel ? 'Generando archivo Excel...' : 'Descargar Catálogo Completo (.xlsx)'}</span>
                  </button>
                </div>

                {/* 2. IMPORT CARD */}
                <div className="bg-white border border-emerald-200/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
                          <FileUp className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 text-sm">Importar Productos desde Excel</h3>
                          <p className="text-[11px] text-gray-500">Carga archivos .xlsx, .xls o .csv directamente</p>
                        </div>
                      </div>
                    </div>

                    {/* Drag & Drop Area */}
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setExcelDragOver(true);
                      }}
                      onDragLeave={() => setExcelDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setExcelDragOver(false);
                        const file = e.dataTransfer.files?.[0];
                        if (file) handleSelectExcelFile(file);
                      }}
                      className={`my-3 border-2 border-dashed rounded-xl p-5 text-center transition-all cursor-pointer relative ${
                        excelDragOver
                          ? 'border-emerald-500 bg-emerald-50'
                          : 'border-gray-300 hover:border-emerald-500 bg-gray-50/50 hover:bg-emerald-50/30'
                      }`}
                    >
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
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                      <FileSpreadsheet className="w-8 h-8 text-emerald-600 mx-auto mb-1.5" />
                      <p className="font-bold text-slate-800 text-xs">
                        Haz clic para seleccionar o arrastra tu archivo Excel aquí
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        Soporta archivos .xlsx, .xls y .csv
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDownloadTemplate}
                      className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5 text-gray-500" />
                      <span>Descargar Plantilla</span>
                    </button>
                    <label className="flex-1 py-2.5 bg-[#0B4EA2] hover:bg-[#093e82] text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition-colors text-center">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Seleccionar Archivo</span>
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

                {/* 3. EXPORT IMAGES CARD */}
                <div className="bg-white border border-indigo-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4 md:col-span-2">
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-gray-100 flex-wrap gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700">
                          <Images className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                            <span>Exportar Imágenes del Catálogo</span>
                            <span className="text-[10px] bg-indigo-100 text-indigo-800 font-black px-2 py-0.5 rounded-full">
                              Paquete ZIP & Galería
                            </span>
                          </h3>
                          <p className="text-[11px] text-gray-500">
                            Descarga un archivo comprimido (.ZIP) con todas las imágenes, galería offline y listado de enlaces
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-black bg-indigo-100 text-indigo-900 px-3 py-1 rounded-full">
                        {products.length} productos
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-4 text-xs text-slate-600">
                      <div className="flex items-start gap-2 bg-indigo-50/40 p-2.5 rounded-xl border border-indigo-100/80">
                        <Check className="w-4 h-4 text-indigo-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="font-bold text-slate-900 block">Archivos Organizados</span>
                          <span className="text-[11px] text-slate-600">Nombrados automáticamente con SKU o código y nombre de cada producto.</span>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 bg-indigo-50/40 p-2.5 rounded-xl border border-indigo-100/80">
                        <Check className="w-4 h-4 text-indigo-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="font-bold text-slate-900 block">Galería Offline Interactiva</span>
                          <span className="text-[11px] text-slate-600">Incluye archivo HTML visual para ver todo tu catálogo sin internet.</span>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 bg-indigo-50/40 p-2.5 rounded-xl border border-indigo-100/80">
                        <Check className="w-4 h-4 text-indigo-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="font-bold text-slate-900 block">Índice CSV y Enlaces</span>
                          <span className="text-[11px] text-slate-600">Incluye tabla de mapeo CSV y archivo de texto con las URLs directas.</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleExportImages}
                      disabled={isExportingImages}
                      className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-50"
                    >
                      <Images className="w-4 h-4" />
                      <span>{isExportingImages ? 'Generando paquete ZIP de imágenes...' : 'Descargar Paquete de Imágenes (.ZIP)'}</span>
                    </button>
                  </div>
                </div>

              </div>

              {/* Column Structure Reference Guide */}
              <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs">
                <h3 className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-2 mb-3">
                  <Table className="w-4 h-4 text-indigo-600" />
                  Estructura de Columnas para el Archivo Excel
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-bold text-[10.5px] uppercase border-b border-gray-200">
                      <tr>
                        <th className="py-2 px-3">Columna</th>
                        <th className="py-2 px-3">Requerido</th>
                        <th className="py-2 px-3">Descripción</th>
                        <th className="py-2 px-3">Ejemplo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-[11px] text-gray-600">
                      <tr>
                        <td className="py-2 px-3 font-bold text-slate-900">Nombre del Producto</td>
                        <td className="py-2 px-3"><span className="text-red-600 font-bold">Sí</span></td>
                        <td className="py-2 px-3">Nombre comercial que verán los clientes</td>
                        <td className="py-2 px-3 text-gray-500">Café Tostao Intenso 40g</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-bold text-slate-900">Categoría</td>
                        <td className="py-2 px-3"><span className="text-red-600 font-bold">Sí</span></td>
                        <td className="py-2 px-3">Categoría (si no existe, se creará automáticamente)</td>
                        <td className="py-2 px-3 text-gray-500">Café, Lácteos, Bebidas</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-bold text-slate-900">Precio de Costo</td>
                        <td className="py-2 px-3"><span className="text-gray-400">Opcional</span></td>
                        <td className="py-2 px-3">Precio de adquisición o compra para calcular utilidades</td>
                        <td className="py-2 px-3 text-gray-500">1900</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-bold text-slate-900">Precio de Venta</td>
                        <td className="py-2 px-3"><span className="text-red-600 font-bold">Sí</span></td>
                        <td className="py-2 px-3">Precio mayorista de venta en pesos colombianos</td>
                        <td className="py-2 px-3 text-gray-500">2500</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-bold text-slate-900">Precio Original</td>
                        <td className="py-2 px-3"><span className="text-gray-400">Opcional</span></td>
                        <td className="py-2 px-3">Precio anterior para mostrar descuento tachado</td>
                        <td className="py-2 px-3 text-gray-500">3200</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-bold text-slate-900">Presentación / Empaque</td>
                        <td className="py-2 px-3"><span className="text-gray-400">Opcional</span></td>
                        <td className="py-2 px-3">Tipo de presentación o empaque</td>
                        <td className="py-2 px-3 text-gray-500">Caja x 12, Pack x 6</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-bold text-slate-900">Etiqueta Promocional</td>
                        <td className="py-2 px-3"><span className="text-gray-400">Opcional</span></td>
                        <td className="py-2 px-3">Texto del banner de promoción</td>
                        <td className="py-2 px-3 text-gray-500">20.00% de descuento</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-bold text-slate-900">Imagen / Clave</td>
                        <td className="py-2 px-3"><span className="text-gray-400">Opcional</span></td>
                        <td className="py-2 px-3">URL o clave visual (bilac, tostao-intenso, speedmax, etc.)</td>
                        <td className="py-2 px-3 text-gray-500">https://... o bilac</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: CLOUD ORDERS */}
          {activeTab === 'orders' && <OrdersAdminTab branding={branding} />}

          {/* TAB 7: CUSTOMERS & CLIENT DATABASE */}
          {activeTab === 'customers' && <CustomersAdminTab />}

          {/* TAB 8: MONTHLY UNSOLD PRODUCTS & INVENTORY ROTATION REPORT */}
          {activeTab === 'unsold_report' && (
            <UnsoldProductsAdminTab
              products={products}
              categories={categories}
              onEditProduct={(prod) => {
                handleStartEdit(prod);
              }}
            />
          )}

          {/* TAB 9: ADMINISTRATORS & MULTI-USER MANAGEMENT */}
          {activeTab === 'admins' && (
            <AdminsAdminTab
              admins={admins}
              currentAdmin={currentAdmin}
              onSaveAdmin={handleSaveAdmin}
              onDeleteAdmin={handleDeleteAdmin}
            />
          )}

          {/* TAB 10: LOCAL IN-CODE DATABASE */}
          {activeTab === 'local_database' && (
            <LocalDatabaseAdminTab
              products={products}
              categories={categories}
              branding={branding}
              dataMode={dataMode}
              onToggleDataMode={onToggleDataMode}
              onRefreshProducts={async () => {
                const fresh = await getLocalProductsAsync();
                if (fresh && fresh.length > 0) {
                  onImportProducts(fresh, 'replace');
                }
              }}
              onSuccessNotice={(msg) => {
                setSaveSuccessNotice(msg);
                setTimeout(() => setSaveSuccessNotice(null), 4000);
              }}
            />
          )}

        </div>

        {/* EXCEL IMPORT CONFIRMATION & PREVIEW MODAL */}
        {showExcelImportModal && excelImportResult && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-gray-200 animate-in zoom-in-95">
              
              {/* Header */}
              <div className="bg-slate-900 text-white p-4 px-5 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white">Confirmar Importación de Excel</h3>
                    <p className="text-[11px] text-slate-300">
                      Archivo: <span className="font-semibold text-emerald-300">{excelImportFile?.name}</span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowExcelImportModal(false)}
                  className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
                
                {/* Stats Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5">
                    <span className="text-[10px] uppercase font-bold text-emerald-800 block">Productos Válidos</span>
                    <span className="text-lg font-black text-emerald-700">{excelImportResult.validRows}</span>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-2.5">
                    <span className="text-[10px] uppercase font-bold text-blue-800 block">Nuevas Categorías</span>
                    <span className="text-lg font-black text-blue-700">{excelImportResult.newCategories.length}</span>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                    <span className="text-[10px] uppercase font-bold text-slate-600 block">Total Filas</span>
                    <span className="text-lg font-black text-slate-800">{excelImportResult.totalRows}</span>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5">
                    <span className="text-[10px] uppercase font-bold text-amber-800 block">Catálogo Actual</span>
                    <span className="text-lg font-black text-amber-700">{products.length}</span>
                  </div>
                </div>

                {/* New Categories Notice */}
                {excelImportResult.newCategories.length > 0 && (
                  <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl text-blue-900">
                    <span className="font-bold block mb-1">
                      ✨ Nuevas categorías detectadas (se añadirán al catálogo automáticamente):
                    </span>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {excelImportResult.newCategories.map((cat, idx) => (
                        <span key={idx} className="bg-white border border-blue-300 text-blue-800 px-2 py-0.5 rounded-full font-bold text-[10px]">
                          + {cat}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Mode Selector */}
                <div className="space-y-2">
                  <label className="font-bold text-slate-900 block text-xs">
                    ¿Cómo deseas procesar los productos importados?
                  </label>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div
                      onClick={() => setExcelImportMode('merge')}
                      className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
                        excelImportMode === 'merge'
                          ? 'border-emerald-600 bg-emerald-50/60 shadow-xs'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-bold text-slate-900">
                        <input
                          type="radio"
                          name="importMode"
                          checked={excelImportMode === 'merge'}
                          onChange={() => setExcelImportMode('merge')}
                          className="text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>Fusionar y Actualizar (Recomendado)</span>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-1 pl-5">
                        Actualiza precios y datos de productos existentes (por ID o nombre) y agrega los productos nuevos.
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
                          name="importMode"
                          checked={excelImportMode === 'replace'}
                          onChange={() => setExcelImportMode('replace')}
                          className="text-red-600 focus:ring-red-500"
                        />
                        <span>Reemplazar Todo el Catálogo</span>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-1 pl-5">
                        Borra todos los productos actuales y los reemplaza únicamente por los del archivo Excel.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Image Protection Toggle */}
                <div
                  onClick={() => setPreserveExistingImages(!preserveExistingImages)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
                    preserveExistingImages
                      ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950 shadow-2xs'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100/80'
                  }`}
                >
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preserveExistingImages}
                      onChange={(e) => setPreserveExistingImages(e.target.checked)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                          <span>🛡️ Conservar y proteger fotos e imágenes existentes</span>
                        </span>
                        <span className="text-[10px] bg-emerald-200/90 text-emerald-900 px-2 py-0.5 rounded-full font-black">
                          {preserveExistingImages ? 'Activo (Protegido)' : 'Inactivo'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                        Los productos existentes que ya tienen foto asignada en el catálogo <strong>no perderán su imagen</strong>. Si en el archivo Excel la columna de imagen viene vacía o con el valor por defecto, se conservará intacta la imagen que ya tenía el producto.
                      </p>
                    </div>
                  </label>
                </div>

                {/* Preview of first rows */}
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-100 px-3 py-2 border-b border-gray-200 font-bold text-slate-700 flex justify-between items-center text-[11px]">
                    <span>Vista previa (primeros 5 productos detectados):</span>
                    <span className="text-gray-500 font-normal">Mostrando {Math.min(5, excelImportResult.products.length)} de {excelImportResult.products.length}</span>
                  </div>
                  <div className="divide-y divide-gray-100 max-h-44 overflow-y-auto">
                    {excelImportResult.products.slice(0, 5).map((p, idx) => (
                      <div key={idx} className="p-2.5 flex items-center justify-between text-xs hover:bg-gray-50">
                        <div>
                          <span className="font-bold text-slate-900 block">{p.name}</span>
                          <span className="text-[10px] text-gray-500">
                            {p.category} • {p.packaging}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-black text-[#0B4EA2] block">
                            ${p.price.toLocaleString('es-CO')} COP
                          </span>
                          {p.promoBadge && (
                            <span className="text-[9px] text-emerald-700 font-bold">
                              🏷️ {p.promoBadge}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* Footer */}
              <div className="bg-gray-50 px-5 py-3 border-t border-gray-200 flex items-center justify-between flex-shrink-0">
                <button
                  type="button"
                  disabled={isImportingProducts}
                  onClick={() => setShowExcelImportModal(false)}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-xl text-xs disabled:opacity-50"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  disabled={isImportingProducts}
                  onClick={handleConfirmExcelImport}
                  className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-md transition-all active:scale-95 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>
                    {isImportingProducts
                      ? 'Guardando productos en la nube...'
                      : `Confirmar e Importar ${excelImportResult.products.length.toLocaleString('es-CO')} Productos`}
                  </span>
                </button>
              </div>

            </div>
          </div>
        )}

        {/* PERSISTENT FULL-SCREEN BULK IMPORT PROGRESS & ANTI-ACCIDENTAL CLOSE MODAL */}
        {isImportingProducts && importProgress && (
          <div className="fixed inset-0 z-[100] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in select-none">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 text-center space-y-6 animate-in zoom-in-95">
              
              {/* Database Pulsing Animation */}
              <div className="relative mx-auto w-20 h-20 flex items-center justify-center">
                <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping" />
                <div className="w-20 h-20 bg-gradient-to-tr from-emerald-600 to-teal-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/30">
                  <Database className="w-10 h-10 animate-bounce" />
                </div>
              </div>

              {/* Title and Protection Alert */}
              <div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">
                  Sincronizando con la Base de Datos
                </h3>
                <p className="text-xs text-amber-700 font-bold bg-amber-50 border border-amber-200 rounded-xl py-2 px-3 mt-2.5 flex items-center justify-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-600" />
                  <span>Por favor, no cierres esta pestaña ni recargues el navegador</span>
                </p>
              </div>

              {/* Progress Visuals */}
              <div className="space-y-2 bg-slate-50 border border-slate-200/80 rounded-2xl p-4">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>Progreso de carga</span>
                  <span className="text-emerald-700 font-mono text-sm font-black">{importProgress.percent}%</span>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-3.5 bg-slate-200 rounded-full overflow-hidden p-0.5">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-300 shadow-inner"
                    style={{ width: `${Math.max(4, importProgress.percent)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                  <span>{importProgress.processed.toLocaleString('es-CO')} de {importProgress.total.toLocaleString('es-CO')} productos</span>
                  <span className="font-semibold text-slate-700">{importProgress.percent === 100 ? 'Completado' : 'Subiendo en lotes...'}</span>
                </div>
              </div>

              {/* Status Step Description */}
              <div className="text-xs font-medium text-slate-600 bg-emerald-50/70 border border-emerald-200/60 rounded-xl py-2.5 px-3 flex items-center justify-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
                <span className="truncate">{importProgress.message}</span>
              </div>

              {/* Safeguard Badges */}
              <div className="grid grid-cols-2 gap-2 text-[10.5px] text-slate-500 font-semibold pt-1">
                <div className="bg-slate-100/80 rounded-lg py-1.5 px-2">
                  🔒 Protección de cierre activa
                </div>
                <div className="bg-slate-100/80 rounded-lg py-1.5 px-2">
                  ⚡ Lotes optimizados
                </div>
              </div>

            </div>
          </div>
        )}

        {/* CLEAR ALL PRODUCTS CONFIRMATION MODAL */}
        {showClearAllConfirm && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-red-200 animate-in zoom-in-95 space-y-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600 mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="text-center">
                <h3 className="text-base font-black text-slate-900">¿Vaciar catálogo de productos?</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Se eliminarán todos los <strong className="text-slate-800">{products.length} productos</strong> existentes en la nube de forma permanente. Podrás importar nuevos productos desde Excel en cualquier momento.
                </p>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowClearAllConfirm(false)}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleClearAllCatalog}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Sí, vaciar catálogo</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* IMAGE EXPORT MODAL (PROGRESS & COMPLETED SUMMARY) */}
        {showImageExportModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-indigo-200 animate-in zoom-in-95 space-y-5 text-center">
              
              {isExportingImages ? (
                <>
                  <div className="relative mx-auto w-16 h-16 flex items-center justify-center">
                    <div className="absolute inset-0 bg-indigo-500/20 rounded-2xl animate-ping" />
                    <div className="w-16 h-16 bg-gradient-to-tr from-indigo-600 to-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
                      <ImageDown className="w-8 h-8 animate-bounce" />
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-black text-slate-900 tracking-tight">
                      Empaquetando Imágenes del Catálogo
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Generando archivo comprimido .ZIP con las imágenes y galería interactiva
                    </p>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-2 bg-slate-50 border border-slate-200/80 rounded-2xl p-4">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                      <span>Procesando</span>
                      <span className="text-indigo-700 font-mono text-sm font-black">
                        {imageExportProgress?.percent ?? 0}%
                      </span>
                    </div>

                    <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden p-0.5">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full transition-all duration-200"
                        style={{ width: `${Math.max(5, imageExportProgress?.percent ?? 0)}%` }}
                      />
                    </div>

                    <div className="text-[11px] text-slate-500 text-left truncate pt-1">
                      {imageExportProgress?.message || 'Procesando imágenes...'}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-md">
                    <CheckCircle2 className="w-9 h-9" />
                  </div>

                  <div>
                    <h3 className="text-lg font-black text-slate-900 tracking-tight">
                      ¡Imágenes Exportadas Exitosamente!
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      El archivo ZIP se ha descargado a tu computadora.
                    </p>
                  </div>

                  {imageExportResult && (
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left space-y-2.5 text-xs">
                      <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                        <span className="text-slate-500 font-medium">Archivo generado:</span>
                        <span className="font-bold text-indigo-700 font-mono text-[11px] truncate max-w-[200px]">
                          {imageExportResult.zipName}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-medium">Archivos empaquetados:</span>
                        <span className="font-black text-slate-900 bg-indigo-100 text-indigo-900 px-2 py-0.5 rounded-md text-[11px]">
                          {imageExportResult.exportedImagesCount} archivos
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-medium">Total de productos:</span>
                        <span className="font-bold text-slate-800">
                          {imageExportResult.total} productos
                        </span>
                      </div>

                      <div className="pt-2 border-t border-gray-200 text-[11px] text-slate-600 space-y-1">
                        <p className="flex items-center gap-1.5 font-bold text-emerald-800">
                          <span>✓</span> Incluye galería offline (catalogo_galeria_imagenes.html)
                        </p>
                        <p className="flex items-center gap-1.5 font-bold text-emerald-800">
                          <span>✓</span> Incluye índice CSV para Excel (indice_imagenes_catalogo.csv)
                        </p>
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowImageExportModal(false)}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white font-bold rounded-xl text-xs shadow-md transition-all cursor-pointer"
                  >
                    Entendido / Cerrar
                  </button>
                </>
              )}

            </div>
          </div>
        )}

      </div>
    </div>
  );
};
