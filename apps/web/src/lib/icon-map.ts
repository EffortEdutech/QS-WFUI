/**
 * icon-map.ts
 *
 * Converts Lucide icon name strings (stored in the DB) to emoji for display.
 * All pack/node icon fields store Lucide kebab-case names (e.g. "alert-triangle").
 * This utility is the single source of truth for that mapping.
 *
 * Usage:
 *   import { resolveIcon } from '@/lib/icon-map';
 *   <span>{resolveIcon(node.icon) ?? <ColorDot />}</span>
 */

/** Comprehensive Lucide icon name → emoji map */
export const LUCIDE_TO_EMOJI: Record<string, string> = {
  // ── Pack-level icons (from pack-installer.service.ts) ─────────────────────
  'cpu':            '⚙️',
  'layers':         '🧩',
  'bar-chart-2':    '📊',
  'bar-chart':      '📊',
  'file-text':      '📄',
  'shopping-cart':  '🛒',
  'truck':          '🚛',
  'hard-hat':       '⛑️',
  'banknote':       '💵',
  'bell':           '🔔',
  'bot':            '🤖',
  'package':        '📦',
  'box':            '📦',

  // ── Node-level icons ───────────────────────────────────────────────────────
  'alert-triangle': '⚠️',
  'alert-circle':   '🚨',
  'play-circle':    '▶️',
  'play':           '▶️',
  'stop-circle':    '⏹️',
  'pause-circle':   '⏸️',
  'check-circle':   '✅',
  'check':          '✅',
  'x-circle':       '❌',
  'x':              '✕',
  'info':           'ℹ️',
  'help-circle':    '❓',

  // People & org
  'user':           '👤',
  'users':          '👥',
  'user-check':     '✅',
  'user-plus':      '➕',

  // Files & docs
  'file':           '📁',
  'file-plus':      '📄',
  'folder':         '📂',
  'folder-open':    '📂',
  'clipboard':      '📋',
  'clipboard-list': '📋',
  'book':           '📖',
  'book-open':      '📖',

  // Data & chart
  'database':       '🗄️',
  'server':         '🖥️',
  'hard-drive':     '💾',
  'pie-chart':      '🥧',
  'trending-up':    '📈',
  'trending-down':  '📉',
  'activity':       '📈',

  // Communication
  'mail':           '📧',
  'send':           '📤',
  'message-square': '💬',
  'message-circle': '💬',
  'phone':          '📞',
  'phone-call':     '📞',

  // Finance
  'credit-card':    '💳',
  'dollar-sign':    '💵',
  'receipt':        '🧾',
  'wallet':         '👛',

  // Time
  'calendar':       '📅',
  'clock':          '🕐',
  'timer':          '⏱️',

  // Dev / tech
  'code':           '💻',
  'terminal':       '💻',
  'git-branch':     '🔀',
  'git-merge':      '🔀',
  'settings':       '⚙️',
  'sliders':        '🎚️',
  'tool':           '🔧',
  'wrench':         '🔧',
  'hammer':         '🔨',
  'zap':            '⚡',
  'cpu2':           '💻',

  // Security
  'shield':         '🛡️',
  'lock':           '🔒',
  'unlock':         '🔓',
  'key':            '🔑',
  'eye':            '👁️',
  'eye-off':        '🙈',

  // Navigation / media
  'link':           '🔗',
  'external-link':  '↗️',
  'download':       '⬇️',
  'upload':         '⬆️',
  'refresh-cw':     '🔄',
  'repeat':         '🔁',
  'loader':         '⏳',
  'search':         '🔍',
  'filter':         '🔽',
  'tag':            '🏷️',
  'flag':           '🚩',
  'star':           '⭐',
  'heart':          '❤️',
  'bookmark':       '🔖',
  'share':          '🔗',
  'share-2':        '🔗',

  // Location
  'map-pin':        '📍',
  'map':            '🗺️',
  'globe':          '🌐',
  'navigation':     '🧭',
  'compass':        '🧭',

  // Objects
  'home':           '🏠',
  'building':       '🏢',
  'building-2':     '🏢',
  'image':          '🖼️',
  'camera':         '📷',
  'mic':            '🎤',
  'video':          '🎥',
  'music':          '🎵',
  'grid':           '⊞',
  'list':           '📝',
  'layout':         '📐',
  'sun':            '☀️',
  'moon':           '🌙',
  'cloud':          '☁️',
  'wifi':           '📶',
  'battery':        '🔋',
  'power':          '🔌',
  'target':         '🎯',
  'award':          '🏆',
  'gift':           '🎁',
  'truck-2':        '🚛',
  'package-2':      '📦',
  'printer':        '🖨️',
  'scissors':       '✂️',
  'edit':           '✏️',
  'edit-2':         '✏️',
  'edit-3':         '✏️',
  'trash':          '🗑️',
  'trash-2':        '🗑️',
  'save':           '💾',
  'copy':           '📋',
  'maximize':       '⛶',
  'minimize':       '⛶',
  'arrow-right':    '→',
  'arrow-left':     '←',
  'arrow-up':       '↑',
  'arrow-down':     '↓',
  'chevron-right':  '›',
  'chevron-left':   '‹',
  'thumbs-up':      '👍',
  'thumbs-down':    '👎',
};

/**
 * Maps pack IDs (from `packs.id` column) to display emoji.
 * Takes priority over LUCIDE_TO_EMOJI when both could match.
 */
export const PACK_EMOJI: Record<string, string> = {
  'lados.core-pack':          '⚙️',
  'lados.qs-pack':            '📐',
  'lados.procurement-pack':   '🛒',
  'lados.document-pack':      '📄',
  'lados.ai-pack':            '🤖',
  'lados.foundation-pack':    '🏗️',
  'lados.contractor-pack':    '🚛',
  'lados.construction-pack':  '🏗️',
  'lados.finance-pack':       '💰',
  'lados.notifications-pack': '🔔',
};

/**
 * Detects whether a string value is already an emoji (non-ASCII / multi-codepoint)
 * vs a Lucide icon name (only lowercase letters, digits, hyphens).
 */
function isLucideName(s: string): boolean {
  return /^[a-z0-9-]+$/.test(s);
}

/**
 * Resolves a DB icon field value to a renderable emoji string.
 *
 * - If the value is already an emoji (e.g. "🤖"), returns it as-is.
 * - If the value is a Lucide icon name (e.g. "alert-triangle"), maps to emoji.
 * - If unknown or null, returns null (caller can render a fallback).
 */
export function resolveIcon(icon: string | null | undefined): string | null {
  if (!icon) return null;
  // If it contains non-ASCII characters it's already an emoji/symbol
  if (!isLucideName(icon)) return icon;
  // Map Lucide name → emoji
  return LUCIDE_TO_EMOJI[icon] ?? null;
}

/**
 * Like resolveIcon() but always returns a string, falling back to `fallback`.
 */
export function resolveIconOr(
  icon: string | null | undefined,
  fallback: string,
): string {
  return resolveIcon(icon) ?? fallback;
}
