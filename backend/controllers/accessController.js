const { createMysqlConnection } = require('../config/database');
const env = require('../config/env');
const { getLatestOCRPlate, processOCRFromFile } = require('../utils/ocrClient');
const { generateAccessLogsPdf } = require('../utils/pdfExporter');
const { takeSnapshot } = require('../utils/captureCamera');
const { triggerServoOpen } = require('../utils/espClient');

async function verifyEntry(req, res, next) {
  let connection;
  const requestStartTime = Date.now();
  const executionLog = {
    timestamp: new Date().toISOString(),
    request: req.body,
    steps: []
  };

  try {
    const {
      client_id,
      mac_address,
      driver_id,
      ble_plat,
      driver_name,
      muatan
    } = req.body;

    console.log('\n' + '='.repeat(80));
    console.log('📡 [ESP32 REQUEST] ' + executionLog.timestamp);
    console.log('='.repeat(80));
    console.log('CLIENT_ID:', client_id);
    console.log('MAC_ADDRESS:', mac_address);
    console.log('DRIVER_ID:', driver_id);
    console.log('BLE_PLAT:', ble_plat);
    console.log('DRIVER_NAME:', driver_name);
    console.log('MUATAN:', muatan || '(empty)');

    if (!client_id || !mac_address || !driver_id || !ble_plat || !driver_name) {
      console.log('❌ VALIDATION FAILED - Missing required fields');
      return res.status(400).json({ success: false, message: 'Missing required payload fields' });
    }

    connection = await createMysqlConnection();
    console.log('✅ Database connection established');

    // FILTER 1: MAC ADDRESS VALIDATION
    console.log('\n🔍 [FILTER 1] Validating MAC Address...');
    const [clientRows] = await connection.execute(
      'SELECT id, client_id, mac_address, is_active FROM registered_clients WHERE mac_address = ? AND is_active = 1 LIMIT 1',
      [mac_address]
    );

    if (!clientRows.length) {
      console.log('❌ FILTER 1 FAILED - MAC Address not registered');
      executionLog.filter1_result = 'DENIED_UNREGISTERED_MAC';
      console.log('RESPONSE:', executionLog.filter1_result);
      console.log('='.repeat(80));
      return res.status(200).send('DENIED_UNREGISTERED_MAC');
    }
    console.log('✅ FILTER 1 PASSED - MAC Address registered');
    executionLog.steps.push({ step: 'filter1_mac_validation', status: 'PASS', result: clientRows[0] });

    // FILTER 2: SNAPSHOT & OCR PROCESSING
    console.log('\n📸 [FILTER 2] Capturing snapshot & processing OCR...');
    const filterStartTime = Date.now();
    
    const [snapshot, ocrResult] = await Promise.all([
      takeSnapshot(),
      getLatestOCRPlate()
    ]);

    const platOcr = ocrResult.detected_plate;
    const filterDuration = Date.now() - filterStartTime;
    console.log(`✅ Snapshot captured: ${snapshot.publicPath} (${filterDuration}ms)`);
    console.log(`✅ OCR result: ${platOcr}`);
    executionLog.steps.push({ 
      step: 'snapshot_and_ocr', 
      status: 'PASS', 
      snapshot: snapshot.publicPath, 
      ocr_plate: platOcr,
      duration_ms: filterDuration
    });

    // FILTER 3: PLATE MATCHING
    console.log('\n🔗 [FILTER 3] Comparing plates...');
    const normalizedBlePlate = String(ble_plat).trim().toUpperCase();
    const normalizedOcrPlate = String(platOcr).trim().toUpperCase();

    console.log('BLE Plate (normalized):', normalizedBlePlate);
    console.log('OCR Plate (normalized):', normalizedOcrPlate);

    const isMatched = normalizedBlePlate === normalizedOcrPlate;
    const validationStatus = isMatched ? 'VALID' : 'INVALID';
    const responseText = isMatched ? 'OPEN_GATE' : 'DENIED_PLATE_MISMATCH';

    if (isMatched) {
      console.log('✅ FILTER 3 PASSED - Plates match! OPENING GATE');
    } else {
      console.log('❌ FILTER 3 FAILED - Plates do not match! ACCESS DENIED');
    }
    executionLog.filter3_result = { status: validationStatus, decision: responseText };

    // DATABASE LOGGING (async, non-blocking)
    console.log('\n💾 [DATABASE] Logging access attempt...');
    connection.execute(
      'INSERT INTO access_logs (client_id, driver_id, driver_name, muatan, plat_ble, plat_ocr, status, waktu_masuk, image_path_masuk) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?)',
      [client_id, driver_id, driver_name, muatan || null, ble_plat, platOcr, validationStatus, snapshot.publicPath]
    ).then(() => {
      console.log('✅ Access log saved to database');
    }).catch(err => {
      console.error('❌ Failed to log access:', err.message);
    });

    // RESPONSE TO ESP32
    const totalDuration = Date.now() - requestStartTime;
    executionLog.total_duration_ms = totalDuration;
    
    const response = {
      success: true,
      decision: responseText,
      ocr_plate: platOcr,
      ble_plate: normalizedBlePlate,
      timestamp: new Date().toISOString(),
      processing_time_ms: totalDuration
    };

    console.log('\n📤 [RESPONSE TO ESP32]');
    console.log(JSON.stringify(response, null, 2));
    console.log(`Total processing time: ${totalDuration}ms`);
    console.log('='.repeat(80) + '\n');

    return res.status(200).json(response);
  } catch (error) {
    console.error('\n❌ ERROR in verifyEntry:', error.message);
    console.error('Stack:', error.stack);
    console.log('='.repeat(80) + '\n');
    return next(error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

async function getDashboardSummary(_req, res, next) {
  let connection;

  try {
    connection = await createMysqlConnection();

    const [[clientSummary]] = await connection.query(
      'SELECT COUNT(*) AS total_clients, SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active_clients FROM registered_clients'
    );
    const [[logSummary]] = await connection.query(
      'SELECT COUNT(*) AS total_access, SUM(CASE WHEN status = \'VALID\' THEN 1 ELSE 0 END) AS valid_access, SUM(CASE WHEN status = \'INVALID\' THEN 1 ELSE 0 END) AS invalid_access FROM access_logs'
    );
    const [recentLogs] = await connection.query(
      'SELECT id, client_id, driver_name, plat_ble, plat_ocr, status, waktu_masuk, image_path_masuk FROM access_logs ORDER BY waktu_masuk DESC LIMIT 10'
    );

    // Transform image_path_masuk menjadi full URL
    const logsWithFullImageUrl = recentLogs.map(log => ({
      ...log,
      image_path_masuk: log.image_path_masuk ? `http://localhost:4010${log.image_path_masuk}` : null
    }));

    return res.json({
      success: true,
      data: {
        totalClients: Number(clientSummary.total_clients || 0),
        activeClients: Number(clientSummary.active_clients || 0),
        totalAccess: Number(logSummary.total_access || 0),
        validAccess: Number(logSummary.valid_access || 0),
        invalidAccess: Number(logSummary.invalid_access || 0),
        recentLogs: logsWithFullImageUrl
      }
    });
  } catch (error) {
    return next(error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

async function listAccessLogs(req, res, next) {
  let connection;

  try {
    connection = await createMysqlConnection();

    const from = req.query.from;
    const to = req.query.to;
    const conditions = [];
    const values = [];

    if (from) {
      conditions.push('DATE(waktu_masuk) >= ?');
      values.push(from);
    }

    if (to) {
      conditions.push('DATE(waktu_masuk) <= ?');
      values.push(to);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const [rows] = await connection.execute(
      `SELECT id, client_id, driver_id, driver_name, muatan, plat_ble, plat_ocr, status, waktu_masuk, image_path_masuk FROM access_logs ${whereClause} ORDER BY waktu_masuk DESC LIMIT 200`,
      values
    );

    // Transform image_path_masuk menjadi full URL
    const rowsWithFullImageUrl = rows.map(row => ({
      ...row,
      image_path_masuk: row.image_path_masuk ? `http://localhost:4010${row.image_path_masuk}` : null
    }));

    return res.json({ success: true, data: rowsWithFullImageUrl });
  } catch (error) {
    return next(error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

async function exportAccessLogsPdf(req, res, next) {
  let connection;

  try {
    connection = await createMysqlConnection();
    const [rows] = await connection.execute(
      'SELECT client_id, driver_id, driver_name, muatan, plat_ble, plat_ocr, status, waktu_masuk FROM access_logs ORDER BY waktu_masuk DESC LIMIT 500'
    );

    const pdfBuffer = await generateAccessLogsPdf(rows);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="access-logs-report.pdf"');
    return res.send(pdfBuffer);
  } catch (error) {
    return next(error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

async function manualOpenGate(req, res, next) {
  let connection;

  try {
    const { client_id, notes } = req.body;
    connection = await createMysqlConnection();
    const snapshot = await takeSnapshot();

    // Trigger ESP servo to open gate (optional - may fail)
    console.log('\n🚪 [MANUAL GATE OPEN] Attempting to trigger ESP servo...');
    let espResponse = null;
    let espStatus = 'OFFLINE';
    try {
      espResponse = await triggerServoOpen();
      espStatus = espResponse?.success ? 'SUCCESS' : 'FAILED';
      console.log(`✅ ESP response received: ${espStatus}`);
    } catch (espError) {
      console.error('⚠️  ESP servo unavailable (this is OK):', espError.message);
      espStatus = 'UNAVAILABLE';
      // Continue anyway - log the manual open request even if ESP is offline
    }

    // Log the manual open action to database
    console.log('💾 Logging manual gate open to database...');
    await connection.execute(
      'INSERT INTO access_logs (client_id, driver_id, driver_name, muatan, plat_ble, plat_ocr, status, waktu_masuk, image_path_masuk) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?)',
      [client_id || 'MANUAL', null, 'MANUAL_OVERRIDE', notes || 'Manual gate open', null, null, 'MANUAL_OPEN', snapshot.publicPath]
    );
    console.log('✅ Manual open logged to access_logs');

    // Emit real-time event to all connected clients
    if (global.io) {
      global.io.to('dashboard').emit('gate-opened', {
        timestamp: new Date().toISOString(),
        client_id: client_id || 'MANUAL',
        message: 'Portal manual telah dibuka',
        image_path: snapshot.publicPath,
        type: 'MANUAL_OPEN'
      });
      console.log('📡 Emitted gate-opened event to dashboard clients');
    }

    // Return response with ESP status info (non-blocking)
    const response = {
      success: true,
      message: `✅ Manual gate open request processed successfully! ESP status: ${espStatus}`,
      logged: true,
      espStatus: espStatus,
      espDetails: espResponse || null
    };

    console.log(`\n✅ [MANUAL GATE OPEN COMPLETE] ${response.message}`);
    return res.status(200).json(response);
  } catch (error) {
    console.error('\n❌ ERROR in manualOpenGate:', error.message);
    return next(error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

async function getCameraStreamInfo(_req, res) {
  return res.json({
    success: true,
    data: {
      rtspUrl: env.cameraRtspUrl,
      snapshotUrl: `/capture/${env.cameraSnapshotFile}`,
      note: 'Browser tidak memutar RTSP secara native. Halaman frontend menggunakan snapshot berkala sebagai fallback live preview.'
    }
  });
}

async function captureCameraSnapshot(_req, res, next) {
  try {
    console.log('\n🎥 [CAMERA SNAPSHOT] Manual capture request');
    
    // Take ONE snapshot
    console.log('   📸 Capturing snapshot from RTSP...');
    const snapshot = await takeSnapshot();
    console.log('   ✅ Snapshot captured');
    
    // Process OCR on the same snapshot (don't capture again)
    console.log('   🔍 Requesting YOLO detection for bbox...');
    const yoloResult = await processOCRFromFile(snapshot.outputPath, snapshot.fileName);
    
    return res.json({ 
      success: true, 
      data: {
        ...snapshot,
        ocr_plate: yoloResult.detected_plate,
        confidence: yoloResult.confidence,
        bbox: yoloResult.bbox,
        hasDetection: yoloResult.detected_plate ? true : false
      }
    });
  } catch (error) {
    console.error('❌ Camera snapshot error:', error.message);
    return next(error);
  }
}

async function getLiveSnapshot(_req, res, next) {
  try {
    console.log('\n📺 [LIVE SNAPSHOT] Fresh RTSP frame request');
    const { getLiveSnapshotBuffer } = require('../utils/captureCamera');
    
    const imageBuffer = await getLiveSnapshotBuffer();
    console.log('✅ Buffer size:', (imageBuffer.length / 1024).toFixed(2), 'KB');
    
    res.set({
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Expires': '0'
    });
    
    return res.send(imageBuffer);
  } catch (error) {
    console.error('❌ Live snapshot error:', error.message);
    console.error('   Stack:', error.stack);
    return res.status(500).json({ error: error.message });
  }
}

module.exports = {
  verifyEntry,
  getDashboardSummary,
  listAccessLogs,
  exportAccessLogsPdf,
  manualOpenGate,
  getCameraStreamInfo,
  captureCameraSnapshot,
  getLiveSnapshot
};
