# Changelog

## 0.1.0 (2026-10-28)

- First release: a forwarding client for the hosted electricskateboard.com MCP server. The 7 captured tools are answered locally for tools/list, and every tools/call is forwarded upstream over a streamable-HTTP JSON-RPC session (initialize, notifications/initialized, tools/call, honouring the Mcp-Session-Id header when the upstream issues one).
- Tools: `search_products`, `product_price`, `todays_deals`, `fake_sales`, `price_history`, `where_to_buy`, `where_can_i_ride`. Each tool's `title` is served exactly as captured.
- Upstream results pass through verbatim, including the isError flag; upstream failures surface as `boarddeals error:` text results.
- One bin serves the CLI (one subcommand per tool, plus `--version`) and the stdio MCP server (`mcp` subcommand). The upstream endpoint can be overridden via `BOARDDEALS_MCP_URL`. The upstream record declares no headers, so no auth header is ever sent.
