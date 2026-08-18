import {
  FRIEND_DEFAULT_ADDRESS,
  FRIEND_DEFAULT_BIRTHDATE,
  INFO_COMPTA_MENTION,
  JOURS,
  PRODUCT_ID,
  PRODUCT_NAME,
  RX_MAIL,
  RX_TEL,
  SALLE_IDS,
  SOURCE,
} from './constants.js';
import { getGym } from './gyms.js';
import { attachSeanceEssaiPhoto } from './seance-photo.js';
import { nextVisitDate, toIsoDate } from './visit-date.js';

const RX_CP = /^\d{5}$/;

function clean(v, max = 120) {
  return String(v || '')
    .trim()
    .slice(0, max);
}

function normalizeEmail(v) {
  const e = clean(v, 180).toLowerCase();
  return RX_MAIL.test(e) ? e : '';
}

/** Email facultatif : vide = OK, mal formé = erreur. */
function parseOptionalEmail(v) {
  const raw = clean(v, 180);
  if (!raw) return { email: '', error: false };
  const email = normalizeEmail(raw);
  return { email, error: !email };
}

function normalizePhone(v) {
  const raw = clean(v, 24);
  if (!RX_TEL.test(raw)) return '';
  return raw.replace(/\s+/g, ' ').trim();
}

function validBirthdate(v, { required = true } = {}) {
  const s = clean(v, 16);
  if (!s) return required ? '' : '';
  const d = new Date(s);
  if (Number.isNaN(+d)) return '';
  const age = (Date.now() - +d) / 31557600000;
  if (age < 3 || age > 100) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function readAddress(raw = {}, prefix = '') {
  const pick = (...keys) => {
    for (const k of keys) {
      const v = raw[k];
      if (v != null && String(v).trim()) return v;
    }
    return '';
  };
  return {
    address: clean(pick(`${prefix}adresse`, `${prefix}address`, 'adresse', 'address'), 180),
    postal_code: clean(pick(`${prefix}code_postal`, `${prefix}postal_code`, `${prefix}cp`, 'code_postal', 'postal_code', 'cp'), 10).replace(/\s+/g, ''),
    city: clean(pick(`${prefix}ville`, `${prefix}city`, 'ville', 'city'), 80),
    country: 'FR',
  };
}

function isCompleteAddress(addr) {
  return Boolean(addr.address && addr.address.length >= 3 && RX_CP.test(addr.postal_code) && addr.city && addr.city.length >= 2);
}

export function applyFriendDefaults(ami = {}) {
  const birthdate = validBirthdate(ami.naissance || ami.birthdate, { required: false });
  const provided = readAddress(ami, 'a_');
  const address = {
    address: provided.address || FRIEND_DEFAULT_ADDRESS.address,
    postal_code: RX_CP.test(provided.postal_code) ? provided.postal_code : FRIEND_DEFAULT_ADDRESS.postal_code,
    city: provided.city || FRIEND_DEFAULT_ADDRESS.city,
    country: 'FR',
  };
  return {
    prenom: clean(ami.prenom || ami.a_prenom || ami.first_name),
    nom: clean(ami.nom || ami.a_nom || ami.last_name),
    email: parseOptionalEmail(ami.email || ami.a_email).email,
    tel: normalizePhone(ami.tel || ami.a_tel || ami.phone),
    sexe: (clean(ami.sexe || ami.a_sexe || ami.gender, 4).toUpperCase() || 'A'),
    naissance: birthdate || FRIEND_DEFAULT_BIRTHDATE,
    birthdate_defaulted: !birthdate,
    address_defaulted: !isCompleteAddress(provided),
    ...address,
  };
}

export function isDryRunRequest({ headers = {}, query = {}, body = {} } = {}) {
  if (process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true') return true;
  const header = String(headers['x-dry-run'] || headers['X-Dry-Run'] || '').trim();
  if (header === '1' || header.toLowerCase() === 'true') return true;
  const q = String(query.test || query.dry_run || '').trim();
  if (q === '1' || q === 'true') return true;
  return body.dry_run === true || body.test === true || body.test === '1';
}

function parseAmi(rawAmi) {
  if (!rawAmi || typeof rawAmi !== 'object') return null;
  const friend = applyFriendDefaults(rawAmi);
  const errors = [];
  if (friend.prenom.length < 2) errors.push('ami.prenom');
  if (friend.nom.length < 2) errors.push('ami.nom');
  if (parseOptionalEmail(rawAmi.email || rawAmi.a_email).error) errors.push('ami.email');
  if (!friend.tel) errors.push('ami.tel');
  if (!['F', 'H', 'A', 'M'].includes(friend.sexe)) errors.push('ami.sexe');
  return { friend, errors };
}

export function validateInscription(body = {}, { amiOptional = true } = {}) {
  const errors = [];
  const gym = getGym(body.salle);
  if (!gym || !SALLE_IDS.includes(gym.id)) errors.push('salle');
  if (!JOURS[String(body.jour || '').toLowerCase()]) errors.push('jour');

  const prenom = clean(body.prenom);
  const nom = clean(body.nom);
  const email = normalizeEmail(body.email);
  const tel = normalizePhone(body.tel || body.telephone || body.phone);
  const naissance = validBirthdate(body.naissance || body.birthdate, { required: true });
  const sexe = clean(body.sexe || body.gender, 4).toUpperCase();
  const address = readAddress(body);

  if (prenom.length < 2) errors.push('prenom');
  if (nom.length < 2) errors.push('nom');
  if (!email) errors.push('email');
  if (!tel) errors.push('tel');
  if (!naissance) errors.push('naissance');
  if (!['F', 'H', 'A', 'M'].includes(sexe)) errors.push('sexe');
  if (address.address.length < 3) errors.push('adresse');
  if (!RX_CP.test(address.postal_code)) errors.push('code_postal');
  if (address.city.length < 2) errors.push('ville');
  if (!body.rgpd && body.rgpd !== true) errors.push('rgpd');

  let ami = null;
  if (body.ami && typeof body.ami === 'object') {
    const parsed = parseAmi(body.ami);
    errors.push(...parsed.errors);
    ami = parsed.friend;
  } else if (!amiOptional) {
    errors.push('ami');
  }

  if (errors.length) return { ok: false, errors };

  const visit = nextVisitDate(body.jour);
  return {
    ok: true,
    errors: [],
    data: {
      prenom,
      nom,
      email,
      tel,
      naissance,
      sexe,
      adresse: address.address,
      code_postal: address.postal_code,
      ville: address.city,
      address,
      salle: gym.id,
      gym,
      jour: String(body.jour).toLowerCase(),
      jour_nom: JOURS[String(body.jour).toLowerCase()].nom,
      visit_date: toIsoDate(visit),
      src: clean(body.src || body.source || 'direct', 40),
      ami,
      rgpd: true,
    },
  };
}

export function validateAmiOnly(rawAmi) {
  const parsed = parseAmi(rawAmi);
  if (!parsed) return { ok: false, errors: ['ami'] };
  if (parsed.errors.length) return { ok: false, errors: parsed.errors };
  return { ok: true, errors: [], friend: parsed.friend };
}

function customerFromPerson(person, address) {
  return {
    first_name: person.prenom,
    last_name: person.nom,
    email: person.email,
    phone: person.tel,
    birthdate: person.naissance,
    gender: person.sexe,
    address: address.address,
    postal_code: address.postal_code,
    city: address.city,
    country: address.country || 'FR',
  };
}

function baseJob({ orderId, person, address, data, isFriend }) {
  return attachSeanceEssaiPhoto({
    order_id: orderId,
    action: 'sale',
    product_id: PRODUCT_ID,
    product_name: PRODUCT_NAME,
    offer: PRODUCT_NAME,
    sale_type: 'none',
    create_sale: false,
    requires_iban: false,
    requires_payment: false,
    gym: data.salle,
    is_friend_referral: Boolean(isFriend),
    info_compta: INFO_COMPTA_MENTION,
    visit_date: data.visit_date,
    visit_weekday: data.jour,
    customer: customerFromPerson(person, address),
    payment: {
      amount: 0,
      status: 'paid',
      method: 'offert',
    },
    utm: {
      source: data.src,
      medium: 'seance-offerte',
      campaign: 'essai-gratuite-web',
    },
    source: SOURCE,
  });
}

export function buildPrincipalJob(data, { orderId } = {}) {
  const id = orderId || `SO-${Date.now()}`;
  return baseJob({
    orderId: id,
    person: data,
    address: data.address,
    data,
    isFriend: false,
  });
}

export function buildFriendJob(data, { orderId } = {}) {
  if (!data.ami) return null;
  const id = orderId || `SO-${Date.now()}`;
  return baseJob({
    orderId: `${id}-ami`,
    person: data.ami,
    address: {
      address: data.ami.address,
      postal_code: data.ami.postal_code,
      city: data.ami.city,
      country: data.ami.country || 'FR',
    },
    data,
    isFriend: true,
  });
}

export function buildDeciplusJobs(data, { orderId } = {}) {
  const id = orderId || `SO-${Date.now()}`;
  const jobs = [buildPrincipalJob(data, { orderId: id })];
  const friend = buildFriendJob(data, { orderId: id });
  if (friend) jobs.push(friend);
  return { orderId: id, jobs };
}

export function jobPublicView(j) {
  return {
    order_id: j.order_id,
    is_friend_referral: j.is_friend_referral,
    birthdate: j.customer.birthdate,
    address: j.customer.address,
    postal_code: j.customer.postal_code,
    city: j.customer.city,
    sale_type: j.sale_type,
    create_sale: j.create_sale,
    info_compta: j.info_compta,
    has_photo: Boolean(j.photo_url || j.photo_base64 || j.photo_path),
    photo_url: j.photo_url || null,
  };
}

export function errorMessage(errors = []) {
  const map = {
    salle: 'Salle non renseignée.',
    jour: 'Jour de venue non renseigné.',
    prenom: 'Prénom invalide.',
    nom: 'Nom invalide.',
    email: 'Email invalide.',
    tel: 'Téléphone invalide.',
    naissance: 'Date de naissance invalide.',
    sexe: 'Sexe non renseigné.',
    adresse: 'Adresse obligatoire pour la fiche Deciplus.',
    code_postal: 'Code postal à 5 chiffres.',
    ville: 'Ville obligatoire pour la fiche Deciplus.',
    rgpd: 'Consentement requis.',
    ami: 'Infos de l’ami(e) incomplètes.',
    'ami.prenom': 'Prénom de l’ami(e) invalide.',
    'ami.nom': 'Nom de l’ami(e) invalide.',
    'ami.email': 'Email de l’ami(e) invalide.',
    'ami.tel': 'Téléphone de l’ami(e) invalide.',
    'ami.sexe': 'Sexe de l’ami(e) non renseigné.',
  };
  return errors.map((e) => map[e] || e).join(' ');
}
