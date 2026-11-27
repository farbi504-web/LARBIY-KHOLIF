import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarPlus,
  Edit3,
  MessageCircle,
  Search,
  Trash2,
} from 'lucide-react';
import { normalizeAlgerianPhone } from '../../shared/commerce.ts';
import { TX } from '../../shared/i18n.ts';
import type {
  AuditEntry,
  Lang,
  StaffPermission,
  StaffUser,
  SubscriptionRecord,
} from '../../shared/types.ts';

function addDaysIso(baseDateStr: string, days: number): string {
  const baseTs = new Date(baseDateStr).getTime();
  const start = Number.isFinite(baseTs) ? Math.max(baseTs, Date.now()) : Date.now();
  return new Date(start + days * 86_400_000).toISOString().slice(0, 10);
}

export function AdminSubscriptionsPanel({
  lang,
  subs,
  prefill,
  onClearPrefill,
  onCreateSub,
  onUpdateSub,
  onDeleteSub,
}: {
  lang: Lang;
  subs: SubscriptionRecord[];
  prefill?: {
    orderId?: string | null;
    orderCode?: string;
    customerName: string;
    customerPhone: string;
    serviceName: string;
    planLabel: string;
    accountInfo: string;
  } | null;
  onClearPrefill?: () => void;
  onCreateSub: (payload: {
    orderId?: string | null;
    orderCode?: string;
    customerName: string;
    customerPhone: string;
    serviceName: string;
    planLabel: string;
    accountInfo: string;
    startDate: string;
    endDate: string;
    notes?: string;
  }) => Promise<void>;
  onUpdateSub: (
    id: string,
    patch: {
      status?: SubscriptionRecord['status'];
      endDate?: string;
      accountInfo?: string;
      notes?: string;
    },
  ) => Promise<void>;
  onDeleteSub: (id: string) => Promise<void>;
}) {
  const t = TX[lang];
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | SubscriptionRecord['status']>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{
    endDate: string;
    accountInfo: string;
    notes: string;
    status: SubscriptionRecord['status'];
  }>({
    endDate: '',
    accountInfo: '',
    notes: '',
    status: 'active',
  });

  const [newSub, setNewSub] = useState({
    orderId: null as string | null,
    orderCode: '',
    customerName: '',
    customerPhone: '',
    serviceName: '',
    planLabel: '',
    accountInfo: '',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
    notes: '',
  });

  useEffect(() => {
    if (prefill) {
      setNewSub((prev) => ({
        ...prev,
        orderId: prefill.orderId ?? null,
        orderCode: prefill.orderCode || '',
        customerName: prefill.customerName,
        customerPhone: prefill.customerPhone,
        serviceName: prefill.serviceName,
        planLabel: prefill.planLabel,
        accountInfo: prefill.accountInfo,
      }));
    }
  }, [prefill]);

  const filteredSubs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return subs.filter((s) => {
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;
      if (q) {
        const hit =
          s.customerName.toLowerCase().includes(q) ||
          s.customerPhone.toLowerCase().includes(q) ||
          s.serviceName.toLowerCase().includes(q) ||
          (s.accountInfo || '').toLowerCase().includes(q) ||
          (s.orderCode || '').toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [subs, search, statusFilter]);

  async function handleSubmitNew(e: React.FormEvent) {
    e.preventDefault();
    await onCreateSub(newSub);
    setNewSub({
      orderId: null,
      orderCode: '',
      customerName: '',
      customerPhone: '',
      serviceName: '',
      planLabel: '',
      accountInfo: '',
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
      notes: '',
    });
    if (onClearPrefill) onClearPrefill();
  }

  return (
    <div className="space-y-5">
      <h2 className="font-display text-lg sm:text-xl font-extrabold text-[var(--ink)]">
        {t.admin.subs.title}
      </h2>

      {/* Add Subscription Form */}
      <form
        onSubmit={handleSubmitNew}
        className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 space-y-3"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <input
            type="text"
            required
            placeholder={t.admin.subs.customer}
            value={newSub.customerName}
            onChange={(e) => setNewSub({ ...newSub, customerName: e.target.value })}
            className="h-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-xs"
          />
          <input
            type="tel"
            required
            dir="ltr"
            placeholder={t.admin.subs.phone}
            value={newSub.customerPhone}
            onChange={(e) => setNewSub({ ...newSub, customerPhone: e.target.value })}
            className="num h-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-xs"
          />
          <input
            type="text"
            required
            placeholder={t.admin.subs.service}
            value={newSub.serviceName}
            onChange={(e) => setNewSub({ ...newSub, serviceName: e.target.value })}
            className="h-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-xs"
          />
          <input
            type="text"
            placeholder={t.admin.subs.plan}
            value={newSub.planLabel}
            onChange={(e) => setNewSub({ ...newSub, planLabel: e.target.value })}
            className="h-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-xs"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
          <input
            type="text"
            placeholder={t.admin.subs.accountInfo}
            value={newSub.accountInfo}
            onChange={(e) => setNewSub({ ...newSub, accountInfo: e.target.value })}
            className="sm:col-span-5 h-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-xs"
          />
          <input
            type="date"
            aria-label={t.admin.subs.startDate}
            value={newSub.startDate}
            onChange={(e) => setNewSub({ ...newSub, startDate: e.target.value })}
            className="num sm:col-span-2 h-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs"
          />
          <input
            type="date"
            aria-label={t.admin.subs.endDate}
            value={newSub.endDate}
            onChange={(e) => setNewSub({ ...newSub, endDate: e.target.value })}
            className="num sm:col-span-2 h-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs"
          />
          <button
            type="submit"
            className="sm:col-span-3 h-10 rounded-lg bg-[#D7193F] px-4 text-xs font-extrabold text-white hover:bg-[#B81434] transition-colors cursor-pointer"
          >
            {t.admin.subs.add}
          </button>
        </div>
      </form>

      {/* Search & Status Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 start-3 -translate-y-1/2 h-4 w-4 text-[var(--ink-muted)]" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.admin.subs.searchPlaceholder}
            className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] ps-9 pe-3 text-xs sm:text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as 'all' | SubscriptionRecord['status'])
          }
          className="h-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-bold"
        >
          <option value="all">{t.admin.subs.allStatuses}</option>
          <option value="active">{t.admin.subs.active}</option>
          <option value="expiring">{t.admin.subs.expiringSoon}</option>
          <option value="expired">{t.admin.subs.expired}</option>
          <option value="cancelled">{t.admin.subs.cancelled}</option>
        </select>
      </div>

      {/* Subscriptions List */}
      {filteredSubs.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--ink-muted)]">
          {t.admin.subs.empty}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSubs.map((s) => {
            const daysLeft = Math.ceil((new Date(s.endDate).getTime() - Date.now()) / 86_400_000);
            const expiringSoon =
              daysLeft >= 0 && daysLeft <= 7 && (s.status === 'active' || s.status === 'expiring');
            const isEditing = editingId === s.id;
            const waText =
              lang === 'fr'
                ? `Bonjour ${s.customerName}, votre abonnement ${s.serviceName} (${s.planLabel || ''}) arrive à échéance le ${s.endDate}. Souhaitez-vous le renouveler ?`
                : `مرحبًا ${s.customerName}، اشتراكك في ${s.serviceName} (${s.planLabel || ''}) ينتهي بتاريخ ${s.endDate}. هل ترغب في تجديده؟`;
            const waUrl = `https://wa.me/${encodeURIComponent(
              normalizeAlgerianPhone(s.customerPhone),
            )}?text=${encodeURIComponent(waText)}`;

            return (
              <div
                key={s.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-display text-sm font-extrabold text-[var(--ink)]">
                        {s.serviceName} {s.planLabel ? `(${s.planLabel})` : ''}
                      </p>
                      {s.orderCode && (
                        <span className="num rounded bg-[var(--surface-alt)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--ink-muted)] border border-[var(--border)]">
                          {s.orderCode}
                        </span>
                      )}
                      {expiringSoon && (
                        <span className="rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300">
                          {t.admin.subs.expiringSoon}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--ink-muted)]">
                      {s.customerName} · <span className="num">{s.customerPhone}</span> ·{' '}
                      <span className="num font-bold text-[var(--ink)]">{s.endDate}</span>
                    </p>
                    {s.accountInfo && (
                      <p className="num text-[11px] text-[var(--ink-muted)]">{s.accountInfo}</p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <select
                      value={s.status}
                      onChange={(e) =>
                        void onUpdateSub(s.id, {
                          status: e.target.value as SubscriptionRecord['status'],
                        })
                      }
                      className="h-8 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-xs font-bold"
                    >
                      <option value="active">{t.admin.subs.active}</option>
                      <option value="expiring">{t.admin.subs.expiringSoon}</option>
                      <option value="expired">{t.admin.subs.expired}</option>
                      <option value="cancelled">{t.admin.subs.cancelled}</option>
                    </select>

                    <button
                      type="button"
                      onClick={() =>
                        void onUpdateSub(s.id, {
                          endDate: addDaysIso(s.endDate, 30),
                          status: 'active',
                        })
                      }
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] px-2.5 text-[11px] font-bold text-[var(--ink)] hover:border-[#D7193F] cursor-pointer"
                    >
                      <CalendarPlus className="h-3.5 w-3.5 text-[#D7193F]" />
                      <span>{t.admin.subs.renew30}</span>
                    </button>

                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={t.admin.subs.whatsappRemind}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                    </a>

                    <button
                      type="button"
                      onClick={() => {
                        if (isEditing) {
                          setEditingId(null);
                        } else {
                          setEditingId(s.id);
                          setEditDraft({
                            endDate: s.endDate,
                            accountInfo: s.accountInfo || '',
                            notes: s.notes || '',
                            status: s.status,
                          });
                        }
                      }}
                      title={t.admin.subs.edit}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--ink)] hover:border-[#D7193F] cursor-pointer"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => void onDeleteSub(s.id)}
                      aria-label={t.admin.products.delete}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-rose-600 hover:bg-rose-500/10 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {isEditing && (
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 pt-3 border-t border-[var(--border)] items-end">
                    <label className="sm:col-span-3 block space-y-1">
                      <span className="text-[11px] font-bold text-[var(--ink-muted)]">
                        {t.admin.subs.endDate}
                      </span>
                      <input
                        type="date"
                        value={editDraft.endDate}
                        onChange={(e) => setEditDraft({ ...editDraft, endDate: e.target.value })}
                        className="num h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs"
                      />
                    </label>
                    <label className="sm:col-span-4 block space-y-1">
                      <span className="text-[11px] font-bold text-[var(--ink-muted)]">
                        {t.admin.subs.accountInfo}
                      </span>
                      <input
                        type="text"
                        value={editDraft.accountInfo}
                        onChange={(e) => setEditDraft({ ...editDraft, accountInfo: e.target.value })}
                        className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs"
                      />
                    </label>
                    <label className="sm:col-span-3 block space-y-1">
                      <span className="text-[11px] font-bold text-[var(--ink-muted)]">
                        {t.admin.subs.notes}
                      </span>
                      <input
                        type="text"
                        value={editDraft.notes}
                        onChange={(e) => setEditDraft({ ...editDraft, notes: e.target.value })}
                        className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={async () => {
                        await onUpdateSub(s.id, editDraft);
                        setEditingId(null);
                      }}
                      className="sm:col-span-2 h-9 rounded-lg bg-[#D7193F] px-3 text-xs font-bold text-white hover:bg-[#B81434] cursor-pointer"
                    >
                      {t.admin.subs.save}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function AdminStaffPanel({
  lang,
  staff,
  onCreateStaff,
  onUpdateStaff,
  onDeleteStaff,
}: {
  lang: Lang;
  staff: StaffUser[];
  onCreateStaff: (payload: {
    username: string;
    displayName: string;
    password: string;
    permissions: StaffPermission[];
  }) => Promise<void>;
  onUpdateStaff: (
    id: string,
    patch: { permissions?: StaffPermission[]; active?: boolean; password?: string },
  ) => Promise<void>;
  onDeleteStaff: (id: string) => Promise<void>;
}) {
  const t = TX[lang];
  const [newStaff, setNewStaff] = useState({
    username: '',
    displayName: '',
    password: '',
    permissions: ['orders', 'products'] as StaffPermission[],
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPerms, setEditPerms] = useState<StaffPermission[]>([]);
  const [editActive, setEditActive] = useState(true);
  const [editPassword, setEditPassword] = useState('');

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    await onCreateStaff(newStaff);
    setNewStaff({
      username: '',
      displayName: '',
      password: '',
      permissions: ['orders', 'products'],
    });
  }

  return (
    <div className="space-y-5">
      <h2 className="font-display text-lg sm:text-xl font-extrabold text-[var(--ink)]">
        {t.admin.staff.title}
      </h2>

      <form
        onSubmit={handleAdd}
        className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 space-y-3"
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="text"
            required
            dir="ltr"
            placeholder={t.admin.staff.username}
            value={newStaff.username}
            onChange={(e) => setNewStaff({ ...newStaff, username: e.target.value })}
            className="h-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-xs"
          />
          <input
            type="text"
            required
            placeholder={t.admin.staff.displayName}
            value={newStaff.displayName}
            onChange={(e) => setNewStaff({ ...newStaff, displayName: e.target.value })}
            className="h-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-xs"
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder={t.admin.staff.password}
            value={newStaff.password}
            onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
            className="h-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-xs"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {(['orders', 'products', 'subscriptions', 'settings', 'audit', 'reports'] as StaffPermission[]).map(
            (perm) => (
              <label key={perm} className="inline-flex items-center gap-1.5 text-xs font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={newStaff.permissions.includes(perm)}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...newStaff.permissions, perm]
                      : newStaff.permissions.filter((p) => p !== perm);
                    setNewStaff({ ...newStaff, permissions: next });
                  }}
                />
                <span>{t.admin.nav[perm]}</span>
              </label>
            ),
          )}
        </div>
        <button
          type="submit"
          className="h-10 rounded-lg bg-[#D7193F] px-4 text-xs font-extrabold text-white hover:bg-[#B81434] transition-colors cursor-pointer"
        >
          {t.admin.staff.add}
        </button>
      </form>

      {staff.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[var(--ink-muted)]">
          {t.admin.staff.empty}
        </div>
      ) : (
        <div className="space-y-3">
          {staff.map((st) => {
            const isEditing = editingId === st.id;
            return (
              <div
                key={st.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm text-[var(--ink)]">
                        {st.displayName} <span dir="ltr" className="num text-xs text-[var(--ink-muted)]">(@{st.username})</span>
                      </p>
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                          st.active
                            ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'
                            : 'bg-rose-500/12 text-rose-700 dark:text-rose-300'
                        }`}
                      >
                        {st.active ? t.admin.staff.active : t.admin.staff.disabled}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--ink-muted)]">
                      {st.permissions.map((p) => t.admin.nav[p]).join(' · ')}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (isEditing) {
                          setEditingId(null);
                        } else {
                          setEditingId(st.id);
                          setEditPerms([...st.permissions]);
                          setEditActive(st.active);
                          setEditPassword('');
                        }
                      }}
                      className="h-8 rounded-lg border border-[var(--border)] px-3 text-xs font-bold text-[var(--ink)] hover:border-[#D7193F] cursor-pointer"
                    >
                      {t.admin.staff.edit}
                    </button>
                    <button
                      type="button"
                      onClick={() => void onDeleteStaff(st.id)}
                      className="h-8 rounded-lg bg-rose-600/10 px-3 text-xs font-bold text-rose-600 hover:bg-rose-600/20 cursor-pointer"
                    >
                      {t.admin.products.delete}
                    </button>
                  </div>
                </div>

                {isEditing && (
                  <div className="pt-3 border-t border-[var(--border)] space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      {(['orders', 'products', 'subscriptions', 'settings', 'audit', 'reports'] as StaffPermission[]).map(
                        (perm) => (
                          <label key={perm} className="inline-flex items-center gap-1.5 text-xs font-bold cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editPerms.includes(perm)}
                              onChange={(e) => {
                                setEditPerms((prev) =>
                                  e.target.checked
                                    ? [...prev, perm]
                                    : prev.filter((p) => p !== perm),
                                );
                              }}
                            />
                            <span>{t.admin.nav[perm]}</span>
                          </label>
                        ),
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <label className="inline-flex items-center gap-1.5 text-xs font-bold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editActive}
                          onChange={(e) => setEditActive(e.target.checked)}
                        />
                        <span>{t.admin.staff.active}</span>
                      </label>

                      <input
                        type="password"
                        minLength={6}
                        placeholder={t.admin.staff.newPasswordOptional}
                        value={editPassword}
                        onChange={(e) => setEditPassword(e.target.value)}
                        className="h-9 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-xs flex-1 min-w-[180px]"
                      />

                      <button
                        type="button"
                        onClick={async () => {
                          await onUpdateStaff(st.id, {
                            permissions: editPerms,
                            active: editActive,
                            password: editPassword.length >= 6 ? editPassword : undefined,
                          });
                          setEditingId(null);
                        }}
                        className="h-9 rounded-lg bg-[#D7193F] px-4 text-xs font-bold text-white hover:bg-[#B81434] cursor-pointer"
                      >
                        {t.admin.staff.save}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function AdminAuditPanel({
  lang,
  auditLogs,
}: {
  lang: Lang;
  auditLogs: AuditEntry[];
}) {
  const t = TX[lang];
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');

  const uniqueActions = useMemo(
    () => Array.from(new Set(auditLogs.map((l) => l.action))).sort(),
    [auditLogs],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return auditLogs.filter((log) => {
      if (actionFilter !== 'all' && log.action !== actionFilter) return false;
      if (q) {
        const hit =
          log.actorUsername.toLowerCase().includes(q) ||
          log.action.toLowerCase().includes(q) ||
          log.targetId.toLowerCase().includes(q) ||
          log.targetType.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [auditLogs, search, actionFilter]);

  return (
    <div className="space-y-4">
      <h2 className="font-display text-lg sm:text-xl font-extrabold text-[var(--ink)]">
        {t.admin.audit.title}
      </h2>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 start-3 -translate-y-1/2 h-4 w-4 text-[var(--ink-muted)]" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.admin.audit.searchPlaceholder}
            className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] ps-9 pe-3 text-xs sm:text-sm"
          />
        </div>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="h-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-bold"
        >
          <option value="all">{t.admin.audit.allActions}</option>
          {uniqueActions.map((act) => (
            <option key={act} value={act}>
              {act}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--ink-muted)]">
          {t.admin.audit.empty}
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-x-auto">
          <table className="w-full text-start text-xs border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-alt)]/60 text-[var(--ink-muted)] text-[11px]">
                <th className="p-3 text-start font-bold">{t.admin.audit.actor}</th>
                <th className="p-3 text-start font-bold">{t.admin.audit.action}</th>
                <th className="p-3 text-start font-bold">{t.admin.audit.target}</th>
                <th className="p-3 text-start font-bold">{t.admin.audit.details}</th>
                <th className="p-3 text-start font-bold">{t.admin.audit.date}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filtered.map((log) => {
                const detailsText =
                  log.details && Object.keys(log.details).length > 0
                    ? Object.entries(log.details)
                        .map(([k, v]) => `${k}: ${String(v)}`)
                        .join(' · ')
                    : '—';
                return (
                  <tr key={log.id} className="hover:bg-[var(--surface-alt)]/40">
                    <td className="p-3 font-bold text-[var(--ink)]">{log.actorUsername}</td>
                    <td className="p-3 font-mono text-[11px] font-bold text-[#D7193F]">
                      {log.action}
                    </td>
                    <td className="p-3 num">
                      {log.targetType}:{log.targetId}
                    </td>
                    <td className="p-3 text-[11px] text-[var(--ink-muted)] max-w-[260px] truncate">
                      {detailsText}
                    </td>
                    <td className="p-3 num text-[var(--ink-muted)] whitespace-nowrap">
                      {log.createdAt.slice(0, 19).replace('T', ' ')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
