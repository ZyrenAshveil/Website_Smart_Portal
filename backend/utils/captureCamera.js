const fs = require('fs/promises');
const path = require('path');
const { spawn } = require('child_process');
const env = require('../config/env');

/**
 * Capture RTSP snapshot dengan filename unik berdasarkan timestamp
 * Filename format: YYYY-MM-DD_HH-mm-ss_[timestamp].jpg
 * Untuk dokumentasi dan audit trail
 * 
 * @param {boolean} includeYoloBbox - Jika true, kirim ke YOLO untuk get bbox info (tidak draw server-side)
 */
async function takeSnapshot(includeYoloBbox = false) {
  const snapshotStartTime = Date.now();
  const captureDir = path.join(__dirname, '..', 'capture');
  
  // Ensure direktori ada
  await fs.mkdir(captureDir, { recursive: true });

  // Generate unique filename dengan timestamp
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const ms = String(now.getMilliseconds()).padStart(3, '0');
  
  const fileName = `${year}-${month}-${day}_${hours}-${minutes}-${seconds}_${ms}.jpg`;
  const outputPath = path.join(captureDir, fileName);

  // Log untuk debugging
  console.log(`    📸 Capturing from RTSP: ${env.cameraRtspUrl}`);
  console.log(`    📁 Output: ${fileName}`);
  if (includeYoloBbox) {
    console.log(`    🎯 Will request YOLO detection for bbox`);
  }

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(env.ffmpegPath, [
      '-y',
      '-rtsp_transport',
      'tcp',
      '-i',
      env.cameraRtspUrl,
      '-frames:v',
      '1',
      '-q:v',
      '2',  // Quality: 1=best, 31=worst. 2 = very high quality
      outputPath
    ]);

    let stderr = '';

    ffmpeg.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    ffmpeg.on('error', (error) => {
      console.error(`    ❌ FFmpeg process error:`, error.message);
      reject(error);
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        const duration = Date.now() - snapshotStartTime;
        console.log(`    ✅ Snapshot saved (${duration}ms): ${fileName}`);
        
        resolve({
          fileName,
          outputPath,
          publicPath: `/capture/${fileName}`,
          duration_ms: duration,
          includeYoloBbox
        });
        return;
      }

      console.error(`    ❌ FFmpeg exit code ${code}`);
      reject(new Error(stderr || `ffmpeg exited with code ${code}`));
    });
  });
}

/**
 * Capture RTSP snapshot langsung ke buffer (untuk live streaming)
 * Tidak save ke disk - return image bytes directly
 * @returns {Promise<Buffer>} Raw JPEG image buffer
 */
async function getLiveSnapshotBuffer() {
  const captureStartTime = Date.now();
  console.log(`    📸 Capturing live snapshot from RTSP...`);
  
  return new Promise((resolve, reject) => {
    const chunks = [];
    
    const ffmpeg = spawn(env.ffmpegPath, [
      '-y',
      '-rtsp_transport',
      'tcp',
      '-i',
      env.cameraRtspUrl,
      '-frames:v',
      '1',
      '-q:v',
      '2',
      '-f',
      'image2',
      'pipe:1'
    ]);

    let stderr = '';

    ffmpeg.stdout.on('data', (chunk) => {
      chunks.push(chunk);
    });

    ffmpeg.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    ffmpeg.on('error', (error) => {
      console.error(`    ❌ FFmpeg live snapshot error:`, error.message);
      reject(error);
    });

    ffmpeg.on('close', (code) => {
      if (code === 0 && chunks.length > 0) {
        const buffer = Buffer.concat(chunks);
        const duration = Date.now() - captureStartTime;
        console.log(`    ✅ Live snapshot captured (${duration}ms): ${(buffer.length / 1024).toFixed(2)} KB`);
        resolve(buffer);
        return;
      }

      const duration = Date.now() - captureStartTime;
      console.error(`    ❌ FFmpeg exit code ${code} (${duration}ms)`);
      reject(new Error(stderr || `ffmpeg exited with code ${code}`));
    });
  });
}

module.exports = {
  takeSnapshot,
  getLiveSnapshotBuffer
};
