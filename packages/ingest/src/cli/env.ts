import { existsSync } from "node:fs";
import { resolve } from "node:path";

/** Carrega o .env da raiz do repositório, se existir. */
const envFile = resolve(import.meta.dirname, "../../../../.env");
if (existsSync(envFile)) process.loadEnvFile(envFile);
