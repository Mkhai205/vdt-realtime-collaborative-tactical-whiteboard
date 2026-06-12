import type { ObjectMutablePatch, WhiteboardObject } from "@rctw/shared-contracts"
import { FieldGroup, FieldLegend, FieldSet } from "@/components/ui/field"
import { CheckboxField, NumericField } from "./detail-fields"
import { getLinePoints, roundCanvasValue } from "../whiteboard-helpers"

export function LineEditor({
  object,
  patchObject,
  disabled,
}: {
  object: WhiteboardObject
  patchObject: (patch: ObjectMutablePatch) => void
  disabled?: boolean
}) {
  const points = getLinePoints(object.points)

  function patchPoint(index: number, value: number) {
    const nextPoints = [...points]
    nextPoints[index] = roundCanvasValue(value)
    patchObject({ points: nextPoints })
  }

  return (
    <FieldSet>
      <FieldLegend>Relative endpoints</FieldLegend>
      <div className="grid grid-cols-2 gap-3">
        <NumericField
          label="X1"
          value={points[0]}
          disabled={disabled}
          step={1}
          onCommit={(value) => patchPoint(0, value)}
        />
        <NumericField
          label="Y1"
          value={points[1]}
          disabled={disabled}
          step={1}
          onCommit={(value) => patchPoint(1, value)}
        />
        <NumericField
          label="X2"
          value={points[2]}
          disabled={disabled}
          step={1}
          onCommit={(value) => patchPoint(2, value)}
        />
        <NumericField
          label="Y2"
          value={points[3]}
          disabled={disabled}
          step={1}
          onCommit={(value) => patchPoint(3, value)}
        />
      </div>
      <FieldGroup data-slot="checkbox-group" className="gap-3">
        <CheckboxField
          label="Arrow start"
          checked={object.style.arrowStart ?? false}
          disabled={disabled}
          onCheckedChange={(arrowStart) =>
            patchObject({ style: { arrowStart } })
          }
        />
        <CheckboxField
          label="Arrow end"
          checked={object.style.arrowEnd ?? true}
          disabled={disabled}
          onCheckedChange={(arrowEnd) => patchObject({ style: { arrowEnd } })}
        />
      </FieldGroup>
    </FieldSet>
  )
}
