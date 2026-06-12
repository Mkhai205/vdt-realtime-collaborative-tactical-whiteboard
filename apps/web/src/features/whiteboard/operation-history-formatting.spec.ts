import { describe, expect, it } from "vitest"
import {
  formatObjectType,
  formatOperationObjectId,
  formatOperationTimestamp,
  formatOperationType,
} from "./operation-history-formatting"

describe("operation history formatting", () => {
  it("formats operation type labels", () => {
    expect(formatOperationType("OBJECT_CREATE")).toBe("Create")
    expect(formatOperationType("OBJECT_UPDATE")).toBe("Update")
    expect(formatOperationType("OBJECT_DELETE")).toBe("Delete")
    expect(formatOperationType("OBJECT_RESTORE")).toBe("Restore")
  })

  it("formats object type labels", () => {
    expect(formatObjectType("RECTANGLE")).toBe("Rectangle")
    expect(formatObjectType("CIRCLE")).toBe("Circle")
    expect(formatObjectType("LINE")).toBe("Line")
    expect(formatObjectType("TEXT")).toBe("Text")
    expect(formatObjectType(null)).toBe("Unknown object")
  })

  it("formats missing object ids", () => {
    expect(formatOperationObjectId(null)).toBe("No object")
  })

  it("falls back for invalid timestamps", () => {
    expect(formatOperationTimestamp("not-a-date")).toBe("Unknown time")
  })
})
