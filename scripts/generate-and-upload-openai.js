// scripts/generate-and-upload-openai-throttled.js
/**
 * Usage:
 * 1. Create scripts/prompts.json (array of { slug, name, universe, prompt })
 * 2. Create a .env with PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY, BUCKET_NAME (characters)
 * 3. npm install dotenv node-fetch@2 @supabase/supabase-js p-retry p-limit
 * 4. node scripts/generate-and-upload-openai-throttled.js
 *
 * Notes:
 * - This script runs one image generation at a time and waits DELAY_MS between items.
 * - It records completed slugs in scripts/progress.json so you can resume safely.
 * - Adjust SIZE ("512x512" or "1024x1024") and DELAY_MS according to your OpenAI rate limits.
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();
import fetch from 'node-fetch';
import pRetry from 'p-retry';
import pLimit from 'p-limit';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const BUCKET = process.env.BUCKET_NAME || 'characters';
const DELAY_MS = Number(process.env.DELAY_MS ?? 15000); // default 15s between each generate
const CONCURRENCY = 1; // one at a time
const SIZE = process.env.IMAGE_SIZE || '512x512'; // change to 1024x1024 if needed
const PROMPTS_PATH = path.join(process.cwd(), 'scripts', 'prompts.json');
const PROGRESS_PATH = path.join(process.cwd(), 'scripts', 'progress.json');
const ERR_LOG = path.join(process.cwd(), 'scripts', 'errors.log');

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE || !OPENAI_API_KEY) {
  console.error('Missing required env vars. Check .env for PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY');
  process.exit(1);
}

if (!fs.existsSync(PROMPTS_PATH)) {
  console.error('Missing scripts/prompts.json. Create it first.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

// helper sleep
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// read prompts
const prompts = JSON.parse(fs.readFileSync(PROMPTS_PATH, 'utf8'));

// ensure progress file
let progress = [];
if (fs.existsSync(PROGRESS_PATH)) {
  try {
    progress = JSON.parse(fs.readFileSync(PROGRESS_PATH, 'utf8'));
  } catch (e) {
    progress = [];
  }
}

// save progress helper
function markDone(slug) {
  progress.push(slug);
  fs.writeFileSync(PROGRESS_PATH, JSON.stringify(progress, null, 2), 'utf8');
}

// append error log
function logError(slug, err) {
  const line = `${new Date().toISOString()}\t${slug}\t${String(err)}\n`;
  fs.appendFileSync(ERR_LOG, line);
}

// Upload to Supabase storage
async function uploadBufferToSupabase(slug, buffer) {
  const filePath = `${slug}.png`;
  // remove existing (optional)
  try {
    await supabase.storage.from(BUCKET).remove([filePath]);
  } catch (e) {
    // ignore if not exists
  }
  const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(filePath, buffer, {
    contentType: 'image/png',
    upsert: true,
  });
  if (uploadErr) {
    throw uploadErr;
  }
  // get public url
  const pub = supabase.storage.from(BUCKET).getPublicUrl(filePath);
  // Newer SDK returns { data: { publicUrl } } or { publicUrl } depending on version
  if (pub && typeof pub === 'object') {
    // support shape: { data: { publicUrl } } or { publicUrl }
    if (pub.data && pub.data.publicUrl) return pub.data.publicUrl;
    if (pub.publicUrl) return pub.publicUrl;
  }
  // fallback to constructing url (works for public buckets)
  // https://<project>.supabase.co/storage/v1/object/public/<bucket>/<file>
  const url = `${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/${BUCKET}/${encodeURIComponent(filePath)}`;
  return url;
}

// Update the characters table image_url
async function updateCharacterImageUrl(slug, url) {
  const { error } = await supabase
    .from('characters')
    .update({ image_url: url })
    .eq('slug', slug);
  if (error) {
    console.error('DB update error for', slug, error);
    // do not throw, but log
    logError(slug, `DB update error: ${JSON.stringify(error)}`);
  }
}

// Generate image via OpenAI Images API (synchronous response with b64_json)
// Using images generaiton endpoint (may vary by SDK). We use the REST API directly.
async function generateImageOpenAI(prompt) {
  const url = 'https://api.openai.com/v1/images/generations';
  const body = {
    model: 'gpt-image-1', // or the correct model available to your account
    prompt: prompt,
    size: SIZE,
    // you can set "background" options via prompt; no other fields required
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (res.status === 429) {
    const text = await res.text();
    const err = new Error(`OpenAI 429 Rate limit: ${text}`);
    err.status = 429;
    throw err;
  }

  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`OpenAI error ${res.status}: ${text}`);
    throw err;
  }

  const json = await res.json();
  // response expected: { data: [ { b64_json: "..." } ] }
  const b64 = json?.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error('No b64_json returned from OpenAI');
  }
  const buffer = Buffer.from(b64, 'base64');
  return buffer;
}

// wrap generate with retry + exponential backoff for transient errors including 429
async function generateWithRetry(prompt) {
  return pRetry(
    async () => {
      try {
        const buf = await generateImageOpenAI(prompt);
        return buf;
      } catch (err) {
        // propagate 429 to p-retry so it retries after delay
        // p-retry will call the onFailedAttempt if configured
        throw err;
      }
    },
    {
      retries: 5,
      factor: 2,
      minTimeout: 3000,
      maxTimeout: 60000,
      onFailedAttempt: (err) => {
        const attempt = err.attemptNumber;
        const retriesLeft = err.retriesLeft;
        console.warn(`Attempt ${attempt} failed. ${retriesLeft} retries left. Error: ${err.message}`);
      },
    }
  );
}

// Process single item: generate, upload, update DB
async function processItem(item) {
  const slug = item.slug;
  if (!slug) throw new Error('Item missing slug');
  if (progress.includes(slug)) {
    console.log(`[SKIP] ${slug} already processed (progress file)`);
    return;
  }
  console.log(`Processing ${slug} - ${item.name || ''}`);

  try {
    // generate with retry/backoff
    const buffer = await generateWithRetry(item.prompt);

    // upload
    const publicUrl = await uploadBufferToSupabase(slug, buffer);
    console.log(`Uploaded ${slug} -> ${publicUrl}`);

    // update DB
    await updateCharacterImageUrl(slug, publicUrl);

    // mark done
    markDone(slug);
    console.log(`✅ Done ${slug}`);
  } catch (err) {
    console.error(`Error processing ${slug}:`, err.message || err);
    logError(slug, err.message || String(err));
    // If rate limit, wait some longer time before continuing
    if (err.status === 429 || /rate limit/i.test(String(err.message))) {
      const waitMs = 30000; // 30s back-off
      console.log(`Rate limit detected. Waiting ${waitMs / 1000}s before next attempt...`);
      await sleep(waitMs);
    }
  } finally {
    // always wait a bit to respect rate limits
    await sleep(DELAY_MS);
  }
}

// main
(async () => {
  console.log(`Starting generation loop. Total prompts: ${prompts.length}`);
  const limit = pLimit(CONCURRENCY);

  // process sequentially but using pLimit ensures we obey concurrency
  for (const item of prompts) {
    // run one by one with concurrency limiter
    // ensure we await each to keep order and avoid bursting
    await limit(() => processItem(item));
  }

  console.log('All done (loop finished).');
})();
