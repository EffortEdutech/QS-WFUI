'use client';

/**
 * OwnerAssistantSidebar — Phase 2D (V4 AI Runtime)
 *
 * Slide-in panel giving owners/admins access to the AI Owner Assistant
 * from any page without leaving their current context.
 *
 * Features:
 *   - ChatMessage component with AI badge + advisory label
 *   - Source references panel (which resources AI used)
 *   - Multi-turn conversation with session memory
 *   - Wired to POST /assistant/message (Phase 2C endpoint)
 *   - Keyboard shortcut: Cmd/Ctrl + Shift + A to open/close
 *   - Read-only guardrail notice shown persistently
 *
 * Phase 2D / LADOS V4 Sprint Plan
 */

import { useState, useEffect, useRef, useCallback, useId } from 'react';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@lados/shared-types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Organization {
  id:         string;
  name:       string;
  membership: { role: string };
}

interface AssistResponse {
  response:    string;
  sessionId:   string;
  ledgerId:    string;
  tokensUsed:  number;
}

interface SourceRef {
  resourceId: string;
  resourceType: string;
}

/** UI-only message — includes source refs and tokens for display */
interface ChatTurn {
  role:        'user' | 'assistant';
  content:     string;
  tokensUsed?: number;
  sourceRefs?: SourceRef[];
  ledgerId?:   string;
  isError?:    boolean;
}

/** Wire format sent to API */
interface HistoryEntry {
  role:    'user' | 'assistant';
  content: string;
}

// ── ChatMessage sub-component ─────────────────────────────────────────────────

function ChatMessage({ turn, isLoading }: { turn: ChatTurn; isLoading?: boolean }) {
  const [showSources, setShowSources] = useState(false);

  if (isLoading) {
    return (
      <div className="flex gap-2.5 justify-start">
        <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
          🤖
        </div>
        <div className="bg-white border border-gray-200 rounded-xl rounded-bl-sm px-3.5 py-2.5 shadow-sm">
          <span className="inline-flex gap-1 items-center">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '120ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '240ms' }} />
          </span>
        </div>
      </div>
    );
  }

  if (turn.role === 'user') {
    return (
      <div className="flex gap-2.5 justify-end">
        <div className="max-w-[80%] bg-blue-600 rounded-xl rounded-br-sm px-3.5 py-2.5">
          <p className="text-xs text-white leading-relaxed whitespace-pre-wrap">{turn.content}</p>
        </div>
      </div>
    );
  }

  // ── Assistant message ────────────────────────────────────────────────────

  const lines = turn.content.split('\n');

  return (
    <div className="flex gap-2.5 justify-start">
      <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
        🤖
      </div>
      <div className="max-w-[85%] space-y-1.5">
        {/* AI advisory badge */}
        <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 uppercase tracking-wide">
          ⚠ AI · Advisory only
        </span>

        {/* Message bubble */}
        <div className={`bg-white border rounded-xl rounded-bl-sm px-3.5 py-2.5 shadow-sm ${turn.isError ? 'border-red-200 bg-red-50' : 'border-gray-200'}`}>
          <div className="space-y-1">
            {lines.map((line, i) => {
              if (line.startsWith('• ') || line.startsWith('- ')) {
                return (
                  <div key={i} className="flex gap-1.5 text-xs text-gray-800 leading-relaxed">
                    <span className="text-gray-400 flex-shrink-0 mt-0.5">•</span>
                    <span>{line.slice(2).replace(/\*\*(.*?)\*\*/g, '$1')}</span>
                  </div>
                );
              }
              if (line.trim() === '') return <div key={i} className="h-1" />;
              return (
                <p key={i} className={`text-xs leading-relaxed ${turn.isError ? 'text-red-700' : 'text-gray-800'}`}>
                  {line.replace(/\*\*(.*?)\*\*/g, '$1')}
                </p>
              );
            })}
          </div>

          {/* Token count */}
          {turn.tokensUsed !== undefined && turn.tokensUsed > 0 && (
            <p className="text-[9px] text-gray-300 mt-1.5">{turn.tokensUsed.toLocaleString()} tokens</p>
          )}
        </div>

        {/* Source references panel */}
        {turn.sourceRefs && turn.sourceRefs.length > 0 && (
          <div>
            <button
              onClick={() => setShowSources((v) => !v)}
              className="text-[10px] text-blue-500 hover:text-blue-700 underline"
            >
              {showSources ? 'Hide' : 'Show'} {turn.sourceRefs.length} source{turn.sourceRefs.length !== 1 ? 's' : ''}
            </button>
            {showSources && (
              <div className="mt-1.5 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 space-y-1">
                <p className="text-[9px] font-semibold text-blue-600 uppercase tracking-wide mb-1">
                  Resources AI referenced
                </p>
                {turn.sourceRefs.map((ref, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-blue-400 flex-shrink-0" />
                    <span className="text-[10px] text-blue-700 font-mono">{ref.resourceType}</span>
                    <span className="text-[9px] text-blue-400 font-mono truncate">{ref.resourceId.slice(0, 8)}…</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Starter prompts ───────────────────────────────────────────────────────────

const STARTERS = [
  { icon: '🏗️', label: 'Active jobs',     prompt: 'What jobs are active right now?' },
  { icon: '🚛', label: 'Trips today',     prompt: 'How many trips in progress today?' },
  { icon: '🧾', label: 'Pending invoices', prompt: 'Any invoices pending approval?' },
  { icon: '📊', label: 'Ops summary',     prompt: 'Give me a quick operations summary.' },
];

// ── Main component ────────────────────────────────────────────────────────────

interface OwnerAssistantSidebarProps {
  /** Caller can pass orgId to skip the /organizations fetch */
  orgId?: string;
}

export default function OwnerAssistantSidebar({ orgId: propOrgId }: OwnerAssistantSidebarProps = {}) {
  const [open,        setOpen]        = useState(false);
  const [org,         setOrg]         = useState<Organization | null>(null);
  const [aiEnabled,   setAiEnabled]   = useState<boolean | null>(null);
  const [turns,       setTurns]       = useState<ChatTurn[]>([]);
  const [input,       setInput]       = useState('');
  const [sending,     setSending]     = useState(false);
  const [totalTokens, setTotalTokens] = useState(0);
  const [initDone,    setInitDone]    = useState(false);

  const sessionId = useRef<string>(crypto.randomUUID());
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);
  const panelId   = useId();

  // ── Init: load org + AI status ────────────────────────────────────────────
  useEffect(() => {
    if (initDone) return;
    async function init() {
      const [orgRes, statusRes] = await Promise.allSettled([
        propOrgId
          ? Promise.resolve({ success: true, data: [{ id: propOrgId, name: '', membership: { role: 'owner' } }] })
          : apiClient.get<Organization[]>('/organizations'),
        apiClient.get<{ configured: boolean }>('/ai/status'),
      ]);
      if (orgRes.status === 'fulfilled' && orgRes.value.success) {
        // If we only have an ID (propOrgId path), fetch full org
        const first = (orgRes.value.data as Organization[] | undefined)?.[0] ?? null;
        if (first && propOrgId && !first.name) {
          const fullOrgs = await apiClient.get<Organization[]>('/organizations');
          setOrg(fullOrgs.success ? (fullOrgs.data?.[0] ?? null) : first);
        } else {
          setOrg(first);
        }
      }
      if (statusRes.status === 'fulfilled') {
        setAiEnabled(statusRes.value.data?.configured ?? false);
      }
      setInitDone(true);
    }
    init();
  }, [initDone, propOrgId]);

  // ── Keyboard shortcut: Cmd/Ctrl + Shift + A ───────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'a') {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === 'Escape' && open) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // ── Scroll to bottom on new turns ────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns, sending]);

  // ── Focus input when panel opens ──────────────────────────────────────────
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  // ── Send message ──────────────────────────────────────────────────────────
  const send = useCallback(async (text: string) => {
    if (!text.trim() || sending || !org) return;
    setInput('');

    const userTurn: ChatTurn = { role: 'user', content: text.trim() };
    const priorTurns = turns;
    setTurns((prev) => [...prev, userTurn]);
    setSending(true);

    try {
      const history: HistoryEntry[] = priorTurns
        .slice(-8)
        .map(({ role, content }) => ({ role, content }));

      const res: ApiResponse<AssistResponse> = await apiClient.post('/assistant/message', {
        orgId:     org.id,
        message:   text.trim(),
        sessionId: sessionId.current,
        history,
      });

      if (!res.success) {
        const errMsg = (res as { error?: { message?: string } }).error?.message ?? 'Server error';
        setTurns((prev) => [...prev, { role: 'assistant', content: errMsg, isError: true }]);
        return;
      }

      const reply  = res.data?.response ?? '(no response)';
      const tokens = res.data?.tokensUsed ?? 0;

      setTurns((prev) => [...prev, {
        role:      'assistant',
        content:   reply,
        tokensUsed: tokens,
        ledgerId:   res.data?.ledgerId,
      }]);
      setTotalTokens((t) => t + tokens);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Request failed';
      setTurns((prev) => [...prev, { role: 'assistant', content: msg, isError: true }]);
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [sending, turns, org]);

  const newSession = () => {
    setTurns([]);
    setTotalTokens(0);
    sessionId.current = crypto.randomUUID();
  };

  const role         = org?.membership?.role ?? '';
  const isOwnerAdmin = ['owner', 'admin'].includes(role);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Floating trigger button ── */}
      <button
        onClick={() => setOpen((v) => !v)}
        title="Owner Assistant (⌘⇧A)"
        aria-label="Open Owner Assistant"
        aria-expanded={open}
        aria-controls={panelId}
        className={`fixed bottom-20 right-5 z-40 w-10 h-10 rounded-full shadow-lg flex items-center justify-center text-base transition-all hover:scale-105 active:scale-95
          ${open ? 'bg-gray-700 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
      >
        {open ? '✕' : '💬'}
      </button>

      {/* ── Slide-in panel ── */}
      <div
        id={panelId}
        role="dialog"
        aria-label="Owner Assistant"
        className={`fixed top-0 right-0 h-full z-50 flex flex-col bg-white shadow-2xl border-l border-gray-200 transition-transform duration-300 ease-in-out
          ${open ? 'translate-x-0' : 'translate-x-full'}
          w-[380px] max-w-[100vw]`}
      >
        {/* Header */}
        <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3.5 border-b border-gray-100 bg-gradient-to-r from-blue-600 to-blue-500">
          <span className="text-xl">🤖</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">Owner Assistant</p>
            <p className="text-[10px] text-blue-100 truncate">
              {org ? `${org.name} · ${role}` : 'Loading…'}
              {totalTokens > 0 && ` · ${totalTokens.toLocaleString()} tokens`}
            </p>
          </div>
          {turns.length > 0 && (
            <button
              onClick={newSession}
              className="text-[10px] text-blue-200 hover:text-white border border-blue-400 rounded-full px-2.5 py-1 hover:border-white transition-colors flex-shrink-0"
            >
              New
            </button>
          )}
          <button
            onClick={() => setOpen(false)}
            className="text-blue-200 hover:text-white text-lg flex-shrink-0 ml-1"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* AI not configured */}
          {aiEnabled === false && (
            <div className="flex items-center justify-center h-full p-6 text-center">
              <div>
                <p className="text-3xl mb-2">🔑</p>
                <p className="text-sm font-semibold text-gray-700">AI not configured</p>
                <p className="text-xs text-gray-500 mt-1">
                  Set <code className="bg-gray-100 px-1 rounded">OPENAI_API_KEY</code> to enable.
                </p>
              </div>
            </div>
          )}

          {/* Role guard */}
          {aiEnabled !== false && !isOwnerAdmin && org && (
            <div className="flex items-center justify-center h-full p-6 text-center">
              <div>
                <p className="text-3xl mb-2">🔒</p>
                <p className="text-sm font-semibold text-gray-700">Owner / Admin only</p>
              </div>
            </div>
          )}

          {/* Chat content */}
          {aiEnabled !== false && (isOwnerAdmin || !org) && (
            <div className="p-4 space-y-3">
              {/* Guardrail notice */}
              <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2">
                <p className="text-[10px] text-amber-700">
                  <strong>Read-only:</strong> AI can observe and report only. It cannot approve, create, or change anything.
                </p>
              </div>

              {/* Empty state — starter prompts */}
              {turns.length === 0 && !sending && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-400 text-center">Quick questions:</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {STARTERS.map((s) => (
                      <button
                        key={s.label}
                        onClick={() => void send(s.prompt)}
                        className="flex flex-col gap-1 rounded-xl border border-gray-200 bg-gray-50 px-2.5 py-2 text-left hover:border-blue-300 hover:bg-blue-50 transition-colors"
                      >
                        <span className="text-base">{s.icon}</span>
                        <span className="text-[10px] font-medium text-gray-600">{s.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Message turns */}
              {turns.map((turn, i) => (
                <ChatMessage key={i} turn={turn} />
              ))}

              {/* Loading indicator */}
              {sending && (
                <ChatMessage
                  turn={{ role: 'assistant', content: '' }}
                  isLoading
                />
              )}

              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Input bar */}
        {aiEnabled !== false && (isOwnerAdmin || !org) && (
          <div className="flex-shrink-0 border-t border-gray-200 bg-white px-4 py-3">
            <div className="flex gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void send(input);
                  }
                }}
                placeholder="Ask about jobs, trips, invoices…"
                rows={2}
                disabled={sending}
                className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                style={{ maxHeight: 100 }}
              />
              <button
                onClick={() => void send(input)}
                disabled={!input.trim() || sending}
                className="self-end rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-40 transition-colors"
              >
                {sending ? '…' : '↑'}
              </button>
            </div>
            <p className="text-center text-[9px] text-gray-300 mt-1.5">
              ⌘⇧A to toggle · Shift+Enter for newline
            </p>
          </div>
        )}
      </div>

      {/* Backdrop — click to close */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}
    </>
  );
}
