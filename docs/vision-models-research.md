# 🔬 Local Vision Models via ONNX & Transformers.js - Research Summary

## 📊 **Executive Summary**

**Recommendation**: **Wait for Chrome AI Multimodal** instead of implementing Transformers.js vision models now.

**Reasoning**:

1. **Chrome AI Multimodal is coming** (Gemini Nano with vision support)
2. **Transformers.js has significant overhead** (large model downloads, slower inference)
3. **Current solution is sufficient** (Accessibility tree + screenshots + LLM analysis)

---

## 🎯 **When to Use Transformers.js Vision Models**

### **Recommended Use Cases:**

1. **Offline-First Requirements** - When internet is unavailable
2. **Privacy-Critical Applications** - All processing must stay local
3. **Specialized Tasks** - Tasks Chrome AI doesn't handle:
   - Object counting
   - Specific object detection
   - Custom-trained models
4. **Fallback Layer** - When Chrome AI is unavailable

### **NOT Recommended For:**

- ❌ General visual reasoning (use Chrome AI)
- ❌ Element detection (we have robust selectors)
- ❌ OCR (Chrome may add native support)

---

## 🤖 **Available Vision Models (Transformers.js)**

### **1. Object Detection**

- **DETR (DEtection TRansformer)**
  - Model: `facebook/detr-resnet-50`
  - Size: ~160MB quantized
  - Use: General object detection
- **YOLOS (You Only Look Once with Segment)**

  - Model: `hustvl/yolos-tiny`
  - Size: ~24MB quantized
  - Use: Fast, lightweight detection

- **RT-DETR**
  - Model: `PekingU/rtdetr_r50vd_6x_coco`
  - Size: ~170MB
  - Use: Real-time detection

### **2. Image Segmentation**

- **SAM (Segment Anything Model)**

  - Model: `Xenova/sam-vit-base`
  - Size: ~360MB
  - Use: Interactive segmentation, masking

- **SegFormer**
  - Model: `nvidia/segformer-b0-finetuned-ade-512-512`
  - Size: ~13MB quantized
  - Use: Semantic segmentation

### **3. Image Classification**

- **ViT (Vision Transformer)**

  - Model: `google/vit-base-patch16-224`
  - Size: ~330MB
  - Use: General image classification

- **EfficientNet**

  - Model: `google/efficientnet-b0`
  - Size: ~18MB quantized
  - Use: Lightweight classification

- **DINOv2**
  - Model: `facebook/dinov2-small`
  - Size: ~85MB
  - Use: Self-supervised features, zero-shot

### **4. Depth Estimation**

- **Depth Anything**
  - Model: `depth-anything/Depth-Anything-V2-Small`
  - Size: ~95MB
  - Use: Monocular depth estimation

---

## 💻 **Implementation Example**

```typescript
import { pipeline } from "@huggingface/transformers";

// Object Detection
const detector = await pipeline("object-detection", "Xenova/detr-resnet-50", {
  device: "webgpu", // Hardware acceleration
  dtype: "q8", // 8-bit quantization
});

const screenshot = await captureScreenshot();
const results = await detector(screenshot);

// Results:
// [
//   { box: { x: 10, y: 20, width: 100, height: 50 }, label: 'button', score: 0.95 },
//   { box: { x: 200, y: 30, width: 80, height: 40 }, label: 'input', score: 0.92 }
// ]

// Image Segmentation
const segmenter = await pipeline("image-segmentation", "Xenova/sam-vit-base", {
  device: "webgpu",
  dtype: "fp16",
});

const masks = await segmenter(screenshot, {
  prompt_points: [[100, 200]], // Click point
});
```

---

## ⚖️ **Comparison: Chrome AI vs Transformers.js**

| Feature             | Chrome AI (Gemini Nano)   | Transformers.js ONNX          |
| ------------------- | ------------------------- | ----------------------------- |
| **Setup**           | ✅ Built-in (no download) | ❌ Large downloads (10-500MB) |
| **Speed**           | ✅ Fast (GPU-accelerated) | ⚠️ Slower (WASM/WebGPU)       |
| **Privacy**         | ✅ 100% local             | ✅ 100% local                 |
| **Multimodal**      | ⏳ Coming soon            | ✅ Available now              |
| **Customization**   | ❌ Fixed model            | ✅ Any HuggingFace model      |
| **Bundle Size**     | ✅ Zero                   | ❌ +2MB library + models      |
| **Browser Support** | ⚠️ Chrome 129+            | ✅ All modern browsers        |

---

## 🏗️ **Recommended Architecture (Future)**

```
┌─────────────────────────────────────┐
│  Nano Assistant Browser Extension  │
└──────────────┬──────────────────────┘
               │
               ├─ Primary: Chrome AI (Gemini Nano Multimodal)
               │  └─> General visual reasoning
               │  └─> Element description → selector
               │  └─> Screenshot analysis
               │
               ├─ Secondary: Accessibility Tree
               │  └─> Structural understanding
               │  └─> Interactive element mapping
               │
               └─ Fallback: Transformers.js (Optional)
                  └─> Object Detection (YOLOS)
                  └─> Segmentation (SAM)
                  └─> When Chrome AI unavailable
```

---

## 🎯 **Phase 5 Recommendation**

Instead of adding Transformers.js now, let's implement **Proactive Behavior**:

1. **Context-Aware Suggestions**
   - Analyze page content to suggest actions
   - "I noticed you're on Amazon, would you like me to track prices?"
2. **Learning from User Patterns**
   - Track common workflows
   - Suggest automations
3. **Smart Notifications**

   - "This form looks incomplete"
   - "I can help fill this based on previous data"

4. **Auto-Trigger Rules**
   - "Run this search every Monday at 9 AM"
   - "Alert me when price drops below $50"

---

## 📚 **Transformers.js Integration Guide (Future Reference)**

### **1. Installation**

```bash
npm install @huggingface/transformers
```

### **2. Webpack Configuration**

```javascript
// webpack.config.js
module.exports = {
  resolve: {
    extensions: [".ts", ".js"],
    fallback: {
      fs: false,
      path: false,
    },
  },
};
```

### **3. Content-specific Usage**

**For Visual Element Detection:**

```typescript
// Best: YOLOS (fast, small)
const detector = await pipeline("object-detection", "Xenova/yolos-tiny", {
  device: "webgpu",
  dtype: "q8",
});
```

**For Click Target Identification:**

```typescript
// Use SAM for interactive segmentation
const segmenter = await pipeline("image-segmentation", "Xenova/sam-vit-base");
const masks = await segmenter(screenshot, {
  prompt_points: clickCoordinates,
});
```

---

## 🚀 **Future Chrome AI Features to Watch**

1. **Gemini Nano Multimodal** (2025 Q1-Q2)

   - Native vision understanding
   - Screenshot → description
   - Image → structured data

2. **Chrome OCR API** (Experimental)

   - `chrome.ocr.recognize(imageData)`
   - Native text extraction

3. **Accessibility Insights API**
   - Enhanced accessibility tree
   - Visual relationship data

---

## ✅ **Conclusion**

**Current Strategy**: ✅ Use what we have

- ✅ Robust DOM selectors (6-level fallback)
- ✅ Accessibility tree for structure
- ✅ Screenshots for visual context
- ✅ Chrome AI for reasoning

**Future Strategy**: 🔮 Monitor Chrome AI Multimodal

- When available: Primary vision solution
- Transformers.js: Specialized/fallback only

**Avoid**: ❌ Over-engineering

- Don't add 200MB+ of models we may not need
- Wait for native browser capabilities
