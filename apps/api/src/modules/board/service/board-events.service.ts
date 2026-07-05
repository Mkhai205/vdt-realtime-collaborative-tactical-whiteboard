import { Injectable } from "@nestjs/common"
import { Subject } from "rxjs"

export interface BoardVisibilityChangedEvent {
  boardId: string
  visibility: "PUBLIC" | "PRIVATE"
}

@Injectable()
export class BoardEventsService {
  private readonly visibilityChanged$ = new Subject<BoardVisibilityChangedEvent>()

  get visibilityChanged() {
    return this.visibilityChanged$.asObservable()
  }

  emitVisibilityChanged(event: BoardVisibilityChangedEvent) {
    this.visibilityChanged$.next(event)
  }
}
