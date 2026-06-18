import { HashIcon } from "lucide-react"
import type { WhiteboardObject } from "@rctw/shared-contracts"
import { ReadonlyRow } from "./detail-fields"
import { getObjectSizeSummary, formatNumber, formatTimestamp } from "../whiteboard-helpers"

export function MetadataSection({ object }: { object: WhiteboardObject }) {
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
          <ReadonlyRow label="Room id" value={object.boardId} mono breakAll />
          <ReadonlyRow label="Created" value={formatTimestamp(object.createdAt)} mono />
          <ReadonlyRow label="Updated" value={formatTimestamp(object.updatedAt)} mono />
          <ReadonlyRow label="Creator" value={object.createdById} mono breakAll />
          <ReadonlyRow label="Updater" value={object.updatedById ?? "-"} mono breakAll />
        </div>
      </details>
    </section>
  )
}
