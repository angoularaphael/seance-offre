const GYMS = {
  minimes: {
    id: 'minimes',
    nom: 'Minimes',
    label: 'Boxing Center Minimes',
    deciplus_label: 'Minimes',
    address: '12 rue de Fenouillet',
    postal_code: '31200',
    city: 'Toulouse',
  },
  'st-cyprien': {
    id: 'st-cyprien',
    nom: 'Saint-Cyprien',
    label: 'Boxing Center St-Cyprien',
    deciplus_label: 'St-Cyprien',
    address: '11 Rue Sainte-Lucie',
    postal_code: '31300',
    city: 'Toulouse',
  },
  ramonville: {
    id: 'ramonville',
    nom: 'Ramonville',
    label: 'Boxing Center Ramonville',
    deciplus_label: 'Ramonville',
    address: '33 rue des Ormes',
    postal_code: '31530',
    city: 'Ramonville',
  },
  'etats-unis': {
    id: 'etats-unis',
    nom: 'États-Unis',
    label: 'Boxing Center États-Unis',
    deciplus_label: 'Minimes',
    address: '388 avenue des États-Unis',
    postal_code: '31200',
    city: 'Toulouse',
  },
  portet: {
    id: 'portet',
    nom: 'Portet',
    label: 'Boxing Center Portet',
    deciplus_label: 'Portet',
    address: '61 route d\'Espagne',
    postal_code: '31120',
    city: 'Portet-sur-Garonne',
  },
};

function normalizeKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function getGym(id) {
  const raw = normalizeKey(id);
  if (!raw) return null;
  if (GYMS[raw]) return GYMS[raw];
  for (const gym of Object.values(GYMS)) {
    if (
      normalizeKey(gym.id) === raw ||
      normalizeKey(gym.label) === raw ||
      normalizeKey(gym.nom) === raw ||
      normalizeKey(gym.deciplus_label) === raw
    ) {
      return gym;
    }
  }
  if (raw.includes('cyprien')) return GYMS['st-cyprien'];
  if (raw.includes('etats')) return GYMS['etats-unis'];
  if (raw.includes('portet')) return GYMS.portet;
  if (raw.includes('ramonville')) return GYMS.ramonville;
  if (raw.includes('minimes')) return GYMS.minimes;
  return null;
}

export function listGyms() {
  return Object.values(GYMS);
}

export { GYMS };
