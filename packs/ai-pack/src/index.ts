/**
 * @lados/ai-pack
 *
 * AI assistant nodes using the OpenAI-compatible provider abstraction.
 * Sprint 1 stub — deferred to Sprint 6 (AI integration sprint).
 *
 * AI guardrail (mandatory, from project spec):
 * "AI is advisory only. AI MUST NOT approve, certify, decide entitlement,
 *  or impersonate a registered Professional Quantity Surveyor / Sr. QS."
 */
import type { PackManifest } from '@lados/pack-sdk';

export const PACK_ID = 'ai-pack' as const;
export const PACK_VERSION = '0.1.0' as const;

export const manifest: PackManifest = {
  id: PACK_ID,
  version: PACK_VERSION,
  displayName: 'AI Pack',
  description:
    'AI business capabilities — classifier, extractor, reviewer, comparator, summarizer, risk detector. Advisory only; human approval required for commercial decisions.',
  author: 'QS-OS Team',
  nodes: [
    // AI capabilities (Vol 0 §28.5)
    'ai.classifier',     // AI Classifier
    'ai.extractor',      // AI Extractor
    'ai.reviewer',       // AI Reviewer
    'ai.comparator',     // AI Comparator
    'ai.summarizer',     // AI Summarizer
    'ai.risk-detector',  // AI Risk Detector
  ],
};

// Sprint 6: export { ClassifierNode } from './nodes/classifier.node';
// Sprint 6: export { ExtractorNode } from './nodes/extractor.node';
// Sprint 6: export { ReviewerNode } from './nodes/reviewer.node';
// Sprint 6: export { ComparatorNode } from './nodes/comparator.node';
// Sprint 6: export { SummarizerNode } from './nodes/summarizer.node';
// Sprint 6: export { RiskDetectorNode } from './nodes/risk-detector.node';
