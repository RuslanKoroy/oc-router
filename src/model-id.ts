import type { ModelRef } from "./types.js"

export function parseModelID(value: string): ModelRef {
  const slash = value.indexOf("/")
  if (slash <= 0 || slash === value.length - 1) {
    throw new Error(`Expected model ID in provider/model format, got ${JSON.stringify(value)}`)
  }
  return {
    providerID: value.slice(0, slash),
    modelID: value.slice(slash + 1),
  }
}

export function formatModelID(model: ModelRef): string {
  return `${model.providerID}/${model.modelID}`
}

export function isModelID(value: unknown): value is string {
  if (typeof value !== "string") return false
  try {
    parseModelID(value)
    return true
  } catch {
    return false
  }
}
