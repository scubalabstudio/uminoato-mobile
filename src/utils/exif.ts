/** expo-image-picker の exif オブジェクトからカメラのメーカーとモデルを取り出す。
 *  iOS は "{Make}" / "{Model}" 形式、Android は "Make" / "Model" 形式で返すため両方を試みる。 */
export function parseExifCamera(exif: Record<string, unknown> | null | undefined): {
  make: string | null;
  model: string | null;
} {
  if (!exif) return { make: null, model: null };
  const tiff = exif['{TIFF}'] as Record<string, unknown> | null | undefined;
  const make = (exif['{Make}'] ?? exif['Make'] ?? tiff?.['Make']) as string | null | undefined;
  const model = (exif['{Model}'] ?? exif['Model'] ?? tiff?.['Model']) as string | null | undefined;
  return { make: make || null, model: model || null };
}
