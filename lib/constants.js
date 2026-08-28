/** Consignes métier séance d'essai offerte (parrainé / ami). */

export const INFO_COMPTA_MENTION = 'SEANCE D ESSAI GRATUITE WEB';

export const PRODUCT_ID = 'seance-essai-offerte';
export const PRODUCT_NAME = 'SEANCE D ESSAI GRATUITE WEB';
export const SOURCE = 'seance-offerte-web';

export const FRIEND_DEFAULT_BIRTHDATE = '2000-01-01';
export const FRIEND_DEFAULT_ADDRESS = {
  address: '10 Avenue du Grand Ramier',
  postal_code: '31400',
  city: 'Toulouse',
  country: 'FR',
};

export const JOURS = {
  lundi: { id: 'lundi', nom: 'Lundi', dow: 1 },
  mardi: { id: 'mardi', nom: 'Mardi', dow: 2 },
  mercredi: { id: 'mercredi', nom: 'Mercredi', dow: 3 },
  jeudi: { id: 'jeudi', nom: 'Jeudi', dow: 4 },
  vendredi: { id: 'vendredi', nom: 'Vendredi', dow: 5 },
  samedi: { id: 'samedi', nom: 'Samedi', dow: 6 },
};

export const SALLE_IDS = ['minimes', 'st-cyprien', 'ramonville', 'etats-unis', 'portet'];

/** WhatsApp salle — essai gratuit web (bot boutique). Minimes et États-Unis = même numéro. */
export const GYM_ESSAI_WHATSAPP = {
  minimes: { telephone: '+33767919166', label: 'Minimes' },
  'etats-unis': { telephone: '+33767919166', label: 'États-Unis' },
  portet: { telephone: '+33687900216', label: 'Portet' },
  'st-cyprien': { telephone: '+33625745369', label: 'Saint-Cyprien' },
  ramonville: { telephone: '+33785907484', label: 'Ramonville' },
};

export const MANAGERS = {
  minimes: { nom: 'MEHDI', telephone: GYM_ESSAI_WHATSAPP.minimes.telephone },
  'st-cyprien': { nom: 'DADI', telephone: GYM_ESSAI_WHATSAPP['st-cyprien'].telephone },
  ramonville: { nom: 'Pascal', telephone: GYM_ESSAI_WHATSAPP.ramonville.telephone },
  'etats-unis': { nom: 'Sébastien', telephone: GYM_ESSAI_WHATSAPP['etats-unis'].telephone },
  portet: { nom: 'Valentin', telephone: GYM_ESSAI_WHATSAPP.portet.telephone },
};

export const OFFRES_URL = 'https://boutique.boxingcenter.fr/offres-speciales';

export const RX_MAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
export const RX_TEL = /^(?:\+33|0)\s*[1-9](?:[\s.\-]*\d{2}){4}$/;
