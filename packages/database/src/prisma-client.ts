import "dotenv/config"
import { PrismaPg } from "@prisma/adapter-pg"
import { Prisma, PrismaClient } from "./generated/prisma/client.js"

const connectionString = process.env.DATABASE_URL as string

type PrismaClientFactoryOptions = {
  connectionString: string
  min?: number
  max?: number
  connectionTimeoutMillis?: number
  log?: Prisma.PrismaClientOptions["log"]
  errorFormat?: Prisma.PrismaClientOptions["errorFormat"]
}
function createPrismaAdapter(options: {
  connectionString: string
  min?: number
  max?: number
  connectionTimeoutMillis?: number
}) {
  return new PrismaPg({
    connectionString: options.connectionString,
    min: options.min,
    max: options.max,
    connectionTimeoutMillis: options.connectionTimeoutMillis,
  })
}

function createPrismaClient(options: PrismaClientFactoryOptions) {
  const adapter = createPrismaAdapter({
    connectionString: options.connectionString,
    min: options.min,
    max: options.max,
    connectionTimeoutMillis: options.connectionTimeoutMillis,
  })

  return new PrismaClient({
    adapter,
    log: options.log,
    errorFormat: options.errorFormat ?? "pretty",
  })
}

const prisma = createPrismaClient({ connectionString })

export { prisma, createPrismaClient, createPrismaAdapter, PrismaClient, Prisma }
