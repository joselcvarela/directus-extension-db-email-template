import pkg from "../package.json";

export function log(message: string, context?: any) {
  console.log(`[${pkg.name}]`, message, context ?? "");
}
