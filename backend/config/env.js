module.exports = {
  port: Number(process.env.PORT || 4000),
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'smart_gate_db_new'
  },
  jwtSecret: process.env.JWT_SECRET || 'smart-gate-super-secret',
  cameraRtspUrl: process.env.CAMERA_RTSP_URL || 'rtsp://10.255.252.106/live/ch00_0',
  cameraSnapshotFile: process.env.CAMERA_SNAPSHOT_FILE || 'latest-camera.jpg',
  ffmpegPath: process.env.FFMPEG_PATH || 'ffmpeg',
  ocrServiceUrl: process.env.OCR_SERVICE_URL || 'http://127.0.0.1:5000',
  esp: {
    host: process.env.ESP_HOST || '10.233.7.61',
    port: Number(process.env.ESP_PORT || 80),
    servoEndpoint: process.env.ESP_SERVO_ENDPOINT || '/servo/open'
  }
};
