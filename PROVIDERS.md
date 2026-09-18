# Provider adapters

Plaucket Public is intentionally split into a browser client and a self-hosted gateway so provider credentials never need to be shipped to the browser.

## AI provider contract

The reference implementation in `shared/gateway.ts` uses OpenAI for transcription and report generation. A new AI adapter should provide equivalent behavior for:

- transcription: audio Blob/File -> transcript text, optional detected language and duration
- analysis: transcript + meeting metadata + markers -> the `MeetingReport` schema in `src/types.ts`

Keep provider API keys server-side. Never add provider secrets to Vite `VITE_*` variables because those are bundled into frontend JavaScript.

Good candidates for future adapters include OpenAI-compatible gateways, Azure OpenAI, Groq transcription, local Whisper services, Ollama-compatible LLM endpoints, Anthropic for analysis, and Google Gemini for analysis.

## Storage provider contract

Storage adapters implement `StorageAdapter` from `shared/gateway.ts`:

```ts
export interface StorageAdapter {
  putRecording(input: {
    id: string
    file: File
    bundle: string
    contentType: string
    extension: string
  }): Promise<StorageResult>
}
```

The reference implementations are:

- Node/Docker: local persistent filesystem
- Cloudflare Worker: private R2 bucket binding

Additional adapters can target S3-compatible object storage, Azure Blob Storage, Google Cloud Storage, OneDrive, Google Drive or another user-owned destination.

## Security requirements for adapters

1. Secrets stay in the gateway runtime.
2. Storage is private by default.
3. Do not return provider credentials or signed administrative URLs to the browser.
4. Do not log transcript/audio contents by default.
5. Preserve the explicit-action model: recording, AI processing and cloud save are separate user actions.
6. Validate size and content type before forwarding uploads.
7. Document provider-specific retention and data-processing implications.

Pull requests that add a provider should include a short threat analysis and tests for error handling.
