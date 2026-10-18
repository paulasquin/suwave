// Editorial content in French (English in content.en.js, same order and ids).
// Facts come from the 2017 internship report, the logbook, the trial reports and the data files.
import { LANG } from './kit/i18n.js';
import { COEFS, SPEED_16AUG } from './data/measures.js';
import { TIMELINE_EN, ENTRIES_EN, STATS_EN, BARS_EN, TILES_EN, TEAM_EN, SOURCES_EN } from './content.en.js';

const ph = (name, caption, contain) => ({ src: `assets/photos/${name}.webp`, caption, contain });

export const TIMELINE = [
  { date: '5 juil.', title: 'Arrivée au 3IT', text: 'Première journée, un vol d\'essai de l\'aile solaire, et un conseil : mesurer la dérive avant de la prédire.' },
  { date: '6 juil.', title: 'Trois ailes de dérive', text: 'Découpées au fil chaud dans la mousse isolante, sans moteur ni hélice.' },
  { date: '11–13 juil.', title: 'Le programme d\'anticipation', text: 'Prévisions de vent en base SQLite, premier point de pose calculé.' },
  { date: '26 juil.', title: 'Essai n°1', text: 'Lac des Nations, Sherbrooke : algues, kayakiste curieux et vent contraire aux prévisions.' },
  { date: '2 août', title: 'Essai n°2', text: 'Lac à la Truite, Orford : trois ailes en parallèle. Le même jour, près du 3IT, un test de portée des antennes.' },
  { date: '16 août', title: 'Essai n°3', text: 'Lac Montjoie : grand vent, dérives très propres, le coefficient de 5 % se confirme.' },
  { date: '22 août', title: 'Bilan d\'avancement', text: 'Algorithme fonctionnel, prototypes d\'ancres, système de déploiement à croisillons.' },
  { date: '29 août', title: 'Essai n°4', text: 'Lac Montjoie : les prototypes anti-dérive à l\'eau, par un vent trop faible pour conclure.' },
];

export const ENTRIES = [
  {
    id: 'arrivee', num: '01', date: '5 juillet 2017', year: '3IT',
    title: 'Premier jour, et déjà un vol',
    question: 'Combien de soleil faut-il à une aile pour repartir ?',
    body: [
      'La dernière version de l\'aile vole le jour de mon arrivée, équipée de panneaux solaires fonctionnels : en plein soleil, elle se recharge en 3 heures. Au Québec, le soleil dure 9 heures en hiver et 15 en été, souvent derrière les nuages ; par temps couvert, l\'aile limite tout juste sa décharge. En veille, elle consomme environ 1 mW.',
      'À la réunion mensuelle du 3IT, je présente mes premières lignes de code sur l\'optimisation du point de pose. Alexis Lussier-Desbiens me conseille d\'élargir d\'abord l\'approche : obtenir des valeurs chiffrées sur la dérive, en fonction du vent et du courant.',
    ],
    result: 'Un plan de travail : instrumenter des ailes, mesurer leur dérive, puis l\'anticiper.',
    media: [ph('vol-solaire', 'Richard-Alexandre Péloquin tient l\'aile solaire avant un vol d\'essai')],
  },
  {
    id: 'mousse', num: '02', date: '6 juillet 2017', year: 'atelier',
    title: 'Trois ailes au fil chaud',
    question: 'Comment fabriquer vite des ailes à laisser dériver ?',
    body: [
      'Les ailes sont découpées dans des panneaux de mousse isolante. Des profils en bois, posés sur la tranche, guident un fil métallique parcouru par un courant (20 V, 4 A) qui tranche la mousse instantanément et avec une précision surprenante. Des graduations permettent de vérifier que l\'archet avance régulièrement.',
      'Chaque demi-aile est ensuite collée à l\'époxy à son symétrique. Ces maquettes n\'ont ni moteur, ni hélice, ni actionneur : elles servent à étudier une dérive inerte à la surface de l\'eau.',
    ],
    result: 'De quoi fabriquer trois ailes de dérive, qui porteront les numéros 2, 3 et 4.',
    media: [ph('mousse-panneau', 'Le panneau de mousse isolante'), ph('mousse-profils', 'Les profils de l\'aile posés sur la tranche'), ph('mousse-decoupe', 'Le fil chaud suit les profils en bois'), ph('demi-aile', 'Une demi-aile, avant collage avec son symétrique')],
  },
  {
    id: 'pixhawk', num: '03', date: '7 – 26 juillet 2017', year: 'PX4',
    title: 'Faire parler le contrôleur de vol',
    question: 'Comment ne perdre aucune donnée d\'un essai de douze heures ?',
    body: [
      'Par défaut, le PixHawk n\'enregistre qu\'une fois armé, à 200 Hz. J\'ai réglé l\'enregistrement à 1 Hz, de la mise sous tension à l\'extinction, sur quatre messages seulement : position GPS, capteurs internes, tube de Pitot et état de la batterie. À 0,05 Mo par minute, un essai de 12 heures n\'écrirait que 36 Mo sur la carte SD de 4 Go.',
      'Restait un défaut : débrancher la batterie corrompait le fichier en cours. J\'ai écrit « plogger », une application embarquée dans PX4 qui, toutes les 15 minutes, ferme proprement le fichier puis redémarre le contrôleur pour en ouvrir un nouveau. Au pire, on ne perd que le dernier quart d\'heure. Pour repérer la mise à l\'eau dans les données, nous secouons l\'aile pendant quinze secondes juste avant et juste après : les pics d\'accélération verticale balisent l\'essai.',
    ],
    result: 'Des journaux fiables ; le code de plogger est publié sur GitHub avec mes autres modifications du firmware PX4.',
    media: [ph('electronique', 'L\'électronique intégrée dans une aile : interrupteur d\'armement, alimentation, contrôleur de vol, batterie, GPS, télémétrie', true), ph('accel-z', 'Accélération verticale lors de l\'essai du 26 juillet : les secousses marquent la mise à l\'eau et la sortie', true)],
  },
  {
    id: 'programme', num: '04', date: '11 – 13 juillet 2017', year: 'Python',
    title: 'Un premier point de pose',
    question: 'Peut-on calculer à l\'avance où poser l\'aile ?',
    body: [
      'Un script Python récupère les prévisions de vent Windfinder pour trois sites et les enregistre dans une base SQLite, en remplaçant les plus anciennes. Dès le 13 juillet, le programme affiche un premier point de pose optimal, encore en coordonnées cartésiennes.',
      'Au fil du stage, le calcul s\'affine : conversion en coordonnées GPS, pondération à la seconde du temps passé sous chaque vecteur de vent, intégration du maillage GEGI, construction automatique des zones de sécurité de chaque lac. Une interface Tkinter permet de choisir le lac, la date de début et la durée de la dérive ; le programme trace la dérive prévue, la zone minimale qu\'elle occupe et la zone de sécurité disponible, puis donne les coordonnées GPS du point de pose.',
    ],
    result: 'Un programme qui donne, pour un lac et une recharge, la position GPS du point de pose.',
    media: [ph('interface', 'L\'interface de simulation de dérive', true), ph('console', 'Le retour console des calculs', true), ph('anticipation-sortie', 'Le résultat : zone de sécurité (bleu), déplacement (rouge), zone minimale de dérive (noir)', true)],
  },
  {
    id: 'nations', num: '05', date: '26 juillet 2017', year: 'essai n°1',
    title: 'Lac des Nations : l\'énigme de la 67e minute',
    question: 'Que dit une première dérive grandeur nature ?',
    body: [
      'Richard-Alexandre et moi posons une aile instrumentée au centre du lac des Nations, à Sherbrooke, pour environ une heure et demie. Les berges sont en partie fermées après la fête du lac ; nous perdons parfois l\'aile de vue. Elle finit freinée dans un banc d\'algues, et à la 67e minute ses capteurs enregistrent une forte secousse inexpliquée.',
      'L\'énigme sera résolue plus tard : un kayakiste, intrigué, a contacté l\'université pour signaler qu\'il avait manipulé l\'aile avant de la reposer à l\'eau. Autre surprise : le vent soufflait exactement à l\'opposé des prévisions de la station de l\'aéroport. Faute de données de vent fiables, l\'essai ne permet qu\'une première estimation du rapport entre dérive et vent.',
    ],
    result: 'Le vent semble le seul moteur de la dérive ; il faudra des mesures de vent plus fiables.',
    media: [ph('canot', 'Richard-Alexandre en route pour poser l\'aile au centre du lac'), ph('aile-capteurs', 'L\'aile équipée de ses capteurs'), ph('canards', 'Nos compagnons d\'expérience')],
  },
  {
    id: 'antennes', num: '06', date: '2 août 2017', year: 'radio',
    title: 'Jusqu\'où porte la radio ?',
    question: 'Pourra-t-on retrouver une aile au milieu d\'un grand lac ?',
    body: [
      'Aile posée au sol, nous nous éloignons par paliers : la liaison directe tient jusqu\'à 320 m environ. En abaissant le débit radio de 64 à 8 kbit/s, la portée au sol passe à 500 m. Mais une aile posée a une hauteur nulle : l\'eau et le sol obstruent la zone de Fresnel, comme l\'avait expliqué Charles-Alexis Carrier dans son rapport de stage.',
      'Plutôt qu\'une longue perche, nous embarquons deux antennes relais sous un drone Phantom, piloté par Richard-Alexandre, en vol stationnaire au-dessus de la station : l\'aile est captée à 1 350 m, une limite imposée par l\'autoroute voisine, pas par la radio.',
    ],
    result: 'Au moins 1 350 m de portée avec un drone relais, et probablement le double en le plaçant à mi-chemin.',
    media: [ph('antennes-relais', 'Les antennes relais installées sous le drone'), ph('drone-relais', 'Le drone relais')],
  },
  {
    id: 'truite', num: '07', date: '2 août 2017', year: 'essai n°2',
    title: 'Lac à la Truite : trois ailes à la fois',
    question: 'La dérive est-elle proportionnelle au vent ?',
    body: [
      'Avec Alexis Lussier-Desbiens et Richard-Alexandre Péloquin, nous lâchons trois ailes en parallèle sur le lac à la Truite, à Orford, le matin puis l\'après-midi. La station Windfinder du lac Memphrémagog donne des vents cohérents avec ce que nous observons : environ 2 m/s le matin, 3 à 4 m/s l\'après-midi. Les tubes de Pitot, eux, affichent 10 m/s : d\'après les essais de Bruno Chapdelaine, ils ne sont pas fiables sous 2 à 3 m/s.',
      'Les nénuphars freinent les ailes par moments, et l\'une d\'elles finit sous un ponton. Un script Matlab, écrit avec Richard-Alexandre, découpe désormais automatiquement les sessions grâce aux secousses et calcule les vitesses moyennes.',
    ],
    result: 'Une vitesse de dérive d\'environ 0,1 m/s, soit de l\'ordre de 4 % de la vitesse du vent.',
    viz: { type: 'tracks', lake: 'truite' },
    media: [ph('lac-ponton', 'Le lac à la Truite depuis le ponton'), ph('ailes-derive', 'Deux ailes à la dérive')],
  },
  {
    id: 'montjoie', num: '08', date: '16 août 2017', year: 'essai n°3',
    title: 'Lac Montjoie : le coefficient de 5 %',
    question: 'Le rapport se confirme-t-il par grand vent ?',
    body: [
      'Avec Étienne Tétreault et Richard-Alexandre, nous laissons dériver trois ailes en parallèle sur le lac Montjoie, à Saint-Denis-de-Brompton, par grand soleil et grand vent : 6 m/s en moyenne d\'après la station et nos observations. Pour la première fois, un tube de Pitot donne par moments des valeurs cohérentes, autour de 6 m/s.',
      'Aucune algue, des trajectoires propres dans la direction du vent : les ailes avancent à 0,283, 0,298 et 0,327 m/s, soit 4,7 %, 4,97 % et 5,46 % de la vitesse du vent. La courbe ci-contre est recalculée à partir des journaux GPS d\'origine, en moyennes sur 50 secondes comme en 2017.',
    ],
    result: 'Vitesse de dérive ≈ 5 % de la vitesse du vent : le coefficient retenu par l\'algorithme.',
    viz: { type: 'chart', chart: 'speed' },
    media: [ph('aile-pitot', 'Une aile de dérive et son tube de Pitot'), ph('aile-ponton', 'Prête pour la mise à l\'eau')],
  },
  {
    id: 'prototypes', num: '09', date: 'août 2017', year: 'prototypes',
    title: 'Ancres, panneaux et WaveGliders',
    question: 'Peut-on freiner l\'aile plutôt que la subir ?',
    body: [
      'En parallèle, je conçois des prototypes : un bateau témoin à voile en fibre de verre, qui sert de référence, une ancre flottante en forme de ballon, un panneau qui freine l\'aile en prenant appui sur l\'eau, et deux WaveGliders inspirés de celui de Liquid Robotics, que m\'avait présenté Alexis. Un tout premier WaveGlider, trop fragile, s\'était brisé quelques heures seulement après son usinage.',
      'Pour ranger une ancre dans l\'aile, je dessine aussi un système de déploiement à croisillons, imprimé sur la MarkForged et découpé à la Trotec, commandé depuis le contrôleur de vol par mon application « ancre ».',
    ],
    result: 'Une ancre déployée en 30 secondes, et une gamme de prototypes prêts à être testés.',
    viz: { type: 'viewer', models: [{ name: 'sabot' }], label: 'Sabot du système de déploiement' },
    media: [ph('bateau-temoin', 'Le bateau témoin'), ph('petit-waveglider', 'Le petit WaveGlider'), ph('panneau', 'Le panneau'), ph('grand-waveglider', 'Le grand WaveGlider'), ph('ballon', 'L\'ancre flottante « ballon »'), ph('waveglider-rendu', 'Le premier WaveGlider sous SolidWorks', true), ph('croisillon-rendu', 'Le système de déploiement sous SolidWorks', true), ph('croisillon-imprime', 'Le système assemblé')],
  },
  {
    id: 'calme', num: '10', date: '29 août 2017', year: 'essai n°4',
    title: 'Les prototypes à l\'eau, sans vent',
    question: 'Les prototypes résistent-ils au vent ?',
    body: [
      'Dernier essai, sur le lac Montjoie, pour mesurer la capacité des prototypes à lutter contre le vent. Ce jour-là, pas de vagues et un vent de 1 m/s au plus à l\'anémomètre : impossible de conclure sur les systèmes anti-dérive.',
      'Les trois ailes de dérive, elles, ajoutent des points au tableau des coefficients : entre 0,06 et 0,09 m/s pour 1 m/s de vent, au-dessus de la droite à 5 %. Par vent aussi faible, une incertitude d\'un mètre par seconde sur le vent pèse lourd. D\'autres essais devaient suivre pour caractériser les systèmes anti-dérive.',
    ],
    result: 'Le modèle à 5 % tient pour des vents de 2 à 6 m/s ; les vents très faibles restent à caractériser.',
    viz: { type: 'chart', chart: 'coef' },
    media: [],
  },
];

export const STATS = [
  { value: 5, decimals: 0, unit: '%', label: 'vitesse de dérive / vitesse du vent', note: 'essais des 2 et 16 août 2017', accent: true },
  { value: 0.3, decimals: 1, unit: 'm/s', label: 'dérive mesurée par vent de 6 m/s', note: 'lac Montjoie, 16 août : 0,283 à 0,327 m/s' },
  { value: 3, decimals: 0, unit: 'h', label: 'pour recharger en plein soleil', note: 'pendant lesquelles l\'aile dérive' },
  { value: 290, decimals: 0, unit: 'zones', unitEn: 'zones', label: 'rectangles d\'eau libre sur le lac Montjoie', note: 'construits à partir du maillage GEGI' },
  { value: 15, decimals: 0, unit: 'min', label: 'par fichier de journal avec « plogger »', note: 'au pire, un quart d\'heure perdu' },
  { value: 30, decimals: 0, unit: 's', label: 'pour déployer l\'ancre à croisillons', note: 'commandée par le contrôleur de vol' },
];

export const BARS = [
  { name: 'Au sol, 64 kbit/s', detail: 'aile posée, liaison directe', value: 320, kind: 'chem' },
  { name: 'Au sol, 8 kbit/s', detail: 'débit radio abaissé', value: 500, kind: 'ion' },
  { name: 'Avec un drone relais', detail: 'Phantom en vol stationnaire, limite non atteinte', value: 1350, kind: 'me' },
];

export const TILES = [
  { year: 'Québec', name: 'De lac en lac', tag: 'analyse de l\'eau · forêts', text: 'Sauter de lac en lac pour analyser l\'eau ou surveiller les forêts contre les incendies, en se rechargeant au soleil sur chaque plan d\'eau.' },
  { year: 'Archipels', name: 'D\'île en île', tag: 'avec les stations Oneka', text: 'Après un ouragan, lancées depuis un bateau de secours, les ailes reconnaissent les îles et transmettent leurs images à une station Oneka, relais vers les secours.' },
  { year: 'En mer', name: 'Des zones de dérive choisies', tag: 'repêchage · relais', text: 'Comme un lac, une zone de dérive en mer peut être choisie près d\'une station relais ou d\'un point de repêchage connu, pour ne pas perdre les appareils.', highlight: true },
  { year: 'Plus tard', name: 'Les algues comme alliées', tag: 'images satellite', text: 'Une piste notée en 2017 : repérer par analyse d\'images satellite les zones d\'algues rasantes, qui freinent l\'aile, et s\'en servir dans la stratégie anti-dérive.' },
];

export const TEAM = [
  { name: 'Dragan Tutić', role: 'Maître de stage, cofondateur d\'Oneka Technologies', text: 'Pour m\'avoir permis de vivre cette expérience.' },
  { name: 'Alexis Lussier-Desbiens', role: 'Responsable du projet SUWAVE, 3IT', text: 'Pour ses innombrables aides et conseils au quotidien.' },
  { name: 'Richard-Alexandre Péloquin', role: 'Mécanique, redressement de l\'hélice, pilote d\'essais', text: 'Coauteur du script Matlab d\'analyse et compagnon des essais sur le terrain.' },
  { name: 'Étienne Tétreault', role: 'Profil d\'aile et encapsulation des composants' },
  { name: 'Gabriel Guilmain', role: 'Contrôle automatique : décollage, atterrissage, veille' },
  { name: 'Vincent Rhéaume', role: 'Électronique', text: 'Pour l\'adaptation des nouveaux capteurs de pression des tubes de Pitot.' },
  { name: 'Jean-Marie Normand', role: 'Professeur référent, École Centrale de Nantes' },
  { name: 'Paul Asquin', role: 'Stagiaire : étude de la dérive', text: 'Essais, programme d\'anticipation, prototypes anti-dérive.', me: true },
];
export const THANKS = 'Merci aussi à John Bass pour son aide tout au long du stage, à Bruno Chapdelaine, Dino Mehanovic et Thomas Robichaud-Courteau, rencontrés au 3IT, à Charles-Alexis Carrier pour son rapport et ses notes de stage, et aux anciens stagiaires du projet GEGI.';

export const SOURCES = [
  { title: 'Rapport de stage « Étude et solutions pour la dérive d\'une aile volante, solaire et aquatique »', note: 'Paul Asquin, été 2017' },
  { title: 'Journal de bord et rapports d\'expérience de dérive des 26 juillet, 2 et 16 août 2017', note: 'avec le test de portée des antennes et le « Petit guide du suivi de dérive »' },
  { title: 'Présentations du 5 juillet et du 22 août 2017', note: 'avancement du stage' },
  { title: 'Modules PX4 plogger, ancre et pairspeed', url: 'https://github.com/paulasquin/PX4_Firmware_SUWAVE/tree/stable/src/paul', note: 'fork du firmware PX4' },
  { title: 'Programme anticipation-derive et script Matlab analyse-derive-suwave', note: 'dépôts privés ; base SQLite (zones, prévisions) et journaux .ulg utilisés pour ce site' },
  { title: 'Contours des lacs', url: 'https://www.openstreetmap.org/copyright', note: '© contributeurs OpenStreetMap (ODbL)' },
];

// Journal and results charts (functions, so translations apply).
const fr = LANG === 'fr';
export const CHARTS = {
  speed: () => ({
    id: 'speed',
    x: { label: fr ? 'temps (min)' : 'time (min)', min: 0, max: 60, ticks: [0, 15, 30, 45, 60], unit: 'min', d: 1 },
    y: { label: fr ? 'vitesse de dérive (m/s)' : 'drift speed (m/s)', min: 0, max: 0.6, ticks: [0, 0.2, 0.4, 0.6], unit: 'm/s', d: 3 },
    series: Object.entries(SPEED_16AUG).map(([w, data], i) => ({ name: fr ? `aile n°${w.slice(1)}` : `wing #${w.slice(1)}`, color: ['#ffb45e', '#67d8d0', '#ff7a8a'][i], data: data.filter((d) => d[0] <= 60) })),
  }),
  coef: () => ({
    id: 'coef',
    x: { label: fr ? 'vent (m/s)' : 'wind (m/s)', min: 0, max: 7, ticks: [0, 1, 2, 3, 4, 5, 6, 7], unit: 'm/s', d: 0 },
    y: { label: fr ? 'dérive (m/s)' : 'drift (m/s)', min: 0, max: 0.36, ticks: [0, 0.1, 0.2, 0.3], unit: 'm/s', d: 3 },
    series: [
      { name: fr ? 'modèle : 5 % du vent' : 'model: 5% of the wind', color: '#7c88a1', data: [[0, 0], [7, 0.35]], dash: '5 4' },
      { name: fr ? 'sessions de 2017' : '2017 sessions', color: '#67d8d0', data: COEFS.map((c) => [c.wind, c.drift]).sort((a, b) => a[0] - b[0]), dots: true, line: false },
    ],
  }),
};

if (LANG === 'en') {
  TIMELINE.forEach((x, i) => Object.assign(x, TIMELINE_EN[i]));
  ENTRIES.forEach((e) => {
    const en = ENTRIES_EN[e.id];
    if (!en) return;
    const media = en.captions ? e.media.map((m, i) => ({ ...m, caption: en.captions[i] ?? m.caption })) : e.media;
    Object.assign(e, en, { media });
    if (en.vizLabel && e.viz) e.viz.label = en.vizLabel;
  });
  STATS.forEach((x, i) => Object.assign(x, STATS_EN[i], x.unitEn ? { unit: x.unitEn } : {}));
  BARS.forEach((x, i) => Object.assign(x, BARS_EN[i]));
  TILES.forEach((x, i) => Object.assign(x, TILES_EN[i]));
  TEAM.forEach((x, i) => Object.assign(x, TEAM_EN[i]));
  SOURCES.forEach((x, i) => Object.assign(x, SOURCES_EN[i]));
}
