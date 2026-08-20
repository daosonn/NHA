import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma/prisma.service';
import { SuggestionRequestDto } from './dto/suggestion-request.dto';
import {
  SuggestionContextService,
  type EvidenceCounts,
} from './suggestion-context.service';

/** The three suggestion features of sprint 2 (WBS 2.4 / 2.5 / 2.6). */
export type SuggestionKind = 'gifts' | 'messages' | 'quality-time';

/**
 * One idea. `title`, `why` and `source` are mandatory for every kind —
 * that is the product rule, not a schema detail (decision 2026-08-18).
 * The rest is per-feature: gifts price them, messages carry the text,
 * quality-time carries the steps.
 */
export interface SuggestionItem {
  title: string;
  why: string;
  source: string;
  price?: string;
  text?: string;
  steps?: string[];
  tags?: string[];
}

export interface SuggestionEnvelope {
  /** What was read, stated before the ideas. Counted by NestJS. */
  evidence: EvidenceCounts;
  suggestions: SuggestionItem[];
  /** For logs and bug reports — never shown to a user. */
  model: string | null;
}

/** Suggestions are interactive: the user is waiting on this call. */
const SUGGESTION_TIMEOUT_MS = 30_000;
const DEFAULT_SUGGESTION_COUNT = 3;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function readTextArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const items = value
    .map((entry) => readText(entry))
    .filter((entry): entry is string => entry !== undefined);
  return items.length > 0 ? items : undefined;
}

/**
 * The mobile-facing half of AI suggestions (WBS 2.3.2, 2.4.3, 2.5.2,
 * 2.6.3). NestJS owns auth and context; FastAPI owns the model call.
 *
 * Failure is deliberately one-shaped: anything that stops a real,
 * traceable answer coming back — the integration being switched off, the
 * service being unreachable, a timeout, a malformed reply — answers
 * `503 { code: 'AI_UNAVAILABLE' }`. The app already degrades on that, and
 * the core product does not depend on AI (product-overview.md § 14).
 * There is no retry here: a failed suggestion is cheap to ask for again,
 * and a retry storm against a struggling service is not.
 */
@Injectable()
export class SuggestionService {
  private readonly logger = new Logger(SuggestionService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly contextService: SuggestionContextService,
  ) {}

  async suggest(
    userId: string,
    kind: SuggestionKind,
    dto: SuggestionRequestDto,
  ): Promise<SuggestionEnvelope> {
    const serviceUrl = this.config.get<string>('AI_SERVICE_URL');
    const serviceToken = this.config.get<string>('AI_SERVICE_TOKEN');
    if (!serviceUrl || !serviceToken) {
      // Checked before the context gathering below so an install with no
      // AI service does not do five database round trips to say "off".
      throw new ServiceUnavailableException({ code: 'AI_UNAVAILABLE' });
    }

    const [context, requester] = await Promise.all([
      this.contextService.gather(userId, dto.familyId, dto.memberId),
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { locale: true },
      }),
    ]);

    const payload = {
      locale: dto.locale ?? requester.locale ?? 'en',
      kind,
      subject: context.subject,
      occasion: dto.occasion ?? null,
      userContext: dto.userContext ?? null,
      constraints: {
        budget: dto.constraints?.budget ?? null,
        count: dto.constraints?.count ?? DEFAULT_SUGGESTION_COUNT,
      },
      evidence: context.evidence,
    };

    const body = await this.call(serviceUrl, serviceToken, kind, payload);
    const suggestions = this.readSuggestions(body, kind);
    return {
      // Ours, not the service's echo: the counts state what NestJS
      // actually sent, so they cannot drift from the evidence.
      evidence: context.evidence.counts,
      suggestions,
      model: readText(body.model) ?? null,
    };
  }

  private async call(
    serviceUrl: string,
    serviceToken: string,
    kind: SuggestionKind,
    payload: unknown,
  ): Promise<Record<string, unknown>> {
    try {
      const response = await fetch(`${serviceUrl}/suggestions/${kind}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-AI-Service-Token': serviceToken,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(SUGGESTION_TIMEOUT_MS),
      });
      if (!response.ok) {
        throw new Error(`AI service answered ${response.status}`);
      }
      const parsed: unknown = await response.json();
      if (!isRecord(parsed)) {
        throw new Error('AI service did not answer with a JSON object');
      }
      return parsed;
    } catch (error) {
      this.logger.warn(`Suggestion request (${kind}) failed: ${String(error)}`);
      throw new ServiceUnavailableException({ code: 'AI_UNAVAILABLE' });
    }
  }

  /**
   * An idea with no `why` and no `source` is dropped rather than shown:
   * the app promises the reader that every suggestion can be traced back
   * to a note, a photo or the timeline, and a recommendation nobody can
   * check is a guess wearing the family's clothes. If nothing survives,
   * the honest answer is that the AI had nothing to say — the same 503 as
   * any other failure, so the app has one path to handle.
   */
  private readSuggestions(
    body: Record<string, unknown>,
    kind: SuggestionKind,
  ): SuggestionItem[] {
    const raw = Array.isArray(body.suggestions) ? body.suggestions : [];
    const suggestions = raw
      .map((entry) => this.toSuggestion(entry))
      .filter((entry): entry is SuggestionItem => entry !== null);
    if (suggestions.length === 0) {
      this.logger.error(
        `AI service returned no traceable ${kind} suggestions ` +
          `(${raw.length} received, all missing title/why/source)`,
      );
      throw new ServiceUnavailableException({ code: 'AI_UNAVAILABLE' });
    }
    if (suggestions.length < raw.length) {
      this.logger.warn(
        `Dropped ${raw.length - suggestions.length} ${kind} suggestion(s) ` +
          'with no provenance',
      );
    }
    return suggestions;
  }

  private toSuggestion(entry: unknown): SuggestionItem | null {
    if (!isRecord(entry)) {
      return null;
    }
    const title = readText(entry.title);
    const why = readText(entry.why);
    const source = readText(entry.source);
    if (!title || !why || !source) {
      return null;
    }
    const item: SuggestionItem = { title, why, source };
    const price = readText(entry.price);
    const text = readText(entry.text);
    const steps = readTextArray(entry.steps);
    const tags = readTextArray(entry.tags);
    if (price) item.price = price;
    if (text) item.text = text;
    if (steps) item.steps = steps;
    if (tags) item.tags = tags;
    return item;
  }
}
