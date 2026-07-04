# 🛠️ Plan 06 — Canvas Tools & Toolbar

> **Ưu tiên**: 🔴 Critical  
> **Ước tính**: 0.75 ngày  
> **Phụ thuộc**: Plan 04 (Canvas Core), Plan 05 (Shapes)

---

## 🎯 Mục tiêu

Implement hệ thống tool đầy đủ:
1. **Toolbar** floating với tất cả tools
2. **Tool behavior**: mỗi tool có interaction riêng
3. **Shape creation flow**: click/drag để vẽ shape
4. **Style panel**: chỉnh màu, stroke, text style

---

## 🔧 Tool List

Từ `Tool` enum trong `shared-contracts`:

| Tool | Icon | Shortcut | Behavior |
|------|------|----------|----------|
| `SELECT` | Cursor | V | Click để select, drag để lasso |
| `HAND` | Hand | H hoặc Space | Drag để pan |
| `RECTANGLE` | Square | R | Click+drag để vẽ rect |
| `CIRCLE` | Circle | C | Click+drag để vẽ circle |
| `LINE` | ArrowRight | L | Click+drag để vẽ line/arrow |
| `TEXT` | Type | T | Click để tạo text box |
| `PATH` | Pen | P | Click+drag freehand draw |
| `ICON` | Smile | I | Click mở icon picker rồi đặt |

---

## 📁 Files cần tạo

### `features/board/components/toolbar/Toolbar.tsx`
```tsx
// Floating toolbar — left side của canvas
// Design: glassmorphism card, vertical layout
// Groups:
//   - Navigation: SELECT, HAND
//   - Separator
//   - Shapes: RECTANGLE, CIRCLE, LINE
//   - Separator  
//   - Content: TEXT, PATH, ICON
// Active tool: highlighted background
// Tooltip on hover: tên tool + shortcut
```

**Design Spec**:
```
┌──────┐
│  ↖   │  SELECT (V)
│  ✋  │  HAND (H)
├──────┤
│  □   │  RECTANGLE (R)
│  ○   │  CIRCLE (C)
│  →   │  LINE (L)
├──────┤
│  T   │  TEXT (T)
│  ✏️  │  PATH (P)
│  ★   │  ICON (I)
└──────┘
```

**CSS**: `backdrop-filter: blur(12px)`, border `border: 1px solid rgba(255,255,255,0.2)`, shadow

### `features/board/components/toolbar/ToolButton.tsx`
```tsx
// Individual tool button
// Props: tool, icon, shortcut, isActive
// Hover: scale(1.05), bg lighten
// Active: bg violet, text white
// Tooltip: Radix Tooltip với shortcut badge
```

### `features/board/hooks/useTool.ts`
```typescript
// Hook quản lý tool behavior:
// activeTool từ UIStore
// setActiveTool: đổi tool, reset drawing state

// Keyboard shortcuts:
// useEffect → addEventListener('keydown', ...)
// V → SELECT, H → HAND
// R → RECTANGLE, C → CIRCLE, L → LINE
// T → TEXT, P → PATH, I → ICON
// Escape → SELECT (cancel current tool)
// Delete/Backspace → delete selected objects
```

### `features/board/hooks/useShapeCreation.ts`
```typescript
// Hook xử lý việc tạo shapes mới khi user drag trên canvas
//
// State:
//   isCreating: boolean
//   startPoint: {x, y} | null
//   previewObject: Partial<BoardObjectDto> | null
//
// Flow cho RECTANGLE/CIRCLE:
// 1. onMouseDown: set isCreating=true, startPoint
// 2. onMouseMove: update previewObject với current bounds
// 3. onMouseUp: nếu drag > 5px → emit object:create
//               nếu không → tạo default size (100x100)
//
// Flow cho LINE:
// 1. onMouseDown: set startPoint
// 2. onMouseMove: update preview line endpoint
// 3. onMouseUp: emit object:create với points
//
// Flow cho TEXT:
// 1. onMouseDown: tạo text object ngay tại click point
// 2. Emit object:create với default "Text" content
// 3. Immediately enter edit mode
//
// Flow cho PATH:
// 1. onMouseDown: set isCreating=true, start collecting points
// 2. onMouseMove: append point mỗi 5px (throttle)
// 3. onMouseUp: emit object:create với collected points
// 4. Simplify path (Douglas-Peucker) trước khi gửi
//
// Mặc định sau khi tạo xong → switch về SELECT tool
```

### `features/board/components/canvas/DrawingPreview.tsx`
```tsx
// Konva Layer hiển thị preview của shape đang draw
// Không gửi lên server, chỉ hiển thị locally
// Dùng dashed stroke để phân biệt với real shapes
// Render dựa vào ui.store.drawingPreview
```

### `features/board/components/toolbar/StylePanel.tsx`
```tsx
// Panel xuất hiện khi có selection
// Hiển thị ở trên hoặc bên phải toolbar
// Sections:
//   - Fill color (color picker)
//   - Stroke color + width
//   - Opacity slider
//   - (TEXT only): Font size, font family, bold/italic
//   - (LINE only): Arrow type selector
//
// Thay đổi → emit object:update cho tất cả selected objects
```

### `features/board/components/toolbar/ColorPicker.tsx`
```tsx
// Compact color picker:
// - 8 preset colors (avatarPalette + extras)
// - Custom color input (hex)
// - Transparent option
// Design: small swatches, popover on click
```

---

## 🖱️ Mouse Cursor Handling

```typescript
// Cursor thay đổi theo tool:
const TOOL_CURSORS: Record<Tool, string> = {
  SELECT: 'default',
  HAND: 'grab',          // 'grabbing' khi đang pan
  RECTANGLE: 'crosshair',
  CIRCLE: 'crosshair',
  LINE: 'crosshair',
  TEXT: 'text',
  PATH: 'crosshair',
  ICON: 'crosshair',
};

// Apply lên Stage container div
```

---

## 📏 Snap-to-Grid (Optional Enhancement)

```typescript
// Khi Shift held: snap object position đến nearest 10px grid
// Khi draw: snap start/end points đến grid
// Visual indicator: snap guide lines (dashed)
```

---

## 🎨 Icon Picker

```tsx
// IconObject creation flow:
// 1. Click ICON tool
// 2. Mở IconPickerDialog (search + grid of lucide icons)
// 3. User chọn icon → click on canvas để đặt
// 4. emit object:create với iconKey

// IconPickerDialog:
// - Search input
// - Grid: 8x6 icons
// - Click → set selectedIcon, close dialog
// - Icon hiển thị sau cursor khi chọn (preview)
```

---

## ✅ Acceptance Criteria

- [ ] Toolbar render đúng tất cả 8 tools với icons và shortcuts
- [ ] Click tool button → activeTool thay đổi, button highlight
- [ ] Keyboard shortcuts V/H/R/C/L/T/P/I thay đổi tool
- [ ] Escape → quay về SELECT
- [ ] RECTANGLE/CIRCLE: click+drag → preview → tạo shape
- [ ] LINE: click+drag → preview line với mũi tên
- [ ] TEXT: click → tạo text object, enter edit mode ngay
- [ ] PATH: drag → freehand draw path
- [ ] ICON: click → mở picker → chọn → click canvas → đặt icon
- [ ] Sau khi tạo shape → tự động switch về SELECT
- [ ] StylePanel xuất hiện khi có selection
- [ ] Thay đổi fill/stroke/opacity → cập nhật object realtime
