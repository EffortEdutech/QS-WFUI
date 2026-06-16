/**
 * AiService
 *
 * Thin wrapper around the OpenAI Chat Completions API.
 * Uses native fetch (Node 18+) — no openai npm package required.
 *
 * When OPENAI_API_KEY is not configured, isConfigured returns false
 * and callers should fall back to keyword-based logic.
 *
 * Security: OPENAI_API_KEY is server-side only. Never expose in frontend.
 * AI is advisory only — it must not approve, certify, or impersonate a PQS.
 *
 * Sprint 9 (S9-002)
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface CompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** If true, add response_format: {type:'json_object'} to force JSON output */
  jsonMode?: boolean;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly apiKey: string | null;
  private readonly baseUrl = 'https://api.openai.com/v1';

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('OPENAI_API_KEY') ?? null;
    if (this.apiKey) {
      this.logger.log('AiService: OpenAI key configured — real AI classification enabled');
    } else {
      this.logger.warn(
        'AiService: OPENAI_API_KEY not set — AI nodes will use keyword fallback',
      );
    }
  }

  /** Whether the service can make real AI calls */
  get isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Run a chat completion and return the raw response text.
   * Throws on HTTP errors or when not configured.
   */
  async runCompletion(
    systemPrompt: string,
    userPrompt: string,
    options: CompletionOptions = {},
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const model = options.model ?? 'gpt-4o-mini';
    const temperature = options.temperature ?? 0.1;
    const maxTokens = options.maxTokens ?? 2048;

    const body: Record<string, unknown> = {
      model,
      temperature,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt },
      ],
    };

    // JSON mode ensures the model returns valid JSON (supported by gpt-4o-mini and gpt-4o)
    if (options.jsonMode) {
      body['response_format'] = { type: 'json_object' };
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API error ${response.status}: ${errText}`);
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
      usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    };

    const content = data.choices?.[0]?.message?.content ?? '';

    if (data.usage) {
      this.logger.debug(
        `Tokens used — prompt: ${data.usage.prompt_tokens}, completion: ${data.usage.completion_tokens}, total: ${data.usage.total_tokens}`,
      );
    }

    return content;
  }
}
