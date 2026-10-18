// Demo content. Replace with the project's own (French here, English in content.en.js;
// same order and ids). The demo describes the kit itself.
import { LANG } from './kit/i18n.js';
import { TIMELINE_EN, ENTRIES_EN, STATS_EN, BARS_EN, TILES_EN } from './content.en.js';

export const TIMELINE = [
  { date: 'Étape 1', title: 'Rassembler les sources', text: 'Textes, photos, modèles 3D (STL ou STEP), relevés bruts en CSV.' },
  { date: 'Étape 2', title: 'Écrire les actes', text: 'Une scène 3D par grand moment du récit, pilotée par le défilement.' },
  { date: 'Étape 3', title: 'Traduire et relire', text: 'Français et anglais, registre professionnel, relecture croisée.' },
  { date: 'Étape 4', title: 'Tester et publier', text: 'GPU réel sur Modal, émulateur Android, GitHub Pages et sous-domaine OVH.' },
];

export const ENTRIES = [
  {
    id: 'courbe', num: '01', date: 'Exemple', year: 'Données',
    title: 'Une courbe tracée depuis les relevés',
    question: 'Comment montrer une mesure sans la trahir ?',
    body: [
      "Les courbes du journal sont tracées en SVG à partir des fichiers d'origine, avec une révélation progressive et une lecture au survol.",
      'La configuration décrit les axes, les séries et des annotations ; un acte 3D peut aussi piloter la révélation au fil du défilement.',
    ],
    result: 'Une décroissance exponentielle et sa mesure bruitée.',
    viz: { type: 'chart', chart: 'decay' },
    media: [],
  },
  {
    id: 'piece', num: '02', date: 'Exemple', year: 'Modèle 3D', variant: 'print',
    title: 'Une pièce manipulable',
    question: 'Et si le visiteur pouvait faire tourner la pièce ?',
    body: [
      'Le visualiseur intégré charge un GLB et propose trois modes : plein, rayons X et coupe.',
      "Il ne démarre qu'à l'approche de l'écran et se met en pause hors champ.",
    ],
    result: 'La tuyère de démonstration, générée par tools/make_demo_model.py.',
    viz: { type: 'viewer', models: [{ name: 'demo' }] },
    media: [],
  },
];

export const STATS = [
  { value: 4, decimals: 0, unit: 'actes', unitEn: 'acts', label: 'scènes 3D au maximum, conseillé', accent: true },
  { value: 60, decimals: 0, unit: 'img/s', label: 'sur un GPU de bureau', note: 'résolution adaptative en dessous' },
  { value: 2, decimals: 0, unit: 'langues', unitEn: 'languages', label: 'détection automatique', note: 'français et anglais' },
];

export const BARS = [
  { name: 'Page sans 3D', detail: 'référence', value: 60, kind: 'chem' },
  { name: 'Téléphone, rendu logiciel', detail: 'émulateur, plancher pessimiste', value: 18, kind: 'ion' },
  { name: 'GPU de bureau', detail: 'Modal, NVIDIA L4', value: 60, kind: 'me' },
];

export const TILES = [
  { year: 'stage', name: 'La scène', tag: 'kit/stage.js', text: 'Un canvas WebGL partagé, bloom, finition, résolution adaptative, mode capture.' },
  { year: 'fx', name: 'Les effets', tag: 'kit/fx.js', text: 'Étoiles, panache, environnements, impression couche par couche, étiquettes.' },
  { year: 'page', name: 'La page', tag: 'kit/page.js', text: 'Défilement, actes, cartes, intro, navigation, visionneuse, chargement.' },
  { year: 'video', name: 'La vidéo', tag: 'video/', text: 'Capture image par image, musique synthétisée, textes FR et EN.' },
];

// The chart configs of the journal (functions, so translations apply).
export const CHARTS = {
  decay: () => {
    const truth = [], noisy = [];
    for (let i = 0; i <= 40; i++) {
      const x = i * 5, y = 0.8 * Math.exp(-x / 70);
      truth.push([x, +y.toFixed(4)]);
      noisy.push([x, +(y + Math.sin(i * 2.7) * 0.02).toFixed(4)]);
    }
    return {
      id: 'decay',
      x: { label: LANG === 'fr' ? 'temps (s)' : 'time (s)', min: 0, max: 200, ticks: [0, 50, 100, 150, 200], unit: 's', d: 0 },
      y: { label: LANG === 'fr' ? 'fréquence (tr/s)' : 'frequency (rev/s)', min: 0, max: 0.85, ticks: [0, 0.2, 0.4, 0.6, 0.8], unit: LANG === 'fr' ? 'tr/s' : 'rev/s', d: 3 },
      series: [
        { name: LANG === 'fr' ? 'Mesure' : 'Measurement', color: '#ff6b3d', data: noisy, dots: true },
        { name: LANG === 'fr' ? 'Modèle' : 'Model', color: '#6fd6ff', data: truth, dash: '5 4' },
      ],
    };
  },
};

if (LANG === 'en') {
  TIMELINE.forEach((x, i) => Object.assign(x, TIMELINE_EN[i]));
  ENTRIES.forEach((e) => Object.assign(e, ENTRIES_EN[e.id]));
  STATS.forEach((x, i) => Object.assign(x, STATS_EN[i], x.unitEn ? { unit: x.unitEn } : {}));
  BARS.forEach((x, i) => Object.assign(x, BARS_EN[i]));
  TILES.forEach((x, i) => Object.assign(x, TILES_EN[i]));
}
