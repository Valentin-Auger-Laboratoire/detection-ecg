# Détection des battements cardiaques sur un ECG

🇫🇷 [Français](#français) · 🇬🇧 [English](#english)

**Essayer l'outil :** https://valentin-auger-laboratoire.github.io/portfolio/outils/detection-ecg/

> Outil pédagogique, **pas un dispositif médical** : il ne sert pas à poser un diagnostic.

---

## Français

### Ce que fait l'outil
De vrais électrocardiogrammes de la base **MIT-BIH Arrhythmia** (PhysioNet) sont analysés par l'algorithme de **Pan et Tompkins**, écrit à la main en JavaScript sans bibliothèque. Chaque battement trouvé est comparé aux **annotations des cardiologues** qui accompagnent l'enregistrement.

- **Tracé** sur papier millimétré (25 mm/s, 10 mm/mV) :
  - fenêtre de 5, 10 ou 20 s, défilement en temps réel ou à la souris ;
  - battements détectés et classés : N normal, S précoce à QRS fin, V ventriculaire probable ;
  - annotations des cardiologues, battements manqués et fausses détections ;
  - intervalles RR.
- **À l'intérieur de l'algorithme**, sur la fenêtre affichée :
  - signal brut, passe-bande 5 à 15 Hz, dérivée au carré, intégration sur 150 ms ;
  - **seuil adaptatif**, pics retenus et pics classés comme bruit.
- **Résultats** : nombre de battements, **sensibilité**, **valeur prédictive positive**, écart moyen au pic R, fréquence moyenne, variabilité (SDNN, RMSSD, pNN50).
- **Tachogramme** et **diagramme de Poincaré**, colorés par type de battement.
- **Événements** cliquables :
  - extrasystoles, pauses de plus de 2 s ;
  - tachycardie, bradycardie, rythme irrégulier.
- **Comparaison avec les cardiologues** : tableau annotation / détection.
- **ECG synthétique** : fréquence, bruit musculaire, ligne de base, secteur à 50 Hz et extrasystoles réglables. La vérité étant connue, la détection peut être notée.

### Résultats sur l'enregistrement 100 (30 minutes, 2 273 battements)
| | |
|---|---|
| Sensibilité | **100 %** (0 battement manqué) |
| Valeur prédictive positive | **100 %** (0 fausse détection) |
| Écart moyen au pic R annoté | 1,6 ms |
| Extrasystoles auriculaires (33) | toutes classées « précoce » |
| Extrasystole ventriculaire (1) | classée V |

L'enregistrement 100 est l'un des plus réguliers de la base. Sur des enregistrements plus difficiles (bruit, blocs de branche, rythmes électro-entraînés), les performances baissent : seuls les enregistrements 100 et 208 sont fournis ici.

### Méthode
- Filtres de Butterworth du 2ᵉ ordre (transformation bilinéaire), appliqués **aller-retour** : pas de retard à compenser.
- Pan-Tompkins (1985) :
  - dérivée sur 5 points, mise au carré, intégration sur 150 ms ;
  - seuils SPKI / NPKI adaptatifs ;
  - période réfractaire de 200 ms ;
  - **rejet des ondes T** (pente deux fois plus faible à moins de 360 ms) ;
  - **recherche arrière** des battements manqués après 1,66 intervalle moyen ;
  - seuils abaissés quand le rythme est irrégulier.
- Position du pic R affinée sur le signal sans ligne de base.
- Évaluation : un battement est bien détecté s'il est à moins de **150 ms** de l'annotation, comme dans la norme ANSI/AAMI EC57.
- Classification volontairement simple :
  - battement précoce, avec ou sans repos compensateur → S ;
  - forme du QRS mal corrélée au gabarit médian → V.

### Fichiers
| Fichier | Rôle |
|---|---|
| `ecg.js` | Moteur : filtres, Pan-Tompkins, évaluation, variabilité, classification, événements, ECG synthétique (testable avec Node) |
| `index.html` | Interface, bilingue FR / EN |
| `data/` | Enregistrements convertis (entiers 16 bits) et annotations, avec `NOTICE.txt` (sources et licence) |
| `tests/test.js` | Tests |

### Lancer les tests
```bash
node tests/test.js
```
- Filtres : −3 dB à la fréquence de coupure, gain et phase nulle à 10 Hz.
- **Enregistrement 100** : décompte officiel des annotations (2 239 N, 33 A, 1 V), sensibilité et valeur prédictive ≥ 99,8 %, écart au pic < 10 ms, classification des extrasystoles, variabilité plausible.
- Extrait du 208 : de nombreuses extrasystoles ventriculaires repérées.
- **ECG synthétiques** de 50 à 140 bpm, avec bruit, ligne de base et secteur : sensibilité et valeur prédictive > 99 %, fréquence retrouvée.
- Appariement avec tolérance, pauses et tachycardie.

### Limites
- Deux enregistrements réels seulement. L'extrait du 208 n'a pas d'annotations : les comptes y sont indicatifs.
- Classification N / S / V simple. Elle se trompe sur les signaux très bruités et ne reconnaît ni les blocs de branche ni les battements de fusion.
- « Rythme irrégulier » n'est pas un diagnostic de fibrillation atriale.
- Une seule dérivation (MLII).

### Données et références
- Moody GB, Mark RG. *The impact of the MIT-BIH Arrhythmia Database.* IEEE Eng in Med and Biol 20(3):45-50 (2001).
- Goldberger AL et al. *PhysioBank, PhysioToolkit, and PhysioNet.* Circulation 101(23):e215-e220 (2000).
- Licence des données : Open Data Commons Attribution v1.0. Fichiers d'origine : `wfdb-python` (MIT-LCP) pour le 100, `scipy.datasets` pour l'extrait du 208.
- Pan J, Tompkins WJ. *A real-time QRS detection algorithm.* IEEE Trans Biomed Eng 32(3):230-236 (1985).

### Utiliser en local
La page charge les données avec `fetch` : il faut un petit serveur web, par exemple `python3 -m http.server`, puis ouvrir http://localhost:8000.

---

## English

### What the tool does
Real electrocardiograms from the **MIT-BIH Arrhythmia Database** (PhysioNet) analysed with a hand-written **Pan-Tompkins** algorithm and compared with the cardiologists' annotations.

- ECG paper trace with detected and annotated beats; the algorithm stages with the adaptive threshold.
- Sensitivity, positive predictive value, heart rate and HRV (SDNN, RMSSD, pNN50).
- Tachogram, Poincaré plot, clickable events, confusion table.
- A synthetic ECG generator with adjustable noise.

**Record 100 (30 min, 2,273 beats): sensitivity 100%, positive predictive value 100%, mean R-peak offset 1.6 ms**; all 33 atrial premature beats flagged as premature, the ventricular beat flagged as V.

### Tests
```bash
node tests/test.js
```
- Filters.
- Record 100 versus annotations.
- Ventricular beats in the 208 excerpt.
- Synthetic ECGs from 50 to 140 bpm with noise.
- Matching tolerance and rhythm events.

### Limits
- Teaching tool, not a medical device.
- Two real records only.
- Simple N/S/V classification.
- Single lead.

### Data
- MIT-BIH Arrhythmia Database (Moody & Mark 2001; Goldberger et al. 2000), ODC-By 1.0 licence.

---

← [Portfolio](https://valentin-auger-laboratoire.github.io/portfolio/#projets)
