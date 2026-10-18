// English content, same order and ids as content.js.
export const TIMELINE_EN = [
  { date: '5 July', title: 'Arrival at the 3IT', text: 'First day, a test flight of the solar wing, and a piece of advice: measure the drift before trying to predict it.' },
  { date: '6 July', title: 'Three drift wings', text: 'Cut from insulation foam with a hot wire, with no motor or propeller.' },
  { date: '11–13 July', title: 'The anticipation program', text: 'Wind forecasts stored in an SQLite database, and a first landing point computed.' },
  { date: '26 July', title: 'Trial #1', text: 'Lac des Nations, Sherbrooke: algae, a curious kayaker and a wind blowing against the forecast.' },
  { date: '2 August', title: 'Trial #2', text: 'Lac à la Truite, Orford: three wings at once. The same day, near the 3IT, an antenna range test.' },
  { date: '16 August', title: 'Trial #3', text: 'Lac Montjoie: strong wind, very clean drifts, and the 5% coefficient holds.' },
  { date: '22 August', title: 'Progress review', text: 'A working algorithm, anchor prototypes and a scissor deployment system.' },
  { date: '29 August', title: 'Trial #4', text: 'Lac Montjoie: the anti-drift prototypes in the water, in a wind too light to draw conclusions.' },
];

export const ENTRIES_EN = {
  arrivee: {
    date: '5 July 2017', year: '3IT',
    title: 'First day, and already a flight',
    question: 'How much sun does a wing need to fly again?',
    body: [
      'The latest version of the wing flies on the day I arrive, fitted with working solar panels: in full sun, it recharges in 3 hours. In Québec, the sun shines for 9 hours a day in winter and 15 in summer, often behind clouds; under an overcast sky, the wing barely manages to slow its discharge. On standby, it draws about 1 mW.',
      'At the 3IT monthly meeting, I present my first lines of code for optimising the landing point. Alexis Lussier-Desbiens advises me to take a broader approach first: get hard figures on the drift, as a function of the wind and the current.',
    ],
    result: 'A work plan: instrument some wings, measure their drift, then anticipate it.',
    captions: ['Richard-Alexandre Péloquin holds the solar wing before a test flight'],
  },
  mousse: {
    date: '6 July 2017', year: 'workshop',
    title: 'Three wings, cut with a hot wire',
    question: 'How do you quickly build wings that are only meant to drift?',
    body: [
      'The wings are cut from sheets of insulation foam. Wooden airfoil templates fixed to the edges guide a metal wire carrying a current (20 V, 4 A), which slices through the foam instantly and with surprising precision. Graduations help check that the bow moves forward at a steady pace.',
      'Each half-wing is then glued to its mirror-image twin with epoxy. These models have no motor, propeller or actuator: they are only used to study passive drift on the water surface.',
    ],
    result: 'Enough to build three drift wings, which would be numbered 2, 3 and 4.',
    captions: ['The sheet of insulation foam', 'The airfoil templates fixed to the edges', 'The hot wire follows the wooden templates', 'A half-wing, before being glued to its twin'],
  },
  pixhawk: {
    date: '7 – 26 July 2017', year: 'PX4',
    title: 'Getting the flight controller to talk',
    question: 'How do you avoid losing any data from a twelve-hour trial?',
    body: [
      'By default, the PixHawk only logs once armed, at 200 Hz. I set it to log at 1 Hz, from power-on to shutdown, and only four messages: GPS position, internal sensors, Pitot tube and battery status. At 0.05 MB per minute, a 12-hour trial would write just 36 MB to the 4 GB SD card.',
      'One flaw remained: unplugging the battery corrupted the file being written. So I wrote “plogger”, an application embedded in PX4 that cleanly closes the log file every 15 minutes, then reboots the controller to start a new one. At worst, only the last quarter of an hour is lost. To spot the launch in the data, we shake the wing for fifteen seconds just before and just after: the spikes in vertical acceleration bracket the trial.',
    ],
    result: 'Reliable logs; the plogger code is on GitHub along with my other changes to the PX4 firmware.',
    captions: ['The electronics inside a wing: arming switch, power module, flight controller, battery, GPS, telemetry', 'Vertical acceleration during the 26 July trial: the shakes mark the launch and the recovery'],
  },
  programme: {
    date: '11 – 13 July 2017', year: 'Python',
    title: 'A first landing point',
    question: 'Can we work out in advance where to land the wing?',
    body: [
      'A Python script fetches Windfinder wind forecasts for three sites and stores them in an SQLite database, replacing older entries. By 13 July, the program displays a first optimal landing point, still in Cartesian coordinates.',
      'Over the internship, the computation is refined: conversion to GPS coordinates, the time spent under each wind vector weighted to the second, integration of the GEGI mesh, automatic construction of each lake\'s safety zones. A Tkinter interface lets you choose the lake, the start date and the duration of the drift; the program plots the predicted drift, the minimum area it covers and the available safety zone, then gives the GPS coordinates of the landing point.',
    ],
    result: 'A program that gives, for a given lake and charge, the GPS position of the landing point.',
    captions: ['The drift simulation interface', 'The console output of the computation', 'The result: safety zone (blue), displacement (red), minimum drift zone (black)'],
  },
  nations: {
    date: '26 July 2017', year: 'trial #1',
    title: 'Lac des Nations: the mystery of minute 67',
    question: 'What does a first full-scale drift tell us?',
    body: [
      'Richard-Alexandre and I set an instrumented wing down in the middle of Lac des Nations, in Sherbrooke, for about an hour and a half. Parts of the shore are still closed after the lake festival, so we sometimes lose sight of the wing. It ends up held back by a bed of algae, and at minute 67 its sensors record a strong, unexplained jolt.',
      'The mystery was solved later: an intrigued kayaker contacted the university to say he had picked up the wing before putting it back in the water. Another surprise: the wind blew in exactly the opposite direction to the airport station\'s forecast. Without reliable wind data, the trial only gives a first estimate of the ratio between drift and wind.',
    ],
    result: 'The wind seems to be the only driver of the drift; we will need more reliable wind measurements.',
    captions: ['Richard-Alexandre on his way to set the wing down in the middle of the lake', 'The wing with its sensors', 'Our companions during the trial'],
  },
  antennes: {
    date: '2 August 2017', year: 'radio',
    title: 'How far does the radio reach?',
    question: 'Will we be able to find a wing in the middle of a large lake?',
    body: [
      'With the wing lying on the ground, we walk away in stages: the direct link holds up to about 320 m. Lowering the radio data rate from 64 to 8 kbit/s extends the ground range to 500 m. But a wing at rest sits at zero height: water and ground obstruct the Fresnel zone, as Charles-Alexis Carrier had explained in his internship report.',
      'Rather than a long pole, we mount two relay antennas on a Phantom drone, flown by Richard-Alexandre and hovering above the station: the wing is picked up 1,350 m away, a limit set by the nearby motorway, not by the radio.',
    ],
    result: 'At least 1,350 m of range with a relay drone, and probably twice that if it is positioned halfway.',
    captions: ['The relay antennas fitted to the drone', 'The relay drone'],
  },
  truite: {
    date: '2 August 2017', year: 'trial #2',
    title: 'Lac à la Truite: three wings at once',
    question: 'Is the drift proportional to the wind?',
    body: [
      'With Alexis Lussier-Desbiens and Richard-Alexandre Péloquin, we release three wings in parallel on Lac à la Truite, in Orford, in the morning and again in the afternoon. The Windfinder station on Lake Memphremagog reports winds consistent with what we see: about 2 m/s in the morning, 3 to 4 m/s in the afternoon. The Pitot tubes, on the other hand, read 10 m/s: according to Bruno Chapdelaine\'s tests, they cannot be trusted below 2 to 3 m/s.',
      'Water lilies hold the wings back at times, and one of them ends up under a jetty. A Matlab script, written with Richard-Alexandre, now splits the sessions automatically using the shakes and computes the mean speeds.',
    ],
    result: 'A drift speed of about 0.1 m/s, or roughly 4% of the wind speed.',
    captions: ['Lac à la Truite from the jetty', 'Two wings drifting'],
  },
  montjoie: {
    date: '16 August 2017', year: 'trial #3',
    title: 'Lac Montjoie: the 5% coefficient',
    question: 'Does the ratio hold in a strong wind?',
    body: [
      'With Étienne Tétreault and Richard-Alexandre, we let three wings drift in parallel on Lac Montjoie, in Saint-Denis-de-Brompton, in bright sun and a strong wind: 6 m/s on average according to the station and our own observations. For the first time, a Pitot tube gives sensible readings at times, around 6 m/s.',
      'No algae, and clean tracks in the direction of the wind: the wings move at 0.283, 0.298 and 0.327 m/s, i.e. 4.7%, 4.97% and 5.46% of the wind speed. The chart opposite is recomputed from the original GPS logs, using 50-second averages as in 2017.',
    ],
    result: 'Drift speed ≈ 5% of the wind speed: the coefficient used by the algorithm.',
    captions: ['A drift wing and its Pitot tube', 'Ready to go into the water'],
  },
  prototypes: {
    date: 'August 2017', year: 'prototypes',
    title: 'Anchors, panels and WaveGliders',
    question: 'Can we hold the wing back instead of just putting up with the drift?',
    body: [
      'Alongside this, I design prototypes: a reference boat with a fibreglass sail, a balloon-shaped sea anchor, a panel that brakes the wing against the water, and two WaveGliders inspired by the one made by Liquid Robotics, which Alexis had shown me. A very first WaveGlider, too fragile, had broken just a few hours after it was machined.',
      'To stow an anchor inside the wing, I also design a scissor deployment system, printed on the MarkForged and cut on the Trotec, and commanded from the flight controller by my “ancre” application.',
    ],
    result: 'An anchor deployed in 30 seconds, and a range of prototypes ready to be tested.',
    vizLabel: 'Carriage of the deployment system',
    captions: ['The reference boat', 'The small WaveGlider', 'The panel', 'The large WaveGlider', 'The “balloon” sea anchor', 'The first WaveGlider in SolidWorks', 'The deployment system in SolidWorks', 'The assembled system'],
  },
  calme: {
    date: '29 August 2017', year: 'trial #4',
    title: 'The prototypes in the water, without wind',
    question: 'Can the prototypes hold out against the wind?',
    body: [
      'A last trial, on Lac Montjoie, to measure how well the prototypes resist the wind. That day there were no waves and the anemometer recorded at most 1 m/s of wind: no conclusion could be drawn about the anti-drift systems.',
      'The three drift wings, however, add points to the table of coefficients: between 0.06 and 0.09 m/s in 1 m/s of wind, above the 5% line. In such a light wind, an uncertainty of one metre per second on the wind weighs heavily. Further trials were planned to characterise the anti-drift systems.',
    ],
    result: 'The 5% model holds for winds of 2 to 6 m/s; very light winds remain to be characterised.',
  },
};

export const STATS_EN = [
  { label: 'drift speed / wind speed', note: 'trials of 2 and 16 August 2017' },
  { label: 'drift measured in a 6 m/s wind', note: 'Lac Montjoie, 16 August: 0.283 to 0.327 m/s' },
  { label: 'to recharge in full sun', note: 'hours during which the wing drifts' },
  { label: 'open-water rectangles on Lac Montjoie', note: 'built from the GEGI mesh' },
  { label: 'per log file with “plogger”', note: 'at worst, a quarter of an hour lost' },
  { label: 'to deploy the scissor anchor', note: 'commanded by the flight controller' },
];

export const BARS_EN = [
  { name: 'On the ground, 64 kbit/s', detail: 'wing at rest, direct link' },
  { name: 'On the ground, 8 kbit/s', detail: 'lower radio data rate' },
  { name: 'With a relay drone', detail: 'hovering Phantom, limit not reached' },
];

export const TILES_EN = [
  { year: 'Québec', name: 'From lake to lake', tag: 'water analysis · forests', text: 'Hopping from lake to lake to analyse the water or watch over the forests for fires, recharging in the sun on each lake.' },
  { year: 'Archipelagos', name: 'From island to island', tag: 'with the Oneka stations', text: 'After a hurricane, launched from a rescue boat, the wings survey the islands and send their images to an Oneka station, which relays them to the rescue teams.' },
  { year: 'At sea', name: 'Chosen drift zones', tag: 'recovery · relay', text: 'As on a lake, a drift zone at sea can be chosen near a relay station or a known recovery point, so that no drone is lost.' },
  { year: 'Later', name: 'Algae as allies', tag: 'satellite images', text: 'An idea noted in 2017: locate the beds of low-growing algae that slow the wing down by analysing satellite images, and use them in the anti-drift strategy.' },
];

export const TEAM_EN = [
  { role: 'Internship supervisor, co-founder of Oneka Technologies', text: 'For making this experience possible.' },
  { role: 'Head of the SUWAVE project, 3IT', text: 'For his constant help and advice, day after day.' },
  { role: 'Mechanics, propeller tilt-up mechanism, test pilot', text: 'Co-author of the Matlab analysis script and companion on the field trials.' },
  { role: 'Airfoil and component encapsulation' },
  { role: 'Automatic control: take-off, landing, standby' },
  { role: 'Electronics', text: 'For adapting the new pressure sensors for the Pitot tubes.' },
  { role: 'Academic supervisor, École Centrale de Nantes' },
  { role: 'Intern: drift study', text: 'Trials, anticipation program, anti-drift prototypes.' },
];
export const THANKS_EN = 'Thanks also to John Bass for his help throughout the internship, to Bruno Chapdelaine, Dino Mehanovic and Thomas Robichaud-Courteau, whom I met at the 3IT, to Charles-Alexis Carrier for his internship report and notes, and to the earlier interns of the GEGI project.';

export const SOURCES_EN = [
  { title: 'Internship report “Étude et solutions pour la dérive d\'une aile volante, solaire et aquatique” (Study of and solutions for the drift of a solar, water-landing flying wing)', note: 'Paul Asquin, summer 2017, in French' },
  { title: 'Logbook and drift trial reports of 26 July, 2 and 16 August 2017', note: 'with the antenna range test and the drift monitoring guide' },
  { title: 'Presentations of 5 July and 22 August 2017', note: 'internship progress' },
  { title: 'PX4 modules plogger, ancre and pairspeed', note: 'fork of the PX4 firmware' },
  { title: 'anticipation-derive program and analyse-derive-suwave Matlab script', note: 'private repositories; SQLite database (zones, forecasts) and .ulg logs used for this site' },
  { title: 'Lake outlines', note: '© OpenStreetMap contributors (ODbL)' },
];
