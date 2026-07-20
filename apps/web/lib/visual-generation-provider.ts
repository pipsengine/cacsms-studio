import {
  getLocalImageDaemonHealth,
  renderWithLocalImageModel,
  type LocalImageModelRender
} from "@/lib/local-image-model-runtime";

export interface ImageGenerationProviderHealth {
  providerId: string;
  reachable: boolean;
  modelLoaded: boolean;
  activeRender: boolean;
  message: string;
}

export interface ImageGenerationProviderRequest {
  prompt: string;
  width: number;
  height: number;
  seed: string;
}

export interface ImageGenerationProviderResult extends LocalImageModelRender {
  providerId: string;
}

export interface ImageGenerationProvider {
  providerId: string;
  displayName: string;
  modelKey: string;
  workflowKey: string;
  healthCheck(): Promise<ImageGenerationProviderHealth>;
  generate(request: ImageGenerationProviderRequest): Promise<ImageGenerationProviderResult>;
}

const LOCAL_PROVIDER_ID = "cacsms-local-neural-image-runtime";
const LOCAL_MODEL_KEY = "cacsms-local-photoreal-image-model";
const LOCAL_WORKFLOW_KEY = "photoreal-human";

function configuredLocalModelDisplayName() {
  return process.env.CACSMS_LOCAL_IMAGE_MODEL_NAME?.trim() || "CACSMS Local Photoreal Image Model";
}

function localModelConfigured() {
  return Boolean(
    process.env.CACSMS_LOCAL_IMAGE_DAEMON_URL?.trim() ||
      process.env.CACSMS_LOCAL_IMAGE_RENDER_COMMAND?.trim()
  );
}

class LocalNeuralImageProvider implements ImageGenerationProvider {
  providerId = LOCAL_PROVIDER_ID;
  displayName = "CACSMS Local Neural Image Runtime";
  modelKey = LOCAL_MODEL_KEY;
  workflowKey = LOCAL_WORKFLOW_KEY;

  async healthCheck(): Promise<ImageGenerationProviderHealth> {
    const status = await getLocalImageDaemonHealth();
    const configured = localModelConfigured();
    return {
      providerId: this.providerId,
      reachable: configured ? status.reachable : false,
      modelLoaded: configured ? status.modelLoaded : false,
      activeRender: configured ? status.activeRender : false,
      message: configured
        ? status.message
        : "Local image generation is not configured. Set CACSMS_LOCAL_IMAGE_DAEMON_URL or CACSMS_LOCAL_IMAGE_RENDER_COMMAND."
    };
  }

  async generate(request: ImageGenerationProviderRequest): Promise<ImageGenerationProviderResult> {
    if (!localModelConfigured()) {
      throw new Error(
        "Real image generation is not configured. Set CACSMS_LOCAL_IMAGE_DAEMON_URL or CACSMS_LOCAL_IMAGE_RENDER_COMMAND before using the autonomous image generator."
      );
    }

    const render = await renderWithLocalImageModel(request);
    if (!render) {
      throw new Error(
        "The configured local image provider did not return image bytes. Production mode does not allow procedural or mock fallback renders."
      );
    }

    return {
      ...render,
      providerId: this.providerId,
      model: render.model || configuredLocalModelDisplayName()
    };
  }
}

const localProvider = new LocalNeuralImageProvider();

export function getVisualGenerationProvider() {
  return localProvider;
}

export function getVisualGenerationProviderDefaults() {
  return {
    providerId: LOCAL_PROVIDER_ID,
    providerDisplayName: localProvider.displayName,
    modelKey: LOCAL_MODEL_KEY,
    modelDisplayName: configuredLocalModelDisplayName(),
    workflowKey: LOCAL_WORKFLOW_KEY,
    workflowDisplayName: "Photoreal Human Foundation Workflow"
  };
}
