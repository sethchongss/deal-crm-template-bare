import { register } from "node:module";

register("./alias-loader.mjs", { parentURL: import.meta.url });
