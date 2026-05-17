export interface Product {
  id: string;
  barcode: string;
  sku: string;
  name: string;
  category?: string;
  brand?: string;
  color?: string;
  size?: string;
  price: number;
  currency: string;
  stock_qty: number;
  image_url?: string;
}

export interface CartItem {
  product: Product;
  qty: number;
}

export interface Category {
  id: string;
  name: string;
  count: number;
}
