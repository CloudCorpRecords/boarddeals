/**
 * boarddeals core: a forwarding client for the hosted
 * electricskateboard.com MCP server.
 *
 * Nothing about the prices is computed here.
 * tools/list is answered from the literal definitions
 * below, which reproduce a live capture of the upstream
 * server word for word (name, title, description and
 * inputSchema exactly as captured). A tools/call travels
 * upstream over a streamable-HTTP JSON-RPC session: an
 * initialize POST, a notifications/initialized POST,
 * then the tools/call POST, carrying the Mcp-Session-Id
 * response header on later requests when the upstream
 * issues one. The session opens lazily on the first
 * forwarded call and is reused for the client's lifetime.
 *
 * The endpoint is pinned to https://electricskateboard.com/mcp
 * and may be replaced with the BOARDDEALS_MCP_URL
 * environment variable (that override is a labelled
 * reconstruction). The registry record declares NO
 * headers on the upstream remote, so no auth header is
 * ever sent, under any environment.
 *
 * A successful upstream result is returned exactly as
 * received, isError flag and extra fields included.
 * Failures -- an upstream JSON-RPC error, a non-2xx
 * status, a body that cannot be parsed, or a fetch
 * that throws or times out -- become an isError result
 * whose text begins with `boarddeals error:` (that
 * rendering is a labelled reconstruction). Replies may
 * be plain JSON or SSE (`data:` lines); the JSON-RPC
 * message whose id matches the request wins.
 */
import type {
  FetchFn,
  FetchResponseLike,
  ForwardDeps,
  ToolArgs,
  ToolDef,
  ToolResult,
} from "./types.js";

export const VERSION = "0.1.0";

export const DEFAULT_ENDPOINT_URL = "https://electricskateboard.com/mcp";

export const DEFAULT_TIMEOUT_MS = 30000;

export const PROTOCOL_VERSION = "2025-03-26";

/* ------------------------------------------------------------------ */
/* Tool definitions (tools/list literals, verbatim from the live       */
/* capture in harness/fixtures/electricskateboard-tools.json; generated               */
/* programmatically by parsing and re-serialising the fixture JSON,     */
/* never retyped). The 7 captured tools are built.                      */
/* ------------------------------------------------------------------ */

export const TOOL_DEFS: ToolDef[] = [
  {
    "name": "search_products",
    "title": "Search tracked products",
    "description": "Finds products by name or brand across about 480 shops. Returns, for each match, the cheapest shop, how many shops carry it, our verdict on the price, and the product URL.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "query": {
          "type": "string",
          "description": "Product name or brand, e.g. \"Meepo V5\" or \"Onewheel Pint\"."
        },
        "brand": {
          "type": "string",
          "description": "Brand name, e.g. \"Meepo\", \"Onewheel\", \"Exway\"."
        },
        "vehicle": {
          "type": "string",
          "description": "One of: electric-skateboard, electric-scooter, onewheel, electric-bike, skateboard."
        },
        "country": {
          "type": "string",
          "description": "Two-letter country code of the shop charging the best price, e.g. \"US\", \"CA\", \"DE\"."
        },
        "in_stock_only": {
          "type": "boolean",
          "description": "Keep only products the cheapest shop actually has in stock."
        },
        "max_price": {
          "type": "number",
          "description": "Upper bound on the best price. Requires `currency` — we never convert, so this only filters products priced in that currency."
        },
        "currency": {
          "type": "string",
          "description": "Currency for max_price: USD, CAD, EUR, GBP, AUD. Defaults to USD."
        },
        "limit": {
          "type": "integer",
          "description": "How many results (default 10, max 50)."
        }
      },
      "required": [
        "query"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "product_price",
    "title": "Every shop charging for one product",
    "description": "The full price picture of one product: every shop we read, their price and stock, the spread, and whether a dated archive capture contradicts the claim that today is its lowest.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "url": {
          "type": "string",
          "description": "A product URL or path on electricskateboard.com, e.g. \"/decks/onewheel/gt-s-series-11db9\"."
        }
      },
      "required": [
        "url"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "todays_deals",
    "title": "Today's proven deals",
    "description": "Claims we can defend today, by kind: real_deal (cheapest anywhere, or a sale a competitor confirms), just_dropped (fell since our last reading), lowest_we_have_seen, cheaper_than_years_ago (beats a dated capture), you_just_missed_it (climbed back), and last_one_standing (at least three shops carry it and exactly one can still ship it — a scarcity fact no single shop can report about itself). Recomputed twice a day.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "kind": {
          "type": "string",
          "enum": [
            "real_deal",
            "just_dropped",
            "lowest_we_have_seen",
            "cheaper_than_years_ago",
            "you_just_missed_it",
            "last_one_standing"
          ],
          "description": "Which list. Defaults to real_deal."
        },
        "brand": {
          "type": "string",
          "description": "Brand name, e.g. \"Meepo\", \"Onewheel\", \"Exway\"."
        },
        "vehicle": {
          "type": "string",
          "description": "One of: electric-skateboard, electric-scooter, onewheel, electric-bike, skateboard."
        },
        "country": {
          "type": "string",
          "description": "Two-letter country code of the shop charging the best price, e.g. \"US\", \"CA\", \"DE\"."
        },
        "in_stock_only": {
          "type": "boolean",
          "description": "Keep only products the cheapest shop actually has in stock."
        },
        "max_price": {
          "type": "number",
          "description": "Upper bound on the best price. Requires `currency` — we never convert, so this only filters products priced in that currency."
        },
        "currency": {
          "type": "string",
          "description": "Currency for max_price: USD, CAD, EUR, GBP, AUD. Defaults to USD."
        },
        "limit": {
          "type": "integer",
          "description": "How many results (default 10, max 50)."
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "fake_sales",
    "title": "Discounts that are not discounts",
    "description": "Products where one shop advertises a discount while another quietly charges less for the same thing, or where the crossed-out price is one nobody actually charges.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "brand": {
          "type": "string",
          "description": "Brand name, e.g. \"Meepo\", \"Onewheel\", \"Exway\"."
        },
        "vehicle": {
          "type": "string",
          "description": "One of: electric-skateboard, electric-scooter, onewheel, electric-bike, skateboard."
        },
        "limit": {
          "type": "integer",
          "description": "How many results (default 10, max 50)."
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "price_history",
    "title": "What this page charged in the past",
    "description": "Dated captures of one product page from the Internet Archive, oldest first, with today's price at the same shop as the last point, and the number of captures found (fewer than two means the past price is unknown).",
    "inputSchema": {
      "type": "object",
      "properties": {
        "url": {
          "type": "string",
          "description": "A product URL or path on electricskateboard.com, e.g. \"/decks/onewheel/gt-s-series-11db9\"."
        }
      },
      "required": [
        "url"
      ],
      "additionalProperties": false
    }
  },
  {
    "name": "where_to_buy",
    "title": "Which shops carry a brand, and how honest their sales are",
    "description": "For a brand or a country: the shops we read that carry it, ranked by how many genuine deals they actually have, plus how often they badge a discount versus how often that discount survives comparison.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "brand": {
          "type": "string",
          "description": "Brand name. Either brand or country is required."
        },
        "country": {
          "type": "string",
          "description": "Two-letter country code, e.g. \"US\", \"CA\", \"DE\"."
        },
        "limit": {
          "type": "integer",
          "description": "How many results (default 10, max 50)."
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "where_can_i_ride",
    "title": "Is an electric skateboard legal here? (US states, Canadian provinces, Australian states and 10 more countries)",
    "description": "For one of the 50 US states, 13 Canadian provinces and territories, 8 Australian states and territories, or the United Kingdom, New Zealand, Singapore, Hong Kong, Germany, France, the Netherlands, Spain, Austria and Switzerland: whether any statute names the electric skateboard, what it requires, the exact words of the law with section numbers, links to the primary sources and the date each was read. Statuses: encadre (a statute names it and sets conditions), interdit (not allowed on public roads), sans-texte (no statute names it), nomme-sans-regles (named, but no operating rules). Information from the statutes, not legal advice.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "jurisdiction": {
          "type": "string",
          "description": "State or province name or code, e.g. \"Michigan\", \"MI\", \"Quebec\", \"QC\", \"us-ca\"."
        }
      },
      "required": [
        "jurisdiction"
      ],
      "additionalProperties": false
    }
  }
];

export const TOOL_NAMES = TOOL_DEFS.map((t) => t.name);

/** Whether `name` belongs to the captured built surface. */
export function isKnownTool(name: string): boolean {
  return TOOL_NAMES.includes(name);
}

/* ------------------------------------------------------------------ */
/* Forwarding client                                                   */
/* ------------------------------------------------------------------ */

function errorResult(detail: string): ToolResult {
  return {
    content: [{ type: "text", text: `boarddeals error: ${detail}` }],
    isError: true,
  };
}

function rpcErrorMessage(error: unknown): string {
  if (error !== null && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message !== "") return message;
    return JSON.stringify(error);
  }
  return String(error);
}

/**
 * Read a JSON-RPC response body, tolerating SSE framing.
 * Returns the message whose id matches `expectedId` when
 * present, otherwise the last parseable message, otherwise
 * null when nothing in the body parses.
 */
export function parseRpcBody(
  text: string,
  expectedId?: number,
): Record<string, unknown> | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  const candidates: Record<string, unknown>[] = [];
  const tryPush = (payload: string): void => {
    try {
      const parsed: unknown = JSON.parse(payload);
      if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
        candidates.push(parsed as Record<string, unknown>);
      }
    } catch {
      // Not a JSON payload; skip this candidate.
    }
  };
  if (trimmed.includes("data:")) {
    for (const line of trimmed.split("\n")) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const payload = t.slice("data:".length).trim();
      if (payload !== "" && payload !== "[DONE]") tryPush(payload);
    }
  } else {
    tryPush(trimmed);
  }
  if (candidates.length === 0) return null;
  if (expectedId !== undefined) {
    const match = candidates.find((c) => c.id === expectedId);
    if (match !== undefined) return match;
  }
  return candidates[candidates.length - 1];
}

async function defaultFetch(
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  },
): Promise<FetchResponseLike> {
  return fetch(url, init) as unknown as FetchResponseLike;
}

/**
 * A forwarding client holding a single upstream session,
 * opened lazily on first use and reused from then on
 * (for the process lifetime in the MCP server, or for a
 * single invocation in the CLI).
 */
export class BoarddealsClient {
  private readonly deps: ForwardDeps;
  private sessionId: string | null = null;
  private ready = false;
  private sessionPromise: Promise<void> | null = null;
  private idCounter = 0;

  constructor(deps: ForwardDeps = {}) {
    this.deps = deps;
  }

  private fetchFn(): FetchFn {
    return this.deps.fetchFn ?? defaultFetch;
  }

  private endpointUrl(): string {
    if (this.deps.url && this.deps.url.trim() !== "") return this.deps.url.trim();
    const raw = (this.deps.env ?? process.env).BOARDDEALS_MCP_URL;
    if (raw && raw.trim() !== "") return raw.trim();
    return DEFAULT_ENDPOINT_URL;
  }

  private timeoutMs(): number {
    if (typeof this.deps.timeoutMs === "number" && this.deps.timeoutMs > 0) {
      return this.deps.timeoutMs;
    }
    return DEFAULT_TIMEOUT_MS;
  }

  private nextId(): number {
    this.idCounter += 1;
    return this.idCounter;
  }

  private async post(
    body: unknown,
    withSession: boolean,
  ): Promise<FetchResponseLike> {
    // The registry record declares NO headers on the upstream
    // remote: no Authorization header is ever sent.
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    };
    if (withSession && this.sessionId !== null) {
      headers["Mcp-Session-Id"] = this.sessionId;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs());
    try {
      return await this.fetchFn()(this.endpointUrl(), {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  private async ensureSession(): Promise<void> {
    if (this.ready) return;
    if (this.sessionPromise === null) {
      this.sessionPromise = (async () => {
        const initId = this.nextId();
        const initRes = await this.post(
          {
            jsonrpc: "2.0",
            id: initId,
            method: "initialize",
            params: {
              protocolVersion: PROTOCOL_VERSION,
              capabilities: {},
              clientInfo: { name: "boarddeals", version: VERSION },
            },
          },
          false,
        );
        const sessionId = initRes.headers.get("mcp-session-id");
        if (sessionId) this.sessionId = sessionId;
        const initText = await initRes.text();
        const initParsed = parseRpcBody(initText, initId);
        if (initParsed !== null && initParsed.error) {
          throw new Error(rpcErrorMessage(initParsed.error));
        }
        if (initRes.status < 200 || initRes.status >= 300) {
          throw new Error(`HTTP ${initRes.status}`);
        }
        if (initParsed === null && initText.trim() !== "") {
          throw new Error("malformed response");
        }
        const initializedRes = await this.post(
          { jsonrpc: "2.0", method: "notifications/initialized" },
          true,
        );
        try {
          await initializedRes.text();
        } catch {
          // Nothing needed from the notification response body.
        }
        this.ready = true;
      })();
    }
    try {
      await this.sessionPromise;
    } catch (err) {
      this.sessionPromise = null;
      this.sessionId = null;
      throw err;
    }
  }

  /** Forward one tool call; upstream failures come back as isError results. */
  async callTool(name: string, args: ToolArgs): Promise<ToolResult> {
    try {
      await this.ensureSession();
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }

    const callId = this.nextId();
    let callRes: FetchResponseLike;
    try {
      callRes = await this.post(
        {
          jsonrpc: "2.0",
          id: callId,
          method: "tools/call",
          params: { name, arguments: args ?? {} },
        },
        true,
      );
    } catch (err) {
      return errorResult(
        `request failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const parsed = parseRpcBody(await callRes.text(), callId);
    if (parsed !== null && parsed.error) {
      return errorResult(rpcErrorMessage(parsed.error));
    }
    if (callRes.status < 200 || callRes.status >= 300) {
      return errorResult(`HTTP ${callRes.status}`);
    }
    if (parsed === null) return errorResult("malformed response");
    const result = parsed.result as ToolResult | undefined;
    if (result === undefined || result === null || typeof result !== "object") {
      return errorResult("malformed response");
    }
    // Hand the upstream result back exactly as received.
    return result;
  }
}

/** Build a forwarding client; tests inject a fake fetch and env through deps. */
export function createClient(deps: ForwardDeps = {}): BoarddealsClient {
  return new BoarddealsClient(deps);
}

/** One-shot helper: a fresh client for a single call (the CLI path). */
export async function callTool(
  name: string,
  args: ToolArgs,
  deps: ForwardDeps = {},
): Promise<ToolResult> {
  return new BoarddealsClient(deps).callTool(name, args);
}
