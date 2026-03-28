#!/bin/bash
# Test ESP32 Arduino HTTP Server Connectivity

ARDUINO_IP="10.233.7.61"
ARDUINO_PORT=80

echo "========================================="
echo "🔍 Testing ESP32 Arduino Server"
echo "========================================="
echo ""
echo "🌐 Arduino IP: $ARDUINO_IP:$ARDUINO_PORT"
echo ""

# Test 1: Health Check
echo "📡 [TEST 1] Health Check - GET /"
curl -v "http://$ARDUINO_IP:$ARDUINO_PORT/" 2>&1 | head -20
echo ""
echo ""

# Test 2: Servo Open
echo "📡 [TEST 2] Servo Open - GET /servo/open"
curl -v "http://$ARDUINO_IP:$ARDUINO_PORT/servo/open" 2>&1 | head -20
echo ""
echo ""

echo "========================================="
echo "✅ Tests Complete!"
echo "========================================="
