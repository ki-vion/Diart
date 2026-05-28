/// <reference types="vite/client" />

declare global {
  // MuPDF.js reads this before loading mupdf-wasm.js
  // eslint-disable-next-line no-var
  var $libmupdf_wasm_Module: { locateFile?: (path: string) => string };
}

declare module "*.wasm?url" {
  const url: string;
  export default url;
}

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<{}, {}, any>;
  export default component;
}
