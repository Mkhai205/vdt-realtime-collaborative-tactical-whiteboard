import {
  BadRequestException,
  Body,
  Injectable,
  PipeTransform,
  Query,
} from "@nestjs/common"
import { z } from "zod"

export type ZodSchemaLike = {
  safeParse: (value: unknown) =>
    | {
        success: true
        data: unknown
      }
    | {
        success: false
        error: z.ZodError
      }
}

type ZodSchemaOutput<TSchema extends ZodSchemaLike> = Extract<
  ReturnType<TSchema["safeParse"]>,
  { success: true }
>["data"]

@Injectable()
export class ZodSchemaValidationPipe<
  TSchema extends ZodSchemaLike,
> implements PipeTransform<unknown, ZodSchemaOutput<TSchema>> {
  constructor(private readonly schema: TSchema) {}

  transform(value: unknown): ZodSchemaOutput<TSchema> {
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

export class ZodValidationPipe<
  TSchema extends ZodSchemaLike,
> extends ZodSchemaValidationPipe<TSchema> {}

export const ZodBody = <T extends ZodSchemaLike>(schema: T) =>
  Body(new ZodSchemaValidationPipe(schema))

export const ZodQuery = <T extends ZodSchemaLike>(schema: T) =>
  Query(new ZodSchemaValidationPipe(schema))
