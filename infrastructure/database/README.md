# Database Infrastructure

The local runtime connects to the default Microsoft SQL Server instance over
TCP 1433. Keep credentials in `apps/web/.env.local`; never commit them.

Use `/api/database/health` to verify network, authentication, database access,
and pool readiness. Retention and backups remain to be defined before
production data is introduced.

## Migrations

Copy `migration.env.example` to the ignored `migration.env.local` and supply a
dedicated SQL deployment login with `db_owner` on the target database. Then run:

```powershell
corepack pnpm db:migrate
corepack pnpm db:verify
```

The application login is added to the `cacsms_app` database role. That role can
read and write objects in the `cacsms` schema but cannot alter or control the
schema.
