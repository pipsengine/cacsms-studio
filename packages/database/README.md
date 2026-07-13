# Database

CACSMS Studio uses Microsoft SQL Server. The live Next.js runtime owns the
initial connection pool in `apps/web/lib/database/mssql.ts`; database settings
are loaded from `apps/web/.env.local` using the documented `.env.example`.

Current baseline:

- Driver: `mssql`
- Pooling: one process-wide pool with bounded size and idle timeout
- Transport: encrypted, with a configurable certificate-trust setting
- Diagnostics: `/api/database/health` and the main `/api/health` endpoint

The target database currently has no application tables. Add versioned
migrations here after the application schema and migration identity are agreed.
