import { NextResponse } from "next/server";

export function createImageAssetResponse(input: {
  bytes: Buffer;
  mimeType: string;
  fileName: string;
  checksumSha256: string;
}) {
  return new NextResponse(new Uint8Array(input.bytes), {
    status: 200,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Disposition": `inline; filename="${input.fileName}"`,
      "Content-Length": String(input.bytes.length),
      "Content-Type": input.mimeType,
      "X-Asset-Checksum-Sha256": input.checksumSha256
    }
  });
}
