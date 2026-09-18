# Security policy

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting or open a private security advisory for this repository. Do not include real meeting recordings, transcripts, API keys, access tokens, or cloud credentials in a report.

## Security model

Plaucket is local-first, not offline-only. Microphone audio is assembled in the browser and leaves the device only when a user explicitly requests transcription or cloud storage.

- OpenAI and storage credentials are server-side secrets. They are never included in the frontend bundle.
- `PLAUCKET_ACCESS_TOKEN` protects paid API and upload routes for a single-user or trusted-team deployment. Put an identity-aware proxy in front of Plaucket for multi-user or public deployments.
- R2 objects are private and use generated keys. v0.1 does not expose a remote download endpoint.
- Transcript text is treated as untrusted data in the analysis prompt to reduce prompt-injection risk.
- The gateway applies size, type, and length limits, plus a restrictive Content Security Policy.

## Deployment expectations

- Serve the app over HTTPS. Browsers restrict microphone access on insecure non-local origins.
- Set a long, unique `PLAUCKET_ACCESS_TOKEN` before exposing the gateway to the internet.
- Keep the R2 bucket private and restrict the Worker binding to the intended account.
- Use a separate, spend-limited OpenAI project key and monitor its usage.
- Do not rely on the shared access token as enterprise identity or tenant isolation.
- Establish recording consent and retention rules for the jurisdictions and organisations involved.

## Known v0.1 limits

- Recordings are held in page memory until downloaded, uploaded, or discarded.
- File transcription is capped at 24 MiB to stay below the provider's 25 MB limit.
- There is no end-user account system, speaker diarisation, remote object browser, or automatic deletion policy yet.
