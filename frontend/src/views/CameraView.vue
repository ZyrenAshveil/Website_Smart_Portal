<script setup>
import { onBeforeUnmount, onMounted, ref, nextTick } from 'vue';
import AppShell from '../components/AppShell.vue';
import { API_BASE_URL, apiRequest } from '../services/api';

const streamInfo = ref({ rtspUrl: '', snapshotUrl: '', note: '' });
const imageUrl = ref('');
const loading = ref(false);
const imageElement = ref(null);
const canvasElement = ref(null);
const bbox = ref(null);
const ocrResult = ref('');
const error = ref('');
const streamReady = ref(false);
let isPageActive = true;
let abortController = null;
let streamRefreshInterval = null;

async function loadStreamInfo() {
  const response = await apiRequest('/api/camera/stream-info');
  streamInfo.value = response.data;
}

// Display live snapshot pada canvas (fresh capture untuk visual only, BUKAN untuk OCR)
async function refreshLiveStream() {
  if (!isPageActive || loading.value || bbox.value) return;
  if (!canvasElement.value) return;
  
  try {
    const token = localStorage.getItem('smart_gate_token');
    
    const response = await fetch(`${API_BASE_URL}/api/camera/live-snapshot`, {
      method: 'GET',
      signal: abortController?.signal,
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) return;
    
    const imageBlob = await response.blob();
    
    // Render directly to canvas
    const img = new Image();
    img.onload = () => {
      const canvas = canvasElement.value;
      const ctx = canvas.getContext('2d');
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      ctx.fillStyle = '#00ff00';
      ctx.font = 'bold 14px Arial';
      ctx.fillText('Live Display', 10, 30);
    };
    img.src = URL.createObjectURL(imageBlob);
  } catch (err) {
    console.debug('Display error:', err.message);
  }
}

// Load initial snapshot (no OCR processing)
async function loadInitialSnapshot() {
  try {
    console.log('📸 Loading initial RTSP snapshot...');
    const response = await apiRequest('/api/camera/stream-info', { 
      signal: abortController?.signal 
    });
    
    if (!isPageActive) return;
    
    // Display the snapshot from RTSP without processing
    imageUrl.value = `${API_BASE_URL}${response.data.snapshotUrl}?t=${Date.now()}`;
    console.log('✅ Initial snapshot loaded (no processing)');
  } catch (err) {
    console.error('❌ Error loading initial snapshot:', err);
  }
}

// Capture snapshot with OCR processing
async function captureAndProcessSnapshot() {
  if (!isPageActive || loading.value) return;
  
  loading.value = true;
  ocrResult.value = '';
  bbox.value = null;
  error.value = '';
  
  // Create abort controller for this request
  abortController = new AbortController();
  
  try {
    console.log('📸 Capturing snapshot for OCR processing...');
    const response = await apiRequest('/api/camera/capture', { 
      method: 'POST',
      signal: abortController.signal 
    });
    
    if (!isPageActive) {
      console.log('⚠️ Page unmounted, cancelling processing');
      return;
    }
    
    const snapshot = response.data;
    console.log('✅ Snapshot captured:', { publicPath: snapshot.publicPath, hasDetection: snapshot.hasDetection });
    
    // Set image URL and wait for it to load
    const fullImageUrl = `${API_BASE_URL}${snapshot.publicPath}?t=${Date.now()}`;
    console.log('🖼️ Loading captured image for bbox drawing...');
    imageUrl.value = fullImageUrl;
    
    // Wait for image to load
    const imageLoaded = new Promise((resolve, reject) => {
      if (!imageElement.value) {
        reject(new Error('Image element not found'));
        return;
      }
      
      const timeout = setTimeout(() => {
        reject(new Error('Image load timeout'));
      }, 10000);
      
      imageElement.value.onload = () => {
        clearTimeout(timeout);
        console.log('✅ Image loaded successfully');
        resolve(imageElement.value);
      };
      
      imageElement.value.onerror = (err) => {
        clearTimeout(timeout);
        console.error('❌ Image load error:', err);
        reject(new Error('Image load failed'));
      };
    });
    
    await imageLoaded;
    
    // Extra wait to ensure image is fully decoded and ready for canvas drawing
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Check again before drawing
    if (!isPageActive) {
      console.log('⚠️ Page unmounted, cancelling drawing');
      return;
    }
    
    // Get bbox info if detection succeeded
    if (snapshot.bbox && snapshot.hasDetection) {
      console.log('🎯 Bbox received:', JSON.stringify(snapshot.bbox));
      console.log('📝 Plate detected:', snapshot.ocr_plate);
      console.log('🎯 Setting bbox.value...');
      bbox.value = snapshot.bbox;
      ocrResult.value = snapshot.ocr_plate || '';
      error.value = '';
      
      console.log('🎯 bbox.value is now:', bbox.value);
      
      await nextTick();
      // Wait a bit for image to be ready
      await new Promise(resolve => setTimeout(resolve, 200));
      console.log('🎯 About to call drawBoundingBox');
      drawBoundingBox();
    } else {
      console.log('⚠️ No plate detection');
      console.log('API Response:', { bbox: snapshot.bbox, hasDetection: snapshot.hasDetection });
      ocrResult.value = '';
      bbox.value = null;
      error.value = 'Tidak ada plat yang terdeteksi pada gambar ini';
      
      // Still draw the image even without detection
      await nextTick();
      drawImageOnly();
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      console.log('⚠️ Request cancelled (page unmounted)');
      return;
    }
    console.error('❌ Capture error:', err);
    error.value = `Error: ${err.message}`;
    bbox.value = null;
  } finally {
    loading.value = false;
  }
}

function drawImageOnly() {
  if (!imageElement.value || !canvasElement.value) return;
  
  const canvas = canvasElement.value;
  const ctx = canvas.getContext('2d');
  const img = imageElement.value;
  
  console.log('🎨 Drawing image to canvas. Size:', { width: img.width, height: img.height });
  
  canvas.width = img.width;
  canvas.height = img.height;
  ctx.drawImage(img, 0, 0);
}

function drawBoundingBox() {
  console.log('🎨 drawBoundingBox called');
  
  if (!canvasElement.value) {
    console.error('❌ Canvas element missing');
    return;
  }
  
  if (!bbox.value) {
    console.error('❌ bbox.value is empty');
    return;
  }
  
  const canvas = canvasElement.value;
  
  // Ensure 2d context
  if (!canvas.getContext) {
    console.error('❌ Canvas context not available');
    return;
  }
  
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.error('❌ Failed to get 2d context');
    return;
  }
  
  // Get image from imageElement
  const img = imageElement.value;
  if (!img) {
    console.error('❌ Image element not found');
    return;
  }
  
  if (!img.src || img.src.length === 0) {
    console.error('❌ Image src not set');
    return;
  }
  
  // Check if image is actually loaded
  if (img.width === 0 || img.height === 0) {
    console.error('❌ Image not loaded properly. Width:', img.width, 'Height:', img.height);
    return;
  }
  
  console.log('📐 Image loaded. Natural size:', { width: img.naturalWidth, height: img.naturalHeight });
  
  // Set canvas size to match image
  const width = img.naturalWidth > 0 ? img.naturalWidth : img.width;
  const height = img.naturalHeight > 0 ? img.naturalHeight : img.height;
  
  console.log('📐 Setting canvas dimensions:', { width, height });
  canvas.width = width;
  canvas.height = height;
  
  // Clear canvas
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);
  
  // Draw image
  try {
    ctx.drawImage(img, 0, 0);
    console.log('✅ Image drawn to canvas');
  } catch (err) {
    console.error('❌ Failed to draw image to canvas:', err);
    // Still try to draw bbox even if image fails
  }
  
  // Draw bounding box
  const { x1, y1, x2, y2, confidence } = bbox.value;
  
  console.log('🎯 BBox values from state:', { x1, y1, x2, y2, confidence });
  console.log('🎯 Bbox object type:', typeof bbox.value, 'Keys:', Object.keys(bbox.value));
  
  // Validate coordinates are numbers
  if (!Number.isFinite(x1) || !Number.isFinite(y1) || !Number.isFinite(x2) || !Number.isFinite(y2)) {
    console.error('❌ Invalid bbox coordinates - not numbers:', { x1: typeof x1, y1: typeof y1, x2: typeof x2, y2: typeof y2 });
    return;
  }
  
  const rectWidth = Math.abs(x2 - x1);
  const rectHeight = Math.abs(y2 - y1);
  
  console.log('📏 Rectangle dimensions:', { rectWidth, rectHeight });
  
  if (rectWidth < 1 || rectHeight < 1) {
    console.warn('⚠️ BBox dimensions too small:', { rectWidth, rectHeight });
  }
  
  console.log('📏 Drawing box from', { x1, y1 }, 'with size', { rectWidth, rectHeight });
  
  // Draw box with shadow effect
  ctx.strokeStyle = '#FF6600';
  ctx.lineWidth = 1;
  ctx.strokeRect(x1 - 1, y1 - 1, rectWidth + 2, rectHeight + 2);
  
  ctx.strokeStyle = '#00ff00';
  ctx.lineWidth = 3;
  ctx.strokeRect(x1, y1, rectWidth, rectHeight);
  
  console.log('✅ Rectangle drawn');
  
  // Draw confidence text
  if (Number.isFinite(confidence)) {
    const text = `${(confidence * 100).toFixed(1)}%`;
    ctx.font = 'bold 18px Arial';
    ctx.fillStyle = '#000000';
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 3;
    ctx.strokeText(text, x1 + 5, y1 - 5);
    ctx.fillStyle = '#00ff00';
    ctx.fillText(text, x1 + 5, y1 - 5);
    console.log('✅ Confidence text drawn');
  }
  
  console.log('🎉 Bbox drawing complete!');
}

onMounted(async () => {
  console.log('📱 Camera page mounted - Stream Mode');
  isPageActive = true;
  abortController = new AbortController();
  
  await loadStreamInfo();
  streamReady.value = true;
  console.log('✅ Stream ready for capture - waiting for manual trigger...');
  
  // Start live stream refresh (every 2 seconds)
  streamRefreshInterval = setInterval(() => {
    if (isPageActive && !loading.value && !bbox.value) {
      refreshLiveStream();
    }
  }, 2000);
  
  // Initial stream display
  await refreshLiveStream();
});

onBeforeUnmount(() => {
  console.log('📱 Camera page unmounting - cleanup started');
  isPageActive = false;
  
  // Cancel stream refresh
  if (streamRefreshInterval) {
    clearInterval(streamRefreshInterval);
  }
  
  // Cancel any pending requests
  if (abortController) {
    abortController.abort();
  }
  
  // Cleanup image load listeners
  if (imageElement.value) {
    imageElement.value.onload = null;
    imageElement.value.onerror = null;
  }
  
  console.log('✅ Camera page cleanup complete');
});
</script>

<template>
  <AppShell>
    <section class="page-header">
      <div>
        <p class="eyebrow">Camera Monitoring</p>
        <h2>Live preview kamera gate</h2>
        <p class="muted-text">Tekan tombol "Capture & Detect" untuk mengambil snapshot dan mendeteksi plat dengan YOLO bounding box</p>
      </div>
      <button class="ghost-button" @click="captureAndProcessSnapshot">{{ loading ? 'Processing OCR...' : '📸 Capture & Detect' }}</button>
    </section>

    <section class="camera-layout">
      <article class="panel-card camera-preview-card">
        <div class="section-header stacked">
          <div>
            <p class="eyebrow">Preview</p>
            <h3>Kamera gerbang dengan YOLO Detection</h3>
          </div>
          <p class="muted-text">
            <span v-if="ocrResult" style="color: #00aa00; font-weight: bold;">
              ✅ Detected: {{ ocrResult }}
            </span>
            <span v-else-if="error" style="color: #ff6b6b; font-weight: bold;">
              ⚠️ {{ error }}
            </span>
            <span v-else-if="loading" style="color: #888;">
              Processing capture...
            </span>
            <span v-else-if="streamReady && !imageUrl" style="color: #00aa00; font-weight: bold;">
              🟢 Stream Ready - Waiting for capture...
            </span>
            <span v-else style="color: #888;">
              Initializing...
            </span>
          </p>
        </div>

        <div style="position: relative; display: inline-block; width: 100%; background: #000; border-radius: 4px; overflow: hidden;">
          <!-- Hidden image untuk load -->
          <img 
            ref="imageElement" 
            :src="imageUrl" 
            alt="Camera snapshot" 
            style="display: none;"
            crossorigin="anonymous"
          />
          <!-- Canvas untuk display dengan bbox -->
          <canvas 
            ref="canvasElement" 
            alt="Camera with bbox"
            width="1920"
            height="1080"
            style="display: block; width: 100%; height: auto; border-radius: 4px; background: #000; min-height: 400px;"
          />
        </div>
      </article>

      <article class="panel-card details-card">
        <p class="eyebrow">Stream Source</p>
        <h3>RTSP camera endpoint</h3>
        <p class="mono-block">{{ streamInfo.rtspUrl }}</p>

        <p class="eyebrow" style="margin-top: 20px;">Status</p>
        <div style="padding: 10px; background: #f5f5f5; border-radius: 4px; font-family: monospace; font-size: 13px;">
          <div v-if="ocrResult">
            <strong>✅ Plate Detected:</strong><br>{{ ocrResult }}<br><br>
            <strong>Bbox Coordinates:</strong><br>
            X1: {{ bbox?.x1 }}, Y1: {{ bbox?.y1 }}<br>
            X2: {{ bbox?.x2 }}, Y2: {{ bbox?.y2 }}<br>
            <strong>Confidence:</strong><br>
            {{ (bbox?.confidence * 100).toFixed(1) }}%
          </div>
          <div v-else-if="error" style="color: #ff6b6b;">
            <strong>⚠️ Detection Failed:</strong><br>
            {{ error }}
          </div>
          <div v-else-if="streamReady && !imageUrl" style="color: #00aa00;">
            <strong>🟢 Stream Mode Active</strong><br>
            Camera: {{ streamInfo.rtspUrl }}<br><br>
            <strong>Waiting for manual capture.</strong><br>
            Klik tombol "📸 Capture & Detect" untuk mulai proses deteksi plat.
          </div>
          <div v-else style="color: #999;">
            Loading stream info...
          </div>
        </div>
      </article>
    </section>
  </AppShell>
</template>
