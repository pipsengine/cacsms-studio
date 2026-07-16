import { requireReadAccess } from "@/app/api/_utils/read-access";
import { createImageAssetResponse } from "@/lib/image-generator-asset-response";
import { loadImageGeneratorAsset } from "@/lib/image-generator-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ assetId: string }> }) {
  const denied = requireReadAccess(request);
  if (denied) {
    return denied;
  }

  try {
    const { assetId } = await context.params;
    const { asset, bytes } = await loadImageGeneratorAsset(assetId);
    return createImageAssetResponse({
      bytes,
      mimeType: asset.MimeType,
      fileName: asset.FileName,
      checksumSha256: asset.ChecksumSha256
    });
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : "The image asset could not be loaded." },
      { status: 500 }
    );
  }
}
