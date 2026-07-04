# 🖼️ Plan 04 — Canvas Core: Stage, Pan, Zoom, Viewport

> **Ưu tiên**: 🔴 Critical  
> **Ước tính**: 1 ngày  
> **Phụ thuộc**: Plan 01, Plan 08 (Realtime Sync)

---

## 🎯 Mục tiêu

Xây dựng canvas engine cốt lõi:
1. **Konva Stage** full-screen, đáp ứng resize window
2. **Infinite canvas** với pan (HAND tool hoặc Space drag)
3. **Smooth zoom** với scroll wheel, trackpad pinch
4. **Viewport management** — tọa độ world ↔ screen
5. **Checkerboard/dot grid background** (giống Excalidraw)
6. **Canvas-wide event routing** (click, drag, mouse move)

---

## 🏗️ Kiến trúc Canvas

### Layer Structure (Konva Layers)

```
Stage (full screen)
├── Layer: Background      ← Grid dots/lines (static, cached)
├── Layer: Objects         ← Tất cả BoardObjects (re-render khi data thay đổi)
├── Layer: Selection       ← Selection boxes, resize handles, transform
└── Layer: UI              ← Drawing preview, snap guides
```

**Lý do tách layers**:
- Background layer: cache, không re-render khi objects thay đổi
- Objects layer: re-render khi dữ liệu thay đổi
- Selection layer: re-render nhanh khi user kéo thả
- UI layer: chỉ hiển thị khi đang draw/transform

### Cursor Overlay (HTML, không phải Konva)
Remote cursors render bằng **absolute-positioned HTML** (không dùng Konva) vì:
- Performance tốt hơn (không trigger Konva re-render)
- Dễ render username label
- CSS transforms cho smooth animation

---

## 📁 Files cần tạo

### `features/board/components/canvas/CanvasStage.tsx`
```tsx
// Component chính — mount Konva Stage
// Props: boardId
// Responsibilities:
//   - useEffect → resize observer cho Stage width/height
//   - Wheel event → zoom logic
//   - Mouse/touch events → route to active tool handler
//   - Spacebar + drag → pan (override active tool)
//   - Connect socket events (Plan 08)
//   - Load initial board state via API
```

### `features/board/components/canvas/useCanvasEvents.ts`
```typescript
// Hook xử lý tất cả Konva Stage events:
// onMouseDown, onMouseMove, onMouseUp
// onWheel (zoom)
// onDblClick (create text object)
// Dựa vào activeTool từ UIStore để quyết định behavior
```

### `features/board/components/canvas/useViewport.ts`
```typescript
// Viewport state và helpers:
// stageRef: RefObject<Konva.Stage>
// 
// panTo(x, y): void
// zoomTo(scale, centerX, centerY): void
// zoomIn(): void  // scale * 1.1
// zoomOut(): void // scale / 1.1
// resetZoom(): void // scale = 1, center
// fitToObjects(): void // zoom/pan để fit tất cả objects
//
// worldToScreen(x, y): {x, y}  // canvas coords → screen coords
// screenToWorld(x, y): {x, y}  // screen coords → canvas coords
//
// Limits: minScale = 0.05, maxScale = 8.0
```

### `features/board/components/canvas/CanvasBackground.tsx`
```tsx
// Konva Layer cho background
// Render dot grid (giống Excalidraw)
// Dots: radius=1, color=#e5e7eb (light) / #374151 (dark)
// Grid spacing: 20px ở scale=1
// Chỉ render dots visible trong viewport (tối ưu performance)
// Cache layer sau khi render
```

**Dot grid formula**:
```
startX = Math.floor(-stageX / scale / gridSize) * gridSize
startY = Math.floor(-stageY / scale / gridSize) * gridSize
endX = startX + viewportWidth / scale + gridSize
endY = startY + viewportHeight / scale + gridSize
```

### `features/board/components/canvas/useZoom.ts`
```typescript
// Zoom logic:
// onWheel event:
//   - Nếu Ctrl/Cmd pressed: zoom (preventDefault)
//   - Nếu không: pan
//
// Zoom formula (zoom vào vị trí con trỏ):
//   mousePos = pointer position relative to stage
//   newScale = oldScale * (event.deltaY > 0 ? 0.9 : 1.1)  
//   newPos = {
//     x: mousePos.x - (mousePos.x - stagePos.x) * (newScale / oldScale),
//     y: mousePos.y - (mousePos.y - stagePos.y) * (newScale / oldScale)
//   }
```

### `features/board/components/canvas/usePan.ts`
```typescript
// Pan logic:
// HAND tool: drag stage
// Spacebar + drag: pan in any tool
// Two-finger trackpad drag: pan (không zoom)
//
// State: isPanning, lastPointerPos
// onMouseDown → isPanning = true
// onMouseMove → di chuyển stage position
// onMouseUp → isPanning = false
```

### `features/board/components/BoardCanvas.tsx`
```tsx
// Main board canvas page component
// Layout:
//   - Toolbar (left sidebar)
//   - CanvasStage (full screen, absolute)
//   - PresenceBar (top right)
//   - ZoomControls (bottom right)
//   - BoardHeader (top: board name, members, settings)
//   - CursorOverlay (absolute, full screen, pointer-events: none)
```

### `features/board/components/canvas/ZoomControls.tsx`
```tsx
// Bottom-right controls:
// [−] [75%] [+] [⊞ Fit]
// Click % → reset to 100%
// Fit button → fit all objects in view
```

---

## 🌐 Coordinate System

```
World Coordinates (canvas space):
  - Origin (0,0) ở center của infinite canvas
  - Object positions lưu trong DB ở world coordinates

Screen Coordinates (pixel space):
  - Origin (0,0) ở top-left của browser window

Conversion:
  screenX = worldX * scale + stageX
  screenY = worldY * scale + stageY
  
  worldX = (screenX - stageX) / scale
  worldY = (screenY - stageY) / scale
```

---

## ⚡ Performance Considerations

### Rendering Optimization
- **shouldCacheShapes**: Shapes không được select → cache `shape.cache()`
- **Batch updates**: Nhiều object updates trong 1 frame → batch với `batchDraw()`
- **Virtualization**: Chỉ render objects trong viewport (với bounding box check)
- **RAF throttle**: Mouse move events throttle bằng `requestAnimationFrame`

### Background Grid
- Render chỉ visible portion
- Cache layer khi không pan/zoom
- Debounce re-render grid khi đang pan

---

## 🎨 Canvas Visual Spec

### Light Mode
- Background: `#fafafa`
- Grid dots: `#d1d5db` (gray-300)
- Selection: `#6366f1` (violet-500)

### Dark Mode  
- Background: `#111827`
- Grid dots: `#374151` (gray-700)
- Selection: `#818cf8` (indigo-400)

### Zoom Indicator
```
Khi zoom: hiện briefly ở center bottom
"75%"  — fade out sau 1.5 giây
```

---

## ✅ Acceptance Criteria

- [ ] Stage resize khi browser window resize (không có scrollbar)
- [ ] Scroll wheel zoom vào vị trí con trỏ (giống Figma/Excalidraw)
- [ ] Ctrl+Scroll zoom, plain scroll = pan (nếu không có tool HAND)
- [ ] Space + drag → pan bất kể đang dùng tool gì
- [ ] HAND tool → drag stage để pan
- [ ] Dot grid render đúng ở mọi zoom level
- [ ] Zoom không vượt quá 0.05x – 8.0x
- [ ] Zoom controls hoạt động ([−], [+], [Fit], reset 100%)
- [ ] Stage responsive với window resize
