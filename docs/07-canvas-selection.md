# 🎯 Plan 07 — Selection & Transform (Multi-select, Lasso, Resize, Rotate)

> **Ưu tiên**: 🔴 Critical (theo yêu cầu của bạn)  
> **Ước tính**: 1 ngày  
> **Phụ thuộc**: Plan 04, Plan 05

---

## 🎯 Mục tiêu

Implement hệ thống selection đầy đủ:
1. **Single select**: Click để chọn 1 object
2. **Multi-select**: Click+Shift để thêm vào selection, drag lasso để chọn nhiều
3. **Transform**: Resize (8 handles), Rotate (handle phía trên)
4. **Move**: Drag selected objects
5. **Keyboard**: Arrow keys để nudge, Delete để xóa

---

## 🏗️ Selection Architecture

### Konva Transformer
Sử dụng `Konva.Transformer` tích hợp của Konva:
- Tự động render resize handles
- Support rotation handle
- Snap to angle (15° increments khi Shift)
- Hỗ trợ multi-node transform

### Selection State (UIStore)
```typescript
selectedIds: Set<string>  // IDs của objects đang được chọn
```

### Flow hoàn chỉnh
```
Click object
    ↓
onSelect(object.id)
    ↓
UIStore.setSelectedIds([id])
    ↓
Transformer.nodes([konvaNode])
    ↓
Transformer.visible = true
```

---

## 📁 Files cần tạo

### `features/board/components/canvas/SelectionLayer.tsx`
```tsx
// Konva Layer riêng cho selection UI
// Chứa:
//   - Konva Transformer (resize/rotate handles)
//   - Selection rectangle (lasso preview khi drag)
//
// Refs: transformerRef, selectionRectRef
// Sync transformer nodes với selectedIds từ store
```

### `features/board/hooks/useSelection.ts`
```typescript
// Hook quản lý toàn bộ selection logic
//
// Single select:
//   onObjectClick(id, e) {
//     if (e.shiftKey) addToSelection(id)
//     else setSelectedIds([id])
//     emit object:editing { objectId: id, status: STARTED }
//   }
//
// Click on empty area → deselect all
//   onStageClick(e) {
//     if (e.target === stage) clearSelection()
//   }
//
// Lasso select (drag on empty area with SELECT tool)
// Keyboard delete
// Keyboard arrow nudge
```

### `features/board/hooks/useLassoSelect.ts`
```typescript
// Lasso selection behavior:
//
// State: isLassoing, lassoStart, lassoEnd
//
// onMouseDown (empty area, SELECT tool):
//   isLassoing = true
//   lassoStart = pointer world position
//
// onMouseMove:
//   lassoEnd = current pointer world position
//   Render selection rectangle preview
//
// onMouseUp:
//   selectionBounds = normalize(lassoStart, lassoEnd)
//   intersectingObjects = objects.filter(obj =>
//     getBounds(obj).intersects(selectionBounds)
//   )
//   setSelectedIds(intersectingObjects.map(o => o.id))
//   isLassoing = false
//
// Intersection check:
//   Two rects intersect if not (A.right < B.left || B.right < A.left || A.bottom < B.top || B.bottom < A.top)
```

### `features/board/hooks/useTransform.ts`
```typescript
// Transform (resize/rotate) completion handler:
//
// onTransformEnd(e) {
//   const node = e.target;
//   const object = getObjectById(node.id());
//   
//   // Konva scales node, ta cần convert về width/height thực:
//   const newWidth = node.width() * node.scaleX();
//   const newHeight = node.height() * node.scaleY();
//   node.scaleX(1); node.scaleY(1); // Reset scale
//   
//   // Emit object:update
//   emit(ClientEvents.OBJECT_UPDATE, {
//     clientOpId: generateId(),
//     boardId,
//     objectId: object.id,
//     baseVersion: object.version,
//     patch: {
//       x: node.x(),
//       y: node.y(),
//       width: newWidth,
//       height: newHeight,
//       rotation: node.rotation(),
//     }
//   });
// }
```

### `features/board/hooks/useDragMove.ts`
```typescript
// Drag (move) object(s):
//
// onDragStart(objectId):
//   - Record original positions for rollback
//   - emit object:editing { STARTED }
//
// onDragEnd(e, objectId):
//   - Get new position from Konva node
//   - If multi-select: calculate delta, apply to all selected objects
//   - Emit object:update for each moved object
//   - emit object:editing { ENDED }
//
// Snap to grid (optional): round to nearest 10px if Shift held
```

### `features/board/hooks/useKeyboardActions.ts`
```typescript
// Keyboard shortcuts khi canvas focused:
//
// Delete / Backspace:
//   → Emit object:delete cho tất cả selectedIds
//   → clearSelection()
//
// Arrow keys (với SELECT tool):
//   → Nudge objects 1px (normal) hoặc 10px (Shift)
//   → Batch emit object:update
//
// Ctrl+A: select all objects
//
// Ctrl+Z: emit operation:undo
// Ctrl+Y / Ctrl+Shift+Z: emit operation:redo
//
// Ctrl+C: copy selection to clipboard store
// Ctrl+V: paste from clipboard (new objects với offset +10, +10)
//
// Escape: clearSelection() hoặc switch về SELECT tool
```

---

## 🎨 Transform Handles Styling

```typescript
// Konva Transformer config:
const TRANSFORMER_CONFIG = {
  // Handle styling
  anchorSize: 8,
  anchorFill: '#ffffff',
  anchorStroke: '#6366f1',
  anchorStrokeWidth: 2,
  anchorCornerRadius: 2,

  // Border styling
  borderStroke: '#6366f1',
  borderStrokeWidth: 1.5,
  borderDash: [4, 4],

  // Rotation handle
  rotateEnabled: true,
  rotationSnaps: [0, 45, 90, 135, 180, 225, 270, 315],
  rotationSnapTolerance: 5,

  // Resize constraints
  keepRatio: false,  // true khi Shift held
  enabledAnchors: [
    'top-left', 'top-center', 'top-right',
    'middle-right', 'middle-left',
    'bottom-left', 'bottom-center', 'bottom-right'
  ],

  // Min size
  boundBoxFunc: (oldBox, newBox) => {
    if (newBox.width < 10 || newBox.height < 10) return oldBox;
    return newBox;
  },
};
```

---

## 🎯 Multi-Object Transform

Khi nhiều objects được chọn:
```
Transformer bao toàn bộ selection (bounding box của tất cả nodes)
Move: di chuyển tất cả cùng delta
Resize: scale tất cả cùng tỷ lệ (từ bounding box center)
Rotate: xoay tất cả quanh center
```

**Implementation**:
```typescript
// Konva Transformer.nodes([node1, node2, ...])
// Konva tự handle multi-node transform
// onTransformEnd → loop qua tất cả nodes và emit updates
```

---

## 📦 Selection Count Badge

Khi nhiều objects được chọn:
```
[3 objects selected]  ← Toast/badge nhỏ ở bottom center
Delete all            
```

---

## ✅ Acceptance Criteria

- [ ] Click object → select, Transformer xuất hiện
- [ ] Click empty area → deselect all
- [ ] Shift+Click → add/remove từ selection
- [ ] Drag lasso trên empty area → chọn tất cả objects trong vùng
- [ ] Drag selected object → object di chuyển, emit object:update
- [ ] Drag resize handle → object resize, emit object:update
- [ ] Drag rotation handle → object rotate, emit object:update
- [ ] Multi-select: drag moves tất cả objects cùng delta
- [ ] Delete key → xóa tất cả selected objects
- [ ] Arrow keys → nudge 1px (Shift: 10px)
- [ ] Ctrl+A → chọn tất cả objects
- [ ] Ctrl+Z → undo, Ctrl+Y → redo
- [ ] Ctrl+C/V → copy/paste objects với offset
