# @stablearc/api

Backend request/response surface: agent endpoint, quote/settle intents, x402
metering, waitlist. Zod-validated, fail-closed on money (guards/auth carried
over from luberty `lib/api`). Can also live as Next route handlers in `web` —
split here when it needs its own deploy/scale.
