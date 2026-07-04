const BASE64_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Encodes bytes to base64 without relying on browser-only APIs.
 * Figma's plugin sandbox does not provide `btoa`.
 */
export function bytesToBase64(bytes: Uint8Array): string {
  let output = '';

  for (let index = 0; index < bytes.length; index += 3) {
    const byte1 = bytes[index] ?? 0;
    const byte2 = bytes[index + 1] ?? 0;
    const byte3 = bytes[index + 2] ?? 0;

    output += BASE64_ALPHABET[byte1 >> 2];
    output += BASE64_ALPHABET[((byte1 & 0x03) << 4) | (byte2 >> 4)];
    output +=
      index + 1 < bytes.length ? BASE64_ALPHABET[((byte2 & 0x0f) << 2) | (byte3 >> 6)] : '=';
    output += index + 2 < bytes.length ? BASE64_ALPHABET[byte3 & 0x3f] : '=';
  }

  return output;
}

export function detectImageExtension(bytes: Uint8Array): 'png' | 'jpg' | 'gif' | 'webp' {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'png';
  }

  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpg';
  }

  if (
    bytes.length >= 4 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38
  ) {
    return 'gif';
  }

  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'webp';
  }

  return 'png';
}

export function mimeTypeForImageExtension(extension: string): string {
  switch (extension) {
    case 'jpg':
      return 'image/jpeg';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    default:
      return 'image/png';
  }
}
