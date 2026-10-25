import { describe, expect, it } from 'vitest';
import { resolveKhqrImageSource } from './paymentQr';

describe('generated KHQR image validation', () => {
  it('accepts supported base64 QR images and secure image URLs', () => {
    expect(resolveKhqrImageSource('data:image/png;base64,aGVsbG8=')).toBe('data:image/png;base64,aGVsbG8=');
    expect(resolveKhqrImageSource('https://payments.example.com/qr.png')).toBe('https://payments.example.com/qr.png');
  });

  it('rejects unsafe or malformed image sources', () => {
    expect(resolveKhqrImageSource('javascript:alert(1)')).toBeNull();
    expect(resolveKhqrImageSource('http://payments.example.com/qr.png')).toBeNull();
    expect(resolveKhqrImageSource('data:image/svg+xml;base64,PHN2Zz4=')).toBeNull();
    expect(resolveKhqrImageSource(null)).toBeNull();
  });
});
