/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SERVER_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Build-time version info injected by Vite
declare const __APP_VERSION__: string;
declare const __BUILD_TIME__: string;
