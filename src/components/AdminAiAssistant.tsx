import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Bot,
  Check,
  CheckCircle2,
  Copy,
  Loader2,
  RefreshCw,
  RotateCcw,
  Send,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import { TX } from '../shared/i18n.ts';
import { sanitizeAiActions, sanitizeAiMessages } from '../shared/aiHelpers.ts';
import type { AdminAiMessage, Lang } from '../shared/types.ts';

function renderInlineBold(line: string): React.ReactNode {
  const segments = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return segments.map((seg, i) => {
    if (seg.startsWith('**') && seg.endsWith('**') && seg.length > 4) {
      return (
        <strong key={i} className="font-extrabold">
          {seg.slice(2, -2)}
        </strong>
      );
    }
    if (seg.startsWith('`') && seg.endsWith('`') && seg.length > 2) {
      return (
        <code
          key={i}
          dir="ltr"
          className="num rounded bg-black/10 dark:bg-white/15 px-1.5 py-0.5 text-[11px] font-bold"
        >
          {seg.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={i}>{seg}</React.Fragment>;
  });
}

function FormattedMessageText({ text }: { text: string }) {
  const safeText = typeof text === 'string' ? text : String(text ?? '');
  const lines = safeText.split('\n');
  return (
    <div className="space-y-1.5 text-xs sm:text-sm leading-relaxed break-words">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={idx} className="h-1" />;
        }
        if (/^[-•*]\s+/.test(trimmed)) {
          return (
            <div key={idx} className="flex items-start gap-2 ps-1">
              <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[#D7193F] shrink-0" />
              <span>{renderInlineBold(trimmed.replace(/^[-•*]\s+/, ''))}</span>
            </div>
          );
        }
        if (/^\d+\.\s+/.test(trimmed)) {
          const match = trimmed.match(/^(\d+\.)\s+(.*)$/);
          if (match) {
            return (
              <div key={idx} className="flex items-start gap-2 ps-1">
                <span className="num font-extrabold text-[#D7193F] shrink-0">{match[1]}</span>
                <span>{renderInlineBold(match[2])}</span>
              </div>
            );
          }
        }
        return <p key={idx}>{renderInlineBold(line)}</p>;
      })}
    </div>
  );
}

export function AdminAiAssistant({
  lang,
  messages,
  sending,
  error,
  lastFailedPrompt,
  variant = 'full',
  onSend,
  onClear,
  onRetry,
  onClose,
}: {
  lang: Lang;
  messages: AdminAiMessage[];
  sending: boolean;
  error: string | null;
  lastFailedPrompt?: string | null;
  variant?: 'full' | 'drawer';
  onSend: (text: string) => Promise<void> | void;
  onClear: () => Promise<void> | void;
  onRetry?: () => Promise<void> | void;
  onClose?: () => void;
}) {
  const t = TX[lang].admin.ai;
  const [input, setInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const safeMessages = useMemo(() => sanitizeAiMessages(messages), [messages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [safeMessages.length, sending, error]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [input]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const clean = input.trim();
    if (!clean || sending) return;
    setInput('');
    await onSend(clean);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const clean = input.trim();
      if (!clean || sending) return;
      setInput('');
      void onSend(clean);
    }
  }

  function handleCopy(id: string, content: string) {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(content).catch(() => {});
    }
    setCopiedId(id);
    setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1800);
  }

  const containerHeight =
    variant === 'drawer' ? 'h-[min(78vh,640px)]' : 'h-[min(76vh,720px)]';

  return (
    <div
      className={`rounded-xl overflow-hidden flex flex-col border border-[var(--border)] bg-[var(--surface)] shadow-xl ${containerHeight}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 bg-[#111318] px-4 sm:px-5 py-3.5 text-white shrink-0 border-b border-white/10">
        <div className="flex items-center gap-3 min-w-0">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#D7193F] text-white">
            <Sparkles className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-sm sm:text-base font-extrabold truncate">{t.title}</h2>
            <p className="text-[11px] text-white/70 truncate">{t.subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {safeMessages.length > 0 && (
            <button
              type="button"
              onClick={() => void onClear()}
              disabled={sending}
              title={t.newChat}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-white/10 px-3 text-xs font-bold text-white hover:bg-white/20 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t.newChat}</span>
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label={t.closePanel}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Thread */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-[var(--bg)]/50">
        {safeMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-4 sm:py-8 space-y-5">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--surface)] text-[#D7193F] border border-[var(--border)]">
              <Bot className="h-7 w-7" />
            </div>
            <div className="max-w-lg space-y-2">
              <h3 className="font-display text-base sm:text-lg font-extrabold text-[var(--ink)]">
                {t.emptyTitle}
              </h3>
              <p className="text-xs sm:text-sm leading-relaxed text-[var(--ink-muted)]">
                {t.emptyDesc}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-2xl pt-1">
              {t.prompts.map((prompt, i) => (
                <button
                  key={i}
                  type="button"
                  disabled={sending}
                  onClick={() => void onSend(prompt)}
                  className="text-start rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5 text-xs font-bold text-[var(--ink)] hover:border-[#D7193F] transition-colors cursor-pointer disabled:opacity-50"
                >
                  <p className="leading-snug">{prompt}</p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          safeMessages.map((msg) => {
            const isUser = msg.role === 'user';
            const actions = sanitizeAiActions(msg.actions);
            const isCopied = copiedId === msg.id;
            return (
              <div
                key={msg.id}
                className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
              >
                <span
                  className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white ${
                    isUser ? 'bg-[#D7193F]' : 'bg-[#111318]'
                  }`}
                >
                  {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </span>

                <div
                  className={`max-w-[85%] rounded-xl px-4 py-3 space-y-2.5 ${
                    isUser
                      ? 'bg-[#111318] text-white'
                      : 'bg-[var(--surface)] border border-[var(--border)] text-[var(--ink)]'
                  }`}
                >
                  <FormattedMessageText text={msg.content} />

                  {!isUser && actions.length > 0 && (
                    <div className="border-t border-[var(--border)] pt-2 space-y-1.5">
                      <p className="text-[11px] font-bold text-[var(--ink-muted)]">
                        {t.actionsExecuted}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {actions.map((act, idx) => (
                          <span
                            key={idx}
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold ${
                              act.ok
                                ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'
                                : 'bg-rose-500/12 text-rose-700 dark:text-rose-300'
                            }`}
                          >
                            {act.ok ? (
                              <CheckCircle2 className="h-3 w-3 shrink-0" />
                            ) : (
                              <AlertCircle className="h-3 w-3 shrink-0" />
                            )}
                            <span>{act.label}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {!isUser && (
                    <div className="flex items-center justify-end pt-0.5">
                      <button
                        type="button"
                        onClick={() => handleCopy(msg.id, msg.content)}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold text-[var(--ink-muted)] hover:bg-[var(--surface-alt)] hover:text-[var(--ink)] transition-colors cursor-pointer"
                      >
                        {isCopied ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-600" />
                            <span className="text-emerald-600">{t.copied}</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            <span>{t.copy}</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {sending && (
          <div className="flex items-start gap-2.5">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#111318] text-white">
              <Bot className="h-4 w-4" />
            </span>
            <div className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-xs font-bold text-[var(--ink-muted)]">
              <Loader2 className="h-4 w-4 animate-spin text-[#D7193F]" />
              <span>{t.thinking}</span>
            </div>
          </div>
        )}

        {error && (
          <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 p-3.5 text-xs font-bold text-rose-700 dark:text-rose-300">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="leading-relaxed">{error}</span>
            </div>
            {lastFailedPrompt && onRetry && !sending && (
              <button
                type="button"
                onClick={() => void onRetry()}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-rose-600 px-3 text-[11px] font-extrabold text-white hover:bg-rose-700 transition-colors cursor-pointer shrink-0"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>{t.retry}</span>
              </button>
            )}
          </div>
        )}

        <div ref={endRef} />
      </div>

      {safeMessages.length > 0 && variant === 'full' && (
        <div className="border-t border-[var(--border)] bg-[var(--surface)] px-4 py-2 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
          <span className="text-[10px] font-extrabold text-[var(--ink-muted)] shrink-0">
            {t.quickActions}
          </span>
          {t.prompts.slice(0, 4).map((prompt, i) => (
            <button
              key={i}
              type="button"
              disabled={sending}
              onClick={() => void onSend(prompt)}
              className="shrink-0 rounded-md border border-[var(--border)] bg-[var(--surface-alt)] px-2.5 py-1 text-[11px] font-bold text-[var(--ink)] hover:border-[#D7193F] transition-colors cursor-pointer disabled:opacity-50"
            >
              {prompt.length > 44 ? `${prompt.slice(0, 44)}…` : prompt}
            </button>
          ))}
        </div>
      )}

      {/* Input Bar */}
      <form
        onSubmit={handleSubmit}
        className="border-t border-[var(--border)] bg-[var(--surface)] p-3 sm:p-4 flex items-end gap-2.5 shrink-0"
      >
        <textarea
          ref={textareaRef}
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t.placeholder}
          disabled={sending}
          className="min-h-[42px] max-h-28 flex-1 resize-none rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-xs sm:text-sm text-[var(--ink)] placeholder:text-[var(--ink-muted)] disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[#D7193F] px-4 text-xs sm:text-sm font-extrabold text-white hover:bg-[#B81434] disabled:opacity-50 cursor-pointer shrink-0 transition-colors"
        >
          <Send className="h-4 w-4" />
          <span className="hidden sm:inline">{t.send}</span>
        </button>
      </form>
    </div>
  );
}
