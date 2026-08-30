// Browser entry for the playground: the same rules the action runs, bundled as
// a global so index.html can call them without a module server.
export { check, isBotLogin, severityOf } from "../src/check.js";
export { TRUSTED } from "../src/trusted.js";
