import sql from "mssql";

export interface DatabaseHealth {
  status: "connected" | "disconnected";
  database: string;
  latencyMs: number;
  userTableCount: number;
  checkedAt: string;
  message: string;
}

type MssqlGlobal = typeof globalThis & {
  __cacsmsMssqlPool?: Promise<sql.ConnectionPool>;
};

const globalForMssql = globalThis as MssqlGlobal;

function requiredEnvironment(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required database setting: ${name}`);
  return value;
}

function integerEnvironment(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`Invalid numeric database setting: ${name}`);
  return value;
}

function booleanEnvironment(name: string, fallback: boolean) {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return fallback;
  if (raw === "true") return true;
  if (raw === "false") return false;
  throw new Error(`Invalid boolean database setting: ${name}`);
}

export function getMssqlConfig(): sql.config {
  return {
    server: requiredEnvironment("MSSQL_SERVER"),
    port: integerEnvironment("MSSQL_PORT", 1433),
    database: requiredEnvironment("MSSQL_DATABASE"),
    user: requiredEnvironment("MSSQL_USER"),
    password: requiredEnvironment("MSSQL_PASSWORD"),
    connectionTimeout: integerEnvironment("MSSQL_CONNECTION_TIMEOUT_MS", 15_000),
    requestTimeout: integerEnvironment("MSSQL_REQUEST_TIMEOUT_MS", 30_000),
    pool: {
      max: integerEnvironment("MSSQL_POOL_MAX", 10),
      min: integerEnvironment("MSSQL_POOL_MIN", 0),
      idleTimeoutMillis: integerEnvironment("MSSQL_POOL_IDLE_TIMEOUT_MS", 30_000)
    },
    options: {
      encrypt: booleanEnvironment("MSSQL_ENCRYPT", true),
      trustServerCertificate: booleanEnvironment("MSSQL_TRUST_SERVER_CERTIFICATE", false),
      enableArithAbort: true
    }
  };
}

export async function getMssqlPool() {
  if (!globalForMssql.__cacsmsMssqlPool) {
    const pool = new sql.ConnectionPool(getMssqlConfig());
    globalForMssql.__cacsmsMssqlPool = pool.connect().catch((error) => {
      globalForMssql.__cacsmsMssqlPool = undefined;
      throw error;
    });
  }
  return globalForMssql.__cacsmsMssqlPool;
}

export async function getDatabaseHealth(): Promise<DatabaseHealth> {
  const startedAt = performance.now();
  const checkedAt = new Date().toISOString();
  const database = process.env.MSSQL_DATABASE?.trim() || "unconfigured";

  try {
    const pool = await getMssqlPool();
    const result = await pool.request().query<{ databaseName: string; userTableCount: number }>(`
      SELECT
        DB_NAME() AS databaseName,
        (SELECT COUNT(*) FROM sys.tables WHERE is_ms_shipped = 0) AS userTableCount;
    `);
    const record = result.recordset[0];
    return {
      status: "connected",
      database: record?.databaseName || database,
      latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
      userTableCount: Number(record?.userTableCount || 0),
      checkedAt,
      message: "MSSQL connection pool is operational."
    };
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "UNKNOWN";
    console.error("mssql.health.failed", { code });
    return {
      status: "disconnected",
      database,
      latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
      userTableCount: 0,
      checkedAt,
      message: `MSSQL connection failed (${code}).`
    };
  }
}
