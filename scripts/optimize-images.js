// scripts/optimize-images.js
/**
 * Batch convert PNG to WebP with optimization using sharp
 * Usage:
 * 1. npm install sharp
 * 2. node scripts/optimize-images.js
 * 
 * Reads from downloads/ and outputs to optimized/
 */

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const INPUT_DIR = path.join(process.cwd(), 'downloads');
const OUTPUT_DIR = path.join(process.cwd(), 'optimized');

if (!fs.existsSync(INPUT_DIR)) {
  console.error(`Input directory not found: ${INPUT_DIR}`);
  console.error('Run download-images.js first!');
  process.exit(1);
}

// Create output directory
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function optimizeImage(inputPath, outputPath) {
  try {
    await sharp(inputPath)
      .webp({ 
        quality: 80,      // Adjust quality (0-100)
        effort: 6         // Compression effort (0-6, higher = slower but smaller)
      })
      .toFile(outputPath);
    
    const inputStats = fs.statSync(inputPath);
    const outputStats = fs.statSync(outputPath);
    
    const inputKB = (inputStats.size / 1024).toFixed(2);
    const outputKB = (outputStats.size / 1024).toFixed(2);
    const savings = (((inputStats.size - outputStats.size) / inputStats.size) * 100).toFixed(1);
    
    console.log(`✅ ${path.basename(inputPath)} → ${path.basename(outputPath)}`);
    console.log(`   ${inputKB} KB → ${outputKB} KB (${savings}% smaller)\n`);
    
  } catch (err) {
    console.error(`❌ Error optimizing ${path.basename(inputPath)}:`, err.message);
  }
}

async function optimizeAll() {
  const files = fs.readdirSync(INPUT_DIR).filter(f => f.endsWith('.png'));
  
  console.log(`Found ${files.length} PNG images to optimize\n`);
  
  let totalInputSize = 0;
  let totalOutputSize = 0;
  
  for (const file of files) {
    const inputPath = path.join(INPUT_DIR, file);
    const outputPath = path.join(OUTPUT_DIR, file.replace('.png', '.webp'));
    
    // Skip if already optimized
    if (fs.existsSync(outputPath)) {
      console.log(`⏭️  Skip ${file} (already optimized)`);
      continue;
    }
    
    const inputStats = fs.statSync(inputPath);
    totalInputSize += inputStats.size;
    
    await optimizeImage(inputPath, outputPath);
    
    const outputStats = fs.statSync(outputPath);
    totalOutputSize += outputStats.size;
  }
  
  console.log('\n=== OPTIMIZATION COMPLETE ===');
  console.log(`Original total: ${(totalInputSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Optimized total: ${(totalOutputSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Total savings: ${(((totalInputSize - totalOutputSize) / totalInputSize) * 100).toFixed(1)}%`);
  console.log(`\nOptimized images saved in: ${OUTPUT_DIR}`);
  console.log(`\nNext: Run upload-optimized.js to re-upload to Supabase`);
}

optimizeAll().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});