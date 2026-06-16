import { Injectable } from "@nestjs/common"
import {
  type GetBoardObjectsResponse,
  type GetBoardOperationsQuery,
  type GetBoardOperationsResponse,
  type ObjectCreateRequest,
  type ObjectDeleteRequest,
  type ObjectRestoreRequest,
  type ObjectUpdateRequest,
  type OperationAppliedEvent,
  type SyncResponse,
  type UserSummary,
} from "@rctw/shared-contracts"
import { WhiteboardObjectsMutationService } from "./whiteboard-objects-mutation.service"
import { WhiteboardObjectsQueryService } from "./whiteboard-objects-query.service"

@Injectable()
export class WhiteboardObjectsService {
  constructor(
    private readonly queryService: WhiteboardObjectsQueryService,
    private readonly mutationService: WhiteboardObjectsMutationService,
  ) {}

  async getBoardObjects(
    currentUser: UserSummary,
    boardId: string,
  ): Promise<GetBoardObjectsResponse> {
    return this.queryService.getBoardObjects(currentUser, boardId)
  }

  async getBoardOperations(
    currentUser: UserSummary,
    boardId: string,
    query: Partial<GetBoardOperationsQuery> = {},
  ): Promise<GetBoardOperationsResponse> {
    return this.queryService.getBoardOperations(currentUser, boardId, query)
  }

  async getBoardOperationReplay(
    currentUser: UserSummary,
    boardId: string,
    lastSeenRevision: number,
  ): Promise<SyncResponse> {
    return this.queryService.getBoardOperationReplay(
      currentUser,
      boardId,
      lastSeenRevision,
    )
  }

  async createObject(
    currentUser: UserSummary,
    boardId: string,
    request: ObjectCreateRequest,
  ): Promise<OperationAppliedEvent> {
    return this.mutationService.createObject(currentUser, boardId, request)
  }

  async updateObject(
    currentUser: UserSummary,
    boardId: string,
    objectId: string,
    request: ObjectUpdateRequest,
  ): Promise<OperationAppliedEvent> {
    return this.mutationService.updateObject(
      currentUser,
      boardId,
      objectId,
      request,
    )
  }

  async deleteObject(
    currentUser: UserSummary,
    boardId: string,
    objectId: string,
    request: ObjectDeleteRequest,
  ): Promise<OperationAppliedEvent> {
    return this.mutationService.deleteObject(
      currentUser,
      boardId,
      objectId,
      request,
    )
  }

  async restoreObject(
    currentUser: UserSummary,
    boardId: string,
    objectId: string,
    request: ObjectRestoreRequest,
  ): Promise<OperationAppliedEvent> {
    return this.mutationService.restoreObject(
      currentUser,
      boardId,
      objectId,
      request,
    )
  }
}
