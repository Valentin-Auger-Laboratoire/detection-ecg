// Tests du moteur de détection ECG : node tests/test.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const E = require('../ecg.js');
const FS = 360;
let n = 0;
const close = (a, b, tol, msg) => { n++; assert.ok(Math.abs(a - b) <= tol * (1 + Math.abs(b)), (msg || '') + ' : ' + a + ' ≠ ' + b); };
const ok = (c, msg) => { n++; assert.ok(c, msg); };
const loadBin = (f) => { const b = fs.readFileSync(path.join(__dirname, '..', 'data', f)), x = new Float64Array(b.length / 2); for (let i = 0; i < x.length; i++) x[i] = b.readInt16LE(i * 2) / 200; return x; };

// 1. Filtres de Butterworth : gain à la fréquence de coupure = 1/√2, gain nul ou unité loin de la coupure
{
  const lp = E.butter2('low', 15, FS), hp = E.butter2('high', 5, FS);
  close(E.biquadGain(lp, 15, FS), Math.SQRT1_2, 1e-12, 'passe-bas : −3 dB à fc');
  close(E.biquadGain(hp, 5, FS), Math.SQRT1_2, 1e-12, 'passe-haut : −3 dB à fc');
  close(E.biquadGain(lp, 0.01, FS), 1, 1e-6, 'passe-bas : gain 1 en continu');
  ok(E.biquadGain(lp, 50, FS) < 0.1, 'passe-bas : 50 Hz atténué');
  ok(E.biquadGain(hp, 0.3, FS) < 0.01, 'passe-haut : ligne de base atténuée');
  // filtrage aller-retour : sinusoïde dans la bande conservée, sans déphasage
  const x = Float64Array.from({ length: 3600 }, (_, i) => Math.sin(2 * Math.PI * 10 * (i / FS)));
  const y = E.bandpass(x, FS, 5, 15);
  let num = 0, den = 0; for (let i = 600; i < 3000; i++) { num += x[i] * y[i]; den += x[i] * x[i]; }
  // gain attendu : |H_passe-haut(10 Hz)|² · |H_passe-bas(10 Hz)|² (filtrage aller-retour), sans déphasage
  const want = (E.biquadGain(E.butter2('high', 5, FS), 10, FS) * E.biquadGain(E.butter2('low', 15, FS), 10, FS)) ** 2;
  close(num / den, want, 0.01, 'sinusoïde de 10 Hz : gain théorique et phase nulle');
}

// 2. Enregistrement MIT-BIH 100 : comparaison aux annotations des cardiologues
{
  const x = loadBin('mitdb100.bin'), ann = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'mitdb100-ann.json')));
  n++; assert.strictEqual(x.length, 650000, '30 min à 360 Hz');
  n++; assert.strictEqual(ann.beats.length, 2273, '2 273 battements annotés');
  const counts = {}; ann.beats.forEach((b) => (counts[b[1]] = (counts[b[1]] || 0) + 1));
  n++; assert.deepStrictEqual(counts, { N: 2239, A: 33, V: 1 }, 'types de battements de la base');
  const pt = E.panTompkins(x, FS), ref = ann.beats.map((b) => b[0]);
  const ev = E.evaluate(pt.R, ref, FS);
  ok(ev.se >= 0.998, 'sensibilité ≥ 99,8 % : ' + ev.se);
  ok(ev.ppv >= 0.998, 'valeur prédictive positive ≥ 99,8 % : ' + ev.ppv);
  ok(ev.meanAbsErrMs < 10, 'pic R à moins de 10 ms de l’annotation en moyenne : ' + ev.meanAbsErrMs.toFixed(1) + ' ms');
  // classification : les extrasystoles auriculaires (A) sont vues comme précoces (S), la ventriculaire comme V
  const cls = E.classify(x, FS, pt.R), det = new Map(pt.R.map((r, k) => [r, cls.beats[k].label]));
  const lab = new Map(ann.beats);
  let aOk = 0, nOk = 0, vOk = 0, nTot = 0;
  ev.pairs.forEach(([r, d]) => { const a = lab.get(r), b = det.get(d); if (a === 'A' && b === 'S') aOk++; if (a === 'N') { nTot++; if (b === 'N') nOk++; } if (a === 'V' && b === 'V') vOk++; });
  ok(aOk >= 30, 'extrasystoles auriculaires reconnues : ' + aOk + ' / 33');
  ok(nOk / nTot > 0.99, 'battements normaux classés N : ' + nOk + ' / ' + nTot);
  ok(vOk === 1, 'extrasystole ventriculaire reconnue');
  // variabilité cohérente avec un rythme sinusal (fréquence 70 à 80 bpm)
  const h = E.hrv(pt.R, FS, cls.beats.map((b) => b.label));
  ok(h.hr > 70 && h.hr < 80, 'fréquence moyenne ' + h.hr.toFixed(1));
  ok(h.sdnn > 10 && h.sdnn < 100 && h.rmssd > 10 && h.rmssd < 100, 'SDNN et RMSSD plausibles');
}

// 3. Extrait du 208 : de nombreuses extrasystoles ventriculaires repérées
{
  const x = loadBin('mitdb208-extrait.bin'), pt = E.panTompkins(x, FS), cls = E.classify(x, FS, pt.R);
  const nv = cls.beats.filter((b) => b.label === 'V').length;
  ok(pt.R.length > 400 && pt.R.length < 600, 'battements dans 5 min : ' + pt.R.length);
  ok(nv > 50, 'extrasystoles ventriculaires repérées : ' + nv);
}

// 4. ECG synthétiques : vérité connue, différents bruits et fréquences
for (const [hr, noise, wander, hum] of [[50, 0, 0, 0], [72, 0.05, 0.3, 0.05], [100, 0.1, 0.5, 0.1], [140, 0.05, 0.2, 0.2], [75, 0.2, 0.5, 0.1]]) {
  const s = E.synth({ dur: 90, hr, noise, wander, hum, pvcRate: 0.05, seed: hr });
  const pt = E.panTompkins(s.x, FS), ev = E.evaluate(pt.R, s.truth.map((b) => b[0]), FS);
  ok(ev.se > 0.99 && ev.ppv > 0.99, 'synthétique ' + hr + ' bpm, bruit ' + noise + ' : Se ' + ev.se.toFixed(3) + ', VPP ' + ev.ppv.toFixed(3));
  const h = E.hrv(pt.R, FS);
  close(h.hr, hr, 0.06, 'fréquence retrouvée à ' + hr + ' bpm');
}
// extrasystoles ventriculaires du signal synthétique non bruité
{
  const s = E.synth({ dur: 120, hr: 70, pvcRate: 0.08, seed: 9 }), pt = E.panTompkins(s.x, FS), cls = E.classify(s.x, FS, pt.R);
  const ev = E.evaluate(pt.R, s.truth.map((b) => b[0]), FS), det = new Map(pt.R.map((r, k) => [r, cls.beats[k].label])), truth = new Map(s.truth);
  let tpV = 0, fV = 0, nV = 0;
  ev.pairs.forEach(([r, d]) => { if (truth.get(r) === 'V') { nV++; if (det.get(d) === 'V') tpV++; } else if (det.get(d) === 'V') fV++; });
  ok(nV > 3 && tpV === nV && fV === 0, 'extrasystoles V synthétiques : ' + tpV + ' / ' + nV + ', fausses ' + fV);
}

// 5. Évaluation : appariement et tolérance de 150 ms
{
  const ref = [1000, 2000, 3000, 4000], det = [1010, 2050, 3200, 5000];
  const e = E.evaluate(det, ref, 360);
  n++; assert.strictEqual(e.tp, 2, '2 détections dans la tolérance de 54 échantillons (écarts de 10 et 50)');
  n++; assert.strictEqual(e.fn, 2, '2 battements manqués'); n++; assert.strictEqual(e.fp, 2, '2 fausses détections');
}
// 6. Événements du rythme
{
  const R = [], fs = 360; let t = 0; for (let k = 0; k < 40; k++) { R.push(Math.round(t * fs)); t += k === 20 ? 2.5 : 0.5; } // 120 bpm, une pause de 2,5 s
  const ev = E.rhythmEvents(R, fs);
  ok(ev.some((e) => e.type === 'pause' && Math.abs(e.value - 2.5) < 0.01), 'pause de 2,5 s repérée');
  ok(ev.some((e) => e.type === 'tachy'), 'tachycardie à 120 bpm repérée');
}

console.log('OK : ' + n + ' vérifications passent');
