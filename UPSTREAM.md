# Upstream provenance

- Package: `pi-lean-portal@0.7.2`
- Repository: <https://github.com/coreyryanhanson/pi-lean-dimension> (`packages/pi-lean-portal`)
- License: AGPL-3.0-only (see `LICENSE`)
- Source used: npm tarball `https://registry.npmjs.org/pi-lean-portal/-/pi-lean-portal-0.7.2.tgz`

## Modifications for DeepSeek Harness

The following parts are derivative adaptations of the upstream source:

- Entry point rewritten from the Pi `ExtensionAPI` to a DSH Cordis Host plugin (`apply(ctx, config)`).
- Tool definitions rewritten from `@earendil-works/pi-coding-agent` `defineTool` to `@deepseek-ai/dsh-tools` definitions with explicit output schemas; tool names and parameters are unchanged.
- Pi `ctx.ui`, TUI renderers, status bar, tool masking, and select dialogs removed. `/web` was reimplemented as a DSH command returning text.
- Paths are configurable and default to `$DSH_HOME/playwright`; the upstream hard-coded `~/.pi/agent/pi-lean-portal` and `/tmp/pi-lean-portal` roots are gone.
- Python backends and the Python adapter were removed; the Node Chromium/Firefox backends are kept.
- Session-scoped profile naming uses DSH session ids; stale-session pruning checks `$DSH_HOME/sessions`.
- Toggle state lives in `<dataDir>/state.json` instead of Pi conversation branch history.
- Playwright is imported lazily through CommonJS `require` so a missing package/browser breaks browser launch, not plugin activation, and the Harness ESM loader cannot break Playwright's in-process initialization.

Upstream files kept close to verbatim: accessibility tree parsing, DOM extraction, bot detection, navigation settling, snapshot compaction/caching, storage-state persistence, guide parsing/matching, Playwright backend base, browser data tables.
