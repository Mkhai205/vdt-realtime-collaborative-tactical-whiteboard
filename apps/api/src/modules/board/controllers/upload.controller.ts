import {
  Controller,
  Post,
  Param,
  ParseUUIDPipe,
  UploadedFile,
  UseInterceptors,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from "@nestjs/common"
import { FileInterceptor } from "@nestjs/platform-express"
import { extname } from "path"
import { randomUUID } from "crypto"
import { type JwtPayload } from "@rctw/shared-contracts"
import { CurrentUser } from "../../../common/decorators/current-user.decorator"
import { BoardPermissionService } from "../service/board-permission.service"
import { StorageService } from "../../../infrastructure/storage/storage.service"

@Controller("boards")
export class UploadController {
  constructor(
    private readonly boardPermissionService: BoardPermissionService,
    private readonly storageService: StorageService,
  ) {}

  @Post(":boardId/upload")
  @UseInterceptors(FileInterceptor("file"))
  async uploadBoardImage(
    @CurrentUser() currentUser: JwtPayload,
    @Param("boardId", ParseUUIDPipe) boardId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
          new FileTypeValidator({
            fileType: /(jpg|jpeg|png|webp|gif|svg\+xml)$/,
          }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    // 1. Check if user has permission to edit the board
    await this.boardPermissionService.assertFormalEditor(
      currentUser.sub,
      boardId,
    )

    // 2. Generate a unique key for the file
    const ext = extname(file.originalname) || ".png"
    const fileKey = `boards/${boardId}/${randomUUID()}${ext}`

    // 3. Upload to MinIO
    const url = await this.storageService.uploadFile(
      fileKey,
      file.buffer,
      file.mimetype,
    )

    return {
      url,
      filename: file.originalname,
    }
  }
}
