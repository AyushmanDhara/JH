/**
 * CertificateUI — shows generated certificate + QR.
 */
import { generateQR } from '../utils/QRGenerator.js';

export class CertificateUI {
  constructor({ onClose }) {
    this.onClose = onClose;
    this.root = document.getElementById('certificate-modal');
  }

  async show(cert) {
    document.getElementById('cert-name').textContent = cert.traineeName;
    document.getElementById('cert-module').textContent = cert.moduleName;
    document.getElementById('cert-score').textContent = `${cert.score}%`;
    document.getElementById('cert-duration').textContent = cert.duration;
    document.getElementById('cert-date').textContent = cert.date;
    document.getElementById('cert-id').textContent = cert.id;

    const payload = JSON.stringify({
      id: cert.id,
      name: cert.traineeName,
      module: cert.moduleName,
      score: cert.score,
      date: cert.date,
      verify: `verify.html?id=${cert.id}`,
    });
    await generateQR(payload, document.getElementById('cert-qr'));
    this.root?.classList.add('active');
  }

  hide() {
    this.root?.classList.remove('active');
  }

  bind() {
    document.getElementById('btn-close-cert')?.addEventListener('click', () => {
      if (this.onClose) this.onClose();
    });
    document.getElementById('btn-download-cert')?.addEventListener('click', () => {
      window.print();
    });
  }
}
