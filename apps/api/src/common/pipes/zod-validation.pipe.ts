import { BadRequestException, Injectable, PipeTransform } from "@nestjs/common"
import { z, type ZodType } from "zod"

@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value)

    if (!result.success) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Invalid request payload.",
        details: z.treeifyError(result.error),
      })
    }

    return result.data
  }
}
