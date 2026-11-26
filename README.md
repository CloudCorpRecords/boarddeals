# boarddeals

Is that sale price real, or is another shop quietly charging less for the same board? boarddeals is a local forwarding client for the hosted electricskateboard.com MCP service: it answers `tools/list` locally from the captured tool definitions and forwards every call to the service, returning the answers exactly as the service sends them back.

The seven tools read the vendor's published price dataset — products tracked across about 480 shops, dated Internet Archive price captures, shop rankings and a riding-law register. Nothing here books, buys, checks out or takes a payment — every tool is a read over prices and facts the vendor already publishes.

## The tools

- **`search_products`** — Finds products by name or brand across about 480 shops. For each match: the cheapest shop, how many shops carry it, the vendor's verdict on the price, and the product URL. `query` is required; brand, vehicle type, country, stock, price ceiling and limit filters are optional.
- **`product_price`** — The full price picture of one product: every shop read, their price and stock, the spread, and whether a dated archive capture contradicts the claim that today is its lowest. Takes a product `url` (required).
- **`todays_deals`** — Claims the vendor can defend today, by kind: `real_deal`, `just_dropped`, `lowest_we_have_seen`, `cheaper_than_years_ago`, `you_just_missed_it` and `last_one_standing`. Recomputed twice a day. No argument is required.
- **`fake_sales`** — Discounts that are not discounts: products where one shop advertises a discount while another quietly charges less, or where the crossed-out price is one nobody actually charges. No argument is required.
- **`price_history`** — Dated captures of one product page from the Internet Archive, oldest first, with today's price at the same shop as the last point. Takes a product `url` (required).
- **`where_to_buy`** — For a brand or a country: the shops that carry it, ranked by how many genuine deals they actually have, plus how often they badge a discount versus how often that discount survives comparison. No argument is required (brand or country picks the list).
- **`where_can_i_ride`** — Whether an electric skateboard is legal in a `jurisdiction` (required): the 50 US states, 13 Canadian provinces and territories, 8 Australian states and territories, and 10 more countries — whether any statute names the vehicle, what it requires, the exact words of the law with section numbers, primary-source links and the date each was read. Information from the statutes, not legal advice.

## Install and run

As an MCP server via npm:

```bash
npx -y @reneturcios/boarddeals mcp
```

MCP client configuration:

```json
{
  "mcpServers": {
    "boarddeals": {
      "command": "npx",
      "args": ["-y", "@reneturcios/boarddeals", "mcp"]
    }
  }
}
```

As a container:

```bash
docker run -i ghcr.io/cloudcorprecords/boarddeals
docker run --rm ghcr.io/cloudcorprecords/boarddeals search_products '{"query":"Meepo V5"}'
```

## CLI

One binary serves both the command line and the MCP server. Each tool is a subcommand taking a single JSON string with that tool's arguments:

```bash
boarddeals search_products '{"query":"Meepo V5"}'
boarddeals product_price '{"url":"/decks/onewheel/gt-s-series-11db9"}'
boarddeals todays_deals '{"kind":"real_deal"}'
boarddeals fake_sales '{}'
boarddeals price_history '{"url":"/decks/onewheel/gt-s-series-11db9"}'
boarddeals where_to_buy '{"brand":"Meepo"}'
boarddeals where_can_i_ride '{"jurisdiction":"Michigan"}'
boarddeals --version
```

Exit codes: `0` when the forwarded call succeeds, `1` when the upstream result is an error, and `2` for usage problems such as an unknown subcommand or a malformed JSON argument.

## Configuration

- `BOARDDEALS_MCP_URL` — Overrides the upstream endpoint. The default is the pinned hosted endpoint, `https://electricskateboard.com/mcp`. (The override variable is a reconstruction added by this rebuild.)

The upstream registry record declares no headers, so no authentication header is ever sent; the tool surface was captured keyless.

Upstream failures — a JSON-RPC error from the service, a non-2xx response, an unreadable body, or a request that fails outright — are reported to the caller as an error result whose text starts with `boarddeals error:`.

## How forwarding works

The first forwarded call opens a session: an `initialize` request (protocol version `2025-03-26`), followed by a `notifications/initialized` notification, then the `tools/call` itself. If the service answers the initialize request with an `Mcp-Session-Id` header, that value is carried on every later request, and the open session is reused for the rest of the process. Replies are accepted either as plain JSON or as server-sent events. Successful results pass through verbatim, including any `isError` flag and any extra fields the service includes.

## Development

```bash
npm install
npm run build   # tsc -> dist/ (dist/cli.js is the bin)
npm test        # tsx --test test/*.test.ts — stubbed upstream, no network
npm run dev     # run the CLI from source
```

The test suite checks the served tool list against the captured surface (the 7 tools, deep-equal, titles included exactly as captured, each `required` list exactly as captured, and no `required` key at all on `todays_deals`, `fake_sales` and `where_to_buy`), exercises the session handshake and its reuse, verifies that no `Authorization` or `X-API-Key` header is ever sent under any environment, and verifies that arguments go upstream untouched and results come back untouched.

## License

MIT — see `LICENSE`. Copyright (c) 2026 Rene Turcios.
