import { Injectable } from "@nestjs/common"
import { type BoardObjectDto } from "@rctw/shared-contracts"
import { Subject } from "rxjs"

export interface BoardVisibilityChangedEvent {
  boardId: string
  visibility: "PUBLIC" | "PRIVATE"
}

export interface BoardRestoredEvent {
  boardId: string
  revision: number
  objects: BoardObjectDto[]
}

@Injectable()
export class BoardEventsService {
  private readonly visibilityChanged$ = new Subject<BoardVisibilityChangedEvent>()
  private readonly boardRestored$ = new Subject<BoardRestoredEvent>()

  get visibilityChanged() {
    return this.visibilityChanged$.asObservable()
  }

  get boardRestored() {
    return this.boardRestored$.asObservable()
  }

  emitVisibilityChanged(event: BoardVisibilityChangedEvent) {
    this.visibilityChanged$.next(event)
  }

  emitBoardRestored(event: BoardRestoredEvent) {
    this.boardRestored$.next(event)
  }
}

