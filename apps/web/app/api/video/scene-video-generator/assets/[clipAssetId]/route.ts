import { requireReadAccess } from "@/app/api/_utils/read-access";
import { loadSceneVideoClipAsset } from "@/lib/scene-video-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ clipAssetId: string }> }) {
  const denied = requireReadAccess(request);
  if (denied) {
    return denied;
  }

  try {
    const { clipAssetId } = await context.params;
    const asset = await loadSceneVideoClipAsset(clipAssetId);
    return new Response(new Uint8Array(asset.bytes), {
      status: 200,
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Disposition": `inline; filename="${asset.fileName}"`,
        "Content-Length": String(asset.bytes.length),
        "Content-Type": asset.mimeType,
        "X-Asset-Checksum-Sha256": asset.checksumSha256
      }
    });
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : "The scene-video clip asset could not be loaded." },
      { status: 500 }
    );
  }
}
