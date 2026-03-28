const fs = require('fs/promises');
const env = require('../config/env');
const { takeSnapshot } = require('./captureCamera');

/**
 * Process OCR on a snapshot file that already exists
 * @param {string} filePath - Absolute path to the image file
 * @param {string} fileName - Filename for logging
 * @returns {Promise<Object>} Result object with detected_plate, confidence, and bbox
 */
async function processOCRFromFile(filePath, fileName) {
  const ocrStartTime = Date.now();
  
  try {
    console.log('\n  🔄 [OCR PIPELINE] Starting...');
    console.log(`  📖 Step 1: Reading snapshot file from buffer...`);
    const imageBuffer = await fs.readFile(filePath);
    console.log(`  ✅ File size: ${(imageBuffer.length / 1024).toFixed(2)} KB`);

    // Kirim ke FastAPI OCR service sebagai multipart/form-data
    console.log('  📤 Step 2: Sending to OCR service...');
    console.log(`     Target: ${env.ocrServiceUrl}/detect-plate`);
    
    const formData = new FormData();
    const blob = new Blob([imageBuffer], { type: 'image/jpeg' });
    formData.append('file', blob, fileName);

    const ocrRequestTime = Date.now();
    const response = await fetch(`${env.ocrServiceUrl}/detect-plate`, {
      method: 'POST',
      body: formData,
      timeout: 30000
    });
    const ocrResponseTime = Date.now() - ocrRequestTime;

    console.log(`  📨 OCR Service Response: HTTP ${response.status} (${ocrResponseTime}ms)`);

    if (!response.ok) {
      throw new Error(`OCR service error: HTTP ${response.status}`);
    }

    const result = await response.json();
    console.log(`  📊 OCR Raw Result:`, JSON.stringify(result, null, 4));

    if (!result.success) {
      throw new Error(result.message || 'OCR detection failed');
    }

    const detectedPlate = result.detected_plate;
    console.log(`  ✅ Detected Plate: ${detectedPlate}`);
    console.log(`  📦 BBox: (${result.bbox?.x1}, ${result.bbox?.y1}) to (${result.bbox?.x2}, ${result.bbox?.y2}), Confidence: ${result.bbox?.confidence}`);
    
    const totalOcrDuration = Date.now() - ocrStartTime;
    console.log(`  ⏱️  Total OCR Pipeline: ${totalOcrDuration}ms`);

    // Return full result with bbox info
    return {
      detected_plate: result.detected_plate,
      confidence: result.confidence,
      bbox: result.bbox
    };
  } catch (error) {
    const totalOcrDuration = Date.now() - ocrStartTime;
    console.error(`  ❌ OCR Pipeline Error (${totalOcrDuration}ms):`, error.message);
    throw error;
  }
}

/**
 * Capture a fresh snapshot from the RTSP camera and process OCR
 * (Used in verifyEntry where we need automatic capture)
 * @returns {Promise<Object>} Result object with detected_plate, confidence, and bbox
 */
async function getLatestOCRPlate() {
  try {
    console.log('  📸 Capturing fresh snapshot from RTSP...');
    const snapshot = await takeSnapshot();
    console.log(`  ✅ Snapshot captured: ${snapshot.fileName}`);
    
    // Process OCR on the captured snapshot
    return await processOCRFromFile(snapshot.outputPath, snapshot.fileName);
  } catch (error) {
    console.error(`  ❌ getLatestOCRPlate Error:`, error.message);
    throw error;
  }
}

module.exports = {
  getLatestOCRPlate,
  processOCRFromFile
};
