import React, { useState } from 'react';
import { Check, CheckCircle2, Truck, RefreshCw, Key, ShieldCheck } from 'lucide-react';
import { TX } from '../../shared/i18n.ts';
import type { AdminSettings, Lang } from '../../shared/types.ts';
import { apiJson } from '../../utils/api.ts';

export function AdminDeliveryIntegrationPanel({
  lang,
  settings,
  onReload,
}: {
  lang: Lang;
  settings: AdminSettings;
  onReload: () => void;
}) {
  const t = TX[lang];
  const [provider, setProvider] = useState<AdminSettings['deliveryProvider']>(settings.deliveryProvider || 'none');
  const [enabled, setEnabled] = useState<boolean>(Boolean(settings.deliveryEnabled));
  const [apiId, setApiId] = useState<string>(settings.deliveryApiId || '');
  const [tokenInput, setTokenInput] = useState<string>(settings.deliveryTokenMasked || '');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload: Record<string, unknown> = {
        deliveryProvider: provider,
        deliveryEnabled: enabled,
        deliveryApiId: apiId.trim(),
      };
      if (tokenInput && !tokenInput.includes('••••')) {
        payload.deliveryToken = tokenInput.trim();
      }

      await apiJson('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      setSuccess(lang === 'fr' ? 'Paramètres de livraison enregistrés avec succès.' : 'تم حفظ إعدادات شركة التوصيل بنجاح.');
      onReload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleTestConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      if (provider === 'none') {
        setTestResult({
          ok: false,
          message: lang === 'fr' ? 'Veuillez sélectionner une société de livraison.' : 'يرجى اختيار شركة توصيل أولاً.',
        });
        return;
      }
      if ((!apiId.trim() && provider !== 'maystro') || (!tokenInput.trim() && !settings.deliveryKeyFromEnv)) {
        setTestResult({
          ok: false,
          message: lang === 'fr' ? 'Clé API ou ID manquant.' : 'معرّف أو رمز التوثيق (API Token) مطلوب لاختبار الاتصال.',
        });
        return;
      }
      const res = await apiJson<{ ok: boolean; verifiedLocally?: boolean; message?: string }>(
        '/api/admin/delivery/test',
        {
          method: 'POST',
          body: JSON.stringify({
            provider,
            apiId: apiId.trim(),
            token: tokenInput.trim(),
          }),
        },
      );
      setTestResult({
        ok: Boolean(res.ok),
        message: res.verifiedLocally
          ? (lang === 'fr'
              ? 'Identifiants enregistrés (transporteur personnalisé sans URL de test automatique).'
              : 'تم التحقق من توفر البيانات محلياً (شركة مخصصة بدون رابط اختبار تلقائي).')
          : (lang === 'fr'
              ? `Connexion réelle vérifiée avec ${provider.toUpperCase()} (API OK).`
              : `تم التحقق الفعلي من الاتصال مع ${provider === 'yalidine' ? 'Yalidine Express' : provider === 'zrexpress' ? 'ZR Express' : 'Maystro Delivery'} بنجاح.`),
      });
    } catch (err) {
      setTestResult({
        ok: false,
        message: err instanceof Error
          ? err.message
          : (lang === 'fr' ? 'Échec de connexion avec le transporteur.' : 'تعذّر التحقق من الاتصال مع شركة التوصيل.'),
      });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="font-display text-lg sm:text-xl font-extrabold text-[var(--ink)]">
          {lang === 'fr' ? 'Intégration des sociétés de livraison' : 'ربط شركات التوصيل وإدارة الشحن'}
        </h2>
        <p className="mt-1 text-xs sm:text-sm text-[var(--ink-muted)]">
          {lang === 'fr'
            ? 'Connectez vos comptes Yalidine Express, ZR Express ou Maystro pour automatiser le calcul des frais et la transmission des commandes.'
            : 'اربط متجرك بشركات التوصيل (مثل Yalidine و ZR Express) لحساب رسوم الشحن تلقائياً حسب الولاية وإرسال الطلبات.'}
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/35 bg-rose-500/10 p-4 text-xs font-bold text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 p-4 text-xs font-bold text-emerald-700 dark:text-emerald-300">
          {success}
        </div>
      )}

      <form onSubmit={handleSave} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-[var(--ink)]">
              {lang === 'fr' ? 'Société de livraison partenaire' : 'شركة التوصيل المفعلة'}
            </span>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as AdminSettings['deliveryProvider'])}
              className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-bold text-[var(--ink)]"
            >
              <option value="none">{lang === 'fr' ? 'Aucune (Manuel)' : 'بدون (شحن يدوي)'}</option>
              <option value="yalidine">Yalidine Express</option>
              <option value="zrexpress">ZR Express</option>
              <option value="maystro">Maystro Delivery</option>
              <option value="custom">{lang === 'fr' ? 'Personnalisée' : 'شركة توصيل أخرى'}</option>
            </select>
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-[var(--ink)]">
              {lang === 'fr' ? "Identifiant API / Client ID" : 'معرّف العميل (API ID / Client ID)'}
            </span>
            <input
              type="text"
              dir="ltr"
              placeholder="e.g. 12345678"
              value={apiId}
              onChange={(e) => setApiId(e.target.value)}
              className="num h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 text-sm"
            />
          </label>
        </div>

        <div className="space-y-1.5">
          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-[var(--ink)]">
              {lang === 'fr' ? 'Jeton d’accès API (Token / Secret Key)' : 'رمز التوثيق السري (API Token / Secret Key)'}
            </span>
            <div className="relative">
              <Key className="pointer-events-none absolute top-1/2 start-3.5 -translate-y-1/2 h-4 w-4 text-[var(--ink-muted)]" />
              <input
                type="text"
                dir="ltr"
                placeholder="Bearer Token / Secret"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                className="num h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] ps-10 pe-3.5 text-sm"
              />
            </div>
          </label>
          <p className="text-[11px] text-[var(--ink-muted)]">
            {lang === 'fr'
              ? 'Vos clés d’accès sont stockées de manière sécurisée et ne sont utilisées que pour la communication avec l’API du transporteur.'
              : 'يتم تشفير وتخزين مفاتيح الربط بسرية تامة ولا تُستخدم إلا للتواصل مع منصة شركة التوصيل المختارة.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-[var(--border)]">
          <label className="inline-flex items-center gap-2.5 text-xs font-extrabold cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-[var(--border)] text-[#D7193F] focus:ring-[#D7193F]"
            />
            <span>{lang === 'fr' ? 'Activer le calcul automatique et l’envoi des commandes' : 'تفعيل حساب رسوم الشحن وإرسال الطلبات للشركة'}</span>
          </label>

          <button
            type="button"
            disabled={testing}
            onClick={() => void handleTestConnection()}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] px-4 text-xs font-bold text-[var(--ink)] hover:border-[#D7193F] transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${testing ? 'animate-spin' : ''}`} />
            <span>{lang === 'fr' ? 'Tester la connexion API' : 'اختبار الاتصال بالشركة'}</span>
          </button>
        </div>

        {testResult && (
          <div
            className={`rounded-xl p-4 text-xs font-bold flex items-center gap-2.5 ${
              testResult.ok
                ? 'bg-emerald-500/12 text-emerald-800 dark:text-emerald-300 border border-emerald-500/25'
                : 'bg-rose-500/12 text-rose-800 dark:text-rose-300 border border-rose-500/25'
            }`}
          >
            {testResult.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <Truck className="h-4 w-4 shrink-0" />}
            <span>{testResult.message}</span>
          </div>
        )}

        <div className="pt-2">
          <button
            type="submit"
            disabled={saving}
            className="apple-btn-primary inline-flex h-11 items-center justify-center rounded-xl px-6 text-sm font-extrabold cursor-pointer disabled:opacity-50"
          >
            {saving ? '...' : lang === 'fr' ? 'Enregistrer les paramètres de livraison' : 'حفظ إعدادات شركة التوصيل'}
          </button>
        </div>
      </form>

      {/* Info Card on Shipping Zones & Rates */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 space-y-4">
        <div className="flex items-center gap-2.5 text-[var(--ink)]">
          <ShieldCheck className="h-5 w-5 text-[#D7193F]" />
          <h3 className="font-display text-sm sm:text-base font-extrabold">
            {lang === 'fr' ? 'Règles tarifaires de livraison par wilaya' : 'قواعد تسعير الشحن التلقائي حسب الولايات'}
          </h3>
        </div>
        <p className="text-xs sm:text-sm text-[var(--ink-muted)] leading-relaxed">
          {lang === 'fr'
            ? 'Le système calcule automatiquement les frais de livraison lors du passage de la commande selon les zones géographiques :'
            : 'يقوم النظام تلقائياً بحساب رسوم الشحن عند إتمام الطلب بناءً على النطاق الجغرافي للولاية المختارة:'}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-alt)]/50 p-3.5 space-y-1">
            <p className="font-extrabold text-[var(--ink)]">{lang === 'fr' ? 'Zone A (Proche)' : 'المنطقة أ (قريبة)'}</p>
            <p className="text-[var(--ink-muted)]">Tipaza, Alger, Blida, Boumerdès</p>
            <p className="num font-extrabold text-[#D7193F]">400 DA / دج</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-alt)]/50 p-3.5 space-y-1">
            <p className="font-extrabold text-[var(--ink)]">{lang === 'fr' ? 'Zone B (Centre / Est / Ouest)' : 'المنطقة ب (الوسط والشرق والغرب)'}</p>
            <p className="text-[var(--ink-muted)]">{lang === 'fr' ? 'Autres wilayas nord' : 'باقي ولايات الشمال والوسط'}</p>
            <p className="num font-extrabold text-[#D7193F]">600 DA / دج</p>
          </div>
          <div className="rounded-xl border border-[var(--surface-alt)] bg-[var(--surface-alt)]/50 p-3.5 space-y-1">
            <p className="font-extrabold text-[var(--ink)]">{lang === 'fr' ? 'Zone C (Grand Sud)' : 'المنطقة ج (الجنوب الكبير)'}</p>
            <p className="text-[var(--ink-muted)]">Adrar, Tamanrasset, Illizi, etc.</p>
            <p className="num font-extrabold text-[#D7193F]">1000 DA / دج</p>
          </div>
        </div>
      </div>
    </div>
  );
}
