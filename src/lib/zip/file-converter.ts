/**
 * File converter factory for universal JSZip compatibility
 *
 * Converts File objects to Uint8Array format that works reliably in both:
 * - Local Node.js/Vite dev environment
 * - Cloudflare Workers runtime (wrangler dev and production)
 *
 * Uses the Web Streams API which is universally supported.
 */

/**
 * Converts a File to Uint8Array for JSZip processing
 *
 * This function uses the Stream API to read file contents, which is more
 * reliable across different JavaScript runtimes than direct arrayBuffer() calls.
 *
 * @param file - The File object to convert
 * @returns Promise resolving to Uint8Array containing file bytes
 */
export async function convertFileForZip(file: File): Promise<Uint8Array> {
  // Use stream API for universal compatibility
  const stream = file.stream();
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];

  try {
    // Read all chunks from the stream
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
      }
    }

    // Concatenate all chunks into a single Uint8Array
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const result = new Uint8Array(totalLength);

    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return result;
  } finally {
    // Ensure reader is released even if an error occurs
    reader.releaseLock();
  }
}
