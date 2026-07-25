import { __name, init_esm } from "./chunk-GKTAOGFS.mjs";

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/uncrypto@0.1.3/node_modules/uncrypto/dist/crypto.node.mjs
init_esm();
import nodeCrypto from "node:crypto";
var subtle = nodeCrypto.webcrypto?.subtle || {};
var randomUUID = /* @__PURE__ */ __name(() => {
  return nodeCrypto.randomUUID();
}, "randomUUID");
var getRandomValues = /* @__PURE__ */ __name((array) => {
  return nodeCrypto.webcrypto.getRandomValues(array);
}, "getRandomValues");
var _crypto = {
  randomUUID,
  getRandomValues,
  subtle,
};
export { _crypto as default, getRandomValues, randomUUID, subtle };
//# sourceMappingURL=crypto.node-ODYUW5NK.mjs.map
