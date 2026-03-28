const express = require('express');
const {
  getDashboardSummary,
  listAccessLogs,
  exportAccessLogsPdf,
  manualOpenGate,
  getCameraStreamInfo,
  captureCameraSnapshot,
  getLiveSnapshot
} = require('../controllers/accessController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/dashboard', requireAuth, getDashboardSummary);
router.get('/access-logs', requireAuth, listAccessLogs);
router.get('/access-logs/export/pdf', requireAuth, exportAccessLogsPdf);
router.post('/gate/manual-open', requireAuth, manualOpenGate);
router.get('/camera/stream-info', requireAuth, getCameraStreamInfo);
router.get('/camera/live-snapshot', requireAuth, getLiveSnapshot);
router.post('/camera/capture', requireAuth, captureCameraSnapshot);

module.exports = router;
