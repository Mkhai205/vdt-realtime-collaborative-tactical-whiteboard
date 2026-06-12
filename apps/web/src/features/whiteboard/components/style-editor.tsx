import { PaletteIcon } from "lucide-react"
import type { ShapeStyle, WhiteboardObject } from "@rctw/shared-contracts"
import { FieldLegend, FieldSet } from "@/components/ui/field"
import { ColorField, NumericField } from "./detail-fields"
import { roundCanvasValue, clamp, minimumStrokeWidth } from "../whiteboard-helpers"

const fallbackColors = {
  fill: "#86efac",
  stroke: "#14532d",
  text: "#172018",
}

export function StyleEditor({
  object,
  patchStyle,
  disabled,
}: {
  object: WhiteboardObject
  patchStyle: (style: ShapeStyle) => void
  disabled?: boolean
}) {
  return (
    <FieldSet>
      <FieldLegend className="flex items-center gap-2 text-sm">
        <PaletteIcon data-icon="inline-start" />
        Appearance
      </FieldLegend>
      {object.type === "TEXT" ? (
        <ColorField
          label="Text color"
          value={object.style.color ?? object.style.fill}
          fallback={fallbackColors.text}
          disabled={disabled}
          onCommit={(color) => patchStyle({ color })}
        />
      ) : null}
      {object.type === "RECTANGLE" || object.type === "CIRCLE" ? (
        <ColorField
          label="Fill"
          value={object.style.fill}
          fallback={fallbackColors.fill}
          disabled={disabled}
          onCommit={(fill) => patchStyle({ fill })}
        />
      ) : null}
      {object.type !== "TEXT" ? (
        <>
          <ColorField
            label="Stroke"
            value={object.style.stroke}
            fallback={fallbackColors.stroke}
            disabled={disabled}
            onCommit={(stroke) => patchStyle({ stroke })}
          />
          <NumericField
            label="Stroke width"
            value={object.style.strokeWidth ?? (object.type === "LINE" ? 4 : 2)}
            disabled={disabled}
            min={minimumStrokeWidth}
            step={1}
            onCommit={(strokeWidth) =>
              patchStyle({
                strokeWidth: Math.max(
                  minimumStrokeWidth,
                  roundCanvasValue(strokeWidth),
                ),
              })
            }
          />
        </>
      ) : null}
      <NumericField
        label="Opacity"
        value={object.style.opacity ?? 1}
        disabled={disabled}
        min={0}
        max={1}
        step={0.05}
        onCommit={(opacity) => patchStyle({ opacity: clamp(opacity, 0, 1) })}
      />
    </FieldSet>
  )
}
