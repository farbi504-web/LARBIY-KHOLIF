import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  Eye,
  EyeOff,
  Plus,
  Search,
  Star,
  Trash2,
  Upload,
} from 'lucide-react';
import { TX } from '../shared/i18n.ts';
import { formatPriceDzd } from '../shared/commerce.ts';
import { CATEGORY_ICONS, DEFAULT_CATEGORIES, resolveCategoryLabel } from '../shared/categories.ts';
import type {
  AdminSettings,
  AnnouncementConfig,
  CategoryIconName,
  CategoryId,
  CategoryItem,
  Lang,
  PaymentMethod,
  Product,
  ProductPlan,
  ProductType,
} from '../shared/types.ts';
import { apiJson, fileToDataUrl, getAdminToken } from '../utils/api.ts';
import { AnnouncementBar } from './AnnouncementBar.tsx';
import { CategoryIcon } from './CategoryIcon.tsx';
import { ServiceSvgIllustration } from './ServiceArtwork.tsx';

export function AdminCategoriesPanel({
  lang,
  categories,
  onReload,
}: {
  lang: Lang;
  categories: CategoryItem[];
  onReload: () => void;
}) {
  const t = TX[lang];
  const [editing, setEditing] = useState<Partial<CategoryItem> | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startNew() {
    setError(null);
    const maxOrder = categories.reduce((m, c) => Math.max(m, c.sortOrder || 0), 0);
    setEditing({
      name: { ar: '', fr: '' },
      desc: { ar: '', fr: '' },
      icon: 'package',
      img: '',
      sortOrder: maxOrder + 1,
      active: true,
    });
  }

  function startEdit(c: CategoryItem) {
    setError(null);
    setEditing({
      ...c,
      name: { ...c.name },
      desc: { ...c.desc },
    });
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !editing) return;
    setUploadingImg(true);
    setError(null);
    try {
      const dataUrl = await fileToDataUrl(file);
      const res = await apiJson<{ url: string }>('/api/admin/media', {
        method: 'POST',
        body: JSON.stringify({ slot: 'category', dataUrl }),
      });
      setEditing({ ...editing, img: res.url });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploadingImg(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      if (editing.id) {
        await apiJson(`/api/admin/categories/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(editing),
        });
      } else {
        await apiJson('/api/admin/categories', {
          method: 'POST',
          body: JSON.stringify(editing),
        });
      }
      setEditing(null);
      onReload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(cat: CategoryItem) {
    setError(null);
    try {
      await apiJson(`/api/admin/categories/${cat.id}`, {
        method: 'PUT',
        body: JSON.stringify({ active: !cat.active }),
      });
      onReload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      await apiJson(`/api/admin/categories/${id}`, { method: 'DELETE' });
      onReload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg sm:text-xl font-extrabold text-[var(--ink)]">
          {t.admin.categories.title}
        </h2>
        <button
          type="button"
          onClick={startNew}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#D7193F] px-4 text-xs sm:text-sm font-extrabold text-white hover:bg-[#B81434] transition-colors cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>{t.admin.categories.add}</span>
        </button>
      </div>

      {error && !editing && (
        <div className="rounded-lg bg-rose-500/10 border border-rose-500/25 p-3 text-xs font-bold text-rose-600">
          {error}
        </div>
      )}

      {editing && (
        <form
          onSubmit={handleSave}
          className="rounded-xl border border-[#D7193F]/35 bg-[var(--surface)] p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-extrabold text-[var(--ink)]">
              {editing.id ? t.admin.categories.edit : t.admin.categories.add}
            </h3>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="h-9 rounded-lg border border-[var(--border)] px-3 text-xs font-bold cursor-pointer"
            >
              {t.gallery.close}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block space-y-1">
              <span className="text-xs font-bold">{t.admin.categories.nameAr} *</span>
              <input
                type="text"
                required
                value={editing.name?.ar || ''}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    name: { ar: e.target.value, fr: editing.name?.fr || '' },
                  })
                }
                className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-bold">{t.admin.categories.nameFr}</span>
              <input
                type="text"
                dir="ltr"
                value={editing.name?.fr || ''}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    name: { ar: editing.name?.ar || '', fr: e.target.value },
                  })
                }
                className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block space-y-1">
              <span className="text-xs font-bold">{t.admin.categories.descAr}</span>
              <textarea
                rows={2}
                value={editing.desc?.ar || ''}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    desc: { ar: e.target.value, fr: editing.desc?.fr || '' },
                  })
                }
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-bold">{t.admin.categories.descFr}</span>
              <textarea
                rows={2}
                dir="ltr"
                value={editing.desc?.fr || ''}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    desc: { ar: editing.desc?.ar || '', fr: e.target.value },
                  })
                }
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-sm"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <label className="block space-y-1">
              <span className="text-xs font-bold">{t.admin.categories.icon}</span>
              <div className="flex items-center gap-2">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] text-[#D7193F]">
                  <CategoryIcon
                    cat={editing.id || 'custom'}
                    icon={editing.icon as CategoryIconName}
                    className="h-5 w-5"
                  />
                </span>
                <select
                  value={editing.icon || 'package'}
                  onChange={(e) =>
                    setEditing({ ...editing, icon: e.target.value as CategoryIconName })
                  }
                  className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
                >
                  {CATEGORY_ICONS.map((ic) => (
                    <option key={ic} value={ic}>
                      {t.admin.categories.iconLabels[ic]}
                    </option>
                  ))}
                </select>
              </div>
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-bold">{t.admin.categories.sortOrder}</span>
              <input
                type="number"
                min={0}
                max={999}
                value={editing.sortOrder ?? 1}
                onChange={(e) => setEditing({ ...editing, sortOrder: Number(e.target.value) })}
                className="num h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
              />
            </label>

            <label className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-alt)]/50 px-3.5 text-xs font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={editing.active !== false}
                onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
              />
              <span>{t.admin.categories.active}</span>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex h-10 items-center gap-2 rounded-lg border border-dashed border-[var(--border)] px-4 text-xs font-bold text-[var(--ink)] hover:border-[#D7193F] cursor-pointer">
              <Upload className="h-4 w-4 text-[#D7193F]" />
              <span>{uploadingImg ? '...' : t.admin.categories.image}</span>
              <input type="file" accept="image/*" onChange={handleImageUpload} className="sr-only" />
            </label>
            {editing.img && (
              <div className="flex items-center gap-2">
                <img src={editing.img} alt="" className="h-10 w-16 rounded-lg object-cover border border-[var(--border)]" />
                <button
                  type="button"
                  onClick={() => setEditing({ ...editing, img: '' })}
                  className="h-9 rounded-lg border border-[var(--border)] px-2.5 text-xs font-bold text-[var(--ink-muted)] hover:text-rose-600 cursor-pointer"
                >
                  {t.admin.products.clearImage}
                </button>
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-lg bg-rose-500/10 p-3 text-xs font-bold text-rose-600">{error}</div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="h-10 rounded-lg bg-[#D7193F] px-6 text-xs sm:text-sm font-extrabold text-white hover:bg-[#B81434] transition-colors cursor-pointer"
          >
            {saving ? '...' : t.admin.categories.save}
          </button>
        </form>
      )}

      {categories.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--ink-muted)]">
          {t.admin.categories.empty}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-[var(--surface-alt)] border border-[var(--border)]">
                  <ServiceSvgIllustration
                    cat={cat.id}
                    customImg={cat.img}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <CategoryIcon
                      cat={cat.id}
                      icon={cat.icon}
                      className="h-4 w-4 shrink-0 text-[#D7193F]"
                    />
                    <p className="font-display text-sm font-bold text-[var(--ink)] truncate">
                      {cat.name[lang] || cat.name.ar}
                    </p>
                  </div>
                  <p className="text-xs text-[var(--ink-muted)] truncate">
                    {cat.desc[lang] || cat.desc.ar}
                  </p>
                  <p className="num text-[11px] font-bold text-[var(--ink-muted)] flex items-center gap-2">
                    <span>#{cat.sortOrder}</span>
                    <span>·</span>
                    <span>
                      {cat.productCount ?? 0} {t.admin.categories.productsCount}
                    </span>
                    <span>·</span>
                    <span
                      className={`inline-flex items-center gap-1 ${
                        cat.active ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'
                      }`}
                    >
                      {cat.active ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                      {cat.active ? t.admin.categories.active : t.admin.categories.hidden}
                    </span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  title={t.admin.categories.toggleVisibility}
                  onClick={() => void handleToggleActive(cat)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--ink-muted)] hover:text-[var(--ink)] cursor-pointer"
                >
                  {cat.active ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => startEdit(cat)}
                  className="h-8 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-bold hover:border-[#D7193F] cursor-pointer"
                >
                  {t.admin.products.edit}
                </button>
                <button
                  type="button"
                  aria-label={t.admin.categories.delete}
                  onClick={() => void handleDelete(cat.id)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-rose-600 hover:bg-rose-500/10 cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AdminProductsPanel({
  lang,
  products,
  categories = DEFAULT_CATEGORIES,
  availPreset = 'all',
  onClearAvailPreset,
  onReload,
}: {
  lang: Lang;
  products: Product[];
  categories?: CategoryItem[];
  availPreset?: 'all' | 'avail' | 'unavail';
  onClearAvailPreset?: () => void;
  onReload: () => void;
}) {
  const t = TX[lang];
  const [editing, setEditing] = useState<Partial<Product> | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | ProductType>('all');
  const [availFilter, setAvailFilter] = useState<'all' | 'avail' | 'unavail'>(availPreset);

  useEffect(() => {
    setAvailFilter(availPreset);
  }, [availPreset]);

  const availableCats = categories.length ? categories : DEFAULT_CATEGORIES;

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (catFilter !== 'all' && p.cat !== catFilter) return false;
      if (typeFilter !== 'all' && p.type !== typeFilter) return false;
      if (availFilter === 'avail' && !p.avail) return false;
      if (availFilter === 'unavail' && p.avail) return false;
      if (q) {
        const hit =
          (p.name.ar || '').toLowerCase().includes(q) ||
          (p.name.fr || '').toLowerCase().includes(q) ||
          (p.desc?.ar || '').toLowerCase().includes(q) ||
          (p.desc?.fr || '').toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [products, search, catFilter, typeFilter, availFilter]);

  function startNew() {
    setError(null);
    setEditing({
      cat: availableCats[0]?.id || 'shop',
      type: 'physical',
      name: { ar: '', fr: '' },
      desc: { ar: '', fr: '' },
      price: 0,
      old: null,
      avail: true,
      img: '',
      needsRef: false,
      pays: ['cod', 'ccp', 'chargily'],
      plans: [],
      featured: false,
    });
  }

  function startEdit(p: Product) {
    setError(null);
    setEditing({
      ...p,
      name: { ...p.name },
      desc: { ...p.desc },
      pays: [...p.pays],
      plans: p.plans ? p.plans.map((pl) => ({ ...pl, label: { ...pl.label } })) : [],
    });
  }

  function startDuplicate(p: Product) {
    setError(null);
    setEditing({
      cat: p.cat,
      type: p.type,
      name: {
        ar: `${p.name.ar} (نسخة)`,
        fr: p.name.fr ? `${p.name.fr} (copie)` : '',
      },
      desc: { ...p.desc },
      price: p.price,
      old: p.old,
      avail: p.avail,
      img: p.img,
      needsRef: p.needsRef,
      pays: [...p.pays],
      plans: p.plans ? p.plans.map((pl) => ({ ...pl, label: { ...pl.label } })) : [],
      featured: false,
    });
  }

  async function quickPatchProduct(p: Product, patch: Partial<Product>) {
    await apiJson(`/api/admin/products/${p.id}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
    });
    onReload();
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !editing) return;
    setUploadingImg(true);
    setError(null);
    try {
      const dataUrl = await fileToDataUrl(file);
      const res = await apiJson<{ url: string }>('/api/admin/media', {
        method: 'POST',
        body: JSON.stringify({ slot: 'product', dataUrl }),
      });
      setEditing({ ...editing, img: res.url });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploadingImg(false);
    }
  }

  function togglePay(method: PaymentMethod) {
    if (!editing) return;
    const current = new Set(editing.pays || []);
    if (current.has(method)) current.delete(method);
    else current.add(method);
    setEditing({ ...editing, pays: Array.from(current) });
  }

  function addPlan() {
    if (!editing) return;
    const next: ProductPlan = {
      id: 'pl_' + Math.random().toString(36).slice(2, 7),
      label: { ar: '', fr: '' },
      price: editing.price || 0,
      oldPrice: null,
    };
    setEditing({ ...editing, plans: [...(editing.plans || []), next] });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      if (editing.id) {
        await apiJson(`/api/admin/products/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(editing),
        });
      } else {
        await apiJson('/api/admin/products', {
          method: 'POST',
          body: JSON.stringify(editing),
        });
      }
      setEditing(null);
      onReload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await apiJson(`/api/admin/products/${id}`, { method: 'DELETE' });
    onReload();
  }

  function exportProductsCsv() {
    const headers = ['id', 'name_ar', 'name_fr', 'category', 'type', 'price', 'old_price', 'available', 'featured'];
    const rows = products.map((p) => [
      p.id,
      `"${(p.name?.ar || '').replace(/"/g, '""')}"`,
      `"${(p.name?.fr || '').replace(/"/g, '""')}"`,
      p.cat,
      p.type,
      p.price,
      p.old ?? '',
      p.avail ? '1' : '0',
      p.featured ? '1' : '0',
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'products_export.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async function handleCsvImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
      if (lines.length <= 1) {
        throw new Error('CSV file is empty or missing rows');
      }
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        if (parts.length >= 6) {
          const nameAr = parts[1]?.replace(/^"|"$/g, '').replace(/""/g, '"') || 'منتج جديد';
          const nameFr = parts[2]?.replace(/^"|"$/g, '').replace(/""/g, '"') || '';
          const cat = parts[3]?.trim() || 'shop';
          const type = (parts[4]?.trim() === 'digital' ? 'digital' : 'physical');
          const price = Number(parts[5]) || 0;
          const old = parts[6] ? Number(parts[6]) || null : null;
          const avail = parts[7] ? parts[7].trim() === '1' || parts[7].trim().toLowerCase() === 'true' : true;
          const featured = parts[8] ? parts[8].trim() === '1' || parts[8].trim().toLowerCase() === 'true' : false;

          await apiJson('/api/admin/products', {
            method: 'POST',
            body: JSON.stringify({
              cat,
              type,
              nameAr,
              nameFr,
              descAr: '',
              descFr: '',
              price,
              oldPrice: old,
              avail,
              featured,
              needsRef: false,
              pays: type === 'digital' ? ['ccp', 'chargily'] : ['cod', 'ccp', 'chargily'],
              plans: [],
            }),
          });
        }
      }
      onReload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'CSV Import failed');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-lg sm:text-xl font-extrabold text-[var(--ink)]">
            {t.admin.nav.products}
          </h2>
          <span className="num rounded-md bg-[var(--surface-alt)] px-2 py-0.5 text-xs font-bold text-[var(--ink-muted)] border border-[var(--border)]">
            {filteredProducts.length}/{products.length}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={exportProductsCsv}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-bold text-[var(--ink)] hover:border-[#D7193F] transition-colors cursor-pointer"
          >
            <Download className="h-4 w-4" />
            <span>{lang === 'fr' ? 'Export CSV' : 'تصدير CSV'}</span>
          </button>
          <label className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-bold text-[var(--ink)] hover:border-[#D7193F] transition-colors cursor-pointer">
            <Upload className="h-4 w-4" />
            <span>{lang === 'fr' ? 'Import CSV' : 'استيراد CSV'}</span>
            <input type="file" accept=".csv" onChange={handleCsvImport} className="sr-only" />
          </label>
          <button
            type="button"
            onClick={startNew}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#D7193F] px-4 text-xs sm:text-sm font-extrabold text-white hover:bg-[#B81434] transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>{t.admin.products.add}</span>
          </button>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
        <div className="relative sm:col-span-5">
          <Search className="pointer-events-none absolute top-1/2 start-3 -translate-y-1/2 h-4 w-4 text-[var(--ink-muted)]" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.admin.products.searchPlaceholder}
            className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] ps-9 pe-3 text-xs sm:text-sm"
          />
        </div>
        <select
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
          className="sm:col-span-3 h-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-bold"
        >
          <option value="all">{t.catalog.allCats}</option>
          {availableCats.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name[lang] || cat.name.ar || cat.name.fr}
            </option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as 'all' | ProductType)}
          className="sm:col-span-2 h-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-bold"
        >
          <option value="all">{t.catalog.allTypes}</option>
          <option value="physical">{t.catalog.physical}</option>
          <option value="digital">{t.catalog.digital}</option>
        </select>
        <select
          value={availFilter}
          onChange={(e) => {
            setAvailFilter(e.target.value as 'all' | 'avail' | 'unavail');
            if (onClearAvailPreset) onClearAvailPreset();
          }}
          className="sm:col-span-2 h-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-bold"
        >
          <option value="all">{t.admin.products.allAvail}</option>
          <option value="avail">{t.admin.products.availOnly}</option>
          <option value="unavail">{t.admin.products.unavailOnly}</option>
        </select>
      </div>

      {editing && (
        <form
          onSubmit={handleSave}
          className="rounded-xl border border-[#D7193F]/35 bg-[var(--surface)] p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-extrabold text-[var(--ink)]">
              {editing.id ? t.admin.products.edit : t.admin.products.add}
            </h3>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="h-9 rounded-lg border border-[var(--border)] px-3 text-xs font-bold cursor-pointer"
            >
              {t.gallery.close}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block space-y-1">
              <span className="text-xs font-bold">{t.admin.products.nameAr} *</span>
              <input
                type="text"
                required
                value={editing.name?.ar || ''}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    name: { ar: e.target.value, fr: editing.name?.fr || '' },
                  })
                }
                className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-bold">{t.admin.products.nameFr}</span>
              <input
                type="text"
                dir="ltr"
                value={editing.name?.fr || ''}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    name: { ar: editing.name?.ar || '', fr: e.target.value },
                  })
                }
                className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block space-y-1">
              <span className="text-xs font-bold">{t.admin.products.descAr}</span>
              <textarea
                rows={2}
                value={editing.desc?.ar || ''}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    desc: { ar: e.target.value, fr: editing.desc?.fr || '' },
                  })
                }
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-bold">{t.admin.products.descFr}</span>
              <textarea
                rows={2}
                dir="ltr"
                value={editing.desc?.fr || ''}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    desc: { ar: editing.desc?.ar || '', fr: e.target.value },
                  })
                }
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-sm"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <label className="block space-y-1">
              <span className="text-xs font-bold">{t.admin.products.category}</span>
              <select
                value={editing.cat || availableCats[0]?.id || 'shop'}
                onChange={(e) => setEditing({ ...editing, cat: e.target.value as CategoryId })}
                className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
              >
                {availableCats.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name[lang] || cat.name.ar || cat.name.fr}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-bold">{t.admin.products.type}</span>
              <select
                value={editing.type || 'physical'}
                onChange={(e) => {
                  const tp = e.target.value as ProductType;
                  const nextPays =
                    tp === 'digital'
                      ? (editing.pays || []).filter((p) => p !== 'cod')
                      : editing.pays || ['cod', 'ccp', 'chargily'];
                  setEditing({
                    ...editing,
                    type: tp,
                    pays: nextPays.length ? nextPays : ['ccp'],
                  });
                }}
                className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
              >
                <option value="physical">{t.catalog.physical}</option>
                <option value="digital">{t.catalog.digital}</option>
              </select>
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-bold">{t.admin.products.price} *</span>
              <input
                type="number"
                required
                min={0}
                value={editing.price ?? 0}
                onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })}
                className="num h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-bold">{t.admin.products.oldPrice}</span>
              <input
                type="number"
                min={0}
                value={editing.old ?? ''}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    old: e.target.value === '' ? null : Number(e.target.value),
                  })
                }
                className="num h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <label className="inline-flex h-10 items-center gap-2 rounded-lg border border-dashed border-[var(--border)] px-4 text-xs font-bold text-[var(--ink)] hover:border-[#D7193F] cursor-pointer">
              <Upload className="h-4 w-4 text-[#D7193F]" />
              <span>{uploadingImg ? '...' : t.admin.products.image}</span>
              <input type="file" accept="image/*" onChange={handleImageUpload} className="sr-only" />
            </label>
            {editing.img && (
              <div className="flex items-center gap-2">
                <img
                  src={editing.img}
                  alt=""
                  className="h-10 w-14 rounded-lg object-cover border border-[var(--border)]"
                />
                <button
                  type="button"
                  onClick={() => setEditing({ ...editing, img: '' })}
                  className="h-9 rounded-lg border border-[var(--border)] px-2.5 text-xs font-bold text-[var(--ink-muted)] hover:text-rose-600 cursor-pointer"
                >
                  {t.admin.products.clearImage}
                </button>
              </div>
            )}

            <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(editing.avail)}
                onChange={(e) => setEditing({ ...editing, avail: e.target.checked })}
              />
              <span>{t.admin.products.available}</span>
            </label>

            <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(editing.featured)}
                onChange={(e) => setEditing({ ...editing, featured: e.target.checked })}
              />
              <span>{t.admin.products.featured}</span>
            </label>

            <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(editing.needsRef)}
                onChange={(e) => setEditing({ ...editing, needsRef: e.target.checked })}
              />
              <span>{t.admin.products.needsRef}</span>
            </label>
          </div>

          <div className="space-y-2">
            <span className="block text-xs font-bold">{t.admin.products.allowedPays}</span>
            <div className="flex flex-wrap gap-3">
              {(['cod', 'ccp', 'chargily'] as PaymentMethod[]).map((method) => {
                const disabled = editing.type === 'digital' && method === 'cod';
                return (
                  <label
                    key={method}
                    className={`inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-bold ${
                      disabled ? 'opacity-45' : 'cursor-pointer'
                    }`}
                  >
                    <input
                      type="checkbox"
                      disabled={disabled}
                      checked={!disabled && Boolean(editing.pays?.includes(method))}
                      onChange={() => togglePay(method)}
                    />
                    <span>{t.payLabels[method]}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="space-y-2 border-t border-[var(--border)] pt-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold">{t.admin.products.plansTitle}</span>
              <button
                type="button"
                onClick={addPlan}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-bold cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{t.admin.products.addPlan}</span>
              </button>
            </div>
            {(editing.plans || []).map((pl, idx) => (
              <div key={pl.id} className="grid grid-cols-12 gap-2 items-center">
                <input
                  type="text"
                  placeholder={t.admin.products.planLabelAr}
                  value={pl.label.ar}
                  onChange={(e) => {
                    const next = [...(editing.plans || [])];
                    next[idx] = { ...pl, label: { ...pl.label, ar: e.target.value } };
                    setEditing({ ...editing, plans: next });
                  }}
                  className="col-span-4 h-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs"
                />
                <input
                  type="text"
                  dir="ltr"
                  placeholder={t.admin.products.planLabelFr}
                  value={pl.label.fr}
                  onChange={(e) => {
                    const next = [...(editing.plans || [])];
                    next[idx] = { ...pl, label: { ...pl.label, fr: e.target.value } };
                    setEditing({ ...editing, plans: next });
                  }}
                  className="col-span-4 h-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs"
                />
                <input
                  type="number"
                  min={0}
                  value={pl.price}
                  onChange={(e) => {
                    const next = [...(editing.plans || [])];
                    next[idx] = { ...pl, price: Number(e.target.value) };
                    setEditing({ ...editing, plans: next });
                  }}
                  className="num col-span-3 h-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs"
                />
                <button
                  type="button"
                  aria-label="Remove plan"
                  onClick={() =>
                    setEditing({
                      ...editing,
                      plans: (editing.plans || []).filter((_, i) => i !== idx),
                    })
                  }
                  className="col-span-1 inline-flex h-10 items-center justify-center text-rose-600 cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          {error && (
            <div className="rounded-lg bg-rose-500/10 p-3 text-xs font-bold text-rose-600">{error}</div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="h-10 rounded-lg bg-[#D7193F] px-6 text-xs sm:text-sm font-extrabold text-white hover:bg-[#B81434] transition-colors cursor-pointer"
          >
            {saving ? '...' : t.admin.products.save}
          </button>
        </form>
      )}

      {filteredProducts.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--ink-muted)]">
          {t.admin.products.empty}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredProducts.map((p) => (
            <div
              key={p.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-14 w-16 shrink-0 overflow-hidden rounded-lg bg-[var(--surface-alt)] border border-[var(--border)]">
                  {p.img ? (
                    <img src={p.img} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ServiceSvgIllustration cat={p.cat} />
                  )}
                </div>
                <div className="min-w-0 space-y-0.5">
                  <p className="font-display text-sm font-bold text-[var(--ink)] truncate">
                    {p.name[lang] || p.name.ar}
                  </p>
                  <p className="num text-xs font-bold text-[#D7193F]">
                    {formatPriceDzd(p.price, lang)} ·{' '}
                    <span className="text-[var(--ink-muted)]">
                      {resolveCategoryLabel(availableCats, p.cat, lang, t.services.items)}
                    </span>
                  </p>
                  <p className="num text-[10px] text-[var(--ink-muted)]">
                    {p.avail ? t.catalog.available : t.catalog.unavailable} · {p.salesCount}{' '}
                    {lang === 'fr' ? 'ventes' : 'مبيعة'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  title={t.admin.products.available}
                  onClick={() => void quickPatchProduct(p, { avail: !p.avail })}
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border cursor-pointer ${
                    p.avail
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                      : 'border-[var(--border)] bg-[var(--surface-alt)] text-[var(--ink-muted)]'
                  }`}
                >
                  {p.avail ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                </button>
                <button
                  type="button"
                  title={t.admin.products.featured}
                  onClick={() => void quickPatchProduct(p, { featured: !p.featured })}
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border cursor-pointer ${
                    p.featured
                      ? 'border-amber-500/35 bg-amber-500/12 text-amber-500'
                      : 'border-[var(--border)] bg-[var(--surface)] text-[var(--ink-muted)]'
                  }`}
                >
                  <Star className={`h-3.5 w-3.5 ${p.featured ? 'fill-amber-500' : ''}`} />
                </button>
                <button
                  type="button"
                  title={t.admin.products.duplicate}
                  onClick={() => startDuplicate(p)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--ink-muted)] hover:text-[var(--ink)] cursor-pointer"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => startEdit(p)}
                  className="h-8 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs font-bold hover:border-[#D7193F] cursor-pointer"
                >
                  {t.admin.products.edit}
                </button>
                <button
                  type="button"
                  aria-label={t.admin.products.delete}
                  onClick={() => void handleDelete(p.id)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-rose-600 hover:bg-rose-500/10 cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AdminSettingsPanel({
  lang,
  onSettingsUpdated,
  onOpenCategories,
}: {
  lang: Lang;
  onSettingsUpdated: () => void;
  onOpenCategories?: () => void;
}) {
  const t = TX[lang];
  const [tab, setTab] = useState<'identity' | 'announcement' | 'media' | 'integrations'>('identity');
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [chargilyKeyInput, setChargilyKeyInput] = useState('');
  const [deliveryTokenInput, setDeliveryTokenInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const defaultAnnConfig: AnnouncementConfig = {
    enabled: true,
    tone: 'navy',
    mode: 'ticker',
    speed: 'normal',
    dismissible: false,
    ctaLabel: { ar: '', fr: '' },
    ctaTarget: '',
  };

  async function load() {
    const res = await apiJson<{ settings: AdminSettings }>('/api/admin/settings');
    setSettings({
      ...res.settings,
      announcementConfig: res.settings.announcementConfig || defaultAnnConfig,
    });
    setChargilyKeyInput(res.settings.chargilySecretMasked || '');
    setDeliveryTokenInput(res.settings.deliveryTokenMasked || '');
  }

  useEffect(() => {
    void load();
  }, []);

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setMsg(null);
    try {
      await apiJson('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({
          ...settings,
          chargilySecretKey: chargilyKeyInput,
          deliveryToken: deliveryTokenInput,
        }),
      });
      await load();
      onSettingsUpdated();
      setMsg(t.admin.settings.saved);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  async function uploadSlotImage(slot: string, file?: File) {
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    await apiJson('/api/admin/media', {
      method: 'POST',
      body: JSON.stringify({ slot, dataUrl }),
    });
    await load();
    onSettingsUpdated();
  }

  async function uploadVideo(file?: File) {
    if (!file) return;
    setMsg(null);
    const token = getAdminToken();
    const headers: Record<string, string> = {
      'Content-Type': file.type || 'video/mp4',
      'X-Requested-With': 'fetch',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      headers['X-Admin-Token'] = token;
    }
    const res = await fetch('/api/admin/video', {
      method: 'POST',
      headers,
      credentials: 'include',
      body: file,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setMsg(err.error || 'Video upload failed');
      return;
    }
    await load();
    onSettingsUpdated();
  }

  async function removeMediaUrl(url: string) {
    const id = url.replace('/media/', '');
    if (/^[a-f0-9]{18}$/.test(id)) {
      await apiJson(`/api/admin/media/${id}`, { method: 'DELETE' });
      await load();
      onSettingsUpdated();
    }
  }

  if (!settings) return null;

  return (
    <div className="space-y-5">
      <h2 className="font-display text-lg sm:text-xl font-extrabold text-[var(--ink)]">
        {t.admin.nav.settings}
      </h2>

      <div className="flex flex-wrap gap-2">
        {(['identity', 'announcement', 'media', 'integrations'] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`h-9 rounded-lg px-3.5 text-xs font-bold cursor-pointer transition-colors ${
              tab === k
                ? 'bg-[#111318] text-white dark:bg-[#D7193F]'
                : 'border border-[var(--border)] bg-[var(--surface)] text-[var(--ink-muted)] hover:text-[var(--ink)]'
            }`}
          >
            {k === 'identity'
              ? t.admin.settings.identityTab
              : k === 'announcement'
                ? t.admin.settings.announcementTab
                : k === 'media'
                  ? t.admin.settings.mediaTab
                  : t.admin.settings.integrationsTab}
          </button>
        ))}
      </div>

      {msg && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-500/12 border border-emerald-500/25 p-3 text-xs font-bold text-emerald-700 dark:text-emerald-300">
          <Check className="h-4 w-4" />
          <span>{msg}</span>
        </div>
      )}

      <form
        onSubmit={saveSettings}
        className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6 space-y-5"
      >
        {tab === 'identity' && (
          <>
            <div className="space-y-3">
              <h3 className="font-display text-sm font-extrabold text-[var(--ink)]">
                {t.admin.settings.storeInfo}
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block space-y-1">
                  <span className="text-xs font-bold">{t.admin.settings.storeNameAr}</span>
                  <input
                    type="text"
                    value={settings.storeName?.ar || ''}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        storeName: { ar: e.target.value, fr: settings.storeName?.fr || '' },
                      })
                    }
                    className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-bold">{t.admin.settings.storeNameFr}</span>
                  <input
                    type="text"
                    dir="ltr"
                    value={settings.storeName?.fr || ''}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        storeName: { ar: settings.storeName?.ar || '', fr: e.target.value },
                      })
                    }
                    className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-bold">{t.admin.settings.addressAr}</span>
                  <input
                    type="text"
                    value={settings.address?.ar || ''}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        address: { ar: e.target.value, fr: settings.address?.fr || '' },
                      })
                    }
                    className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-bold">{t.admin.settings.addressFr}</span>
                  <input
                    type="text"
                    dir="ltr"
                    value={settings.address?.fr || ''}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        address: { ar: settings.address?.ar || '', fr: e.target.value },
                      })
                    }
                    className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-bold">{t.admin.settings.hoursAr}</span>
                  <input
                    type="text"
                    value={settings.workingHours?.ar || ''}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        workingHours: {
                          ar: e.target.value,
                          fr: settings.workingHours?.fr || '',
                        },
                      })
                    }
                    className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-bold">{t.admin.settings.hoursFr}</span>
                  <input
                    type="text"
                    dir="ltr"
                    value={settings.workingHours?.fr || ''}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        workingHours: {
                          ar: settings.workingHours?.ar || '',
                          fr: e.target.value,
                        },
                      })
                    }
                    className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-bold">{t.contact.phoneLabel}</span>
                  <input
                    type="text"
                    dir="ltr"
                    value={settings.phone}
                    onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                    className="num h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-bold">{t.contact.whatsappLabel}</span>
                  <input
                    type="text"
                    dir="ltr"
                    value={settings.whatsapp}
                    onChange={(e) => setSettings({ ...settings, whatsapp: e.target.value })}
                    className="num h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-bold">{t.admin.settings.ccpRip}</span>
                  <input
                    type="text"
                    dir="ltr"
                    value={settings.ccpRip}
                    onChange={(e) => setSettings({ ...settings, ccpRip: e.target.value })}
                    className="num h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-bold">{t.admin.settings.ccpName}</span>
                  <input
                    type="text"
                    value={settings.ccpName}
                    onChange={(e) => setSettings({ ...settings, ccpName: e.target.value })}
                    className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
                  />
                </label>
                <label className="block space-y-1 sm:col-span-2">
                  <span className="text-xs font-bold">{t.admin.settings.facebookUrl}</span>
                  <input
                    type="url"
                    dir="ltr"
                    placeholder="https://facebook.com/..."
                    value={settings.facebook || ''}
                    onChange={(e) => setSettings({ ...settings, facebook: e.target.value })}
                    className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
                  />
                </label>
              </div>
            </div>

            <div className="space-y-4 border-t border-[var(--border)] pt-4">
              <p className="text-xs font-bold">{t.admin.settings.uploadLogo}</p>
              <div className="flex items-center gap-3">
                <label className="inline-flex h-10 items-center gap-2 rounded-lg border border-dashed border-[var(--border)] px-4 text-xs font-bold hover:border-[#D7193F] cursor-pointer">
                  <Upload className="h-4 w-4 text-[#D7193F]" />
                  <span>{t.admin.settings.uploadLogo}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => uploadSlotImage('logo', e.target.files?.[0])}
                    className="sr-only"
                  />
                </label>
                {settings.logo && (
                  <div className="flex items-center gap-2">
                    <img
                      src={settings.logo}
                      alt=""
                      className="h-10 w-10 rounded-full object-cover border border-[var(--border)]"
                    />
                    <button
                      type="button"
                      onClick={() => void removeMediaUrl(settings.logo)}
                      className="text-xs font-bold text-rose-600 cursor-pointer"
                    >
                      {t.admin.products.delete}
                    </button>
                  </div>
                )}
              </div>

              {/* Storefront Facade & Interior Photos */}
              <div className="space-y-2.5 pt-2">
                <p className="text-xs font-bold text-[var(--ink)]">
                  {t.admin.settings.storePhotosTitle}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {(
                    [
                      { slot: 'facade', label: t.admin.settings.facadeLabel, val: settings.facade },
                      { slot: 'facade2', label: t.admin.settings.facade2Label, val: settings.facade2 },
                      { slot: 'in1', label: t.admin.settings.interiorLabel, val: settings.in1 },
                    ] as const
                  ).map((item) => (
                    <div
                      key={item.slot}
                      className="rounded-lg border border-[var(--border)] bg-[var(--surface-alt)]/45 p-3 space-y-2"
                    >
                      <p className="text-[11px] font-bold text-[var(--ink-muted)]">{item.label}</p>
                      {item.val && (
                        <img
                          src={item.val}
                          alt={item.label}
                          className="h-24 w-full rounded-md object-cover border border-[var(--border)]"
                        />
                      )}
                      <div className="flex items-center gap-2">
                        <label className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 text-[11px] font-bold cursor-pointer">
                          <Upload className="h-3.5 w-3.5 text-[#D7193F]" />
                          <span>{lang === 'fr' ? 'Choisir' : 'رفع صورة'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => uploadSlotImage(item.slot, e.target.files?.[0])}
                            className="sr-only"
                          />
                        </label>
                        {item.val && (
                          <button
                            type="button"
                            onClick={() => void removeMediaUrl(item.val)}
                            className="h-8 rounded-md px-2 text-[11px] font-bold text-rose-600 hover:bg-rose-500/10 cursor-pointer"
                          >
                            {t.admin.products.delete}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-alt)]/55 p-3.5 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs font-medium text-[var(--ink-muted)]">
                  {t.admin.settings.uploadServiceImgs}
                </p>
                {onOpenCategories && (
                  <button
                    type="button"
                    onClick={onOpenCategories}
                    className="h-9 rounded-lg bg-[#111318] dark:bg-[#D7193F] px-3.5 text-xs font-bold text-white cursor-pointer"
                  >
                    {t.admin.nav.categories}
                  </button>
                )}
              </div>
            </div>
          </>
        )}

        {tab === 'announcement' &&
          (() => {
            const annCfg: AnnouncementConfig = settings.announcementConfig || defaultAnnConfig;
            const updateAnnCfg = (patch: Partial<AnnouncementConfig>) =>
              setSettings({
                ...settings,
                announcementConfig: { ...annCfg, ...patch },
              });
            return (
              <div className="space-y-5">
                <div className="space-y-2">
                  <p className="text-xs font-bold text-[var(--ink-muted)]">
                    {t.admin.settings.annPreview}
                  </p>
                  <div className="overflow-hidden rounded-lg border border-[var(--border)]">
                    <AnnouncementBar
                      lang={lang}
                      announcement={
                        settings.announcement?.ar || settings.announcement?.fr
                          ? settings.announcement
                          : {
                              ar: 'مرحبًا بكم في مكتبة سليمي — عروض حصرية وتوصيل سريع!',
                              fr: 'Bienvenue chez Librairie Slimi — Offres exclusives et livraison rapide !',
                            }
                      }
                      config={annCfg}
                      preview
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="inline-flex h-10 items-center gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3.5 text-xs font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={annCfg.enabled}
                      onChange={(e) => updateAnnCfg({ enabled: e.target.checked })}
                    />
                    <span>{t.admin.settings.annEnabled}</span>
                  </label>

                  <label className="inline-flex h-10 items-center gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3.5 text-xs font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={annCfg.dismissible}
                      onChange={(e) => updateAnnCfg({ dismissible: e.target.checked })}
                    />
                    <span>{t.admin.settings.annDismissible}</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="block space-y-1">
                    <span className="text-xs font-bold">{t.admin.settings.annTextAr}</span>
                    <input
                      type="text"
                      maxLength={260}
                      placeholder="مثال: تخفيضات الدخول المدرسي 15% + شحن فوري للألعاب!"
                      value={settings.announcement?.ar || ''}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          announcement: {
                            ar: e.target.value,
                            fr: settings.announcement?.fr || '',
                          },
                        })
                      }
                      className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
                    />
                  </label>

                  <label className="block space-y-1">
                    <span className="text-xs font-bold">{t.admin.settings.annTextFr}</span>
                    <input
                      type="text"
                      dir="ltr"
                      maxLength={260}
                      placeholder="Ex : Promo rentrée -15% & recharges gaming instantanées !"
                      value={settings.announcement?.fr || ''}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          announcement: {
                            ar: settings.announcement?.ar || '',
                            fr: e.target.value,
                          },
                        })
                      }
                      className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="block space-y-1">
                    <span className="text-xs font-bold">{t.admin.settings.annTone}</span>
                    <select
                      value={annCfg.tone}
                      onChange={(e) =>
                        updateAnnCfg({ tone: e.target.value as AnnouncementConfig['tone'] })
                      }
                      className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
                    >
                      {(['navy', 'crimson', 'emerald', 'amber'] as const).map((tone) => (
                        <option key={tone} value={tone}>
                          {t.admin.settings.annTones[tone]}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block space-y-1">
                    <span className="text-xs font-bold">{t.admin.settings.annMode}</span>
                    <select
                      value={annCfg.mode}
                      onChange={(e) =>
                        updateAnnCfg({ mode: e.target.value as AnnouncementConfig['mode'] })
                      }
                      className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
                    >
                      <option value="ticker">{t.admin.settings.annModes.ticker}</option>
                      <option value="static">{t.admin.settings.annModes.static}</option>
                    </select>
                  </label>

                  <label className="block space-y-1">
                    <span className="text-xs font-bold">{t.admin.settings.annSpeed}</span>
                    <select
                      disabled={annCfg.mode === 'static'}
                      value={annCfg.speed}
                      onChange={(e) =>
                        updateAnnCfg({ speed: e.target.value as AnnouncementConfig['speed'] })
                      }
                      className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm disabled:opacity-50"
                    >
                      {(['slow', 'normal', 'fast'] as const).map((sp) => (
                        <option key={sp} value={sp}>
                          {t.admin.settings.annSpeeds[sp]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-[var(--border)] pt-4">
                  <label className="block space-y-1">
                    <span className="text-xs font-bold">{t.admin.settings.annCtaTarget}</span>
                    <select
                      value={annCfg.ctaTarget || ''}
                      onChange={(e) =>
                        updateAnnCfg({
                          ctaTarget: e.target.value as AnnouncementConfig['ctaTarget'],
                        })
                      }
                      className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
                    >
                      <option value="">{t.admin.settings.annTargets.none}</option>
                      <option value="shop">{t.admin.settings.annTargets.shop}</option>
                      <option value="track">{t.admin.settings.annTargets.track}</option>
                      <option value="contact">{t.admin.settings.annTargets.contact}</option>
                    </select>
                  </label>

                  <label className="block space-y-1">
                    <span className="text-xs font-bold">{t.admin.settings.annCtaLabelAr}</span>
                    <input
                      type="text"
                      disabled={!annCfg.ctaTarget}
                      placeholder="تسوق الآن"
                      value={annCfg.ctaLabel?.ar || ''}
                      onChange={(e) =>
                        updateAnnCfg({
                          ctaLabel: { ar: e.target.value, fr: annCfg.ctaLabel?.fr || '' },
                        })
                      }
                      className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm disabled:opacity-50"
                    />
                  </label>

                  <label className="block space-y-1">
                    <span className="text-xs font-bold">{t.admin.settings.annCtaLabelFr}</span>
                    <input
                      type="text"
                      dir="ltr"
                      disabled={!annCfg.ctaTarget}
                      placeholder="Découvrir"
                      value={annCfg.ctaLabel?.fr || ''}
                      onChange={(e) =>
                        updateAnnCfg({
                          ctaLabel: { ar: annCfg.ctaLabel?.ar || '', fr: e.target.value },
                        })
                      }
                      className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm disabled:opacity-50"
                    />
                  </label>
                </div>
              </div>
            );
          })()}

        {tab === 'media' && (
          <div className="space-y-5">
            <div className="space-y-2">
              <p className="text-xs font-bold">{t.admin.settings.uploadGallery}</p>
              <label className="inline-flex h-10 items-center gap-2 rounded-lg border border-dashed border-[var(--border)] px-4 text-xs font-bold hover:border-[#D7193F] cursor-pointer">
                <Upload className="h-4 w-4 text-[#D7193F]" />
                <span>+ {t.admin.settings.uploadGallery}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => uploadSlotImage('gallery', e.target.files?.[0])}
                  className="sr-only"
                />
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                {(settings.gallery || []).map((gUrl) => (
                  <div
                    key={gUrl}
                    className="relative rounded-lg overflow-hidden border border-[var(--border)]"
                  >
                    <img src={gUrl} alt="" className="aspect-square w-full object-cover" />
                    <button
                      type="button"
                      aria-label="Delete gallery image"
                      onClick={() => void removeMediaUrl(gUrl)}
                      className="absolute top-2 end-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-rose-600 text-white cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2 border-t border-[var(--border)] pt-4">
              <p className="text-xs font-bold">{t.admin.settings.uploadVideo}</p>
              <label className="inline-flex h-10 items-center gap-2 rounded-lg border border-dashed border-[var(--border)] px-4 text-xs font-bold hover:border-[#D7193F] cursor-pointer">
                <Upload className="h-4 w-4 text-[#D7193F]" />
                <span>MP4 / WebM</span>
                <input
                  type="file"
                  accept="video/mp4,video/webm"
                  onChange={(e) => uploadVideo(e.target.files?.[0])}
                  className="sr-only"
                />
              </label>
              {settings.vid && (
                <div className="mt-3 flex items-center gap-3">
                  <video
                    src={settings.vid}
                    controls
                    playsInline
                    className="h-28 rounded-lg bg-black"
                  />
                  <button
                    type="button"
                    onClick={() => void removeMediaUrl(settings.vid)}
                    className="h-9 rounded-lg bg-rose-600 px-3 text-xs font-bold text-white cursor-pointer"
                  >
                    {t.admin.products.delete}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'integrations' && (
          <div className="space-y-6">
            <div className="space-y-3">
              <h3 className="font-display text-base font-bold">
                {t.admin.settings.chargilyTitle}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="text-xs font-bold">{t.admin.settings.chargilyMode}</span>
                  <select
                    value={settings.chargilyMode}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        chargilyMode: e.target.value === 'live' ? 'live' : 'test',
                      })
                    }
                    className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
                  >
                    <option value="test">Test</option>
                    <option value="live">Live</option>
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-bold">{t.admin.settings.chargilyKey}</span>
                  <input
                    type="text"
                    dir="ltr"
                    value={chargilyKeyInput}
                    onChange={(e) => setChargilyKeyInput(e.target.value)}
                    className="num h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
                  />
                </label>
              </div>
            </div>

            <div className="space-y-3 pt-6 border-t border-[var(--border)]">
              <h3 className="font-display text-base font-bold">
                {t.admin.settings.deliveryTitle}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="text-xs font-bold">{t.admin.settings.deliveryProvider}</span>
                  <select
                    value={settings.deliveryProvider || 'none'}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        deliveryProvider: e.target.value as AdminSettings['deliveryProvider'],
                      })
                    }
                    className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
                  >
                    <option value="none">{lang === 'fr' ? 'Aucune (Manuel)' : 'بدون (شحن يدوي)'}</option>
                    <option value="yalidine">Yalidine Express</option>
                    <option value="zrexpress">ZR Express</option>
                    <option value="maystro">Maystro Delivery</option>
                    <option value="custom">{lang === 'fr' ? 'Personnalisée' : 'شركة مخصصة'}</option>
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-bold">{t.admin.settings.deliveryApiId}</span>
                  <input
                    type="text"
                    dir="ltr"
                    placeholder="API ID / Client ID"
                    value={settings.deliveryApiId || ''}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        deliveryApiId: e.target.value,
                      })
                    }
                    className="num h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block space-y-1 sm:col-span-2">
                  <span className="text-xs font-bold">{t.admin.settings.deliveryToken}</span>
                  <input
                    type="text"
                    dir="ltr"
                    value={deliveryTokenInput}
                    onChange={(e) => setDeliveryTokenInput(e.target.value)}
                    className="num h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
                  />
                </label>
              </div>

              <label className="inline-flex h-10 items-center gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3.5 text-xs font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(settings.deliveryEnabled)}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      deliveryEnabled: e.target.checked,
                    })
                  }
                />
                <span>{t.admin.settings.deliveryEnabled}</span>
              </label>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="h-10 rounded-lg bg-[#D7193F] px-6 text-xs sm:text-sm font-extrabold text-white hover:bg-[#B81434] transition-colors cursor-pointer"
        >
          {saving ? '...' : t.admin.settings.save}
        </button>
      </form>
    </div>
  );
}
