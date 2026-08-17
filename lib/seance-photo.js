import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FILES = ['seance-essai-photo.jpg', 'seance-essai-photo.png'];
const HERE = path.dirname(fileURLToPath(import.meta.url));

function publicBaseUrl() {
  const explicit = String(process.env.PUBLIC_URL || process.env.SEANCE_OFFERTE_URL || '').replace(/\/$/, '');
  if (explicit) return explicit;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:5610';
}

function photoFileCandidates() {
  const dirs = [
    path.join(HERE, '..', 'assets'),
    path.join(HERE, '..', 'public'),
    path.join(process.cwd(), 'assets'),
    path.join(process.cwd(), 'public'),
  ];
  const out = [];
  for (const file of FILES) {
    for (const dir of dirs) out.push(path.join(dir, file));
  }
  return out;
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
  const file = seanceEssaiPhotoPath();
  const name = file ? path.basename(file) : FILES[0];
  return `${publicBaseUrl()}/${name}`;
}

function mimeFor(file) {
  return /\.png$/i.test(file) ? 'image/png' : 'image/jpeg';
}

export function seanceEssaiPhotoBase64() {
  const file = seanceEssaiPhotoPath();
  if (!file) return null;
  return `data:${mimeFor(file)};base64,${readFileSync(file).toString('base64')}`;
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
