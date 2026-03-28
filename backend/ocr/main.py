from fastapi import FastAPI, UploadFile, File
from ultralytics import YOLO
import cv2
import numpy as np
import uvicorn
import easyocr
import re
from collections import Counter
from datetime import datetime
import json

app = FastAPI()

model_path = r"D:\SKRIPSI\Website_Smart_Portal\backend\ocr\model\yolov8s_plate_detection_fixx.pt"

print("\n" + "="*80)
print(f"⚙️  [OCR SERVICE STARTUP] {datetime.now().isoformat()}")
print("="*80)
print("Loading models...")
try:
    model = YOLO(model_path)
    reader = easyocr.Reader(['en'], gpu=False)
    print("✅ Models loaded successfully")
    print("="*80 + "\n")
except Exception as e:
    print(f"❌ Error loading model: {e}")
    print("="*80 + "\n")
    model = None
    reader = None


def deskew_plate(img):
    try:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        edges = cv2.Canny(gray, 50, 150)
        lines = cv2.HoughLinesP(
            edges,
            1,
            np.pi / 180,
            threshold=80,
            minLineLength=img.shape[1] // 2,
            maxLineGap=20,
        )

        if lines is None:
            return img

        angles = []
        for line in lines:
            x1, y1, x2, y2 = line[0]
            angles.append(np.degrees(np.arctan2(y2 - y1, x2 - x1)))

        if not angles:
            return img

        median_angle = np.median(angles)
        if abs(median_angle) > 45:
            return img

        h, w = img.shape[:2]
        matrix = cv2.getRotationMatrix2D((w // 2, h // 2), median_angle, 1)
        return cv2.warpAffine(
            img,
            matrix,
            (w, h),
            flags=cv2.INTER_CUBIC,
            borderMode=cv2.BORDER_REPLICATE,
        )
    except Exception:
        return img


def preprocess_variants(img):
    variants = []
    try:
        img_big = cv2.resize(img, None, fx=3, fy=3, interpolation=cv2.INTER_LANCZOS4)
        gray = cv2.cvtColor(img_big, cv2.COLOR_BGR2GRAY)
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        contrast = clahe.apply(gray)
        denoised = cv2.bilateralFilter(contrast, 9, 75, 75)
        threshold = cv2.adaptiveThreshold(
            denoised,
            255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY,
            11,
            2,
        )
        variants.extend([gray, contrast, denoised, threshold])
    except Exception:
        variants.append(img)

    return variants


def clean_and_format(ocr_detail):
    if not ocr_detail:
        return None

    ocr_detail = sorted(ocr_detail, key=lambda x: x[0][0][0])
    text = "".join([item[1] for item in ocr_detail]).upper()
    return re.sub(r'[^A-Z0-9]', '', text)


def normalize_plate(text):
    match = re.search(r'([A-Z]{1,2})(\d{1,4}|[OISB]{1,4})([A-Z]{0,3})', text)
    if match:
        area_huruf = match.group(1)
        area_angka = match.group(2)
        area_belakang = match.group(3)
        area_angka = area_angka.replace('O', '0').replace('I', '1').replace('S', '5').replace('B', '8')
        return f"{area_huruf} {area_angka} {area_belakang}".strip()
    return text


@app.post('/detect-plate')
async def detect_plate(file: UploadFile = File(...)):
    request_time = datetime.now()
    execution_log = {
        'timestamp': request_time.isoformat(),
        'file': file.filename,
        'steps': []
    }

    print("\n" + "="*80)
    print(f"📡 [OCR REQUEST] {request_time.isoformat()}")
    print("="*80)
    print(f"File: {file.filename}")
    print(f"Content-Type: {file.content_type}")

    if model is None or reader is None:
        print("❌ Models not loaded")
        print("="*80 + "\n")
        return {"success": False, "detected_plate": "ERROR", "message": "Model not loaded"}

    try:
        # Step 1: Load image
        print("\n🔄 [STEP 1] Loading image from upload...")
        import time as time_module
        step_start = time_module.time()
        
        contents = await file.read()
        file_size_kb = len(contents) / 1024
        print(f"  ✅ Image loaded: {file_size_kb:.2f} KB")
        
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            print("  ❌ Failed to decode image")
            print("="*80 + "\n")
            return {"success": False, "detected_plate": "ERROR", "message": "Failed to decode image"}
        
        img_height, img_width = img.shape[:2]
        print(f"  ✅ Image dimensions: {img_width}x{img_height}")
        execution_log['steps'].append({
            'step': 'load_image',
            'status': 'PASS',
            'file_size_kb': file_size_kb,
            'dimensions': f'{img_width}x{img_height}'
        })

        # Step 2: YOLO Detection
        print("\n🔍 [STEP 2] Running YOLO plate detection...")
        step_start = time_module.time()
        
        results = model(img, conf=0.25)
        yolo_time = time_module.time() - step_start
        print(f"  ✅ YOLO inference: {yolo_time*1000:.1f}ms")
        print(f"  📊 Detections: {len(results[0].boxes) if len(results) > 0 else 0} box(es)")
        
        execution_log['steps'].append({
            'step': 'yolo_detection',
            'status': 'PASS',
            'duration_ms': yolo_time*1000,
            'detections': len(results[0].boxes) if len(results) > 0 else 0
        })

        final_detected_text = 'TIDAK_TERBACA'
        confidence = 0.0
        x1, y1, x2, y2 = 0, 0, 0, 0  # Initialize bbox coordinates

        # Step 3: Process detected plate
        if len(results) > 0 and len(results[0].boxes) > 0:
            print("\n🎯 [STEP 3] Processing detected plate region...")
            step_start = time_module.time()
            
            box = results[0].boxes[0]
            # Extract and convert bbox coordinates from YOLO tensor
            xyxy_data = box.xyxy[0]
            if hasattr(xyxy_data, 'cpu'):
                xyxy_list = xyxy_data.cpu().numpy().tolist()
            elif hasattr(xyxy_data, 'numpy'):
                xyxy_list = xyxy_data.numpy().tolist()
            elif hasattr(xyxy_data, 'tolist'):
                xyxy_list = xyxy_data.tolist()
            else:
                xyxy_list = list(xyxy_data)
            
            x1, y1, x2, y2 = map(int, xyxy_list)
            
            # Extract confidence
            conf_data = box.conf[0]
            if hasattr(conf_data, 'item'):
                confidence = float(conf_data.item())
            else:
                confidence = float(conf_data)
            
            
            print(f"  📋 Debug - xyxy_list: {xyxy_list}")
            print(f"  📋 Debug - coords: x1={x1}, y1={y1}, x2={x2}, y2={y2}")
            print(f"  📋 Debug - confidence: {confidence}")

            h_img, w_img, _ = img.shape
            pad = int(0.05 * (x2 - x1))
            crop = img[
                max(0, y1 - pad):min(h_img, y2 + pad),
                max(0, x1 - pad):min(w_img, x2 + pad),
            ]

            crop_height, crop_width = crop.shape[:2]
            print(f"  📦 Cropped region: {crop_width}x{crop_height}px")

            # Step 4: Deskew & preprocess
            print("\n📐 [STEP 4] Deskewing and preprocessing variants...")
            step_start = time_module.time()
            
            crop_straight = deskew_plate(crop)
            print(f"  ✅ Deskew complete")
            
            candidates = []
            variant_count = 0

            for variant_idx, processed in enumerate(preprocess_variants(crop_straight)):
                variant_count += 1
                print(f"  🔄 Variant {variant_idx+1}: Running EasyOCR...")
                
                raw_result = reader.readtext(processed)
                cleaned = clean_and_format(raw_result)
                
                print(f"    📝 Raw OCR output: {raw_result}")
                print(f"    🧹 Cleaned: '{cleaned}'")
                
                if cleaned and len(cleaned) > 2:
                    normalized = normalize_plate(cleaned)
                    candidates.append(normalized)
                    print(f"    ✅ Normalized: '{normalized}'")
                else:
                    print(f"    ⚠️  Text too short or invalid")

            preprocess_time = time_module.time() - step_start
            print(f"  ✅ Preprocessing complete ({preprocess_time*1000:.1f}ms)")
            print(f"  📊 Valid candidates: {len(candidates)}/{variant_count}")
            
            execution_log['steps'].append({
                'step': 'deskew_and_preprocess',
                'status': 'PASS',
                'variants': variant_count,
                'valid_candidates': len(candidates),
                'candidates': candidates,
                'duration_ms': preprocess_time*1000
            })

            # Step 5: Vote & select result
            print("\n🗳️  [STEP 5] Voting on candidates...")
            
            if candidates:
                vote_result = Counter(candidates).most_common(1)[0]
                final_detected_text = vote_result[0]
                votes = vote_result[1]
                
                print(f"  🏆 Winner: '{final_detected_text}' ({votes}/{len(candidates)} votes)")
                
                execution_log['steps'].append({
                    'step': 'voting',
                    'status': 'PASS',
                    'winner': final_detected_text,
                    'votes': votes,
                    'total_candidates': len(candidates)
                })
            else:
                final_detected_text = 'TEKS_KABUR'
                print(f"  ⚠️  No valid candidates - defaulting to 'TEKS_KABUR'")
                
                execution_log['steps'].append({
                    'step': 'voting',
                    'status': 'FAIL',
                    'reason': 'no_valid_candidates',
                    'result': final_detected_text
                })
        else:
            print("\n⚠️  [STEP 3] No plate detected by YOLO")
            print(f"  ❌ Setting result to 'TIDAK_TERBACA'")
            x1, y1, x2, y2 = 0, 0, 0, 0
            
            execution_log['steps'].append({
                'step': 'yolo_processing',
                'status': 'FAIL',
                'reason': 'no_detection'
            })

        # Final response dengan bbox
        response = {
            'success': True,
            'detected_plate': final_detected_text,
            'confidence': confidence,
            'bbox': {
                'x1': int(x1),
                'y1': int(y1),
                'x2': int(x2),
                'y2': int(y2),
                'confidence': float(confidence)
            }
        }
        
        print("\n📤 [RESPONSE]")
        print(f"  Result: {final_detected_text}")
        print(f"  Confidence: {confidence:.3f}")
        print(f"  Response: {json.dumps(response, indent=2)}")
        print("="*80 + "\n")

        return response
        
    except Exception as e:
        import traceback
        print(f"\n❌ [ERROR] {str(e)}")
        print(f"  Traceback: {traceback.format_exc()}")
        print("="*80 + "\n")
        
        execution_log['steps'].append({
            'step': 'error',
            'message': str(e),
            'traceback': traceback.format_exc()
        })
        
        return {'success': False, 'detected_plate': 'ERROR', 'message': str(e)}


if __name__ == '__main__':
    uvicorn.run(app, host='0.0.0.0', port=5000)
