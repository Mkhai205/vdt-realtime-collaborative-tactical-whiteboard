import { useEffect, useRef, useState } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { formatNumber, roundCanvasValue, clamp } from "../whiteboard-helpers"
import { isHexColor, normalizeHexColor, toColorInputValue } from "../whiteboard-ui-utils"

export function FieldSeparator({ label }: { label: string }) {
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

export function ReadonlyRow({
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

export function NumericField({
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

export function ColorField({
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

export function CheckboxField({
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
