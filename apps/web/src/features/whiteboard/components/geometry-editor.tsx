import type { ObjectMutablePatch, WhiteboardObject } from "@rctw/shared-contracts"
import { FieldLegend, FieldSet } from "@/components/ui/field"
import { NumericField } from "./detail-fields"
import {
  getObjectDimensions,
  minimumObjectSize,
  normalizeRotationDegrees,
  roundCanvasValue,
  clampMinimum,
} from "../whiteboard-helpers"

export function GeometryEditor({
  object,
  patchObject,
  disabled,
}: {
  object: WhiteboardObject
  patchObject: (patch: ObjectMutablePatch) => void
  disabled?: boolean
}) {
  return (
    <FieldSet>
      <FieldLegend className="sr-only">Geometry</FieldLegend>
      <div className="grid grid-cols-2 gap-3">
        <NumericField
          label="X"
          value={object.x}
          disabled={disabled}
          step={1}
          onCommit={(x) => patchObject({ x: roundCanvasValue(x) })}
        />
        <NumericField
          label="Y"
          value={object.y}
          disabled={disabled}
          step={1}
          onCommit={(y) => patchObject({ y: roundCanvasValue(y) })}
        />
      </div>
      <NumericField
        label="Rotation"
        value={object.rotation}
        disabled={disabled}
        step={1}
        onCommit={(rotation) =>
          patchObject({ rotation: normalizeRotationDegrees(rotation) })
        }
      />
      {object.type === "RECTANGLE" || object.type === "CIRCLE" ? (
        <div className="grid grid-cols-2 gap-3">
          <NumericField
            label="Width"
            value={getObjectDimensions(object).width}
            disabled={disabled}
            min={minimumObjectSize}
            step={1}
            onCommit={(width) =>
              patchObject({ width: clampMinimum(width, minimumObjectSize) })
            }
          />
          <NumericField
            label="Height"
            value={getObjectDimensions(object).height}
            disabled={disabled}
            min={minimumObjectSize}
            step={1}
            onCommit={(height) =>
              patchObject({ height: clampMinimum(height, minimumObjectSize) })
            }
          />
        </div>
      ) : null}
    </FieldSet>
  )
}
