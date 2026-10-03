import crypto from 'node:crypto';

export const config = { maxDuration: 60 };

const DEFAULT_BASE_URL = 'https://ws-vtekyiqw1t5v66sm.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1';
const DEFAULT_MODEL = 'qwen3.8-flash';

function sameSecret(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: { message: 'Method not allowed.' } });
  }

  const apiKey = process.env.QWEN_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: { message: 'QWEN_API_KEY is not configured on the server.' } });
  }

  const requiredAccessToken = process.env.AGENT_LAB_ACCESS_TOKEN || '';
  if (requiredAccessToken) {
    const authorization = String(req.headers.authorization || '');
    const suppliedAccessToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    if (!sameSecret(suppliedAccessToken, requiredAccessToken)) {
      return res.status(401).json({ error: { message: 'Invalid or missing Agent Lab access token.' } });
    }
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); }
    catch { return res.status(400).json({ error: { message: 'Request body must be valid JSON.' } }); }
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: { message: 'Request body must be a JSON object.' } });
  }

  const baseUrl = String(process.env.QWEN_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
  const model = process.env.QWEN_MODEL || body.model || DEFAULT_MODEL;

  try {
    const upstream = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({ ...body, model })
    });
    const payload = Buffer.from(await upstream.arrayBuffer());
    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json; charset=utf-8');
    return res.send(payload);
  } catch (error) {
    return res.status(502).json({ error: { message: `Qwen upstream request failed: ${error.message}` } });
  }
}
