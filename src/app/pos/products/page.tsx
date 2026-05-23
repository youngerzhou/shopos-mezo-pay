"use client";

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, Edit2, Minus, Package, Plus, RefreshCw, Search, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { BottomSheetFrame } from '@/components/pos/checkout/BottomSheetFrame';
import { useToast } from '@/hooks/use-toast';

type Product = {
  id: string;
  barcode: string;
  sku: string;
  name: string;
  category: string | null;
  brand: string | null;
  color: string | null;
  size: string | null;
  price: number;
  currency: string;
  stock_qty: number;
  image_url: string | null;
  is_active: boolean;
};

const PRESET_IMAGES = [
  { name: 'Black Tee', url: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?q=80&w=600&auto=format&fit=crop' },
  { name: 'Green Hoodie', url: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?q=80&w=600&auto=format&fit=crop' },
  { name: 'Tech Jacket', url: 'https://images.unsplash.com/photo-1543076447-215ad9ba6923?q=80&w=600&auto=format&fit=crop' },
  { name: 'Cream Tote', url: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?q=80&w=600&auto=format&fit=crop' },
  { name: 'White Sneaker', url: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?q=80&w=600&auto=format&fit=crop' },
  { name: 'Orange Cap', url: 'https://images.unsplash.com/photo-1521369909029-2afed882baee?q=80&w=600&auto=format&fit=crop' },
  { name: 'Blue Denim', url: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?q=80&w=600&auto=format&fit=crop' },
  { name: 'Red Beanie', url: 'https://images.unsplash.com/photo-1576871337622-98d48d4353d0?q=80&w=600&auto=format&fit=crop' }
];

export default function PosProductsPage() {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Drawer Editing States
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState(0);
  const [editSku, setEditSku] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editSize, setEditSize] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [saving, setSaving] = useState(false);
  
  // Custom Interactive UI States inside Drawer
  const [showPresetImages, setShowPresetImages] = useState(false);
  const [editingField, setEditingField] = useState<'sku' | 'color' | 'size' | null>(null);
  const [inlineEditVal, setInlineEditVal] = useState('');
  
  // Touch Gesture Long-Press Helper Ref
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/products', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load products');
      setProducts(data.products || []);
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Error loading products',
        description: err.message || 'Unable to fetch the products catalog.'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openQuickEdit = (product: Product) => {
    setSelectedProduct(product);
    setEditName(product.name);
    setEditPrice(product.price);
    setEditSku(product.sku);
    setEditColor(product.color || '');
    setEditSize(product.size || '');
    setEditImageUrl(product.image_url || '');
    setShowPresetImages(false);
    setEditingField(null);
  };

  // Touch handlers for 600ms hold gesture
  const handleTouchStart = (product: Product) => {
    longPressTimerRef.current = setTimeout(() => {
      openQuickEdit(product);
      // Play a short subtle haptic or visual alert simulation
      if (navigator.vibrate) navigator.vibrate(50);
    }, 600);
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleTouchMove = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleSave = async () => {
    if (!selectedProduct) return;
    if (!editName.trim()) {
      toast({ variant: 'destructive', title: 'Validation Error', description: 'Product name cannot be empty.' });
      return;
    }
    if (editPrice < 0) {
      toast({ variant: 'destructive', title: 'Validation Error', description: 'Price cannot be negative.' });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/products/${encodeURIComponent(selectedProduct.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          price: editPrice,
          sku: editSku,
          color: editColor,
          size: editSize,
          image_url: editImageUrl
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update product');

      // Update locally in the list instantly
      setProducts(prev => prev.map(p => p.id === selectedProduct.id ? data.product : p));
      
      toast({
        title: 'Product Updated',
        description: `Product [${editName}] has been updated successfully.`
      });
      setSelectedProduct(null);
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: err.message || 'Unable to update product details.'
      });
    } finally {
      setSaving(false);
    }
  };

  // Local search filter
  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (p.category && p.category.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const startInlineEdit = (field: 'sku' | 'color' | 'size') => {
    setEditingField(field);
    if (field === 'sku') setInlineEditVal(editSku);
    if (field === 'color') setInlineEditVal(editColor);
    if (field === 'size') setInlineEditVal(editSize);
  };

  const saveInlineEdit = () => {
    if (editingField === 'sku') setEditSku(inlineEditVal);
    if (editingField === 'color') setEditColor(inlineEditVal);
    if (editingField === 'size') setEditSize(inlineEditVal);
    setEditingField(null);
  };

  return (
    <main className="min-h-screen bg-slate-50 py-6 text-slate-900 pb-safe">
      <div className="container mx-auto px-4 space-y-6">
        {/* Header Section */}
        <header className="rounded-3xl bg-white p-4 shadow-sm border border-slate-200/60 w-full">
          <div className="flex items-center gap-3">
            <Link href="/pos/admin-home">
              <Button variant="outline" size="sm" className="h-10 rounded-xl font-bold bg-white text-slate-800 border-slate-200">
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                Back
              </Button>
            </Link>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-600">POS Admin</p>
              <h1 className="text-xl font-black text-slate-950">Store Products</h1>
            </div>
          </div>

          {/* Search Box */}
          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-slate-50 px-3 py-1.5 focus-within:border-orange-500/50 transition-colors">
            <Search className="h-4 w-4 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search product name, SKU..."
              className="h-9 border-0 bg-transparent p-0 text-sm font-bold text-slate-900 shadow-none focus-visible:ring-0 focus:outline-none placeholder:text-slate-400"
            />
          </div>
        </header>

        {/* Tip Banner */}
        <div className="flex items-center gap-2.5 rounded-2xl bg-orange-50/60 border border-orange-100 p-3 text-xs font-bold text-orange-800 w-full">
          <Sparkles className="h-4 w-4 text-orange-600 shrink-0" />
          <span>Tip: Hold a product card or tap the edit icon to quick edit details.</span>
        </div>

        {/* Catalog List */}
        {loading ? (
          <div className="rounded-3xl bg-white p-12 text-center text-sm font-bold border border-slate-200/60 text-slate-500 shadow-sm w-full">
            <RefreshCw className="mx-auto mb-3 h-6 w-6 animate-spin text-orange-600/40" />
            Loading product catalog...
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="rounded-3xl bg-white p-12 text-center text-sm font-bold border border-dashed border-slate-200/80 text-slate-500 w-full">
            <Package className="mx-auto mb-3 h-8 w-8 text-slate-300" />
            No matching products found.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 pb-24">
            {filteredProducts.map((product) => (
              <article
                key={product.id}
                onTouchStart={() => handleTouchStart(product)}
                onTouchEnd={handleTouchEnd}
                onTouchMove={handleTouchMove}
                className="relative flex items-center gap-3.5 rounded-2xl border border-slate-200/60 bg-white p-3 shadow-sm select-none active:scale-[0.98] transition-all duration-200 w-full"
              >
                {/* Product Thumbnail */}
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-100 border border-slate-100 shadow-inner">
                  <img
                    src={product.image_url || 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?q=80&w=600&auto=format&fit=crop'}
                    alt={product.name}
                    className="h-full w-full object-cover"
                  />
                </div>

                {/* Details info */}
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="truncate text-sm font-extrabold text-slate-950">{product.name}</h2>
                    <span className="shrink-0 text-sm font-black text-orange-600">
                      {product.price.toFixed(2)} MUSD
                    </span>
                  </div>
                  
                  {/* Subtitle details */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-slate-500">
                    <Badge variant="outline" className="px-1.5 py-0 bg-slate-50 text-[10px] border-slate-200/80 font-mono font-bold text-slate-600">
                      {product.sku || 'NO-SKU'}
                    </Badge>
                    {product.color && <span>• {product.color}</span>}
                    {product.size && <span>• Size {product.size}</span>}
                  </div>

                  {/* Stock Quantity */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{product.category || 'General'}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      product.stock_qty <= 10 
                        ? 'bg-red-50 text-red-700 border border-red-100/60' 
                        : 'bg-emerald-50 text-emerald-800'
                    }`}>
                      Qty {product.stock_qty}
                    </span>
                  </div>
                </div>

                {/* Quick Edit Icon */}
                <button
                  type="button"
                  onClick={() => openQuickEdit(product)}
                  className="absolute bottom-2.5 right-2.5 flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-orange-50 hover:text-orange-600 active:scale-95 transition-all shadow-sm"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
              </article>
            ))}
          </div>
        )}
      </div>

      {/* Slide-Up Bottom Drawer */}
      <BottomSheetFrame open={!!selectedProduct} title="Edit Product" onOpenChange={(open) => !open && setSelectedProduct(null)}>
        {selectedProduct && (
          <div className="flex flex-col max-h-[82vh] bg-white rounded-t-[2.5rem] overflow-hidden">
            {/* Scrollable Form Body */}
            <div className="flex-1 overflow-y-auto px-5 pb-6 pt-2 space-y-5">
              
              {/* Product Header inside Drawer */}
              <div className="flex items-center gap-4 border-b border-slate-100 pb-4">
                {/* Photo Preview Clickable */}
                <div 
                  onClick={() => setShowPresetImages(!showPresetImages)}
                  className="group relative h-20 w-20 shrink-0 cursor-pointer overflow-hidden rounded-2xl border-2 border-orange-100 shadow-inner bg-slate-50 transition-all hover:border-orange-500"
                >
                  <img
                    src={editImageUrl || 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?q=80&w=600&auto=format&fit=crop'}
                    alt="Current Product"
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-[9px] font-black text-white uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">
                    Change Photo
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-orange-600">Product Profile</span>
                  <h3 className="truncate text-base font-extrabold text-slate-950 mt-0.5">{editName || 'New Product'}</h3>
                  <p className="text-xs font-mono font-bold text-slate-400 mt-0.5">Barcode: {selectedProduct.barcode}</p>
                </div>
              </div>

              {/* Quick Image Picker Library */}
              {showPresetImages && (
                <div className="space-y-2 rounded-2xl bg-slate-50 p-4 border border-slate-200/50">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Preset Photos Library</p>
                    <button type="button" onClick={() => setShowPresetImages(false)} className="text-slate-400 hover:text-slate-600">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {PRESET_IMAGES.map((img, idx) => {
                      const isSelected = editImageUrl === img.url;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setEditImageUrl(img.url);
                            setShowPresetImages(false);
                          }}
                          className={`relative aspect-square overflow-hidden rounded-xl border-2 transition-all ${
                            isSelected ? 'border-orange-600 scale-95 shadow-md' : 'border-transparent hover:border-slate-300'
                          }`}
                        >
                          <img src={img.url} alt={img.name} className="h-full w-full object-cover" />
                          {isSelected && (
                            <div className="absolute inset-0 flex items-center justify-center bg-orange-600/30">
                              <Check className="h-4 w-4 text-white drop-shadow" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Form Input fields */}
              <div className="space-y-4">
                {/* Product Name Input */}
                <div className="space-y-1.5">
                  <label htmlFor="prod-name" className="text-[10px] font-black uppercase tracking-wider text-slate-500">Product Name</label>
                  <Input
                    id="prod-name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Enter product name..."
                    className="h-11 rounded-xl border border-slate-200 px-3.5 text-sm font-bold bg-white text-slate-900 focus-visible:ring-1 focus-visible:ring-orange-500 focus-visible:border-orange-500 shadow-none"
                  />
                </div>

                {/* Product Price Input with Adjustments */}
                <div className="space-y-1.5">
                  <label htmlFor="prod-price" className="text-[10px] font-black uppercase tracking-wider text-slate-500">Price (MUSD)</label>
                  <div className="relative flex items-center">
                    <Input
                      id="prod-price"
                      type="number"
                      value={editPrice === 0 ? '' : editPrice}
                      onChange={(e) => setEditPrice(Number(e.target.value))}
                      placeholder="0.00"
                      className="h-11 w-full rounded-xl border border-slate-200 pl-3.5 pr-14 text-sm font-bold bg-white text-slate-900 focus-visible:ring-1 focus-visible:ring-orange-500 focus-visible:border-orange-500 shadow-none"
                    />
                    <button 
                      type="button" 
                      onClick={() => setEditPrice(0)}
                      className="absolute right-3 text-[10px] font-extrabold text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded"
                    >
                      Clear
                    </button>
                  </div>

                  {/* Micro adjustment quick buttons */}
                  <div className="grid grid-cols-4 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setEditPrice(prev => Math.max(0, prev - 10))}
                      className="h-9 flex items-center justify-center gap-1 rounded-xl bg-slate-100 border border-slate-200/40 text-xs font-black text-slate-700 active:scale-95 transition-all"
                    >
                      <Minus className="h-3 w-3" />
                      10
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditPrice(prev => Math.max(0, prev - 1))}
                      className="h-9 flex items-center justify-center gap-1 rounded-xl bg-slate-100 border border-slate-200/40 text-xs font-black text-slate-700 active:scale-95 transition-all"
                    >
                      <Minus className="h-3 w-3" />
                      1
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditPrice(prev => prev + 1)}
                      className="h-9 flex items-center justify-center gap-1 rounded-xl bg-slate-100 border border-slate-200/40 text-xs font-black text-slate-700 active:scale-95 transition-all"
                    >
                      <Plus className="h-3 w-3" />
                      1
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditPrice(prev => prev + 10)}
                      className="h-9 flex items-center justify-center gap-1 rounded-xl bg-slate-100 border border-slate-200/40 text-xs font-black text-slate-700 active:scale-95 transition-all"
                    >
                      <Plus className="h-3 w-3" />
                      10
                    </button>
                  </div>
                </div>

                {/* Variants / Sku Editor section */}
                <div className="space-y-2 border-t border-slate-100 pt-3">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Specification & Variants</p>
                  
                  {/* Inline Variant editor inputs overlay */}
                  {editingField ? (
                    <div className="flex items-center gap-2 rounded-2xl bg-orange-50/60 border border-orange-100 p-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-[9px] font-black uppercase tracking-wide text-orange-600">Editing {editingField.toUpperCase()}</p>
                        <Input
                          value={inlineEditVal}
                          onChange={(e) => setInlineEditVal(e.target.value)}
                          placeholder={`Enter custom ${editingField}...`}
                          className="h-9 border-0 bg-transparent p-0 text-sm font-extrabold text-slate-900 shadow-none focus-visible:ring-0"
                          autoFocus
                          onKeyDown={(e) => { if (e.key === 'Enter') saveInlineEdit(); }}
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={saveInlineEdit} className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-600 text-white shadow">
                          <Check className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => setEditingField(null)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-200 text-slate-500">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {/* Render interactive badges */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => startInlineEdit('sku')}
                      className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:border-orange-300 hover:bg-orange-50 transition-colors"
                    >
                      <span className="text-[9px] font-black uppercase tracking-wide text-slate-400">SKU:</span>
                      <span className="font-mono font-black">{editSku || 'Not Set'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => startInlineEdit('color')}
                      className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:border-orange-300 hover:bg-orange-50 transition-colors"
                    >
                      <span className="text-[9px] font-black uppercase tracking-wide text-slate-400">Color:</span>
                      <span className="font-black">{editColor || 'Not Set'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => startInlineEdit('size')}
                      className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:border-orange-300 hover:bg-orange-50 transition-colors"
                    >
                      <span className="text-[9px] font-black uppercase tracking-wide text-slate-400">Size:</span>
                      <span className="font-black">{editSize || 'Not Set'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Buttons fixed in container bottom */}
              <div className="flex gap-3 border-t border-slate-100 pt-5">
                <Button
                  variant="outline"
                  onClick={() => setSelectedProduct(null)}
                  disabled={saving}
                  className="h-12 flex-1 rounded-2xl border-slate-200 font-black text-slate-600 hover:bg-slate-50 text-sm active:scale-95 transition-all"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="h-12 flex-1 rounded-2xl bg-orange-600 font-black text-white hover:bg-red-950 text-sm active:scale-95 transition-all shadow-md shadow-orange-600/10"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </div>

            </div>
          </div>
        )}
      </BottomSheetFrame>
    </main>
  );
}
