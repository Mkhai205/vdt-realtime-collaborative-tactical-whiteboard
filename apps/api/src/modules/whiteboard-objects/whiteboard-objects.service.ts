import { Injectable } from "@nestjs/common"
import {
  type GetRoomObjectsResponse,
  type GetRoomOperationsQuery,
  type GetRoomOperationsResponse,
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

  async getRoomObjects(
    currentUser: UserSummary,
    roomId: string,
  ): Promise<GetRoomObjectsResponse> {
    return this.queryService.getRoomObjects(currentUser, roomId)
  }

  async getRoomOperations(
    currentUser: UserSummary,
    roomId: string,
    query: Partial<GetRoomOperationsQuery> = {},
  ): Promise<GetRoomOperationsResponse> {
    return this.queryService.getRoomOperations(currentUser, roomId, query)
  }

  async getRoomOperationReplay(
    currentUser: UserSummary,
    roomId: string,
    lastSeenRevision: number,
  ): Promise<SyncResponse> {
    return this.queryService.getRoomOperationReplay(
      currentUser,
      roomId,
      lastSeenRevision,
    )
  }

  async createObject(
    currentUser: UserSummary,
    roomId: string,
    request: ObjectCreateRequest,
  ): Promise<OperationAppliedEvent> {
    return this.mutationService.createObject(currentUser, roomId, request)
  }

  async updateObject(
    currentUser: UserSummary,
    roomId: string,
    objectId: string,
    request: ObjectUpdateRequest,
  ): Promise<OperationAppliedEvent> {
    return this.mutationService.updateObject(
      currentUser,
      roomId,
      objectId,
      request,
    )
  }

  async deleteObject(
    currentUser: UserSummary,
    roomId: string,
    objectId: string,
    request: ObjectDeleteRequest,
  ): Promise<OperationAppliedEvent> {
    return this.mutationService.deleteObject(
      currentUser,
      roomId,
      objectId,
      request,
    )
  }

  async restoreObject(
    currentUser: UserSummary,
    roomId: string,
    objectId: string,
    request: ObjectRestoreRequest,
  ): Promise<OperationAppliedEvent> {
    return this.mutationService.restoreObject(
      currentUser,
      roomId,
      objectId,
      request,
    )
  }
}
