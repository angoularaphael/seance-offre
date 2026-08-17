/* ============================================================
   LE FORMULAIRE EN SIX RESPIRATIONS
   8 champs imposés par Deciplus, jusqu'à 14 avec le binôme.
   Empilés sur un écran : ~7 % de complétion (HubSpot, 40 000 clients).
   Découpés en étapes : 13,85 % contre 4,53 % (Formstack).
   Ordre : ce qui se touche d'abord, ce qui se tape ensuite, ce qui
   coûte le plus en dernier — une fois l'engagement pris.
   ============================================================ */

import { SALLES, JOURS } from "./data.js";
import { SOURCE, track } from "./track.js";
import { thud } from "./audio.js";
import { esc, pic, fr, prefersCalm } from "./ui.js";

/* On garde LES CHOIX, jamais l'identité.
   Salle et jour coûtent du parcours — parcourir les portes, lire l'affiche
   du planning : les reperdre à un rechargement, c'est refaire le chemin.
   Prénom, email, date de naissance et sexe ne sont jamais stockés : ce sont
   des données personnelles, et les retaper coûte trente secondes. La portée
   est la session, donc l'onglet fermé efface tout. */
const MEMO = "bc-essai-choix";

function relire() {
  try {
    const j = JSON.parse(sessionStorage.getItem(MEMO) || "{}");
    return { salle: typeof j.salle === "string" ? j.salle : "",
             jour: typeof j.jour === "string" ? j.jour : "" };
  } catch { return { salle: "", jour: "" }; }
}

export function retenirChoix() {
  try {
    sessionStorage.setItem(MEMO, JSON.stringify({ salle: state.salle, jour: state.jour }));
  } catch { /* mode privé : on continue sans mémoire */ }
}

const repris = relire();

export const state = {
  salle: repris.salle, jour: repris.jour,
  prenom: "", nom: "", email: "", tel: "", naissance: "", sexe: "",
  adresse: "", code_postal: "", ville: "",
  ami: null,        // null = pas répondu · false = seul · objet = à deux
  vientADeux: null, // true = « Oui, à deux » · false = « Non, seul »
  rgpd: false,
  orderId: "",
  step: 0,
  maxStep: 0,
};

export function isADeux() {
  if (state.vientADeux === false || state.ami === false) return false;
  if (state.vientADeux === true) return true;
  return Boolean(state.ami && typeof state.ami === "object");
}

const STEPS = [
  {
    id: "salle", key: "salle", kind: "choix", visuel: true,
    q: "Dans quelle salle veux-tu venir ?",
    why: "Une seule chose à toucher. Tu ne tapes rien pour l'instant.",
    options: () => SALLES.map((s) => ({ v: s.id, b: s.nom, s: s.fait, img: s.img })),
  },
  {
    id: "jour", key: "jour", kind: "choix", wide: true,
    q: "Quel jour comptes-tu passer ?",
    why: "Une indication, pas un créneau à la minute près. Tu choisis le cours sur place avec l'équipe.",
    options: () => JOURS.map((j) => ({ v: j.id, b: j.nom, s: "" })),
  },
  {
    id: "identite", kind: "champs",
    q: "Comment on t'appelle ?",
    fields: [
      { k: "prenom", l: "Prénom", t: "text", ac: "given-name", ph: "Camille" },
      { k: "nom", l: "Nom", t: "text", ac: "family-name", ph: "Durand" },
    ],
  },
  {
    id: "contact", kind: "champs",
    q: "Où on t'envoie la confirmation ?",
    why: "Un email pour ta confirmation. Un numéro au cas où le planning bouge. On n'appelle pas pour vendre.",
    fields: [
      { k: "email", l: "Email", t: "email", ac: "email", ph: "camille@exemple.fr" },
      { k: "tel", l: "Téléphone mobile", t: "tel", ac: "tel", ph: "06 12 34 56 78" },
    ],
  },
  {
    id: "fiche", kind: "champs",
    q: "Date de naissance et sexe, pour ta fiche.",
    why: "Demandés par le club pour <b>créer ta fiche et te couvrir pendant la séance</b>. Rien d'autre n'en est fait.",
    fields: [
      { k: "naissance", l: "Date de naissance", t: "date", ac: "bday" },
      { k: "sexe", l: "Sexe", t: "select", opts: [["F", "Femme"], ["H", "Homme"], ["A", "Ne se prononce pas"]] },
    ],
  },
  {
    id: "adresse", kind: "champs", consent: true, submit: "principal",
    q: "Ton adresse.",
    why: "Obligatoire pour <b>ta fiche Deciplus</b> : rue, code postal et ville. Au clic, on crée ta fiche.",
    fields: [
      { k: "adresse", l: "Adresse", t: "text", ac: "street-address", ph: "12 rue des Lilas", wide: true },
      { k: "code_postal", l: "Code postal", t: "text", ac: "postal-code", ph: "31000" },
      { k: "ville", l: "Ville", t: "text", ac: "address-level2", ph: "Toulouse" },
    ],
  },
  {
    id: "ami", kind: "ami", submit: "ami",
    q: "Tu viens avec quelqu'un ?",
    why: "Ta fiche est en cours de création. Sa séance est offerte aussi — tu peux ajouter quelqu'un maintenant.",
  },
];

const AMI_FIELDS = [
  ["a_prenom", "Son prénom", "text", "Alex", "prenom"],
  ["a_nom", "Son nom", "text", "Martin", "nom"],
  ["a_email", "Son email (si tu le connais)", "email", "alex@exemple.fr", "email_ami"],
  ["a_tel", "Son mobile", "tel", "06 98 76 54 32", "tel"],
  ["a_naissance", "Sa date de naissance (si tu la connais)", "date", "", "naissance_ami"],
  ["a_adresse", "Son adresse (si tu la connais)", "text", "12 rue des Lilas", "adresse_ami"],
  ["a_cp", "Son code postal", "text", "31000", "cp_ami"],
  ["a_ville", "Sa ville", "text", "Toulouse", "ville_ami"],
];

const RX_MAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
const RX_TEL = /^(?:\+33|0)\s*[1-9](?:[\s.\-]*\d{2}){4}$/;

function invalid(rule, val) {
  const v = String(val ?? "").trim();
  switch (rule) {
    case "prenom":
    case "nom":
      return v.length < 2 ? "Il manque au moins deux lettres ici." : "";
    case "email":
      return !v ? "On a besoin de ton email pour envoyer la confirmation."
        : !RX_MAIL.test(v) ? "Cet email n'a pas l'air valide — vérifie le @ et ce qui suit." : "";
    case "email_ami":
      if (!v) return "";
      return RX_MAIL.test(v) ? "" : "Cet email n'a pas l'air valide — tu peux aussi le laisser vide.";
    case "tel":
      return !v ? "Un numéro de mobile, au cas où le planning change."
        : !RX_TEL.test(v) ? "Format attendu : 06 12 34 56 78 ou +33 6 12 34 56 78." : "";
    case "naissance":
    case "naissance_ami": {
      if (!v) return rule === "naissance_ami" ? "" : "Date de naissance requise par le club pour la fiche.";
      const d = new Date(v);
      if (Number.isNaN(+d)) return "Cette date n'est pas lisible.";
      const age = (Date.now() - +d) / 31557600000;
      if (age < 3) return "Vérifie l'année : cette date donne moins de trois ans.";
      if (age > 100) return "Vérifie l'année de naissance.";
      return "";
    }
    case "sexe":
      return v ? "" : "Champ requis par la fiche du club.";
    case "adresse":
      return v.length < 3 ? "L'adresse (rue et numéro) est obligatoire pour ta fiche Deciplus." : "";
    case "code_postal":
      return /^\d{5}$/.test(v.replace(/\s/g, "")) ? "" : "Code postal français à 5 chiffres.";
    case "ville":
      return v.length < 2 ? "Indique ta ville." : "";
    case "adresse_ami":
    case "ville_ami":
      return "";
    case "cp_ami":
      if (!v) return "";
      return /^\d{5}$/.test(v.replace(/\s/g, "")) ? "" : "Code postal à 5 chiffres, ou laisse vide.";
    default:
      return "";
  }
}

/* ---------- rendu ---------- */

function stepBody(st) {
  if (st.kind === "choix") {
    const cur = state[st.key];
    const cls = "opts" + (st.wide ? " opts--days" : "") + (st.visuel ? " opts--visuel" : "");
    return `<div class="${cls}" role="group" aria-label="${esc(st.q)}">${st
      .options()
      .map(
        (o) => `<button type="button" class="opt${o.img ? " opt--img" : ""}" data-pick="${st.key}" data-val="${esc(o.v)}"
          aria-pressed="${cur === o.v}">${
            o.img ? pic(o.img, { sizes: "(min-width:700px) 210px, 44vw" }) : ""
          }<b>${esc(o.b)}</b>${o.s ? `<span>${esc(o.s)}</span>` : ""}</button>`
      )
      .join("")}</div>`;
  }

  if (st.kind === "champs") {
    const fields = `<div class="fields ${st.fields.length > 1 ? "fields--2" : ""}">${st.fields
      .map((f) => {
        const control =
          f.t === "select"
            ? `<select data-k="${f.k}" autocomplete="sex">
                 <option value="">Choisir…</option>
                 ${f.opts.map(([v, l]) => `<option value="${v}"${state[f.k] === v ? " selected" : ""}>${esc(l)}</option>`).join("")}
               </select>`
            : `<input type="${f.t}" data-k="${f.k}" value="${esc(state[f.k])}"
                 ${f.ac ? `autocomplete="${f.ac}"` : ""} ${f.ph ? `placeholder="${esc(f.ph)}"` : ""} />`;
        return `<label class="field${f.wide ? " field--wide" : ""}" data-f="${f.k}"><span>${esc(f.l)}</span>${control}<em class="field__err" role="alert"></em></label>`;
      })
      .join("")}</div>`;
    const consent = st.consent
      ? `<label class="consent" data-f="rgpd">
      <input type="checkbox" data-k="rgpd"${state.rgpd ? " checked" : ""} />
      <span>J'accepte que Boxing Center utilise ces informations pour ma séance d'essai et me recontacte à ce sujet. Je peux demander leur suppression à tout moment.</span>
      <em class="field__err" role="alert"></em>
    </label>`
      : "";
    return fields + consent;
  }

  const aDeux = isADeux();
  return `
    <div class="opts opts--ami" role="group" aria-label="Venir accompagné" data-f="ami-choix">
      <button type="button" class="opt" data-ami="oui" aria-pressed="${aDeux}"><b>Oui, à deux</b><span>Sa séance est offerte</span></button>
      <button type="button" class="opt" data-ami="non" aria-pressed="${state.vientADeux === false || state.ami === false}"><b>Non, seul</b><span>Ça marche aussi</span></button>
      <em class="field__err" role="alert"></em>
    </div>
    <div class="fields fields--2" id="ami-fields"${aDeux ? "" : " hidden"}>
      <p class="step__why" style="grid-column:1/-1">Ses infos pour sa propre fiche. Adresse, code postal, ville et date de naissance : seulement si tu les as, sinon on mettra les valeurs par défaut.</p>
      ${AMI_FIELDS.map(
        ([k, l, t, ph]) =>
          `<label class="field${k === "a_adresse" ? " field--wide" : ""}" data-f="${k}"><span>${esc(l)}</span><input type="${t}" data-k="${k}" ${ph ? `placeholder="${esc(ph)}"` : ""} value="${esc((state.ami && state.ami[k]) || "")}" /><em class="field__err" role="alert"></em></label>`
      ).join("")}
      <label class="field" data-f="a_sexe"><span>Son sexe</span>
        <select data-k="a_sexe"><option value="">Choisir…</option>
          ${[["F", "Femme"], ["H", "Homme"], ["A", "Ne se prononce pas"]]
            .map(([v, l]) => `<option value="${v}"${state.ami && state.ami.a_sexe === v ? " selected" : ""}>${l}</option>`)
            .join("")}
        </select><em class="field__err" role="alert"></em></label>
      <p class="step__why" style="grid-column:1/-1">Sa salle et son jour reprennent les tiens. Vous pourrez les changer avec l'équipe sur place.</p>
    </div>`;
}

export function formHTML() {
  return `
  <div class="form" id="formulaire">
    <div class="form__head">
      <span class="form__count" id="form-count">Étape 1 sur ${STEPS.length}</span>
      <span class="form__pips" id="form-pips" aria-hidden="true">${STEPS.map(() => "<i></i>").join("")}</span>
    </div>
    <p class="field__err form__api-err" id="form-api-err" hidden role="alert"></p>
    <form id="form" novalidate>
      ${STEPS.map(
        (st, i) => `
        <section class="step${i === 0 ? " is-on" : ""}" data-step="${i}" aria-labelledby="q-${i}">
          <h3 class="step__q" id="q-${i}">${esc(st.q)}</h3>
          ${st.why ? `<p class="step__why">${fr(st.why)}</p>` : ""}
          ${stepBody(st)}
          <div class="step__nav">
            ${i > 0 ? `<button type="button" class="back" data-back>← Retour</button>` : ""}
            <button type="button" class="btn btn--primary" data-next>
              ${st.id === "ami" ? "Je valide ma séance" : st.id === "adresse" ? "J'enregistre ma fiche" : "Continuer"}
              <span class="btn__arrow" aria-hidden="true"></span>
            </button>
          </div>
        </section>`
      ).join("")}

      <section class="done" data-step="${STEPS.length}" hidden aria-live="polite" aria-label="Confirmation de ta séance">
        <div class="done__media" id="done-media">
          <img src="/seance-essai-gratuite.png" width="1200" height="630" alt="Séance d'essai gratuite Boxing Center" decoding="async" />
        </div>
        <div class="done__body">
          <p class="eyebrow">C'est enregistré</p>
          <h3 id="done-h"></h3>
          <p id="done-p"></p>
          <dl class="done__recap" id="done-recap"></dl>
          <div class="done__kit">
            <p class="done__kit-t">Ce que tu apportes</p>
            <ul>
              <li>Une tenue de sport</li>
              <li>Une bouteille d'eau</li>
              <li>Rien d'autre — le matériel est prêté</li>
            </ul>
          </div>
          <p class="step__why">${fr("Un email de confirmation part vers ta boîte. Présente-toi à l'accueil : la séance est offerte, habituellement à 10 €.")}</p>
        </div>
      </section>
    </form>
  </div>`;
}

/* ---------- comportement ---------- */

export function mountForm(root, onChange) {
  const form = root.querySelector("#form");
  if (!form) return;

  const count = root.querySelector("#form-count");
  const pips = [...root.querySelectorAll("#form-pips i")];
  const screens = [...form.querySelectorAll("[data-step]")];
  let started = false;

  const paint = () => {
    screens.forEach((s) => {
      const i = Number(s.dataset.step);
      if (i === STEPS.length) s.hidden = state.step !== i;
      else s.classList.toggle("is-on", i === state.step);
    });
    pips.forEach((p, i) => {
      p.classList.toggle("is-on", i === state.step);
      p.classList.toggle("is-done", i < state.step);
    });
    count.textContent =
      state.step >= STEPS.length ? "Séance réservée" : `Étape ${state.step + 1} sur ${STEPS.length}`;
    const aDeux = isADeux();
    const ouiBtn = form.querySelector('[data-ami="oui"]');
    const nonBtn = form.querySelector('[data-ami="non"]');
    if (ouiBtn) ouiBtn.setAttribute("aria-pressed", String(aDeux));
    if (nonBtn) nonBtn.setAttribute("aria-pressed", String(state.vientADeux === false || state.ami === false));
    const box = form.querySelector("#ami-fields");
    if (box) box.hidden = !aDeux;
    onChange && onChange(state);
  };

  const begin = () => {
    if (started) return;
    started = true;
    track("formulaire_commence"); // §18.1 — mesurable seulement grâce aux étapes
  };

  const showErr = (k, msg) => {
    const f = form.querySelector(`[data-f="${k}"]`);
    if (!f) return;
    f.classList.toggle("is-bad", !!msg);
    const e = f.querySelector(".field__err");
    if (e) e.textContent = msg || "";
  };

  const validate = () => {
    const st = STEPS[state.step];
    if (!st) return true;

    if (st.kind === "choix") {
      if (state[st.key]) return true;
      const g = form.querySelector(`.step[data-step="${state.step}"] .opts`);
      g && g.animate?.(
        [{ transform: "translateX(-6px)" }, { transform: "translateX(6px)" }, { transform: "none" }],
        { duration: 240 }
      );
      return false;
    }

    if (st.kind === "champs") {
      let ok = true;
      st.fields.forEach((f) => {
        const msg = invalid(f.k, state[f.k]);
        showErr(f.k, msg);
        if (msg) ok = false;
      });
      if (st.consent) {
        const rgpdMsg = state.rgpd ? "" : "Coche cette case pour qu'on puisse enregistrer ton inscription.";
        showErr("rgpd", rgpdMsg);
        if (rgpdMsg) ok = false;
      }
      return ok;
    }

    // étape binôme
    syncAmiFromDom(form);
    let ok = true;
    if (state.vientADeux === null && state.ami === null) {
      showErr("ami-choix", "Dis-nous si tu viens avec quelqu'un — oui ou non.");
      return false;
    }
    showErr("ami-choix", "");
    if (!isADeux()) return ok;
    if (typeof state.ami !== "object" || !state.ami) state.ami = {};

    AMI_FIELDS.forEach(([k, , , , rule]) => {
      const msg = invalid(rule, state.ami[k]);
      showErr(k, msg);
      if (msg) ok = false;
    });
    const sx = invalid("sexe", state.ami.a_sexe);
    showErr("a_sexe", sx);
    if (sx) ok = false;
    return ok;
  };

  const finish = () => {
    syncAmiFromDom(form);
    const salle = SALLES.find((s) => s.id === state.salle);
    const jour = JOURS.find((j) => j.id === state.jour);
    const prenom = (state.prenom || "").trim();

    const pressedOui = form.querySelector('[data-ami="oui"]')?.getAttribute("aria-pressed") === "true";
    const aDeux = isADeux() || pressedOui;
    const amiPrenom = aDeux ? String((state.ami && state.ami.a_prenom) || "").trim() : "";
    const amiNom = aDeux ? [amiPrenom, String((state.ami && state.ami.a_nom) || "").trim()].filter(Boolean).join(" ") : "";

    root.querySelector("#done-h").textContent = jour
      ? (amiPrenom
          ? `À ${jour.nom.toLowerCase()}, ${prenom} et ${amiPrenom}.`
          : `À ${jour.nom.toLowerCase()}, ${prenom}.`)
      : (amiPrenom ? `À très vite, ${prenom} et ${amiPrenom}.` : `À très vite, ${prenom}.`);

    root.querySelector("#done-p").textContent = aDeux
      ? `${prenom}, ta séance d'essai est enregistrée${salle ? ` à Boxing Center ${salle.nom}` : ""}${amiPrenom ? `, avec ${amiPrenom}` : ", avec un(e) ami(e)"}. Présentez-vous à l'accueil en tenue de sport : le matériel est prêté.${amiPrenom ? ` La séance de ${amiPrenom} est offerte aussi.` : " Sa séance est offerte aussi."}`
      : `Ta séance d'essai est enregistrée${salle ? ` à Boxing Center ${salle.nom}` : ""}. Présente-toi à l'accueil en tenue de sport : le matériel est prêté.`;

    root.querySelector("#done-recap").innerHTML = [
      ["Salle", esc(salle ? salle.nom : "—")],
      ["Jour prévu", esc(jour ? jour.nom : "—")],
      ["À régler sur place", "<b>0 €</b> — au lieu de 10 €"],
      ["Accompagné", aDeux ? (amiNom ? `oui — ${esc(prenom)} et ${esc(amiNom)}` : "oui — à deux") : "non"],
    ]
      .map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`)
      .join("");

    track("formulaire_valide", { salle: state.salle, jour: state.jour, ami: aDeux });
  };

  const payloadFromState = (phase) => {
    syncAmiFromDom(form);
    const ami =
      isADeux() && state.ami && typeof state.ami === "object"
        ? {
            prenom: state.ami.a_prenom || "",
            nom: state.ami.a_nom || "",
            email: state.ami.a_email || "",
            tel: state.ami.a_tel || "",
            naissance: state.ami.a_naissance || "",
            sexe: state.ami.a_sexe || "",
            address: state.ami.a_adresse || "",
            postal_code: state.ami.a_cp || "",
            city: state.ami.a_ville || "",
          }
        : null;
    const q = new URLSearchParams(location.search);
    const dry = q.get("test") === "1" || q.get("dry_run") === "1";
    if (phase === "ami") {
      return { order_id: state.orderId, phase: "ami", ami, dry_run: dry };
    }
    return {
      prenom: state.prenom,
      nom: state.nom,
      email: state.email,
      tel: state.tel,
      naissance: state.naissance,
      sexe: state.sexe,
      adresse: state.adresse,
      code_postal: state.code_postal,
      ville: state.ville,
      salle: state.salle,
      jour: state.jour,
      src: SOURCE,
      rgpd: state.rgpd,
      dry_run: dry,
    };
  };

  const showApiErr = (msg) => {
    const el = root.querySelector("#form-api-err");
    if (!el) return;
    el.hidden = !msg;
    el.textContent = msg || "";
  };

  const submitInscription = async (phase) => {
    const res = await fetch("/api/inscrire", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payloadFromState(phase)),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      throw new Error(data.error || "Impossible d'enregistrer l'inscription. Réessaie dans un instant.");
    }
    return data;
  };

  form.addEventListener("click", (e) => {
    const pick = e.target.closest("[data-pick]");
    if (pick) {
      begin();
      state[pick.dataset.pick] = pick.dataset.val;
      retenirChoix();
      pick.parentElement.querySelectorAll(".opt").forEach((b) => b.setAttribute("aria-pressed", String(b === pick)));
      thud();
      onChange && onChange(state);
      // une décision par écran : on avance tout seul
      setTimeout(() => form.querySelector(`.step[data-step="${state.step}"] [data-next]`)?.click(), 200);
      return;
    }

    const ami = e.target.closest("[data-ami]");
    if (ami) {
      begin();
      const oui = ami.dataset.ami === "oui";
      state.vientADeux = oui;
      state.ami = oui ? (typeof state.ami === "object" && state.ami) || {} : false;
      ami.parentElement.querySelectorAll(".opt").forEach((b) => b.setAttribute("aria-pressed", String(b === ami)));
      const box = form.querySelector("#ami-fields");
      if (box) {
        box.hidden = !oui;
        if (oui) {
          box.scrollIntoView({ block: "center", behavior: prefersCalm() ? "auto" : "smooth" });
          const first = box.querySelector("input, select");
          if (first) setTimeout(() => first.focus({ preventScroll: true }), prefersCalm() ? 0 : 280);
        }
      }
      showErr("ami-choix", "");
      if (!oui) AMI_FIELDS.forEach(([k]) => showErr(k, ""));
      thud();
      track(oui ? "ami_ajoute" : "ami_refuse");
      onChange && onChange(state);
      return;
    }

    if (e.target.closest("[data-back]")) {
      state.step = Math.max(0, state.step - 1);
      paint();
      return;
    }

    if (e.target.closest("[data-next]")) {
      begin();
      const st = STEPS[state.step];
      if (!validate()) {
        /* On emmène le visiteur sur la faute. Sans ça, cliquer « Continuer »
           ne produit rien de visible quand le champ en défaut est plus haut
           que l'écran — on croit que le bouton est cassé. */
        const fautif = form.querySelector(".step.is-on .field.is-bad, .step.is-on .consent.is-bad, .step.is-on .opts.is-bad");
        if (fautif) {
          const champ = fautif.querySelector("input, select");
          fautif.scrollIntoView({ block: "center", behavior: prefersCalm() ? "auto" : "smooth" });
          if (champ) setTimeout(() => champ.focus({ preventScroll: true }), prefersCalm() ? 0 : 320);
        }
        track("etape_bloquee", { etape: state.step + 1 });
        return;
      }
      if (st.submit === "principal" || st.submit === "ami") {
        const btn = e.target.closest("[data-next]");
        if (btn?.dataset.busy === "1") return;
        if (st.submit === "principal" && state.orderId) {
          state.step += 1;
          state.maxStep = Math.max(state.maxStep, state.step);
          track("etape_atteinte", { etape: state.step + 1 });
          paint();
          return;
        }
        const original = btn ? btn.innerHTML : "";
        if (btn) {
          btn.dataset.busy = "1";
          btn.disabled = true;
          btn.textContent = "Enregistrement…";
        }
        showApiErr("");
        const work =
          st.submit === "principal"
            ? submitInscription("principal").then((data) => {
                state.orderId = data.order_id || state.orderId;
                if (btn) {
                  btn.disabled = false;
                  btn.innerHTML = original;
                  delete btn.dataset.busy;
                }
                state.step += 1;
                state.maxStep = Math.max(state.maxStep, state.step);
                track("etape_atteinte", { etape: state.step + 1, fiche: "principal" });
                paint();
              })
            : (isADeux()
                ? submitInscription("ami").then((data) => {
                    state.vientADeux = true;
                    return data;
                  })
                : Promise.resolve(null)
              ).then(() => {
                state.step = STEPS.length;
                paint();
                finish();
              });
        work.catch((err) => {
          showApiErr(err.message || "Échec de l'enregistrement.");
          track("etape_bloquee", { etape: state.step + 1, erreur: "api" });
          if (btn) {
            btn.disabled = false;
            btn.innerHTML = original;
            delete btn.dataset.busy;
          }
        });
        return;
      }
      state.step += 1;
      state.maxStep = Math.max(state.maxStep, state.step);
      track("etape_atteinte", { etape: state.step + 1 });
      paint();
    }
  });

  form.addEventListener("input", onField);
  form.addEventListener("change", onField);

  function onField(e) {
    const k = e.target.dataset && e.target.dataset.k;
    if (!k) return;
    begin();
    const val = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    if (k.startsWith("a_")) {
      if (state.vientADeux === false) return;
      state.vientADeux = true;
      if (typeof state.ami !== "object" || !state.ami) state.ami = {};
      state.ami[k] = val;
    } else {
      state[k] = val;
    }
    showErr(k, "");
    onChange && onChange(state);
  }

  function syncAmiFromDom(formEl) {
    if (!state.ami || typeof state.ami !== "object") return;
    formEl.querySelectorAll("#ami-fields [data-k]").forEach((el) => {
      const k = el.dataset.k;
      if (!k) return;
      state.ami[k] = el.type === "checkbox" ? el.checked : el.value;
    });
  }

  // Abandon d'étape — la donnée que le §18.1 réclame
  window.addEventListener("pagehide", () => {
    if (started && state.step < STEPS.length) track("etape_abandonnee", { etape: state.step + 1 });
  });

  repeindre = paint;
  paint();
}

/** Fait avancer le formulaire si la salle a déjà été choisie plus haut dans la page. */
/* Place le formulaire à la première question sans réponse.
   On ne simule PLUS un clic sur « Continuer » : ce clic déclenchait
   `formulaire_commence`, et au retour d'un visiteur dont les choix sont
   repris, la page comptait un formulaire entamé qu'il n'avait pas touché.
   On pose l'étape et on redessine. */
export function skipKnownSteps() {
  let n = 0;
  if (state.salle) n = 1;
  if (state.salle && state.jour) n = 2;
  if (n > state.step) {
    state.step = n;
    state.maxStep = Math.max(state.maxStep, n);
    repeindre && repeindre();
  }
}

/* Le rendu du formulaire, exposé pour que `skipKnownSteps` puisse
   rafraîchir sans passer par un faux clic. */
let repeindre = null;

export const STEP_COUNT = STEPS.length;
