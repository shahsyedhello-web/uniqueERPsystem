/**
 * EAN-13 Barcode Generator & Validator
 * Calculates checksum digit mathematically per GS1 specifications.
 */

export function calculateEAN13CheckDigit(first12Digits: string): number {
  if (first12Digits.length !== 12 || !/^\d{12}$/.test(first12Digits)) {
    throw new Error('EAN-13 base must be exactly 12 numeric digits');
  }

  let oddSum = 0;
  let evenSum = 0;

  for (let i = 0; i < 12; i++) {
    const digit = parseInt(first12Digits[i], 10);
    if (i % 2 === 0) {
      oddSum += digit; // 1st, 3rd, 5th, 7th, 9th, 11th positions (0-indexed 0,2,4,6,8,10)
    } else {
      evenSum += digit; // 2nd, 4th, 6th, 8th, 10th, 12th positions (0-indexed 1,3,5,7,9,11)
    }
  }

  const total = oddSum + evenSum * 3;
  const checksum = (10 - (total % 10)) % 10;
  return checksum;
}

export function generateEAN13Barcode(): string {
  // Country / Internal prefix '200' + 9 random digits
  const prefix = '200';
  const random9 = Math.floor(100000000 + Math.random() * 900000000).toString();
  const base12 = prefix + random9;
  const checkDigit = calculateEAN13CheckDigit(base12);
  return `${base12}${checkDigit}`;
}

export function generateSKU(prefix: string = 'SKU'): string {
  const randomNum = Math.floor(100000 + Math.random() * 900000);
  return `${prefix.toUpperCase().trim()}-${randomNum}`;
}

export function isValidEAN13(barcode: string): boolean {
  if (!/^\d{13}$/.test(barcode)) return false;
  const base12 = barcode.slice(0, 12);
  const actualCheck = parseInt(barcode[12], 10);
  return calculateEAN13CheckDigit(base12) === actualCheck;
}

/**
 * Audio Synthesizer for Barcode Scanning
 * Uses Web Audio API without requiring external sound files.
 */
export function playBarcodeBeep(type: 'success' | 'error' = 'success'): void {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();

    if (type === 'success') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1046.5, ctx.currentTime); // C6 tone
      osc.frequency.exponentialRampToValueAtTime(1318.51, ctx.currentTime + 0.08); // E6 tone

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.12);
    } else {
      // Error dual tone
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();

      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(280, ctx.currentTime);
      gain1.gain.setValueAtTime(0.25, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);

      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.2);
    }
  } catch (e) {
    console.warn('Audio play error:', e);
  }
}
