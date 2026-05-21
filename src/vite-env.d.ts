/**
 * @file Vite environment type declarations.
 * Provides TypeScript module resolution for `.vue` single-file components
 * so that importing a Vue SFC resolves to a proper component type.
 */
/// <reference types="vite/client" />

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<{}, {}, any>;
  export default component;
}
