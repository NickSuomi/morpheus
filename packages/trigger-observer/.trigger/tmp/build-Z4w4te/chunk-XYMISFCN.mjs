import { __commonJS, __require, init_esm } from "./chunk-GKTAOGFS.mjs";

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/@opentelemetry+resources@2.7.1_@opentelemetry+api@1.9.1/node_modules/@opentelemetry/resources/build/src/detectors/platform/node/machine-id/execAsync.js
var require_execAsync = __commonJS({
  "../../../../.prototypes/trigger-dev/node_modules/.pnpm/@opentelemetry+resources@2.7.1_@opentelemetry+api@1.9.1/node_modules/@opentelemetry/resources/build/src/detectors/platform/node/machine-id/execAsync.js"(
    exports,
  ) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.execAsync = void 0;
    var child_process = __require("child_process");
    var util = __require("util");
    exports.execAsync = util.promisify(child_process.exec);
  },
});

export { require_execAsync };
//# sourceMappingURL=chunk-XYMISFCN.mjs.map
