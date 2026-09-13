export interface Product {
  id: string;
  name: string;
  category: string;
  promoBadge?: string;
  hasPromotion?: boolean;
  packaging?: string;
  costPrice?: number; // Precio de costo en COP
  price: number; // Precio de venta mayorista en COP
  originalPrice?: number; // Precio regular / tachado en COP
  imageUrl: string;
  badgeType?: 'discount' | 'gift' | 'combo' | 'bonus';
  description?: string;
  sku?: string;
  barcode?: string; // Código de barras (EAN-13, UPC, etc.)
  minOrder?: number;
  stock?: number;
  featured?: boolean;
}

export interface CartItem {
  product: Product;
  quantity: number;
  returnedQuantity?: number;
}

export interface StoreBranding {
  name: string;
  subtitle: string;
  logoUrl?: string;
  whatsappNumber?: string;
}

export type Category = string;

export interface OrderCustomerInfo {
  storeName: string;
  ownerName: string;
  phone: string;
  address: string;
  city: string;
  notes: string;
  paymentMethod: 'contraentrega' | 'transferencia' | 'credito';
}

export type OrderStatus = 'pendiente' | 'confirmado' | 'en_camino' | 'entregado' | 'cancelado';

export interface OrderReturnLog {
  id: string;
  productId: string;
  productName: string;
  returnedQuantity: number;
  returnedAt: string;
  reason?: string;
  unitPrice: number;
  totalRefund: number;
}

export interface OrderRecord {
  id: string;
  orderNumber: string;
  items: CartItem[];
  customer: OrderCustomerInfo;
  totalPrice: number;
  totalItemsCount: number;
  status: OrderStatus;
  createdAt: string;
  updatedAt?: string;
  cancelledAt?: string;
  returns?: OrderReturnLog[];
}

export interface Customer {
  id: string;
  phone: string; // WhatsApp number normalized (digits only e.g. 3113986110)
  storeName: string;
  ownerName: string;
  documentType?: string;
  documentNumber?: string;
  address: string;
  neighborhood?: string;
  city: string;
  department?: string;
  paymentMethod: 'contraentrega' | 'transferencia' | 'credito';
  notes?: string;
  discountPercentage?: number;
  creditLimit?: number;
  status: 'active' | 'inactive';
  ordersCount?: number;
  totalSpent?: number;
  lastOrderAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export type AdminRole = 'superadmin' | 'admin' | 'editor';

export interface AdminUser {
  id: string;
  username: string; // login identifier (lowercase)
  name: string; // Display name e.g. "Administrador Principal"
  password: string; // Access password
  role: AdminRole; // superadmin | admin | editor
  status: 'active' | 'inactive';
  createdAt: string;
  lastLoginAt?: string;
  email?: string;
  phone?: string;
}


