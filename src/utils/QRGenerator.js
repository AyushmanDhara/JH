/**
 * Lightweight QR using the 'qrcode' package.
 * Falls back to text if library fails.
 */
import QRCode from 'qrcode';

export async function generateQR(text, container) {
  if (!container) return;
  container.innerHTML = '';
  try {
    const canvas = document.createElement('canvas');
    await QRCode.toCanvas(canvas, text, {
      width: 140,
      margin: 1,
      color: { dark: '#0a1628', light: '#ffffff' },
    });
    container.appendChild(canvas);
  } catch (e) {
    const div = document.createElement('div');
    div.style.cssText =
      'font-size:10px;word-break:break-all;padding:8px;color:#333;';
    div.textContent = text;
    container.appendChild(div);
  }
}
