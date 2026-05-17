import { PackagePlus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatMoney } from '@/lib/money';
import type { Product } from './types';

interface ProductGridProps {
  products: Product[];
  searchValue: string;
  onSearchChange: (value: string) => void;
  onAddProduct: (product: Product) => void;
}

export function ProductGrid({ products, searchValue, onSearchChange, onAddProduct }: ProductGridProps) {
  return (
    <section className="min-w-0 flex-1 bg-orange-50/50 px-3 py-3 md:px-5">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-orange-700">Fashion Catalog</p>
          <h2 className="text-xl font-black tracking-tight text-slate-950">Tap apparel to add</h2>
        </div>
        <label className="relative block md:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-orange-700" />
          <Input
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search style, SKU, barcode"
            className="h-11 rounded-lg border-orange-200 bg-white pl-9 font-bold focus-visible:ring-orange-600"
          />
        </label>
      </div>

      {products.length === 0 ? (
        <div className="flex min-h-[280px] items-center justify-center rounded-lg border border-dashed border-orange-200 bg-white text-sm font-bold text-slate-400">
          No products found
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 pb-40 sm:grid-cols-3 xl:grid-cols-4">
          {products.map((product) => (
            <div
              key={product.id}
              role="button"
              tabIndex={0}
              onClick={() => onAddProduct(product)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') onAddProduct(product);
              }}
              className="group overflow-hidden rounded-lg border border-orange-100 bg-white text-left shadow-sm transition-colors hover:border-red-950 hover:bg-red-950 hover:text-white"
            >
              <div className="aspect-[4/3] bg-orange-100">
                {product.image_url ? (
                  <img src={product.image_url} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="space-y-2 p-3">
                <div className="min-h-12">
                  <p className="line-clamp-2 text-sm font-black leading-tight">{product.name}</p>
                  <p className="mt-1 truncate text-[11px] font-bold text-slate-500 group-hover:text-orange-100">
                    {product.brand || product.sku} / {product.size || '-'}
                  </p>
                </div>
                <div className="flex items-end justify-between gap-2">
                  <div>
                    <p className="text-lg font-black text-orange-700 group-hover:text-orange-200">
                      {formatMoney(Number(product.price))}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    className="h-9 w-9 rounded-lg bg-orange-600 text-white hover:bg-orange-700"
                    onClick={(event) => {
                      event.stopPropagation();
                      onAddProduct(product);
                    }}
                  >
                    <PackagePlus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
