import type { Category, Product } from './types';

export const mockProducts: Product[] = [
  {
    id: 'p-100',
    barcode: 'SHOPOS100',
    sku: 'MEZO-TEE-BLK-M',
    name: 'Mezo Logo Tee',
    category: 'apparel',
    brand: 'ShopOS',
    color: 'Black',
    size: 'M',
    price: 100,
    currency: 'USD',
    stock_qty: 24,
    image_url: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 'p-101',
    barcode: 'SHOPOS500',
    sku: 'MEZO-HOOD-GRN-L',
    name: 'Passport Hoodie',
    category: 'outerwear',
    brand: 'ShopOS',
    color: 'Forest',
    size: 'L',
    price: 500,
    currency: 'USD',
    stock_qty: 12,
    image_url: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 'p-102',
    barcode: 'SHOPOS1000',
    sku: 'MEZO-JKT-SLV-M',
    name: 'Hackathon Tech Jacket',
    category: 'outerwear',
    brand: 'ShopOS',
    color: 'Silver',
    size: 'M',
    price: 1000,
    currency: 'USD',
    stock_qty: 8,
    image_url: 'https://images.unsplash.com/photo-1543076447-215ad9ba6923?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 'p-103',
    barcode: 'SHOPOS200',
    sku: 'MEZO-TOTE-CRM',
    name: 'Canvas City Tote',
    category: 'bags',
    brand: 'ShopOS',
    color: 'Cream',
    size: 'One Size',
    price: 180,
    currency: 'USD',
    stock_qty: 18,
    image_url: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 'p-104',
    barcode: 'SHOPOS300',
    sku: 'MEZO-SNK-WHT-42',
    name: 'Everyday Leather Sneaker',
    category: 'shoes',
    brand: 'ShopOS',
    color: 'White',
    size: '42',
    price: 320,
    currency: 'USD',
    stock_qty: 16,
    image_url: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 'p-105',
    barcode: 'SHOPOS400',
    sku: 'MEZO-CAP-ORG',
    name: 'Orange Logo Cap',
    category: 'accessories',
    brand: 'ShopOS',
    color: 'Orange',
    size: 'Adjustable',
    price: 90,
    currency: 'USD',
    stock_qty: 30,
    image_url: 'https://images.unsplash.com/photo-1521369909029-2afed882baee?auto=format&fit=crop&w=600&q=80'
  }
];

export const mockCategories: Category[] = [
  { id: 'all', name: 'All', count: mockProducts.length },
  { id: 'apparel', name: 'Apparel', count: mockProducts.filter((product) => product.category === 'apparel').length },
  { id: 'outerwear', name: 'Outerwear', count: mockProducts.filter((product) => product.category === 'outerwear').length },
  { id: 'bags', name: 'Bags', count: mockProducts.filter((product) => product.category === 'bags').length },
  { id: 'shoes', name: 'Shoes', count: mockProducts.filter((product) => product.category === 'shoes').length },
  { id: 'accessories', name: 'Accessories', count: mockProducts.filter((product) => product.category === 'accessories').length }
];
