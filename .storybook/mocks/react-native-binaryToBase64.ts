/**
 * Mock for react-native-web/Libraries/Utilities/binaryToBase64.
 * @react-native-firebase/app imports this internally.
 */
export default function binaryToBase64(data: ArrayBuffer | Uint8Array | ArrayBufferView): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(data as ArrayBuffer).toString('base64');
  }
  // Fallback: browser btoa
  const bytes = new Uint8Array(data as ArrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
