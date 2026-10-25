export type GeneratedKhqr = { qr: string; md5: string; qrImage: string };

export function resolveKhqrImageSource(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const source = value.trim();
  if (/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/]+=*$/i.test(source)) return source;
  if (/^https:\/\//i.test(source)) return source;
  return null;
}
