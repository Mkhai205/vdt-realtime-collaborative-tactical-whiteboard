"use client"

import { useEffect, useRef, useState } from "react"
import type {
  ObjectMutablePatch,
  ShapeStyle,
  WhiteboardObject,
} from "@rctw/shared-contracts"
import {
  HashIcon,
  PanelRightIcon,
  PaletteIcon,
  PencilLineIcon,
  Trash2Icon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { useWhiteboardStore } from "@/stores/whiteboard-store"

type LinePoints = [number, number, number, number]

const defaultRectangleWidth = 160
const defaultRectangleHeight = 96
const defaultCircleSize = 128
const defaultTextWidth = 220
const defaultTextHeight = 72
const defaultLinePoints: LinePoints = [0, 0, 160, 0]
const minimumObjectSize = 16
const minimumFontSize = 8
const minimumStrokeWidth = 0
const canvasValuePrecision = 100

const fallbackColors = {
  fill: "#86efac",
  stroke: "#14532d",
  text: "#172018",
}

const fontFamilyOptions = [
  { value: "sans-serif", label: "Sans" },
  { value: "serif", label: "Serif" },
  { value: "monospace", label: "Mono" },
] as const

export function ObjectDetailPanel() {
  const selectedObject = useWhiteboardStore((state) =>
    state.selectedObjectId ? state.objects[state.selectedObjectId] : null,
  )
  const currentUserRole = useWhiteboardStore((state) => state.currentUser?.role)
  const updateObjectPatch = useWhiteboardStore(
    (state) => state.updateObjectPatch,
  )
  const deleteSelectedObject = useWhiteboardStore(
    (state) => state.deleteSelectedObject,
  )
  const object =
    selectedObject && !selectedObject.deletedAt ? selectedObject : null
  const canEdit =
    currentUserRole === "OWNER" || currentUserRole === "EDITOR"

  if (!object) {
    return (
      <Card className="min-h-0 shadow-sm" size="sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PanelRightIcon data-icon="inline-start" />
            Details
          </CardTitle>
          <CardDescription>No object selected</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-4">
          <div className="rounded-lg border border-dashed bg-muted/40 px-3 py-4 text-sm text-muted-foreground">
            Select a shape, line, or text object to inspect and edit its local
            properties.
          </div>
        </CardContent>
        <CardFooter>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="w-full"
            disabled
          >
            <Trash2Icon data-icon="inline-start" />
            Delete object
          </Button>
        </CardFooter>
      </Card>
    )
  }

  const objectId = object.id

  function patchObject(patch: ObjectMutablePatch) {
    if (!canEdit) {
      return
    }

    updateObjectPatch(objectId, patch)
  }

  function patchStyle(stylePatch: ShapeStyle) {
    patchObject({ style: stylePatch })
  }

  return (
    <Card className="min-h-0 shadow-sm" size="sm">
      <CardHeader className="shrink-0">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <PanelRightIcon data-icon="inline-start" />
            Details
          </CardTitle>
          <Badge variant="secondary">{object.type}</Badge>
        </div>
        <CardDescription className="truncate font-mono text-xs">
          {object.id}
        </CardDescription>
      </CardHeader>

      <CardContent className="min-h-0 flex-1 overflow-y-auto">
        <FieldGroup key={object.id} className="gap-4 pb-1">
          <MetadataSection object={object} />
          <FieldSeparator label="Geometry" />
          <GeometryEditor
            object={object}
            patchObject={patchObject}
            disabled={!canEdit}
          />
          <FieldSeparator label="Style" />
          <StyleEditor
            object={object}
            patchStyle={patchStyle}
            disabled={!canEdit}
          />
          {object.type === "TEXT" ? (
            <>
              <FieldSeparator label="Text" />
              <TextEditor
                object={object}
                patchObject={patchObject}
                disabled={!canEdit}
              />
            </>
          ) : null}
          {object.type === "LINE" ? (
            <>
              <FieldSeparator label="Line" />
              <LineEditor
                object={object}
                patchObject={patchObject}
                disabled={!canEdit}
              />
            </>
          ) : null}
        </FieldGroup>
      </CardContent>

      <CardFooter className="shrink-0">
        <Button
          type="button"
          variant="destructive"
          size="sm"
          className="w-full"
          disabled={!canEdit}
          onClick={deleteSelectedObject}
        >
          <Trash2Icon data-icon="inline-start" />
          Delete object
        </Button>
      </CardFooter>
    </Card>
  )
}

function MetadataSection({ object }: { object: WhiteboardObject }) {
  const sizeSummary = getObjectSizeSummary(object)

  return (
    <section className="flex flex-col gap-3" aria-label="Object metadata">
      <div className="grid grid-cols-[5.25rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
        <ReadonlyRow label="Type" value={object.type} />
        <ReadonlyRow label="Position" value={`${formatNumber(object.x)}, ${formatNumber(object.y)}`} mono />
        <ReadonlyRow label="Size" value={sizeSummary} mono />
        <ReadonlyRow label="Rotation" value={`${formatNumber(object.rotation)} deg`} mono />
        <ReadonlyRow label="Z index" value={object.zIndex.toString()} mono />
        <ReadonlyRow label="Version" value={object.version.toString()} mono />
      </div>

      <details className="rounded-lg border bg-muted/30 px-3 py-2">
        <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium">
          <HashIcon data-icon="inline-start" />
          Metadata
        </summary>
        <div className="mt-3 grid grid-cols-[5.25rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
          <ReadonlyRow label="Object id" value={object.id} mono breakAll />
          <ReadonlyRow label="Room id" value={object.roomId} mono breakAll />
          <ReadonlyRow label="Created" value={formatTimestamp(object.createdAt)} mono />
          <ReadonlyRow label="Updated" value={formatTimestamp(object.updatedAt)} mono />
          <ReadonlyRow label="Creator" value={object.createdById} mono breakAll />
          <ReadonlyRow label="Updater" value={object.updatedById ?? "-"} mono breakAll />
        </div>
      </details>
    </section>
  )
}

function GeometryEditor({
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

function StyleEditor({
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

function TextEditor({
  object,
  patchObject,
  disabled,
}: {
  object: WhiteboardObject
  patchObject: (patch: ObjectMutablePatch) => void
  disabled?: boolean
}) {
  const fontWeight = object.style.fontWeight ?? "normal"
  const fontFamily = object.style.fontFamily ?? "sans-serif"

  return (
    <FieldSet>
      <FieldLegend className="flex items-center gap-2 text-sm">
        <PencilLineIcon data-icon="inline-start" />
        Content
      </FieldLegend>
      <Field>
        <FieldLabel htmlFor={`${object.id}-text`}>Text</FieldLabel>
        <Textarea
          id={`${object.id}-text`}
          value={object.text ?? ""}
          rows={3}
          disabled={disabled}
          onChange={(event) => patchObject({ text: event.target.value })}
        />
      </Field>
      <NumericField
        label="Font size"
        value={object.style.fontSize ?? 24}
        disabled={disabled}
        min={minimumFontSize}
        step={1}
        onCommit={(fontSize) =>
          patchObject({
            style: {
              fontSize: clampMinimum(fontSize, minimumFontSize),
            },
          })
        }
      />
      <Field>
        <FieldLabel htmlFor={`${object.id}-font-weight`}>Weight</FieldLabel>
        <Select
          value={fontWeight}
          disabled={disabled}
          onValueChange={(value) =>
            patchObject({
              style: {
                fontWeight: value === "bold" ? "bold" : "normal",
              },
            })
          }
        >
          <SelectTrigger id={`${object.id}-font-weight`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="bold">Bold</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel htmlFor={`${object.id}-font-family`}>Family</FieldLabel>
        <Select
          value={fontFamily}
          disabled={disabled}
          onValueChange={(fontFamilyValue) =>
            patchObject({ style: { fontFamily: fontFamilyValue } })
          }
        >
          <SelectTrigger id={`${object.id}-font-family`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {fontFamilyOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
    </FieldSet>
  )
}

function LineEditor({
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

function NumericField({
  label,
  value,
  disabled,
  min,
  max,
  step,
  onCommit,
}: {
  label: string
  value: number
  disabled?: boolean
  min?: number
  max?: number
  step?: number
  onCommit: (value: number) => void
}) {
  const inputId = label.toLowerCase().replaceAll(" ", "-")
  const [draft, setDraft] = useState(formatNumber(value))
  const isFocusedRef = useRef(false)

  useEffect(() => {
    if (!isFocusedRef.current) {
      setDraft(formatNumber(value))
    }
  }, [value])

  function coerceValue(input: string): number | null {
    if (input.trim() === "") {
      return null
    }

    const parsedValue = Number(input)

    if (!Number.isFinite(parsedValue)) {
      return null
    }

    return clamp(roundCanvasValue(parsedValue), min, max)
  }

  function commitInput(input: string): number | null {
    const nextValue = coerceValue(input)

    if (nextValue === null) {
      return null
    }

    onCommit(nextValue)
    return nextValue
  }

  return (
    <Field>
      <FieldLabel htmlFor={inputId}>{label}</FieldLabel>
      <Input
        id={inputId}
        type="number"
        inputMode="decimal"
        value={draft}
        disabled={disabled}
        min={min}
        max={max}
        step={step}
        onFocus={() => {
          isFocusedRef.current = true
        }}
        onBlur={() => {
          isFocusedRef.current = false
          const committedValue = commitInput(draft)
          setDraft(formatNumber(committedValue ?? value))
        }}
        onChange={(event) => {
          const nextDraft = event.target.value
          setDraft(nextDraft)
          commitInput(nextDraft)
        }}
      />
    </Field>
  )
}

function ColorField({
  label,
  value,
  fallback,
  disabled,
  onCommit,
}: {
  label: string
  value: string | undefined
  fallback: string
  disabled?: boolean
  onCommit: (value: string) => void
}) {
  const inputId = label.toLowerCase().replaceAll(" ", "-")
  const normalizedValue = toColorInputValue(value, fallback)
  const [draftState, setDraftState] = useState({
    source: normalizedValue,
    value: normalizedValue,
  })
  const draft =
    draftState.source === normalizedValue ? draftState.value : normalizedValue

  function setDraft(nextDraft: string) {
    setDraftState({
      source: normalizedValue,
      value: nextDraft,
    })
  }

  function commitColor(color: string) {
    if (!isHexColor(color)) {
      return null
    }

    const normalizedColor = normalizeHexColor(color)
    onCommit(normalizedColor)
    return normalizedColor
  }

  return (
    <Field>
      <FieldLabel htmlFor={inputId}>{label}</FieldLabel>
      <div className="grid grid-cols-[2.75rem_minmax(0,1fr)] gap-2">
        <Input
          id={inputId}
          type="color"
          value={normalizedValue}
          disabled={disabled}
          className="p-1"
          onChange={(event) => {
            const nextColor = event.target.value
            setDraft(nextColor)
            commitColor(nextColor)
          }}
        />
        <Input
          value={draft}
          spellCheck={false}
          disabled={disabled}
          className="font-mono text-xs"
          onBlur={() => {
            const committedColor = commitColor(draft)
            setDraft(committedColor ?? normalizedValue)
          }}
          onChange={(event) => {
            const nextDraft = event.target.value
            setDraft(nextDraft)
            commitColor(nextDraft)
          }}
        />
      </div>
      {value && !isHexColor(value) ? (
        <FieldDescription>
          Existing non-hex color will be replaced when edited.
        </FieldDescription>
      ) : null}
    </Field>
  )
}

function CheckboxField({
  label,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string
  checked: boolean
  disabled?: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <Field orientation="horizontal">
      <Checkbox
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => onCheckedChange(value === true)}
      />
      <FieldContent>
        <FieldTitle>{label}</FieldTitle>
      </FieldContent>
    </Field>
  )
}

function ReadonlyRow({
  label,
  value,
  mono = false,
  breakAll = false,
}: {
  label: string
  value: string
  mono?: boolean
  breakAll?: boolean
}) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "min-w-0 text-foreground",
          mono && "font-mono text-xs",
          breakAll ? "break-all" : "truncate",
        )}
      >
        {value}
      </dd>
    </>
  )
}

function FieldSeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <Separator className="flex-1" />
      <span className="text-xs font-medium text-muted-foreground">
        {label}
      </span>
      <Separator className="flex-1" />
    </div>
  )
}

function getObjectDimensions(object: WhiteboardObject): {
  width: number
  height: number
} {
  switch (object.type) {
    case "CIRCLE":
      return {
        width: object.width ?? defaultCircleSize,
        height: object.height ?? defaultCircleSize,
      }
    case "TEXT":
      return {
        width: object.width ?? defaultTextWidth,
        height: object.height ?? defaultTextHeight,
      }
    case "RECTANGLE":
      return {
        width: object.width ?? defaultRectangleWidth,
        height: object.height ?? defaultRectangleHeight,
      }
    case "LINE": {
      const points = getLinePoints(object.points)

      return {
        width: Math.abs(points[2] - points[0]),
        height: Math.abs(points[3] - points[1]),
      }
    }
  }
}

function getObjectSizeSummary(object: WhiteboardObject): string {
  if (object.type === "LINE") {
    const points = getLinePoints(object.points)
    const length = Math.hypot(points[2] - points[0], points[3] - points[1])

    return `${formatNumber(length)} px`
  }

  const dimensions = getObjectDimensions(object)

  return `${formatNumber(dimensions.width)} x ${formatNumber(dimensions.height)}`
}

function getLinePoints(points: WhiteboardObject["points"]): LinePoints {
  if (!points || points.length < 4) {
    return [
      defaultLinePoints[0],
      defaultLinePoints[1],
      defaultLinePoints[2],
      defaultLinePoints[3],
    ]
  }

  return [
    points[0] ?? defaultLinePoints[0],
    points[1] ?? defaultLinePoints[1],
    points[2] ?? defaultLinePoints[2],
    points[3] ?? defaultLinePoints[3],
  ]
}

function clamp(value: number, min?: number, max?: number): number {
  let nextValue = value

  if (typeof min === "number") {
    nextValue = Math.max(min, nextValue)
  }

  if (typeof max === "number") {
    nextValue = Math.min(max, nextValue)
  }

  return nextValue
}

function clampMinimum(value: number, min: number): number {
  return Math.max(min, roundCanvasValue(value))
}

function roundCanvasValue(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.round(value * canvasValuePrecision) / canvasValuePrecision
}

function normalizeRotationDegrees(rotation: number): number {
  if (!Number.isFinite(rotation)) {
    return 0
  }

  return roundCanvasValue(((rotation % 360) + 360) % 360)
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return "0"
  }

  return Number.isInteger(value)
    ? value.toString()
    : value.toFixed(2).replace(/\.?0+$/, "")
}

function formatTimestamp(value: string | null | undefined): string {
  if (!value) {
    return "-"
  }

  return value.replace("T", " ").replace(".000Z", "Z")
}

function toColorInputValue(value: string | undefined, fallback: string): string {
  if (!value || !isHexColor(value)) {
    return normalizeHexColor(fallback)
  }

  return normalizeHexColor(value)
}

function isHexColor(value: string): boolean {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim())
}

function normalizeHexColor(value: string): string {
  const trimmedValue = value.trim()

  if (!isHexColor(trimmedValue)) {
    return "#000000"
  }

  const hex = trimmedValue.slice(1)

  if (hex.length === 6) {
    return `#${hex.toLowerCase()}`
  }

  return `#${hex
    .split("")
    .map((character) => character + character)
    .join("")
    .toLowerCase()}`
}
