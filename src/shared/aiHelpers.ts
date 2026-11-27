import type { AdminAiActionSummary, AdminAiMessage, Lang } from './types.ts';

export function sanitizeAiActions(list: unknown): AdminAiActionSummary[] {
  if (!Array.isArray(list)) return [];
  const out: AdminAiActionSummary[] = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    if (typeof obj.label !== 'string' || !obj.label.trim()) continue;
    out.push({
      tool: typeof obj.tool === 'string' ? obj.tool : 'tool',
      label: obj.label,
      ok: Boolean(obj.ok),
      mutated: obj.mutated !== undefined ? Boolean(obj.mutated) : undefined,
    });
  }
  return out;
}

export function sanitizeAiMessages(list: unknown): AdminAiMessage[] {
  if (!Array.isArray(list)) return [];
  const out: AdminAiMessage[] = [];
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    if (obj.role !== 'user' && obj.role !== 'assistant') continue;
    const content = typeof obj.content === 'string' ? obj.content : String(obj.content ?? '');
    if (!content.trim()) continue;
    out.push({
      id: typeof obj.id === 'string' && obj.id ? obj.id : `aim_safe_${i}`,
      role: obj.role,
      content,
      actions: sanitizeAiActions(obj.actions),
      createdAt: typeof obj.createdAt === 'string' && obj.createdAt ? obj.createdAt : new Date().toISOString(),
    });
  }
  return out;
}

export function extractRawApiErrorText(rawMessage: string): string {
  const trimmed = (rawMessage || '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as { error?: { message?: string; status?: string }; message?: string };
      if (parsed?.error?.message) return String(parsed.error.message);
      if (parsed?.message) return String(parsed.message);
    } catch {
      // keep trimmed raw string
    }
  }
  return trimmed;
}

export function parseGeminiErrorMessage(
  rawMessage: string,
  statusCode: number,
  lang: Lang,
): { status: number; message: string } {
  const msg = rawMessage || '';
  const lower = msg.toLowerCase();
  const isFr = lang === 'fr';

  if (
    msg.includes('GEMINI_API_KEY') ||
    msg.includes('PERMISSION_DENIED') ||
    msg.includes('API_KEY_INVALID') ||
    lower.includes('api key not valid') ||
    statusCode === 403
  ) {
    return {
      status: statusCode === 503 ? 503 : 400,
      message: isFr
        ? 'Clé API Gemini manquante ou invalide. Vérifiez GEMINI_API_KEY dans Settings > Secrets.'
        : 'مفتاح Gemini API غير متوفر أو غير صالح. يرجى التحقق من GEMINI_API_KEY في لوحة Settings > Secrets.',
    };
  }

  if (msg.includes('UNAVAILABLE') || statusCode === 503 || lower.includes('high demand')) {
    return {
      status: 503,
      message: isFr
        ? 'Le service IA connaît une forte affluence momentanée. Réessayez dans quelques secondes.'
        : 'يشهد المساعد الذكي ضغطًا مؤقتًا في الطلبات حاليًا. يرجى المحاولة مرة أخرى بعد لحظات.',
    };
  }

  if (msg.includes('RESOURCE_EXHAUSTED') || statusCode === 429 || lower.includes('quota')) {
    return {
      status: 429,
      message: isFr
        ? 'Limite temporaire de requêtes atteinte. Patientez quelques instants ou vérifiez votre quota dans Settings > Secrets.'
        : 'تم بلوغ الحد المؤقت للطلبات. انتظر لحظة ثم أعد المحاولة أو تحقق من الحصة في Settings > Secrets.',
    };
  }

  if (msg.includes('NOT_FOUND') || statusCode === 404) {
    return {
      status: 404,
      message: isFr
        ? 'Le modèle IA configuré est introuvable. Contactez le support technique.'
        : 'نموذج الذكاء الاصطناعي المحدد غير متاح حاليًا.',
    };
  }

  const extracted = extractRawApiErrorText(msg);
  return {
    status: statusCode >= 400 && statusCode < 600 ? statusCode : 500,
    message:
      extracted ||
      (isFr ? 'Erreur lors de la communication avec l’assistant IA.' : 'تعذر الاتصال بالمساعد الذكي حاليًا.'),
  };
}
