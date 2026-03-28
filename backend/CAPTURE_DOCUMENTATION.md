# Smart Gate System - Image Capture Documentation

## Problem Solved ✅

### 1. Gambar Tidak Muncul
**Root Cause:** Frontend di port 5173, backend di port 4010. Path `/capture/...` diresolve ke port yang salah.

**Solution:** Backend sekarang return **full URL** ke image:
- Database: `/capture/2026-03-15_01-07-24_610.jpg`
- API Response: `http://localhost:4010/capture/2026-03-15_01-07-24_610.jpg`
- Frontend render: `<img src="http://localhost:4010/capture/...">` ✅

### 2. Dokumentasi Gambar
**Problem:** Semua screenshot overwrite ke `latest-camera.jpg`, tidak ada riwayat.

**Solution:** Setiap snapshot sekarang punya **unique filename dengan timestamp**:
```
Format: YYYY-MM-DD_HH-mm-ss_mmm.jpg
Contoh: 2026-03-15_01-07-24_610.jpg
        2026-03-15_01-07-24_618.jpg
        2026-03-15_01-07-25_005.jpg
```

## File Changes

### 1. `/backend/utils/captureCamera.js` 
✅ Timestamp-based unique filenames
✅ Improved ffmpeg quality setting (-q:v 2)
✅ Better logging for debugging

### 2. `/backend/controllers/accessController.js`
✅ `getDashboardSummary()` - Transform image URLs to full path
✅ `listAccessLogs()` - Transform image URLs to full path

### 3. `/backend/app.js`
✅ Already had `/capture` static middleware (no changes needed)

## Image Path Flow

### Request Flow:
```
ESP32 → POST /verify-entry
  ↓
Backend captures snapshot → 2026-03-15_01-07-24_610.jpg
  ↓
Backend processes OCR
  ↓
Backend logs to DB: image_path_masuk = "/capture/2026-03-15_01-07-24_610.jpg"
  ↓
Return JSON response (async)
```

### Response Flow:
```
Frontend requests /api/dashboard
  ↓
Backend queries DB → image_path_masuk = "/capture/2026-03-15_01-07-24_610.jpg"
  ↓
Backend transforms → "http://localhost:4010/capture/2026-03-15_01-07-24_610.jpg"
  ↓
Frontend receives full URL in response
  ↓
Frontend renders: <img src="http://localhost:4010/capture/...">
  ↓
Browser requests image from backend:4010 ✅
  ↓
Backend serves static file from /backend/capture/ folder ✅
```

## Files Location
```
/backend/capture/
  ├── 2026-03-15_01-07-24_610.jpg
  ├── 2026-03-15_01-07-24_618.jpg
  └── latest-camera.jpg (deprecated, for legacy compatibility)
```

## Database Query Example
```sql
-- View all captured images
SELECT id, client_id, driver_name, image_path_masuk, waktu_masuk 
FROM access_logs 
WHERE image_path_masuk IS NOT NULL 
ORDER BY id DESC 
LIMIT 20;

-- Result:
-- image_path_masuk: /capture/2026-03-15_01-07-24_610.jpg
-- Status in API: http://localhost:4010/capture/2026-03-15_01-07-24_610.jpg
```

## Testing Checklist

- [ ] Restart backend: `npm run dev`
- [ ] Open frontend: http://localhost:5173
- [ ] Login dengan credentials: testuser / pass123
- [ ] Go to Dashboard → Lihat Recent Access
- [ ] Gambar harus tampil (thumbnail 60px)
- [ ] Klik gambar → Modal preview full-size
- [ ] Go to Access Logs → Lihat Snapshot column
- [ ] Gambar harus tampil di semua log entries
- [ ] Trigger verify-entry dari ESP32
- [ ] Baru file capture muncul di `/backend/capture/` folder
- [ ] Gambar langsung tampil di dashboard (real-time)

## API Response Example

### GET /api/dashboard
```json
{
  "success": true,
  "data": {
    "totalClients": 5,
    "activeClients": 4,
    "totalAccess": 42,
    "validAccess": 38,
    "invalidAccess": 4,
    "recentLogs": [
      {
        "id": 4,
        "client_id": "GATE-001",
        "driver_name": "Budi Santoso",
        "plat_ble": "AB 1234 CD",
        "plat_ocr": "AB 1234 CD",
        "status": "VALID",
        "waktu_masuk": "2026-03-15T10:30:45.000Z",
        "image_path_masuk": "http://localhost:4010/capture/2026-03-15_01-07-24_610.jpg"
      }
    ]
  }
}
```

## Remarks

1. **Unique Filename**: Setiap OCR check menghasilkan file baru → perfect untuk audit trail
2. **Full URL**: Gambar langsung bisa diakses dari browser tanpa post-processing
3. **Static Serving**: Express `/capture` middleware handling request dengan efficient
4. **Port Agnostic**: Full URL berarti tidak masalah kalau deployment di IP berbeda
5. **Backward Compatible**: Lama `latest-camera.jpg` masih ada untuk legacy code

## Notes untuk Production

Saat production (IP berbeda dari localhost):
```javascript
// Change hardcoded localhost:4010 ke variable dari env atau config
const imageUrl = `${env.BACKEND_URL}${row.image_path_masuk}`;

// Or construct from request header:
const baseURL = `${req.protocol}://${req.get('host')}`;
const imageUrl = `${baseURL}${row.image_path_masuk}`;
```
