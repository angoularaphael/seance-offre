import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FILENAME = 'seance-essai-photo.png';
const HERE = path.dirname(fileURLToPath(import.meta.url));

function publicBaseUrl() {
  const explicit = String(process.env.PUBLIC_URL || process.env.SEANCE_OFFERTE_URL || '').replace(/\/$/, '');
  if (explicit) return explicit;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:5610';
}

function photoFileCandidates() {
  return [
    path.join(HERE, '..', 'assets', FILENAME),
    path.join(HERE, '..', 'public', FILENAME),
    path.join(process.cwd(), 'assets', FILENAME),
    path.join(process.cwd(), 'public', FILENAME),
  ];
}

export function seanceEssaiPhotoPath() {
  return photoFileCandidates().find((p) => existsSync(p)) || null;
}

function isPublicHttpUrl(url) {
  try {
    const u = new URL(url);
    if (!/^https?:$/i.test(u.protocol)) return false;
    return !/^(localhost|127\.0\.0\.1)$/i.test(u.hostname);
  } catch {
    return false;
  }
}

export function seanceEssaiPhotoUrl() {
  return `${publicBaseUrl()}/${FILENAME}`;
}

export function seanceEssaiPhotoBase64() {
  const file = seanceEssaiPhotoPath();
  if (!file) return null;
  return `data:image/png;base64,${readFileSync(file).toString('base64')}`;
}

/** Photo officielle « séance d'essai » collée sur chaque fiche Deciplus. */
export function attachSeanceEssaiPhoto(job = {}) {
  const photo_base64 = seanceEssaiPhotoBase64();
  const url = seanceEssaiPhotoUrl();
  return {
    ...job,
    ...(isPublicHttpUrl(url) ? { photo_url: url } : {}),
    ...(photo_base64 ? { photo_base64 } : {}),
  };
}
