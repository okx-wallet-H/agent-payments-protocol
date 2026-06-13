export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (!shouldTryTypescriptExtension(specifier, error)) throw error;

    for (const extension of [".ts", ".tsx"]) {
      try {
        return await nextResolve(`${specifier}${extension}`, context);
      } catch {
        // Try the next TypeScript extension.
      }
    }

    throw error;
  }
}

function shouldTryTypescriptExtension(specifier, error) {
  if (error?.code !== "ERR_MODULE_NOT_FOUND") return false;
  if (!specifier.startsWith(".") && !specifier.startsWith("/")) return false;
  return !/\.[cm]?[jt]sx?$/.test(specifier);
}
