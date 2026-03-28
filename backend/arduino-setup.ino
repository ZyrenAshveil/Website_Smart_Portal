#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>
#include <ESP32Servo.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WebServer.h>
#include <ArduinoJson.h>

// ================== KONFIGURASI WIFI & SERVER ==================
const char *ssid = "aiueo";
const char *password = "12345678";
const char *serverUrl = "http://10.200.60.61:4010/verify-entry";  // ✅ UPDATED PORT 4010

// ================== HTTP SERVER (untuk menerima perintah dari backend) ==================
WebServer webServer(4010);  // Listen on port 4010 (sesuai backend configuration)

// ================== LCD ==================
LiquidCrystal_I2C lcd(0x27, 16, 2);

// ================== LED & SERVO ==================
#define LED_HIJAU 13  // Pin LED hijau
#define LED_MERAH 12  // Pin LED merah
#define SERVO_PIN 14  // Pin servo
Servo gateServo;

#define SERVO_OPEN 90              // Sudut buka portal
#define SERVO_CLOSE 0              // Sudut tutup portal
bool gateOpen = false;             // Status gerbang
unsigned long lastGateAction = 0;  // Waktu terakhir aksi gerbang

// ================== BLE VARIABLES ==================
BLEServer *pServer;
BLECharacteristic *pCharacteristic;
bool deviceConnected = false;
bool oldDeviceConnected = false;   
String fullData = "";
String currentClientMAC = "";      // Menyimpan MAC Address Klien

// ================== BLOCKING SYSTEM ==================
#define BLOCK_TIME (3UL * 60UL * 1000UL)  // 3 Menit
String lastClientID = "";                 
String lastPlatNo = "";                   
unsigned long blockUntil = 0;             
bool isBlocked = false;                   

#define SERVICE_UUID "12345678-1234-5678-1234-56789abcdef0"
#define CHARACTERISTIC_UUID "abcdef01-1234-5678-1234-56789abcdef0"

// ================== FUNGSI LED & SERVO ==================
void openGate() {
  if (gateOpen) return;
  Serial.println("🟢 Membuka gerbang...");
  lcd.setCursor(0, 1);
  lcd.print("Gate: Opening   ");
  digitalWrite(LED_MERAH, LOW);
  digitalWrite(LED_HIJAU, HIGH);
  gateServo.write(SERVO_OPEN);
  gateOpen = true;
  lastGateAction = millis();
  lcd.setCursor(0, 1);
  lcd.print("Silakan Masuk   ");
}

void closeGate() {
  if (!gateOpen) return;
  Serial.println("🔴 Menutup gerbang...");
  lcd.setCursor(0, 1);
  lcd.print("Gate: Closing   ");
  digitalWrite(LED_HIJAU, LOW);
  digitalWrite(LED_MERAH, HIGH);
  gateServo.write(SERVO_CLOSE);
  gateOpen = false;
  lcd.setCursor(0, 1);
  lcd.print("Gate: Closed    ");
}

void setStandbyMode() {
  digitalWrite(LED_HIJAU, LOW);
  digitalWrite(LED_MERAH, LOW);
}

void setAccessDenied() {
  digitalWrite(LED_HIJAU, LOW);
  digitalWrite(LED_MERAH, HIGH);
}

void setBlockedMode() {
  digitalWrite(LED_HIJAU, LOW);
  digitalWrite(LED_MERAH, HIGH);
}

// ================== FUNGSI HTTP KE NODE.JS ==================
void verifyEntry(String driverID, String platNo, String driverName, String muatan) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("❌ WiFi Disconnected!");
    lcd.setCursor(0, 1);
    lcd.print("Err: No WiFi    ");
    setAccessDenied();
    delay(3000);
    setStandbyMode();
    return;
  }

  HTTPClient http;
  http.setTimeout(20000);  // 20 detik timeout
  http.begin(serverUrl);
  http.addHeader("Content-Type", "application/json");

  // ✅ JSON PAYLOAD DENGAN MAC ADDRESS
  String jsonPayload = "{";
  jsonPayload += "\"client_id\":\"" + driverID + "\",";
  jsonPayload += "\"mac_address\":\"" + currentClientMAC + "\","; 
  jsonPayload += "\"driver_id\":\"" + driverID + "\",";
  jsonPayload += "\"ble_plat\":\"" + platNo + "\",";
  jsonPayload += "\"driver_name\":\"" + driverName + "\",";
  jsonPayload += "\"muatan\":\"" + muatan + "\"";
  jsonPayload += "}";

  Serial.println("📡 Mengirim data ke Server...");
  Serial.println("URL: " + String(serverUrl));
  Serial.println("JSON: " + jsonPayload);

  lcd.setCursor(0, 1);
  lcd.print("Verifying...    ");
  setStandbyMode();

  int httpResponseCode = http.POST(jsonPayload);
  Serial.printf("HTTP Response Code: %d\n", httpResponseCode);

  if (httpResponseCode == 200) {
    String response = http.getString();
    Serial.println("📩 Raw Response: " + response);

    // ✅ PARSE JSON RESPONSE (format baru dari backend)
    StaticJsonDocument<256> doc;
    DeserializationError error = deserializeJson(doc, response);

    if (!error) {
      String decision = doc["decision"];
      String ocrPlate = doc["ocr_plate"];

      Serial.println("Decision: " + decision);
      Serial.println("OCR Plate: " + ocrPlate);

      if (decision == "OPEN_GATE") {
        lcd.setCursor(0, 0);
        lcd.print("AKSES DITERIMA  ");
        lcd.setCursor(0, 1);
        lcd.print("OCR: " + ocrPlate);
        openGate();
      } 
      else if (decision == "DENIED_PLATE_MISMATCH") {
        lcd.setCursor(0, 0);
        lcd.print("AKSES DITOLAK   ");
        lcd.setCursor(0, 1);
        lcd.print("BLE vs OCR: " + ocrPlate.substring(0, 9));
        setAccessDenied();
        delay(4000);
        lcd.clear();
        setStandbyMode();
      }
      else {
        lcd.setCursor(0, 0);
        lcd.print("AKSES DITOLAK   ");
        lcd.setCursor(0, 1);
        lcd.print(decision.substring(0, 16));
        setAccessDenied();
        delay(4000);
        lcd.clear();
        setStandbyMode();
      }
    } else {
      Serial.println("❌ JSON Parse Error");
      lcd.setCursor(0, 1);
      lcd.print("Err: Bad Response");
      setAccessDenied();
      delay(3000);
      setStandbyMode();
    }
  } 
  else if (httpResponseCode == -1) {
    Serial.println("❌ Connection Error (-1) - Check firewall/server");
    lcd.setCursor(0, 1);
    lcd.print("Err: No Server  ");
    setAccessDenied();
    delay(3000);
    setStandbyMode();
  }
  else {
    Serial.printf("❌ HTTP Error: %d\n", httpResponseCode);
    lcd.setCursor(0, 1);
    lcd.print("Err: HTTP " + String(httpResponseCode));
    setAccessDenied();
    delay(3000);
    setStandbyMode();
  }

  http.end();

  // AKTIFKAN BLOCKING 3 MENIT
  blockUntil = millis() + BLOCK_TIME;
  Serial.println("⏱️ Blocking diaktifkan untuk: " + platNo);
}

// ================== EKSTRAK DATA & TAMPILKAN ==================
void extractAndDisplayData(String data) {
  lcd.clear();
  String driverID = "", platNo = "", driverName = "", muatan = "", clientID = "";

  int clientStart = data.indexOf("CLIENT_ID:");
  int clientEnd = data.indexOf(";", clientStart);
  if (clientStart >= 0 && clientEnd > clientStart) {
    clientID = data.substring(clientStart + 10, clientEnd);
  }

  int driverStart = data.indexOf("DRIVER_ID:");
  int driverEnd = data.indexOf(";", driverStart);
  if (driverStart >= 0 && driverEnd > driverStart) {
    driverID = data.substring(driverStart + 10, driverEnd);
    lastClientID = driverID;
  }

  int platStart = data.indexOf("PLAT:");
  int platEnd = data.indexOf(";", platStart);
  if (platStart >= 0 && platEnd > platStart) {
    platNo = data.substring(platStart + 5, platEnd);
    lastPlatNo = platNo;
    lcd.setCursor(0, 0);
    lcd.print("ID:" + driverID);
    if (platNo.length() <= 7) {
      lcd.setCursor(9, 0);
      lcd.print(platNo);
    } else {
      lcd.setCursor(9, 0);
      lcd.print(platNo.substring(0, 7));
    }
  }

  int namaStart = data.indexOf("NAMA:");
  int namaEnd = data.indexOf(";", namaStart);
  if (namaStart >= 0 && namaEnd > namaStart) {
    driverName = data.substring(namaStart + 5, namaEnd);
    lcd.setCursor(0, 1);
    if (driverName.length() > 16) {
      lcd.print(driverName.substring(0, 16));
    } else {
      lcd.print(driverName);
    }
  }

  int muatanStart = data.indexOf("MUATAN:");
  int muatanEnd = data.indexOf(";", muatanStart);
  if (muatanStart >= 0 && muatanEnd > muatanStart) {
    muatan = data.substring(muatanStart + 7, muatanEnd);
    delay(3000);
    lcd.setCursor(0, 1);
    lcd.print("Mu:" + muatan.substring(0, 13) + "    ");
  }

  verifyEntry(driverID, platNo, driverName, muatan);
}

// ================== BLE CALLBACKS ==================
void handleServoOpen() {
  Serial.println("\n============================================================");
  Serial.println("🌐 [HTTP SERVER] ===== RECEIVED REQUEST =====");
  Serial.print("🌐 Method: ");
  Serial.println(webServer.method() == HTTP_GET ? "GET" : "POST");
  Serial.print("🌐 URI: ");
  Serial.println(webServer.uri());
  Serial.print("🌐 Client IP: ");
  Serial.println(webServer.client().remoteIP());
  Serial.println("============================================================");
  
  // Buka gerbang
  Serial.println("🚪 EXECUTING: openGate()");
  openGate();
  
  // Response ke backend
  String jsonResponse = "{";
  jsonResponse += "\"success\":true,";
  jsonResponse += "\"message\":\"Gate servo opened successfully\",";
  jsonResponse += "\"timestamp\":\"" + String(millis()) + "\",";
  jsonResponse += "\"gateStatus\":\"OPEN\"";
  jsonResponse += "}";
  
  webServer.sendHeader("Content-Type", "application/json");
  webServer.send(200, "application/json", jsonResponse);
  
  Serial.println("📤 HTTP Response: " + jsonResponse);
  Serial.println("============================================================\n");
}

void handleRoot() {
  Serial.println("🌐 [HTTP SERVER] Health check received");
  String html = "{";
  html += "\"status\":\"online\",";
  html += "\"message\":\"ESP32 Smart Gate Server Running\",";
  html += "\"port\":80,";
  html += "\"localIP\":\"" + WiFi.localIP().toString() + "\",";
  html += "\"endpoints\":{";
  html += "\"servo_open\":\"GET /servo/open\",";
  html += "\"health\":\"GET /\"";
  html += "}";
  html += "}";
  webServer.send(200, "application/json", html);
}

class MyCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pCharacteristic) override {
    if (isBlocked) return;
    auto raw = pCharacteristic->getValue();
    String received = String(raw.c_str());

    if (received.length() > 0) {
      if (received.startsWith("CLIENT_ID:")) {
        int sep = received.indexOf(';');
        if (sep > 0) {
          String tempPlat = received.substring(10, sep);
          if (millis() < blockUntil && tempPlat == lastPlatNo) {
            unsigned long sisa = (blockUntil - millis()) / 1000;
            Serial.printf("⛔ BLOCK! %s tunggu %lu detik.\n", tempPlat.c_str(), sisa);
            lcd.setCursor(0, 0);
            lcd.print("Blocked:        ");
            lcd.setCursor(0, 1);
            lcd.print(tempPlat + "          ");
            setBlockedMode();
            delay(2000);
            pServer->disconnect(0);
            isBlocked = true;
            return;
          }
        }
      }

      fullData += received;
      if (fullData.endsWith("END")) {
        fullData.replace("END", "");
        extractAndDisplayData(fullData);
        fullData = "";
      }
    }
  }
};

class MyServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer *pServer, esp_ble_gatts_cb_param_t *param) override {
    deviceConnected = true;
    fullData = "";
    isBlocked = false;

    // Ekstrak MAC Address Klien
    char macStr[18];
    snprintf(macStr, sizeof(macStr), "%02x:%02x:%02x:%02x:%02x:%02x",
             param->connect.remote_bda[0], param->connect.remote_bda[1],
             param->connect.remote_bda[2], param->connect.remote_bda[3],
             param->connect.remote_bda[4], param->connect.remote_bda[5]);
             
    currentClientMAC = String(macStr);
    currentClientMAC.toUpperCase();

    Serial.println("=====================================");
    Serial.println("📱 Client Connect - MAC: " + currentClientMAC);
    Serial.println("=====================================");
    setStandbyMode();
  };

  void onDisconnect(BLEServer *pServer) override {
    deviceConnected = false;
    currentClientMAC = "";
    Serial.println("📱 Client Disconnect");
  }
};

// ================== SETUP ==================
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n\n=== SMART GATE BOOTING ===");

  pinMode(LED_HIJAU, OUTPUT);
  pinMode(LED_MERAH, OUTPUT);
  setStandbyMode();

  gateServo.attach(SERVO_PIN);
  gateServo.write(SERVO_CLOSE);
  
  Wire.begin(27, 26);
  lcd.init();
  lcd.backlight();

  lcd.setCursor(0, 0);
  lcd.print("Connecting WiFi");

  WiFi.begin(ssid, password);
  int cursor = 0;
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    lcd.setCursor(cursor++, 1);
    lcd.print(".");
    if (cursor > 15) cursor = 0;
  }

  Serial.println("\n✅ WiFi Connected");
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());
  Serial.print("Server: ");
  Serial.println(serverUrl);
  
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("WiFi OK");
  lcd.setCursor(0, 1);
  lcd.print(WiFi.localIP());
  delay(2000);

  // ================== SETUP HTTP SERVER ==================
  Serial.println("🌐 Starting HTTP Server on port 4010...");
  webServer.on("/", HTTP_GET, handleRoot);
  webServer.on("/servo/open", HTTP_GET, handleServoOpen);
  webServer.onNotFound([]() {
    String method = (webServer.method() == HTTP_GET) ? "GET" : "POST";
    String jsonError = "{\"success\":false,\"message\":\"Route " + method + " " + webServer.uri() + " not found\"}";
    webServer.send(404, "application/json", jsonError);
  });
  webServer.begin();
  Serial.println("✅ HTTP Server started on port 4010");
  Serial.print("🌐 Access: http://");
  Serial.print(WiFi.localIP());
  Serial.println(":4010/servo/open");


  BLEDevice::init("ESP32-GATE-SERVER");
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  BLEService *service = pServer->createService(SERVICE_UUID);
  pCharacteristic = service->createCharacteristic(
    CHARACTERISTIC_UUID,
    BLECharacteristic::PROPERTY_WRITE);
  pCharacteristic->setCallbacks(new MyCallbacks());
  service->start();

  BLEAdvertising *advertising = pServer->getAdvertising();
  advertising->addServiceUUID(BLEUUID(SERVICE_UUID));
  advertising->setScanResponse(true);
  advertising->start();

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Smart Gate Ready");
  lcd.setCursor(0, 1);
  lcd.print("Waiting BLE...");
  
  Serial.println("✅ BLE Advertising started!");
}

// ================== LOOP ==================
void loop() {
  // Handle incoming HTTP requests from backend
  webServer.handleClient();

  if (!deviceConnected && oldDeviceConnected) {
    delay(500); 
    pServer->getAdvertising()->start();
    Serial.println("📡 Advertising BLE dimulai kembali!");
    oldDeviceConnected = deviceConnected;
  }
  
  if (deviceConnected && !oldDeviceConnected) {
    oldDeviceConnected = deviceConnected;
  }

  if (gateOpen && (millis() - lastGateAction > 10000)) {
    closeGate();
    lcd.clear();
    delay(2000);
    lcd.setCursor(0, 0);
    lcd.print("Smart Gate Ready");
    lcd.setCursor(0, 1);
    lcd.print("Waiting BLE...");
    setStandbyMode();
  }

  if (!gateOpen && !deviceConnected) {
    static unsigned long lastUpdate = 0;
    if (millis() - lastUpdate > 1000) {
      lastUpdate = millis();

      if (millis() < blockUntil) {
        unsigned long sisa = (blockUntil - millis()) / 1000;
        lcd.setCursor(0, 0);
        lcd.print("Blocked:        ");
        lcd.setCursor(0, 1);
        lcd.print(lastPlatNo + "          ");
        setBlockedMode();
      } else {
        lcd.setCursor(0, 0);
        lcd.print("Smart Gate Ready");
        lcd.setCursor(0, 1);
        lcd.print("Waiting BLE...  ");
        setStandbyMode();
      }
    }
  }

  delay(100);
}
