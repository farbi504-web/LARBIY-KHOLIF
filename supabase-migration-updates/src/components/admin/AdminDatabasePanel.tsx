import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  Database,
  RefreshCw,
  Server,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import type { DatabaseConnectionConfig, DatabaseStatusSnapshot, Lang } from '../../shared/types.ts';
import { apiJson } from '../../utils/api.ts';

const SUPABASE_REGIONS = [
  { id: 'eu-west-1', labelAr: 'غرب أوروبا — إيرلندا (West EU - Ireland)', labelFr: 'Europe Ouest — Irlande (eu-west-1)' },
  { id: 'eu-central-1', labelAr: 'وسط أوروبا — فرانكفورت (eu-central-1)', labelFr: 'Europe Centrale — Francfort (eu-central-1)' },
  { id: 'eu-west-2', labelAr: 'غرب أوروبا — لندن (eu-west-2)', labelFr: 'Europe Ouest — Londres (eu-west-2)' },
  { id: 'eu-west-3', labelAr: 'غرب أوروبا — باريس (eu-west-3)', labelFr: 'Europe Ouest — Paris (eu-west-3)' },
];

const TABLE_LABELS: Record<string, { ar: string; fr: string }> = {
  users: { ar: 'المستخدمون', fr: 'Utilisateurs' },
  sessions: { ar: 'الجلسات', fr: 'Sessions' },
  customers: { ar: 'الزبائن', fr: 'Clients' },
  categories: { ar: 'الأقسام', fr: 'Catégories' },
  products: { ar: 'المنتجات', fr: 'Produits' },
  orders: { ar: 'الطلبات', fr: 'Commandes' },
  subscriptions: { ar: 'الاشتراكات', fr: 'Abonnements' },
  media: { ar: 'الوسائط', fr: 'Médias' },
  settings: { ar: 'الإعدادات', fr: 'Paramètres' },
  audit_logs: { ar: 'سجل التدقيق', fr: 'Journal audit' },
  admin_ai_messages: { ar: 'رسائل المساعد', fr: 'Messages IA' },
  reviews: { ar: 'التقييمات', fr: 'Avis' },
  inventory_logs: { ar: 'سجل المخزون', fr: 'Journal stock' },
};

export function AdminDatabasePanel({ lang }: { lang: Lang }) {
  const isFr = lang === 'fr';
  const [snapshot, setSnapshot] = useState<DatabaseStatusSnapshot | null>(null);
  const [config, setConfig] = useState<DatabaseConnectionConfig>({
    provider: 'supabase',
    projectName: 'Librairie Slimi',
    projectRef: '',
    region: 'eu-west-1',
    host: 'aws-0-eu-west-1.pooler.supabase.com',
    port: 6543,
    databaseName: 'postgres',
    poolMode: 'transaction',
    sslEnabled: true,
    poolMax: 10,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiJson<DatabaseStatusSnapshot>('/api/admin/database/status');
      setSnapshot(data);
      setConfig(data.config);
    } catch (err) {
      setFeedback({
        ok: false,
        message: err instanceof Error ? err.message : isFr ? 'Erreur de chargement' : 'تعذّر تحميل حالة قاعدة البيانات',
      });
    } finally {
      setLoading(false);
    }
  }, [isFr]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  function handleRegionChange(nextRegion: string) {
    setConfig((prev) => {
      const nextHost =
        prev.provider === 'supabase' && prev.poolMode !== 'direct'
          ? `aws-0-${nextRegion}.pooler.supabase.com`
          : prev.host;
      return { ...prev, region: nextRegion, host: nextHost };
    });
  }

  function handlePoolModeChange(nextMode: DatabaseConnectionConfig['poolMode']) {
    setConfig((prev) => {
      const nextPort = nextMode === 'transaction' ? 6543 : 5432;
      let nextHost = prev.host;
      if (prev.provider === 'supabase') {
        nextHost =
          nextMode === 'direct'
            ? prev.projectRef
              ? `db.${prev.projectRef}.supabase.co`
              : 'db.[project-ref].supabase.co'
            : `aws-0-${prev.region}.pooler.supabase.com`;
      }
      return { ...prev, poolMode: nextMode, port: nextPort, host: nextHost };
    });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const data = await apiJson<DatabaseStatusSnapshot & { ok: boolean }>('/api/admin/database/config', {
        method: 'PUT',
        body: JSON.stringify(config),
      });
      setSnapshot(data);
      setConfig(data.config);
      setFeedback({
        ok: true,
        message: isFr
          ? 'Paramètres de connexion enregistrés.'
          : 'تم حفظ بيانات إعداد الربط بقاعدة البيانات بنجاح.',
      });
    } catch (err) {
      setFeedback({
        ok: false,
        message: err instanceof Error ? err.message : 'Save failed',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleVerify() {
    setVerifying(true);
    setFeedback(null);
    try {
      const data = await apiJson<DatabaseStatusSnapshot>('/api/admin/database/verify', {
        method: 'POST',
      });
      setSnapshot(data);
      setFeedback({
        ok: data.connected,
        message: data.connected
          ? data.activeBackend === 'postgresql'
            ? isFr
              ? `Connexion PostgreSQL (Supabase) vérifiée (${data.latencyMs} ms).`
              : `تم التحقق من الاتصال الفعلي مع Supabase PostgreSQL (${data.latencyMs} مللي ثانية).`
            : isFr
              ? `Base de secours SQLite active localement (${data.latencyMs} ms). Définissez DATABASE_URL sur le serveur pour activer PostgreSQL.`
              : `الاتصال النشط حالياً هو قاعدة التطوير المحلية SQLite (${data.latencyMs} مللي ثانية). أضف متغير DATABASE_URL في البيئة للانتقال إلى Supabase PostgreSQL.`
          : isFr
            ? 'Échec de vérification de la base de données.'
            : 'فشل الاتصال بقاعدة البيانات.',
      });
    } catch (err) {
      setFeedback({
        ok: false,
        message: err instanceof Error ? err.message : 'Verification failed',
      });
    } finally {
      setVerifying(false);
    }
  }

  const connectionTemplate = useMemo(() => {
    const ref = config.projectRef.trim() || '[project-ref]';
    const user =
      config.provider === 'supabase' && config.poolMode !== 'direct' ? `postgres.${ref}` : 'postgres';
    const host =
      config.host.trim() ||
      (config.poolMode === 'direct' ? `db.${ref}.supabase.co` : `aws-0-${config.region}.pooler.supabase.com`);
    const dbName = config.databaseName.trim() || 'postgres';
    const query = config.poolMode === 'transaction' ? '?pgbouncer=true' : '';
    return `postgresql://${user}:[YOUR-PASSWORD]@${host}:${config.port}/${dbName}${query}`;
  }, [config]);

  async function copyText(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      // Ignore clipboard failures in restricted contexts
    }
  }

  const isPg = snapshot?.activeBackend === 'postgresql';

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-lg sm:text-xl font-extrabold text-[var(--ink)]">
            {isFr ? 'Connexion Base de Données (Supabase PostgreSQL)' : 'ربط قاعدة البيانات (Supabase PostgreSQL)'}
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-[var(--ink-muted)]">
            {isFr
              ? 'Configurez les métadonnées Supabase, vérifiez la connexion active du serveur et préparez le déploiement Ample en toute sécurité.'
              : 'إدارة بيانات الربط مع Supabase PostgreSQL وفحص حالة الاتصال النشط على الخادم وتجهيز النشر على Ample بأمان.'}
          </p>
        </div>

        <button
          type="button"
          disabled={verifying || loading}
          onClick={() => void handleVerify()}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 text-xs font-extrabold text-[var(--ink)] hover:border-[#D7193F] transition-colors cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${verifying ? 'animate-spin' : ''}`} />
          <span>{isFr ? 'Vérifier la connexion' : 'فحص الاتصال بقاعدة البيانات'}</span>
        </button>
      </div>

      {snapshot?.pgError && (
        <div className="rounded-xl border border-rose-500/35 bg-rose-500/10 p-4 text-xs font-bold text-rose-800 dark:text-rose-300 space-y-1">
          <p>
            {isFr
              ? 'Échec de connexion à PostgreSQL (mode SQLite de secours actif en développement) :'
              : 'تعذّر الاتصال بـ PostgreSQL (تم تشغيل SQLite المحلي مؤقتاً في التطوير):'}
          </p>
          <p className="num font-mono text-[11px]" dir="ltr">{snapshot.pgError}</p>
          <p className="font-normal">
            {isFr
              ? 'Astuce Supabase : utilisez le Transaction Pooler IPv4 (port 6543, aws-0-eu-west-1.pooler.supabase.com) au lieu de la connexion directe IPv6 (:5432).'
              : 'تنبيه Supabase: إذا ظهر رفض اتصال IPv6 على المنفذ 5432، استبدل الرابط في DATABASE_URL برابط Transaction Pooler عبر IPv4 (المنفذ 6543).'}
          </p>
        </div>
      )}

      {feedback && (
        <div
          className={`rounded-xl border p-4 text-xs font-bold flex items-center gap-2.5 ${
            feedback.ok
              ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
              : 'border-amber-500/35 bg-amber-500/10 text-amber-800 dark:text-amber-300'
          }`}
        >
          {feedback.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Active Server Connection Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--ink-muted)]">
              {isFr ? 'Moteur actif' : 'المحرك النشط حالياً'}
            </span>
            <Database className={`h-4 w-4 ${isPg ? 'text-emerald-600' : 'text-amber-600'}`} />
          </div>
          <p className="font-display text-base font-extrabold text-[var(--ink)]">
            {loading
              ? '...'
              : isPg
                ? 'Supabase PostgreSQL'
                : isFr
                  ? 'SQLite (Mode développement)'
                  : 'SQLite (وضع التطوير المحلي)'}
          </p>
          <p className="text-[11px] text-[var(--ink-muted)]">
            {snapshot?.connected
              ? isFr
                ? `Connecté (${snapshot.latencyMs} ms)`
                : `متصل (${snapshot.latencyMs} مللي ثانية)`
              : isFr
                ? 'Hors ligne'
                : 'غير متصل'}
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--ink-muted)]">
              {isFr ? 'Variable DATABASE_URL' : 'متغير البيئة DATABASE_URL'}
            </span>
            <Server className="h-4 w-4 text-[var(--ink-muted)]" />
          </div>
          <p className="font-display text-base font-extrabold text-[var(--ink)]">
            {loading
              ? '...'
              : snapshot?.databaseUrlConfigured
                ? isFr
                  ? 'Configuré sur le serveur'
                  : 'مضبوط في الخادم'
                : isFr
                  ? 'Non défini sur le serveur'
                  : 'غير مضبوط بعد'}
          </p>
          <p className="num text-[11px] text-[var(--ink-muted)] truncate" dir="ltr">
            {snapshot?.target
              ? `${snapshot.target.host}:${snapshot.target.port}/${snapshot.target.database}`
              : 'process.env.DATABASE_URL'}
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--ink-muted)]">
              {isFr ? 'Tables prêtes' : 'جداول المخطط'}
            </span>
            <ShieldCheck className="h-4 w-4 text-[#D7193F]" />
          </div>
          <p className="num font-display text-base font-extrabold text-[var(--ink)]">
            {loading ? '...' : `${snapshot?.tables.length || 0} / 13`}
          </p>
          <p className="text-[11px] text-[var(--ink-muted)]">
            {isFr ? 'SSL requis pour Supabase' : 'تشفير TLS/SSL مفعّل لـ Supabase'}
          </p>
        </div>
      </div>

      {/* Non-Secret Database Metadata Fields */}
      <form onSubmit={handleSave} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 space-y-5">
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-[var(--border)]">
          <div>
            <h3 className="font-display text-sm sm:text-base font-extrabold text-[var(--ink)]">
              {isFr ? 'Paramètres du projet Supabase / PostgreSQL' : 'خانات إعدادات الربط (Supabase / PostgreSQL)'}
            </h3>
            <p className="text-[11px] text-[var(--ink-muted)] mt-0.5">
              {isFr
                ? 'Pour votre sécurité, le mot de passe reste exclusivement dans la variable serveur DATABASE_URL.'
                : 'لأمان حسابك، لا تُخزَّن كلمة المرور في المتصفح بل تُضاف مباشرة في متغير البيئة السري DATABASE_URL على الخادم.'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-[var(--ink)]">{isFr ? 'Fournisseur' : 'مزود قاعدة البيانات'}</span>
            <select
              value={config.provider}
              onChange={(e) => setConfig((p) => ({ ...p, provider: e.target.value as 'supabase' | 'postgres' }))}
              className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-bold text-[var(--ink)]"
            >
              <option value="supabase">Supabase PostgreSQL</option>
              <option value="postgres">PostgreSQL Standard</option>
            </select>
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-[var(--ink)]">{isFr ? 'Nom du projet' : 'اسم المشروع'}</span>
            <input
              type="text"
              value={config.projectName}
              onChange={(e) => setConfig((p) => ({ ...p, projectName: e.target.value }))}
              placeholder="Librairie Slimi"
              className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 text-sm"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-[var(--ink)]">
              {isFr ? 'Référence projet (Project Ref)' : 'مرجع المشروع (Project Ref)'}
            </span>
            <input
              type="text"
              dir="ltr"
              value={config.projectRef}
              onChange={(e) => setConfig((p) => ({ ...p, projectRef: e.target.value }))}
              placeholder="abcdefghijklmnop"
              className="num h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 text-sm"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-[var(--ink)]">{isFr ? 'Région Supabase' : 'المنطقة (Region)'}</span>
            <select
              value={config.region}
              onChange={(e) => handleRegionChange(e.target.value)}
              className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-bold text-[var(--ink)]"
            >
              {SUPABASE_REGIONS.map((r) => (
                <option key={r.id} value={r.id}>
                  {isFr ? r.labelFr : r.labelAr}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-[var(--ink)]">{isFr ? 'Mode de connexion' : 'وضع الاتصال (Pool Mode)'}</span>
            <select
              value={config.poolMode}
              onChange={(e) => handlePoolModeChange(e.target.value as DatabaseConnectionConfig['poolMode'])}
              className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-bold text-[var(--ink)]"
            >
              <option value="transaction">Transaction Pooler (6543)</option>
              <option value="session">Session Pooler (5432)</option>
              <option value="direct">Direct Connection (5432)</option>
            </select>
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-[var(--ink)]">{isFr ? 'Hôte (Host)' : 'عنوان الخادم (Host)'}</span>
            <input
              type="text"
              dir="ltr"
              value={config.host}
              onChange={(e) => setConfig((p) => ({ ...p, host: e.target.value }))}
              placeholder="aws-0-eu-west-1.pooler.supabase.com"
              className="num h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 text-sm"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-[var(--ink)]">{isFr ? 'Port' : 'المنفذ (Port)'}</span>
            <input
              type="number"
              dir="ltr"
              min={1}
              max={65535}
              value={config.port}
              onChange={(e) => setConfig((p) => ({ ...p, port: Number(e.target.value || 6543) }))}
              className="num h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 text-sm"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-[var(--ink)]">{isFr ? 'Nom de la base' : 'اسم قاعدة البيانات'}</span>
            <input
              type="text"
              dir="ltr"
              value={config.databaseName}
              onChange={(e) => setConfig((p) => ({ ...p, databaseName: e.target.value }))}
              placeholder="postgres"
              className="num h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 text-sm"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-[var(--ink)]">{isFr ? 'Connexions max (Pool)' : 'الحد الأقصى للاتصالات (Pool Max)'}</span>
            <input
              type="number"
              dir="ltr"
              min={2}
              max={30}
              value={config.poolMax}
              onChange={(e) => setConfig((p) => ({ ...p, poolMax: Number(e.target.value || 10) }))}
              className="num h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 text-sm"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          <label className="inline-flex items-center gap-2.5 text-xs font-extrabold cursor-pointer">
            <input
              type="checkbox"
              checked={config.sslEnabled}
              onChange={(e) => setConfig((p) => ({ ...p, sslEnabled: e.target.checked }))}
              className="h-4 w-4 rounded border-[var(--border)] text-[#D7193F] focus:ring-[#D7193F]"
            />
            <span>{isFr ? 'Exiger SSL / TLS (Recommandé pour Supabase)' : 'تفعيل التشفير الآمن SSL / TLS (مطلوب لـ Supabase)'}</span>
          </label>

          <button
            type="submit"
            disabled={saving}
            className="apple-btn-primary inline-flex h-11 items-center justify-center rounded-xl px-6 text-sm font-extrabold cursor-pointer disabled:opacity-50"
          >
            {saving ? '...' : isFr ? 'Enregistrer la configuration' : 'حفظ إعدادات الربط'}
          </button>
        </div>
      </form>

      {/* Safe Env Var Template & Migration Command */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 space-y-4">
        <h3 className="font-display text-sm sm:text-base font-extrabold text-[var(--ink)]">
          {isFr ? 'Chaîne de connexion serveur & Migration' : 'صيغة متغير DATABASE_URL وأمر الترحيل على Ample'}
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-alt)]/60 p-3.5">
            <code className="num text-xs text-[var(--ink)] break-all" dir="ltr">
              DATABASE_URL=&quot;{connectionTemplate}&quot;
            </code>
            <button
              type="button"
              onClick={() => void copyText('url', connectionTemplate)}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-[11px] font-bold hover:border-[#D7193F] cursor-pointer"
            >
              {copiedKey === 'url' ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copiedKey === 'url' ? (isFr ? 'Copié' : 'تم النسخ') : isFr ? 'Copier' : 'نسخ'}</span>
            </button>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-alt)]/60 p-3.5">
            <code className="num text-xs text-[var(--ink)]" dir="ltr">
              npm run db:migrate &amp;&amp; npm run build &amp;&amp; npm start
            </code>
            <button
              type="button"
              onClick={() => void copyText('cmd', 'npm run db:migrate && npm run build && npm start')}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-[11px] font-bold hover:border-[#D7193F] cursor-pointer"
            >
              {copiedKey === 'cmd' ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copiedKey === 'cmd' ? (isFr ? 'Copié' : 'تم النسخ') : isFr ? 'Copier' : 'نسخ'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Live Table Counts */}
      {snapshot && snapshot.tables.length > 0 && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 space-y-4">
          <h3 className="font-display text-sm sm:text-base font-extrabold text-[var(--ink)]">
            {isFr ? 'État des tables actives' : 'حالة الجداول وعدد السجلات الحالية'}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {snapshot.tables.map((tbl) => {
              const label = TABLE_LABELS[tbl.table];
              return (
                <div
                  key={tbl.table}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface-alt)]/40 px-3.5 py-2.5 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[var(--ink)] truncate">
                      {label ? (isFr ? label.fr : label.ar) : tbl.table}
                    </p>
                    <p className="num text-[10px] text-[var(--ink-muted)] truncate" dir="ltr">
                      {tbl.table}
                    </p>
                  </div>
                  <span className="num text-xs font-extrabold text-[#D7193F]">{tbl.rows}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
