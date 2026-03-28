const http = require('http');
const env = require('../config/env');

/**
 * Send HTTP request to ESP to open servo gate
 * @returns {Promise<Object>} Response object with success status and message
 */
async function triggerServoOpen() {
  return new Promise((resolve, reject) => {
    const url = `http://${env.esp.host}:${env.esp.port}${env.esp.servoEndpoint}`;
    
    console.log(`🔌 [ESP CLIENT] Sending request to: ${url}`);
    
    const request = http.get(url, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        console.log(`✅ [ESP CLIENT] Response status: ${res.statusCode}`);
        console.log(`✅ [ESP CLIENT] Response body: ${data}`);
        
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({
            success: true,
            message: 'Servo gate opened successfully',
            espResponse: data,
            statusCode: res.statusCode
          });
        } else {
          resolve({
            success: false,
            message: `ESP responded with status ${res.statusCode}`,
            espResponse: data,
            statusCode: res.statusCode
          });
        }
      });
    });

    request.on('error', (error) => {
      console.error(`❌ [ESP CLIENT] Error connecting to ESP:`, error.message);
      reject({
        success: false,
        message: `Failed to connect to ESP: ${error.message}`,
        error: error.message
      });
    });

    request.setTimeout(5000, () => {
      request.destroy();
      reject({
        success: false,
        message: 'ESP request timeout (5s)'
      });
    });
  });
}

module.exports = {
  triggerServoOpen
};
