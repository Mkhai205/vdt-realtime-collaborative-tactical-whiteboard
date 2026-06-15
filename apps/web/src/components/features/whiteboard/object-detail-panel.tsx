"use client"

import { useEffect, useRef, type FocusEvent } from "react"
import type { ObjectMutablePatch, ShapeStyle } from "@rctw/shared-contracts"
import type { RemoteEditingState } from "@/stores/whiteboard-store/types"
import { PanelRightIcon, Trash2Icon } from "lucide-react"
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
import { FieldGroup } from "@/components/ui/field"
import { useWhiteboardStore } from "@/stores/whiteboard-store"
import { MetadataSection } from "./components/metadata-section"
import { GeometryEditor } from "./components/geometry-editor"
import { StyleEditor } from "./components/style-editor"
import { TextEditor } from "./components/text-editor"
import { LineEditor } from "./components/line-editor"
import { FieldSeparator } from "./components/detail-fields"
import { canEditRoom } from "@/lib/room-utils"

export function ObjectDetailPanel() {
  const selectedObject = useWhiteboardStore((state) =>
    state.selectedObjectId ? state.objects[state.selectedObjectId] : null,
  )
  const currentUserRole = useWhiteboardStore((state) => state.currentUser?.role)
  const remoteEditorsByUserId = useWhiteboardStore((state) =>
    state.selectedObjectId ? state.remoteEditors[state.selectedObjectId] : null,
  )
  const updateObjectPatch = useWhiteboardStore(
    (state) => state.updateObjectPatch,
  )
  const deleteSelectedObject = useWhiteboardStore(
    (state) => state.deleteSelectedObject,
  )
  const sendEditingStart = useWhiteboardStore(
    (state) => state.sendEditingStart,
  )
  const sendEditingEnd = useWhiteboardStore((state) => state.sendEditingEnd)
  const panelEditingObjectIdRef = useRef<string | null>(null)
  const object =
    selectedObject && !selectedObject.deletedAt ? selectedObject : null
  const objectId = object?.id ?? null
  const remoteEditors = Object.values(remoteEditorsByUserId ?? {})
  const canEdit = canEditRoom(currentUserRole)

  useEffect(() => {
    const activeObjectId = panelEditingObjectIdRef.current

    if (activeObjectId && activeObjectId !== objectId) {
      panelEditingObjectIdRef.current = null
      sendEditingEnd(activeObjectId)
    }
  }, [objectId, sendEditingEnd])

  useEffect(() => {
    return () => {
      const activeObjectId = panelEditingObjectIdRef.current

      if (activeObjectId) {
        panelEditingObjectIdRef.current = null
        sendEditingEnd(activeObjectId)
      }
    }
  }, [sendEditingEnd])

  if (!object) {
    return (
      <Card className="min-h-0 flex-1 shadow-sm" size="sm">
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

  const activeObjectId = object.id

  function patchObject(patch: ObjectMutablePatch) {
    if (!canEdit) {
      return
    }

    updateObjectPatch(activeObjectId, patch)
  }

  function patchStyle(stylePatch: ShapeStyle) {
    patchObject({ style: stylePatch })
  }

  function handleEditorFocus(event: FocusEvent<HTMLDivElement>) {
    if (!canEdit) {
      return
    }

    if (
      event.relatedTarget instanceof Node &&
      event.currentTarget.contains(event.relatedTarget)
    ) {
      return
    }

    const currentEditingObjectId = panelEditingObjectIdRef.current

    if (currentEditingObjectId === activeObjectId) {
      return
    }

    if (currentEditingObjectId) {
      sendEditingEnd(currentEditingObjectId)
    }

    panelEditingObjectIdRef.current = activeObjectId
    sendEditingStart(activeObjectId)
  }

  function handleEditorBlur(event: FocusEvent<HTMLDivElement>) {
    if (
      event.relatedTarget instanceof Node &&
      event.currentTarget.contains(event.relatedTarget)
    ) {
      return
    }

    if (panelEditingObjectIdRef.current !== activeObjectId) {
      return
    }

    panelEditingObjectIdRef.current = null
    sendEditingEnd(activeObjectId)
  }

  return (
    <Card className="min-h-0 flex-1 shadow-sm" size="sm">
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
        {remoteEditors.length > 0 ? (
          <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-2 py-1 text-xs text-muted-foreground">
            <Badge variant="outline">Soft lock</Badge>
            <span className="min-w-0 truncate">
              {formatRemoteEditorWarning(remoteEditors)}
            </span>
          </div>
        ) : null}
      </CardHeader>

      <CardContent
        className="min-h-0 flex-1 overflow-y-auto"
        onFocusCapture={handleEditorFocus}
        onBlurCapture={handleEditorBlur}
      >
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

function formatRemoteEditorWarning(editors: RemoteEditingState[]): string {
  const names = editors
    .map((editor) => editor.user.name.trim())
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right))

  if (names.length === 0) {
    return "Another user is editing this object."
  }

  if (names.length === 1) {
    return `${names[0]} is editing this object.`
  }

  return `${names[0]} and ${names.length - 1} more are editing this object.`
}
