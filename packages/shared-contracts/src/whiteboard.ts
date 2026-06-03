import { z } from "zod";

export const objectTypeSchema = z.enum(["RECTANGLE", "CIRCLE", "LINE", "TEXT"]);
export const operationTypeSchema = z.enum([
  "OBJECT_CREATE",
  "OBJECT_UPDATE",
  "OBJECT_DELETE",
  "OBJECT_RESTORE",
]);

export type ObjectType = z.infer<typeof objectTypeSchema>;
export type OperationType = z.infer<typeof operationTypeSchema>;
