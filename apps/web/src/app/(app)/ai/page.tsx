'use client';

/**
 * AI Insights — /ai
 * Phase 15: Business intelligence chat using POST /ai/assist.
 *
 * Tool-calling against live org resources + events. Read-only.
 * Owner / admin only (enforced server-side).
 *
 * Bugs fixed vs. original dashboard widget:
 *   1. History stripped of UI-only fields (tokensUsed) before sending to API —
 *      prevents forbidNonWhitelisted 400 on second+ turn.
 *   2. Current user message NOT included in history — prevents duplicate user
 *      message being sent to OpenAI (which could cause API errors).
 *   3. res.success checked before accessing res.data — surfaces real error messages.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@lados/shared-types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Organization {
  id:         string;
  name:       string;
  membership: { role: string };
}

interface AssistResponse {
  response:   string;
  sessionId:  string;
  ledgerId:   string;
  tokensUsed: number;
}

/** UI-only message — tokensUsed is never sent to the API */
interface ChatMessage {
  role:        'user' | 'assistant';
  content:     string;
  tokensUsed?: number;   // display only, stripped before sending in history
}

/** Wire format sent to the API — only what the DTO expects */
interface HistoryEntry {
  role:    'user' | 'assistant';
  content: string;
}

// ── Starter prompts ───────────────────────────────────────────────────────────

const STARTER_PROMPTS: Array<{ label: string; prompt: string; icon: string }> = [
  { icon: '🏗️', label: 'Active jobs',       prompt: 'What jobs are active right now? Show names and states.' },
  { icon: '🚛', label: 'Trips today',        prompt: 'How many trips are in progress or completed today?' },
  { icon: '🧾', label: 'Pending invoices',   prompt: 'Any invoices pending approval? List them with amounts if available.' },
  { icon: '📊', label: 'Ops summary',        prompt: 'Give me a summary of operations: active jobs, trips in progress, pending approvals, and any issues.' },
  { icon: '💰', label: 'Revenue overview',   prompt: 'What invoices have been completed? Give me a revenue picture.' },
  { icon: '👤', label: 'Driver status',      prompt: 'Which drivers are currently active on trips?' },
  { icon: '🔧', label: 'Maintenance',        prompt: 'Which vehicles are in maintenance right now?' },
  { icon: '⚠️', label: 'Blockers',           prompt: 'Are there any workflows paused waiting for approval? What is blocked?' },
];

// ── Message renderer — handle simple markdown-ish formatting ─────────────────

function AssistantMessage({ content }: { content: string }) {
  const lines = content.split('\n');
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (line.startsWith('• ') || line.startsWith('- ')) {
          return (
            <div key={i} className="flex gap-2 text-xs text-gray-800 leading-relaxed">
              <span className="text-gray-400 flex-shrink-0 mt-0.5">•</span>
              <span>{line.slice(2).replace(/\*\*(.*?)\*\*/g, '$1')}</span>
            </div>
          );
        }
        if (line.trim() === '') return <div key={i} className="h-1" />;
        return (
          <p key={i} className="text-xs text-gray-800 leading-relaxed">
            {line.replace(/\*\*(.*?)\*\*/g, '$1')}
          </p>
        );
      })}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AiInsightsPage() {
  const [org,         setOrg]         = useState<Organization | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [aiEnabled,   setAiEnabled]   = useState<boolean | null>(null);
  const [messages,    setMessages]    = useState<ChatMessage[]>([]);
  const [input,       setInput]       = useState('');
  const [sending,     setSending]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [totalTokens, setTotalTokens] = useState(0);

  const sessionId = useRef<string>(crypto.randomUUID());
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  // Load org + AI status
  useEffect(() => {
    async function load() {
      try {
        const [orgRes, statusRes] = await Promise.allSettled([
          apiClient.get<Organization[]>('/organizations'),
          apiClient.get<{ configured: boolean }>('/ai/status'),
        ]);

        if (orgRes.status === 'fulfilled' && orgRes.value.success) {
          setOrg(orgRes.value.data?.[0] ?? null);
        }
        if (statusRes.status === 'fulfilled') {
          setAiEnabled(statusRes.value.data?.configured ?? false);
        } else {
          setAiEnabled(false);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const send = useCallback(async (text: string) => {
    if (!text.trim() || sending || !org) return;
    setInput('');
    setError(null);

    const userMsg: ChatMessage = { role: 'user', content: text.trim() };
    // Snapshot current messages BEFORE state update (closure captures stale state)
    const priorMessages = messages;
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);

    try {
      // Strip UI-only fields (tokensUsed) and exclude the current message —
      // the API adds req.message itself; including it here would duplicate it.
      const history: HistoryEntry[] = priorMessages.slice(-8).map(({ role, content }) => ({ role, content }));

      const res: ApiResponse<AssistResponse> = await apiClient.post('/ai/assist', {
        orgId:     org.id,
        message:   text.trim(),
        sessionId: sessionId.current,
        history,
      });

      // Surface server-side errors properly
      if (!res.success) {
        const apiErr = (res as { error?: { message?: string } }).error;
        throw new Error(apiErr?.message ?? 'Server returned an error');
      }

      const reply  = res.data?.response ?? '(no response)';
      const tokens = res.data?.tokensUsed ?? 0;

      setMessages((prev) => [...prev, { role: 'assistant', content: reply, tokensUsed: tokens }]);
      setTotalTokens((t) => t + tokens);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Request failed');
      // Remove the optimistically-added user message on error
      setMessages((prev) => prev.filter((_, i) => i < prev.length - 1));
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [sending, messages, org]);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  };

  const newSession = () => {
    setMessages([]);
    setTotalTokens(0);
    setError(null);
    sessionId.current = crypto.randomUUID();
  };

  // ── Role guard ────────────────────────────────────────────────────────────

  const role         = org?.membership?.role ?? '';
  const isOwnerAdmin = ['owner', 'admin'].includes(role);

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-gray-400">Loading…</p>
      </div>
    );
  }

  if (!org) {
    return (
      <div className="flex items-center justify-center h-full p-8 text-center">
        <div>
          <p className="text-2xl mb-2">🏢</p>
          <p className="text-sm font-medium text-gray-700">No organisation found</p>
          <p className="text-xs text-gray-400 mt-1">You need to be in an organisation to use AI Insights.</p>
        </div>
      </div>
    );
  }

  if (!isOwnerAdmin) {
    return (
      <div className="flex items-center justify-center h-full p-8 text-center">
        <div>
          <p className="text-2xl mb-2">🔒</p>
          <p className="text-sm font-medium text-gray-700">Owner / Admin only</p>
          <p className="text-xs text-gray-400 mt-1">AI Insights is available to organisation owners and admins.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-h-screen">

      {/* ── Header ── */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 bg-white flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            🤖 AI Insights
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {org.name} · <span className="capitalize">{role}</span> · Live read-only analysis
            {totalTokens > 0 && (
              <span className="ml-2 text-gray-400">{totalTokens.toLocaleString()} tokens used</span>
            )}
          </p>
        </div>

        {messages.length > 0 && (
          <button
            onClick={newSession}
            className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors"
          >
            New Session
          </button>
        )}
      </div>

      {/* ── AI not configured ── */}
      {aiEnabled === false && (
        <div className="flex-1 flex items-center justify-center p-8 text-center">
          <div>
            <p className="text-4xl mb-3">🔑</p>
            <p className="text-sm font-semibold text-gray-700">AI not configured</p>
            <p className="text-xs text-gray-500 mt-1">
              Set <code className="bg-gray-100 px-1.5 py-0.5 rounded">OPENAI_API_KEY</code> in{' '}
              <code className="bg-gray-100 px-1.5 py-0.5 rounded">apps/api/.env</code> to enable AI Insights.
            </p>
          </div>
        </div>
      )}

      {/* ── Chat area ── */}
      {aiEnabled !== false && (
        <>
          <div className="flex-1 overflow-y-auto">

            {/* Empty state — starter prompts */}
            {messages.length === 0 && !sending && (
              <div className="p-6 max-w-3xl mx-auto">
                <p className="text-sm text-gray-500 mb-5 text-center">
                  Ask me anything about your operations. I have live read-only access to your resources and events.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {STARTER_PROMPTS.map((s) => (
                    <button
                      key={s.label}
                      onClick={() => void send(s.prompt)}
                      className="flex flex-col items-start gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-3 text-left hover:border-blue-300 hover:bg-blue-50 transition-colors group"
                    >
                      <span className="text-lg">{s.icon}</span>
                      <span className="text-xs font-medium text-gray-700 group-hover:text-blue-700">{s.label}</span>
                    </button>
                  ))}
                </div>

                <div className="mt-6 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
                  <p className="text-xs text-amber-700">
                    <strong>Read-only:</strong> AI Insights can observe and report on data only. It cannot approve, create, or change anything. All analysis is grounded in live resource data.
                  </p>
                </div>
              </div>
            )}

            {/* Messages */}
            {messages.length > 0 && (
              <div className="p-6 max-w-3xl mx-auto space-y-4">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>

                    {msg.role === 'assistant' && (
                      <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-sm flex-shrink-0 mt-0.5">
                        🤖
                      </div>
                    )}

                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                        msg.role === 'user'
                          ? 'bg-blue-600 text-white rounded-br-sm'
                          : 'bg-white border border-gray-200 rounded-bl-sm shadow-sm'
                      }`}
                    >
                      {msg.role === 'user' ? (
                        <p className="text-sm text-white leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                      ) : (
                        <AssistantMessage content={msg.content} />
                      )}
                      {msg.role === 'assistant' && msg.tokensUsed && (
                        <p className="text-[10px] text-gray-300 mt-2">{msg.tokensUsed.toLocaleString()} tokens</p>
                      )}
                    </div>

                    {msg.role === 'user' && (
                      <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500 flex-shrink-0 mt-0.5 uppercase">
                        {role.slice(0, 1)}
                      </div>
                    )}
                  </div>
                ))}

                {/* Typing indicator */}
                {sending && (
                  <div className="flex gap-3 justify-start">
                    <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-sm flex-shrink-0">
                      🤖
                    </div>
                    <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                      <span className="inline-flex gap-1 items-center">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </span>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-xs text-red-700">
                    <p className="font-medium mb-0.5">⚠ Request failed</p>
                    <p className="text-red-600">{error}</p>
                    {error.toLowerCase().includes('openai') && (
                      <p className="text-red-500 mt-1">Check that <code className="bg-red-100 px-1 rounded">OPENAI_API_KEY</code> in <code className="bg-red-100 px-1 rounded">apps/api/.env</code> is valid and not expired.</p>
                    )}
                  </div>
                )}

                <div ref={bottomRef} />
              </div>
            )}

            {/* Error on empty state (e.g. first message fails) */}
            {messages.length === 0 && error && (
              <div className="max-w-3xl mx-auto px-6">
                <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-xs text-red-700">
                  <p className="font-medium mb-0.5">⚠ Request failed</p>
                  <p className="text-red-600">{error}</p>
                  {error.toLowerCase().includes('openai') && (
                    <p className="text-red-500 mt-1">Check that <code className="bg-red-100 px-1 rounded">OPENAI_API_KEY</code> in <code className="bg-red-100 px-1 rounded">apps/api/.env</code> is valid and not expired.</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Input bar ── */}
          <div className="flex-shrink-0 border-t border-gray-200 bg-white px-6 py-4">
            <div className="max-w-3xl mx-auto flex gap-3">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Ask about jobs, trips, invoices, drivers, expenses… (Enter to send)"
                rows={2}
                disabled={sending}
                className="flex-1 resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
                style={{ maxHeight: 120 }}
              />
              <button
                onClick={() => void send(input)}
                disabled={!input.trim() || sending}
                className="self-end rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40 transition-colors flex-shrink-0"
              >
                {sending ? '…' : 'Send'}
              </button>
            </div>
            <p className="text-center text-[10px] text-gray-400 mt-2 max-w-3xl mx-auto">
              Shift+Enter for newline · Read-only access to live {org.name} data
            </p>
          </div>
        </>
      )}
    </div>
  );
}
