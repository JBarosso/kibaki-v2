// scripts/download-images.js
/**
 * Downloads all images from Supabase storage bucket locally
 * Usage:
 * 1. Ensure .env has PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BUCKET_NAME
 * 2. npm install dotenv node-fetch@2 @supabase/supabase-js
 * 3. node scripts/download-images.js
 * 
 * This will create a downloads/ folder with all PNG images
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.BUCKET_NAME || 'characters';
const DOWNLOAD_DIR = path.join(process.cwd(), 'downloads');

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.error('Missing env vars: PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

// Create downloads directory
if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

async function downloadAllImages() {
  console.log(`Fetching all files from bucket: ${BUCKET}`);
  
  // List all files
  let allFiles = [];
  let page = 0;
  const perPage = 100;

  while (true) {
    const from = page * perPage;
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list('', { limit: perPage, offset: from });

    if (error) {
      console.error('Error listing files:', error);
      process.exit(1);
    }

    if (!data || data.length === 0) break;
    
    allFiles = allFiles.concat(data);
    
    if (data.length < perPage) break;
    page++;
  }

  console.log(`Found ${allFiles.length} files. Starting download...`);

  // Download each file
  for (const file of allFiles) {
    const fileName = file.name;
    const localPath = path.join(DOWNLOAD_DIR, fileName);

    // Skip if already downloaded
    if (fs.existsSync(localPath)) {
      console.log(`⏭️  Skip ${fileName} (already exists)`);
      continue;
    }

    try {
      // Get public URL
      const publicUrl = `${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/${BUCKET}/${encodeURIComponent(fileName)}`;
      
      // Download
      const response = await fetch(publicUrl);
      
      if (!response.ok) {
        console.error(`❌ Failed to download ${fileName}: ${response.status}`);
        continue;
      }

      const buffer = await response.buffer();
      
      // Save locally
      fs.writeFileSync(localPath, buffer);
      
      const sizeKB = (buffer.length / 1024).toFixed(2);
      console.log(`✅ Downloaded ${fileName} (${sizeKB} KB)`);
      
    } catch (err) {
      console.error(`❌ Error downloading ${fileName}:`, err.message);
    }
  }

  console.log(`\n✅ All downloads complete! Files saved in: ${DOWNLOAD_DIR}`);
  
  // Show total size
  const files = fs.readdirSync(DOWNLOAD_DIR);
  let totalSize = 0;
  files.forEach(f => {
    const stats = fs.statSync(path.join(DOWNLOAD_DIR, f));
    totalSize += stats.size;
  });
  console.log(`Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`\nNext steps:`);
  console.log(`1. Optimize images with Squoosh (https://squoosh.app/) or use the batch script`);
  console.log(`2. Convert to WebP format`);
  console.log(`3. Re-upload optimized images using upload-optimized.js`);
}

downloadAllImages().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});