export interface DomainModuleManifest {
  name: string;
  responsibility: string;
  entities: string[];
  commands: string[];
  queries: string[];
  events: string[];
}

export function createDomainModule(manifest: DomainModuleManifest) {
  return manifest;
}
