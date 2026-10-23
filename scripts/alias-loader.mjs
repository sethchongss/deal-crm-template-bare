export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const url = new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url);
    return { url: url.href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
