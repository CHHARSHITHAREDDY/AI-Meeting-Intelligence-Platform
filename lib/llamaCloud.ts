/**
 * Shared helper for LlamaCloud's (api.cloud.llamaindex.ai) Extract Agent API —
 * the ONLY AI backend that actually works with the configured LLAMA_API_KEY.
 *
 * IMPORTANT: LLAMA_API_KEY in this project is an "llx-" prefixed LlamaCloud /
 * LlamaIndex Cloud key. It is NOT valid against api.llama-api.com (a
 * completely different, unrelated third-party service also confusingly named
 * "Llama API") — that host rejects it with "ApiToken not found" on every
 * call. Several places in this codebase (rag.ts, liveChat.ts, and an earlier
 * version of extract.ts/classify.ts) called api.llama-api.com with this key
 * and always silently fell through to heuristic fallbacks as a result. This
 * module targets the correct host so structured extraction actually uses the
 * LLM instead of only ever running on regex heuristics.
 *
 * LlamaCloud's Extract API is a document-upload + async-job flow (not a plain
 * chat completion), so it fits structured extraction tasks (classification,
 * meeting/lecture/coding/podcast analysis, final summaries) well, but is too
 * slow (multi-second polling) for interactive chat — chat continues to use
 * its existing fallback chain.
 */

let cachedProjectId: string | null = null;

async function getProjectId(apiKey: string): Promise<string> {
  if (cachedProjectId) return cachedProjectId;
  try {
    const res = await fetch('https://api.cloud.llamaindex.ai/api/v1/projects', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (res.ok) {
      const projects = await res.json();
      if (Array.isArray(projects) && projects.length > 0 && projects[0].id) {
        cachedProjectId = projects[0].id;
        return cachedProjectId!;
      }
    }
  } catch (_) {
    // fall through to default below
  }
  // Verified default project for this account (confirmed via GET /api/v1/projects).
  cachedProjectId = 'f8c2f134-1828-4029-b3a5-778e2b70f421';
  return cachedProjectId;
}

/**
 * Runs a structured-extraction job against LlamaCloud for the given text and
 * JSON schema. Returns the parsed `extract_result` object, or null if the key
 * is missing/invalid, the job fails, or it doesn't complete within the poll
 * budget (~30s) — callers should treat null as "fall back to the next tier".
 */
export async function runLlamaCloudExtraction(text: string, schema: object): Promise<any | null> {
  const apiKey = process.env.LLAMA_API_KEY;
  if (!apiKey || apiKey === 'YOUR_LLAMA_API_KEY' || !apiKey.trim()) return null;

  try {
    const projectId = await getProjectId(apiKey);

    const formData = new FormData();
    const blob = new Blob([text], { type: 'text/plain' });
    formData.append('file', blob, 'transcript.txt');
    formData.append('purpose', 'extract');

    const uploadRes = await fetch('https://api.cloud.llamaindex.ai/api/v1/beta/files', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });
    if (!uploadRes.ok) {
      throw new Error(`Upload failed: ${uploadRes.status} - ${await uploadRes.text()}`);
    }
    const { id: fileId } = await uploadRes.json();

    // Brief pause so the uploaded file is registered before referencing it.
    await new Promise((r) => setTimeout(r, 800));

    const extractRes = await fetch(`https://api.cloud.llamaindex.ai/api/v2/extract?project_id=${projectId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        file_input: fileId,
        configuration: {
          tier: 'agentic',
          version: '2026-03-31',
          extraction_target: 'per_doc',
          data_schema: schema,
        },
      }),
    });
    if (!extractRes.ok) {
      throw new Error(`Job submission failed: ${extractRes.status} - ${await extractRes.text()}`);
    }
    const { id: jobId } = await extractRes.json();

    for (let attempt = 0; attempt < 15; attempt++) {
      await new Promise((r) => setTimeout(r, 2000));
      const statusRes = await fetch(`https://api.cloud.llamaindex.ai/api/v2/extract/${jobId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!statusRes.ok) {
        throw new Error(`Job status check failed: ${statusRes.status} - ${await statusRes.text()}`);
      }
      const statusData = await statusRes.json();
      const status = statusData.status?.toUpperCase();

      if (status === 'COMPLETED' || status === 'SUCCESS') {
        return statusData.extract_result;
      }
      if (status === 'FAILED') {
        throw new Error(`LlamaCloud extraction job failed: ${statusData.error_message}`);
      }
    }

    console.warn('[LlamaCloud] Extraction job did not complete within the poll budget.');
    return null;
  } catch (err: any) {
    console.error('[LlamaCloud] Extraction failed:', err.message);
    return null;
  }
}
