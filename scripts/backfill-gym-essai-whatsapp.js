/**
 * Rattrapage WhatsApp salle pour les essais gratuits web déjà inscrits.
 * Usage : node scripts/backfill-gym-essai-whatsapp.js [--dry]
 */
import '../lib/load-env.js';
import { backfillGymEssaiWhatsApp } from '../lib/gym-notify.js';

const DRY = process.argv.includes('--dry');

async function main() {
  const results = await backfillGymEssaiWhatsApp({ dryRun: DRY, sleepMs: DRY ? 0 : 1200 });
  const sent = results.filter((r) => r.sent).length;
  const would = results.filter((r) => r.would_send).length;
  const skipped = results.filter((r) => r.skipped || r.already || r.reason === 'already').length;
  const failed = results.filter((r) => r.error).length;
  console.log(
    JSON.stringify(
      {
        dry: DRY,
        total: results.length,
        sent,
        would_send: would,
        skipped,
        failed,
        salles: results.map((r) => ({ id: r.id, salle: r.salle, sent: r.sent, would: r.would_send, reason: r.reason, error: r.error || null })),
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
