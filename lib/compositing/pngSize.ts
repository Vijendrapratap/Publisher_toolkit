export function readPngSize(buf: Buffer): { width: number; height: number } {
  // PNG IHDR chunk: width/height are 4-byte big-endian ints starting at byte 16.
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
}
