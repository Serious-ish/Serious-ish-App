// Removes metadata, including location, from a JPEG without re-encoding the image
// (FT-007: "location data is removed from every uploaded photo"; Security & Access 5.3).
// The app strips it before upload too (FT-024); this is the server's guarantee, applied
// before a photo is copied into the approved photos bucket.
//
// A JPEG is a list of segments. Location and camera details live in APP1 (Exif, XMP),
// APP13 (Photoshop/IPTC) and comments. Those are dropped. APP0 (JFIF), APP2 (colour profile),
// APP14 (Adobe colour transform) and everything that draws the image are kept as they are.
// Written without Deno or Node APIs so both the Edge Functions and the tests can use it.

const DROPPED_MARKERS = new Set([
  0xe1, // APP1: Exif (GPS, camera, timestamps) and XMP
  // APP3 to APP12: camera maker notes
  0xe3,
  0xe4,
  0xe5,
  0xe6,
  0xe7,
  0xe8,
  0xe9,
  0xea,
  0xeb,
  0xec,
  0xed, // APP13: Photoshop and IPTC (can carry location)
  0xef, // APP15
  0xfe, // COM: free-text comment
]);

export class NotAJpegError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotAJpegError';
  }
}

export function stripJpegMetadata(input: Uint8Array): Uint8Array {
  if (input.length < 4 || input[0] !== 0xff || input[1] !== 0xd8) {
    throw new NotAJpegError('Missing start-of-image marker');
  }

  const kept: Uint8Array[] = [input.subarray(0, 2)];
  let offset = 2;

  while (offset < input.length) {
    if (input[offset] !== 0xff) throw new NotAJpegError(`Expected a marker at byte ${offset}`);
    // Markers may be padded with extra 0xFF bytes.
    let markerAt = offset;
    while (markerAt + 1 < input.length && input[markerAt + 1] === 0xff) markerAt++;
    const marker = input[markerAt + 1];
    if (marker === undefined) throw new NotAJpegError('Truncated marker');

    // Start of scan: the compressed image follows to the end. Keep the rest untouched.
    if (marker === 0xda) {
      kept.push(input.subarray(markerAt));
      return concat(kept);
    }
    // End of image before any scan data.
    if (marker === 0xd9) {
      kept.push(input.subarray(markerAt, markerAt + 2));
      return concat(kept);
    }
    // Markers with no length field.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      kept.push(input.subarray(markerAt, markerAt + 2));
      offset = markerAt + 2;
      continue;
    }

    const length = ((input[markerAt + 2] ?? 0) << 8) | (input[markerAt + 3] ?? 0);
    const end = markerAt + 2 + length;
    if (length < 2 || end > input.length)
      throw new NotAJpegError(`Bad segment length at ${markerAt}`);

    if (!DROPPED_MARKERS.has(marker)) kept.push(input.subarray(markerAt, end));
    offset = end;
  }

  throw new NotAJpegError('No image data found');
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}
