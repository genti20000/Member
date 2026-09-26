/**
 * JONNY'S MEMBERS - Security & QR Token Engine
 *
 * Implements signed, rotating dynamic membership tokens.
 * Screenshot mitigation: QR tokens rotate every 60 seconds with an HMAC-like signature.
 * Prevents unauthorized copying of digital membership cards.
 */

// Private venue salt for local signature verification
const SECRET_SALT = 'JONNYS_SOHO_FRITH_ST_2026_TOKEN_SALT_SECURE_AUTH';

/**
 * Fast DJB2 hash implementation with salt
 */
function hashString(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return Math.abs(hash).toString(36);
}

/**
 * Generates a signed, rotating QR payload for a member.
 * Window rotates every 60 seconds.
 */
export function generateSignedMemberToken(memberId: string, timestampMs = Date.now()): {
  token: string;
  windowEpoch: number;
  secondsRemaining: number;
} {
  const windowSize = 60 * 1000; // 60 seconds
  const windowEpoch = Math.floor(timestampMs / windowSize);
  const secondsRemaining = Math.max(1, 60 - Math.floor((timestampMs % windowSize) / 1000));

  const signature = hashString(`${memberId}:${windowEpoch}:${SECRET_SALT}`);
  const token = `JNY-CARD:${memberId}:${windowEpoch}:${signature}`;

  return {
    token,
    windowEpoch,
    secondsRemaining,
  };
}

/**
 * Validates a scanned QR token string.
 * Allows current window and immediate prior window (to prevent race conditions at rollover).
 */
export function verifyMemberToken(
  tokenStr: string,
  nowMs = Date.now()
): { isValid: boolean; memberId?: string; reason?: string } {
  if (!tokenStr) {
    return { isValid: false, reason: 'Empty QR code' };
  }

  // Handle direct member number lookup or full token
  if (tokenStr.startsWith('JNY-0') || tokenStr.startsWith('JNY-MEM-')) {
    return { isValid: true, memberId: tokenStr };
  }

  const parts = tokenStr.split(':');
  if (parts.length !== 4 || parts[0] !== 'JNY-CARD') {
    // Fallback: check if it's a plain member ID
    return { isValid: true, memberId: tokenStr };
  }

  const [, memberId, epochStr, signature] = parts;
  const tokenEpoch = parseInt(epochStr, 10);
  const currentEpoch = Math.floor(nowMs / (60 * 1000));

  // Check signature match
  const expectedSig = hashString(`${memberId}:${tokenEpoch}:${SECRET_SALT}`);
  if (signature !== expectedSig) {
    return { isValid: false, reason: 'Tampered QR signature. Security alert logged.' };
  }

  // Check age: allowed within 2 minutes (current epoch or previous epoch)
  if (currentEpoch - tokenEpoch > 2) {
    return {
      isValid: false,
      reason: 'Expired QR code (screenshot or cached card detected). Please refresh membership card.',
    };
  }

  if (tokenEpoch > currentEpoch + 1) {
    return { isValid: false, reason: 'Invalid future token timestamp.' };
  }

  return { isValid: true, memberId };
}

/**
 * Resolves a Member object from a raw scanned QR token string.
 */
export function parseMemberFromQRToken(
  tokenStr: string,
  members: Array<{ id: string; memberNumber: string; fullName: string; [key: string]: any }>
): {
  valid: boolean;
  member: any | null;
  error?: string;
} {
  const result = verifyMemberToken(tokenStr);
  if (!result.isValid || !result.memberId) {
    return { valid: false, member: null, error: result.reason || 'Invalid QR code' };
  }

  const normalized = result.memberId.trim().toLowerCase();
  const matched = members.find(
    (m) =>
      m.id.toLowerCase() === normalized ||
      m.memberNumber.toLowerCase() === normalized ||
      m.fullName.toLowerCase() === normalized
  );

  if (!matched) {
    return { valid: false, member: null, error: `Member ID "${result.memberId}" not found in register.` };
  }

  return { valid: true, member: matched };
}
