import { o } from "./chunk-QG5B3WVB.mjs";
import { __commonJS, __name, __require, __toESM, init_esm } from "./chunk-GKTAOGFS.mjs";

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/cli-table3@0.6.5/node_modules/cli-table3/src/debug.js
var require_debug = __commonJS({
  "../../../../.prototypes/trigger-dev/node_modules/.pnpm/cli-table3@0.6.5/node_modules/cli-table3/src/debug.js"(
    exports,
    module,
  ) {
    init_esm();
    var messages = [];
    var level = 0;
    var debug = /* @__PURE__ */ __name((msg, min) => {
      if (level >= min) {
        messages.push(msg);
      }
    }, "debug");
    debug.WARN = 1;
    debug.INFO = 2;
    debug.DEBUG = 3;
    debug.reset = () => {
      messages = [];
    };
    debug.setDebugLevel = (v) => {
      level = v;
    };
    debug.warn = (msg) => debug(msg, debug.WARN);
    debug.info = (msg) => debug(msg, debug.INFO);
    debug.debug = (msg) => debug(msg, debug.DEBUG);
    debug.debugMessages = () => messages;
    module.exports = debug;
  },
});

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/ansi-regex@5.0.1/node_modules/ansi-regex/index.js
var require_ansi_regex = __commonJS({
  "../../../../.prototypes/trigger-dev/node_modules/.pnpm/ansi-regex@5.0.1/node_modules/ansi-regex/index.js"(
    exports,
    module,
  ) {
    "use strict";
    init_esm();
    module.exports = ({ onlyFirst = false } = {}) => {
      const pattern = [
        "[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)",
        "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))",
      ].join("|");
      return new RegExp(pattern, onlyFirst ? void 0 : "g");
    };
  },
});

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/strip-ansi@6.0.1/node_modules/strip-ansi/index.js
var require_strip_ansi = __commonJS({
  "../../../../.prototypes/trigger-dev/node_modules/.pnpm/strip-ansi@6.0.1/node_modules/strip-ansi/index.js"(
    exports,
    module,
  ) {
    "use strict";
    init_esm();
    var ansiRegex = require_ansi_regex();
    module.exports = (string) =>
      typeof string === "string" ? string.replace(ansiRegex(), "") : string;
  },
});

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/is-fullwidth-code-point@3.0.0/node_modules/is-fullwidth-code-point/index.js
var require_is_fullwidth_code_point = __commonJS({
  "../../../../.prototypes/trigger-dev/node_modules/.pnpm/is-fullwidth-code-point@3.0.0/node_modules/is-fullwidth-code-point/index.js"(
    exports,
    module,
  ) {
    "use strict";
    init_esm();
    var isFullwidthCodePoint = /* @__PURE__ */ __name((codePoint) => {
      if (Number.isNaN(codePoint)) {
        return false;
      }
      if (
        codePoint >= 4352 &&
        (codePoint <= 4447 || // Hangul Jamo
          codePoint === 9001 || // LEFT-POINTING ANGLE BRACKET
          codePoint === 9002 || // RIGHT-POINTING ANGLE BRACKET
          // CJK Radicals Supplement .. Enclosed CJK Letters and Months
          (11904 <= codePoint && codePoint <= 12871 && codePoint !== 12351) || // Enclosed CJK Letters and Months .. CJK Unified Ideographs Extension A
          (12880 <= codePoint && codePoint <= 19903) || // CJK Unified Ideographs .. Yi Radicals
          (19968 <= codePoint && codePoint <= 42182) || // Hangul Jamo Extended-A
          (43360 <= codePoint && codePoint <= 43388) || // Hangul Syllables
          (44032 <= codePoint && codePoint <= 55203) || // CJK Compatibility Ideographs
          (63744 <= codePoint && codePoint <= 64255) || // Vertical Forms
          (65040 <= codePoint && codePoint <= 65049) || // CJK Compatibility Forms .. Small Form Variants
          (65072 <= codePoint && codePoint <= 65131) || // Halfwidth and Fullwidth Forms
          (65281 <= codePoint && codePoint <= 65376) ||
          (65504 <= codePoint && codePoint <= 65510) || // Kana Supplement
          (110592 <= codePoint && codePoint <= 110593) || // Enclosed Ideographic Supplement
          (127488 <= codePoint && codePoint <= 127569) || // CJK Unified Ideographs Extension B .. Tertiary Ideographic Plane
          (131072 <= codePoint && codePoint <= 262141))
      ) {
        return true;
      }
      return false;
    }, "isFullwidthCodePoint");
    module.exports = isFullwidthCodePoint;
    module.exports.default = isFullwidthCodePoint;
  },
});

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/emoji-regex@8.0.0/node_modules/emoji-regex/index.js
var require_emoji_regex = __commonJS({
  "../../../../.prototypes/trigger-dev/node_modules/.pnpm/emoji-regex@8.0.0/node_modules/emoji-regex/index.js"(
    exports,
    module,
  ) {
    "use strict";
    init_esm();
    module.exports = function () {
      return /\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62(?:\uDB40\uDC65\uDB40\uDC6E\uDB40\uDC67|\uDB40\uDC73\uDB40\uDC63\uDB40\uDC74|\uDB40\uDC77\uDB40\uDC6C\uDB40\uDC73)\uDB40\uDC7F|\uD83D\uDC68(?:\uD83C\uDFFC\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68\uD83C\uDFFB|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFF\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB-\uDFFE])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFE\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB-\uDFFD])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFD\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB\uDFFC])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\u200D(?:\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D)?\uD83D\uDC68|(?:\uD83D[\uDC68\uDC69])\u200D(?:\uD83D\uDC66\u200D\uD83D\uDC66|\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67]))|\uD83D\uDC66\u200D\uD83D\uDC66|\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67])|(?:\uD83D[\uDC68\uDC69])\u200D(?:\uD83D[\uDC66\uDC67])|[\u2695\u2696\u2708]\uFE0F|\uD83D[\uDC66\uDC67]|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|(?:\uD83C\uDFFB\u200D[\u2695\u2696\u2708]|\uD83C\uDFFF\u200D[\u2695\u2696\u2708]|\uD83C\uDFFE\u200D[\u2695\u2696\u2708]|\uD83C\uDFFD\u200D[\u2695\u2696\u2708]|\uD83C\uDFFC\u200D[\u2695\u2696\u2708])\uFE0F|\uD83C\uDFFB\u200D(?:\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C[\uDFFB-\uDFFF])|(?:\uD83E\uDDD1\uD83C\uDFFB\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1|\uD83D\uDC69\uD83C\uDFFC\u200D\uD83E\uDD1D\u200D\uD83D\uDC69)\uD83C\uDFFB|\uD83E\uDDD1(?:\uD83C\uDFFF\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1(?:\uD83C[\uDFFB-\uDFFF])|\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1)|(?:\uD83E\uDDD1\uD83C\uDFFE\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1|\uD83D\uDC69\uD83C\uDFFF\u200D\uD83E\uDD1D\u200D(?:\uD83D[\uDC68\uDC69]))(?:\uD83C[\uDFFB-\uDFFE])|(?:\uD83E\uDDD1\uD83C\uDFFC\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1|\uD83D\uDC69\uD83C\uDFFD\u200D\uD83E\uDD1D\u200D\uD83D\uDC69)(?:\uD83C[\uDFFB\uDFFC])|\uD83D\uDC69(?:\uD83C\uDFFE\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB-\uDFFD\uDFFF])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFC\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB\uDFFD-\uDFFF])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFB\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFC-\uDFFF])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFD\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB\uDFFC\uDFFE\uDFFF])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\u200D(?:\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D(?:\uD83D[\uDC68\uDC69])|\uD83D[\uDC68\uDC69])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFF\u200D(?:\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD]))|\uD83D\uDC69\u200D\uD83D\uDC69\u200D(?:\uD83D\uDC66\u200D\uD83D\uDC66|\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67]))|(?:\uD83E\uDDD1\uD83C\uDFFD\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1|\uD83D\uDC69\uD83C\uDFFE\u200D\uD83E\uDD1D\u200D\uD83D\uDC69)(?:\uD83C[\uDFFB-\uDFFD])|\uD83D\uDC69\u200D\uD83D\uDC66\u200D\uD83D\uDC66|\uD83D\uDC69\u200D\uD83D\uDC69\u200D(?:\uD83D[\uDC66\uDC67])|(?:\uD83D\uDC41\uFE0F\u200D\uD83D\uDDE8|\uD83D\uDC69(?:\uD83C\uDFFF\u200D[\u2695\u2696\u2708]|\uD83C\uDFFE\u200D[\u2695\u2696\u2708]|\uD83C\uDFFC\u200D[\u2695\u2696\u2708]|\uD83C\uDFFB\u200D[\u2695\u2696\u2708]|\uD83C\uDFFD\u200D[\u2695\u2696\u2708]|\u200D[\u2695\u2696\u2708])|(?:(?:\u26F9|\uD83C[\uDFCB\uDFCC]|\uD83D\uDD75)\uFE0F|\uD83D\uDC6F|\uD83E[\uDD3C\uDDDE\uDDDF])\u200D[\u2640\u2642]|(?:\u26F9|\uD83C[\uDFCB\uDFCC]|\uD83D\uDD75)(?:\uD83C[\uDFFB-\uDFFF])\u200D[\u2640\u2642]|(?:\uD83C[\uDFC3\uDFC4\uDFCA]|\uD83D[\uDC6E\uDC71\uDC73\uDC77\uDC81\uDC82\uDC86\uDC87\uDE45-\uDE47\uDE4B\uDE4D\uDE4E\uDEA3\uDEB4-\uDEB6]|\uD83E[\uDD26\uDD37-\uDD39\uDD3D\uDD3E\uDDB8\uDDB9\uDDCD-\uDDCF\uDDD6-\uDDDD])(?:(?:\uD83C[\uDFFB-\uDFFF])\u200D[\u2640\u2642]|\u200D[\u2640\u2642])|\uD83C\uDFF4\u200D\u2620)\uFE0F|\uD83D\uDC69\u200D\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67])|\uD83C\uDFF3\uFE0F\u200D\uD83C\uDF08|\uD83D\uDC15\u200D\uD83E\uDDBA|\uD83D\uDC69\u200D\uD83D\uDC66|\uD83D\uDC69\u200D\uD83D\uDC67|\uD83C\uDDFD\uD83C\uDDF0|\uD83C\uDDF4\uD83C\uDDF2|\uD83C\uDDF6\uD83C\uDDE6|[#\*0-9]\uFE0F\u20E3|\uD83C\uDDE7(?:\uD83C[\uDDE6\uDDE7\uDDE9-\uDDEF\uDDF1-\uDDF4\uDDF6-\uDDF9\uDDFB\uDDFC\uDDFE\uDDFF])|\uD83C\uDDF9(?:\uD83C[\uDDE6\uDDE8\uDDE9\uDDEB-\uDDED\uDDEF-\uDDF4\uDDF7\uDDF9\uDDFB\uDDFC\uDDFF])|\uD83C\uDDEA(?:\uD83C[\uDDE6\uDDE8\uDDEA\uDDEC\uDDED\uDDF7-\uDDFA])|\uD83E\uDDD1(?:\uD83C[\uDFFB-\uDFFF])|\uD83C\uDDF7(?:\uD83C[\uDDEA\uDDF4\uDDF8\uDDFA\uDDFC])|\uD83D\uDC69(?:\uD83C[\uDFFB-\uDFFF])|\uD83C\uDDF2(?:\uD83C[\uDDE6\uDDE8-\uDDED\uDDF0-\uDDFF])|\uD83C\uDDE6(?:\uD83C[\uDDE8-\uDDEC\uDDEE\uDDF1\uDDF2\uDDF4\uDDF6-\uDDFA\uDDFC\uDDFD\uDDFF])|\uD83C\uDDF0(?:\uD83C[\uDDEA\uDDEC-\uDDEE\uDDF2\uDDF3\uDDF5\uDDF7\uDDFC\uDDFE\uDDFF])|\uD83C\uDDED(?:\uD83C[\uDDF0\uDDF2\uDDF3\uDDF7\uDDF9\uDDFA])|\uD83C\uDDE9(?:\uD83C[\uDDEA\uDDEC\uDDEF\uDDF0\uDDF2\uDDF4\uDDFF])|\uD83C\uDDFE(?:\uD83C[\uDDEA\uDDF9])|\uD83C\uDDEC(?:\uD83C[\uDDE6\uDDE7\uDDE9-\uDDEE\uDDF1-\uDDF3\uDDF5-\uDDFA\uDDFC\uDDFE])|\uD83C\uDDF8(?:\uD83C[\uDDE6-\uDDEA\uDDEC-\uDDF4\uDDF7-\uDDF9\uDDFB\uDDFD-\uDDFF])|\uD83C\uDDEB(?:\uD83C[\uDDEE-\uDDF0\uDDF2\uDDF4\uDDF7])|\uD83C\uDDF5(?:\uD83C[\uDDE6\uDDEA-\uDDED\uDDF0-\uDDF3\uDDF7-\uDDF9\uDDFC\uDDFE])|\uD83C\uDDFB(?:\uD83C[\uDDE6\uDDE8\uDDEA\uDDEC\uDDEE\uDDF3\uDDFA])|\uD83C\uDDF3(?:\uD83C[\uDDE6\uDDE8\uDDEA-\uDDEC\uDDEE\uDDF1\uDDF4\uDDF5\uDDF7\uDDFA\uDDFF])|\uD83C\uDDE8(?:\uD83C[\uDDE6\uDDE8\uDDE9\uDDEB-\uDDEE\uDDF0-\uDDF5\uDDF7\uDDFA-\uDDFF])|\uD83C\uDDF1(?:\uD83C[\uDDE6-\uDDE8\uDDEE\uDDF0\uDDF7-\uDDFB\uDDFE])|\uD83C\uDDFF(?:\uD83C[\uDDE6\uDDF2\uDDFC])|\uD83C\uDDFC(?:\uD83C[\uDDEB\uDDF8])|\uD83C\uDDFA(?:\uD83C[\uDDE6\uDDEC\uDDF2\uDDF3\uDDF8\uDDFE\uDDFF])|\uD83C\uDDEE(?:\uD83C[\uDDE8-\uDDEA\uDDF1-\uDDF4\uDDF6-\uDDF9])|\uD83C\uDDEF(?:\uD83C[\uDDEA\uDDF2\uDDF4\uDDF5])|(?:\uD83C[\uDFC3\uDFC4\uDFCA]|\uD83D[\uDC6E\uDC71\uDC73\uDC77\uDC81\uDC82\uDC86\uDC87\uDE45-\uDE47\uDE4B\uDE4D\uDE4E\uDEA3\uDEB4-\uDEB6]|\uD83E[\uDD26\uDD37-\uDD39\uDD3D\uDD3E\uDDB8\uDDB9\uDDCD-\uDDCF\uDDD6-\uDDDD])(?:\uD83C[\uDFFB-\uDFFF])|(?:\u26F9|\uD83C[\uDFCB\uDFCC]|\uD83D\uDD75)(?:\uD83C[\uDFFB-\uDFFF])|(?:[\u261D\u270A-\u270D]|\uD83C[\uDF85\uDFC2\uDFC7]|\uD83D[\uDC42\uDC43\uDC46-\uDC50\uDC66\uDC67\uDC6B-\uDC6D\uDC70\uDC72\uDC74-\uDC76\uDC78\uDC7C\uDC83\uDC85\uDCAA\uDD74\uDD7A\uDD90\uDD95\uDD96\uDE4C\uDE4F\uDEC0\uDECC]|\uD83E[\uDD0F\uDD18-\uDD1C\uDD1E\uDD1F\uDD30-\uDD36\uDDB5\uDDB6\uDDBB\uDDD2-\uDDD5])(?:\uD83C[\uDFFB-\uDFFF])|(?:[\u231A\u231B\u23E9-\u23EC\u23F0\u23F3\u25FD\u25FE\u2614\u2615\u2648-\u2653\u267F\u2693\u26A1\u26AA\u26AB\u26BD\u26BE\u26C4\u26C5\u26CE\u26D4\u26EA\u26F2\u26F3\u26F5\u26FA\u26FD\u2705\u270A\u270B\u2728\u274C\u274E\u2753-\u2755\u2757\u2795-\u2797\u27B0\u27BF\u2B1B\u2B1C\u2B50\u2B55]|\uD83C[\uDC04\uDCCF\uDD8E\uDD91-\uDD9A\uDDE6-\uDDFF\uDE01\uDE1A\uDE2F\uDE32-\uDE36\uDE38-\uDE3A\uDE50\uDE51\uDF00-\uDF20\uDF2D-\uDF35\uDF37-\uDF7C\uDF7E-\uDF93\uDFA0-\uDFCA\uDFCF-\uDFD3\uDFE0-\uDFF0\uDFF4\uDFF8-\uDFFF]|\uD83D[\uDC00-\uDC3E\uDC40\uDC42-\uDCFC\uDCFF-\uDD3D\uDD4B-\uDD4E\uDD50-\uDD67\uDD7A\uDD95\uDD96\uDDA4\uDDFB-\uDE4F\uDE80-\uDEC5\uDECC\uDED0-\uDED2\uDED5\uDEEB\uDEEC\uDEF4-\uDEFA\uDFE0-\uDFEB]|\uD83E[\uDD0D-\uDD3A\uDD3C-\uDD45\uDD47-\uDD71\uDD73-\uDD76\uDD7A-\uDDA2\uDDA5-\uDDAA\uDDAE-\uDDCA\uDDCD-\uDDFF\uDE70-\uDE73\uDE78-\uDE7A\uDE80-\uDE82\uDE90-\uDE95])|(?:[#\*0-9\xA9\xAE\u203C\u2049\u2122\u2139\u2194-\u2199\u21A9\u21AA\u231A\u231B\u2328\u23CF\u23E9-\u23F3\u23F8-\u23FA\u24C2\u25AA\u25AB\u25B6\u25C0\u25FB-\u25FE\u2600-\u2604\u260E\u2611\u2614\u2615\u2618\u261D\u2620\u2622\u2623\u2626\u262A\u262E\u262F\u2638-\u263A\u2640\u2642\u2648-\u2653\u265F\u2660\u2663\u2665\u2666\u2668\u267B\u267E\u267F\u2692-\u2697\u2699\u269B\u269C\u26A0\u26A1\u26AA\u26AB\u26B0\u26B1\u26BD\u26BE\u26C4\u26C5\u26C8\u26CE\u26CF\u26D1\u26D3\u26D4\u26E9\u26EA\u26F0-\u26F5\u26F7-\u26FA\u26FD\u2702\u2705\u2708-\u270D\u270F\u2712\u2714\u2716\u271D\u2721\u2728\u2733\u2734\u2744\u2747\u274C\u274E\u2753-\u2755\u2757\u2763\u2764\u2795-\u2797\u27A1\u27B0\u27BF\u2934\u2935\u2B05-\u2B07\u2B1B\u2B1C\u2B50\u2B55\u3030\u303D\u3297\u3299]|\uD83C[\uDC04\uDCCF\uDD70\uDD71\uDD7E\uDD7F\uDD8E\uDD91-\uDD9A\uDDE6-\uDDFF\uDE01\uDE02\uDE1A\uDE2F\uDE32-\uDE3A\uDE50\uDE51\uDF00-\uDF21\uDF24-\uDF93\uDF96\uDF97\uDF99-\uDF9B\uDF9E-\uDFF0\uDFF3-\uDFF5\uDFF7-\uDFFF]|\uD83D[\uDC00-\uDCFD\uDCFF-\uDD3D\uDD49-\uDD4E\uDD50-\uDD67\uDD6F\uDD70\uDD73-\uDD7A\uDD87\uDD8A-\uDD8D\uDD90\uDD95\uDD96\uDDA4\uDDA5\uDDA8\uDDB1\uDDB2\uDDBC\uDDC2-\uDDC4\uDDD1-\uDDD3\uDDDC-\uDDDE\uDDE1\uDDE3\uDDE8\uDDEF\uDDF3\uDDFA-\uDE4F\uDE80-\uDEC5\uDECB-\uDED2\uDED5\uDEE0-\uDEE5\uDEE9\uDEEB\uDEEC\uDEF0\uDEF3-\uDEFA\uDFE0-\uDFEB]|\uD83E[\uDD0D-\uDD3A\uDD3C-\uDD45\uDD47-\uDD71\uDD73-\uDD76\uDD7A-\uDDA2\uDDA5-\uDDAA\uDDAE-\uDDCA\uDDCD-\uDDFF\uDE70-\uDE73\uDE78-\uDE7A\uDE80-\uDE82\uDE90-\uDE95])\uFE0F|(?:[\u261D\u26F9\u270A-\u270D]|\uD83C[\uDF85\uDFC2-\uDFC4\uDFC7\uDFCA-\uDFCC]|\uD83D[\uDC42\uDC43\uDC46-\uDC50\uDC66-\uDC78\uDC7C\uDC81-\uDC83\uDC85-\uDC87\uDC8F\uDC91\uDCAA\uDD74\uDD75\uDD7A\uDD90\uDD95\uDD96\uDE45-\uDE47\uDE4B-\uDE4F\uDEA3\uDEB4-\uDEB6\uDEC0\uDECC]|\uD83E[\uDD0F\uDD18-\uDD1F\uDD26\uDD30-\uDD39\uDD3C-\uDD3E\uDDB5\uDDB6\uDDB8\uDDB9\uDDBB\uDDCD-\uDDCF\uDDD1-\uDDDD])/g;
    };
  },
});

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/string-width@4.2.3/node_modules/string-width/index.js
var require_string_width = __commonJS({
  "../../../../.prototypes/trigger-dev/node_modules/.pnpm/string-width@4.2.3/node_modules/string-width/index.js"(
    exports,
    module,
  ) {
    "use strict";
    init_esm();
    var stripAnsi = require_strip_ansi();
    var isFullwidthCodePoint = require_is_fullwidth_code_point();
    var emojiRegex = require_emoji_regex();
    var stringWidth = /* @__PURE__ */ __name((string) => {
      if (typeof string !== "string" || string.length === 0) {
        return 0;
      }
      string = stripAnsi(string);
      if (string.length === 0) {
        return 0;
      }
      string = string.replace(emojiRegex(), "  ");
      let width = 0;
      for (let i = 0; i < string.length; i++) {
        const code = string.codePointAt(i);
        if (code <= 31 || (code >= 127 && code <= 159)) {
          continue;
        }
        if (code >= 768 && code <= 879) {
          continue;
        }
        if (code > 65535) {
          i++;
        }
        width += isFullwidthCodePoint(code) ? 2 : 1;
      }
      return width;
    }, "stringWidth");
    module.exports = stringWidth;
    module.exports.default = stringWidth;
  },
});

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/cli-table3@0.6.5/node_modules/cli-table3/src/utils.js
var require_utils = __commonJS({
  "../../../../.prototypes/trigger-dev/node_modules/.pnpm/cli-table3@0.6.5/node_modules/cli-table3/src/utils.js"(
    exports,
    module,
  ) {
    init_esm();
    var stringWidth = require_string_width();
    function codeRegex(capture) {
      return capture ? /\u001b\[((?:\d*;){0,5}\d*)m/g : /\u001b\[(?:\d*;){0,5}\d*m/g;
    }
    __name(codeRegex, "codeRegex");
    function strlen(str) {
      let code = codeRegex();
      let stripped = ("" + str).replace(code, "");
      let split = stripped.split("\n");
      return split.reduce(function (memo, s) {
        return stringWidth(s) > memo ? stringWidth(s) : memo;
      }, 0);
    }
    __name(strlen, "strlen");
    function repeat(str, times) {
      return Array(times + 1).join(str);
    }
    __name(repeat, "repeat");
    function pad(str, len, pad2, dir) {
      let length = strlen(str);
      if (len + 1 >= length) {
        let padlen = len - length;
        switch (dir) {
          case "right": {
            str = repeat(pad2, padlen) + str;
            break;
          }
          case "center": {
            let right = Math.ceil(padlen / 2);
            let left = padlen - right;
            str = repeat(pad2, left) + str + repeat(pad2, right);
            break;
          }
          default: {
            str = str + repeat(pad2, padlen);
            break;
          }
        }
      }
      return str;
    }
    __name(pad, "pad");
    var codeCache = {};
    function addToCodeCache(name, on, off) {
      on = "\x1B[" + on + "m";
      off = "\x1B[" + off + "m";
      codeCache[on] = { set: name, to: true };
      codeCache[off] = { set: name, to: false };
      codeCache[name] = { on, off };
    }
    __name(addToCodeCache, "addToCodeCache");
    addToCodeCache("bold", 1, 22);
    addToCodeCache("italics", 3, 23);
    addToCodeCache("underline", 4, 24);
    addToCodeCache("inverse", 7, 27);
    addToCodeCache("strikethrough", 9, 29);
    function updateState(state, controlChars) {
      let controlCode = controlChars[1] ? parseInt(controlChars[1].split(";")[0]) : 0;
      if ((controlCode >= 30 && controlCode <= 39) || (controlCode >= 90 && controlCode <= 97)) {
        state.lastForegroundAdded = controlChars[0];
        return;
      }
      if ((controlCode >= 40 && controlCode <= 49) || (controlCode >= 100 && controlCode <= 107)) {
        state.lastBackgroundAdded = controlChars[0];
        return;
      }
      if (controlCode === 0) {
        for (let i in state) {
          if (Object.prototype.hasOwnProperty.call(state, i)) {
            delete state[i];
          }
        }
        return;
      }
      let info = codeCache[controlChars[0]];
      if (info) {
        state[info.set] = info.to;
      }
    }
    __name(updateState, "updateState");
    function readState(line) {
      let code = codeRegex(true);
      let controlChars = code.exec(line);
      let state = {};
      while (controlChars !== null) {
        updateState(state, controlChars);
        controlChars = code.exec(line);
      }
      return state;
    }
    __name(readState, "readState");
    function unwindState(state, ret) {
      let lastBackgroundAdded = state.lastBackgroundAdded;
      let lastForegroundAdded = state.lastForegroundAdded;
      delete state.lastBackgroundAdded;
      delete state.lastForegroundAdded;
      Object.keys(state).forEach(function (key) {
        if (state[key]) {
          ret += codeCache[key].off;
        }
      });
      if (lastBackgroundAdded && lastBackgroundAdded != "\x1B[49m") {
        ret += "\x1B[49m";
      }
      if (lastForegroundAdded && lastForegroundAdded != "\x1B[39m") {
        ret += "\x1B[39m";
      }
      return ret;
    }
    __name(unwindState, "unwindState");
    function rewindState(state, ret) {
      let lastBackgroundAdded = state.lastBackgroundAdded;
      let lastForegroundAdded = state.lastForegroundAdded;
      delete state.lastBackgroundAdded;
      delete state.lastForegroundAdded;
      Object.keys(state).forEach(function (key) {
        if (state[key]) {
          ret = codeCache[key].on + ret;
        }
      });
      if (lastBackgroundAdded && lastBackgroundAdded != "\x1B[49m") {
        ret = lastBackgroundAdded + ret;
      }
      if (lastForegroundAdded && lastForegroundAdded != "\x1B[39m") {
        ret = lastForegroundAdded + ret;
      }
      return ret;
    }
    __name(rewindState, "rewindState");
    function truncateWidth(str, desiredLength) {
      if (str.length === strlen(str)) {
        return str.substr(0, desiredLength);
      }
      while (strlen(str) > desiredLength) {
        str = str.slice(0, -1);
      }
      return str;
    }
    __name(truncateWidth, "truncateWidth");
    function truncateWidthWithAnsi(str, desiredLength) {
      let code = codeRegex(true);
      let split = str.split(codeRegex());
      let splitIndex = 0;
      let retLen = 0;
      let ret = "";
      let myArray;
      let state = {};
      while (retLen < desiredLength) {
        myArray = code.exec(str);
        let toAdd = split[splitIndex];
        splitIndex++;
        if (retLen + strlen(toAdd) > desiredLength) {
          toAdd = truncateWidth(toAdd, desiredLength - retLen);
        }
        ret += toAdd;
        retLen += strlen(toAdd);
        if (retLen < desiredLength) {
          if (!myArray) {
            break;
          }
          ret += myArray[0];
          updateState(state, myArray);
        }
      }
      return unwindState(state, ret);
    }
    __name(truncateWidthWithAnsi, "truncateWidthWithAnsi");
    function truncate(str, desiredLength, truncateChar) {
      truncateChar = truncateChar || "…";
      let lengthOfStr = strlen(str);
      if (lengthOfStr <= desiredLength) {
        return str;
      }
      desiredLength -= strlen(truncateChar);
      let ret = truncateWidthWithAnsi(str, desiredLength);
      ret += truncateChar;
      const hrefTag = "\x1B]8;;\x07";
      if (str.includes(hrefTag) && !ret.includes(hrefTag)) {
        ret += hrefTag;
      }
      return ret;
    }
    __name(truncate, "truncate");
    function defaultOptions() {
      return {
        chars: {
          top: "─",
          "top-mid": "┬",
          "top-left": "┌",
          "top-right": "┐",
          bottom: "─",
          "bottom-mid": "┴",
          "bottom-left": "└",
          "bottom-right": "┘",
          left: "│",
          "left-mid": "├",
          mid: "─",
          "mid-mid": "┼",
          right: "│",
          "right-mid": "┤",
          middle: "│",
        },
        truncate: "…",
        colWidths: [],
        rowHeights: [],
        colAligns: [],
        rowAligns: [],
        style: {
          "padding-left": 1,
          "padding-right": 1,
          head: ["red"],
          border: ["grey"],
          compact: false,
        },
        head: [],
      };
    }
    __name(defaultOptions, "defaultOptions");
    function mergeOptions(options, defaults) {
      options = options || {};
      defaults = defaults || defaultOptions();
      let ret = Object.assign({}, defaults, options);
      ret.chars = Object.assign({}, defaults.chars, options.chars);
      ret.style = Object.assign({}, defaults.style, options.style);
      return ret;
    }
    __name(mergeOptions, "mergeOptions");
    function wordWrap(maxLength, input) {
      let lines = [];
      let split = input.split(/(\s+)/g);
      let line = [];
      let lineLength = 0;
      let whitespace;
      for (let i = 0; i < split.length; i += 2) {
        let word = split[i];
        let newLength = lineLength + strlen(word);
        if (lineLength > 0 && whitespace) {
          newLength += whitespace.length;
        }
        if (newLength > maxLength) {
          if (lineLength !== 0) {
            lines.push(line.join(""));
          }
          line = [word];
          lineLength = strlen(word);
        } else {
          line.push(whitespace || "", word);
          lineLength = newLength;
        }
        whitespace = split[i + 1];
      }
      if (lineLength) {
        lines.push(line.join(""));
      }
      return lines;
    }
    __name(wordWrap, "wordWrap");
    function textWrap(maxLength, input) {
      let lines = [];
      let line = "";
      function pushLine(str, ws) {
        if (line.length && ws) line += ws;
        line += str;
        while (line.length > maxLength) {
          lines.push(line.slice(0, maxLength));
          line = line.slice(maxLength);
        }
      }
      __name(pushLine, "pushLine");
      let split = input.split(/(\s+)/g);
      for (let i = 0; i < split.length; i += 2) {
        pushLine(split[i], i && split[i - 1]);
      }
      if (line.length) lines.push(line);
      return lines;
    }
    __name(textWrap, "textWrap");
    function multiLineWordWrap(maxLength, input, wrapOnWordBoundary = true) {
      let output = [];
      input = input.split("\n");
      const handler = wrapOnWordBoundary ? wordWrap : textWrap;
      for (let i = 0; i < input.length; i++) {
        output.push.apply(output, handler(maxLength, input[i]));
      }
      return output;
    }
    __name(multiLineWordWrap, "multiLineWordWrap");
    function colorizeLines(input) {
      let state = {};
      let output = [];
      for (let i = 0; i < input.length; i++) {
        let line = rewindState(state, input[i]);
        state = readState(line);
        let temp = Object.assign({}, state);
        output.push(unwindState(temp, line));
      }
      return output;
    }
    __name(colorizeLines, "colorizeLines");
    function hyperlink(url, text) {
      const OSC = "\x1B]";
      const BEL = "\x07";
      const SEP = ";";
      return [OSC, "8", SEP, SEP, url || text, BEL, text, OSC, "8", SEP, SEP, BEL].join("");
    }
    __name(hyperlink, "hyperlink");
    module.exports = {
      strlen,
      repeat,
      pad,
      truncate,
      mergeOptions,
      wordWrap: multiLineWordWrap,
      colorizeLines,
      hyperlink,
    };
  },
});

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/@colors+colors@1.5.0/node_modules/@colors/colors/lib/styles.js
var require_styles = __commonJS({
  "../../../../.prototypes/trigger-dev/node_modules/.pnpm/@colors+colors@1.5.0/node_modules/@colors/colors/lib/styles.js"(
    exports,
    module,
  ) {
    init_esm();
    var styles3 = {};
    module["exports"] = styles3;
    var codes = {
      reset: [0, 0],
      bold: [1, 22],
      dim: [2, 22],
      italic: [3, 23],
      underline: [4, 24],
      inverse: [7, 27],
      hidden: [8, 28],
      strikethrough: [9, 29],
      black: [30, 39],
      red: [31, 39],
      green: [32, 39],
      yellow: [33, 39],
      blue: [34, 39],
      magenta: [35, 39],
      cyan: [36, 39],
      white: [37, 39],
      gray: [90, 39],
      grey: [90, 39],
      brightRed: [91, 39],
      brightGreen: [92, 39],
      brightYellow: [93, 39],
      brightBlue: [94, 39],
      brightMagenta: [95, 39],
      brightCyan: [96, 39],
      brightWhite: [97, 39],
      bgBlack: [40, 49],
      bgRed: [41, 49],
      bgGreen: [42, 49],
      bgYellow: [43, 49],
      bgBlue: [44, 49],
      bgMagenta: [45, 49],
      bgCyan: [46, 49],
      bgWhite: [47, 49],
      bgGray: [100, 49],
      bgGrey: [100, 49],
      bgBrightRed: [101, 49],
      bgBrightGreen: [102, 49],
      bgBrightYellow: [103, 49],
      bgBrightBlue: [104, 49],
      bgBrightMagenta: [105, 49],
      bgBrightCyan: [106, 49],
      bgBrightWhite: [107, 49],
      // legacy styles for colors pre v1.0.0
      blackBG: [40, 49],
      redBG: [41, 49],
      greenBG: [42, 49],
      yellowBG: [43, 49],
      blueBG: [44, 49],
      magentaBG: [45, 49],
      cyanBG: [46, 49],
      whiteBG: [47, 49],
    };
    Object.keys(codes).forEach(function (key) {
      var val = codes[key];
      var style = (styles3[key] = []);
      style.open = "\x1B[" + val[0] + "m";
      style.close = "\x1B[" + val[1] + "m";
    });
  },
});

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/@colors+colors@1.5.0/node_modules/@colors/colors/lib/system/has-flag.js
var require_has_flag = __commonJS({
  "../../../../.prototypes/trigger-dev/node_modules/.pnpm/@colors+colors@1.5.0/node_modules/@colors/colors/lib/system/has-flag.js"(
    exports,
    module,
  ) {
    "use strict";
    init_esm();
    module.exports = function (flag, argv) {
      argv = argv || process.argv;
      var terminatorPos = argv.indexOf("--");
      var prefix = /^-{1,2}/.test(flag) ? "" : "--";
      var pos = argv.indexOf(prefix + flag);
      return pos !== -1 && (terminatorPos === -1 ? true : pos < terminatorPos);
    };
  },
});

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/@colors+colors@1.5.0/node_modules/@colors/colors/lib/system/supports-colors.js
var require_supports_colors = __commonJS({
  "../../../../.prototypes/trigger-dev/node_modules/.pnpm/@colors+colors@1.5.0/node_modules/@colors/colors/lib/system/supports-colors.js"(
    exports,
    module,
  ) {
    "use strict";
    init_esm();
    var os2 = __require("os");
    var hasFlag2 = require_has_flag();
    var env2 = process.env;
    var forceColor = void 0;
    if (hasFlag2("no-color") || hasFlag2("no-colors") || hasFlag2("color=false")) {
      forceColor = false;
    } else if (
      hasFlag2("color") ||
      hasFlag2("colors") ||
      hasFlag2("color=true") ||
      hasFlag2("color=always")
    ) {
      forceColor = true;
    }
    if ("FORCE_COLOR" in env2) {
      forceColor = env2.FORCE_COLOR.length === 0 || parseInt(env2.FORCE_COLOR, 10) !== 0;
    }
    function translateLevel2(level) {
      if (level === 0) {
        return false;
      }
      return {
        level,
        hasBasic: true,
        has256: level >= 2,
        has16m: level >= 3,
      };
    }
    __name(translateLevel2, "translateLevel");
    function supportsColor2(stream) {
      if (forceColor === false) {
        return 0;
      }
      if (hasFlag2("color=16m") || hasFlag2("color=full") || hasFlag2("color=truecolor")) {
        return 3;
      }
      if (hasFlag2("color=256")) {
        return 2;
      }
      if (stream && !stream.isTTY && forceColor !== true) {
        return 0;
      }
      var min = forceColor ? 1 : 0;
      if (process.platform === "win32") {
        var osRelease = os2.release().split(".");
        if (
          Number(process.versions.node.split(".")[0]) >= 8 &&
          Number(osRelease[0]) >= 10 &&
          Number(osRelease[2]) >= 10586
        ) {
          return Number(osRelease[2]) >= 14931 ? 3 : 2;
        }
        return 1;
      }
      if ("CI" in env2) {
        if (
          ["TRAVIS", "CIRCLECI", "APPVEYOR", "GITLAB_CI"].some(function (sign) {
            return sign in env2;
          }) ||
          env2.CI_NAME === "codeship"
        ) {
          return 1;
        }
        return min;
      }
      if ("TEAMCITY_VERSION" in env2) {
        return /^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/.test(env2.TEAMCITY_VERSION) ? 1 : 0;
      }
      if ("TERM_PROGRAM" in env2) {
        var version = parseInt((env2.TERM_PROGRAM_VERSION || "").split(".")[0], 10);
        switch (env2.TERM_PROGRAM) {
          case "iTerm.app":
            return version >= 3 ? 3 : 2;
          case "Hyper":
            return 3;
          case "Apple_Terminal":
            return 2;
        }
      }
      if (/-256(color)?$/i.test(env2.TERM)) {
        return 2;
      }
      if (/^screen|^xterm|^vt100|^rxvt|color|ansi|cygwin|linux/i.test(env2.TERM)) {
        return 1;
      }
      if ("COLORTERM" in env2) {
        return 1;
      }
      if (env2.TERM === "dumb") {
        return min;
      }
      return min;
    }
    __name(supportsColor2, "supportsColor");
    function getSupportLevel(stream) {
      var level = supportsColor2(stream);
      return translateLevel2(level);
    }
    __name(getSupportLevel, "getSupportLevel");
    module.exports = {
      supportsColor: getSupportLevel,
      stdout: getSupportLevel(process.stdout),
      stderr: getSupportLevel(process.stderr),
    };
  },
});

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/@colors+colors@1.5.0/node_modules/@colors/colors/lib/custom/trap.js
var require_trap = __commonJS({
  "../../../../.prototypes/trigger-dev/node_modules/.pnpm/@colors+colors@1.5.0/node_modules/@colors/colors/lib/custom/trap.js"(
    exports,
    module,
  ) {
    init_esm();
    module["exports"] = /* @__PURE__ */ __name(function runTheTrap(text, options) {
      var result = "";
      text = text || "Run the trap, drop the bass";
      text = text.split("");
      var trap = {
        a: ["@", "Ą", "Ⱥ", "Ʌ", "Δ", "Λ", "Д"],
        b: ["ß", "Ɓ", "Ƀ", "ɮ", "β", "฿"],
        c: ["©", "Ȼ", "Ͼ"],
        d: ["Ð", "Ɗ", "Ԁ", "ԁ", "Ԃ", "ԃ"],
        e: ["Ë", "ĕ", "Ǝ", "ɘ", "Σ", "ξ", "Ҽ", "੬"],
        f: ["Ӻ"],
        g: ["ɢ"],
        h: ["Ħ", "ƕ", "Ң", "Һ", "Ӈ", "Ԋ"],
        i: ["༏"],
        j: ["Ĵ"],
        k: ["ĸ", "Ҡ", "Ӄ", "Ԟ"],
        l: ["Ĺ"],
        m: ["ʍ", "Ӎ", "ӎ", "Ԡ", "ԡ", "൩"],
        n: ["Ñ", "ŋ", "Ɲ", "Ͷ", "Π", "Ҋ"],
        o: ["Ø", "õ", "ø", "Ǿ", "ʘ", "Ѻ", "ם", "۝", "๏"],
        p: ["Ƿ", "Ҏ"],
        q: ["্"],
        r: ["®", "Ʀ", "Ȑ", "Ɍ", "ʀ", "Я"],
        s: ["§", "Ϟ", "ϟ", "Ϩ"],
        t: ["Ł", "Ŧ", "ͳ"],
        u: ["Ʊ", "Ս"],
        v: ["ט"],
        w: ["Ш", "Ѡ", "Ѽ", "൰"],
        x: ["Ҳ", "Ӿ", "Ӽ", "ӽ"],
        y: ["¥", "Ұ", "Ӌ"],
        z: ["Ƶ", "ɀ"],
      };
      text.forEach(function (c) {
        c = c.toLowerCase();
        var chars = trap[c] || [" "];
        var rand = Math.floor(Math.random() * chars.length);
        if (typeof trap[c] !== "undefined") {
          result += trap[c][rand];
        } else {
          result += c;
        }
      });
      return result;
    }, "runTheTrap");
  },
});

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/@colors+colors@1.5.0/node_modules/@colors/colors/lib/custom/zalgo.js
var require_zalgo = __commonJS({
  "../../../../.prototypes/trigger-dev/node_modules/.pnpm/@colors+colors@1.5.0/node_modules/@colors/colors/lib/custom/zalgo.js"(
    exports,
    module,
  ) {
    init_esm();
    module["exports"] = /* @__PURE__ */ __name(function zalgo(text, options) {
      text = text || "   he is here   ";
      var soul = {
        up: [
          "̍",
          "̎",
          "̄",
          "̅",
          "̿",
          "̑",
          "̆",
          "̐",
          "͒",
          "͗",
          "͑",
          "̇",
          "̈",
          "̊",
          "͂",
          "̓",
          "̈",
          "͊",
          "͋",
          "͌",
          "̃",
          "̂",
          "̌",
          "͐",
          "̀",
          "́",
          "̋",
          "̏",
          "̒",
          "̓",
          "̔",
          "̽",
          "̉",
          "ͣ",
          "ͤ",
          "ͥ",
          "ͦ",
          "ͧ",
          "ͨ",
          "ͩ",
          "ͪ",
          "ͫ",
          "ͬ",
          "ͭ",
          "ͮ",
          "ͯ",
          "̾",
          "͛",
          "͆",
          "̚",
        ],
        down: [
          "̖",
          "̗",
          "̘",
          "̙",
          "̜",
          "̝",
          "̞",
          "̟",
          "̠",
          "̤",
          "̥",
          "̦",
          "̩",
          "̪",
          "̫",
          "̬",
          "̭",
          "̮",
          "̯",
          "̰",
          "̱",
          "̲",
          "̳",
          "̹",
          "̺",
          "̻",
          "̼",
          "ͅ",
          "͇",
          "͈",
          "͉",
          "͍",
          "͎",
          "͓",
          "͔",
          "͕",
          "͖",
          "͙",
          "͚",
          "̣",
        ],
        mid: [
          "̕",
          "̛",
          "̀",
          "́",
          "͘",
          "̡",
          "̢",
          "̧",
          "̨",
          "̴",
          "̵",
          "̶",
          "͜",
          "͝",
          "͞",
          "͟",
          "͠",
          "͢",
          "̸",
          "̷",
          "͡",
          " ҉",
        ],
      };
      var all = [].concat(soul.up, soul.down, soul.mid);
      function randomNumber(range) {
        var r = Math.floor(Math.random() * range);
        return r;
      }
      __name(randomNumber, "randomNumber");
      function isChar(character) {
        var bool = false;
        all.filter(function (i) {
          bool = i === character;
        });
        return bool;
      }
      __name(isChar, "isChar");
      function heComes(text2, options2) {
        var result = "";
        var counts;
        var l;
        options2 = options2 || {};
        options2["up"] = typeof options2["up"] !== "undefined" ? options2["up"] : true;
        options2["mid"] = typeof options2["mid"] !== "undefined" ? options2["mid"] : true;
        options2["down"] = typeof options2["down"] !== "undefined" ? options2["down"] : true;
        options2["size"] = typeof options2["size"] !== "undefined" ? options2["size"] : "maxi";
        text2 = text2.split("");
        for (l in text2) {
          if (isChar(l)) {
            continue;
          }
          result = result + text2[l];
          counts = { up: 0, down: 0, mid: 0 };
          switch (options2.size) {
            case "mini":
              counts.up = randomNumber(8);
              counts.mid = randomNumber(2);
              counts.down = randomNumber(8);
              break;
            case "maxi":
              counts.up = randomNumber(16) + 3;
              counts.mid = randomNumber(4) + 1;
              counts.down = randomNumber(64) + 3;
              break;
            default:
              counts.up = randomNumber(8) + 1;
              counts.mid = randomNumber(6) / 2;
              counts.down = randomNumber(8) + 1;
              break;
          }
          var arr = ["up", "mid", "down"];
          for (var d in arr) {
            var index = arr[d];
            for (var i = 0; i <= counts[index]; i++) {
              if (options2[index]) {
                result = result + soul[index][randomNumber(soul[index].length)];
              }
            }
          }
        }
        return result;
      }
      __name(heComes, "heComes");
      return heComes(text, options);
    }, "zalgo");
  },
});

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/@colors+colors@1.5.0/node_modules/@colors/colors/lib/maps/america.js
var require_america = __commonJS({
  "../../../../.prototypes/trigger-dev/node_modules/.pnpm/@colors+colors@1.5.0/node_modules/@colors/colors/lib/maps/america.js"(
    exports,
    module,
  ) {
    init_esm();
    module["exports"] = function (colors) {
      return function (letter, i, exploded) {
        if (letter === " ") return letter;
        switch (i % 3) {
          case 0:
            return colors.red(letter);
          case 1:
            return colors.white(letter);
          case 2:
            return colors.blue(letter);
        }
      };
    };
  },
});

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/@colors+colors@1.5.0/node_modules/@colors/colors/lib/maps/zebra.js
var require_zebra = __commonJS({
  "../../../../.prototypes/trigger-dev/node_modules/.pnpm/@colors+colors@1.5.0/node_modules/@colors/colors/lib/maps/zebra.js"(
    exports,
    module,
  ) {
    init_esm();
    module["exports"] = function (colors) {
      return function (letter, i, exploded) {
        return i % 2 === 0 ? letter : colors.inverse(letter);
      };
    };
  },
});

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/@colors+colors@1.5.0/node_modules/@colors/colors/lib/maps/rainbow.js
var require_rainbow = __commonJS({
  "../../../../.prototypes/trigger-dev/node_modules/.pnpm/@colors+colors@1.5.0/node_modules/@colors/colors/lib/maps/rainbow.js"(
    exports,
    module,
  ) {
    init_esm();
    module["exports"] = function (colors) {
      var rainbowColors = ["red", "yellow", "green", "blue", "magenta"];
      return function (letter, i, exploded) {
        if (letter === " ") {
          return letter;
        } else {
          return colors[rainbowColors[i++ % rainbowColors.length]](letter);
        }
      };
    };
  },
});

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/@colors+colors@1.5.0/node_modules/@colors/colors/lib/maps/random.js
var require_random = __commonJS({
  "../../../../.prototypes/trigger-dev/node_modules/.pnpm/@colors+colors@1.5.0/node_modules/@colors/colors/lib/maps/random.js"(
    exports,
    module,
  ) {
    init_esm();
    module["exports"] = function (colors) {
      var available = [
        "underline",
        "inverse",
        "grey",
        "yellow",
        "red",
        "green",
        "blue",
        "white",
        "cyan",
        "magenta",
        "brightYellow",
        "brightRed",
        "brightGreen",
        "brightBlue",
        "brightWhite",
        "brightCyan",
        "brightMagenta",
      ];
      return function (letter, i, exploded) {
        return letter === " "
          ? letter
          : colors[available[Math.round(Math.random() * (available.length - 2))]](letter);
      };
    };
  },
});

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/@colors+colors@1.5.0/node_modules/@colors/colors/lib/colors.js
var require_colors = __commonJS({
  "../../../../.prototypes/trigger-dev/node_modules/.pnpm/@colors+colors@1.5.0/node_modules/@colors/colors/lib/colors.js"(
    exports,
    module,
  ) {
    init_esm();
    var colors = {};
    module["exports"] = colors;
    colors.themes = {};
    var util = __require("util");
    var ansiStyles2 = (colors.styles = require_styles());
    var defineProps = Object.defineProperties;
    var newLineRegex = new RegExp(/[\r\n]+/g);
    colors.supportsColor = require_supports_colors().supportsColor;
    if (typeof colors.enabled === "undefined") {
      colors.enabled = colors.supportsColor() !== false;
    }
    colors.enable = function () {
      colors.enabled = true;
    };
    colors.disable = function () {
      colors.enabled = false;
    };
    colors.stripColors = colors.strip = function (str) {
      return ("" + str).replace(/\x1B\[\d+m/g, "");
    };
    var stylize = (colors.stylize = /* @__PURE__ */ __name(function stylize2(str, style) {
      if (!colors.enabled) {
        return str + "";
      }
      var styleMap = ansiStyles2[style];
      if (!styleMap && style in colors) {
        return colors[style](str);
      }
      return styleMap.open + str + styleMap.close;
    }, "stylize"));
    var matchOperatorsRe = /[|\\{}()[\]^$+*?.]/g;
    var escapeStringRegexp = /* @__PURE__ */ __name(function (str) {
      if (typeof str !== "string") {
        throw new TypeError("Expected a string");
      }
      return str.replace(matchOperatorsRe, "\\$&");
    }, "escapeStringRegexp");
    function build(_styles) {
      var builder = /* @__PURE__ */ __name(function builder2() {
        return applyStyle2.apply(builder2, arguments);
      }, "builder");
      builder._styles = _styles;
      builder.__proto__ = proto2;
      return builder;
    }
    __name(build, "build");
    var styles3 = (function () {
      var ret = {};
      ansiStyles2.grey = ansiStyles2.gray;
      Object.keys(ansiStyles2).forEach(function (key) {
        ansiStyles2[key].closeRe = new RegExp(escapeStringRegexp(ansiStyles2[key].close), "g");
        ret[key] = {
          get: /* @__PURE__ */ __name(function () {
            return build(this._styles.concat(key));
          }, "get"),
        };
      });
      return ret;
    })();
    var proto2 = defineProps(
      /* @__PURE__ */ __name(function colors2() {}, "colors"),
      styles3,
    );
    function applyStyle2() {
      var args = Array.prototype.slice.call(arguments);
      var str = args
        .map(function (arg) {
          if (arg != null && arg.constructor === String) {
            return arg;
          } else {
            return util.inspect(arg);
          }
        })
        .join(" ");
      if (!colors.enabled || !str) {
        return str;
      }
      var newLinesPresent = str.indexOf("\n") != -1;
      var nestedStyles = this._styles;
      var i = nestedStyles.length;
      while (i--) {
        var code = ansiStyles2[nestedStyles[i]];
        str = code.open + str.replace(code.closeRe, code.open) + code.close;
        if (newLinesPresent) {
          str = str.replace(newLineRegex, function (match) {
            return code.close + match + code.open;
          });
        }
      }
      return str;
    }
    __name(applyStyle2, "applyStyle");
    colors.setTheme = function (theme) {
      if (typeof theme === "string") {
        console.log(
          "colors.setTheme now only accepts an object, not a string.  If you are trying to set a theme from a file, it is now your (the caller's) responsibility to require the file.  The old syntax looked like colors.setTheme(__dirname + '/../themes/generic-logging.js'); The new syntax looks like colors.setTheme(require(__dirname + '/../themes/generic-logging.js'));",
        );
        return;
      }
      for (var style in theme) {
        (function (style2) {
          colors[style2] = function (str) {
            if (typeof theme[style2] === "object") {
              var out = str;
              for (var i in theme[style2]) {
                out = colors[theme[style2][i]](out);
              }
              return out;
            }
            return colors[theme[style2]](str);
          };
        })(style);
      }
    };
    function init() {
      var ret = {};
      Object.keys(styles3).forEach(function (name) {
        ret[name] = {
          get: /* @__PURE__ */ __name(function () {
            return build([name]);
          }, "get"),
        };
      });
      return ret;
    }
    __name(init, "init");
    var sequencer = /* @__PURE__ */ __name(function sequencer2(map2, str) {
      var exploded = str.split("");
      exploded = exploded.map(map2);
      return exploded.join("");
    }, "sequencer");
    colors.trap = require_trap();
    colors.zalgo = require_zalgo();
    colors.maps = {};
    colors.maps.america = require_america()(colors);
    colors.maps.zebra = require_zebra()(colors);
    colors.maps.rainbow = require_rainbow()(colors);
    colors.maps.random = require_random()(colors);
    for (map in colors.maps) {
      (function (map2) {
        colors[map2] = function (str) {
          return sequencer(colors.maps[map2], str);
        };
      })(map);
    }
    var map;
    defineProps(colors, init());
  },
});

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/@colors+colors@1.5.0/node_modules/@colors/colors/safe.js
var require_safe = __commonJS({
  "../../../../.prototypes/trigger-dev/node_modules/.pnpm/@colors+colors@1.5.0/node_modules/@colors/colors/safe.js"(
    exports,
    module,
  ) {
    init_esm();
    var colors = require_colors();
    module["exports"] = colors;
  },
});

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/cli-table3@0.6.5/node_modules/cli-table3/src/cell.js
var require_cell = __commonJS({
  "../../../../.prototypes/trigger-dev/node_modules/.pnpm/cli-table3@0.6.5/node_modules/cli-table3/src/cell.js"(
    exports,
    module,
  ) {
    init_esm();
    var { info, debug } = require_debug();
    var utils = require_utils();
    var Cell = class _Cell {
      static {
        __name(this, "Cell");
      }
      /**
       * A representation of a cell within the table.
       * Implementations must have `init` and `draw` methods,
       * as well as `colSpan`, `rowSpan`, `desiredHeight` and `desiredWidth` properties.
       * @param options
       * @constructor
       */
      constructor(options) {
        this.setOptions(options);
        this.x = null;
        this.y = null;
      }
      setOptions(options) {
        if (["boolean", "number", "bigint", "string"].indexOf(typeof options) !== -1) {
          options = { content: "" + options };
        }
        options = options || {};
        this.options = options;
        let content = options.content;
        if (["boolean", "number", "bigint", "string"].indexOf(typeof content) !== -1) {
          this.content = String(content);
        } else if (!content) {
          this.content = this.options.href || "";
        } else {
          throw new Error("Content needs to be a primitive, got: " + typeof content);
        }
        this.colSpan = options.colSpan || 1;
        this.rowSpan = options.rowSpan || 1;
        if (this.options.href) {
          Object.defineProperty(this, "href", {
            get() {
              return this.options.href;
            },
          });
        }
      }
      mergeTableOptions(tableOptions, cells) {
        this.cells = cells;
        let optionsChars = this.options.chars || {};
        let tableChars = tableOptions.chars;
        let chars = (this.chars = {});
        CHAR_NAMES.forEach(function (name) {
          setOption(optionsChars, tableChars, name, chars);
        });
        this.truncate = this.options.truncate || tableOptions.truncate;
        let style = (this.options.style = this.options.style || {});
        let tableStyle = tableOptions.style;
        setOption(style, tableStyle, "padding-left", this);
        setOption(style, tableStyle, "padding-right", this);
        this.head = style.head || tableStyle.head;
        this.border = style.border || tableStyle.border;
        this.fixedWidth = tableOptions.colWidths[this.x];
        this.lines = this.computeLines(tableOptions);
        this.desiredWidth = utils.strlen(this.content) + this.paddingLeft + this.paddingRight;
        this.desiredHeight = this.lines.length;
      }
      computeLines(tableOptions) {
        const tableWordWrap = tableOptions.wordWrap || tableOptions.textWrap;
        const { wordWrap = tableWordWrap } = this.options;
        if (this.fixedWidth && wordWrap) {
          this.fixedWidth -= this.paddingLeft + this.paddingRight;
          if (this.colSpan) {
            let i = 1;
            while (i < this.colSpan) {
              this.fixedWidth += tableOptions.colWidths[this.x + i];
              i++;
            }
          }
          const { wrapOnWordBoundary: tableWrapOnWordBoundary = true } = tableOptions;
          const { wrapOnWordBoundary = tableWrapOnWordBoundary } = this.options;
          return this.wrapLines(utils.wordWrap(this.fixedWidth, this.content, wrapOnWordBoundary));
        }
        return this.wrapLines(this.content.split("\n"));
      }
      wrapLines(computedLines) {
        const lines = utils.colorizeLines(computedLines);
        if (this.href) {
          return lines.map((line) => utils.hyperlink(this.href, line));
        }
        return lines;
      }
      /**
       * Initializes the Cells data structure.
       *
       * @param tableOptions - A fully populated set of tableOptions.
       * In addition to the standard default values, tableOptions must have fully populated the
       * `colWidths` and `rowWidths` arrays. Those arrays must have lengths equal to the number
       * of columns or rows (respectively) in this table, and each array item must be a Number.
       *
       */
      init(tableOptions) {
        let x = this.x;
        let y = this.y;
        this.widths = tableOptions.colWidths.slice(x, x + this.colSpan);
        this.heights = tableOptions.rowHeights.slice(y, y + this.rowSpan);
        this.width = this.widths.reduce(sumPlusOne, -1);
        this.height = this.heights.reduce(sumPlusOne, -1);
        this.hAlign = this.options.hAlign || tableOptions.colAligns[x];
        this.vAlign = this.options.vAlign || tableOptions.rowAligns[y];
        this.drawRight = x + this.colSpan == tableOptions.colWidths.length;
      }
      /**
       * Draws the given line of the cell.
       * This default implementation defers to methods `drawTop`, `drawBottom`, `drawLine` and `drawEmpty`.
       * @param lineNum - can be `top`, `bottom` or a numerical line number.
       * @param spanningCell - will be a number if being called from a RowSpanCell, and will represent how
       * many rows below it's being called from. Otherwise it's undefined.
       * @returns {String} The representation of this line.
       */
      draw(lineNum, spanningCell) {
        if (lineNum == "top") return this.drawTop(this.drawRight);
        if (lineNum == "bottom") return this.drawBottom(this.drawRight);
        let content = utils.truncate(this.content, 10, this.truncate);
        if (!lineNum) {
          info(`${this.y}-${this.x}: ${this.rowSpan - lineNum}x${this.colSpan} Cell ${content}`);
        } else {
        }
        let padLen = Math.max(this.height - this.lines.length, 0);
        let padTop;
        switch (this.vAlign) {
          case "center":
            padTop = Math.ceil(padLen / 2);
            break;
          case "bottom":
            padTop = padLen;
            break;
          default:
            padTop = 0;
        }
        if (lineNum < padTop || lineNum >= padTop + this.lines.length) {
          return this.drawEmpty(this.drawRight, spanningCell);
        }
        let forceTruncation = this.lines.length > this.height && lineNum + 1 >= this.height;
        return this.drawLine(lineNum - padTop, this.drawRight, forceTruncation, spanningCell);
      }
      /**
       * Renders the top line of the cell.
       * @param drawRight - true if this method should render the right edge of the cell.
       * @returns {String}
       */
      drawTop(drawRight) {
        let content = [];
        if (this.cells) {
          this.widths.forEach(function (width, index) {
            content.push(this._topLeftChar(index));
            content.push(utils.repeat(this.chars[this.y == 0 ? "top" : "mid"], width));
          }, this);
        } else {
          content.push(this._topLeftChar(0));
          content.push(utils.repeat(this.chars[this.y == 0 ? "top" : "mid"], this.width));
        }
        if (drawRight) {
          content.push(this.chars[this.y == 0 ? "topRight" : "rightMid"]);
        }
        return this.wrapWithStyleColors("border", content.join(""));
      }
      _topLeftChar(offset) {
        let x = this.x + offset;
        let leftChar;
        if (this.y == 0) {
          leftChar = x == 0 ? "topLeft" : offset == 0 ? "topMid" : "top";
        } else {
          if (x == 0) {
            leftChar = "leftMid";
          } else {
            leftChar = offset == 0 ? "midMid" : "bottomMid";
            if (this.cells) {
              let spanAbove = this.cells[this.y - 1][x] instanceof _Cell.ColSpanCell;
              if (spanAbove) {
                leftChar = offset == 0 ? "topMid" : "mid";
              }
              if (offset == 0) {
                let i = 1;
                while (this.cells[this.y][x - i] instanceof _Cell.ColSpanCell) {
                  i++;
                }
                if (this.cells[this.y][x - i] instanceof _Cell.RowSpanCell) {
                  leftChar = "leftMid";
                }
              }
            }
          }
        }
        return this.chars[leftChar];
      }
      wrapWithStyleColors(styleProperty, content) {
        if (this[styleProperty] && this[styleProperty].length) {
          try {
            let colors = require_safe();
            for (let i = this[styleProperty].length - 1; i >= 0; i--) {
              colors = colors[this[styleProperty][i]];
            }
            return colors(content);
          } catch (e) {
            return content;
          }
        } else {
          return content;
        }
      }
      /**
       * Renders a line of text.
       * @param lineNum - Which line of text to render. This is not necessarily the line within the cell.
       * There may be top-padding above the first line of text.
       * @param drawRight - true if this method should render the right edge of the cell.
       * @param forceTruncationSymbol - `true` if the rendered text should end with the truncation symbol even
       * if the text fits. This is used when the cell is vertically truncated. If `false` the text should
       * only include the truncation symbol if the text will not fit horizontally within the cell width.
       * @param spanningCell - a number of if being called from a RowSpanCell. (how many rows below). otherwise undefined.
       * @returns {String}
       */
      drawLine(lineNum, drawRight, forceTruncationSymbol, spanningCell) {
        let left = this.chars[this.x == 0 ? "left" : "middle"];
        if (this.x && spanningCell && this.cells) {
          let cellLeft = this.cells[this.y + spanningCell][this.x - 1];
          while (cellLeft instanceof ColSpanCell) {
            cellLeft = this.cells[cellLeft.y][cellLeft.x - 1];
          }
          if (!(cellLeft instanceof RowSpanCell)) {
            left = this.chars["rightMid"];
          }
        }
        let leftPadding = utils.repeat(" ", this.paddingLeft);
        let right = drawRight ? this.chars["right"] : "";
        let rightPadding = utils.repeat(" ", this.paddingRight);
        let line = this.lines[lineNum];
        let len = this.width - (this.paddingLeft + this.paddingRight);
        if (forceTruncationSymbol) line += this.truncate || "…";
        let content = utils.truncate(line, len, this.truncate);
        content = utils.pad(content, len, " ", this.hAlign);
        content = leftPadding + content + rightPadding;
        return this.stylizeLine(left, content, right);
      }
      stylizeLine(left, content, right) {
        left = this.wrapWithStyleColors("border", left);
        right = this.wrapWithStyleColors("border", right);
        if (this.y === 0) {
          content = this.wrapWithStyleColors("head", content);
        }
        return left + content + right;
      }
      /**
       * Renders the bottom line of the cell.
       * @param drawRight - true if this method should render the right edge of the cell.
       * @returns {String}
       */
      drawBottom(drawRight) {
        let left = this.chars[this.x == 0 ? "bottomLeft" : "bottomMid"];
        let content = utils.repeat(this.chars.bottom, this.width);
        let right = drawRight ? this.chars["bottomRight"] : "";
        return this.wrapWithStyleColors("border", left + content + right);
      }
      /**
       * Renders a blank line of text within the cell. Used for top and/or bottom padding.
       * @param drawRight - true if this method should render the right edge of the cell.
       * @param spanningCell - a number of if being called from a RowSpanCell. (how many rows below). otherwise undefined.
       * @returns {String}
       */
      drawEmpty(drawRight, spanningCell) {
        let left = this.chars[this.x == 0 ? "left" : "middle"];
        if (this.x && spanningCell && this.cells) {
          let cellLeft = this.cells[this.y + spanningCell][this.x - 1];
          while (cellLeft instanceof ColSpanCell) {
            cellLeft = this.cells[cellLeft.y][cellLeft.x - 1];
          }
          if (!(cellLeft instanceof RowSpanCell)) {
            left = this.chars["rightMid"];
          }
        }
        let right = drawRight ? this.chars["right"] : "";
        let content = utils.repeat(" ", this.width);
        return this.stylizeLine(left, content, right);
      }
    };
    var ColSpanCell = class {
      static {
        __name(this, "ColSpanCell");
      }
      /**
       * A Cell that doesn't do anything. It just draws empty lines.
       * Used as a placeholder in column spanning.
       * @constructor
       */
      constructor() {}
      draw(lineNum) {
        if (typeof lineNum === "number") {
          debug(`${this.y}-${this.x}: 1x1 ColSpanCell`);
        }
        return "";
      }
      init() {}
      mergeTableOptions() {}
    };
    var RowSpanCell = class {
      static {
        __name(this, "RowSpanCell");
      }
      /**
       * A placeholder Cell for a Cell that spans multiple rows.
       * It delegates rendering to the original cell, but adds the appropriate offset.
       * @param originalCell
       * @constructor
       */
      constructor(originalCell) {
        this.originalCell = originalCell;
      }
      init(tableOptions) {
        let y = this.y;
        let originalY = this.originalCell.y;
        this.cellOffset = y - originalY;
        this.offset = findDimension(tableOptions.rowHeights, originalY, this.cellOffset);
      }
      draw(lineNum) {
        if (lineNum == "top") {
          return this.originalCell.draw(this.offset, this.cellOffset);
        }
        if (lineNum == "bottom") {
          return this.originalCell.draw("bottom");
        }
        debug(
          `${this.y}-${this.x}: 1x${this.colSpan} RowSpanCell for ${this.originalCell.content}`,
        );
        return this.originalCell.draw(this.offset + 1 + lineNum);
      }
      mergeTableOptions() {}
    };
    function firstDefined(...args) {
      return args.filter((v) => v !== void 0 && v !== null).shift();
    }
    __name(firstDefined, "firstDefined");
    function setOption(objA, objB, nameB, targetObj) {
      let nameA = nameB.split("-");
      if (nameA.length > 1) {
        nameA[1] = nameA[1].charAt(0).toUpperCase() + nameA[1].substr(1);
        nameA = nameA.join("");
        targetObj[nameA] = firstDefined(objA[nameA], objA[nameB], objB[nameA], objB[nameB]);
      } else {
        targetObj[nameB] = firstDefined(objA[nameB], objB[nameB]);
      }
    }
    __name(setOption, "setOption");
    function findDimension(dimensionTable, startingIndex, span) {
      let ret = dimensionTable[startingIndex];
      for (let i = 1; i < span; i++) {
        ret += 1 + dimensionTable[startingIndex + i];
      }
      return ret;
    }
    __name(findDimension, "findDimension");
    function sumPlusOne(a, b) {
      return a + b + 1;
    }
    __name(sumPlusOne, "sumPlusOne");
    var CHAR_NAMES = [
      "top",
      "top-mid",
      "top-left",
      "top-right",
      "bottom",
      "bottom-mid",
      "bottom-left",
      "bottom-right",
      "left",
      "left-mid",
      "mid",
      "mid-mid",
      "right",
      "right-mid",
      "middle",
    ];
    module.exports = Cell;
    module.exports.ColSpanCell = ColSpanCell;
    module.exports.RowSpanCell = RowSpanCell;
  },
});

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/cli-table3@0.6.5/node_modules/cli-table3/src/layout-manager.js
var require_layout_manager = __commonJS({
  "../../../../.prototypes/trigger-dev/node_modules/.pnpm/cli-table3@0.6.5/node_modules/cli-table3/src/layout-manager.js"(
    exports,
    module,
  ) {
    init_esm();
    var { warn, debug } = require_debug();
    var Cell = require_cell();
    var { ColSpanCell, RowSpanCell } = Cell;
    (function () {
      function next(alloc, col) {
        if (alloc[col] > 0) {
          return next(alloc, col + 1);
        }
        return col;
      }
      __name(next, "next");
      function layoutTable(table) {
        let alloc = {};
        table.forEach(function (row, rowIndex) {
          let col = 0;
          row.forEach(function (cell) {
            cell.y = rowIndex;
            cell.x = rowIndex ? next(alloc, col) : col;
            const rowSpan = cell.rowSpan || 1;
            const colSpan = cell.colSpan || 1;
            if (rowSpan > 1) {
              for (let cs = 0; cs < colSpan; cs++) {
                alloc[cell.x + cs] = rowSpan;
              }
            }
            col = cell.x + colSpan;
          });
          Object.keys(alloc).forEach((idx) => {
            alloc[idx]--;
            if (alloc[idx] < 1) delete alloc[idx];
          });
        });
      }
      __name(layoutTable, "layoutTable");
      function maxWidth(table) {
        let mw = 0;
        table.forEach(function (row) {
          row.forEach(function (cell) {
            mw = Math.max(mw, cell.x + (cell.colSpan || 1));
          });
        });
        return mw;
      }
      __name(maxWidth, "maxWidth");
      function maxHeight(table) {
        return table.length;
      }
      __name(maxHeight, "maxHeight");
      function cellsConflict(cell1, cell2) {
        let yMin1 = cell1.y;
        let yMax1 = cell1.y - 1 + (cell1.rowSpan || 1);
        let yMin2 = cell2.y;
        let yMax2 = cell2.y - 1 + (cell2.rowSpan || 1);
        let yConflict = !(yMin1 > yMax2 || yMin2 > yMax1);
        let xMin1 = cell1.x;
        let xMax1 = cell1.x - 1 + (cell1.colSpan || 1);
        let xMin2 = cell2.x;
        let xMax2 = cell2.x - 1 + (cell2.colSpan || 1);
        let xConflict = !(xMin1 > xMax2 || xMin2 > xMax1);
        return yConflict && xConflict;
      }
      __name(cellsConflict, "cellsConflict");
      function conflictExists(rows, x, y) {
        let i_max = Math.min(rows.length - 1, y);
        let cell = { x, y };
        for (let i = 0; i <= i_max; i++) {
          let row = rows[i];
          for (let j = 0; j < row.length; j++) {
            if (cellsConflict(cell, row[j])) {
              return true;
            }
          }
        }
        return false;
      }
      __name(conflictExists, "conflictExists");
      function allBlank(rows, y, xMin, xMax) {
        for (let x = xMin; x < xMax; x++) {
          if (conflictExists(rows, x, y)) {
            return false;
          }
        }
        return true;
      }
      __name(allBlank, "allBlank");
      function addRowSpanCells(table) {
        table.forEach(function (row, rowIndex) {
          row.forEach(function (cell) {
            for (let i = 1; i < cell.rowSpan; i++) {
              let rowSpanCell = new RowSpanCell(cell);
              rowSpanCell.x = cell.x;
              rowSpanCell.y = cell.y + i;
              rowSpanCell.colSpan = cell.colSpan;
              insertCell(rowSpanCell, table[rowIndex + i]);
            }
          });
        });
      }
      __name(addRowSpanCells, "addRowSpanCells");
      function addColSpanCells(cellRows) {
        for (let rowIndex = cellRows.length - 1; rowIndex >= 0; rowIndex--) {
          let cellColumns = cellRows[rowIndex];
          for (let columnIndex = 0; columnIndex < cellColumns.length; columnIndex++) {
            let cell = cellColumns[columnIndex];
            for (let k = 1; k < cell.colSpan; k++) {
              let colSpanCell = new ColSpanCell();
              colSpanCell.x = cell.x + k;
              colSpanCell.y = cell.y;
              cellColumns.splice(columnIndex + 1, 0, colSpanCell);
            }
          }
        }
      }
      __name(addColSpanCells, "addColSpanCells");
      function insertCell(cell, row) {
        let x = 0;
        while (x < row.length && row[x].x < cell.x) {
          x++;
        }
        row.splice(x, 0, cell);
      }
      __name(insertCell, "insertCell");
      function fillInTable(table) {
        let h_max = maxHeight(table);
        let w_max = maxWidth(table);
        debug(`Max rows: ${h_max}; Max cols: ${w_max}`);
        for (let y = 0; y < h_max; y++) {
          for (let x = 0; x < w_max; x++) {
            if (!conflictExists(table, x, y)) {
              let opts = { x, y, colSpan: 1, rowSpan: 1 };
              x++;
              while (x < w_max && !conflictExists(table, x, y)) {
                opts.colSpan++;
                x++;
              }
              let y2 = y + 1;
              while (y2 < h_max && allBlank(table, y2, opts.x, opts.x + opts.colSpan)) {
                opts.rowSpan++;
                y2++;
              }
              let cell = new Cell(opts);
              cell.x = opts.x;
              cell.y = opts.y;
              warn(`Missing cell at ${cell.y}-${cell.x}.`);
              insertCell(cell, table[y]);
            }
          }
        }
      }
      __name(fillInTable, "fillInTable");
      function generateCells(rows) {
        return rows.map(function (row) {
          if (!Array.isArray(row)) {
            let key = Object.keys(row)[0];
            row = row[key];
            if (Array.isArray(row)) {
              row = row.slice();
              row.unshift(key);
            } else {
              row = [key, row];
            }
          }
          return row.map(function (cell) {
            return new Cell(cell);
          });
        });
      }
      __name(generateCells, "generateCells");
      function makeTableLayout(rows) {
        let cellRows = generateCells(rows);
        layoutTable(cellRows);
        fillInTable(cellRows);
        addRowSpanCells(cellRows);
        addColSpanCells(cellRows);
        return cellRows;
      }
      __name(makeTableLayout, "makeTableLayout");
      module.exports = {
        makeTableLayout,
        layoutTable,
        addRowSpanCells,
        maxWidth,
        fillInTable,
        computeWidths: makeComputeWidths("colSpan", "desiredWidth", "x", 1),
        computeHeights: makeComputeWidths("rowSpan", "desiredHeight", "y", 1),
      };
    })();
    function makeComputeWidths(colSpan, desiredWidth, x, forcedMin) {
      return function (vals, table) {
        let result = [];
        let spanners = [];
        let auto = {};
        table.forEach(function (row) {
          row.forEach(function (cell) {
            if ((cell[colSpan] || 1) > 1) {
              spanners.push(cell);
            } else {
              result[cell[x]] = Math.max(result[cell[x]] || 0, cell[desiredWidth] || 0, forcedMin);
            }
          });
        });
        vals.forEach(function (val, index) {
          if (typeof val === "number") {
            result[index] = val;
          }
        });
        for (let k = spanners.length - 1; k >= 0; k--) {
          let cell = spanners[k];
          let span = cell[colSpan];
          let col = cell[x];
          let existingWidth = result[col];
          let editableCols = typeof vals[col] === "number" ? 0 : 1;
          if (typeof existingWidth === "number") {
            for (let i = 1; i < span; i++) {
              existingWidth += 1 + result[col + i];
              if (typeof vals[col + i] !== "number") {
                editableCols++;
              }
            }
          } else {
            existingWidth = desiredWidth === "desiredWidth" ? cell.desiredWidth - 1 : 1;
            if (!auto[col] || auto[col] < existingWidth) {
              auto[col] = existingWidth;
            }
          }
          if (cell[desiredWidth] > existingWidth) {
            let i = 0;
            while (editableCols > 0 && cell[desiredWidth] > existingWidth) {
              if (typeof vals[col + i] !== "number") {
                let dif = Math.round((cell[desiredWidth] - existingWidth) / editableCols);
                existingWidth += dif;
                result[col + i] += dif;
                editableCols--;
              }
              i++;
            }
          }
        }
        Object.assign(vals, result, auto);
        for (let j = 0; j < vals.length; j++) {
          vals[j] = Math.max(forcedMin, vals[j] || 0);
        }
      };
    }
    __name(makeComputeWidths, "makeComputeWidths");
  },
});

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/cli-table3@0.6.5/node_modules/cli-table3/src/table.js
var require_table = __commonJS({
  "../../../../.prototypes/trigger-dev/node_modules/.pnpm/cli-table3@0.6.5/node_modules/cli-table3/src/table.js"(
    exports,
    module,
  ) {
    init_esm();
    var debug = require_debug();
    var utils = require_utils();
    var tableLayout = require_layout_manager();
    var Table = class extends Array {
      static {
        __name(this, "Table");
      }
      constructor(opts) {
        super();
        const options = utils.mergeOptions(opts);
        Object.defineProperty(this, "options", {
          value: options,
          enumerable: options.debug,
        });
        if (options.debug) {
          switch (typeof options.debug) {
            case "boolean":
              debug.setDebugLevel(debug.WARN);
              break;
            case "number":
              debug.setDebugLevel(options.debug);
              break;
            case "string":
              debug.setDebugLevel(parseInt(options.debug, 10));
              break;
            default:
              debug.setDebugLevel(debug.WARN);
              debug.warn(
                `Debug option is expected to be boolean, number, or string. Received a ${typeof options.debug}`,
              );
          }
          Object.defineProperty(this, "messages", {
            get() {
              return debug.debugMessages();
            },
          });
        }
      }
      toString() {
        let array = this;
        let headersPresent = this.options.head && this.options.head.length;
        if (headersPresent) {
          array = [this.options.head];
          if (this.length) {
            array.push.apply(array, this);
          }
        } else {
          this.options.style.head = [];
        }
        let cells = tableLayout.makeTableLayout(array);
        cells.forEach(function (row) {
          row.forEach(function (cell) {
            cell.mergeTableOptions(this.options, cells);
          }, this);
        }, this);
        tableLayout.computeWidths(this.options.colWidths, cells);
        tableLayout.computeHeights(this.options.rowHeights, cells);
        cells.forEach(function (row) {
          row.forEach(function (cell) {
            cell.init(this.options);
          }, this);
        }, this);
        let result = [];
        for (let rowIndex = 0; rowIndex < cells.length; rowIndex++) {
          let row = cells[rowIndex];
          let heightOfRow = this.options.rowHeights[rowIndex];
          if (rowIndex === 0 || !this.options.style.compact || (rowIndex == 1 && headersPresent)) {
            doDraw(row, "top", result);
          }
          for (let lineNum = 0; lineNum < heightOfRow; lineNum++) {
            doDraw(row, lineNum, result);
          }
          if (rowIndex + 1 == cells.length) {
            doDraw(row, "bottom", result);
          }
        }
        return result.join("\n");
      }
      get width() {
        let str = this.toString().split("\n");
        return str[0].length;
      }
    };
    Table.reset = () => debug.reset();
    function doDraw(row, lineNum, result) {
      let line = [];
      row.forEach(function (cell) {
        line.push(cell.draw(lineNum));
      });
      let str = line.join("");
      if (str.length) result.push(str);
    }
    __name(doDraw, "doDraw");
    module.exports = Table;
  },
});

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/cli-table3@0.6.5/node_modules/cli-table3/index.js
var require_cli_table3 = __commonJS({
  "../../../../.prototypes/trigger-dev/node_modules/.pnpm/cli-table3@0.6.5/node_modules/cli-table3/index.js"(
    exports,
    module,
  ) {
    init_esm();
    module.exports = require_table();
  },
});

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/esbuild@0.23.1/node_modules/esbuild/lib/main.js
var require_main = __commonJS({
  "../../../../.prototypes/trigger-dev/node_modules/.pnpm/esbuild@0.23.1/node_modules/esbuild/lib/main.js"(
    exports,
    module,
  ) {
    "use strict";
    init_esm();
    var __defProp = Object.defineProperty;
    var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
    var __getOwnPropNames = Object.getOwnPropertyNames;
    var __hasOwnProp = Object.prototype.hasOwnProperty;
    var __export = /* @__PURE__ */ __name((target, all) => {
      for (var name in all) __defProp(target, name, { get: all[name], enumerable: true });
    }, "__export");
    var __copyProps = /* @__PURE__ */ __name((to, from, except, desc) => {
      if ((from && typeof from === "object") || typeof from === "function") {
        for (let key of __getOwnPropNames(from))
          if (!__hasOwnProp.call(to, key) && key !== except)
            __defProp(to, key, {
              get: /* @__PURE__ */ __name(() => from[key], "get"),
              enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable,
            });
      }
      return to;
    }, "__copyProps");
    var __toCommonJS = /* @__PURE__ */ __name(
      (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod),
      "__toCommonJS",
    );
    var node_exports = {};
    __export(node_exports, {
      analyzeMetafile: /* @__PURE__ */ __name(() => analyzeMetafile, "analyzeMetafile"),
      analyzeMetafileSync: /* @__PURE__ */ __name(() => analyzeMetafileSync, "analyzeMetafileSync"),
      build: /* @__PURE__ */ __name(() => build, "build"),
      buildSync: /* @__PURE__ */ __name(() => buildSync, "buildSync"),
      context: /* @__PURE__ */ __name(() => context, "context"),
      default: /* @__PURE__ */ __name(() => node_default, "default"),
      formatMessages: /* @__PURE__ */ __name(() => formatMessages, "formatMessages"),
      formatMessagesSync: /* @__PURE__ */ __name(() => formatMessagesSync2, "formatMessagesSync"),
      initialize: /* @__PURE__ */ __name(() => initialize, "initialize"),
      stop: /* @__PURE__ */ __name(() => stop, "stop"),
      transform: /* @__PURE__ */ __name(() => transform, "transform"),
      transformSync: /* @__PURE__ */ __name(() => transformSync, "transformSync"),
      version: /* @__PURE__ */ __name(() => version, "version"),
    });
    module.exports = __toCommonJS(node_exports);
    function encodePacket(packet) {
      let visit = /* @__PURE__ */ __name((value) => {
        if (value === null) {
          bb.write8(0);
        } else if (typeof value === "boolean") {
          bb.write8(1);
          bb.write8(+value);
        } else if (typeof value === "number") {
          bb.write8(2);
          bb.write32(value | 0);
        } else if (typeof value === "string") {
          bb.write8(3);
          bb.write(encodeUTF8(value));
        } else if (value instanceof Uint8Array) {
          bb.write8(4);
          bb.write(value);
        } else if (value instanceof Array) {
          bb.write8(5);
          bb.write32(value.length);
          for (let item of value) {
            visit(item);
          }
        } else {
          let keys = Object.keys(value);
          bb.write8(6);
          bb.write32(keys.length);
          for (let key of keys) {
            bb.write(encodeUTF8(key));
            visit(value[key]);
          }
        }
      }, "visit");
      let bb = new ByteBuffer();
      bb.write32(0);
      bb.write32((packet.id << 1) | +!packet.isRequest);
      visit(packet.value);
      writeUInt32LE(bb.buf, bb.len - 4, 0);
      return bb.buf.subarray(0, bb.len);
    }
    __name(encodePacket, "encodePacket");
    function decodePacket(bytes) {
      let visit = /* @__PURE__ */ __name(() => {
        switch (bb.read8()) {
          case 0:
            return null;
          case 1:
            return !!bb.read8();
          case 2:
            return bb.read32();
          case 3:
            return decodeUTF8(bb.read());
          case 4:
            return bb.read();
          case 5: {
            let count = bb.read32();
            let value2 = [];
            for (let i = 0; i < count; i++) {
              value2.push(visit());
            }
            return value2;
          }
          case 6: {
            let count = bb.read32();
            let value2 = {};
            for (let i = 0; i < count; i++) {
              value2[decodeUTF8(bb.read())] = visit();
            }
            return value2;
          }
          default:
            throw new Error("Invalid packet");
        }
      }, "visit");
      let bb = new ByteBuffer(bytes);
      let id = bb.read32();
      let isRequest = (id & 1) === 0;
      id >>>= 1;
      let value = visit();
      if (bb.ptr !== bytes.length) {
        throw new Error("Invalid packet");
      }
      return { id, isRequest, value };
    }
    __name(decodePacket, "decodePacket");
    var ByteBuffer = class {
      static {
        __name(this, "ByteBuffer");
      }
      constructor(buf = new Uint8Array(1024)) {
        this.buf = buf;
        this.len = 0;
        this.ptr = 0;
      }
      _write(delta) {
        if (this.len + delta > this.buf.length) {
          let clone = new Uint8Array((this.len + delta) * 2);
          clone.set(this.buf);
          this.buf = clone;
        }
        this.len += delta;
        return this.len - delta;
      }
      write8(value) {
        let offset = this._write(1);
        this.buf[offset] = value;
      }
      write32(value) {
        let offset = this._write(4);
        writeUInt32LE(this.buf, value, offset);
      }
      write(bytes) {
        let offset = this._write(4 + bytes.length);
        writeUInt32LE(this.buf, bytes.length, offset);
        this.buf.set(bytes, offset + 4);
      }
      _read(delta) {
        if (this.ptr + delta > this.buf.length) {
          throw new Error("Invalid packet");
        }
        this.ptr += delta;
        return this.ptr - delta;
      }
      read8() {
        return this.buf[this._read(1)];
      }
      read32() {
        return readUInt32LE(this.buf, this._read(4));
      }
      read() {
        let length = this.read32();
        let bytes = new Uint8Array(length);
        let ptr = this._read(bytes.length);
        bytes.set(this.buf.subarray(ptr, ptr + length));
        return bytes;
      }
    };
    var encodeUTF8;
    var decodeUTF8;
    var encodeInvariant;
    if (typeof TextEncoder !== "undefined" && typeof TextDecoder !== "undefined") {
      let encoder = new TextEncoder();
      let decoder = new TextDecoder();
      encodeUTF8 = /* @__PURE__ */ __name((text) => encoder.encode(text), "encodeUTF8");
      decodeUTF8 = /* @__PURE__ */ __name((bytes) => decoder.decode(bytes), "decodeUTF8");
      encodeInvariant = 'new TextEncoder().encode("")';
    } else if (typeof Buffer !== "undefined") {
      encodeUTF8 = /* @__PURE__ */ __name((text) => Buffer.from(text), "encodeUTF8");
      decodeUTF8 = /* @__PURE__ */ __name((bytes) => {
        let { buffer, byteOffset, byteLength } = bytes;
        return Buffer.from(buffer, byteOffset, byteLength).toString();
      }, "decodeUTF8");
      encodeInvariant = 'Buffer.from("")';
    } else {
      throw new Error("No UTF-8 codec found");
    }
    if (!(encodeUTF8("") instanceof Uint8Array))
      throw new Error(`Invariant violation: "${encodeInvariant} instanceof Uint8Array" is incorrectly false

This indicates that your JavaScript environment is broken. You cannot use
esbuild in this environment because esbuild relies on this invariant. This
is not a problem with esbuild. You need to fix your environment instead.
`);
    function readUInt32LE(buffer, offset) {
      return (
        buffer[offset++] |
        (buffer[offset++] << 8) |
        (buffer[offset++] << 16) |
        (buffer[offset++] << 24)
      );
    }
    __name(readUInt32LE, "readUInt32LE");
    function writeUInt32LE(buffer, value, offset) {
      buffer[offset++] = value;
      buffer[offset++] = value >> 8;
      buffer[offset++] = value >> 16;
      buffer[offset++] = value >> 24;
    }
    __name(writeUInt32LE, "writeUInt32LE");
    var quote = JSON.stringify;
    var buildLogLevelDefault = "warning";
    var transformLogLevelDefault = "silent";
    function validateTarget(target) {
      validateStringValue(target, "target");
      if (target.indexOf(",") >= 0) throw new Error(`Invalid target: ${target}`);
      return target;
    }
    __name(validateTarget, "validateTarget");
    var canBeAnything = /* @__PURE__ */ __name(() => null, "canBeAnything");
    var mustBeBoolean = /* @__PURE__ */ __name(
      (value) => (typeof value === "boolean" ? null : "a boolean"),
      "mustBeBoolean",
    );
    var mustBeString = /* @__PURE__ */ __name(
      (value) => (typeof value === "string" ? null : "a string"),
      "mustBeString",
    );
    var mustBeRegExp = /* @__PURE__ */ __name(
      (value) => (value instanceof RegExp ? null : "a RegExp object"),
      "mustBeRegExp",
    );
    var mustBeInteger = /* @__PURE__ */ __name(
      (value) => (typeof value === "number" && value === (value | 0) ? null : "an integer"),
      "mustBeInteger",
    );
    var mustBeFunction = /* @__PURE__ */ __name(
      (value) => (typeof value === "function" ? null : "a function"),
      "mustBeFunction",
    );
    var mustBeArray = /* @__PURE__ */ __name(
      (value) => (Array.isArray(value) ? null : "an array"),
      "mustBeArray",
    );
    var mustBeObject = /* @__PURE__ */ __name(
      (value) =>
        typeof value === "object" && value !== null && !Array.isArray(value) ? null : "an object",
      "mustBeObject",
    );
    var mustBeEntryPoints = /* @__PURE__ */ __name(
      (value) => (typeof value === "object" && value !== null ? null : "an array or an object"),
      "mustBeEntryPoints",
    );
    var mustBeWebAssemblyModule = /* @__PURE__ */ __name(
      (value) => (value instanceof WebAssembly.Module ? null : "a WebAssembly.Module"),
      "mustBeWebAssemblyModule",
    );
    var mustBeObjectOrNull = /* @__PURE__ */ __name(
      (value) => (typeof value === "object" && !Array.isArray(value) ? null : "an object or null"),
      "mustBeObjectOrNull",
    );
    var mustBeStringOrBoolean = /* @__PURE__ */ __name(
      (value) =>
        typeof value === "string" || typeof value === "boolean" ? null : "a string or a boolean",
      "mustBeStringOrBoolean",
    );
    var mustBeStringOrObject = /* @__PURE__ */ __name(
      (value) =>
        typeof value === "string" ||
        (typeof value === "object" && value !== null && !Array.isArray(value))
          ? null
          : "a string or an object",
      "mustBeStringOrObject",
    );
    var mustBeStringOrArray = /* @__PURE__ */ __name(
      (value) =>
        typeof value === "string" || Array.isArray(value) ? null : "a string or an array",
      "mustBeStringOrArray",
    );
    var mustBeStringOrUint8Array = /* @__PURE__ */ __name(
      (value) =>
        typeof value === "string" || value instanceof Uint8Array
          ? null
          : "a string or a Uint8Array",
      "mustBeStringOrUint8Array",
    );
    var mustBeStringOrURL = /* @__PURE__ */ __name(
      (value) => (typeof value === "string" || value instanceof URL ? null : "a string or a URL"),
      "mustBeStringOrURL",
    );
    function getFlag(object, keys, key, mustBeFn) {
      let value = object[key];
      keys[key + ""] = true;
      if (value === void 0) return void 0;
      let mustBe = mustBeFn(value);
      if (mustBe !== null) throw new Error(`${quote(key)} must be ${mustBe}`);
      return value;
    }
    __name(getFlag, "getFlag");
    function checkForInvalidFlags(object, keys, where) {
      for (let key in object) {
        if (!(key in keys)) {
          throw new Error(`Invalid option ${where}: ${quote(key)}`);
        }
      }
    }
    __name(checkForInvalidFlags, "checkForInvalidFlags");
    function validateInitializeOptions(options) {
      let keys = /* @__PURE__ */ Object.create(null);
      let wasmURL = getFlag(options, keys, "wasmURL", mustBeStringOrURL);
      let wasmModule = getFlag(options, keys, "wasmModule", mustBeWebAssemblyModule);
      let worker = getFlag(options, keys, "worker", mustBeBoolean);
      checkForInvalidFlags(options, keys, "in initialize() call");
      return {
        wasmURL,
        wasmModule,
        worker,
      };
    }
    __name(validateInitializeOptions, "validateInitializeOptions");
    function validateMangleCache(mangleCache) {
      let validated;
      if (mangleCache !== void 0) {
        validated = /* @__PURE__ */ Object.create(null);
        for (let key in mangleCache) {
          let value = mangleCache[key];
          if (typeof value === "string" || value === false) {
            validated[key] = value;
          } else {
            throw new Error(
              `Expected ${quote(key)} in mangle cache to map to either a string or false`,
            );
          }
        }
      }
      return validated;
    }
    __name(validateMangleCache, "validateMangleCache");
    function pushLogFlags(flags, options, keys, isTTY2, logLevelDefault) {
      let color = getFlag(options, keys, "color", mustBeBoolean);
      let logLevel = getFlag(options, keys, "logLevel", mustBeString);
      let logLimit = getFlag(options, keys, "logLimit", mustBeInteger);
      if (color !== void 0) flags.push(`--color=${color}`);
      else if (isTTY2) flags.push(`--color=true`);
      flags.push(`--log-level=${logLevel || logLevelDefault}`);
      flags.push(`--log-limit=${logLimit || 0}`);
    }
    __name(pushLogFlags, "pushLogFlags");
    function validateStringValue(value, what, key) {
      if (typeof value !== "string") {
        throw new Error(
          `Expected value for ${what}${key !== void 0 ? " " + quote(key) : ""} to be a string, got ${typeof value} instead`,
        );
      }
      return value;
    }
    __name(validateStringValue, "validateStringValue");
    function pushCommonFlags(flags, options, keys) {
      let legalComments = getFlag(options, keys, "legalComments", mustBeString);
      let sourceRoot = getFlag(options, keys, "sourceRoot", mustBeString);
      let sourcesContent = getFlag(options, keys, "sourcesContent", mustBeBoolean);
      let target = getFlag(options, keys, "target", mustBeStringOrArray);
      let format2 = getFlag(options, keys, "format", mustBeString);
      let globalName = getFlag(options, keys, "globalName", mustBeString);
      let mangleProps = getFlag(options, keys, "mangleProps", mustBeRegExp);
      let reserveProps = getFlag(options, keys, "reserveProps", mustBeRegExp);
      let mangleQuoted = getFlag(options, keys, "mangleQuoted", mustBeBoolean);
      let minify = getFlag(options, keys, "minify", mustBeBoolean);
      let minifySyntax = getFlag(options, keys, "minifySyntax", mustBeBoolean);
      let minifyWhitespace = getFlag(options, keys, "minifyWhitespace", mustBeBoolean);
      let minifyIdentifiers = getFlag(options, keys, "minifyIdentifiers", mustBeBoolean);
      let lineLimit = getFlag(options, keys, "lineLimit", mustBeInteger);
      let drop = getFlag(options, keys, "drop", mustBeArray);
      let dropLabels = getFlag(options, keys, "dropLabels", mustBeArray);
      let charset = getFlag(options, keys, "charset", mustBeString);
      let treeShaking = getFlag(options, keys, "treeShaking", mustBeBoolean);
      let ignoreAnnotations = getFlag(options, keys, "ignoreAnnotations", mustBeBoolean);
      let jsx = getFlag(options, keys, "jsx", mustBeString);
      let jsxFactory = getFlag(options, keys, "jsxFactory", mustBeString);
      let jsxFragment = getFlag(options, keys, "jsxFragment", mustBeString);
      let jsxImportSource = getFlag(options, keys, "jsxImportSource", mustBeString);
      let jsxDev = getFlag(options, keys, "jsxDev", mustBeBoolean);
      let jsxSideEffects = getFlag(options, keys, "jsxSideEffects", mustBeBoolean);
      let define = getFlag(options, keys, "define", mustBeObject);
      let logOverride = getFlag(options, keys, "logOverride", mustBeObject);
      let supported = getFlag(options, keys, "supported", mustBeObject);
      let pure = getFlag(options, keys, "pure", mustBeArray);
      let keepNames = getFlag(options, keys, "keepNames", mustBeBoolean);
      let platform = getFlag(options, keys, "platform", mustBeString);
      let tsconfigRaw = getFlag(options, keys, "tsconfigRaw", mustBeStringOrObject);
      if (legalComments) flags.push(`--legal-comments=${legalComments}`);
      if (sourceRoot !== void 0) flags.push(`--source-root=${sourceRoot}`);
      if (sourcesContent !== void 0) flags.push(`--sources-content=${sourcesContent}`);
      if (target) {
        if (Array.isArray(target))
          flags.push(`--target=${Array.from(target).map(validateTarget).join(",")}`);
        else flags.push(`--target=${validateTarget(target)}`);
      }
      if (format2) flags.push(`--format=${format2}`);
      if (globalName) flags.push(`--global-name=${globalName}`);
      if (platform) flags.push(`--platform=${platform}`);
      if (tsconfigRaw)
        flags.push(
          `--tsconfig-raw=${typeof tsconfigRaw === "string" ? tsconfigRaw : JSON.stringify(tsconfigRaw)}`,
        );
      if (minify) flags.push("--minify");
      if (minifySyntax) flags.push("--minify-syntax");
      if (minifyWhitespace) flags.push("--minify-whitespace");
      if (minifyIdentifiers) flags.push("--minify-identifiers");
      if (lineLimit) flags.push(`--line-limit=${lineLimit}`);
      if (charset) flags.push(`--charset=${charset}`);
      if (treeShaking !== void 0) flags.push(`--tree-shaking=${treeShaking}`);
      if (ignoreAnnotations) flags.push(`--ignore-annotations`);
      if (drop) for (let what of drop) flags.push(`--drop:${validateStringValue(what, "drop")}`);
      if (dropLabels)
        flags.push(
          `--drop-labels=${Array.from(dropLabels)
            .map((what) => validateStringValue(what, "dropLabels"))
            .join(",")}`,
        );
      if (mangleProps) flags.push(`--mangle-props=${mangleProps.source}`);
      if (reserveProps) flags.push(`--reserve-props=${reserveProps.source}`);
      if (mangleQuoted !== void 0) flags.push(`--mangle-quoted=${mangleQuoted}`);
      if (jsx) flags.push(`--jsx=${jsx}`);
      if (jsxFactory) flags.push(`--jsx-factory=${jsxFactory}`);
      if (jsxFragment) flags.push(`--jsx-fragment=${jsxFragment}`);
      if (jsxImportSource) flags.push(`--jsx-import-source=${jsxImportSource}`);
      if (jsxDev) flags.push(`--jsx-dev`);
      if (jsxSideEffects) flags.push(`--jsx-side-effects`);
      if (define) {
        for (let key in define) {
          if (key.indexOf("=") >= 0) throw new Error(`Invalid define: ${key}`);
          flags.push(`--define:${key}=${validateStringValue(define[key], "define", key)}`);
        }
      }
      if (logOverride) {
        for (let key in logOverride) {
          if (key.indexOf("=") >= 0) throw new Error(`Invalid log override: ${key}`);
          flags.push(
            `--log-override:${key}=${validateStringValue(logOverride[key], "log override", key)}`,
          );
        }
      }
      if (supported) {
        for (let key in supported) {
          if (key.indexOf("=") >= 0) throw new Error(`Invalid supported: ${key}`);
          const value = supported[key];
          if (typeof value !== "boolean")
            throw new Error(
              `Expected value for supported ${quote(key)} to be a boolean, got ${typeof value} instead`,
            );
          flags.push(`--supported:${key}=${value}`);
        }
      }
      if (pure) for (let fn of pure) flags.push(`--pure:${validateStringValue(fn, "pure")}`);
      if (keepNames) flags.push(`--keep-names`);
    }
    __name(pushCommonFlags, "pushCommonFlags");
    function flagsForBuildOptions(callName, options, isTTY2, logLevelDefault, writeDefault) {
      var _a2;
      let flags = [];
      let entries = [];
      let keys = /* @__PURE__ */ Object.create(null);
      let stdinContents = null;
      let stdinResolveDir = null;
      pushLogFlags(flags, options, keys, isTTY2, logLevelDefault);
      pushCommonFlags(flags, options, keys);
      let sourcemap = getFlag(options, keys, "sourcemap", mustBeStringOrBoolean);
      let bundle = getFlag(options, keys, "bundle", mustBeBoolean);
      let splitting = getFlag(options, keys, "splitting", mustBeBoolean);
      let preserveSymlinks = getFlag(options, keys, "preserveSymlinks", mustBeBoolean);
      let metafile = getFlag(options, keys, "metafile", mustBeBoolean);
      let outfile = getFlag(options, keys, "outfile", mustBeString);
      let outdir = getFlag(options, keys, "outdir", mustBeString);
      let outbase = getFlag(options, keys, "outbase", mustBeString);
      let tsconfig = getFlag(options, keys, "tsconfig", mustBeString);
      let resolveExtensions = getFlag(options, keys, "resolveExtensions", mustBeArray);
      let nodePathsInput = getFlag(options, keys, "nodePaths", mustBeArray);
      let mainFields = getFlag(options, keys, "mainFields", mustBeArray);
      let conditions = getFlag(options, keys, "conditions", mustBeArray);
      let external = getFlag(options, keys, "external", mustBeArray);
      let packages = getFlag(options, keys, "packages", mustBeString);
      let alias = getFlag(options, keys, "alias", mustBeObject);
      let loader = getFlag(options, keys, "loader", mustBeObject);
      let outExtension = getFlag(options, keys, "outExtension", mustBeObject);
      let publicPath = getFlag(options, keys, "publicPath", mustBeString);
      let entryNames = getFlag(options, keys, "entryNames", mustBeString);
      let chunkNames = getFlag(options, keys, "chunkNames", mustBeString);
      let assetNames = getFlag(options, keys, "assetNames", mustBeString);
      let inject = getFlag(options, keys, "inject", mustBeArray);
      let banner = getFlag(options, keys, "banner", mustBeObject);
      let footer = getFlag(options, keys, "footer", mustBeObject);
      let entryPoints = getFlag(options, keys, "entryPoints", mustBeEntryPoints);
      let absWorkingDir = getFlag(options, keys, "absWorkingDir", mustBeString);
      let stdin = getFlag(options, keys, "stdin", mustBeObject);
      let write =
        (_a2 = getFlag(options, keys, "write", mustBeBoolean)) != null ? _a2 : writeDefault;
      let allowOverwrite = getFlag(options, keys, "allowOverwrite", mustBeBoolean);
      let mangleCache = getFlag(options, keys, "mangleCache", mustBeObject);
      keys.plugins = true;
      checkForInvalidFlags(options, keys, `in ${callName}() call`);
      if (sourcemap) flags.push(`--sourcemap${sourcemap === true ? "" : `=${sourcemap}`}`);
      if (bundle) flags.push("--bundle");
      if (allowOverwrite) flags.push("--allow-overwrite");
      if (splitting) flags.push("--splitting");
      if (preserveSymlinks) flags.push("--preserve-symlinks");
      if (metafile) flags.push(`--metafile`);
      if (outfile) flags.push(`--outfile=${outfile}`);
      if (outdir) flags.push(`--outdir=${outdir}`);
      if (outbase) flags.push(`--outbase=${outbase}`);
      if (tsconfig) flags.push(`--tsconfig=${tsconfig}`);
      if (packages) flags.push(`--packages=${packages}`);
      if (resolveExtensions) {
        let values = [];
        for (let value of resolveExtensions) {
          validateStringValue(value, "resolve extension");
          if (value.indexOf(",") >= 0) throw new Error(`Invalid resolve extension: ${value}`);
          values.push(value);
        }
        flags.push(`--resolve-extensions=${values.join(",")}`);
      }
      if (publicPath) flags.push(`--public-path=${publicPath}`);
      if (entryNames) flags.push(`--entry-names=${entryNames}`);
      if (chunkNames) flags.push(`--chunk-names=${chunkNames}`);
      if (assetNames) flags.push(`--asset-names=${assetNames}`);
      if (mainFields) {
        let values = [];
        for (let value of mainFields) {
          validateStringValue(value, "main field");
          if (value.indexOf(",") >= 0) throw new Error(`Invalid main field: ${value}`);
          values.push(value);
        }
        flags.push(`--main-fields=${values.join(",")}`);
      }
      if (conditions) {
        let values = [];
        for (let value of conditions) {
          validateStringValue(value, "condition");
          if (value.indexOf(",") >= 0) throw new Error(`Invalid condition: ${value}`);
          values.push(value);
        }
        flags.push(`--conditions=${values.join(",")}`);
      }
      if (external)
        for (let name of external)
          flags.push(`--external:${validateStringValue(name, "external")}`);
      if (alias) {
        for (let old in alias) {
          if (old.indexOf("=") >= 0) throw new Error(`Invalid package name in alias: ${old}`);
          flags.push(`--alias:${old}=${validateStringValue(alias[old], "alias", old)}`);
        }
      }
      if (banner) {
        for (let type in banner) {
          if (type.indexOf("=") >= 0) throw new Error(`Invalid banner file type: ${type}`);
          flags.push(`--banner:${type}=${validateStringValue(banner[type], "banner", type)}`);
        }
      }
      if (footer) {
        for (let type in footer) {
          if (type.indexOf("=") >= 0) throw new Error(`Invalid footer file type: ${type}`);
          flags.push(`--footer:${type}=${validateStringValue(footer[type], "footer", type)}`);
        }
      }
      if (inject)
        for (let path3 of inject) flags.push(`--inject:${validateStringValue(path3, "inject")}`);
      if (loader) {
        for (let ext in loader) {
          if (ext.indexOf("=") >= 0) throw new Error(`Invalid loader extension: ${ext}`);
          flags.push(`--loader:${ext}=${validateStringValue(loader[ext], "loader", ext)}`);
        }
      }
      if (outExtension) {
        for (let ext in outExtension) {
          if (ext.indexOf("=") >= 0) throw new Error(`Invalid out extension: ${ext}`);
          flags.push(
            `--out-extension:${ext}=${validateStringValue(outExtension[ext], "out extension", ext)}`,
          );
        }
      }
      if (entryPoints) {
        if (Array.isArray(entryPoints)) {
          for (let i = 0, n = entryPoints.length; i < n; i++) {
            let entryPoint = entryPoints[i];
            if (typeof entryPoint === "object" && entryPoint !== null) {
              let entryPointKeys = /* @__PURE__ */ Object.create(null);
              let input = getFlag(entryPoint, entryPointKeys, "in", mustBeString);
              let output = getFlag(entryPoint, entryPointKeys, "out", mustBeString);
              checkForInvalidFlags(entryPoint, entryPointKeys, "in entry point at index " + i);
              if (input === void 0)
                throw new Error('Missing property "in" for entry point at index ' + i);
              if (output === void 0)
                throw new Error('Missing property "out" for entry point at index ' + i);
              entries.push([output, input]);
            } else {
              entries.push(["", validateStringValue(entryPoint, "entry point at index " + i)]);
            }
          }
        } else {
          for (let key in entryPoints) {
            entries.push([key, validateStringValue(entryPoints[key], "entry point", key)]);
          }
        }
      }
      if (stdin) {
        let stdinKeys = /* @__PURE__ */ Object.create(null);
        let contents = getFlag(stdin, stdinKeys, "contents", mustBeStringOrUint8Array);
        let resolveDir = getFlag(stdin, stdinKeys, "resolveDir", mustBeString);
        let sourcefile = getFlag(stdin, stdinKeys, "sourcefile", mustBeString);
        let loader2 = getFlag(stdin, stdinKeys, "loader", mustBeString);
        checkForInvalidFlags(stdin, stdinKeys, 'in "stdin" object');
        if (sourcefile) flags.push(`--sourcefile=${sourcefile}`);
        if (loader2) flags.push(`--loader=${loader2}`);
        if (resolveDir) stdinResolveDir = resolveDir;
        if (typeof contents === "string") stdinContents = encodeUTF8(contents);
        else if (contents instanceof Uint8Array) stdinContents = contents;
      }
      let nodePaths = [];
      if (nodePathsInput) {
        for (let value of nodePathsInput) {
          value += "";
          nodePaths.push(value);
        }
      }
      return {
        entries,
        flags,
        write,
        stdinContents,
        stdinResolveDir,
        absWorkingDir,
        nodePaths,
        mangleCache: validateMangleCache(mangleCache),
      };
    }
    __name(flagsForBuildOptions, "flagsForBuildOptions");
    function flagsForTransformOptions(callName, options, isTTY2, logLevelDefault) {
      let flags = [];
      let keys = /* @__PURE__ */ Object.create(null);
      pushLogFlags(flags, options, keys, isTTY2, logLevelDefault);
      pushCommonFlags(flags, options, keys);
      let sourcemap = getFlag(options, keys, "sourcemap", mustBeStringOrBoolean);
      let sourcefile = getFlag(options, keys, "sourcefile", mustBeString);
      let loader = getFlag(options, keys, "loader", mustBeString);
      let banner = getFlag(options, keys, "banner", mustBeString);
      let footer = getFlag(options, keys, "footer", mustBeString);
      let mangleCache = getFlag(options, keys, "mangleCache", mustBeObject);
      checkForInvalidFlags(options, keys, `in ${callName}() call`);
      if (sourcemap) flags.push(`--sourcemap=${sourcemap === true ? "external" : sourcemap}`);
      if (sourcefile) flags.push(`--sourcefile=${sourcefile}`);
      if (loader) flags.push(`--loader=${loader}`);
      if (banner) flags.push(`--banner=${banner}`);
      if (footer) flags.push(`--footer=${footer}`);
      return {
        flags,
        mangleCache: validateMangleCache(mangleCache),
      };
    }
    __name(flagsForTransformOptions, "flagsForTransformOptions");
    function createChannel(streamIn) {
      const requestCallbacksByKey = {};
      const closeData = { didClose: false, reason: "" };
      let responseCallbacks = {};
      let nextRequestID = 0;
      let nextBuildKey = 0;
      let stdout = new Uint8Array(16 * 1024);
      let stdoutUsed = 0;
      let readFromStdout = /* @__PURE__ */ __name((chunk) => {
        let limit = stdoutUsed + chunk.length;
        if (limit > stdout.length) {
          let swap = new Uint8Array(limit * 2);
          swap.set(stdout);
          stdout = swap;
        }
        stdout.set(chunk, stdoutUsed);
        stdoutUsed += chunk.length;
        let offset = 0;
        while (offset + 4 <= stdoutUsed) {
          let length = readUInt32LE(stdout, offset);
          if (offset + 4 + length > stdoutUsed) {
            break;
          }
          offset += 4;
          handleIncomingPacket(stdout.subarray(offset, offset + length));
          offset += length;
        }
        if (offset > 0) {
          stdout.copyWithin(0, offset, stdoutUsed);
          stdoutUsed -= offset;
        }
      }, "readFromStdout");
      let afterClose = /* @__PURE__ */ __name((error) => {
        closeData.didClose = true;
        if (error) closeData.reason = ": " + (error.message || error);
        const text = "The service was stopped" + closeData.reason;
        for (let id in responseCallbacks) {
          responseCallbacks[id](text, null);
        }
        responseCallbacks = {};
      }, "afterClose");
      let sendRequest = /* @__PURE__ */ __name((refs, value, callback) => {
        if (closeData.didClose)
          return callback("The service is no longer running" + closeData.reason, null);
        let id = nextRequestID++;
        responseCallbacks[id] = (error, response) => {
          try {
            callback(error, response);
          } finally {
            if (refs) refs.unref();
          }
        };
        if (refs) refs.ref();
        streamIn.writeToStdin(encodePacket({ id, isRequest: true, value }));
      }, "sendRequest");
      let sendResponse = /* @__PURE__ */ __name((id, value) => {
        if (closeData.didClose)
          throw new Error("The service is no longer running" + closeData.reason);
        streamIn.writeToStdin(encodePacket({ id, isRequest: false, value }));
      }, "sendResponse");
      let handleRequest = /* @__PURE__ */ __name(async (id, request) => {
        try {
          if (request.command === "ping") {
            sendResponse(id, {});
            return;
          }
          if (typeof request.key === "number") {
            const requestCallbacks = requestCallbacksByKey[request.key];
            if (!requestCallbacks) {
              return;
            }
            const callback = requestCallbacks[request.command];
            if (callback) {
              await callback(id, request);
              return;
            }
          }
          throw new Error(`Invalid command: ` + request.command);
        } catch (e) {
          const errors = [extractErrorMessageV8(e, streamIn, null, void 0, "")];
          try {
            sendResponse(id, { errors });
          } catch {}
        }
      }, "handleRequest");
      let isFirstPacket = true;
      let handleIncomingPacket = /* @__PURE__ */ __name((bytes) => {
        if (isFirstPacket) {
          isFirstPacket = false;
          let binaryVersion = String.fromCharCode(...bytes);
          if (binaryVersion !== "0.23.1") {
            throw new Error(
              `Cannot start service: Host version "${"0.23.1"}" does not match binary version ${quote(binaryVersion)}`,
            );
          }
          return;
        }
        let packet = decodePacket(bytes);
        if (packet.isRequest) {
          handleRequest(packet.id, packet.value);
        } else {
          let callback = responseCallbacks[packet.id];
          delete responseCallbacks[packet.id];
          if (packet.value.error) callback(packet.value.error, {});
          else callback(null, packet.value);
        }
      }, "handleIncomingPacket");
      let buildOrContext = /* @__PURE__ */ __name(
        ({ callName, refs, options, isTTY: isTTY2, defaultWD: defaultWD2, callback }) => {
          let refCount = 0;
          const buildKey = nextBuildKey++;
          const requestCallbacks = {};
          const buildRefs = {
            ref() {
              if (++refCount === 1) {
                if (refs) refs.ref();
              }
            },
            unref() {
              if (--refCount === 0) {
                delete requestCallbacksByKey[buildKey];
                if (refs) refs.unref();
              }
            },
          };
          requestCallbacksByKey[buildKey] = requestCallbacks;
          buildRefs.ref();
          buildOrContextImpl(
            callName,
            buildKey,
            sendRequest,
            sendResponse,
            buildRefs,
            streamIn,
            requestCallbacks,
            options,
            isTTY2,
            defaultWD2,
            (err, res) => {
              try {
                callback(err, res);
              } finally {
                buildRefs.unref();
              }
            },
          );
        },
        "buildOrContext",
      );
      let transform2 = /* @__PURE__ */ __name(
        ({ callName, refs, input, options, isTTY: isTTY2, fs: fs3, callback }) => {
          const details = createObjectStash();
          let start = /* @__PURE__ */ __name((inputPath) => {
            try {
              if (typeof input !== "string" && !(input instanceof Uint8Array))
                throw new Error('The input to "transform" must be a string or a Uint8Array');
              let { flags, mangleCache } = flagsForTransformOptions(
                callName,
                options,
                isTTY2,
                transformLogLevelDefault,
              );
              let request = {
                command: "transform",
                flags,
                inputFS: inputPath !== null,
                input:
                  inputPath !== null
                    ? encodeUTF8(inputPath)
                    : typeof input === "string"
                      ? encodeUTF8(input)
                      : input,
              };
              if (mangleCache) request.mangleCache = mangleCache;
              sendRequest(refs, request, (error, response) => {
                if (error) return callback(new Error(error), null);
                let errors = replaceDetailsInMessages(response.errors, details);
                let warnings = replaceDetailsInMessages(response.warnings, details);
                let outstanding = 1;
                let next = /* @__PURE__ */ __name(() => {
                  if (--outstanding === 0) {
                    let result = {
                      warnings,
                      code: response.code,
                      map: response.map,
                      mangleCache: void 0,
                      legalComments: void 0,
                    };
                    if ("legalComments" in response)
                      result.legalComments = response == null ? void 0 : response.legalComments;
                    if (response.mangleCache)
                      result.mangleCache = response == null ? void 0 : response.mangleCache;
                    callback(null, result);
                  }
                }, "next");
                if (errors.length > 0)
                  return callback(failureErrorWithLog("Transform failed", errors, warnings), null);
                if (response.codeFS) {
                  outstanding++;
                  fs3.readFile(response.code, (err, contents) => {
                    if (err !== null) {
                      callback(err, null);
                    } else {
                      response.code = contents;
                      next();
                    }
                  });
                }
                if (response.mapFS) {
                  outstanding++;
                  fs3.readFile(response.map, (err, contents) => {
                    if (err !== null) {
                      callback(err, null);
                    } else {
                      response.map = contents;
                      next();
                    }
                  });
                }
                next();
              });
            } catch (e) {
              let flags = [];
              try {
                pushLogFlags(flags, options, {}, isTTY2, transformLogLevelDefault);
              } catch {}
              const error = extractErrorMessageV8(e, streamIn, details, void 0, "");
              sendRequest(refs, { command: "error", flags, error }, () => {
                error.detail = details.load(error.detail);
                callback(failureErrorWithLog("Transform failed", [error], []), null);
              });
            }
          }, "start");
          if (
            (typeof input === "string" || input instanceof Uint8Array) &&
            input.length > 1024 * 1024
          ) {
            let next = start;
            start = /* @__PURE__ */ __name(() => fs3.writeFile(input, next), "start");
          }
          start(null);
        },
        "transform2",
      );
      let formatMessages2 = /* @__PURE__ */ __name(
        ({ callName, refs, messages, options, callback }) => {
          if (!options) throw new Error(`Missing second argument in ${callName}() call`);
          let keys = {};
          let kind = getFlag(options, keys, "kind", mustBeString);
          let color = getFlag(options, keys, "color", mustBeBoolean);
          let terminalWidth = getFlag(options, keys, "terminalWidth", mustBeInteger);
          checkForInvalidFlags(options, keys, `in ${callName}() call`);
          if (kind === void 0) throw new Error(`Missing "kind" in ${callName}() call`);
          if (kind !== "error" && kind !== "warning")
            throw new Error(`Expected "kind" to be "error" or "warning" in ${callName}() call`);
          let request = {
            command: "format-msgs",
            messages: sanitizeMessages(messages, "messages", null, "", terminalWidth),
            isWarning: kind === "warning",
          };
          if (color !== void 0) request.color = color;
          if (terminalWidth !== void 0) request.terminalWidth = terminalWidth;
          sendRequest(refs, request, (error, response) => {
            if (error) return callback(new Error(error), null);
            callback(null, response.messages);
          });
        },
        "formatMessages2",
      );
      let analyzeMetafile2 = /* @__PURE__ */ __name(
        ({ callName, refs, metafile, options, callback }) => {
          if (options === void 0) options = {};
          let keys = {};
          let color = getFlag(options, keys, "color", mustBeBoolean);
          let verbose = getFlag(options, keys, "verbose", mustBeBoolean);
          checkForInvalidFlags(options, keys, `in ${callName}() call`);
          let request = {
            command: "analyze-metafile",
            metafile,
          };
          if (color !== void 0) request.color = color;
          if (verbose !== void 0) request.verbose = verbose;
          sendRequest(refs, request, (error, response) => {
            if (error) return callback(new Error(error), null);
            callback(null, response.result);
          });
        },
        "analyzeMetafile2",
      );
      return {
        readFromStdout,
        afterClose,
        service: {
          buildOrContext,
          transform: transform2,
          formatMessages: formatMessages2,
          analyzeMetafile: analyzeMetafile2,
        },
      };
    }
    __name(createChannel, "createChannel");
    function buildOrContextImpl(
      callName,
      buildKey,
      sendRequest,
      sendResponse,
      refs,
      streamIn,
      requestCallbacks,
      options,
      isTTY2,
      defaultWD2,
      callback,
    ) {
      const details = createObjectStash();
      const isContext = callName === "context";
      const handleError = /* @__PURE__ */ __name((e, pluginName) => {
        const flags = [];
        try {
          pushLogFlags(flags, options, {}, isTTY2, buildLogLevelDefault);
        } catch {}
        const message = extractErrorMessageV8(e, streamIn, details, void 0, pluginName);
        sendRequest(refs, { command: "error", flags, error: message }, () => {
          message.detail = details.load(message.detail);
          callback(
            failureErrorWithLog(isContext ? "Context failed" : "Build failed", [message], []),
            null,
          );
        });
      }, "handleError");
      let plugins;
      if (typeof options === "object") {
        const value = options.plugins;
        if (value !== void 0) {
          if (!Array.isArray(value))
            return handleError(new Error(`"plugins" must be an array`), "");
          plugins = value;
        }
      }
      if (plugins && plugins.length > 0) {
        if (streamIn.isSync)
          return handleError(new Error("Cannot use plugins in synchronous API calls"), "");
        handlePlugins(
          buildKey,
          sendRequest,
          sendResponse,
          refs,
          streamIn,
          requestCallbacks,
          options,
          plugins,
          details,
        ).then(
          (result) => {
            if (!result.ok) return handleError(result.error, result.pluginName);
            try {
              buildOrContextContinue(
                result.requestPlugins,
                result.runOnEndCallbacks,
                result.scheduleOnDisposeCallbacks,
              );
            } catch (e) {
              handleError(e, "");
            }
          },
          (e) => handleError(e, ""),
        );
        return;
      }
      try {
        buildOrContextContinue(
          null,
          (result, done) => done([], []),
          () => {},
        );
      } catch (e) {
        handleError(e, "");
      }
      function buildOrContextContinue(
        requestPlugins,
        runOnEndCallbacks,
        scheduleOnDisposeCallbacks,
      ) {
        const writeDefault = streamIn.hasFS;
        const {
          entries,
          flags,
          write,
          stdinContents,
          stdinResolveDir,
          absWorkingDir,
          nodePaths,
          mangleCache,
        } = flagsForBuildOptions(callName, options, isTTY2, buildLogLevelDefault, writeDefault);
        if (write && !streamIn.hasFS)
          throw new Error(`The "write" option is unavailable in this environment`);
        const request = {
          command: "build",
          key: buildKey,
          entries,
          flags,
          write,
          stdinContents,
          stdinResolveDir,
          absWorkingDir: absWorkingDir || defaultWD2,
          nodePaths,
          context: isContext,
        };
        if (requestPlugins) request.plugins = requestPlugins;
        if (mangleCache) request.mangleCache = mangleCache;
        const buildResponseToResult = /* @__PURE__ */ __name((response, callback2) => {
          const result = {
            errors: replaceDetailsInMessages(response.errors, details),
            warnings: replaceDetailsInMessages(response.warnings, details),
            outputFiles: void 0,
            metafile: void 0,
            mangleCache: void 0,
          };
          const originalErrors = result.errors.slice();
          const originalWarnings = result.warnings.slice();
          if (response.outputFiles)
            result.outputFiles = response.outputFiles.map(convertOutputFiles);
          if (response.metafile) result.metafile = JSON.parse(response.metafile);
          if (response.mangleCache) result.mangleCache = response.mangleCache;
          if (response.writeToStdout !== void 0)
            console.log(decodeUTF8(response.writeToStdout).replace(/\n$/, ""));
          runOnEndCallbacks(result, (onEndErrors, onEndWarnings) => {
            if (originalErrors.length > 0 || onEndErrors.length > 0) {
              const error = failureErrorWithLog(
                "Build failed",
                originalErrors.concat(onEndErrors),
                originalWarnings.concat(onEndWarnings),
              );
              return callback2(error, null, onEndErrors, onEndWarnings);
            }
            callback2(null, result, onEndErrors, onEndWarnings);
          });
        }, "buildResponseToResult");
        let latestResultPromise;
        let provideLatestResult;
        if (isContext)
          requestCallbacks["on-end"] = (id, request2) =>
            new Promise((resolve) => {
              buildResponseToResult(request2, (err, result, onEndErrors, onEndWarnings) => {
                const response = {
                  errors: onEndErrors,
                  warnings: onEndWarnings,
                };
                if (provideLatestResult) provideLatestResult(err, result);
                latestResultPromise = void 0;
                provideLatestResult = void 0;
                sendResponse(id, response);
                resolve();
              });
            });
        sendRequest(refs, request, (error, response) => {
          if (error) return callback(new Error(error), null);
          if (!isContext) {
            return buildResponseToResult(response, (err, res) => {
              scheduleOnDisposeCallbacks();
              return callback(err, res);
            });
          }
          if (response.errors.length > 0) {
            return callback(
              failureErrorWithLog("Context failed", response.errors, response.warnings),
              null,
            );
          }
          let didDispose = false;
          const result = {
            rebuild: /* @__PURE__ */ __name(() => {
              if (!latestResultPromise)
                latestResultPromise = new Promise((resolve, reject) => {
                  let settlePromise;
                  provideLatestResult = /* @__PURE__ */ __name((err, result2) => {
                    if (!settlePromise)
                      settlePromise = /* @__PURE__ */ __name(
                        () => (err ? reject(err) : resolve(result2)),
                        "settlePromise",
                      );
                  }, "provideLatestResult");
                  const triggerAnotherBuild = /* @__PURE__ */ __name(() => {
                    const request2 = {
                      command: "rebuild",
                      key: buildKey,
                    };
                    sendRequest(refs, request2, (error2, response2) => {
                      if (error2) {
                        reject(new Error(error2));
                      } else if (settlePromise) {
                        settlePromise();
                      } else {
                        triggerAnotherBuild();
                      }
                    });
                  }, "triggerAnotherBuild");
                  triggerAnotherBuild();
                });
              return latestResultPromise;
            }, "rebuild"),
            watch: /* @__PURE__ */ __name(
              (options2 = {}) =>
                new Promise((resolve, reject) => {
                  if (!streamIn.hasFS)
                    throw new Error(`Cannot use the "watch" API in this environment`);
                  const keys = {};
                  checkForInvalidFlags(options2, keys, `in watch() call`);
                  const request2 = {
                    command: "watch",
                    key: buildKey,
                  };
                  sendRequest(refs, request2, (error2) => {
                    if (error2) reject(new Error(error2));
                    else resolve(void 0);
                  });
                }),
              "watch",
            ),
            serve: /* @__PURE__ */ __name(
              (options2 = {}) =>
                new Promise((resolve, reject) => {
                  if (!streamIn.hasFS)
                    throw new Error(`Cannot use the "serve" API in this environment`);
                  const keys = {};
                  const port = getFlag(options2, keys, "port", mustBeInteger);
                  const host = getFlag(options2, keys, "host", mustBeString);
                  const servedir = getFlag(options2, keys, "servedir", mustBeString);
                  const keyfile = getFlag(options2, keys, "keyfile", mustBeString);
                  const certfile = getFlag(options2, keys, "certfile", mustBeString);
                  const fallback = getFlag(options2, keys, "fallback", mustBeString);
                  const onRequest = getFlag(options2, keys, "onRequest", mustBeFunction);
                  checkForInvalidFlags(options2, keys, `in serve() call`);
                  const request2 = {
                    command: "serve",
                    key: buildKey,
                    onRequest: !!onRequest,
                  };
                  if (port !== void 0) request2.port = port;
                  if (host !== void 0) request2.host = host;
                  if (servedir !== void 0) request2.servedir = servedir;
                  if (keyfile !== void 0) request2.keyfile = keyfile;
                  if (certfile !== void 0) request2.certfile = certfile;
                  if (fallback !== void 0) request2.fallback = fallback;
                  sendRequest(refs, request2, (error2, response2) => {
                    if (error2) return reject(new Error(error2));
                    if (onRequest) {
                      requestCallbacks["serve-request"] = (id, request3) => {
                        onRequest(request3.args);
                        sendResponse(id, {});
                      };
                    }
                    resolve(response2);
                  });
                }),
              "serve",
            ),
            cancel: /* @__PURE__ */ __name(
              () =>
                new Promise((resolve) => {
                  if (didDispose) return resolve();
                  const request2 = {
                    command: "cancel",
                    key: buildKey,
                  };
                  sendRequest(refs, request2, () => {
                    resolve();
                  });
                }),
              "cancel",
            ),
            dispose: /* @__PURE__ */ __name(
              () =>
                new Promise((resolve) => {
                  if (didDispose) return resolve();
                  didDispose = true;
                  const request2 = {
                    command: "dispose",
                    key: buildKey,
                  };
                  sendRequest(refs, request2, () => {
                    resolve();
                    scheduleOnDisposeCallbacks();
                    refs.unref();
                  });
                }),
              "dispose",
            ),
          };
          refs.ref();
          callback(null, result);
        });
      }
      __name(buildOrContextContinue, "buildOrContextContinue");
    }
    __name(buildOrContextImpl, "buildOrContextImpl");
    var handlePlugins = /* @__PURE__ */ __name(
      async (
        buildKey,
        sendRequest,
        sendResponse,
        refs,
        streamIn,
        requestCallbacks,
        initialOptions,
        plugins,
        details,
      ) => {
        let onStartCallbacks = [];
        let onEndCallbacks = [];
        let onResolveCallbacks = {};
        let onLoadCallbacks = {};
        let onDisposeCallbacks = [];
        let nextCallbackID = 0;
        let i = 0;
        let requestPlugins = [];
        let isSetupDone = false;
        plugins = [...plugins];
        for (let item of plugins) {
          let keys = {};
          if (typeof item !== "object") throw new Error(`Plugin at index ${i} must be an object`);
          const name = getFlag(item, keys, "name", mustBeString);
          if (typeof name !== "string" || name === "")
            throw new Error(`Plugin at index ${i} is missing a name`);
          try {
            let setup = getFlag(item, keys, "setup", mustBeFunction);
            if (typeof setup !== "function") throw new Error(`Plugin is missing a setup function`);
            checkForInvalidFlags(item, keys, `on plugin ${quote(name)}`);
            let plugin = {
              name,
              onStart: false,
              onEnd: false,
              onResolve: [],
              onLoad: [],
            };
            i++;
            let resolve = /* @__PURE__ */ __name((path3, options = {}) => {
              if (!isSetupDone)
                throw new Error('Cannot call "resolve" before plugin setup has completed');
              if (typeof path3 !== "string")
                throw new Error(`The path to resolve must be a string`);
              let keys2 = /* @__PURE__ */ Object.create(null);
              let pluginName = getFlag(options, keys2, "pluginName", mustBeString);
              let importer = getFlag(options, keys2, "importer", mustBeString);
              let namespace = getFlag(options, keys2, "namespace", mustBeString);
              let resolveDir = getFlag(options, keys2, "resolveDir", mustBeString);
              let kind = getFlag(options, keys2, "kind", mustBeString);
              let pluginData = getFlag(options, keys2, "pluginData", canBeAnything);
              let importAttributes = getFlag(options, keys2, "with", mustBeObject);
              checkForInvalidFlags(options, keys2, "in resolve() call");
              return new Promise((resolve2, reject) => {
                const request = {
                  command: "resolve",
                  path: path3,
                  key: buildKey,
                  pluginName: name,
                };
                if (pluginName != null) request.pluginName = pluginName;
                if (importer != null) request.importer = importer;
                if (namespace != null) request.namespace = namespace;
                if (resolveDir != null) request.resolveDir = resolveDir;
                if (kind != null) request.kind = kind;
                else throw new Error(`Must specify "kind" when calling "resolve"`);
                if (pluginData != null) request.pluginData = details.store(pluginData);
                if (importAttributes != null)
                  request.with = sanitizeStringMap(importAttributes, "with");
                sendRequest(refs, request, (error, response) => {
                  if (error !== null) reject(new Error(error));
                  else
                    resolve2({
                      errors: replaceDetailsInMessages(response.errors, details),
                      warnings: replaceDetailsInMessages(response.warnings, details),
                      path: response.path,
                      external: response.external,
                      sideEffects: response.sideEffects,
                      namespace: response.namespace,
                      suffix: response.suffix,
                      pluginData: details.load(response.pluginData),
                    });
                });
              });
            }, "resolve");
            let promise = setup({
              initialOptions,
              resolve,
              onStart(callback) {
                let registeredText = `This error came from the "onStart" callback registered here:`;
                let registeredNote = extractCallerV8(
                  new Error(registeredText),
                  streamIn,
                  "onStart",
                );
                onStartCallbacks.push({ name, callback, note: registeredNote });
                plugin.onStart = true;
              },
              onEnd(callback) {
                let registeredText = `This error came from the "onEnd" callback registered here:`;
                let registeredNote = extractCallerV8(new Error(registeredText), streamIn, "onEnd");
                onEndCallbacks.push({ name, callback, note: registeredNote });
                plugin.onEnd = true;
              },
              onResolve(options, callback) {
                let registeredText = `This error came from the "onResolve" callback registered here:`;
                let registeredNote = extractCallerV8(
                  new Error(registeredText),
                  streamIn,
                  "onResolve",
                );
                let keys2 = {};
                let filter = getFlag(options, keys2, "filter", mustBeRegExp);
                let namespace = getFlag(options, keys2, "namespace", mustBeString);
                checkForInvalidFlags(
                  options,
                  keys2,
                  `in onResolve() call for plugin ${quote(name)}`,
                );
                if (filter == null) throw new Error(`onResolve() call is missing a filter`);
                let id = nextCallbackID++;
                onResolveCallbacks[id] = { name, callback, note: registeredNote };
                plugin.onResolve.push({ id, filter: filter.source, namespace: namespace || "" });
              },
              onLoad(options, callback) {
                let registeredText = `This error came from the "onLoad" callback registered here:`;
                let registeredNote = extractCallerV8(new Error(registeredText), streamIn, "onLoad");
                let keys2 = {};
                let filter = getFlag(options, keys2, "filter", mustBeRegExp);
                let namespace = getFlag(options, keys2, "namespace", mustBeString);
                checkForInvalidFlags(options, keys2, `in onLoad() call for plugin ${quote(name)}`);
                if (filter == null) throw new Error(`onLoad() call is missing a filter`);
                let id = nextCallbackID++;
                onLoadCallbacks[id] = { name, callback, note: registeredNote };
                plugin.onLoad.push({ id, filter: filter.source, namespace: namespace || "" });
              },
              onDispose(callback) {
                onDisposeCallbacks.push(callback);
              },
              esbuild: streamIn.esbuild,
            });
            if (promise) await promise;
            requestPlugins.push(plugin);
          } catch (e) {
            return { ok: false, error: e, pluginName: name };
          }
        }
        requestCallbacks["on-start"] = async (id, request) => {
          details.clear();
          let response = { errors: [], warnings: [] };
          await Promise.all(
            onStartCallbacks.map(async ({ name, callback, note }) => {
              try {
                let result = await callback();
                if (result != null) {
                  if (typeof result !== "object")
                    throw new Error(
                      `Expected onStart() callback in plugin ${quote(name)} to return an object`,
                    );
                  let keys = {};
                  let errors = getFlag(result, keys, "errors", mustBeArray);
                  let warnings = getFlag(result, keys, "warnings", mustBeArray);
                  checkForInvalidFlags(
                    result,
                    keys,
                    `from onStart() callback in plugin ${quote(name)}`,
                  );
                  if (errors != null)
                    response.errors.push(
                      ...sanitizeMessages(errors, "errors", details, name, void 0),
                    );
                  if (warnings != null)
                    response.warnings.push(
                      ...sanitizeMessages(warnings, "warnings", details, name, void 0),
                    );
                }
              } catch (e) {
                response.errors.push(
                  extractErrorMessageV8(e, streamIn, details, note && note(), name),
                );
              }
            }),
          );
          sendResponse(id, response);
        };
        requestCallbacks["on-resolve"] = async (id, request) => {
          let response = {},
            name = "",
            callback,
            note;
          for (let id2 of request.ids) {
            try {
              ({ name, callback, note } = onResolveCallbacks[id2]);
              let result = await callback({
                path: request.path,
                importer: request.importer,
                namespace: request.namespace,
                resolveDir: request.resolveDir,
                kind: request.kind,
                pluginData: details.load(request.pluginData),
                with: request.with,
              });
              if (result != null) {
                if (typeof result !== "object")
                  throw new Error(
                    `Expected onResolve() callback in plugin ${quote(name)} to return an object`,
                  );
                let keys = {};
                let pluginName = getFlag(result, keys, "pluginName", mustBeString);
                let path3 = getFlag(result, keys, "path", mustBeString);
                let namespace = getFlag(result, keys, "namespace", mustBeString);
                let suffix = getFlag(result, keys, "suffix", mustBeString);
                let external = getFlag(result, keys, "external", mustBeBoolean);
                let sideEffects = getFlag(result, keys, "sideEffects", mustBeBoolean);
                let pluginData = getFlag(result, keys, "pluginData", canBeAnything);
                let errors = getFlag(result, keys, "errors", mustBeArray);
                let warnings = getFlag(result, keys, "warnings", mustBeArray);
                let watchFiles = getFlag(result, keys, "watchFiles", mustBeArray);
                let watchDirs = getFlag(result, keys, "watchDirs", mustBeArray);
                checkForInvalidFlags(
                  result,
                  keys,
                  `from onResolve() callback in plugin ${quote(name)}`,
                );
                response.id = id2;
                if (pluginName != null) response.pluginName = pluginName;
                if (path3 != null) response.path = path3;
                if (namespace != null) response.namespace = namespace;
                if (suffix != null) response.suffix = suffix;
                if (external != null) response.external = external;
                if (sideEffects != null) response.sideEffects = sideEffects;
                if (pluginData != null) response.pluginData = details.store(pluginData);
                if (errors != null)
                  response.errors = sanitizeMessages(errors, "errors", details, name, void 0);
                if (warnings != null)
                  response.warnings = sanitizeMessages(warnings, "warnings", details, name, void 0);
                if (watchFiles != null)
                  response.watchFiles = sanitizeStringArray(watchFiles, "watchFiles");
                if (watchDirs != null)
                  response.watchDirs = sanitizeStringArray(watchDirs, "watchDirs");
                break;
              }
            } catch (e) {
              response = {
                id: id2,
                errors: [extractErrorMessageV8(e, streamIn, details, note && note(), name)],
              };
              break;
            }
          }
          sendResponse(id, response);
        };
        requestCallbacks["on-load"] = async (id, request) => {
          let response = {},
            name = "",
            callback,
            note;
          for (let id2 of request.ids) {
            try {
              ({ name, callback, note } = onLoadCallbacks[id2]);
              let result = await callback({
                path: request.path,
                namespace: request.namespace,
                suffix: request.suffix,
                pluginData: details.load(request.pluginData),
                with: request.with,
              });
              if (result != null) {
                if (typeof result !== "object")
                  throw new Error(
                    `Expected onLoad() callback in plugin ${quote(name)} to return an object`,
                  );
                let keys = {};
                let pluginName = getFlag(result, keys, "pluginName", mustBeString);
                let contents = getFlag(result, keys, "contents", mustBeStringOrUint8Array);
                let resolveDir = getFlag(result, keys, "resolveDir", mustBeString);
                let pluginData = getFlag(result, keys, "pluginData", canBeAnything);
                let loader = getFlag(result, keys, "loader", mustBeString);
                let errors = getFlag(result, keys, "errors", mustBeArray);
                let warnings = getFlag(result, keys, "warnings", mustBeArray);
                let watchFiles = getFlag(result, keys, "watchFiles", mustBeArray);
                let watchDirs = getFlag(result, keys, "watchDirs", mustBeArray);
                checkForInvalidFlags(
                  result,
                  keys,
                  `from onLoad() callback in plugin ${quote(name)}`,
                );
                response.id = id2;
                if (pluginName != null) response.pluginName = pluginName;
                if (contents instanceof Uint8Array) response.contents = contents;
                else if (contents != null) response.contents = encodeUTF8(contents);
                if (resolveDir != null) response.resolveDir = resolveDir;
                if (pluginData != null) response.pluginData = details.store(pluginData);
                if (loader != null) response.loader = loader;
                if (errors != null)
                  response.errors = sanitizeMessages(errors, "errors", details, name, void 0);
                if (warnings != null)
                  response.warnings = sanitizeMessages(warnings, "warnings", details, name, void 0);
                if (watchFiles != null)
                  response.watchFiles = sanitizeStringArray(watchFiles, "watchFiles");
                if (watchDirs != null)
                  response.watchDirs = sanitizeStringArray(watchDirs, "watchDirs");
                break;
              }
            } catch (e) {
              response = {
                id: id2,
                errors: [extractErrorMessageV8(e, streamIn, details, note && note(), name)],
              };
              break;
            }
          }
          sendResponse(id, response);
        };
        let runOnEndCallbacks = /* @__PURE__ */ __name(
          (result, done) => done([], []),
          "runOnEndCallbacks",
        );
        if (onEndCallbacks.length > 0) {
          runOnEndCallbacks = /* @__PURE__ */ __name((result, done) => {
            (async () => {
              const onEndErrors = [];
              const onEndWarnings = [];
              for (const { name, callback, note } of onEndCallbacks) {
                let newErrors;
                let newWarnings;
                try {
                  const value = await callback(result);
                  if (value != null) {
                    if (typeof value !== "object")
                      throw new Error(
                        `Expected onEnd() callback in plugin ${quote(name)} to return an object`,
                      );
                    let keys = {};
                    let errors = getFlag(value, keys, "errors", mustBeArray);
                    let warnings = getFlag(value, keys, "warnings", mustBeArray);
                    checkForInvalidFlags(
                      value,
                      keys,
                      `from onEnd() callback in plugin ${quote(name)}`,
                    );
                    if (errors != null)
                      newErrors = sanitizeMessages(errors, "errors", details, name, void 0);
                    if (warnings != null)
                      newWarnings = sanitizeMessages(warnings, "warnings", details, name, void 0);
                  }
                } catch (e) {
                  newErrors = [extractErrorMessageV8(e, streamIn, details, note && note(), name)];
                }
                if (newErrors) {
                  onEndErrors.push(...newErrors);
                  try {
                    result.errors.push(...newErrors);
                  } catch {}
                }
                if (newWarnings) {
                  onEndWarnings.push(...newWarnings);
                  try {
                    result.warnings.push(...newWarnings);
                  } catch {}
                }
              }
              done(onEndErrors, onEndWarnings);
            })();
          }, "runOnEndCallbacks");
        }
        let scheduleOnDisposeCallbacks = /* @__PURE__ */ __name(() => {
          for (const cb of onDisposeCallbacks) {
            setTimeout(() => cb(), 0);
          }
        }, "scheduleOnDisposeCallbacks");
        isSetupDone = true;
        return {
          ok: true,
          requestPlugins,
          runOnEndCallbacks,
          scheduleOnDisposeCallbacks,
        };
      },
      "handlePlugins",
    );
    function createObjectStash() {
      const map = /* @__PURE__ */ new Map();
      let nextID = 0;
      return {
        clear() {
          map.clear();
        },
        load(id) {
          return map.get(id);
        },
        store(value) {
          if (value === void 0) return -1;
          const id = nextID++;
          map.set(id, value);
          return id;
        },
      };
    }
    __name(createObjectStash, "createObjectStash");
    function extractCallerV8(e, streamIn, ident) {
      let note;
      let tried = false;
      return () => {
        if (tried) return note;
        tried = true;
        try {
          let lines = (e.stack + "").split("\n");
          lines.splice(1, 1);
          let location = parseStackLinesV8(streamIn, lines, ident);
          if (location) {
            note = { text: e.message, location };
            return note;
          }
        } catch {}
      };
    }
    __name(extractCallerV8, "extractCallerV8");
    function extractErrorMessageV8(e, streamIn, stash, note, pluginName) {
      let text = "Internal error";
      let location = null;
      try {
        text = ((e && e.message) || e) + "";
      } catch {}
      try {
        location = parseStackLinesV8(streamIn, (e.stack + "").split("\n"), "");
      } catch {}
      return {
        id: "",
        pluginName,
        text,
        location,
        notes: note ? [note] : [],
        detail: stash ? stash.store(e) : -1,
      };
    }
    __name(extractErrorMessageV8, "extractErrorMessageV8");
    function parseStackLinesV8(streamIn, lines, ident) {
      let at = "    at ";
      if (streamIn.readFileSync && !lines[0].startsWith(at) && lines[1].startsWith(at)) {
        for (let i = 1; i < lines.length; i++) {
          let line = lines[i];
          if (!line.startsWith(at)) continue;
          line = line.slice(at.length);
          while (true) {
            let match = /^(?:new |async )?\S+ \((.*)\)$/.exec(line);
            if (match) {
              line = match[1];
              continue;
            }
            match = /^eval at \S+ \((.*)\)(?:, \S+:\d+:\d+)?$/.exec(line);
            if (match) {
              line = match[1];
              continue;
            }
            match = /^(\S+):(\d+):(\d+)$/.exec(line);
            if (match) {
              let contents;
              try {
                contents = streamIn.readFileSync(match[1], "utf8");
              } catch {
                break;
              }
              let lineText = contents.split(/\r\n|\r|\n|\u2028|\u2029/)[+match[2] - 1] || "";
              let column = +match[3] - 1;
              let length =
                lineText.slice(column, column + ident.length) === ident ? ident.length : 0;
              return {
                file: match[1],
                namespace: "file",
                line: +match[2],
                column: encodeUTF8(lineText.slice(0, column)).length,
                length: encodeUTF8(lineText.slice(column, column + length)).length,
                lineText: lineText + "\n" + lines.slice(1).join("\n"),
                suggestion: "",
              };
            }
            break;
          }
        }
      }
      return null;
    }
    __name(parseStackLinesV8, "parseStackLinesV8");
    function failureErrorWithLog(text, errors, warnings) {
      let limit = 5;
      text +=
        errors.length < 1
          ? ""
          : ` with ${errors.length} error${errors.length < 2 ? "" : "s"}:` +
            errors
              .slice(0, limit + 1)
              .map((e, i) => {
                if (i === limit) return "\n...";
                if (!e.location)
                  return `
error: ${e.text}`;
                let { file, line, column } = e.location;
                let pluginText = e.pluginName ? `[plugin: ${e.pluginName}] ` : "";
                return `
${file}:${line}:${column}: ERROR: ${pluginText}${e.text}`;
              })
              .join("");
      let error = new Error(text);
      for (const [key, value] of [
        ["errors", errors],
        ["warnings", warnings],
      ]) {
        Object.defineProperty(error, key, {
          configurable: true,
          enumerable: true,
          get: /* @__PURE__ */ __name(() => value, "get"),
          set: /* @__PURE__ */ __name(
            (value2) =>
              Object.defineProperty(error, key, {
                configurable: true,
                enumerable: true,
                value: value2,
              }),
            "set",
          ),
        });
      }
      return error;
    }
    __name(failureErrorWithLog, "failureErrorWithLog");
    function replaceDetailsInMessages(messages, stash) {
      for (const message of messages) {
        message.detail = stash.load(message.detail);
      }
      return messages;
    }
    __name(replaceDetailsInMessages, "replaceDetailsInMessages");
    function sanitizeLocation(location, where, terminalWidth) {
      if (location == null) return null;
      let keys = {};
      let file = getFlag(location, keys, "file", mustBeString);
      let namespace = getFlag(location, keys, "namespace", mustBeString);
      let line = getFlag(location, keys, "line", mustBeInteger);
      let column = getFlag(location, keys, "column", mustBeInteger);
      let length = getFlag(location, keys, "length", mustBeInteger);
      let lineText = getFlag(location, keys, "lineText", mustBeString);
      let suggestion = getFlag(location, keys, "suggestion", mustBeString);
      checkForInvalidFlags(location, keys, where);
      if (lineText) {
        const relevantASCII = lineText.slice(
          0,
          (column && column > 0 ? column : 0) +
            (length && length > 0 ? length : 0) +
            (terminalWidth && terminalWidth > 0 ? terminalWidth : 80),
        );
        if (!/[\x7F-\uFFFF]/.test(relevantASCII) && !/\n/.test(lineText)) {
          lineText = relevantASCII;
        }
      }
      return {
        file: file || "",
        namespace: namespace || "",
        line: line || 0,
        column: column || 0,
        length: length || 0,
        lineText: lineText || "",
        suggestion: suggestion || "",
      };
    }
    __name(sanitizeLocation, "sanitizeLocation");
    function sanitizeMessages(messages, property, stash, fallbackPluginName, terminalWidth) {
      let messagesClone = [];
      let index = 0;
      for (const message of messages) {
        let keys = {};
        let id = getFlag(message, keys, "id", mustBeString);
        let pluginName = getFlag(message, keys, "pluginName", mustBeString);
        let text = getFlag(message, keys, "text", mustBeString);
        let location = getFlag(message, keys, "location", mustBeObjectOrNull);
        let notes = getFlag(message, keys, "notes", mustBeArray);
        let detail = getFlag(message, keys, "detail", canBeAnything);
        let where = `in element ${index} of "${property}"`;
        checkForInvalidFlags(message, keys, where);
        let notesClone = [];
        if (notes) {
          for (const note of notes) {
            let noteKeys = {};
            let noteText = getFlag(note, noteKeys, "text", mustBeString);
            let noteLocation = getFlag(note, noteKeys, "location", mustBeObjectOrNull);
            checkForInvalidFlags(note, noteKeys, where);
            notesClone.push({
              text: noteText || "",
              location: sanitizeLocation(noteLocation, where, terminalWidth),
            });
          }
        }
        messagesClone.push({
          id: id || "",
          pluginName: pluginName || fallbackPluginName,
          text: text || "",
          location: sanitizeLocation(location, where, terminalWidth),
          notes: notesClone,
          detail: stash ? stash.store(detail) : -1,
        });
        index++;
      }
      return messagesClone;
    }
    __name(sanitizeMessages, "sanitizeMessages");
    function sanitizeStringArray(values, property) {
      const result = [];
      for (const value of values) {
        if (typeof value !== "string")
          throw new Error(`${quote(property)} must be an array of strings`);
        result.push(value);
      }
      return result;
    }
    __name(sanitizeStringArray, "sanitizeStringArray");
    function sanitizeStringMap(map, property) {
      const result = /* @__PURE__ */ Object.create(null);
      for (const key in map) {
        const value = map[key];
        if (typeof value !== "string")
          throw new Error(`key ${quote(key)} in object ${quote(property)} must be a string`);
        result[key] = value;
      }
      return result;
    }
    __name(sanitizeStringMap, "sanitizeStringMap");
    function convertOutputFiles({ path: path3, contents, hash }) {
      let text = null;
      return {
        path: path3,
        contents,
        hash,
        get text() {
          const binary = this.contents;
          if (text === null || binary !== contents) {
            contents = binary;
            text = decodeUTF8(binary);
          }
          return text;
        },
      };
    }
    __name(convertOutputFiles, "convertOutputFiles");
    var fs = __require("fs");
    var os2 = __require("os");
    var path = __require("path");
    var ESBUILD_BINARY_PATH = process.env.ESBUILD_BINARY_PATH || ESBUILD_BINARY_PATH;
    var isValidBinaryPath = /* @__PURE__ */ __name(
      (x) => !!x && x !== "/usr/bin/esbuild",
      "isValidBinaryPath",
    );
    var packageDarwin_arm64 = "@esbuild/darwin-arm64";
    var packageDarwin_x64 = "@esbuild/darwin-x64";
    var knownWindowsPackages = {
      "win32 arm64 LE": "@esbuild/win32-arm64",
      "win32 ia32 LE": "@esbuild/win32-ia32",
      "win32 x64 LE": "@esbuild/win32-x64",
    };
    var knownUnixlikePackages = {
      "aix ppc64 BE": "@esbuild/aix-ppc64",
      "android arm64 LE": "@esbuild/android-arm64",
      "darwin arm64 LE": "@esbuild/darwin-arm64",
      "darwin x64 LE": "@esbuild/darwin-x64",
      "freebsd arm64 LE": "@esbuild/freebsd-arm64",
      "freebsd x64 LE": "@esbuild/freebsd-x64",
      "linux arm LE": "@esbuild/linux-arm",
      "linux arm64 LE": "@esbuild/linux-arm64",
      "linux ia32 LE": "@esbuild/linux-ia32",
      "linux mips64el LE": "@esbuild/linux-mips64el",
      "linux ppc64 LE": "@esbuild/linux-ppc64",
      "linux riscv64 LE": "@esbuild/linux-riscv64",
      "linux s390x BE": "@esbuild/linux-s390x",
      "linux x64 LE": "@esbuild/linux-x64",
      "linux loong64 LE": "@esbuild/linux-loong64",
      "netbsd x64 LE": "@esbuild/netbsd-x64",
      "openbsd arm64 LE": "@esbuild/openbsd-arm64",
      "openbsd x64 LE": "@esbuild/openbsd-x64",
      "sunos x64 LE": "@esbuild/sunos-x64",
    };
    var knownWebAssemblyFallbackPackages = {
      "android arm LE": "@esbuild/android-arm",
      "android x64 LE": "@esbuild/android-x64",
    };
    function pkgAndSubpathForCurrentPlatform() {
      let pkg;
      let subpath;
      let isWASM = false;
      let platformKey = `${process.platform} ${os2.arch()} ${os2.endianness()}`;
      if (platformKey in knownWindowsPackages) {
        pkg = knownWindowsPackages[platformKey];
        subpath = "esbuild.exe";
      } else if (platformKey in knownUnixlikePackages) {
        pkg = knownUnixlikePackages[platformKey];
        subpath = "bin/esbuild";
      } else if (platformKey in knownWebAssemblyFallbackPackages) {
        pkg = knownWebAssemblyFallbackPackages[platformKey];
        subpath = "bin/esbuild";
        isWASM = true;
      } else {
        throw new Error(`Unsupported platform: ${platformKey}`);
      }
      return { pkg, subpath, isWASM };
    }
    __name(pkgAndSubpathForCurrentPlatform, "pkgAndSubpathForCurrentPlatform");
    function pkgForSomeOtherPlatform() {
      const libMainJS = __require.resolve("esbuild");
      const nodeModulesDirectory = path.dirname(path.dirname(path.dirname(libMainJS)));
      if (path.basename(nodeModulesDirectory) === "node_modules") {
        for (const unixKey in knownUnixlikePackages) {
          try {
            const pkg = knownUnixlikePackages[unixKey];
            if (fs.existsSync(path.join(nodeModulesDirectory, pkg))) return pkg;
          } catch {}
        }
        for (const windowsKey in knownWindowsPackages) {
          try {
            const pkg = knownWindowsPackages[windowsKey];
            if (fs.existsSync(path.join(nodeModulesDirectory, pkg))) return pkg;
          } catch {}
        }
      }
      return null;
    }
    __name(pkgForSomeOtherPlatform, "pkgForSomeOtherPlatform");
    function downloadedBinPath(pkg, subpath) {
      const esbuildLibDir = path.dirname(__require.resolve("esbuild"));
      return path.join(
        esbuildLibDir,
        `downloaded-${pkg.replace("/", "-")}-${path.basename(subpath)}`,
      );
    }
    __name(downloadedBinPath, "downloadedBinPath");
    function generateBinPath() {
      if (isValidBinaryPath(ESBUILD_BINARY_PATH)) {
        if (!fs.existsSync(ESBUILD_BINARY_PATH)) {
          console.warn(
            `[esbuild] Ignoring bad configuration: ESBUILD_BINARY_PATH=${ESBUILD_BINARY_PATH}`,
          );
        } else {
          return { binPath: ESBUILD_BINARY_PATH, isWASM: false };
        }
      }
      const { pkg, subpath, isWASM } = pkgAndSubpathForCurrentPlatform();
      let binPath;
      try {
        binPath = __require.resolve(`${pkg}/${subpath}`);
      } catch (e) {
        binPath = downloadedBinPath(pkg, subpath);
        if (!fs.existsSync(binPath)) {
          try {
            __require.resolve(pkg);
          } catch {
            const otherPkg = pkgForSomeOtherPlatform();
            if (otherPkg) {
              let suggestions = `
Specifically the "${otherPkg}" package is present but this platform
needs the "${pkg}" package instead. People often get into this
situation by installing esbuild on Windows or macOS and copying "node_modules"
into a Docker image that runs Linux, or by copying "node_modules" between
Windows and WSL environments.

If you are installing with npm, you can try not copying the "node_modules"
directory when you copy the files over, and running "npm ci" or "npm install"
on the destination platform after the copy. Or you could consider using yarn
instead of npm which has built-in support for installing a package on multiple
platforms simultaneously.

If you are installing with yarn, you can try listing both this platform and the
other platform in your ".yarnrc.yml" file using the "supportedArchitectures"
feature: https://yarnpkg.com/configuration/yarnrc/#supportedArchitectures
Keep in mind that this means multiple copies of esbuild will be present.
`;
              if (
                (pkg === packageDarwin_x64 && otherPkg === packageDarwin_arm64) ||
                (pkg === packageDarwin_arm64 && otherPkg === packageDarwin_x64)
              ) {
                suggestions = `
Specifically the "${otherPkg}" package is present but this platform
needs the "${pkg}" package instead. People often get into this
situation by installing esbuild with npm running inside of Rosetta 2 and then
trying to use it with node running outside of Rosetta 2, or vice versa (Rosetta
2 is Apple's on-the-fly x86_64-to-arm64 translation service).

If you are installing with npm, you can try ensuring that both npm and node are
not running under Rosetta 2 and then reinstalling esbuild. This likely involves
changing how you installed npm and/or node. For example, installing node with
the universal installer here should work: https://nodejs.org/en/download/. Or
you could consider using yarn instead of npm which has built-in support for
installing a package on multiple platforms simultaneously.

If you are installing with yarn, you can try listing both "arm64" and "x64"
in your ".yarnrc.yml" file using the "supportedArchitectures" feature:
https://yarnpkg.com/configuration/yarnrc/#supportedArchitectures
Keep in mind that this means multiple copies of esbuild will be present.
`;
              }
              throw new Error(`
You installed esbuild for another platform than the one you're currently using.
This won't work because esbuild is written with native code and needs to
install a platform-specific binary executable.
${suggestions}
Another alternative is to use the "esbuild-wasm" package instead, which works
the same way on all platforms. But it comes with a heavy performance cost and
can sometimes be 10x slower than the "esbuild" package, so you may also not
want to do that.
`);
            }
            throw new Error(`The package "${pkg}" could not be found, and is needed by esbuild.

If you are installing esbuild with npm, make sure that you don't specify the
"--no-optional" or "--omit=optional" flags. The "optionalDependencies" feature
of "package.json" is used by esbuild to install the correct binary executable
for your current platform.`);
          }
          throw e;
        }
      }
      if (/\.zip\//.test(binPath)) {
        let pnpapi;
        try {
          pnpapi = __require("pnpapi");
        } catch (e) {}
        if (pnpapi) {
          const root = pnpapi.getPackageInformation(pnpapi.topLevel).packageLocation;
          const binTargetPath = path.join(
            root,
            "node_modules",
            ".cache",
            "esbuild",
            `pnpapi-${pkg.replace("/", "-")}-${"0.23.1"}-${path.basename(subpath)}`,
          );
          if (!fs.existsSync(binTargetPath)) {
            fs.mkdirSync(path.dirname(binTargetPath), { recursive: true });
            fs.copyFileSync(binPath, binTargetPath);
            fs.chmodSync(binTargetPath, 493);
          }
          return { binPath: binTargetPath, isWASM };
        }
      }
      return { binPath, isWASM };
    }
    __name(generateBinPath, "generateBinPath");
    var child_process = __require("child_process");
    var crypto = __require("crypto");
    var path2 = __require("path");
    var fs2 = __require("fs");
    var os22 = __require("os");
    var tty2 = __require("tty");
    var worker_threads;
    if (process.env.ESBUILD_WORKER_THREADS !== "0") {
      try {
        worker_threads = __require("worker_threads");
      } catch {}
      let [major, minor] = process.versions.node.split(".");
      if (
        // <v12.17.0 does not work
        +major < 12 ||
        (+major === 12 && +minor < 17) ||
        (+major === 13 && +minor < 13)
      ) {
        worker_threads = void 0;
      }
    }
    var _a;
    var isInternalWorkerThread =
      ((_a = worker_threads == null ? void 0 : worker_threads.workerData) == null
        ? void 0
        : _a.esbuildVersion) === "0.23.1";
    var esbuildCommandAndArgs = /* @__PURE__ */ __name(() => {
      if (
        (!ESBUILD_BINARY_PATH || false) &&
        (path2.basename(__filename) !== "main.js" || path2.basename(__dirname) !== "lib")
      ) {
        throw new Error(
          `The esbuild JavaScript API cannot be bundled. Please mark the "esbuild" package as external so it's not included in the bundle.

More information: The file containing the code for esbuild's JavaScript API (${__filename}) does not appear to be inside the esbuild package on the file system, which usually means that the esbuild package was bundled into another file. This is problematic because the API needs to run a binary executable inside the esbuild package which is located using a relative path from the API code to the executable. If the esbuild package is bundled, the relative path will be incorrect and the executable won't be found.`,
        );
      }
      if (false) {
        return ["node", [path2.join(__dirname, "..", "bin", "esbuild")]];
      } else {
        const { binPath, isWASM } = generateBinPath();
        if (isWASM) {
          return ["node", [binPath]];
        } else {
          return [binPath, []];
        }
      }
    }, "esbuildCommandAndArgs");
    var isTTY = /* @__PURE__ */ __name(() => tty2.isatty(2), "isTTY");
    var fsSync = {
      readFile(tempFile, callback) {
        try {
          let contents = fs2.readFileSync(tempFile, "utf8");
          try {
            fs2.unlinkSync(tempFile);
          } catch {}
          callback(null, contents);
        } catch (err) {
          callback(err, null);
        }
      },
      writeFile(contents, callback) {
        try {
          let tempFile = randomFileName();
          fs2.writeFileSync(tempFile, contents);
          callback(tempFile);
        } catch {
          callback(null);
        }
      },
    };
    var fsAsync = {
      readFile(tempFile, callback) {
        try {
          fs2.readFile(tempFile, "utf8", (err, contents) => {
            try {
              fs2.unlink(tempFile, () => callback(err, contents));
            } catch {
              callback(err, contents);
            }
          });
        } catch (err) {
          callback(err, null);
        }
      },
      writeFile(contents, callback) {
        try {
          let tempFile = randomFileName();
          fs2.writeFile(tempFile, contents, (err) =>
            err !== null ? callback(null) : callback(tempFile),
          );
        } catch {
          callback(null);
        }
      },
    };
    var version = "0.23.1";
    var build = /* @__PURE__ */ __name(
      (options) => ensureServiceIsRunning().build(options),
      "build",
    );
    var context = /* @__PURE__ */ __name(
      (buildOptions) => ensureServiceIsRunning().context(buildOptions),
      "context",
    );
    var transform = /* @__PURE__ */ __name(
      (input, options) => ensureServiceIsRunning().transform(input, options),
      "transform",
    );
    var formatMessages = /* @__PURE__ */ __name(
      (messages, options) => ensureServiceIsRunning().formatMessages(messages, options),
      "formatMessages",
    );
    var analyzeMetafile = /* @__PURE__ */ __name(
      (messages, options) => ensureServiceIsRunning().analyzeMetafile(messages, options),
      "analyzeMetafile",
    );
    var buildSync = /* @__PURE__ */ __name((options) => {
      if (worker_threads && !isInternalWorkerThread) {
        if (!workerThreadService) workerThreadService = startWorkerThreadService(worker_threads);
        return workerThreadService.buildSync(options);
      }
      let result;
      runServiceSync((service) =>
        service.buildOrContext({
          callName: "buildSync",
          refs: null,
          options,
          isTTY: isTTY(),
          defaultWD,
          callback: /* @__PURE__ */ __name((err, res) => {
            if (err) throw err;
            result = res;
          }, "callback"),
        }),
      );
      return result;
    }, "buildSync");
    var transformSync = /* @__PURE__ */ __name((input, options) => {
      if (worker_threads && !isInternalWorkerThread) {
        if (!workerThreadService) workerThreadService = startWorkerThreadService(worker_threads);
        return workerThreadService.transformSync(input, options);
      }
      let result;
      runServiceSync((service) =>
        service.transform({
          callName: "transformSync",
          refs: null,
          input,
          options: options || {},
          isTTY: isTTY(),
          fs: fsSync,
          callback: /* @__PURE__ */ __name((err, res) => {
            if (err) throw err;
            result = res;
          }, "callback"),
        }),
      );
      return result;
    }, "transformSync");
    var formatMessagesSync2 = /* @__PURE__ */ __name((messages, options) => {
      if (worker_threads && !isInternalWorkerThread) {
        if (!workerThreadService) workerThreadService = startWorkerThreadService(worker_threads);
        return workerThreadService.formatMessagesSync(messages, options);
      }
      let result;
      runServiceSync((service) =>
        service.formatMessages({
          callName: "formatMessagesSync",
          refs: null,
          messages,
          options,
          callback: /* @__PURE__ */ __name((err, res) => {
            if (err) throw err;
            result = res;
          }, "callback"),
        }),
      );
      return result;
    }, "formatMessagesSync");
    var analyzeMetafileSync = /* @__PURE__ */ __name((metafile, options) => {
      if (worker_threads && !isInternalWorkerThread) {
        if (!workerThreadService) workerThreadService = startWorkerThreadService(worker_threads);
        return workerThreadService.analyzeMetafileSync(metafile, options);
      }
      let result;
      runServiceSync((service) =>
        service.analyzeMetafile({
          callName: "analyzeMetafileSync",
          refs: null,
          metafile: typeof metafile === "string" ? metafile : JSON.stringify(metafile),
          options,
          callback: /* @__PURE__ */ __name((err, res) => {
            if (err) throw err;
            result = res;
          }, "callback"),
        }),
      );
      return result;
    }, "analyzeMetafileSync");
    var stop = /* @__PURE__ */ __name(() => {
      if (stopService) stopService();
      if (workerThreadService) workerThreadService.stop();
      return Promise.resolve();
    }, "stop");
    var initializeWasCalled = false;
    var initialize = /* @__PURE__ */ __name((options) => {
      options = validateInitializeOptions(options || {});
      if (options.wasmURL) throw new Error(`The "wasmURL" option only works in the browser`);
      if (options.wasmModule) throw new Error(`The "wasmModule" option only works in the browser`);
      if (options.worker) throw new Error(`The "worker" option only works in the browser`);
      if (initializeWasCalled) throw new Error('Cannot call "initialize" more than once');
      ensureServiceIsRunning();
      initializeWasCalled = true;
      return Promise.resolve();
    }, "initialize");
    var defaultWD = process.cwd();
    var longLivedService;
    var stopService;
    var ensureServiceIsRunning = /* @__PURE__ */ __name(() => {
      if (longLivedService) return longLivedService;
      let [command, args] = esbuildCommandAndArgs();
      let child = child_process.spawn(command, args.concat(`--service=${"0.23.1"}`, "--ping"), {
        windowsHide: true,
        stdio: ["pipe", "pipe", "inherit"],
        cwd: defaultWD,
      });
      let { readFromStdout, afterClose, service } = createChannel({
        writeToStdin(bytes) {
          child.stdin.write(bytes, (err) => {
            if (err) afterClose(err);
          });
        },
        readFileSync: fs2.readFileSync,
        isSync: false,
        hasFS: true,
        esbuild: node_exports,
      });
      child.stdin.on("error", afterClose);
      child.on("error", afterClose);
      const stdin = child.stdin;
      const stdout = child.stdout;
      stdout.on("data", readFromStdout);
      stdout.on("end", afterClose);
      stopService = /* @__PURE__ */ __name(() => {
        stdin.destroy();
        stdout.destroy();
        child.kill();
        initializeWasCalled = false;
        longLivedService = void 0;
        stopService = void 0;
      }, "stopService");
      let refCount = 0;
      child.unref();
      if (stdin.unref) {
        stdin.unref();
      }
      if (stdout.unref) {
        stdout.unref();
      }
      const refs = {
        ref() {
          if (++refCount === 1) child.ref();
        },
        unref() {
          if (--refCount === 0) child.unref();
        },
      };
      longLivedService = {
        build: /* @__PURE__ */ __name(
          (options) =>
            new Promise((resolve, reject) => {
              service.buildOrContext({
                callName: "build",
                refs,
                options,
                isTTY: isTTY(),
                defaultWD,
                callback: /* @__PURE__ */ __name(
                  (err, res) => (err ? reject(err) : resolve(res)),
                  "callback",
                ),
              });
            }),
          "build",
        ),
        context: /* @__PURE__ */ __name(
          (options) =>
            new Promise((resolve, reject) =>
              service.buildOrContext({
                callName: "context",
                refs,
                options,
                isTTY: isTTY(),
                defaultWD,
                callback: /* @__PURE__ */ __name(
                  (err, res) => (err ? reject(err) : resolve(res)),
                  "callback",
                ),
              }),
            ),
          "context",
        ),
        transform: /* @__PURE__ */ __name(
          (input, options) =>
            new Promise((resolve, reject) =>
              service.transform({
                callName: "transform",
                refs,
                input,
                options: options || {},
                isTTY: isTTY(),
                fs: fsAsync,
                callback: /* @__PURE__ */ __name(
                  (err, res) => (err ? reject(err) : resolve(res)),
                  "callback",
                ),
              }),
            ),
          "transform",
        ),
        formatMessages: /* @__PURE__ */ __name(
          (messages, options) =>
            new Promise((resolve, reject) =>
              service.formatMessages({
                callName: "formatMessages",
                refs,
                messages,
                options,
                callback: /* @__PURE__ */ __name(
                  (err, res) => (err ? reject(err) : resolve(res)),
                  "callback",
                ),
              }),
            ),
          "formatMessages",
        ),
        analyzeMetafile: /* @__PURE__ */ __name(
          (metafile, options) =>
            new Promise((resolve, reject) =>
              service.analyzeMetafile({
                callName: "analyzeMetafile",
                refs,
                metafile: typeof metafile === "string" ? metafile : JSON.stringify(metafile),
                options,
                callback: /* @__PURE__ */ __name(
                  (err, res) => (err ? reject(err) : resolve(res)),
                  "callback",
                ),
              }),
            ),
          "analyzeMetafile",
        ),
      };
      return longLivedService;
    }, "ensureServiceIsRunning");
    var runServiceSync = /* @__PURE__ */ __name((callback) => {
      let [command, args] = esbuildCommandAndArgs();
      let stdin = new Uint8Array();
      let { readFromStdout, afterClose, service } = createChannel({
        writeToStdin(bytes) {
          if (stdin.length !== 0) throw new Error("Must run at most one command");
          stdin = bytes;
        },
        isSync: true,
        hasFS: true,
        esbuild: node_exports,
      });
      callback(service);
      let stdout = child_process.execFileSync(command, args.concat(`--service=${"0.23.1"}`), {
        cwd: defaultWD,
        windowsHide: true,
        input: stdin,
        // We don't know how large the output could be. If it's too large, the
        // command will fail with ENOBUFS. Reserve 16mb for now since that feels
        // like it should be enough. Also allow overriding this with an environment
        // variable.
        maxBuffer: +process.env.ESBUILD_MAX_BUFFER || 16 * 1024 * 1024,
      });
      readFromStdout(stdout);
      afterClose(null);
    }, "runServiceSync");
    var randomFileName = /* @__PURE__ */ __name(() => {
      return path2.join(os22.tmpdir(), `esbuild-${crypto.randomBytes(32).toString("hex")}`);
    }, "randomFileName");
    var workerThreadService = null;
    var startWorkerThreadService = /* @__PURE__ */ __name((worker_threads2) => {
      let { port1: mainPort, port2: workerPort } = new worker_threads2.MessageChannel();
      let worker = new worker_threads2.Worker(__filename, {
        workerData: { workerPort, defaultWD, esbuildVersion: "0.23.1" },
        transferList: [workerPort],
        // From node's documentation: https://nodejs.org/api/worker_threads.html
        //
        //   Take care when launching worker threads from preload scripts (scripts loaded
        //   and run using the `-r` command line flag). Unless the `execArgv` option is
        //   explicitly set, new Worker threads automatically inherit the command line flags
        //   from the running process and will preload the same preload scripts as the main
        //   thread. If the preload script unconditionally launches a worker thread, every
        //   thread spawned will spawn another until the application crashes.
        //
        execArgv: [],
      });
      let nextID = 0;
      let fakeBuildError = /* @__PURE__ */ __name((text) => {
        let error = new Error(`Build failed with 1 error:
error: ${text}`);
        let errors = [{ id: "", pluginName: "", text, location: null, notes: [], detail: void 0 }];
        error.errors = errors;
        error.warnings = [];
        return error;
      }, "fakeBuildError");
      let validateBuildSyncOptions = /* @__PURE__ */ __name((options) => {
        if (!options) return;
        let plugins = options.plugins;
        if (plugins && plugins.length > 0)
          throw fakeBuildError(`Cannot use plugins in synchronous API calls`);
      }, "validateBuildSyncOptions");
      let applyProperties = /* @__PURE__ */ __name((object, properties) => {
        for (let key in properties) {
          object[key] = properties[key];
        }
      }, "applyProperties");
      let runCallSync = /* @__PURE__ */ __name((command, args) => {
        let id = nextID++;
        let sharedBuffer = new SharedArrayBuffer(8);
        let sharedBufferView = new Int32Array(sharedBuffer);
        let msg = { sharedBuffer, id, command, args };
        worker.postMessage(msg);
        let status = Atomics.wait(sharedBufferView, 0, 0);
        if (status !== "ok" && status !== "not-equal")
          throw new Error("Internal error: Atomics.wait() failed: " + status);
        let {
          message: { id: id2, resolve, reject, properties },
        } = worker_threads2.receiveMessageOnPort(mainPort);
        if (id !== id2) throw new Error(`Internal error: Expected id ${id} but got id ${id2}`);
        if (reject) {
          applyProperties(reject, properties);
          throw reject;
        }
        return resolve;
      }, "runCallSync");
      worker.unref();
      return {
        buildSync(options) {
          validateBuildSyncOptions(options);
          return runCallSync("build", [options]);
        },
        transformSync(input, options) {
          return runCallSync("transform", [input, options]);
        },
        formatMessagesSync(messages, options) {
          return runCallSync("formatMessages", [messages, options]);
        },
        analyzeMetafileSync(metafile, options) {
          return runCallSync("analyzeMetafile", [metafile, options]);
        },
        stop() {
          worker.terminate();
          workerThreadService = null;
        },
      };
    }, "startWorkerThreadService");
    var startSyncServiceWorker = /* @__PURE__ */ __name(() => {
      let workerPort = worker_threads.workerData.workerPort;
      let parentPort = worker_threads.parentPort;
      let extractProperties = /* @__PURE__ */ __name((object) => {
        let properties = {};
        if (object && typeof object === "object") {
          for (let key in object) {
            properties[key] = object[key];
          }
        }
        return properties;
      }, "extractProperties");
      try {
        let service = ensureServiceIsRunning();
        defaultWD = worker_threads.workerData.defaultWD;
        parentPort.on("message", (msg) => {
          (async () => {
            let { sharedBuffer, id, command, args } = msg;
            let sharedBufferView = new Int32Array(sharedBuffer);
            try {
              switch (command) {
                case "build":
                  workerPort.postMessage({ id, resolve: await service.build(args[0]) });
                  break;
                case "transform":
                  workerPort.postMessage({
                    id,
                    resolve: await service.transform(args[0], args[1]),
                  });
                  break;
                case "formatMessages":
                  workerPort.postMessage({
                    id,
                    resolve: await service.formatMessages(args[0], args[1]),
                  });
                  break;
                case "analyzeMetafile":
                  workerPort.postMessage({
                    id,
                    resolve: await service.analyzeMetafile(args[0], args[1]),
                  });
                  break;
                default:
                  throw new Error(`Invalid command: ${command}`);
              }
            } catch (reject) {
              workerPort.postMessage({ id, reject, properties: extractProperties(reject) });
            }
            Atomics.add(sharedBufferView, 0, 1);
            Atomics.notify(sharedBufferView, 0, Infinity);
          })();
        });
      } catch (reject) {
        parentPort.on("message", (msg) => {
          let { sharedBuffer, id } = msg;
          let sharedBufferView = new Int32Array(sharedBuffer);
          workerPort.postMessage({ id, reject, properties: extractProperties(reject) });
          Atomics.add(sharedBufferView, 0, 1);
          Atomics.notify(sharedBufferView, 0, Infinity);
        });
      }
    }, "startSyncServiceWorker");
    if (isInternalWorkerThread) {
      startSyncServiceWorker();
    }
    var node_default = node_exports;
  },
});

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/jsonify@0.0.1/node_modules/jsonify/lib/parse.js
var require_parse = __commonJS({
  "../../../../.prototypes/trigger-dev/node_modules/.pnpm/jsonify@0.0.1/node_modules/jsonify/lib/parse.js"(
    exports,
    module,
  ) {
    "use strict";
    init_esm();
    var at;
    var ch;
    var escapee = {
      '"': '"',
      "\\": "\\",
      "/": "/",
      b: "\b",
      f: "\f",
      n: "\n",
      r: "\r",
      t: "	",
    };
    var text;
    function error(m) {
      throw {
        name: "SyntaxError",
        message: m,
        at,
        text,
      };
    }
    __name(error, "error");
    function next(c) {
      if (c && c !== ch) {
        error("Expected '" + c + "' instead of '" + ch + "'");
      }
      ch = text.charAt(at);
      at += 1;
      return ch;
    }
    __name(next, "next");
    function number() {
      var num;
      var str = "";
      if (ch === "-") {
        str = "-";
        next("-");
      }
      while (ch >= "0" && ch <= "9") {
        str += ch;
        next();
      }
      if (ch === ".") {
        str += ".";
        while (next() && ch >= "0" && ch <= "9") {
          str += ch;
        }
      }
      if (ch === "e" || ch === "E") {
        str += ch;
        next();
        if (ch === "-" || ch === "+") {
          str += ch;
          next();
        }
        while (ch >= "0" && ch <= "9") {
          str += ch;
          next();
        }
      }
      num = Number(str);
      if (!isFinite(num)) {
        error("Bad number");
      }
      return num;
    }
    __name(number, "number");
    function string() {
      var hex;
      var i;
      var str = "";
      var uffff;
      if (ch === '"') {
        while (next()) {
          if (ch === '"') {
            next();
            return str;
          } else if (ch === "\\") {
            next();
            if (ch === "u") {
              uffff = 0;
              for (i = 0; i < 4; i += 1) {
                hex = parseInt(next(), 16);
                if (!isFinite(hex)) {
                  break;
                }
                uffff = uffff * 16 + hex;
              }
              str += String.fromCharCode(uffff);
            } else if (typeof escapee[ch] === "string") {
              str += escapee[ch];
            } else {
              break;
            }
          } else {
            str += ch;
          }
        }
      }
      error("Bad string");
    }
    __name(string, "string");
    function white() {
      while (ch && ch <= " ") {
        next();
      }
    }
    __name(white, "white");
    function word() {
      switch (ch) {
        case "t":
          next("t");
          next("r");
          next("u");
          next("e");
          return true;
        case "f":
          next("f");
          next("a");
          next("l");
          next("s");
          next("e");
          return false;
        case "n":
          next("n");
          next("u");
          next("l");
          next("l");
          return null;
        default:
          error("Unexpected '" + ch + "'");
      }
    }
    __name(word, "word");
    function array() {
      var arr = [];
      if (ch === "[") {
        next("[");
        white();
        if (ch === "]") {
          next("]");
          return arr;
        }
        while (ch) {
          arr.push(value());
          white();
          if (ch === "]") {
            next("]");
            return arr;
          }
          next(",");
          white();
        }
      }
      error("Bad array");
    }
    __name(array, "array");
    function object() {
      var key;
      var obj = {};
      if (ch === "{") {
        next("{");
        white();
        if (ch === "}") {
          next("}");
          return obj;
        }
        while (ch) {
          key = string();
          white();
          next(":");
          if (Object.prototype.hasOwnProperty.call(obj, key)) {
            error('Duplicate key "' + key + '"');
          }
          obj[key] = value();
          white();
          if (ch === "}") {
            next("}");
            return obj;
          }
          next(",");
          white();
        }
      }
      error("Bad object");
    }
    __name(object, "object");
    function value() {
      white();
      switch (ch) {
        case "{":
          return object();
        case "[":
          return array();
        case '"':
          return string();
        case "-":
          return number();
        default:
          return ch >= "0" && ch <= "9" ? number() : word();
      }
    }
    __name(value, "value");
    module.exports = function (source, reviver) {
      var result;
      text = source;
      at = 0;
      ch = " ";
      result = value();
      white();
      if (ch) {
        error("Syntax error");
      }
      return typeof reviver === "function"
        ? /* @__PURE__ */ __name(function walk(holder, key) {
            var k;
            var v;
            var val = holder[key];
            if (val && typeof val === "object") {
              for (k in value) {
                if (Object.prototype.hasOwnProperty.call(val, k)) {
                  v = walk(val, k);
                  if (typeof v === "undefined") {
                    delete val[k];
                  } else {
                    val[k] = v;
                  }
                }
              }
            }
            return reviver.call(holder, key, val);
          }, "walk")({ "": result }, "")
        : result;
    };
  },
});

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/jsonify@0.0.1/node_modules/jsonify/lib/stringify.js
var require_stringify = __commonJS({
  "../../../../.prototypes/trigger-dev/node_modules/.pnpm/jsonify@0.0.1/node_modules/jsonify/lib/stringify.js"(
    exports,
    module,
  ) {
    "use strict";
    init_esm();
    var escapable =
      /[\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g;
    var gap;
    var indent;
    var meta = {
      // table of character substitutions
      "\b": "\\b",
      "	": "\\t",
      "\n": "\\n",
      "\f": "\\f",
      "\r": "\\r",
      '"': '\\"',
      "\\": "\\\\",
    };
    var rep;
    function quote(string) {
      escapable.lastIndex = 0;
      return escapable.test(string)
        ? '"' +
            string.replace(escapable, function (a) {
              var c = meta[a];
              return typeof c === "string"
                ? c
                : "\\u" + ("0000" + a.charCodeAt(0).toString(16)).slice(-4);
            }) +
            '"'
        : '"' + string + '"';
    }
    __name(quote, "quote");
    function str(key, holder) {
      var i;
      var k;
      var v;
      var length;
      var mind = gap;
      var partial;
      var value = holder[key];
      if (value && typeof value === "object" && typeof value.toJSON === "function") {
        value = value.toJSON(key);
      }
      if (typeof rep === "function") {
        value = rep.call(holder, key, value);
      }
      switch (typeof value) {
        case "string":
          return quote(value);
        case "number":
          return isFinite(value) ? String(value) : "null";
        case "boolean":
        case "null":
          return String(value);
        case "object":
          if (!value) {
            return "null";
          }
          gap += indent;
          partial = [];
          if (Object.prototype.toString.apply(value) === "[object Array]") {
            length = value.length;
            for (i = 0; i < length; i += 1) {
              partial[i] = str(i, value) || "null";
            }
            v =
              partial.length === 0
                ? "[]"
                : gap
                  ? "[\n" + gap + partial.join(",\n" + gap) + "\n" + mind + "]"
                  : "[" + partial.join(",") + "]";
            gap = mind;
            return v;
          }
          if (rep && typeof rep === "object") {
            length = rep.length;
            for (i = 0; i < length; i += 1) {
              k = rep[i];
              if (typeof k === "string") {
                v = str(k, value);
                if (v) {
                  partial.push(quote(k) + (gap ? ": " : ":") + v);
                }
              }
            }
          } else {
            for (k in value) {
              if (Object.prototype.hasOwnProperty.call(value, k)) {
                v = str(k, value);
                if (v) {
                  partial.push(quote(k) + (gap ? ": " : ":") + v);
                }
              }
            }
          }
          v =
            partial.length === 0
              ? "{}"
              : gap
                ? "{\n" + gap + partial.join(",\n" + gap) + "\n" + mind + "}"
                : "{" + partial.join(",") + "}";
          gap = mind;
          return v;
        default:
      }
    }
    __name(str, "str");
    module.exports = function (value, replacer, space) {
      var i;
      gap = "";
      indent = "";
      if (typeof space === "number") {
        for (i = 0; i < space; i += 1) {
          indent += " ";
        }
      } else if (typeof space === "string") {
        indent = space;
      }
      rep = replacer;
      if (
        replacer &&
        typeof replacer !== "function" &&
        (typeof replacer !== "object" || typeof replacer.length !== "number")
      ) {
        throw new Error("JSON.stringify");
      }
      return str("", { "": value });
    };
  },
});

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/jsonify@0.0.1/node_modules/jsonify/index.js
var require_jsonify = __commonJS({
  "../../../../.prototypes/trigger-dev/node_modules/.pnpm/jsonify@0.0.1/node_modules/jsonify/index.js"(
    exports,
  ) {
    "use strict";
    init_esm();
    exports.parse = require_parse();
    exports.stringify = require_stringify();
  },
});

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/isarray@2.0.5/node_modules/isarray/index.js
var require_isarray = __commonJS({
  "../../../../.prototypes/trigger-dev/node_modules/.pnpm/isarray@2.0.5/node_modules/isarray/index.js"(
    exports,
    module,
  ) {
    init_esm();
    var toString = {}.toString;
    module.exports =
      Array.isArray ||
      function (arr) {
        return toString.call(arr) == "[object Array]";
      };
  },
});

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/object-keys@1.1.1/node_modules/object-keys/isArguments.js
var require_isArguments = __commonJS({
  "../../../../.prototypes/trigger-dev/node_modules/.pnpm/object-keys@1.1.1/node_modules/object-keys/isArguments.js"(
    exports,
    module,
  ) {
    "use strict";
    init_esm();
    var toStr = Object.prototype.toString;
    module.exports = /* @__PURE__ */ __name(function isArguments(value) {
      var str = toStr.call(value);
      var isArgs = str === "[object Arguments]";
      if (!isArgs) {
        isArgs =
          str !== "[object Array]" &&
          value !== null &&
          typeof value === "object" &&
          typeof value.length === "number" &&
          value.length >= 0 &&
          toStr.call(value.callee) === "[object Function]";
      }
      return isArgs;
    }, "isArguments");
  },
});

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/object-keys@1.1.1/node_modules/object-keys/implementation.js
var require_implementation = __commonJS({
  "../../../../.prototypes/trigger-dev/node_modules/.pnpm/object-keys@1.1.1/node_modules/object-keys/implementation.js"(
    exports,
    module,
  ) {
    "use strict";
    init_esm();
    var keysShim;
    if (!Object.keys) {
      has = Object.prototype.hasOwnProperty;
      toStr = Object.prototype.toString;
      isArgs = require_isArguments();
      isEnumerable = Object.prototype.propertyIsEnumerable;
      hasDontEnumBug = !isEnumerable.call({ toString: null }, "toString");
      hasProtoEnumBug = isEnumerable.call(function () {}, "prototype");
      dontEnums = [
        "toString",
        "toLocaleString",
        "valueOf",
        "hasOwnProperty",
        "isPrototypeOf",
        "propertyIsEnumerable",
        "constructor",
      ];
      equalsConstructorPrototype = /* @__PURE__ */ __name(function (o2) {
        var ctor = o2.constructor;
        return ctor && ctor.prototype === o2;
      }, "equalsConstructorPrototype");
      excludedKeys = {
        $applicationCache: true,
        $console: true,
        $external: true,
        $frame: true,
        $frameElement: true,
        $frames: true,
        $innerHeight: true,
        $innerWidth: true,
        $onmozfullscreenchange: true,
        $onmozfullscreenerror: true,
        $outerHeight: true,
        $outerWidth: true,
        $pageXOffset: true,
        $pageYOffset: true,
        $parent: true,
        $scrollLeft: true,
        $scrollTop: true,
        $scrollX: true,
        $scrollY: true,
        $self: true,
        $webkitIndexedDB: true,
        $webkitStorageInfo: true,
        $window: true,
      };
      hasAutomationEqualityBug = (function () {
        if (typeof window === "undefined") {
          return false;
        }
        for (var k in window) {
          try {
            if (
              !excludedKeys["$" + k] &&
              has.call(window, k) &&
              window[k] !== null &&
              typeof window[k] === "object"
            ) {
              try {
                equalsConstructorPrototype(window[k]);
              } catch (e) {
                return true;
              }
            }
          } catch (e) {
            return true;
          }
        }
        return false;
      })();
      equalsConstructorPrototypeIfNotBuggy = /* @__PURE__ */ __name(function (o2) {
        if (typeof window === "undefined" || !hasAutomationEqualityBug) {
          return equalsConstructorPrototype(o2);
        }
        try {
          return equalsConstructorPrototype(o2);
        } catch (e) {
          return false;
        }
      }, "equalsConstructorPrototypeIfNotBuggy");
      keysShim = /* @__PURE__ */ __name(function keys(object) {
        var isObject = object !== null && typeof object === "object";
        var isFunction = toStr.call(object) === "[object Function]";
        var isArguments = isArgs(object);
        var isString = isObject && toStr.call(object) === "[object String]";
        var theKeys = [];
        if (!isObject && !isFunction && !isArguments) {
          throw new TypeError("Object.keys called on a non-object");
        }
        var skipProto = hasProtoEnumBug && isFunction;
        if (isString && object.length > 0 && !has.call(object, 0)) {
          for (var i = 0; i < object.length; ++i) {
            theKeys.push(String(i));
          }
        }
        if (isArguments && object.length > 0) {
          for (var j = 0; j < object.length; ++j) {
            theKeys.push(String(j));
          }
        } else {
          for (var name in object) {
            if (!(skipProto && name === "prototype") && has.call(object, name)) {
              theKeys.push(String(name));
            }
          }
        }
        if (hasDontEnumBug) {
          var skipConstructor = equalsConstructorPrototypeIfNotBuggy(object);
          for (var k = 0; k < dontEnums.length; ++k) {
            if (
              !(skipConstructor && dontEnums[k] === "constructor") &&
              has.call(object, dontEnums[k])
            ) {
              theKeys.push(dontEnums[k]);
            }
          }
        }
        return theKeys;
      }, "keys");
    }
    var has;
    var toStr;
    var isArgs;
    var isEnumerable;
    var hasDontEnumBug;
    var hasProtoEnumBug;
    var dontEnums;
    var equalsConstructorPrototype;
    var excludedKeys;
    var hasAutomationEqualityBug;
    var equalsConstructorPrototypeIfNotBuggy;
    module.exports = keysShim;
  },
});

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/object-keys@1.1.1/node_modules/object-keys/index.js
var require_object_keys = __commonJS({
  "../../../../.prototypes/trigger-dev/node_modules/.pnpm/object-keys@1.1.1/node_modules/object-keys/index.js"(
    exports,
    module,
  ) {
    "use strict";
    init_esm();
    var slice = Array.prototype.slice;
    var isArgs = require_isArguments();
    var origKeys = Object.keys;
    var keysShim = origKeys
      ? /* @__PURE__ */ __name(function keys(o2) {
          return origKeys(o2);
        }, "keys")
      : require_implementation();
    var originalKeys = Object.keys;
    keysShim.shim = /* @__PURE__ */ __name(function shimObjectKeys() {
      if (Object.keys) {
        var keysWorksWithArguments = (function () {
          var args = Object.keys(arguments);
          return args && args.length === arguments.length;
        })(1, 2);
        if (!keysWorksWithArguments) {
          Object.keys = /* @__PURE__ */ __name(function keys(object) {
            if (isArgs(object)) {
              return originalKeys(slice.call(object));
            }
            return originalKeys(object);
          }, "keys");
        }
      } else {
        Object.keys = keysShim;
      }
      return Object.keys || keysShim;
    }, "shimObjectKeys");
    module.exports = keysShim;
  },
});

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/es-object-atoms@1.1.2/node_modules/es-object-atoms/index.js
var require_es_object_atoms = __commonJS({
  "../../../../.prototypes/trigger-dev/node_modules/.pnpm/es-object-atoms@1.1.2/node_modules/es-object-atoms/index.js"(
    exports,
    module,
  ) {
    "use strict";
    init_esm();
    module.exports = Object;
  },
});

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/es-errors@1.3.0/node_modules/es-errors/index.js
var require_es_errors = __commonJS({
  "../../../../.prototypes/trigger-dev/node_modules/.pnpm/es-errors@1.3.0/node_modules/es-errors/index.js"(
    exports,
    module,
  ) {
    "use strict";
    init_esm();
    module.exports = Error;
  },
});

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/es-errors@1.3.0/node_modules/es-errors/eval.js
var require_eval = __commonJS({
  "../../../../.prototypes/trigger-dev/node_modules/.pnpm/es-errors@1.3.0/node_modules/es-errors/eval.js"(
    exports,
    module,
  ) {
    "use strict";
    init_esm();
    module.exports = EvalError;
  },
});

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/es-errors@1.3.0/node_modules/es-errors/range.js
var require_range = __commonJS({
  "../../../../.prototypes/trigger-dev/node_modules/.pnpm/es-errors@1.3.0/node_modules/es-errors/range.js"(
    exports,
    module,
  ) {
    "use strict";
    init_esm();
    module.exports = RangeError;
  },
});

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/es-errors@1.3.0/node_modules/es-errors/ref.js
var require_ref = __commonJS({
  "../../../../.prototypes/trigger-dev/node_modules/.pnpm/es-errors@1.3.0/node_modules/es-errors/ref.js"(
    exports,
    module,
  ) {
    "use strict";
    init_esm();
    module.exports = ReferenceError;
  },
});

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/es-errors@1.3.0/node_modules/es-errors/syntax.js
var require_syntax = __commonJS({
  "../../../../.prototypes/trigger-dev/node_modules/.pnpm/es-errors@1.3.0/node_modules/es-errors/syntax.js"(
    exports,
    module,
  ) {
    "use strict";
    init_esm();
    module.exports = SyntaxError;
  },
});

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/es-errors@1.3.0/node_modules/es-errors/type.js
var require_type = __commonJS({
  "../../../../.prototypes/trigger-dev/node_modules/.pnpm/es-errors@1.3.0/node_modules/es-errors/type.js"(
    exports,
    module,
  ) {
    "use strict";
    init_esm();
    module.exports = TypeError;
  },
});

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/es-errors@1.3.0/node_modules/es-errors/uri.js
var require_uri = __commonJS({
  "../../../../.prototypes/trigger-dev/node_modules/.pnpm/es-errors@1.3.0/node_modules/es-errors/uri.js"(
    exports,
    module,
  ) {
    "use strict";
    init_esm();
    module.exports = URIError;
  },
});

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/math-intrinsics@1.1.0/node_modules/math-intrinsics/abs.js
var require_abs = __commonJS({
  "../../../../.prototypes/trigger-dev/node_modules/.pnpm/math-intrinsics@1.1.0/node_modules/math-intrinsics/abs.js"(
    exports,
    module,
  ) {
    "use strict";
    init_esm();
    module.exports = Math.abs;
  },
});

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/math-intrinsics@1.1.0/node_modules/math-intrinsics/floor.js
var require_floor = __commonJS({
  "../../../../.prototypes/trigger-dev/node_modules/.pnpm/math-intrinsics@1.1.0/node_modules/math-intrinsics/floor.js"(
    exports,
    module,
  ) {
    "use strict";
    init_esm();
    module.exports = Math.floor;
  },
});

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/math-intrinsics@1.1.0/node_modules/math-intrinsics/max.js
var require_max = __commonJS({
  "../../../../.prototypes/trigger-dev/node_modules/.pnpm/math-intrinsics@1.1.0/node_modules/math-intrinsics/max.js"(
    exports,
    module,
  ) {
    "use strict";
    init_esm();
    module.exports = Math.max;
  },
});

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/math-intrinsics@1.1.0/node_modules/math-intrinsics/min.js
var require_min = __commonJS({
  "../../../../.prototypes/trigger-dev/node_modules/.pnpm/math-intrinsics@1.1.0/node_modules/math-intrinsics/min.js"(
    exports,
    module,
  ) {
    "use strict";
    init_esm();
    module.exports = Math.min;
  },
});

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/math-intrinsics@1.1.0/node_modules/math-intrinsics/pow.js
var require_pow = __commonJS({
  "../../../../.prototypes/trigger-dev/node_modules/.pnpm/math-intrinsics@1.1.0/node_modules/math-intrinsics/pow.js"(
    exports,
    module,
  ) {
    "use strict";
    init_esm();
    module.exports = Math.pow;
  },
});

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/math-intrinsics@1.1.0/node_modules/math-intrinsics/round.js
var require_round = __commonJS({
  "../../../../.prototypes/trigger-dev/node_modules/.pnpm/math-intrinsics@1.1.0/node_modules/math-intrinsics/round.js"(
    exports,
    module,
  ) {
    "use strict";
    init_esm();
    module.exports = Math.round;
  },
});

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/math-intrinsics@1.1.0/node_modules/math-intrinsics/isNaN.js
var require_isNaN = __commonJS({
  "../../../../.prototypes/trigger-dev/node_modules/.pnpm/math-intrinsics@1.1.0/node_modules/math-intrinsics/isNaN.js"(
    exports,
    module,
  ) {
    "use strict";
    init_esm();
    module.exports =
      Number.isNaN ||
      /* @__PURE__ */ __name(function isNaN2(a) {
        return a !== a;
      }, "isNaN");
  },
});

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/math-intrinsics@1.1.0/node_modules/math-intrinsics/sign.js
var require_sign = __commonJS({
  "../../../../.prototypes/trigger-dev/node_modules/.pnpm/math-intrinsics@1.1.0/node_modules/math-intrinsics/sign.js"(
    exports,
    module,
  ) {
    "use strict";
    init_esm();
    var $isNaN = require_isNaN();
    module.exports = /* @__PURE__ */ __name(function sign(number) {
      if ($isNaN(number) || number === 0) {
        return number;
      }
      return number < 0 ? -1 : 1;
    }, "sign");
  },
});

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/gopd@1.2.0/node_modules/gopd/gOPD.js
var require_gOPD = __commonJS({
  "../../../../.prototypes/trigger-dev/node_modules/.pnpm/gopd@1.2.0/node_modules/gopd/gOPD.js"(
    exports,
    module,
  ) {
    "use strict";
    init_esm();
    module.exports = Object.getOwnPropertyDescriptor;
  },
});

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/gopd@1.2.0/node_modules/gopd/index.js
var require_gopd = __commonJS({
  "../../../../.prototypes/trigger-dev/node_modules/.pnpm/gopd@1.2.0/node_modules/gopd/index.js"(
    exports,
    module,
  ) {
    "use strict";
    init_esm();
    var $gOPD = require_gOPD();
    if ($gOPD) {
      try {
        $gOPD([], "length");
      } catch (e) {
        $gOPD = null;
      }
    }
    module.exports = $gOPD;
  },
});

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/es-define-property@1.0.1/node_modules/es-define-property/index.js
var require_es_define_property = __commonJS({
  "../../../../.prototypes/trigger-dev/node_modules/.pnpm/es-define-property@1.0.1/node_modules/es-define-property/index.js"(
    exports,
    module,
  ) {
    "use strict";
    init_esm();
    var $defineProperty = Object.defineProperty || false;
    if ($defineProperty) {
      try {
        $defineProperty({}, "a", { value: 1 });
      } catch (e) {
        $defineProperty = false;
      }
    }
    module.exports = $defineProperty;
  },
});

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/has-symbols@1.1.0/node_modules/has-symbols/shams.js
var require_shams = __commonJS({
  "../../../../.prototypes/trigger-dev/node_modules/.pnpm/has-symbols@1.1.0/node_modules/has-symbols/shams.js"(
    exports,
    module,
  ) {
    "use strict";
    init_esm();
    module.exports = /* @__PURE__ */ __name(function hasSymbols() {
      if (typeof Symbol !== "function" || typeof Object.getOwnPropertySymbols !== "function") {
        return false;
      }
      if (typeof Symbol.iterator === "symbol") {
        return true;
      }
      var obj = {};
      var sym = Symbol("test");
      var symObj = Object(sym);
      if (typeof sym === "string") {
        return false;
      }
      if (Object.prototype.toString.call(sym) !== "[object Symbol]") {
        return false;
      }
      if (Object.prototype.toString.call(symObj) !== "[object Symbol]") {
        return false;
      }
      var symVal = 42;
      obj[sym] = symVal;
      for (var _ in obj) {
        return false;
      }
      if (typeof Object.keys === "function" && Object.keys(obj).length !== 0) {
        return false;
      }
      if (
        typeof Object.getOwnPropertyNames === "function" &&
        Object.getOwnPropertyNames(obj).length !== 0
      ) {
        return false;
      }
      var syms = Object.getOwnPropertySymbols(obj);
      if (syms.length !== 1 || syms[0] !== sym) {
        return false;
      }
      if (!Object.prototype.propertyIsEnumerable.call(obj, sym)) {
        return false;
      }
      if (typeof Object.getOwnPropertyDescriptor === "function") {
        var descriptor =
          /** @type {PropertyDescriptor} */
          Object.getOwnPropertyDescriptor(obj, sym);
        if (descriptor.value !== symVal || descriptor.enumerable !== true) {
          return false;
        }
      }
      return true;
    }, "hasSymbols");
  },
});

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/has-symbols@1.1.0/node_modules/has-symbols/index.js
var require_has_symbols = __commonJS({
  "../../../../.prototypes/trigger-dev/node_modules/.pnpm/has-symbols@1.1.0/node_modules/has-symbols/index.js"(
    exports,
    module,
  ) {
    "use strict";
    init_esm();
    var origSymbol = typeof Symbol !== "undefined" && Symbol;
    var hasSymbolSham = require_shams();
    module.exports = /* @__PURE__ */ __name(function hasNativeSymbols() {
      if (typeof origSymbol !== "function") {
        return false;
      }
      if (typeof Symbol !== "function") {
        return false;
      }
      if (typeof origSymbol("foo") !== "symbol") {
        return false;
      }
      if (typeof Symbol("bar") !== "symbol") {
        return false;
      }
      return hasSymbolSham();
    }, "hasNativeSymbols");
  },
});

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/get-proto@1.0.1/node_modules/get-proto/Reflect.getPrototypeOf.js
var require_Reflect_getPrototypeOf = __commonJS({
  "../../../../.prototypes/trigger-dev/node_modules/.pnpm/get-proto@1.0.1/node_modules/get-proto/Reflect.getPrototypeOf.js"(
    exports,
    module,
  ) {
    "use strict";
    init_esm();
    module.exports = (typeof Reflect !== "undefined" && Reflect.getPrototypeOf) || null;
  },
});

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/get-proto@1.0.1/node_modules/get-proto/Object.getPrototypeOf.js
var require_Object_getPrototypeOf = __commonJS({
  "../../../../.prototypes/trigger-dev/node_modules/.pnpm/get-proto@1.0.1/node_modules/get-proto/Object.getPrototypeOf.js"(
    exports,
    module,
  ) {
    "use strict";
    init_esm();
    var $Object = require_es_object_atoms();
    module.exports = $Object.getPrototypeOf || null;
  },
});

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/function-bind@1.1.2/node_modules/function-bind/implementation.js
var require_implementation2 = __commonJS({
  "../../../../.prototypes/trigger-dev/node_modules/.pnpm/function-bind@1.1.2/node_modules/function-bind/implementation.js"(
    exports,
    module,
  ) {
    "use strict";
    init_esm();
    var ERROR_MESSAGE = "Function.prototype.bind called on incompatible ";
    var toStr = Object.prototype.toString;
    var max = Math.max;
    var funcType = "[object Function]";
    var concatty = /* @__PURE__ */ __name(function concatty2(a, b) {
      var arr = [];
      for (var i = 0; i < a.length; i += 1) {
        arr[i] = a[i];
      }
      for (var j = 0; j < b.length; j += 1) {
        arr[j + a.length] = b[j];
      }
      return arr;
    }, "concatty");
    var slicy = /* @__PURE__ */ __name(function slicy2(arrLike, offset) {
      var arr = [];
      for (var i = offset || 0, j = 0; i < arrLike.length; i += 1, j += 1) {
        arr[j] = arrLike[i];
      }
      return arr;
    }, "slicy");
    var joiny = /* @__PURE__ */ __name(function (arr, joiner) {
      var str = "";
      for (var i = 0; i < arr.length; i += 1) {
        str += arr[i];
        if (i + 1 < arr.length) {
          str += joiner;
        }
      }
      return str;
    }, "joiny");
    module.exports = /* @__PURE__ */ __name(function bind(that) {
      var target = this;
      if (typeof target !== "function" || toStr.apply(target) !== funcType) {
        throw new TypeError(ERROR_MESSAGE + target);
      }
      var args = slicy(arguments, 1);
      var bound;
      var binder = /* @__PURE__ */ __name(function () {
        if (this instanceof bound) {
          var result = target.apply(this, concatty(args, arguments));
          if (Object(result) === result) {
            return result;
          }
          return this;
        }
        return target.apply(that, concatty(args, arguments));
      }, "binder");
      var boundLength = max(0, target.length - args.length);
      var boundArgs = [];
      for (var i = 0; i < boundLength; i++) {
        boundArgs[i] = "$" + i;
      }
      bound = Function(
        "binder",
        "return function (" + joiny(boundArgs, ",") + "){ return binder.apply(this,arguments); }",
      )(binder);
      if (target.prototype) {
        var Empty = /* @__PURE__ */ __name(function Empty2() {}, "Empty");
        Empty.prototype = target.prototype;
        bound.prototype = new Empty();
        Empty.prototype = null;
      }
      return bound;
    }, "bind");
  },
});

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/function-bind@1.1.2/node_modules/function-bind/index.js
var require_function_bind = __commonJS({
  "../../../../.prototypes/trigger-dev/node_modules/.pnpm/function-bind@1.1.2/node_modules/function-bind/index.js"(
    exports,
    module,
  ) {
    "use strict";
    init_esm();
    var implementation = require_implementation2();
    module.exports = Function.prototype.bind || implementation;
  },
});

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/call-bind-apply-helpers@1.0.2/node_modules/call-bind-apply-helpers/functionCall.js
var require_functionCall = __commonJS({
  "../../../../.prototypes/trigger-dev/node_modules/.pnpm/call-bind-apply-helpers@1.0.2/node_modules/call-bind-apply-helpers/functionCall.js"(
    exports,
    module,
  ) {
    "use strict";
    init_esm();
    module.exports = Function.prototype.call;
  },
});

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/call-bind-apply-helpers@1.0.2/node_modules/call-bind-apply-helpers/functionApply.js
var require_functionApply = __commonJS({
  "../../../../.prototypes/trigger-dev/node_modules/.pnpm/call-bind-apply-helpers@1.0.2/node_modules/call-bind-apply-helpers/functionApply.js"(
    exports,
    module,
  ) {
    "use strict";
    init_esm();
    module.exports = Function.prototype.apply;
  },
});

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/call-bind-apply-helpers@1.0.2/node_modules/call-bind-apply-helpers/reflectApply.js
var require_reflectApply = __commonJS({
  "../../../../.prototypes/trigger-dev/node_modules/.pnpm/call-bind-apply-helpers@1.0.2/node_modules/call-bind-apply-helpers/reflectApply.js"(
    exports,
    module,
  ) {
    "use strict";
    init_esm();
    module.exports = typeof Reflect !== "undefined" && Reflect && Reflect.apply;
  },
});

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/call-bind-apply-helpers@1.0.2/node_modules/call-bind-apply-helpers/actualApply.js
var require_actualApply = __commonJS({
  "../../../../.prototypes/trigger-dev/node_modules/.pnpm/call-bind-apply-helpers@1.0.2/node_modules/call-bind-apply-helpers/actualApply.js"(
    exports,
    module,
  ) {
    "use strict";
    init_esm();
    var bind = require_function_bind();
    var $apply = require_functionApply();
    var $call = require_functionCall();
    var $reflectApply = require_reflectApply();
    module.exports = $reflectApply || bind.call($call, $apply);
  },
});

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/call-bind-apply-helpers@1.0.2/node_modules/call-bind-apply-helpers/index.js
var require_call_bind_apply_helpers = __commonJS({
  "../../../../.prototypes/trigger-dev/node_modules/.pnpm/call-bind-apply-helpers@1.0.2/node_modules/call-bind-apply-helpers/index.js"(
    exports,
    module,
  ) {
    "use strict";
    init_esm();
    var bind = require_function_bind();
    var $TypeError = require_type();
    var $call = require_functionCall();
    var $actualApply = require_actualApply();
    module.exports = /* @__PURE__ */ __name(function callBindBasic(args) {
      if (args.length < 1 || typeof args[0] !== "function") {
        throw new $TypeError("a function is required");
      }
      return $actualApply(bind, $call, args);
    }, "callBindBasic");
  },
});

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/dunder-proto@1.0.1/node_modules/dunder-proto/get.js
var require_get = __commonJS({
  "../../../../.prototypes/trigger-dev/node_modules/.pnpm/dunder-proto@1.0.1/node_modules/dunder-proto/get.js"(
    exports,
    module,
  ) {
    "use strict";
    init_esm();
    var callBind = require_call_bind_apply_helpers();
    var gOPD = require_gopd();
    var hasProtoAccessor;
    try {
      hasProtoAccessor =
        /** @type {{ __proto__?: typeof Array.prototype }} */
        [].__proto__ === Array.prototype;
    } catch (e) {
      if (!e || typeof e !== "object" || !("code" in e) || e.code !== "ERR_PROTO_ACCESS") {
        throw e;
      }
    }
    var desc =
      !!hasProtoAccessor &&
      gOPD &&
      gOPD(
        Object.prototype,
        /** @type {keyof typeof Object.prototype} */
        "__proto__",
      );
    var $Object = Object;
    var $getPrototypeOf = $Object.getPrototypeOf;
    module.exports =
      desc && typeof desc.get === "function"
        ? callBind([desc.get])
        : typeof $getPrototypeOf === "function"
          ? /** @type {import('./get')} */
            /* @__PURE__ */ __name(function getDunder(value) {
              return $getPrototypeOf(value == null ? value : $Object(value));
            }, "getDunder")
          : false;
  },
});

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/get-proto@1.0.1/node_modules/get-proto/index.js
var require_get_proto = __commonJS({
  "../../../../.prototypes/trigger-dev/node_modules/.pnpm/get-proto@1.0.1/node_modules/get-proto/index.js"(
    exports,
    module,
  ) {
    "use strict";
    init_esm();
    var reflectGetProto = require_Reflect_getPrototypeOf();
    var originalGetProto = require_Object_getPrototypeOf();
    var getDunderProto = require_get();
    module.exports = reflectGetProto
      ? /* @__PURE__ */ __name(function getProto(O) {
          return reflectGetProto(O);
        }, "getProto")
      : originalGetProto
        ? /* @__PURE__ */ __name(function getProto(O) {
            if (!O || (typeof O !== "object" && typeof O !== "function")) {
              throw new TypeError("getProto: not an object");
            }
            return originalGetProto(O);
          }, "getProto")
        : getDunderProto
          ? /* @__PURE__ */ __name(function getProto(O) {
              return getDunderProto(O);
            }, "getProto")
          : null;
  },
});

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/hasown@2.0.4/node_modules/hasown/index.js
var require_hasown = __commonJS({
  "../../../../.prototypes/trigger-dev/node_modules/.pnpm/hasown@2.0.4/node_modules/hasown/index.js"(
    exports,
    module,
  ) {
    "use strict";
    init_esm();
    var call = Function.prototype.call;
    var $hasOwn = Object.prototype.hasOwnProperty;
    var bind = require_function_bind();
    module.exports = bind.call(call, $hasOwn);
  },
});

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/get-intrinsic@1.3.0/node_modules/get-intrinsic/index.js
var require_get_intrinsic = __commonJS({
  "../../../../.prototypes/trigger-dev/node_modules/.pnpm/get-intrinsic@1.3.0/node_modules/get-intrinsic/index.js"(
    exports,
    module,
  ) {
    "use strict";
    init_esm();
    var undefined2;
    var $Object = require_es_object_atoms();
    var $Error = require_es_errors();
    var $EvalError = require_eval();
    var $RangeError = require_range();
    var $ReferenceError = require_ref();
    var $SyntaxError = require_syntax();
    var $TypeError = require_type();
    var $URIError = require_uri();
    var abs = require_abs();
    var floor = require_floor();
    var max = require_max();
    var min = require_min();
    var pow = require_pow();
    var round = require_round();
    var sign = require_sign();
    var $Function = Function;
    var getEvalledConstructor = /* @__PURE__ */ __name(function (expressionSyntax) {
      try {
        return $Function('"use strict"; return (' + expressionSyntax + ").constructor;")();
      } catch (e) {}
    }, "getEvalledConstructor");
    var $gOPD = require_gopd();
    var $defineProperty = require_es_define_property();
    var throwTypeError = /* @__PURE__ */ __name(function () {
      throw new $TypeError();
    }, "throwTypeError");
    var ThrowTypeError = $gOPD
      ? (function () {
          try {
            arguments.callee;
            return throwTypeError;
          } catch (calleeThrows) {
            try {
              return $gOPD(arguments, "callee").get;
            } catch (gOPDthrows) {
              return throwTypeError;
            }
          }
        })()
      : throwTypeError;
    var hasSymbols = require_has_symbols()();
    var getProto = require_get_proto();
    var $ObjectGPO = require_Object_getPrototypeOf();
    var $ReflectGPO = require_Reflect_getPrototypeOf();
    var $apply = require_functionApply();
    var $call = require_functionCall();
    var needsEval = {};
    var TypedArray =
      typeof Uint8Array === "undefined" || !getProto ? undefined2 : getProto(Uint8Array);
    var INTRINSICS = {
      __proto__: null,
      "%AggregateError%": typeof AggregateError === "undefined" ? undefined2 : AggregateError,
      "%Array%": Array,
      "%ArrayBuffer%": typeof ArrayBuffer === "undefined" ? undefined2 : ArrayBuffer,
      "%ArrayIteratorPrototype%":
        hasSymbols && getProto ? getProto([][Symbol.iterator]()) : undefined2,
      "%AsyncFromSyncIteratorPrototype%": undefined2,
      "%AsyncFunction%": needsEval,
      "%AsyncGenerator%": needsEval,
      "%AsyncGeneratorFunction%": needsEval,
      "%AsyncIteratorPrototype%": needsEval,
      "%Atomics%": typeof Atomics === "undefined" ? undefined2 : Atomics,
      "%BigInt%": typeof BigInt === "undefined" ? undefined2 : BigInt,
      "%BigInt64Array%": typeof BigInt64Array === "undefined" ? undefined2 : BigInt64Array,
      "%BigUint64Array%": typeof BigUint64Array === "undefined" ? undefined2 : BigUint64Array,
      "%Boolean%": Boolean,
      "%DataView%": typeof DataView === "undefined" ? undefined2 : DataView,
      "%Date%": Date,
      "%decodeURI%": decodeURI,
      "%decodeURIComponent%": decodeURIComponent,
      "%encodeURI%": encodeURI,
      "%encodeURIComponent%": encodeURIComponent,
      "%Error%": $Error,
      "%eval%": eval,
      // eslint-disable-line no-eval
      "%EvalError%": $EvalError,
      "%Float16Array%": typeof Float16Array === "undefined" ? undefined2 : Float16Array,
      "%Float32Array%": typeof Float32Array === "undefined" ? undefined2 : Float32Array,
      "%Float64Array%": typeof Float64Array === "undefined" ? undefined2 : Float64Array,
      "%FinalizationRegistry%":
        typeof FinalizationRegistry === "undefined" ? undefined2 : FinalizationRegistry,
      "%Function%": $Function,
      "%GeneratorFunction%": needsEval,
      "%Int8Array%": typeof Int8Array === "undefined" ? undefined2 : Int8Array,
      "%Int16Array%": typeof Int16Array === "undefined" ? undefined2 : Int16Array,
      "%Int32Array%": typeof Int32Array === "undefined" ? undefined2 : Int32Array,
      "%isFinite%": isFinite,
      "%isNaN%": isNaN,
      "%IteratorPrototype%":
        hasSymbols && getProto ? getProto(getProto([][Symbol.iterator]())) : undefined2,
      "%JSON%": typeof JSON === "object" ? JSON : undefined2,
      "%Map%": typeof Map === "undefined" ? undefined2 : Map,
      "%MapIteratorPrototype%":
        typeof Map === "undefined" || !hasSymbols || !getProto
          ? undefined2
          : getProto(/* @__PURE__ */ new Map()[Symbol.iterator]()),
      "%Math%": Math,
      "%Number%": Number,
      "%Object%": $Object,
      "%Object.getOwnPropertyDescriptor%": $gOPD,
      "%parseFloat%": parseFloat,
      "%parseInt%": parseInt,
      "%Promise%": typeof Promise === "undefined" ? undefined2 : Promise,
      "%Proxy%": typeof Proxy === "undefined" ? undefined2 : Proxy,
      "%RangeError%": $RangeError,
      "%ReferenceError%": $ReferenceError,
      "%Reflect%": typeof Reflect === "undefined" ? undefined2 : Reflect,
      "%RegExp%": RegExp,
      "%Set%": typeof Set === "undefined" ? undefined2 : Set,
      "%SetIteratorPrototype%":
        typeof Set === "undefined" || !hasSymbols || !getProto
          ? undefined2
          : getProto(/* @__PURE__ */ new Set()[Symbol.iterator]()),
      "%SharedArrayBuffer%":
        typeof SharedArrayBuffer === "undefined" ? undefined2 : SharedArrayBuffer,
      "%String%": String,
      "%StringIteratorPrototype%":
        hasSymbols && getProto ? getProto(""[Symbol.iterator]()) : undefined2,
      "%Symbol%": hasSymbols ? Symbol : undefined2,
      "%SyntaxError%": $SyntaxError,
      "%ThrowTypeError%": ThrowTypeError,
      "%TypedArray%": TypedArray,
      "%TypeError%": $TypeError,
      "%Uint8Array%": typeof Uint8Array === "undefined" ? undefined2 : Uint8Array,
      "%Uint8ClampedArray%":
        typeof Uint8ClampedArray === "undefined" ? undefined2 : Uint8ClampedArray,
      "%Uint16Array%": typeof Uint16Array === "undefined" ? undefined2 : Uint16Array,
      "%Uint32Array%": typeof Uint32Array === "undefined" ? undefined2 : Uint32Array,
      "%URIError%": $URIError,
      "%WeakMap%": typeof WeakMap === "undefined" ? undefined2 : WeakMap,
      "%WeakRef%": typeof WeakRef === "undefined" ? undefined2 : WeakRef,
      "%WeakSet%": typeof WeakSet === "undefined" ? undefined2 : WeakSet,
      "%Function.prototype.call%": $call,
      "%Function.prototype.apply%": $apply,
      "%Object.defineProperty%": $defineProperty,
      "%Object.getPrototypeOf%": $ObjectGPO,
      "%Math.abs%": abs,
      "%Math.floor%": floor,
      "%Math.max%": max,
      "%Math.min%": min,
      "%Math.pow%": pow,
      "%Math.round%": round,
      "%Math.sign%": sign,
      "%Reflect.getPrototypeOf%": $ReflectGPO,
    };
    if (getProto) {
      try {
        null.error;
      } catch (e) {
        errorProto = getProto(getProto(e));
        INTRINSICS["%Error.prototype%"] = errorProto;
      }
    }
    var errorProto;
    var doEval = /* @__PURE__ */ __name(function doEval2(name) {
      var value;
      if (name === "%AsyncFunction%") {
        value = getEvalledConstructor("async function () {}");
      } else if (name === "%GeneratorFunction%") {
        value = getEvalledConstructor("function* () {}");
      } else if (name === "%AsyncGeneratorFunction%") {
        value = getEvalledConstructor("async function* () {}");
      } else if (name === "%AsyncGenerator%") {
        var fn = doEval2("%AsyncGeneratorFunction%");
        if (fn) {
          value = fn.prototype;
        }
      } else if (name === "%AsyncIteratorPrototype%") {
        var gen = doEval2("%AsyncGenerator%");
        if (gen && getProto) {
          value = getProto(gen.prototype);
        }
      }
      INTRINSICS[name] = value;
      return value;
    }, "doEval");
    var LEGACY_ALIASES = {
      __proto__: null,
      "%ArrayBufferPrototype%": ["ArrayBuffer", "prototype"],
      "%ArrayPrototype%": ["Array", "prototype"],
      "%ArrayProto_entries%": ["Array", "prototype", "entries"],
      "%ArrayProto_forEach%": ["Array", "prototype", "forEach"],
      "%ArrayProto_keys%": ["Array", "prototype", "keys"],
      "%ArrayProto_values%": ["Array", "prototype", "values"],
      "%AsyncFunctionPrototype%": ["AsyncFunction", "prototype"],
      "%AsyncGenerator%": ["AsyncGeneratorFunction", "prototype"],
      "%AsyncGeneratorPrototype%": ["AsyncGeneratorFunction", "prototype", "prototype"],
      "%BooleanPrototype%": ["Boolean", "prototype"],
      "%DataViewPrototype%": ["DataView", "prototype"],
      "%DatePrototype%": ["Date", "prototype"],
      "%ErrorPrototype%": ["Error", "prototype"],
      "%EvalErrorPrototype%": ["EvalError", "prototype"],
      "%Float32ArrayPrototype%": ["Float32Array", "prototype"],
      "%Float64ArrayPrototype%": ["Float64Array", "prototype"],
      "%FunctionPrototype%": ["Function", "prototype"],
      "%Generator%": ["GeneratorFunction", "prototype"],
      "%GeneratorPrototype%": ["GeneratorFunction", "prototype", "prototype"],
      "%Int8ArrayPrototype%": ["Int8Array", "prototype"],
      "%Int16ArrayPrototype%": ["Int16Array", "prototype"],
      "%Int32ArrayPrototype%": ["Int32Array", "prototype"],
      "%JSONParse%": ["JSON", "parse"],
      "%JSONStringify%": ["JSON", "stringify"],
      "%MapPrototype%": ["Map", "prototype"],
      "%NumberPrototype%": ["Number", "prototype"],
      "%ObjectPrototype%": ["Object", "prototype"],
      "%ObjProto_toString%": ["Object", "prototype", "toString"],
      "%ObjProto_valueOf%": ["Object", "prototype", "valueOf"],
      "%PromisePrototype%": ["Promise", "prototype"],
      "%PromiseProto_then%": ["Promise", "prototype", "then"],
      "%Promise_all%": ["Promise", "all"],
      "%Promise_reject%": ["Promise", "reject"],
      "%Promise_resolve%": ["Promise", "resolve"],
      "%RangeErrorPrototype%": ["RangeError", "prototype"],
      "%ReferenceErrorPrototype%": ["ReferenceError", "prototype"],
      "%RegExpPrototype%": ["RegExp", "prototype"],
      "%SetPrototype%": ["Set", "prototype"],
      "%SharedArrayBufferPrototype%": ["SharedArrayBuffer", "prototype"],
      "%StringPrototype%": ["String", "prototype"],
      "%SymbolPrototype%": ["Symbol", "prototype"],
      "%SyntaxErrorPrototype%": ["SyntaxError", "prototype"],
      "%TypedArrayPrototype%": ["TypedArray", "prototype"],
      "%TypeErrorPrototype%": ["TypeError", "prototype"],
      "%Uint8ArrayPrototype%": ["Uint8Array", "prototype"],
      "%Uint8ClampedArrayPrototype%": ["Uint8ClampedArray", "prototype"],
      "%Uint16ArrayPrototype%": ["Uint16Array", "prototype"],
      "%Uint32ArrayPrototype%": ["Uint32Array", "prototype"],
      "%URIErrorPrototype%": ["URIError", "prototype"],
      "%WeakMapPrototype%": ["WeakMap", "prototype"],
      "%WeakSetPrototype%": ["WeakSet", "prototype"],
    };
    var bind = require_function_bind();
    var hasOwn = require_hasown();
    var $concat = bind.call($call, Array.prototype.concat);
    var $spliceApply = bind.call($apply, Array.prototype.splice);
    var $replace = bind.call($call, String.prototype.replace);
    var $strSlice = bind.call($call, String.prototype.slice);
    var $exec = bind.call($call, RegExp.prototype.exec);
    var rePropName =
      /[^%.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|%$))/g;
    var reEscapeChar = /\\(\\)?/g;
    var stringToPath = /* @__PURE__ */ __name(function stringToPath2(string) {
      var first = $strSlice(string, 0, 1);
      var last = $strSlice(string, -1);
      if (first === "%" && last !== "%") {
        throw new $SyntaxError("invalid intrinsic syntax, expected closing `%`");
      } else if (last === "%" && first !== "%") {
        throw new $SyntaxError("invalid intrinsic syntax, expected opening `%`");
      }
      var result = [];
      $replace(string, rePropName, function (match, number, quote, subString) {
        result[result.length] = quote ? $replace(subString, reEscapeChar, "$1") : number || match;
      });
      return result;
    }, "stringToPath");
    var getBaseIntrinsic = /* @__PURE__ */ __name(function getBaseIntrinsic2(name, allowMissing) {
      var intrinsicName = name;
      var alias;
      if (hasOwn(LEGACY_ALIASES, intrinsicName)) {
        alias = LEGACY_ALIASES[intrinsicName];
        intrinsicName = "%" + alias[0] + "%";
      }
      if (hasOwn(INTRINSICS, intrinsicName)) {
        var value = INTRINSICS[intrinsicName];
        if (value === needsEval) {
          value = doEval(intrinsicName);
        }
        if (typeof value === "undefined" && !allowMissing) {
          throw new $TypeError(
            "intrinsic " + name + " exists, but is not available. Please file an issue!",
          );
        }
        return {
          alias,
          name: intrinsicName,
          value,
        };
      }
      throw new $SyntaxError("intrinsic " + name + " does not exist!");
    }, "getBaseIntrinsic");
    module.exports = /* @__PURE__ */ __name(function GetIntrinsic(name, allowMissing) {
      if (typeof name !== "string" || name.length === 0) {
        throw new $TypeError("intrinsic name must be a non-empty string");
      }
      if (arguments.length > 1 && typeof allowMissing !== "boolean") {
        throw new $TypeError('"allowMissing" argument must be a boolean');
      }
      if ($exec(/^%?[^%]*%?$/, name) === null) {
        throw new $SyntaxError(
          "`%` may not be present anywhere but at the beginning and end of the intrinsic name",
        );
      }
      var parts = stringToPath(name);
      var intrinsicBaseName = parts.length > 0 ? parts[0] : "";
      var intrinsic = getBaseIntrinsic("%" + intrinsicBaseName + "%", allowMissing);
      var intrinsicRealName = intrinsic.name;
      var value = intrinsic.value;
      var skipFurtherCaching = false;
      var alias = intrinsic.alias;
      if (alias) {
        intrinsicBaseName = alias[0];
        $spliceApply(parts, $concat([0, 1], alias));
      }
      for (var i = 1, isOwn = true; i < parts.length; i += 1) {
        var part = parts[i];
        var first = $strSlice(part, 0, 1);
        var last = $strSlice(part, -1);
        if (
          (first === '"' ||
            first === "'" ||
            first === "`" ||
            last === '"' ||
            last === "'" ||
            last === "`") &&
          first !== last
        ) {
          throw new $SyntaxError("property names with quotes must have matching quotes");
        }
        if (part === "constructor" || !isOwn) {
          skipFurtherCaching = true;
        }
        intrinsicBaseName += "." + part;
        intrinsicRealName = "%" + intrinsicBaseName + "%";
        if (hasOwn(INTRINSICS, intrinsicRealName)) {
          value = INTRINSICS[intrinsicRealName];
        } else if (value != null) {
          if (!(part in value)) {
            if (!allowMissing) {
              throw new $TypeError(
                "base intrinsic for " + name + " exists, but the property is not available.",
              );
            }
            return void 0;
          }
          if ($gOPD && i + 1 >= parts.length) {
            var desc = $gOPD(value, part);
            isOwn = !!desc;
            if (isOwn && "get" in desc && !("originalValue" in desc.get)) {
              value = desc.get;
            } else {
              value = value[part];
            }
          } else {
            isOwn = hasOwn(value, part);
            value = value[part];
          }
          if (isOwn && !skipFurtherCaching) {
            INTRINSICS[intrinsicRealName] = value;
          }
        }
      }
      return value;
    }, "GetIntrinsic");
  },
});

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/define-data-property@1.1.4/node_modules/define-data-property/index.js
var require_define_data_property = __commonJS({
  "../../../../.prototypes/trigger-dev/node_modules/.pnpm/define-data-property@1.1.4/node_modules/define-data-property/index.js"(
    exports,
    module,
  ) {
    "use strict";
    init_esm();
    var $defineProperty = require_es_define_property();
    var $SyntaxError = require_syntax();
    var $TypeError = require_type();
    var gopd = require_gopd();
    module.exports = /* @__PURE__ */ __name(function defineDataProperty(obj, property, value) {
      if (!obj || (typeof obj !== "object" && typeof obj !== "function")) {
        throw new $TypeError("`obj` must be an object or a function`");
      }
      if (typeof property !== "string" && typeof property !== "symbol") {
        throw new $TypeError("`property` must be a string or a symbol`");
      }
      if (arguments.length > 3 && typeof arguments[3] !== "boolean" && arguments[3] !== null) {
        throw new $TypeError("`nonEnumerable`, if provided, must be a boolean or null");
      }
      if (arguments.length > 4 && typeof arguments[4] !== "boolean" && arguments[4] !== null) {
        throw new $TypeError("`nonWritable`, if provided, must be a boolean or null");
      }
      if (arguments.length > 5 && typeof arguments[5] !== "boolean" && arguments[5] !== null) {
        throw new $TypeError("`nonConfigurable`, if provided, must be a boolean or null");
      }
      if (arguments.length > 6 && typeof arguments[6] !== "boolean") {
        throw new $TypeError("`loose`, if provided, must be a boolean");
      }
      var nonEnumerable = arguments.length > 3 ? arguments[3] : null;
      var nonWritable = arguments.length > 4 ? arguments[4] : null;
      var nonConfigurable = arguments.length > 5 ? arguments[5] : null;
      var loose = arguments.length > 6 ? arguments[6] : false;
      var desc = !!gopd && gopd(obj, property);
      if ($defineProperty) {
        $defineProperty(obj, property, {
          configurable: nonConfigurable === null && desc ? desc.configurable : !nonConfigurable,
          enumerable: nonEnumerable === null && desc ? desc.enumerable : !nonEnumerable,
          value,
          writable: nonWritable === null && desc ? desc.writable : !nonWritable,
        });
      } else if (loose || (!nonEnumerable && !nonWritable && !nonConfigurable)) {
        obj[property] = value;
      } else {
        throw new $SyntaxError(
          "This environment does not support defining a property as non-configurable, non-writable, or non-enumerable.",
        );
      }
    }, "defineDataProperty");
  },
});

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/has-property-descriptors@1.0.2/node_modules/has-property-descriptors/index.js
var require_has_property_descriptors = __commonJS({
  "../../../../.prototypes/trigger-dev/node_modules/.pnpm/has-property-descriptors@1.0.2/node_modules/has-property-descriptors/index.js"(
    exports,
    module,
  ) {
    "use strict";
    init_esm();
    var $defineProperty = require_es_define_property();
    var hasPropertyDescriptors = /* @__PURE__ */ __name(function hasPropertyDescriptors2() {
      return !!$defineProperty;
    }, "hasPropertyDescriptors");
    hasPropertyDescriptors.hasArrayLengthDefineBug = /* @__PURE__ */ __name(
      function hasArrayLengthDefineBug() {
        if (!$defineProperty) {
          return null;
        }
        try {
          return $defineProperty([], "length", { value: 1 }).length !== 1;
        } catch (e) {
          return true;
        }
      },
      "hasArrayLengthDefineBug",
    );
    module.exports = hasPropertyDescriptors;
  },
});

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/set-function-length@1.2.2/node_modules/set-function-length/index.js
var require_set_function_length = __commonJS({
  "../../../../.prototypes/trigger-dev/node_modules/.pnpm/set-function-length@1.2.2/node_modules/set-function-length/index.js"(
    exports,
    module,
  ) {
    "use strict";
    init_esm();
    var GetIntrinsic = require_get_intrinsic();
    var define = require_define_data_property();
    var hasDescriptors = require_has_property_descriptors()();
    var gOPD = require_gopd();
    var $TypeError = require_type();
    var $floor = GetIntrinsic("%Math.floor%");
    module.exports = /* @__PURE__ */ __name(function setFunctionLength(fn, length) {
      if (typeof fn !== "function") {
        throw new $TypeError("`fn` is not a function");
      }
      if (
        typeof length !== "number" ||
        length < 0 ||
        length > 4294967295 ||
        $floor(length) !== length
      ) {
        throw new $TypeError("`length` must be a positive 32-bit integer");
      }
      var loose = arguments.length > 2 && !!arguments[2];
      var functionLengthIsConfigurable = true;
      var functionLengthIsWritable = true;
      if ("length" in fn && gOPD) {
        var desc = gOPD(fn, "length");
        if (desc && !desc.configurable) {
          functionLengthIsConfigurable = false;
        }
        if (desc && !desc.writable) {
          functionLengthIsWritable = false;
        }
      }
      if (functionLengthIsConfigurable || functionLengthIsWritable || !loose) {
        if (hasDescriptors) {
          define(
            /** @type {Parameters<define>[0]} */
            fn,
            "length",
            length,
            true,
            true,
          );
        } else {
          define(
            /** @type {Parameters<define>[0]} */
            fn,
            "length",
            length,
          );
        }
      }
      return fn;
    }, "setFunctionLength");
  },
});

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/call-bind-apply-helpers@1.0.2/node_modules/call-bind-apply-helpers/applyBind.js
var require_applyBind = __commonJS({
  "../../../../.prototypes/trigger-dev/node_modules/.pnpm/call-bind-apply-helpers@1.0.2/node_modules/call-bind-apply-helpers/applyBind.js"(
    exports,
    module,
  ) {
    "use strict";
    init_esm();
    var bind = require_function_bind();
    var $apply = require_functionApply();
    var actualApply = require_actualApply();
    module.exports = /* @__PURE__ */ __name(function applyBind() {
      return actualApply(bind, $apply, arguments);
    }, "applyBind");
  },
});

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/call-bind@1.0.9/node_modules/call-bind/index.js
var require_call_bind = __commonJS({
  "../../../../.prototypes/trigger-dev/node_modules/.pnpm/call-bind@1.0.9/node_modules/call-bind/index.js"(
    exports,
    module,
  ) {
    "use strict";
    init_esm();
    var setFunctionLength = require_set_function_length();
    var $defineProperty = require_es_define_property();
    var callBindBasic = require_call_bind_apply_helpers();
    var applyBind = require_applyBind();
    module.exports = /* @__PURE__ */ __name(function callBind(originalFunction) {
      var func = callBindBasic(arguments);
      var adjustedLength = 1 + originalFunction.length - (arguments.length - 1);
      return setFunctionLength(func, adjustedLength > 0 ? adjustedLength : 0, true);
    }, "callBind");
    if ($defineProperty) {
      $defineProperty(module.exports, "apply", { value: applyBind });
    } else {
      module.exports.apply = applyBind;
    }
  },
});

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/call-bound@1.0.4/node_modules/call-bound/index.js
var require_call_bound = __commonJS({
  "../../../../.prototypes/trigger-dev/node_modules/.pnpm/call-bound@1.0.4/node_modules/call-bound/index.js"(
    exports,
    module,
  ) {
    "use strict";
    init_esm();
    var GetIntrinsic = require_get_intrinsic();
    var callBindBasic = require_call_bind_apply_helpers();
    var $indexOf = callBindBasic([GetIntrinsic("%String.prototype.indexOf%")]);
    module.exports = /* @__PURE__ */ __name(function callBoundIntrinsic(name, allowMissing) {
      var intrinsic =
        /** @type {(this: unknown, ...args: unknown[]) => unknown} */
        GetIntrinsic(name, !!allowMissing);
      if (typeof intrinsic === "function" && $indexOf(name, ".prototype.") > -1) {
        return callBindBasic(
          /** @type {const} */
          [intrinsic],
        );
      }
      return intrinsic;
    }, "callBoundIntrinsic");
  },
});

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/json-stable-stringify@1.3.0/node_modules/json-stable-stringify/index.js
var require_json_stable_stringify = __commonJS({
  "../../../../.prototypes/trigger-dev/node_modules/.pnpm/json-stable-stringify@1.3.0/node_modules/json-stable-stringify/index.js"(
    exports,
    module,
  ) {
    "use strict";
    init_esm();
    var jsonStringify = (typeof JSON !== "undefined" ? JSON : require_jsonify()).stringify;
    var isArray = require_isarray();
    var objectKeys = require_object_keys();
    var callBind = require_call_bind();
    var callBound = require_call_bound();
    var $join = callBound("Array.prototype.join");
    var $indexOf = callBound("Array.prototype.indexOf");
    var $splice = callBound("Array.prototype.splice");
    var $sort = callBound("Array.prototype.sort");
    var strRepeat = /* @__PURE__ */ __name(function repeat(n, char) {
      var str = "";
      for (var i = 0; i < n; i += 1) {
        str += char;
      }
      return str;
    }, "repeat");
    var defaultReplacer = /* @__PURE__ */ __name(function (_parent, _key, value) {
      return value;
    }, "defaultReplacer");
    module.exports = /* @__PURE__ */ __name(function stableStringify(obj) {
      var opts = arguments.length > 1 ? arguments[1] : void 0;
      var space = (opts && opts.space) || "";
      if (typeof space === "number") {
        space = strRepeat(space, " ");
      }
      var cycles = !!opts && typeof opts.cycles === "boolean" && opts.cycles;
      var replacer = opts && opts.replacer ? callBind(opts.replacer) : defaultReplacer;
      if (
        opts &&
        typeof opts.collapseEmpty !== "undefined" &&
        typeof opts.collapseEmpty !== "boolean"
      ) {
        throw new TypeError("`collapseEmpty` must be a boolean, if provided");
      }
      var collapseEmpty = !!opts && opts.collapseEmpty;
      var cmpOpt = typeof opts === "function" ? opts : opts && opts.cmp;
      var cmp =
        cmpOpt &&
        function (node) {
          var get =
            /** @type {NonNullable<typeof cmpOpt>} */
            cmpOpt.length > 2 &&
            /** @type {import('.').Getter['get']} */
            /* @__PURE__ */ __name(function get2(k) {
              return node[k];
            }, "get");
          return function (a, b) {
            return (
              /** @type {NonNullable<typeof cmpOpt>} */
              cmpOpt(
                { key: a, value: node[a] },
                { key: b, value: node[b] },
                // @ts-expect-error TS doesn't understand the optimization used here
                get
                  ? /** @type {import('.').Getter} */
                    { __proto__: null, get }
                  : void 0,
              )
            );
          };
        };
      var seen = [];
      return (
        /** @type {(parent: import('.').Node, key: string | number, node: unknown, level: number) => string | undefined} */
        (
          /* @__PURE__ */ __name(function stringify2(parent, key, node, level) {
            var indent = space ? "\n" + strRepeat(level, space) : "";
            var colonSeparator = space ? ": " : ":";
            if (
              node &&
              /** @type {{ toJSON?: unknown }} */
              node.toJSON &&
              typeof (/** @type {{ toJSON?: unknown }} */ node.toJSON) === "function"
            ) {
              node = /** @type {{ toJSON: Function }} */ node.toJSON();
            }
            node = replacer(parent, key, node);
            if (node === void 0) {
              return;
            }
            if (typeof node !== "object" || node === null) {
              return jsonStringify(node);
            }
            var groupOutput = /* @__PURE__ */ __name(function (out2, brackets) {
              return collapseEmpty && out2.length === 0
                ? brackets
                : (brackets === "[]" ? "[" : "{") +
                    $join(out2, ",") +
                    indent +
                    (brackets === "[]" ? "]" : "}");
            }, "groupOutput");
            if (isArray(node)) {
              var out = [];
              for (var i = 0; i < node.length; i++) {
                var item = stringify2(node, i, node[i], level + 1) || jsonStringify(null);
                out[out.length] = indent + space + item;
              }
              return groupOutput(out, "[]");
            }
            if ($indexOf(seen, node) !== -1) {
              if (cycles) {
                return jsonStringify("__cycle__");
              }
              throw new TypeError("Converting circular structure to JSON");
            } else {
              seen[seen.length] = /** @type {import('.').NonArrayNode} */ node;
            }
            var keys = $sort(
              objectKeys(node),
              cmp &&
                cmp(
                  /** @type {import('.').NonArrayNode} */
                  node,
                ),
            );
            var out = [];
            for (var i = 0; i < keys.length; i++) {
              var key = keys[i];
              var value = stringify2(
                /** @type {import('.').Node} */
                node,
                key,
                /** @type {import('.').NonArrayNode} */
                node[key],
                level + 1,
              );
              if (!value) {
                continue;
              }
              var keyValue = jsonStringify(key) + colonSeparator + value;
              out[out.length] = indent + space + keyValue;
            }
            $splice(seen, $indexOf(seen, node), 1);
            return groupOutput(out, "{}");
          }, "stringify")
        )({ "": obj }, "", obj, 0)
      );
    }, "stableStringify");
  },
});

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/trigger.dev@4.5.4_typescript@6.0.3/node_modules/trigger.dev/dist/esm/utilities/logger.js
init_esm();
import { format } from "node:util";

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/chalk@5.6.2/node_modules/chalk/source/index.js
init_esm();

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/chalk@5.6.2/node_modules/chalk/source/vendor/ansi-styles/index.js
init_esm();
var ANSI_BACKGROUND_OFFSET = 10;
var wrapAnsi16 = /* @__PURE__ */ __name(
  (offset = 0) =>
    (code) =>
      `\x1B[${code + offset}m`,
  "wrapAnsi16",
);
var wrapAnsi256 = /* @__PURE__ */ __name(
  (offset = 0) =>
    (code) =>
      `\x1B[${38 + offset};5;${code}m`,
  "wrapAnsi256",
);
var wrapAnsi16m = /* @__PURE__ */ __name(
  (offset = 0) =>
    (red, green, blue) =>
      `\x1B[${38 + offset};2;${red};${green};${blue}m`,
  "wrapAnsi16m",
);
var styles = {
  modifier: {
    reset: [0, 0],
    // 21 isn't widely supported and 22 does the same thing
    bold: [1, 22],
    dim: [2, 22],
    italic: [3, 23],
    underline: [4, 24],
    overline: [53, 55],
    inverse: [7, 27],
    hidden: [8, 28],
    strikethrough: [9, 29],
  },
  color: {
    black: [30, 39],
    red: [31, 39],
    green: [32, 39],
    yellow: [33, 39],
    blue: [34, 39],
    magenta: [35, 39],
    cyan: [36, 39],
    white: [37, 39],
    // Bright color
    blackBright: [90, 39],
    gray: [90, 39],
    // Alias of `blackBright`
    grey: [90, 39],
    // Alias of `blackBright`
    redBright: [91, 39],
    greenBright: [92, 39],
    yellowBright: [93, 39],
    blueBright: [94, 39],
    magentaBright: [95, 39],
    cyanBright: [96, 39],
    whiteBright: [97, 39],
  },
  bgColor: {
    bgBlack: [40, 49],
    bgRed: [41, 49],
    bgGreen: [42, 49],
    bgYellow: [43, 49],
    bgBlue: [44, 49],
    bgMagenta: [45, 49],
    bgCyan: [46, 49],
    bgWhite: [47, 49],
    // Bright color
    bgBlackBright: [100, 49],
    bgGray: [100, 49],
    // Alias of `bgBlackBright`
    bgGrey: [100, 49],
    // Alias of `bgBlackBright`
    bgRedBright: [101, 49],
    bgGreenBright: [102, 49],
    bgYellowBright: [103, 49],
    bgBlueBright: [104, 49],
    bgMagentaBright: [105, 49],
    bgCyanBright: [106, 49],
    bgWhiteBright: [107, 49],
  },
};
var modifierNames = Object.keys(styles.modifier);
var foregroundColorNames = Object.keys(styles.color);
var backgroundColorNames = Object.keys(styles.bgColor);
var colorNames = [...foregroundColorNames, ...backgroundColorNames];
function assembleStyles() {
  const codes = /* @__PURE__ */ new Map();
  for (const [groupName, group] of Object.entries(styles)) {
    for (const [styleName, style] of Object.entries(group)) {
      styles[styleName] = {
        open: `\x1B[${style[0]}m`,
        close: `\x1B[${style[1]}m`,
      };
      group[styleName] = styles[styleName];
      codes.set(style[0], style[1]);
    }
    Object.defineProperty(styles, groupName, {
      value: group,
      enumerable: false,
    });
  }
  Object.defineProperty(styles, "codes", {
    value: codes,
    enumerable: false,
  });
  styles.color.close = "\x1B[39m";
  styles.bgColor.close = "\x1B[49m";
  styles.color.ansi = wrapAnsi16();
  styles.color.ansi256 = wrapAnsi256();
  styles.color.ansi16m = wrapAnsi16m();
  styles.bgColor.ansi = wrapAnsi16(ANSI_BACKGROUND_OFFSET);
  styles.bgColor.ansi256 = wrapAnsi256(ANSI_BACKGROUND_OFFSET);
  styles.bgColor.ansi16m = wrapAnsi16m(ANSI_BACKGROUND_OFFSET);
  Object.defineProperties(styles, {
    rgbToAnsi256: {
      value(red, green, blue) {
        if (red === green && green === blue) {
          if (red < 8) {
            return 16;
          }
          if (red > 248) {
            return 231;
          }
          return Math.round(((red - 8) / 247) * 24) + 232;
        }
        return (
          16 +
          36 * Math.round((red / 255) * 5) +
          6 * Math.round((green / 255) * 5) +
          Math.round((blue / 255) * 5)
        );
      },
      enumerable: false,
    },
    hexToRgb: {
      value(hex) {
        const matches = /[a-f\d]{6}|[a-f\d]{3}/i.exec(hex.toString(16));
        if (!matches) {
          return [0, 0, 0];
        }
        let [colorString] = matches;
        if (colorString.length === 3) {
          colorString = [...colorString].map((character) => character + character).join("");
        }
        const integer = Number.parseInt(colorString, 16);
        return [
          /* eslint-disable no-bitwise */
          (integer >> 16) & 255,
          (integer >> 8) & 255,
          integer & 255,
          /* eslint-enable no-bitwise */
        ];
      },
      enumerable: false,
    },
    hexToAnsi256: {
      value: /* @__PURE__ */ __name((hex) => styles.rgbToAnsi256(...styles.hexToRgb(hex)), "value"),
      enumerable: false,
    },
    ansi256ToAnsi: {
      value(code) {
        if (code < 8) {
          return 30 + code;
        }
        if (code < 16) {
          return 90 + (code - 8);
        }
        let red;
        let green;
        let blue;
        if (code >= 232) {
          red = ((code - 232) * 10 + 8) / 255;
          green = red;
          blue = red;
        } else {
          code -= 16;
          const remainder = code % 36;
          red = Math.floor(code / 36) / 5;
          green = Math.floor(remainder / 6) / 5;
          blue = (remainder % 6) / 5;
        }
        const value = Math.max(red, green, blue) * 2;
        if (value === 0) {
          return 30;
        }
        let result = 30 + ((Math.round(blue) << 2) | (Math.round(green) << 1) | Math.round(red));
        if (value === 2) {
          result += 60;
        }
        return result;
      },
      enumerable: false,
    },
    rgbToAnsi: {
      value: /* @__PURE__ */ __name(
        (red, green, blue) => styles.ansi256ToAnsi(styles.rgbToAnsi256(red, green, blue)),
        "value",
      ),
      enumerable: false,
    },
    hexToAnsi: {
      value: /* @__PURE__ */ __name(
        (hex) => styles.ansi256ToAnsi(styles.hexToAnsi256(hex)),
        "value",
      ),
      enumerable: false,
    },
  });
  return styles;
}
__name(assembleStyles, "assembleStyles");
var ansiStyles = assembleStyles();
var ansi_styles_default = ansiStyles;

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/chalk@5.6.2/node_modules/chalk/source/vendor/supports-color/index.js
init_esm();
import process2 from "node:process";
import os from "node:os";
import tty from "node:tty";
function hasFlag(flag, argv = globalThis.Deno ? globalThis.Deno.args : process2.argv) {
  const prefix = flag.startsWith("-") ? "" : flag.length === 1 ? "-" : "--";
  const position = argv.indexOf(prefix + flag);
  const terminatorPosition = argv.indexOf("--");
  return position !== -1 && (terminatorPosition === -1 || position < terminatorPosition);
}
__name(hasFlag, "hasFlag");
var { env } = process2;
var flagForceColor;
if (
  hasFlag("no-color") ||
  hasFlag("no-colors") ||
  hasFlag("color=false") ||
  hasFlag("color=never")
) {
  flagForceColor = 0;
} else if (
  hasFlag("color") ||
  hasFlag("colors") ||
  hasFlag("color=true") ||
  hasFlag("color=always")
) {
  flagForceColor = 1;
}
function envForceColor() {
  if ("FORCE_COLOR" in env) {
    if (env.FORCE_COLOR === "true") {
      return 1;
    }
    if (env.FORCE_COLOR === "false") {
      return 0;
    }
    return env.FORCE_COLOR.length === 0 ? 1 : Math.min(Number.parseInt(env.FORCE_COLOR, 10), 3);
  }
}
__name(envForceColor, "envForceColor");
function translateLevel(level) {
  if (level === 0) {
    return false;
  }
  return {
    level,
    hasBasic: true,
    has256: level >= 2,
    has16m: level >= 3,
  };
}
__name(translateLevel, "translateLevel");
function _supportsColor(haveStream, { streamIsTTY, sniffFlags = true } = {}) {
  const noFlagForceColor = envForceColor();
  if (noFlagForceColor !== void 0) {
    flagForceColor = noFlagForceColor;
  }
  const forceColor = sniffFlags ? flagForceColor : noFlagForceColor;
  if (forceColor === 0) {
    return 0;
  }
  if (sniffFlags) {
    if (hasFlag("color=16m") || hasFlag("color=full") || hasFlag("color=truecolor")) {
      return 3;
    }
    if (hasFlag("color=256")) {
      return 2;
    }
  }
  if ("TF_BUILD" in env && "AGENT_NAME" in env) {
    return 1;
  }
  if (haveStream && !streamIsTTY && forceColor === void 0) {
    return 0;
  }
  const min = forceColor || 0;
  if (env.TERM === "dumb") {
    return min;
  }
  if (process2.platform === "win32") {
    const osRelease = os.release().split(".");
    if (Number(osRelease[0]) >= 10 && Number(osRelease[2]) >= 10586) {
      return Number(osRelease[2]) >= 14931 ? 3 : 2;
    }
    return 1;
  }
  if ("CI" in env) {
    if (["GITHUB_ACTIONS", "GITEA_ACTIONS", "CIRCLECI"].some((key) => key in env)) {
      return 3;
    }
    if (
      ["TRAVIS", "APPVEYOR", "GITLAB_CI", "BUILDKITE", "DRONE"].some((sign) => sign in env) ||
      env.CI_NAME === "codeship"
    ) {
      return 1;
    }
    return min;
  }
  if ("TEAMCITY_VERSION" in env) {
    return /^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/.test(env.TEAMCITY_VERSION) ? 1 : 0;
  }
  if (env.COLORTERM === "truecolor") {
    return 3;
  }
  if (env.TERM === "xterm-kitty") {
    return 3;
  }
  if (env.TERM === "xterm-ghostty") {
    return 3;
  }
  if (env.TERM === "wezterm") {
    return 3;
  }
  if ("TERM_PROGRAM" in env) {
    const version = Number.parseInt((env.TERM_PROGRAM_VERSION || "").split(".")[0], 10);
    switch (env.TERM_PROGRAM) {
      case "iTerm.app": {
        return version >= 3 ? 3 : 2;
      }
      case "Apple_Terminal": {
        return 2;
      }
    }
  }
  if (/-256(color)?$/i.test(env.TERM)) {
    return 2;
  }
  if (/^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(env.TERM)) {
    return 1;
  }
  if ("COLORTERM" in env) {
    return 1;
  }
  return min;
}
__name(_supportsColor, "_supportsColor");
function createSupportsColor(stream, options = {}) {
  const level = _supportsColor(stream, {
    streamIsTTY: stream && stream.isTTY,
    ...options,
  });
  return translateLevel(level);
}
__name(createSupportsColor, "createSupportsColor");
var supportsColor = {
  stdout: createSupportsColor({ isTTY: tty.isatty(1) }),
  stderr: createSupportsColor({ isTTY: tty.isatty(2) }),
};
var supports_color_default = supportsColor;

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/chalk@5.6.2/node_modules/chalk/source/utilities.js
init_esm();
function stringReplaceAll(string, substring, replacer) {
  let index = string.indexOf(substring);
  if (index === -1) {
    return string;
  }
  const substringLength = substring.length;
  let endIndex = 0;
  let returnValue = "";
  do {
    returnValue += string.slice(endIndex, index) + substring + replacer;
    endIndex = index + substringLength;
    index = string.indexOf(substring, endIndex);
  } while (index !== -1);
  returnValue += string.slice(endIndex);
  return returnValue;
}
__name(stringReplaceAll, "stringReplaceAll");
function stringEncaseCRLFWithFirstIndex(string, prefix, postfix, index) {
  let endIndex = 0;
  let returnValue = "";
  do {
    const gotCR = string[index - 1] === "\r";
    returnValue +=
      string.slice(endIndex, gotCR ? index - 1 : index) +
      prefix +
      (gotCR ? "\r\n" : "\n") +
      postfix;
    endIndex = index + 1;
    index = string.indexOf("\n", endIndex);
  } while (index !== -1);
  returnValue += string.slice(endIndex);
  return returnValue;
}
__name(stringEncaseCRLFWithFirstIndex, "stringEncaseCRLFWithFirstIndex");

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/chalk@5.6.2/node_modules/chalk/source/index.js
var { stdout: stdoutColor, stderr: stderrColor } = supports_color_default;
var GENERATOR = Symbol("GENERATOR");
var STYLER = Symbol("STYLER");
var IS_EMPTY = Symbol("IS_EMPTY");
var levelMapping = ["ansi", "ansi", "ansi256", "ansi16m"];
var styles2 = /* @__PURE__ */ Object.create(null);
var applyOptions = /* @__PURE__ */ __name((object, options = {}) => {
  if (
    options.level &&
    !(Number.isInteger(options.level) && options.level >= 0 && options.level <= 3)
  ) {
    throw new Error("The `level` option should be an integer from 0 to 3");
  }
  const colorLevel = stdoutColor ? stdoutColor.level : 0;
  object.level = options.level === void 0 ? colorLevel : options.level;
}, "applyOptions");
var chalkFactory = /* @__PURE__ */ __name((options) => {
  const chalk2 = /* @__PURE__ */ __name((...strings) => strings.join(" "), "chalk");
  applyOptions(chalk2, options);
  Object.setPrototypeOf(chalk2, createChalk.prototype);
  return chalk2;
}, "chalkFactory");
function createChalk(options) {
  return chalkFactory(options);
}
__name(createChalk, "createChalk");
Object.setPrototypeOf(createChalk.prototype, Function.prototype);
for (const [styleName, style] of Object.entries(ansi_styles_default)) {
  styles2[styleName] = {
    get() {
      const builder = createBuilder(
        this,
        createStyler(style.open, style.close, this[STYLER]),
        this[IS_EMPTY],
      );
      Object.defineProperty(this, styleName, { value: builder });
      return builder;
    },
  };
}
styles2.visible = {
  get() {
    const builder = createBuilder(this, this[STYLER], true);
    Object.defineProperty(this, "visible", { value: builder });
    return builder;
  },
};
var getModelAnsi = /* @__PURE__ */ __name((model, level, type, ...arguments_) => {
  if (model === "rgb") {
    if (level === "ansi16m") {
      return ansi_styles_default[type].ansi16m(...arguments_);
    }
    if (level === "ansi256") {
      return ansi_styles_default[type].ansi256(ansi_styles_default.rgbToAnsi256(...arguments_));
    }
    return ansi_styles_default[type].ansi(ansi_styles_default.rgbToAnsi(...arguments_));
  }
  if (model === "hex") {
    return getModelAnsi("rgb", level, type, ...ansi_styles_default.hexToRgb(...arguments_));
  }
  return ansi_styles_default[type][model](...arguments_);
}, "getModelAnsi");
var usedModels = ["rgb", "hex", "ansi256"];
for (const model of usedModels) {
  styles2[model] = {
    get() {
      const { level } = this;
      return function (...arguments_) {
        const styler = createStyler(
          getModelAnsi(model, levelMapping[level], "color", ...arguments_),
          ansi_styles_default.color.close,
          this[STYLER],
        );
        return createBuilder(this, styler, this[IS_EMPTY]);
      };
    },
  };
  const bgModel = "bg" + model[0].toUpperCase() + model.slice(1);
  styles2[bgModel] = {
    get() {
      const { level } = this;
      return function (...arguments_) {
        const styler = createStyler(
          getModelAnsi(model, levelMapping[level], "bgColor", ...arguments_),
          ansi_styles_default.bgColor.close,
          this[STYLER],
        );
        return createBuilder(this, styler, this[IS_EMPTY]);
      };
    },
  };
}
var proto = Object.defineProperties(() => {}, {
  ...styles2,
  level: {
    enumerable: true,
    get() {
      return this[GENERATOR].level;
    },
    set(level) {
      this[GENERATOR].level = level;
    },
  },
});
var createStyler = /* @__PURE__ */ __name((open, close, parent) => {
  let openAll;
  let closeAll;
  if (parent === void 0) {
    openAll = open;
    closeAll = close;
  } else {
    openAll = parent.openAll + open;
    closeAll = close + parent.closeAll;
  }
  return {
    open,
    close,
    openAll,
    closeAll,
    parent,
  };
}, "createStyler");
var createBuilder = /* @__PURE__ */ __name((self, _styler, _isEmpty) => {
  const builder = /* @__PURE__ */ __name(
    (...arguments_) =>
      applyStyle(builder, arguments_.length === 1 ? "" + arguments_[0] : arguments_.join(" ")),
    "builder",
  );
  Object.setPrototypeOf(builder, proto);
  builder[GENERATOR] = self;
  builder[STYLER] = _styler;
  builder[IS_EMPTY] = _isEmpty;
  return builder;
}, "createBuilder");
var applyStyle = /* @__PURE__ */ __name((self, string) => {
  if (self.level <= 0 || !string) {
    return self[IS_EMPTY] ? "" : string;
  }
  let styler = self[STYLER];
  if (styler === void 0) {
    return string;
  }
  const { openAll, closeAll } = styler;
  if (string.includes("\x1B")) {
    while (styler !== void 0) {
      string = stringReplaceAll(string, styler.close, styler.open);
      styler = styler.parent;
    }
  }
  const lfIndex = string.indexOf("\n");
  if (lfIndex !== -1) {
    string = stringEncaseCRLFWithFirstIndex(string, closeAll, openAll, lfIndex);
  }
  return openAll + string + closeAll;
}, "applyStyle");
Object.defineProperties(createChalk.prototype, styles2);
var chalk = createChalk();
var chalkStderr = createChalk({ level: stderrColor ? stderrColor.level : 0 });
var source_default = chalk;

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/trigger.dev@4.5.4_typescript@6.0.3/node_modules/trigger.dev/dist/esm/utilities/logger.js
var import_cli_table3 = __toESM(require_cli_table3(), 1);
var import_esbuild = __toESM(require_main(), 1);
var LOGGER_LEVELS = {
  none: -1,
  error: 0,
  warn: 1,
  info: 2,
  log: 3,
  debug: 4,
};
var LOGGER_LEVEL_FORMAT_TYPE_MAP = {
  error: "error",
  warn: "warning",
  info: void 0,
  log: void 0,
  debug: void 0,
};
function getLoggerLevel() {
  const fromEnv = o.TRIGGER_LOG_LEVEL?.toLowerCase();
  if (fromEnv !== void 0) {
    if (fromEnv in LOGGER_LEVELS) return fromEnv;
    const expected = Object.keys(LOGGER_LEVELS)
      .map((level) => `"${level}"`)
      .join(" | ");
    console.warn(
      `Unrecognised TRIGGER_LOG_LEVEL value ${JSON.stringify(fromEnv)}, expected ${expected}, defaulting to "log"...`,
    );
  }
  return "log";
}
__name(getLoggerLevel, "getLoggerLevel");
var Logger = class {
  static {
    __name(this, "Logger");
  }
  constructor() {}
  loggerLevel = getLoggerLevel();
  columns = process.stdout.columns;
  debug = /* @__PURE__ */ __name((...args) => this.doLog("debug", args), "debug");
  ignore = /* @__PURE__ */ __name((...args) => {}, "ignore");
  debugWithSanitization = /* @__PURE__ */ __name((label, ...args) => {
    this.doLog("debug", [label, ...args]);
  }, "debugWithSanitization");
  info = /* @__PURE__ */ __name((...args) => this.doLog("info", args), "info");
  log = /* @__PURE__ */ __name((...args) => this.doLog("log", args), "log");
  /** @deprecated **ONLY USE THIS IN THE CLI** - It will hang the process when used in deployed code (!) */
  warn = /* @__PURE__ */ __name((...args) => this.doLog("warn", args), "warn");
  /** @deprecated **ONLY USE THIS IN THE CLI** - It will hang the process when used in deployed code (!) */
  error = /* @__PURE__ */ __name((...args) => this.doLog("error", args), "error");
  table(data, level) {
    const keys = data.length === 0 ? [] : Object.keys(data[0]);
    const t = new import_cli_table3.default({
      head: keys,
      style: {
        head: source_default.level ? ["blue"] : [],
        border: source_default.level ? ["gray"] : [],
      },
    });
    t.push(...data.map((row) => keys.map((k) => row[k])));
    return this.doLog(level ?? "log", [t.toString()]);
  }
  doLog(messageLevel, args) {
    const message = this.formatMessage(messageLevel, format(...args));
    if (LOGGER_LEVELS[this.loggerLevel] >= LOGGER_LEVELS[messageLevel]) {
      console[messageLevel](message);
    }
  }
  formatMessage(level, message) {
    const kind = LOGGER_LEVEL_FORMAT_TYPE_MAP[level];
    if (kind) {
      const [firstLine, ...otherLines] = message.split("\n");
      const notes = otherLines.length > 0 ? otherLines.map((text) => ({ text })) : void 0;
      return (0, import_esbuild.formatMessagesSync)([{ text: firstLine, notes }], {
        color: true,
        kind,
        terminalWidth: this.columns,
      })[0];
    } else {
      return message;
    }
  }
};
var logger = new Logger();

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/trigger.dev@4.5.4_typescript@6.0.3/node_modules/trigger.dev/dist/esm/utilities/fileSystem.js
init_esm();
var import_json_stable_stringify = __toESM(require_json_stable_stringify(), 1);
import fsModule from "fs/promises";
import pathModule from "node:path";
async function readJSONFile(path) {
  const fileContents = await fsModule.readFile(path, "utf8");
  return JSON.parse(fileContents);
}
__name(readJSONFile, "readJSONFile");
async function writeJSONFile(path, json, pretty = false) {
  await safeWriteFile(
    path,
    (0, import_json_stable_stringify.default)(json, pretty ? { space: 2 } : void 0) ?? "",
  );
}
__name(writeJSONFile, "writeJSONFile");
async function safeWriteFile(path, contents) {
  await fsModule.mkdir(pathModule.dirname(path), { recursive: true });
  await fsModule.writeFile(path, contents);
}
__name(safeWriteFile, "safeWriteFile");

export { source_default, logger, readJSONFile, writeJSONFile };
//# sourceMappingURL=chunk-7B32APD2.mjs.map
