// scripts/upload-optimized.js
/**
 * Re-upload optimized WebP images to Supabase and update DB
 * Usage:
 * 1. Ensure .env has PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BUCKET_NAME
 * 2. node scripts/upload-optimized.js
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.BUCKET_NAME || 'characters';
const INPUT_DIR = path.join(process.cwd(), 'optimized');

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.error('Missing env vars');
  process.exit(1);
}

if (!fs.existsSync(INPUT_DIR)) {
  console.error(`Optimized directory not found: ${INPUT_DIR}`);
  console.error('Run optimize-images.js first!');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

async function uploadOptimizedImage(filePath, fileName) {
  const slug = fileName.replace('.webp', '');
  const storagePath = `${slug}.webp`;
  
  try {
    // Read file
    const buffer = fs.readFileSync(filePath);
    
    // Delete old PNG if exists
    try {
      await supabase.storage.from(BUCKET).remove([`${slug}.png`]);
    } catch (e) {
      // ignore if doesn't exist
    }
    
    // Upload WebP
    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: 'image/webp',
        upsert: true,
      });
    
    if (uploadErr) {
      throw uploadErr;
    }
    
    // Get public URL
    const publicUrl = `${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/${BUCKET}/${encodeURIComponent(storagePath)}`;
    
    // Update DB
    const { error: dbErr } = await supabase
      .from('characters')
      .update({ image_url: publicUrl })
      .eq('slug', slug);
    
    if (dbErr) {
      console.error(`DB update error for ${slug}:`, dbErr);
    }
    
    const sizeKB = (buffer.length / 1024).toFixed(2);
    console.log(`✅ ${slug}.webp uploaded (${sizeKB} KB) and DB updated`);
    
  } catch (err) {
    console.error(`❌ Error uploading ${fileName}:`, err.message);
  }
}

async function uploadAll() {
  const files = fs.readdirSync(INPUT_DIR).filter(f => f.endsWith('.webp'));
  
  console.log(`Found ${files.length} WebP images to upload\n`);
  
  for (const file of files) {
    const filePath = path.join(INPUT_DIR, file);
    await uploadOptimizedImage(filePath, file);
  }
  
  console.log('\n✅ All optimized images uploaded!');
  console.log('Your characters now use WebP images with reduced file sizes.');
}

uploadAll().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});