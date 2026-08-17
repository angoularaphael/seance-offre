import { test, expect } from '@playwright/test';

const SALLES = ['Minimes', 'Saint-Cyprien', 'Ramonville', 'États-Unis', 'Portet'];
const isLive = /vercel\.app/i.test(process.env.BASE_URL || '');
const canSubmit = !isLive || process.env.E2E_SUBMIT === '1';

test.describe('page séance offerte', () => {
  test('hero + CTA + formulaire', async ({ page }) => {
    await page.goto('/?nu=1&dir=a');
    await expect(page.locator('body')).toBeVisible();
    await expect(page.getByRole('button', { name: /Je réserve ma séance/i }).first()).toBeVisible();
    await expect(page.locator('#formulaire')).toBeVisible();
  });

  test('photo séance d’essai servie', async ({ request }) => {
    const res = await request.get('/seance-essai-gratuite.png');
    expect(res.ok()).toBeTruthy();
    expect(res.headers()['content-type']).toMatch(/image\/png/);
    expect(Number(res.headers()['content-length'] || 0)).toBeGreaterThan(10000);
  });

  test('tracking ?src=flyer', async ({ page }) => {
    await page.goto('/?src=flyer&nu=1&dir=a');
    const src = await page.evaluate(() => window.dataLayer?.find((e) => e.event === 'bc_page_vue')?.source || null);
    if (src) expect(src).toBe('flyer');
  });

  for (const w of [390, 1280]) {
    test(`viewport ${w}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: w === 390 ? 844 : 800 });
      await page.goto('/?nu=1&dir=a');
      await expect(page.getByRole('button', { name: /Je réserve ma séance/i }).first()).toBeVisible();
    });
  }
});

async function fillPrincipal(page, { salle = 'Minimes', submit = true } = {}) {
  await page.goto('/?nu=1&dir=a&test=1&src=flyer');
  const cta = page.locator('.hero [data-open-form]').first();
  await cta.click();
  await page.locator('#form').waitFor();

  const salleBtn = page.locator('.step.is-on [data-pick="salle"]').filter({ hasText: salle }).first();
  if (await salleBtn.count()) await salleBtn.click();
  else await page.locator('.step.is-on [data-pick="salle"]').first().click();

  await expect(page.locator('.step.is-on [data-pick="jour"]').first()).toBeVisible();
  await page.locator('.step.is-on [data-pick="jour"]').first().click();

  await expect(page.locator('.step.is-on [data-k="prenom"]')).toBeVisible();
  await page.locator('.step.is-on [data-k="prenom"]').fill('Camille');
  await page.locator('.step.is-on [data-k="nom"]').fill('Durand');
  await page.locator('.step.is-on [data-next]').click();

  await expect(page.locator('.step.is-on [data-k="email"]')).toBeVisible();
  await page.locator('.step.is-on [data-k="email"]').fill('camille.e2e@example.com');
  await page.locator('.step.is-on [data-k="tel"]').fill('0612345678');
  await page.locator('.step.is-on [data-next]').click();

  await expect(page.locator('.step.is-on [data-k="naissance"]')).toBeVisible();
  await page.locator('.step.is-on [data-k="naissance"]').fill('1994-05-12');
  await page.locator('.step.is-on [data-k="sexe"]').selectOption('F');
  await page.locator('.step.is-on [data-next]').click();

  await expect(page.locator('.step.is-on [data-k="adresse"]')).toBeVisible();
  await page.locator('.step.is-on [data-k="adresse"]').fill('18 rue des Lilas');
  await page.locator('.step.is-on [data-k="code_postal"]').fill('31000');
  await page.locator('.step.is-on [data-k="ville"]').fill('Toulouse');
  await page.locator('.step.is-on [data-k="rgpd"]').check();
  if (!submit) return;
  await page.locator('.step.is-on [data-next]').click();
  await expect(page.locator('.step.is-on [data-ami]').first()).toBeVisible({ timeout: 15000 });
}

test.describe('tunnel inscription', () => {
  test.skip(!canSubmit, 'pas de soumission réelle contre la prod Vercel');

  test('prospect seul jusqu’au succès', async ({ page }) => {
    await fillPrincipal(page);
    await page.locator('.step.is-on [data-ami="non"]').click();
    await page.locator('.step.is-on [data-next]').click();
    await expect(page.locator('#done-h')).toContainText(/Camille/i);
    await expect(page.locator('#done-recap')).toContainText(/non/i);
    const photo = page.locator('#done-media img');
    await expect(photo).toBeVisible();
    await expect.poll(async () => photo.evaluate((img) => img.naturalWidth)).toBeGreaterThan(100);
  });

  test('prospect + ami sans naissance → défauts côté API', async ({ page }) => {
    const payloads = [];
    await page.route('**/api/inscrire', async (route) => {
      const req = route.request();
      payloads.push(JSON.parse(req.postData() || '{}'));
      await route.continue();
    });
    await fillPrincipal(page, { salle: 'Portet' });
    await page.locator('.step.is-on [data-ami="oui"]').click();
    await page.locator('.step.is-on [data-k="a_prenom"]').fill('Alex');
    await page.locator('.step.is-on [data-k="a_nom"]').fill('Martin');
    await page.locator('.step.is-on [data-k="a_email"]').fill('alex.e2e@example.com');
    await page.locator('.step.is-on [data-k="a_tel"]').fill('0698765432');
    await page.locator('.step.is-on [data-k="a_sexe"]').selectOption('H');
    await page.locator('.step.is-on [data-next]').click();
    await expect(page.locator('#done-h')).toBeVisible({ timeout: 15000 });
    expect(payloads.at(-1)?.ami?.prenom).toBe('Alex');
    expect(payloads.at(-1)?.ami?.naissance || '').toBe('');
    await expect(page.locator('#done-recap')).toContainText(/oui/i);
    await expect(page.locator('#done-recap')).toContainText(/Alex/i);
    const photo = page.locator('#done-media img');
    await expect(photo).toBeVisible();
    await expect(photo).toHaveAttribute('src', /seance-essai-gratuite/);
    await expect.poll(async () => photo.evaluate((img) => img.naturalWidth)).toBeGreaterThan(100);
  });

  test('affiche une erreur si l’API échoue', async ({ page }) => {
    await page.route('**/api/inscrire', async (route) => {
      await route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, error: 'Échec création fiche Deciplus. L’équipe a été prévenue.' }),
      });
    });
    await fillPrincipal(page, { submit: false });
    await page.locator('.step.is-on [data-next]').click();
    await expect(page.locator('#form-api-err')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('#form-api-err')).toContainText(/Deciplus|enregistrer|Échec/i);
  });
});

test.describe('salles', () => {
  test('les 5 salles sont proposées', async ({ page }) => {
    await page.goto('/?nu=1&dir=a');
    for (const nom of SALLES) {
      await expect(page.getByText(nom, { exact: false }).first()).toBeVisible();
    }
  });
});
