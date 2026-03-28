# ESP32 Arduino HTTP Server Fix

## 🔧 Changes Made:

### 1. Arduino HTTP Server Port
- **Old**: WebServer listening on port 4010 (conflict with Node.js backend)
- **New**: WebServer listening on port 80 (standard HTTP)

### 2. Backend ESP Configuration
- **File**: `backend/config/env.js`
- **Old**: `ESP_PORT: 4010`
- **New**: `ESP_PORT: 80`

### 3. Arduino Debugging
- Added detailed logging in `handleServoOpen()` function
- Shows: Method, URI, Client IP, Execution status
- Better diagnostics for troubleshooting

---

## 📝 TODO - Arduino Upload:

1. **Open** `backend/arduino-setup.ino` in Arduino IDE
2. **Verify**: WebServer port is now `80` instead of `4010`
3. **Compile** to check for syntax errors
4. **Upload** to your ESP32 board
5. **Check Serial Monitor** (115200 baud):
   ```
   ✅ WiFi Connected
   🌐 Starting HTTP Server on port 80...
   ✅ HTTP Server started on port 80
   🌐 Access: http://10.233.7.61/servo/open
   ✅ BLE Advertising started!
   ```

---

## 🧪 Test Steps:

### 1. Verify Arduino is Online
Open any terminal and run:
```bash
curl http://10.233.7.61/
```
Should return JSON with server status

### 2. Test Manual Gate Open from Frontend
- Click "Buka Portal Manual" button
- Check Arduino Serial Monitor for:
  ```
  ============================================================
  🌐 [HTTP SERVER] ===== RECEIVED REQUEST =====
  🌐 Method: GET
  🌐 URI: /servo/open
  🌐 Client IP: 10.255.252.61
  ============================================================
  🚪 EXECUTING: openGate()
  ```

### 3. Verify Servo Response
If you see the log above, then:
- ✅ Servo should **move to OPEN** (90°)
- ✅ LED HIJAU turns ON
- ✅ LED MERAH turns OFF
- ✅ LCD shows "Silakan Masuk"
- ✅ Backend receives HTTP 200 response

### 4. Check Backend Logs
Backend should show:
```
✅ [ESP CLIENT] Response status: 200
✅ [ESP CLIENT] Response body: {"success":true,"message":"Gate servo opened successfully",...}
✅ ESP response received: SUCCESS
```

---

## 🐛 Troubleshooting:

### Error: ESP Connection Refused (Cannot reach Arduino)
- **Check**: Arduino WiFi connected to SSID "aiueo"?
- **Check**: Arduino IP is 10.233.7.61?  (Serial monitor shows it)
- **Check**: Network connectivity between backend (10.255.252.61) and Arduino (10.233.7.61)
- **Check**: Firewall port 80 open on Arduino side?

### Error: HTTP server not listening
- Verify Serial Monitor shows "✅ HTTP Server started on port 80"
- If not showing, recompile and reupload Arduino code

### Servo doesn't react even if HTTP 200
- Check LED status (LED_HIJAU pin 13, LED_MERAH pin 12)
- Check Servo pin 14 is properly connected
- Try manual test: Send from browser: `http://10.233.7.61/servo/open`

---

## ✅ Success Indicators:

When working properly:
1. ✅ Browser/curl can access: `http://10.233.7.61/`
2. ✅ Browser/curl can access: `http://10.233.7.61/servo/open` → HTTP 200
3. ✅ Arduino Serial shows request received logs
4. ✅ Servo physically moves
5. ✅ LED lights up
6. ✅ LCD shows status change
7. ✅ Backend receives HTTP 200 response
8. ✅ Frontend shows "Manual open logged" message
