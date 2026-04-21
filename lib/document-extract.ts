// Document extraction via Claude Sonnet 4 vision.
// Input: raw bytes (image or PDF) + mime type.
// Output: structured extraction of fields relevant to pet-relocation documents
//         (rabies certificate, microchip record, import permit, etc.).
//
// We let the model CLASSIFY the document type first, then extract fields
// conditional on that classification. A single Claude call handles both, so
// we're honest about cost (one Sonnet 4 call per document).
//
// Env vars: ANTHROPIC_API_KEY

import "server-only";

const MODEL = process.env.ANTHROPIC_VISION_MODEL ?? "claude-sonnet-4-6";
const API = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";

export type DocumentKind =
  | "rabies_certificate"
  | "microchip_record"
  | "health_certificate"
  | "import_permit"
  | "export_permit"
  | "vet_invoice"
  | "passport_id_page"
  | "pet_photo"
  | "unknown";

export interface ExtractedDocument {
  classification: DocumentKind;
  confidence: number; // 0..1
  pet_name: string | null;
  microchip_id: string | null;
  species: string | null;
  breed: string | null;
  date_of_birth: string | null; // ISO date
  issue_date: string | null;
  expiry_date: string | null;
  issuer: string | null;
  document_number: string | null;
  country_of_origin: string | null;
  vaccine_name: string | null;
  manufacturer: string | null;
  batch_number: string | null;
  vet_name: string | null;
  vet_license: string | null;
  raw_notes: string | null; // anything else the model wants to preserve
}

const EXTRACTION_PROMPT = `You are a document extraction agent for pet-relocation casework.

TASK:
1. Classify this document into exactly one of:
   rabies_certificate, microchip_record, health_certificate, import_permit,
   export_permit, vet_invoice, passport_id_page, pet_photo, unknown.
2. Extract the fields listed in the JSON schema. Use null for fields that are
   not present or you are not confident about.
3. Output ONLY JSON matching the schema. No prose, no code fences.

RULES:
- Dates as ISO (YYYY-MM-DD). If only a year or month is visible, return null.
- Microchip IDs are 15 digits, ISO 11784/11785. Strip spaces/hyphens.
- Do not invent values. A single illegible character means null.
- Never provide a confidence above 0.9 for hand-written or partially obscured
  documents.
- 'raw_notes' is a free-text field for anything important the schema doesn't
  capture (max 200 chars).

JSON schema (all keys required; use null where unknown):
{
  "classification": "rabies_certificate | microchip_record | ...",
  "confidence": 0.0-1.0,
  "pet_name": string|null,
  "microchip_id": string|null,
  "species": string|null,
  "breed": string|null,
  "date_of_birth": string|null,
  "issue_date": string|null,
  "expiry_date": string|null,
  "issuer": string|null,
  "document_number": string|null,
  "country_of_origin": string|null,
  "vaccine_name": string|null,
  "manufacturer": string|null,
  "batch_number": string|null,
  "vet_name": string|null,
  "vet_license": string|null,
  "raw_notes": string|null
}`;

export async function extractDocument(
  bytes: ArrayBuffer,
  mime: string,
): Promise<{ ok: true; data: ExtractedDocument; tokens_in: number; tokens_out: number } | { ok: false; error: string }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { ok: false, error: "ANTHROPIC_API_KEY not set" };

  // Claude Sonnet 4 accepts images directly and PDFs via the document block
  // (PDF support requires the anthropic-beta: pdfs-2024-09-25 header for older
  // models; Sonnet 4 handles PDFs natively).
  const base64 = bufferToBase64(bytes);
  const contentBlock: Record<string, unknown> =
    mime === "application/pdf"
      ? {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: base64 },
        }
      : {
          type: "image",
          source: { type: "base64", media_type: mime, data: base64 },
        };

  const res = await fetch(API, {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": API_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system: EXTRACTION_PROMPT,
      messages: [{ role: "user", content: [contentBlock, { type: "text", text: "Extract the fields per the schema." }] }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    return { ok: false, error: `Anthropic HTTP ${res.status}: ${errText.slice(0, 200)}` };
  }

  interface AnthropicResponse {
    content?: { type?: string; text?: string }[];
    usage?: { input_tokens?: number; output_tokens?: number };
  }
  const data = (await res.json()) as AnthropicResponse;
  const textBlock = data.content?.find((c) => c.type === "text");
  const text = textBlock?.text?.trim() ?? "";
  if (!text) return { ok: false, error: "empty response from Anthropic" };

  // Strip code fences if the model ignored the no-fences rule
  const cleaned = text.replace(/^```json\s*|```\s*$/g, "").trim();
  let parsed: ExtractedDocument;
  try {
    parsed = JSON.parse(cleaned) as ExtractedDocument;
  } catch {
    return { ok: false, error: `model returned non-JSON: ${cleaned.slice(0, 200)}` };
  }

  return {
    ok: true,
    data: parsed,
    tokens_in: data.usage?.input_tokens ?? 0,
    tokens_out: data.usage?.output_tokens ?? 0,
  };
}

// Safe across Node + Edge: Buffer isn't always available.
function bufferToBase64(bytes: ArrayBuffer): string {
  const bytesArr = new Uint8Array(bytes);
  // Node 20+ has Buffer but we don't want to rely on it for Edge runtime.
  // Chunked base64 conversion avoids stack overflow on large PDFs.
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytesArr.length; i += chunk) {
    binary += String.fromCharCode(...bytesArr.subarray(i, i + chunk));
  }
  if (typeof btoa === "function") return btoa(binary);
  // Node fallback
  return Buffer.from(binary, "binary").toString("base64");
}
