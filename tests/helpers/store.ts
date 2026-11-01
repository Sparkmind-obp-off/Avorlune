import type { ObjectStore } from '../../server/env'

/** In-memory R2 stand-in for tests (never used in deployed code). */
export function createMemoryStore() {
  const objects = new Map<string, { bytes: Uint8Array; contentType?: string }>()
  const store: ObjectStore = {
    async put(key, value, options) {
      objects.set(key, { bytes: value instanceof Uint8Array ? value : new Uint8Array(value), contentType: options?.httpMetadata?.contentType })
      return {}
    },
    async get(key) {
      const o = objects.get(key)
      if (!o) return null
      return { body: new Blob([o.bytes]).stream(), size: o.bytes.byteLength, httpMetadata: { contentType: o.contentType } }
    },
    async head(key) {
      const o = objects.get(key)
      return o ? { size: o.bytes.byteLength } : null
    },
    async delete(key) {
      objects.delete(key)
    },
  }
  return { store, objects }
}

export const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 73, 72, 68, 82, 1, 2, 3, 4])
export const MP4 = new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0, 0, 2, 0, 9, 9, 9, 9])
export const EXE = new Uint8Array([0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0, 4, 0, 0, 0, 0xff, 0xff])
