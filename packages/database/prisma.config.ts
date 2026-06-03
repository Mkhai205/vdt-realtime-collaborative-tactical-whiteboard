import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

// Load .env file before resolving environment variables
config({ path: ".env" });

export default defineConfig({
    schema: "prisma/schema.prisma",
    migrations: {
        path: "prisma/migrations",
        seed: "ts-node prisma/seed.ts",
    },
    datasource: {
        url: env("DATABASE_URL"),
    },
});
