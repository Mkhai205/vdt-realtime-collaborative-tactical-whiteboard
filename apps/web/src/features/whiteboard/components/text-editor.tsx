import type { ObjectMutablePatch, WhiteboardObject } from "@rctw/shared-contracts"
import { PencilLineIcon } from "lucide-react"
import { Field, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { NumericField } from "./detail-fields"
import { clampMinimum, minimumFontSize } from "../whiteboard-helpers"

const fontFamilyOptions = [
  { value: "sans-serif", label: "Sans" },
  { value: "serif", label: "Serif" },
  { value: "monospace", label: "Mono" },
] as const

export function TextEditor({
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
