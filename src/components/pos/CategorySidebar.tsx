import { Grid2X2, Tag } from 'lucide-react';
import type { Category } from './types';

interface CategorySidebarProps {
  categories: Category[];
  selectedCategory: string;
  onSelectCategory: (categoryId: string) => void;
}

export function CategorySidebar({ categories, selectedCategory, onSelectCategory }: CategorySidebarProps) {
  return (
    <aside className="w-28 shrink-0 border-r border-orange-100 bg-white md:w-48">
      <div className="sticky top-[73px] h-[calc(100vh-73px)] overflow-y-auto px-2 py-3 md:px-3">
        <div className="mb-3 hidden items-center gap-2 px-2 text-xs font-black uppercase text-orange-700 md:flex">
          <Grid2X2 className="h-4 w-4" />
          Categories
        </div>
        <nav className="space-y-2">
          {categories.map((category) => {
            const isSelected = category.id === selectedCategory;

            return (
              <button
                key={category.id}
                type="button"
                onClick={() => onSelectCategory(category.id)}
                className={[
                  'flex min-h-14 w-full flex-col justify-center rounded-lg px-3 py-2 text-left transition-colors',
                  'hover:bg-red-950 hover:text-white',
                  isSelected
                    ? 'bg-orange-600 text-white shadow-sm'
                    : 'bg-orange-50 text-slate-800'
                ].join(' ')}
              >
                <span className="flex items-center gap-2 text-sm font-black">
                  <Tag className="hidden h-4 w-4 md:block" />
                  <span className="truncate">{category.name}</span>
                </span>
                <span className={isSelected ? 'text-[11px] font-bold text-orange-100' : 'text-[11px] font-bold text-orange-700'}>
                  {category.count} items
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
