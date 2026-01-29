/**
 * Lightweight API client for the meme backend.
 *
 * Uses REACT_APP_API_BASE_URL when set, otherwise defaults to same-origin.
 */

const API_BASE_URL = (process.env.REACT_APP_API_BASE_URL || '').replace(/\/+$/, '');

// PUBLIC_INTERFACE
export function buildApiUrl(path) {
  /** Build a fully-qualified API URL from a path like "/templates". */
  if (!path.startsWith('/')) return `${API_BASE_URL}/${path}`;
  return `${API_BASE_URL}${path}`;
}

async function parseErrorResponse(res) {
  try {
    const data = await res.json();
    if (data && data.detail) return data.detail;
    return JSON.stringify(data);
  } catch {
    try {
      const text = await res.text();
      return text || `${res.status} ${res.statusText}`;
    } catch {
      return `${res.status} ${res.statusText}`;
    }
  }
}

// PUBLIC_INTERFACE
export async function fetchTemplates() {
  /** Fetch meme templates from the backend. */
  const res = await fetch(buildApiUrl('/templates'));
  if (!res.ok) throw new Error(await parseErrorResponse(res));
  return res.json();
}

// PUBLIC_INTERFACE
export async function uploadImage(file) {
  /** Upload a custom image to the backend; returns {upload_id, image_url}. */
  const form = new FormData();
  form.append('file', file);

  const res = await fetch(buildApiUrl('/upload'), {
    method: 'POST',
    body: form
  });

  if (!res.ok) throw new Error(await parseErrorResponse(res));
  return res.json();
}

// PUBLIC_INTERFACE
export async function generateMeme(payload) {
  /** Generate a meme; payload: {template_id|upload_id, top_text, bottom_text}. */
  const res = await fetch(buildApiUrl('/generate'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) throw new Error(await parseErrorResponse(res));
  return res.json();
}
