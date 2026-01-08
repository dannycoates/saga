declare module "virtual:runtime-registry" {
  export interface RuntimeInfo {
    id: string;
    displayName: string;
    fileExtension: string;
  }

  export interface RuntimeModule {
    default: new () => any;
    editorConfig?: {
      getLanguageExtension: () => Promise<any>;
      getLinter: () => Promise<any>;
    };
    metadata?: RuntimeInfo;
  }

  export const runtimeRegistry: RuntimeInfo[];
  export const runtimeImports: Record<string, () => Promise<RuntimeModule>>;
  export function getSupportedLanguages(): string[];
  export function getRuntimeInfo(id: string): RuntimeInfo | undefined;
  export function isLanguageSupported(id: string): boolean;
}
