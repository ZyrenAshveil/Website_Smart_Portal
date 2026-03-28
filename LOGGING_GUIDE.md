# Smart Gate System - Comprehensive Logging Guide

## Overview
Sistem Smart Gate sekarang memiliki **detailed execution logging** di semua komponen:
1. **Backend Node.js** - Logging request/response dari ESP32
2. **OCR Client** - Logging komunikasi dengan Python OCR service  
3. **Camera Capture** - Logging snapshot capture dari RTSP
4. **Python OCR Service** - Detailed logging pipeline YOLO + EasyOCR

---

## Backend Logging (Node.js)

### File: `/backend/controllers/accessController.js`

#### Logged Information:
- **Request dari ESP32**: client_id, mac_address, driver_id, plat_ble, driver_name, muatan
- **Filter 1 (MAC Validation)**: MAC address registration check result
- **Filter 2 (Snapshot + OCR)**: Camera capture, OCR processing, execution time
- **Filter 3 (Plate Matching)**: BLE vs OCR plate comparison, match result
- **Database Logging**: Access log insertion status
- **Response ke ESP32**: Decision (OPEN_GATE/DENIED_PLATE_MISMATCH), OCR result, processing time

#### Log Format:

```
================================================================================
📡 [ESP32 REQUEST] 2026-03-15T10:30:45.123Z
================================================================================
CLIENT_ID: GT-001
MAC_ADDRESS: AA:BB:CC:DD:EE:FF
DRIVER_ID: DRV-2026-001
BLE_PLAT: AB 1234 CD
DRIVER_NAME: Budi Santoso
MUATAN: Barang Elektronik
✅ Database connection established

🔍 [FILTER 1] Validating MAC Address...
✅ FILTER 1 PASSED - MAC Address registered

📸 [FILTER 2] Capturing snapshot & processing OCR...
  # (logs dari captureCamera.js & ocrClient.js akan muncul di sini)
✅ Snapshot captured: /capture/2026-03-15_10-30-45_987.jpg (1250ms)
✅ OCR result: AB 1234 CD

🔗 [FILTER 3] Comparing plates...
BLE Plate (normalized): AB 1234 CD
OCR Plate (normalized): AB 1234 CD
✅ FILTER 3 PASSED - Plates match! OPENING GATE

💾 [DATABASE] Logging access attempt...
✅ Access log saved to database

📤 [RESPONSE TO ESP32]
{
  "success": true,
  "decision": "OPEN_GATE",
  "ocr_plate": "AB 1234 CD",
  "ble_plate": "AB 1234 CD",
  "timestamp": "2026-03-15T10:30:47.500Z",
  "processing_time_ms": 2375
}
Total processing time: 2375ms
================================================================================
```

---

## OCR Client Logging (Node.js)

### File: `/backend/utils/ocrClient.js`

#### Logged Steps:
1. Pipeline start
2. Snapshot capture from RTSP
3. File reading to buffer
4. Send to FastAPI service
5. OCR response parsing
6. Detected plate extraction
7. Total pipeline duration

#### Log Format:

```
  🔄 [OCR PIPELINE] Starting...
  📸 Step 1: Capturing snapshot from RTSP...
  ✅ Snapshot captured: 2026-03-15_10-30-45_234.jpg
  📖 Step 2: Reading snapshot file into buffer...
  ✅ File size: 45.67 KB
  📤 Step 3: Sending to OCR service...
     Target: http://127.0.0.1:5000/detect-plate
  📨 OCR Service Response: HTTP 200 (1250ms)
  📊 OCR Raw Result:
    {
      "success": true,
      "detected_plate": "AB 1234 CD",
      "confidence": 0.987
    }
  ✅ Detected Plate: AB 1234 CD
  ⏱️  Total OCR Pipeline: 1255ms
```

---

## Camera Capture Logging (Node.js)

### File: `/backend/utils/captureCamera.js`

#### Logged Information:
- RTSP source URL
- Output filename
- Snapshot capture command execution
- File save status
- File size (after capture)
- Execution duration

#### Log Format:

```
    📸 Capturing from RTSP: rtsp://10.255.252.106/live/ch00_0
    📁 Output: 2026-03-15_10-30-45_234.jpg
    ✅ Snapshot saved (1200ms): 2026-03-15_10-30-45_234.jpg
```

---

## Python OCR Service Logging

### File: `/backend/ocr/main.py`

#### Startup Log:

```
================================================================================
⚙️  [OCR SERVICE STARTUP] 2026-03-15T10:15:32.123456
================================================================================
Loading models...
✅ Models loaded successfully
================================================================================
```

#### Request Processing Log:

```
================================================================================
📡 [OCR REQUEST] 2026-03-15T10:30:45.987654
================================================================================
File: 2026-03-15_10-30-45_234.jpg
Content-Type: image/jpeg

🔄 [STEP 1] Loading image from upload...
  ✅ Image loaded: 45.67 KB
  ✅ Image dimensions: 1280x720
  
🔍 [STEP 2] Running YOLO plate detection...
  ✅ YOLO inference: 245.3ms
  📊 Detections: 1 box(es)
  📍 Bounding box: (150,280) to (420,340)
  🎖️  Confidence: 0.987

🎯 [STEP 3] Processing detected plate region...
  📍 Bounding box: (150,280) to (420,340)
  🎖️  Confidence: 0.987
  📦 Cropped region: 270x60px

📐 [STEP 4] Deskewing and preprocessing variants...
  ✅ Deskew complete
  🔄 Variant 1: Running EasyOCR...
    📝 Raw OCR output: [[['A', 0.95]], [['B', 0.92]], ...]
    🧹 Cleaned: 'AB1234CD'
    ✅ Normalized: 'AB 1234 CD'
  🔄 Variant 2: Running EasyOCR...
    📝 Raw OCR output: [[['A', 0.94]], [['B', 0.93]], ...]
    🧹 Cleaned: 'AB1234CD'
    ✅ Normalized: 'AB 1234 CD'
  🔄 Variant 3: Running EasyOCR...
    📝 Raw OCR output: [[['A', 0.93]], [['B', 0.91]], ...]
    🧹 Cleaned: 'AB1234CD'
    ✅ Normalized: 'AB 1234 CD'
  🔄 Variant 4: Running EasyOCR...
    📝 Raw OCR output: "TEKS_KABUR"
    ⚠️  Text too short or invalid
  ✅ Preprocessing complete (3245.5ms)
  📊 Valid candidates: 3/4

🗳️  [STEP 5] Voting on candidates...
  🏆 Winner: 'AB 1234 CD' (3/3 votes)

📤 [RESPONSE]
  Result: AB 1234 CD
  Confidence: 0.987
  Response: {
    "success": true,
    "detected_plate": "AB 1234 CD",
    "confidence": 0.987
  }
================================================================================
```

---

## Example Complete Flow Log

### Scenario: Successful Gate Opening

```
[Terminal 1: Backend (port 4010)]
================================================================================
📡 [ESP32 REQUEST] 2026-03-15T10:30:44.500Z
================================================================================
CLIENT_ID: GATE-001
MAC_ADDRESS: A4:CF:12:3D:4E:5F
DRIVER_ID: DRV-123
BLE_PLAT: AB 1234 CD
DRIVER_NAME: Budi Santoso
MUATAN: Parts Motor
✅ Database connection established

🔍 [FILTER 1] Validating MAC Address...
✅ FILTER 1 PASSED - MAC Address registered

📸 [FILTER 2] Capturing snapshot & processing OCR...

  🔄 [OCR PIPELINE] Starting...
  📸 Step 1: Capturing snapshot from RTSP...
  ✅ Snapshot captured: 2026-03-15_10-30-45_234.jpg

  (OCR logs dari Python service)

  ✅ Detected Plate: AB 1234 CD
  ⏱️  Total OCR Pipeline: 1245ms

✅ Snapshot captured: /capture/2026-03-15_10-30-45_234.jpg (1250ms)
✅ OCR result: AB 1234 CD

🔗 [FILTER 3] Comparing plates...
BLE Plate (normalized): AB 1234 CD
OCR Plate (normalized): AB 1234 CD
✅ FILTER 3 PASSED - Plates match! OPENING GATE

💾 [DATABASE] Logging access attempt...
✅ Access log saved to database

📤 [RESPONSE TO ESP32]
{
  "success": true,
  "decision": "OPEN_GATE",
  "ocr_plate": "AB 1234 CD",
  "ble_plate": "AB 1234 CD",
  "timestamp": "2026-03-15T10:30:47.500Z",
  "processing_time_ms": 3000
}
Total processing time: 3000ms
================================================================================
```

---

## Log Output Destinations

### Real-time Monitoring:

1. **Backend Terminal**: `npm run dev` output
2. **OCR Terminal**: `python main.py` or `uvicorn main:app --port 5000` output

### File Storage (Optional):

Untuk save logs ke file, bisa tambahan dengan:

**Backend:**
```javascript
const fs = require('fs');
const logStream = fs.createWriteStream('logs/access.log', { flags: 'a' });
console.log = function(msg) {
  logStream.write(msg + '\n');
};
```

**Python:**
```python
import logging
logging.basicConfig(
    filename='logs/ocr.log',
    level=logging.INFO,
    format='%(asctime)s - %(message)s'
)
```

---

## Log Levels

| Level | Symbol | Meaning | Color |
|-------|--------|---------|-------|
| SUCCESS | ✅ | Operation berhasil | Green |
| INFO | 📡/📸/🔍 | Informasi eksekusi | Blue |
| WARNING | ⚠️ | Ada issue tapi tidak fatal | Yellow |
| ERROR | ❌ | Operasi gagal | Red |

---

## Testing Log Capture

### 1. Start semua services:
```bash
# Terminal 1: Backend
cd d:\SKRIPSI\Website_Smart_Portal\backend
npm run dev

# Terminal 2: Python OCR
cd d:\SKRIPSI\Website_Smart_Portal\backend\ocr
python main.py
```

### 2. Trigger dari ESP32:
Send POST ke `/verify-entry` dengan data valid

### 3. Observe logs:
- Ada di Terminal 1 untuk backend
- Ada di Terminal 2 untuk OCR service

### 4. Complete flow duration:
Lihat di `processing_time_ms` di response

---

## Error Log Examples

### Scenario 1: MAC Address Not Registered

```
🔍 [FILTER 1] Validating MAC Address...
❌ FILTER 1 FAILED - MAC Address not registered
RESPONSE: DENIED_UNREGISTERED_MAC
```

### Scenario 2: Plate Mismatch

```
🔗 [FILTER 3] Comparing plates...
BLE Plate (normalized): AB 1234 CD
OCR Plate (normalized): AB 1472 PE
❌ FILTER 3 FAILED - Plates do not match! ACCESS DENIED
```

### Scenario 3: OCR Service Error

```
❌ ERROR in verifyEntry: connect ECONNREFUSED 127.0.0.1:5000
Stack: Error: connect ECONNREFUSED...
```

### Scenario 4: YOLO No Detection

```
🔍 [STEP 2] Running YOLO plate detection...
  ✅ YOLO inference: 245.3ms
  📊 Detections: 0 box(es)

⚠️  [STEP 3] No plate detected by YOLO
  ❌ Setting result to 'TIDAK_TERBACA'
```

---

## Performance Metrics

Dari log output, bisa measure:

1. **RTSP Capture Time**: Duration di `captureCamera.js`
2. **YOLO Inference Time**: "YOLO inference: XXms"
3. **EasyOCR Time**: Duration di preprocessing variant
4. **Database Insert Time**: Async, not blocked in response  
5. **Total Response Time**: `processing_time_ms` di response

Contoh breakdown:
```
- RTSP Capture: 1200ms
- YOLO Detection: 245ms
- EasyOCR (4 variants): 3245ms
- Database async: ~50ms (non-blocking)
- Total: ~3000-3500ms wall-clock time
```
