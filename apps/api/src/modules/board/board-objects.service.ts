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
  type JwtPayload,
} from "@rctw/shared-contracts"
import { BoardObjectsMutationService } from "./board-objects-mutation.service"
import { BoardObjectsQueryService } from "./board-objects-query.service"

@Injectable()
export class BoardObjectsService {
  constructor(
    private readonly queryService: BoardObjectsQueryService,
    private readonly mutationService: BoardObjectsMutationService,
  ) {}

  async getBoardObjects(
    currentUser: JwtPayload,
    boardId: string,
  ): Promise<GetBoardObjectsResponse> {
    return this.queryService.getBoardObjects(currentUser, boardId)
  }

  async getBoardOperations(
    currentUser: JwtPayload,
    boardId: string,
    query: Partial<GetBoardOperationsQuery> = {},
  ): Promise<GetBoardOperationsResponse> {
    return this.queryService.getBoardOperations(currentUser, boardId, query)
  }

  async getBoardOperationReplay(
    currentUser: JwtPayload,
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
    currentUser: JwtPayload,
    boardId: string,
    request: ObjectCreateRequest,
  ): Promise<OperationAppliedEvent> {
    return this.mutationService.createObject(currentUser, boardId, request)
  }

  async updateObject(
    currentUser: JwtPayload,
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
    currentUser: JwtPayload,
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
    currentUser: JwtPayload,
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
