/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SERVER_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Build-time version info injected by Vite
declare const __APP_VERSION__: string;   // git commit short hash
declare const __APP_SEMVER__: string;    // package.json semver (e.g. "2.70.2")
declare const __BUILD_TIME__: string;
