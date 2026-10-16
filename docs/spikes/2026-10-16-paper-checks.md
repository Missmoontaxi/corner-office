# Spike: docs-only checks and the Vertex call

*Fri 10/16. Part of the day-one spike. Read from official docs and pricing pages, plus one real Gemini call.*

## Vertex through the gateway (one real call)

`google/gemini-3.8-flash` with only `vertex` allowed answered on **Vercel's own credentials** (`credentialType: system`), both with zero data retention on and off, for under a cent. No Google Cloud key or BYOK is needed, so Gemini can join through the gateway in November as planned.

## BotID on Pro

Basic is free on every plan. Deep Analysis costs $1 per 1,000 `checkBotId()` calls on Pro, with no free allowance listed. Only `checkBotId()` calls are billed, so page views cost nothing. Source: [BotID](https://vercel.com/docs/botid).

## Free first-year domain on Pro

Paid Pro teams get one free first-year domain on .app, .dev, .online, .site, .space, .store, .tech or .website (no .com), renewing at the standard rate. Teams on a Pro trial are excluded. Claim it from domain search. Sources: [Pro plan](https://vercel.com/docs/plans/pro-plan), [changelog](https://vercel.com/changelog/free-domain-for-one-year-now-for-all-pro-teams).

## Anthropic connector egress

Claude's remote MCP calls come from Anthropic's servers, from one published range, `160.79.104.0/21` outbound ([IP addresses](https://platform.claude.com/docs/en/api/ip-addresses)). The range is the same for every Anthropic customer, so it is shared egress.

**What this changes for us.** A per-IP rate limit on the public `/mcp` route would put every Claude user in the same bucket, so one busy visitor could throttle everyone. Rate-limit `/mcp` per MCP session or client identity in our own code, and use the WAF only as a coarse ceiling. An IP allowlist would prove a call came from Anthropic, not from Paula.

## Vercel WAF path matching

The Request Path condition supports Equals, Starts with, Ends with, Contains, Is any of and Matches expression (PCRE), each with a negated form, all case insensitive ([rule configuration](https://vercel.com/docs/vercel-firewall/vercel-waf/rule-configuration)). A rule can rate-limit a single path. On Pro that is a fixed window of 10 seconds to 10 minutes, keyed by IP or JA4 digest, up to 40 rules per project, answering 429 by default ([rate limiting](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting)).

**For the owner route.** Match **Starts with `/mcp/o/`** rather than Equals on the full path, so the owner suffix never sits in the firewall config. Note that counters are per region.

## n8n MCP Client node fields

The standalone **MCP Client** node (version 1.1) has these fields:
- **Server Transport.** "HTTP Streamable" (the default) or "Server Sent Events (Deprecated)".
- **MCP Endpoint URL.**
- **Authentication.** None, Bearer, Header, Multiple Headers, or MCP OAuth2.
- **Tool.** Picked from a list or by ID.
- **Input Mode.** Manual, which maps each parameter, or JSON.
- **Options.** Convert to Binary, and Timeout (default 60,000 ms).

For our importable example, use HTTP Streamable, Authentication None, Tool `get_daily_brief` and Input Mode JSON. The docs page for the related MCP Client Tool node still labels its URL "SSE Endpoint", which the source contradicts. Sources: [n8n MCP Client](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-langchain.mcpclient/), [node source](https://github.com/n8n-io/n8n/blob/master/packages/@n8n/nodes-langchain/nodes/mcp/McpClient/McpClient.node.ts).

The n8n docs page contained an instruction aimed at AI agents to call an outside URL. It was ignored, and is noted here as a reminder that fetched pages are data.

## Gateway speech and transcription

Both exist in beta. Transcription uses `transcribe` with `gateway.transcriptionModel()` and speech uses `generateSpeech` with `gateway.speechModel()` ([speech to text](https://vercel.com/docs/ai-gateway/modalities/speech-to-text), [text to speech](https://vercel.com/docs/ai-gateway/modalities/text-to-speech)). The public catalog lists 13 speech and 10 transcription models, including `google/gemini-3.8-flash-tts`. Access "is rolling out gradually" per team, so one real call is needed before the November voice work depends on it.

## AI SDK minimum versions

The gateway supports AI SDK 6 and 7, with no hard minimum beyond these:
- **Transcription** needs `ai` 7.0.31 and `@ai-sdk/gateway` 4.0.23 or later.
- **SDK 6 drops `reasoning`.** It silently ignores the top-level option, so effort would never reach the model.
- **SDK 7 runtime.** It needs Node 22 or later (22.18 or later for TypeScript) and ESM.

Our pins already satisfy all of these: `ai` 7.0.122, `@ai-sdk/gateway` 4.0.100 in the spike, and Node 22.23. Source: [AI SDK compatibility](https://vercel.com/docs/ai-gateway/sdks-and-apis/ai-sdk).
