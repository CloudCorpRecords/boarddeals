# BUILD REPORT — boarddeals

Clean-room rebuild of `com.electricskateboard/electricskateboard`
v1.0.0 (remote-only MCP server at `https://electricskateboard.com/mcp`),
built 2026-10-28 as a forwarding client. Package:
`@reneturcios/boarddeals` 0.1.0, registry name
`io.github.CloudCorpRecords/boarddeals`.

**Re-triage flag (coordinator-recorded, in the spec):** this build
carries a re-triage flag for vendor price verdicts over public data
(`search_products` returns the vendor's verdict on a price;
`where_to_buy` ranks shops by genuine-deal counts). The flag lives
in the spec and is to be resolved before any publish wave; the
build itself is the full surface, no omissions.

## Surface built

Full surface: **7 of 7 captured tools built**, none omitted.

| Tool | Required fields as served |
|------|---------------------------|
| `search_products` | `query` |
| `product_price` | `url` |
| `todays_deals` | *(no `required` key)* |
| `fake_sales` | *(no `required` key)* |
| `price_history` | `url` |
| `where_to_buy` | *(no `required` key)* |
| `where_can_i_ride` | `jurisdiction` |

Each served tool carries exactly the keys `name`, `title`,
`description`, `inputSchema`, exactly as captured: the capture's
tools carry `title` keys and they are served verbatim. Every
tool's `inputSchema` carries `additionalProperties: false` exactly
as captured, and the three tools above serve no `required` key at
all, exactly as captured. The tool literals were generated
programmatically from
`harness/fixtures/electricskateboard-tools.json` by the script at
`/tmp/b52-boarddeals-scratch/gen.py` (parse + re-serialise; the
generator's round-trip assertions confirmed the emitted literal
parses back deep-equal to the fixture's tool objects) — never
retyped — and the registration-integrity test suite plus the
parity harness confirmed the served literals deep-equal the
fixture's tool objects. Tools are registered via the MCP SDK
low-level Server API (`ListToolsRequestSchema` /
`CallToolRequestSchema` handlers), not McpServer+zod.

## Fixture conflicts

**None.** The brief, the spec and the fixture agree on the tool
names, titles, descriptions, required fields (including the three
tools with no `required` key) and property shapes for all 7 tools.

## Labelled reconstructions (from the spec's Wire section)

- Upstream endpoint pinned: `https://electricskateboard.com/mcp`.
- Env override `BOARDDEALS_MCP_URL` — labelled reconstruction.
- The record declares NO auth headers on the remote and the
  capture was taken keyless: no auth header is ever sent. Tests
  assert that no `Authorization` header is sent under any
  environment — including with key-like env vars
  (`BOARDDEALS_API_KEY`, `API_KEY`, `AUTHORIZATION`) set — and
  that no `X-API-Key` header is ever sent; upstream requests
  carry only `Content-Type`, `Accept` and, when issued,
  `Mcp-Session-Id`.
- Error rendering `boarddeals error:` text for upstream
  failures — labelled reconstruction.
- Upstream results pass through verbatim, including
  `structuredContent`, `isError` and extra fields. tools/call is
  forwarded as streamable-HTTP JSON-RPC: initialize
  (protocolVersion `2025-03-26`) → notifications/initialized →
  tools/call, honouring `Mcp-Session-Id` when issued; plain-JSON
  and SSE replies are both parsed. The forwarding core takes an
  injectable fetch; tests stub the upstream — no live network
  calls in tests.

## Deviations

**None.**

## Lockfile

- Route: Route 3 (offline) succeeded on the first attempt:
  `npm install --package-lock-only --ignore-scripts --offline`,
  generated clean from birth in the build dir with no
  `node_modules` and no pre-existing lockfile.
- Parses as JSON; `name` == `@reneturcios/boarddeals`.
- Package entries: **128**.
- sha256: `6031e38a4c08c01078ab94edca7c9977d030e4f294ac95a79ae9971d50bdf654`
  (re-verified unchanged after the subsequent full `npm install`).

## server.json

- Description exactly: "Electric skateboard and scooter prices across shops: deals, fake-sale checks, price history." —
  **92 characters** (verified programmatically from the file).
- npm package entry carries `"version": "0.1.0"`; the OCI entry
  (`ghcr.io/cloudcorprecords/boarddeals:0.1.0`) carries **no**
  `version` field. Both entries carry packageArguments
  `[{type: positional, value: mcp}]` and transport stdio.
  Dockerfile (node:20-alpine, both stages) carries the label
  `io.modelcontextprotocol.server.name="io.github.CloudCorpRecords/boarddeals"`.
  Container workflow `IMAGE` is `ghcr.io/cloudcorprecords/boarddeals`
  and its smoke test asserts the server name `boarddeals`.

## Verification (all run 2026-10-28)

1. `tsc --noEmit` (direct binary) → exit 0.
2. `tsc` build → exit 0; real `dist/` produced (cli, forward,
   index, mcp, types — .js, .d.ts, .js.map each).
3. `node dist/cli.js --version` → `0.1.0`.
4. Tests (`tsx --test test/forward.test.ts`, fake-fetch only) →
   **56 tests, 56 pass, 0 fail** (registration-integrity suite
   deep-equals the served tools/list against the fixture's 7
   tools, including title/description verbatim checks,
   required-key exactness, the explicit assertion that the served
   schemas for `todays_deals`, `fake_sales` and `where_to_buy`
   carry no `required` key, the `todays_deals` kind enum and the
   `search_products` property types, plus session
   handling/reuse, env override, the no-Authorization /
   no-X-API-Key assertions under any environment, verbatim
   argument forwarding for all 7 tools and result pass-through
   including structuredContent and upstream isError, SSE parsing,
   error rendering for both the JSON-RPC-error and
   transport-failure paths, MCP-layer validation, and CLI
   behaviour including a working subcommand for each of the 7
   tools against a local stub server).
5. Parity: `python3 /home/hatch/workspace/mcp-rebuild-100/harness/parity.py --original /home/hatch/workspace/mcp-rebuild-100/harness/fixtures/electricskateboard-tools.json --rebuild "stdio:node /home/hatch/workspace/mcp-rebuild-100/builds/boarddeals/dist/cli.js mcp" --out /home/hatch/workspace/mcp-rebuild-100/builds/boarddeals/parity-out` → **verdict PASS, parity 100.0**
   (7/7 identical, 0 missing, 0 extra, no schema diffs). Output in
   `parity-out/`.
