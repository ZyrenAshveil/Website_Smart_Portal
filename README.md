# Smart Gate Portal

Struktur proyek:

- `backend/` untuk API Node.js + Express + MySQL
- `frontend/` untuk aplikasi web Vue 3 + Vite
- `backend/ocr/` untuk service OCR FastAPI
- `backend/capture/` untuk menyimpan snapshot kamera dari RTSP

## 1. Setup database

1. Buat database MySQL `smart_gate_db_new`
2. Jalankan file `backend/database/schema.sql`

## 2. Setup backend

1. Salin `backend/.env.example` menjadi `backend/.env`
2. Sesuaikan kredensial MySQL dan konfigurasi kamera
3. Jalankan:

```bash
cd backend
npm install
npm run dev
```

Backend berjalan di `http://localhost:4000`

Endpoint utama ESP32:

- `POST /verify-entry`

Payload:

```json
{
  "client_id": "GT-01",
  "mac_address": "AA:BB:CC:DD:EE:FF",
  "driver_id": "DRV-01",
  "ble_plat": "AB 1472 PE",
  "driver_name": "Budi",
  "muatan": "Semen"
}
```

## 3. Setup frontend

1. Salin `frontend/.env.example` menjadi `frontend/.env`
2. Jalankan:

```bash
cd frontend
npm install
npm run dev
```

Frontend berjalan di `http://localhost:5173`

## 4. Setup OCR service

1. Buat environment Python
2. Install dependency:

```bash
cd backend/ocr
pip install -r requirements.txt
python main.py
```

OCR service default berjalan di `http://localhost:5000`

## Catatan kamera

Browser tidak memutar RTSP secara native. Karena itu halaman kamera di frontend menggunakan snapshot berkala dari RTSP `rtsp://10.255.252.106/live/ch00_0` melalui `ffmpeg` di backend.
# Website_Smart_Portal
