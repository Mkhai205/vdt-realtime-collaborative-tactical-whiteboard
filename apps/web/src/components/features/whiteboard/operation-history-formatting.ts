import type { OperationSummary } from "@rctw/shared-contracts"

const operationTimestampFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
})

export function formatOperationType(type: OperationSummary["type"]): string {
  switch (type) {
    case "OBJECT_CREATE":
      return "Create"
    case "OBJECT_UPDATE":
      return "Update"
    case "OBJECT_DELETE":
      return "Delete"
    case "OBJECT_RESTORE":
      return "Restore"
  }
}

export function formatObjectType(
  objectType: OperationSummary["objectType"],
): string {
  switch (objectType) {
    case "RECTANGLE":
      return "Rectangle"
    case "CIRCLE":
      return "Circle"
    case "LINE":
      return "Line"
    case "TEXT":
      return "Text"
    case "PATH":
      return "Path"
    case "ICON":
      return "Icon"
    default:
      return "Unknown object"
  }
}

export function formatOperationTimestamp(value: string): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return "Unknown time"
  }

  return operationTimestampFormatter.format(date)
}

export function formatOperationObjectId(
  objectId: OperationSummary["objectId"],
): string {
  return objectId ?? "No object"
}
