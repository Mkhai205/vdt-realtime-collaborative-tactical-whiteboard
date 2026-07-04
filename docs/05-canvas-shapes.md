# 🔷 Plan 05 — Canvas Shapes: 6 Object Type Renderers

> **Ưu tiên**: 🔴 Critical  
> **Ước tính**: 1 ngày  
> **Phụ thuộc**: Plan 04 (Canvas Core)

---

## 🎯 Mục tiêu

Implement 6 loại shape renderers tương ứng với 6 `ObjectType` trong backend:
1. **RECTANGLE** — Hình chữ nhật, bo góc tùy chỉnh
2. **CIRCLE** — Hình ellipse/tròn
3. **LINE** — Đường thẳng có mũi tên (connector)
4. **TEXT** — Text block với inline editing
5. **PATH** — Freehand drawing path
6. **ICON** — Icon từ thư viện (lucide)

---

## 📊 Data Model Reference

```typescript
// BoardObjectDto từ shared-contracts:
interface BoardObjectDto {
  id: string;
  boardId: string;
  type: ObjectType;  // RECTANGLE | CIRCLE | LINE | TEXT | PATH | ICON
  x: number;
  y: number;
  width?: number;
  height?: number;
  points?: number[];  // LINE: [x1,y1,x2,y2] | PATH: SVG points
  text?: string;
  rotation: number;
  style: ShapeStyle;
  zIndex: number;
  version: number;
}

interface ShapeStyle {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  color?: string;
  arrowStart?: boolean;
  arrowEnd?: boolean;
  iconKey?: string;
  assetUrl?: string;
  scale?: number;
  label?: string;
}
```

---

## 📁 Files cần tạo

### `features/board/components/canvas/objects/ObjectRenderer.tsx`
```tsx
// Dispatcher component: nhận BoardObjectDto → render đúng component
// Props: object, isSelected, isEdited (locked by someone else)
// Switch trên object.type:
//   RECTANGLE → <RectangleObject />
//   CIRCLE → <CircleObject />
//   LINE → <LineObject />
//   TEXT → <TextObject />
//   PATH → <PathObject />
//   ICON → <IconObject />
```

### `features/board/components/canvas/objects/RectangleObject.tsx`
```tsx
// Konva Rect
// Props: object, isSelected, onSelect, onDragEnd, onTransformEnd
//
// Styling từ style:
//   fill: style.fill ?? '#ffffff'
//   stroke: style.stroke ?? '#6366f1'
//   strokeWidth: style.strokeWidth ?? 2
//   opacity: style.opacity ?? 1
//   cornerRadius: 4 (default, có thể config sau)
//
// Nếu isSelected:
//   - Render Konva Transformer (xem Plan 07)
//
// Nếu isEdited (khóa bởi người khác):
//   - Overlay màu với opacity 0.2
//   - Border dashed
```

### `features/board/components/canvas/objects/CircleObject.tsx`
```tsx
// Konva Ellipse
// width/height để support ellipse (không chỉ circle)
// radiusX = width / 2, radiusY = height / 2
// Styling tương tự Rectangle
```

### `features/board/components/canvas/objects/LineObject.tsx`
```tsx
// Konva Arrow (để support mũi tên)
// points: [x1, y1, x2, y2] từ object.points
//
// style.arrowStart: pointerAtBeginning = true
// style.arrowEnd: pointerAtEnd = true  
// Mặc định: arrowEnd = true
//
// pointerLength: 12
// pointerWidth: 8
//
// Line selection: click vào line (tolerance 8px)
// Drag endpoints riêng biệt (custom implementation)
```

### `features/board/components/canvas/objects/TextObject.tsx`
```tsx
// Konva Text cho display
// onDblClick → switch sang inline editing mode
//
// Inline editing:
//   1. Tạo HTML <textarea> absolute positioned tại world coords
//   2. Transform screen coords cho textarea position
//   3. Match font size, font family, padding
//   4. onBlur / Escape → lưu text, emit object:update
//   5. Textarea auto-resize theo nội dung
//
// Styling:
//   fontSize: style.fontSize ?? 16
//   fontFamily: style.fontFamily ?? 'Inter'
//   fontWeight: style.fontWeight ?? 'normal'
//   fill: style.color ?? '#1f2937'
//   align: 'left'
//   wrap: 'word'
```

**Quan trọng**: Textarea editing cần transform đúng viewport scale:
```typescript
const textPos = stage.getAbsolutePosition();
const textareaX = object.x * scale + textPos.x;
const textareaY = object.y * scale + textPos.y;
textarea.style.fontSize = `${object.style.fontSize * scale}px`;
```

### `features/board/components/canvas/objects/PathObject.tsx`
```tsx
// Konva Line với tension=0 (sharp) hoặc tension=0.3 (smooth)
// points: flattened array [x1, y1, x2, y2, ...]
// lineCap: 'round'
// lineJoin: 'round'
// closed: false
//
// Fill support: nếu style.fill và closed = true
```

### `features/board/components/canvas/objects/IconObject.tsx`
```tsx
// Render SVG icon từ lucide-react
// style.iconKey → import dynamic lucide icon
// Render bằng Konva Image (convert SVG → Image)
//
// Approach:
// 1. Get SVG string từ lucide icon
// 2. Create Blob URL
// 3. Load vào Konva Image
// 4. Cache sau khi load
//
// Fallback: Konva Rect với "?" text nếu icon không tìm thấy
```

### `features/board/components/canvas/ObjectsLayer.tsx`
```tsx
// Konva Layer chứa tất cả objects
// Nhận objects array từ board store
// Sắp xếp theo zIndex (ascending)
// Render ObjectRenderer cho mỗi object
// Listening prop: true
```

---

## 🎨 Style System

### Default Styles per ObjectType

```typescript
const DEFAULT_STYLES: Record<ObjectType, ShapeStyle> = {
  RECTANGLE: {
    fill: '#ffffff',
    stroke: '#6366f1',
    strokeWidth: 2,
    opacity: 1,
  },
  CIRCLE: {
    fill: '#ffffff',
    stroke: '#6366f1',
    strokeWidth: 2,
    opacity: 1,
  },
  LINE: {
    fill: 'transparent',
    stroke: '#374151',
    strokeWidth: 2,
    arrowEnd: true,
    opacity: 1,
  },
  TEXT: {
    fill: 'transparent',
    stroke: 'transparent',
    strokeWidth: 0,
    color: '#1f2937',
    fontSize: 16,
    fontFamily: 'Inter, sans-serif',
    fontWeight: 'normal',
    opacity: 1,
  },
  PATH: {
    fill: 'transparent',
    stroke: '#374151',
    strokeWidth: 3,
    opacity: 1,
  },
  ICON: {
    fill: '#6366f1',
    stroke: 'transparent',
    strokeWidth: 0,
    opacity: 1,
    scale: 1,
  },
};
```

### Editing Indicators
- **isEdited by others** (từ editingStates store):
  - Blue dashed border
  - Small avatar badge ở corner
- **isSelected by me**:
  - Violet solid border + handles

---

## 📐 Object Bounding Box Helpers

```typescript
// Dùng để:
// - Collision detection (lasso select)
// - Viewport culling (không render objects ngoài view)
// - Fit to objects zoom

function getObjectBounds(obj: BoardObjectDto): Rect {
  switch (obj.type) {
    case 'RECTANGLE':
    case 'CIRCLE':
    case 'TEXT':
    case 'ICON':
      return { x: obj.x, y: obj.y, width: obj.width!, height: obj.height! };
    case 'LINE':
    case 'PATH':
      // Từ points array
      return getBoundsFromPoints(obj.points!);
  }
}
```

---

## ✅ Acceptance Criteria

- [ ] RECTANGLE render đúng màu fill, stroke, opacity
- [ ] CIRCLE render như ellipse với width/height khác nhau
- [ ] LINE render với mũi tên ở đầu/cuối theo style.arrowEnd/arrowStart
- [ ] TEXT hiển thị text, double-click để edit inline
- [ ] Text editing: textarea xuất hiện đúng vị trí với đúng scale
- [ ] PATH render smooth path từ points array
- [ ] ICON render lucide icon đúng iconKey
- [ ] Tất cả objects có thể được select (highlight border)
- [ ] Objects locked bởi người khác có visual indicator
- [ ] Objects sắp xếp đúng theo zIndex
