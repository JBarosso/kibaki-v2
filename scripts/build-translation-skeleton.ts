#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';

const url = process.env.PUBLIC_SUPABASE_URL;
const anonKey = process.env.PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error('Missing PUBLIC_SUPABASE_URL or PUBLIC_SUPABASE_ANON_KEY environment variables.');
  process.exit(1);
}

const endpoint = new URL('/rest/v1/characters', url);
endpoint.searchParams.set('select', 'slug,name,description');
endpoint.searchParams.set('order', 'slug.asc');

const response = await fetch(endpoint.toString(), {
  headers: {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    Accept: 'application/json',
  },
});

if (!response.ok) {
  console.error('Failed to fetch characters:', response.status, response.statusText);
  const text = await response.text().catch(() => '');
  if (text) console.error(text);
  process.exit(1);
}

const data = (await response.json()) as Array<{ slug: string; name: string; description: string | null }>;

const output = data.map((item) => ({
  slug: item.slug,
  name: item.name,
  description: item.description,
}));

await writeFile('/tmp/characters.skeleton.json', JSON.stringify(output, null, 2) + '\n', 'utf-8');
console.log(`Wrote ${output.length} characters to /tmp/characters.skeleton.json`);
