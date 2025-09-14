const base64Chars = [
  '0','1','2','3','4','5','6','7','8','9',
  'A','B','C','D','E','F','G','H','I','J',
  'K','L','M','N','O','P','Q','R','S','T',
  'U','V','W','X','Y','Z',
  'a','b','c','d','e','f','g','h','i','j',
  'k','l','m','n','o','p','q','r','s','t',
  'u','v','w','x','y','z',
  '_','$'
];

const base64Map = Object.fromEntries(base64Chars.map((c, i) => [c, i]));

/**
 * Convert compressed 22-char IFC GlobalId → 36-char GUID
 */
export function globalIdToGuid(globalId) {
  if (!globalId || globalId.length !== 22) {
    throw new Error('Invalid IFC GlobalId');
  }

  // Decode 22 chars into 16-byte array
  const bytes = new Uint8Array(16);
  let num = 0n;
  for (let i = 0; i < 22; i++) {
    num = (num << 6n) + BigInt(base64Map[globalId[i]]);
  }

  // Convert BigInt to bytes
  for (let i = 15; i >= 0; i--) {
    bytes[i] = Number(num & 0xFFn);
    num >>= 8n;
  }

  // Format into standard GUID: 8-4-4-4-12
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return [
    hex.substring(0, 8),
    hex.substring(8, 12),
    hex.substring(12, 16),
    hex.substring(16, 20),
    hex.substring(20)
  ].join('-');
}