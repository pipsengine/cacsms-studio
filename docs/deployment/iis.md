# IIS Deployment

CACSMS Studio is configured for IIS hosting on port `3008`.

## Requirements

- Windows Server with IIS enabled
- Node.js 20 or newer
- pnpm 9.15.4
- NSSM (the Non-Sucking Service Manager), either available on `PATH` or staged with `install-nssm.ps1`
- IIS URL Rewrite module
- IIS Application Request Routing with proxy enabled

## Build

```powershell
cd C:\Content-Generation\cacsms-studio
pnpm install
pnpm build:web
```

## Install IIS Site

Run PowerShell as Administrator:

```powershell
cd C:\Content-Generation\cacsms-studio
pnpm iis:install
```

This creates or updates:

- Site: `cacsms-studio`
- App pool: `cacsms-studio`
- Physical path: `C:\Content-Generation\cacsms-studio`
- HTTP binding: `*:3008`

## Install Node Runtime Service

The current server has URL Rewrite available but does not have `iisnode` installed. CACSMS Studio therefore uses the standard IIS reverse-proxy model:

- IIS public port: `3008`
- Node internal port: `3018`

Run PowerShell as Administrator:

```powershell
powershell -ExecutionPolicy Bypass -File infrastructure/deployment/iis/install-node-windows-service.ps1
```

If NSSM is not installed yet, stage it first:

```powershell
powershell -ExecutionPolicy Bypass -File infrastructure/deployment/iis/install-nssm.ps1
powershell -ExecutionPolicy Bypass -File infrastructure/deployment/iis/install-node-windows-service.ps1
```

Do not use the sample placeholder path `C:\path\to\nssm.exe`. If NSSM is in a custom location, pass the real full path:

```powershell
powershell -ExecutionPolicy Bypass -File infrastructure/deployment/iis/install-node-windows-service.ps1 -NssmPath "C:\Tools\nssm\nssm.exe"
```

Run the service installer from an elevated PowerShell session. It configures the
`cacsms-studio-node` service for automatic startup, restart on failure, and logs
under `logs/`.

## Verify

```powershell
pnpm iis:verify
```

Expected health URL:

```text
http://localhost:3008/api/health
```

## Local Production Start Without IIS

```powershell
set NODE_ENV=production
pnpm build:web
pnpm start
```

The standalone Node server defaults to internal port `3018` for IIS reverse proxy. IIS owns the public `3008` binding.
