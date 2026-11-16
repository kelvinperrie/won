// All game tuning values live here.
// Distances and speeds are percentages of the screen's SHORTER side,
// so the game plays the same at any window size.

const CONFIG = {
  save: {
    key: 'won-save',
    version: 1,
    autosaveSeconds: 5,
  },

  spawn: {
    secondsPerLure: 10,   // default: 1 lure = 1 animal every 10 s; N lures = every 10/N s
                          // (an animal can override this with its own spawnSeconds)
    maxAnimals: 60,       // cap on animals on screen at once
    firstSpawnDelay: 1,   // seconds before the first animal of each type arrives
  },

  bullet: {
    speed: 85,            // % of screen per second (slow enough that moving animals can dodge)
    fontSize: 0.9,        // % of screen ("really small text")
  },

  explosion: {
    duration: 0.3,        // seconds the BOOM stays on screen
  },

  text: {
    font: '"Consolas", "Courier New", monospace',
    unitSize: 2.4,        // % of screen
    unitLetterSpacing: -0.12, // extra gap between letters of unit labels, as a fraction of font size (negative = squished)
    animalSize: 2.1,
    animalLetterSpacing: -0.12, // same as above, for animal names
    floatSize: 1.5,
    minPx: 6,
  },

  ai: {
    aimSpread: 7,         // AI shots go up to this many degrees off target, either side
    // While shooting, AI units shuffle about so they don't stack on top of each other.
    shuffleSpeed: 0.35,   // fraction of the unit's own speed
    shuffleSeconds: [0.4, 1.2], // how long each shuffle lasts before picking a new direction
    personalSpace: 4,     // % of screen: if another unit is this close, shuffle away from it
    tooClose: 0.5,        // fraction of range: closer than this, shuffle away from the target instead of toward it
  },

  // Wandering animals now and then make an abrupt change of direction
  // (a startled dart) instead of only curving gently.
  animalWander: {
    abruptTurnEvery: [3, 8],    // seconds between abrupt turns (random in this range)
    abruptTurnAngle: [60, 180], // degrees, left or right at random
  },

  // How often animals make their noise while wandering (seconds, random in the
  // range). An animal's own noiseEvery replaces 'every'.
  animalNoise: {
    firstIn: [3, 9],  // after appearing
    every: [5, 12],   // after that
  },

  // Adviser popups in the bottom-left (the advisers and their lines are in advisers.js).
  toasts: {
    firstDelay: 6,       // seconds before the first remark
    every: [18, 40],     // seconds between random remarks (random in this range)
    showSeconds: 9,      // how long each popup stays up
    maxShown: 4,         // older popups are dismissed beyond this many
  },

  // Achievements are listed in achievements.js.
  achievements: {
    manyKills: 15,       // kills of one animal type for its "Exterminator" achievement
    manyPlants: 50,      // trees (or bushes) broken for the plant achievements
    manyWebbed: 10,      // times any unit is covered in COBWEBS for "Sticky Situation"
  },

  maxFrameSeconds: 0.1,   // stops background tabs "catching up" on return

  // Sound effects and screen feedback (feedback.js). The player can switch
  // sound and shake/flash off separately; those choices are saved under their
  // own key, so Reset Progress doesn't touch them.
  feedback: {
    settingsKey: 'won-settings',
    // Master volume. The player's slider goes 0..1 and starts at `default`.
    // It sets a loudness of maxGain * slider², so the slider feels even to the
    // ear (0.7 gives about 1, 1 gives maxGain). A compressor keeps busy moments
    // from distorting when it's turned right up.
    volume: { default: 0.7, maxGain: 2 },
    maxVoices: 24,         // sounds playing at once; more are skipped
    minGap: 0.035,         // seconds: the same sound won't start again sooner than this
    hitFlashSeconds: 0.12, // animals and plants flash white this long when hit
    // Screen shake, in % of screen. Only the player's own shots and SHELLs
    // shake the screen (AI bullets would make it shake all the time).
    shake: { bullet: 0.15, shell: 0.5, dig: 0.2, max: 1, decay: 9 }, // decay: how fast it settles (per second)
  },

  // Player unit types. Attribute order here is the order shown in the shop.
  //   value at level L = base + perLevel * L
  //   upgrade cost at level L = cost * costGrowth ^ L
  //
  // Optional per-type settings:
  //   textSize        font size of the label (% of screen), default text.unitSize
  //   letterSpacing   gap between label letters, default text.unitLetterSpacing
  //   projectile      word fired, default 'BULLET'; projectileSize its font size
  //   ai: 'tank'      drives like a tank: turns on the spot, then moves forward
  //   labelTurnRate   deg/s the label rotates toward the direction of travel
  //                   (movement itself still changes direction instantly)
  //   hullTurnRate    tank only: degrees per second the body can turn
  //   barrel          tank only: the turret word drawn on top, aimed independently
  //   immobile        tank only: never moves or turns its body (only the barrel turns);
  //                   needs no speed attribute
  //   minRange        tank only: % of screen; never targets or fires at anything closer
  //   startAt         'center' to appear in the middle of the battlefield
  //                   (default: bottom middle)
  unitTypes: {
    MAN: {
      description: 'AI hunter',
      startingCount: 1,     // MAN1 is the player's own man
      maxCount: 4,          // MAN1 + up to 3 AI MANs
      cost: 30,             // price of the first extra one (MAN2)
      costGrowth: 1.8,      // each extra MAN costs 1.8x the previous
      labelTurnRate: 720,   // deg/s: the MAN word turns smoothly (but fast) to face a new direction
      attributes: {
        speed:    { label: 'Speed',          base: 14, perLevel: 2.5,  maxLevel: 8, cost: 5,  costGrowth: 1.5,  decimals: 1, suffix: '%/s' },
        fireRate: { label: 'Shooting speed', base: 1,  perLevel: 0.25, maxLevel: 8, cost: 8,  costGrowth: 1.55, decimals: 2, suffix: '/s' },
        range:    { label: 'Range',          base: 32, perLevel: 2.5,  maxLevel: 8, cost: 6,  costGrowth: 1.5,  decimals: 1, suffix: '%' },
        damage:   { label: 'Damage',         base: 1,  perLevel: 1,    maxLevel: 8, cost: 10, costGrowth: 1.6,  decimals: 0, suffix: '' },
        power:    { label: 'Power',          base: 2,  perLevel: 1,    maxLevel: 8, cost: 12, costGrowth: 1.6,  decimals: 1, suffix: '% radius' },
      },
    },
    TANK: {
      description: 'heavy, slow',
      startingCount: 0,
      maxCount: 1,          // only ever one TANK
      cost: 400,
      costGrowth: 1,
      textSize: 3.2,
      projectile: 'SHELL',
      projectileSize: 1.3,
      ai: 'tank',
      hullTurnRate: 45,     // deg/s: has to turn on the spot before driving off
      barrel: { word: 'BARREL', textSize: 1.92, turnRate: 140 }, // turnRate in deg/s
      attributes: {
        speed:    { label: 'Speed',          base: 5,    perLevel: 0.75, maxLevel: 6, cost: 40, costGrowth: 1.6, decimals: 1, suffix: '%/s' },
        fireRate: { label: 'Shooting speed', base: 0.35, perLevel: 0.08, maxLevel: 6, cost: 60, costGrowth: 1.6, decimals: 2, suffix: '/s' },
        range:    { label: 'Range',          base: 38,   perLevel: 10 / 6, maxLevel: 6, cost: 50, costGrowth: 1.6, decimals: 1, suffix: '%' }, // always 2% short of the ARTILLERY
        damage:   { label: 'Damage',         base: 6,    perLevel: 3,    maxLevel: 6, cost: 70, costGrowth: 1.6, decimals: 0, suffix: '' },
        power:    { label: 'Power',          base: 6,    perLevel: 1.5,  maxLevel: 6, cost: 80, costGrowth: 1.6, decimals: 1, suffix: '% radius' },
      },
    },
    // Like the TANK, but it can't move: it sits in the middle of the battlefield
    // and only turns its barrel.
    ARTILLERY: {
      description: 'stationary',
      startingCount: 0,
      maxCount: 1,          // only ever one ARTILLERY
      cost: 900,
      costGrowth: 1,
      textSize: 3.2,
      letterSpacing: -0.24, // squished tighter than other units (default text.unitLetterSpacing)
      projectile: 'SHELL',
      projectileSize: 1.3,
      ai: 'tank',
      immobile: true,
      startAt: 'center',
      minRange: 20,         // % of screen: won't target or fire at anything closer than this
      barrel: { word: 'BARREL', textSize: 1.92, turnRate: 140 }, // turnRate in deg/s
      attributes: {
        fireRate: { label: 'Shooting speed', base: 0.35, perLevel: 0.08, maxLevel: 6, cost: 90,  costGrowth: 1.6, decimals: 2, suffix: '/s' },
        range:    { label: 'Range',          base: 40,   perLevel: 10 / 6, maxLevel: 6, cost: 75,  costGrowth: 1.6, decimals: 1, suffix: '%' },
        damage:   { label: 'Damage',         base: 6,    perLevel: 3,    maxLevel: 6, cost: 100, costGrowth: 1.6, decimals: 0, suffix: '' },
        power:    { label: 'Power',          base: 6,    perLevel: 1.5,  maxLevel: 6, cost: 120, costGrowth: 1.6, decimals: 1, suffix: '% radius' },
      },
    },
  },

  // Animals. lureCost = price of the next lure beyond startingLures;
  // each further lure costs lureCostGrowth times the one before.
  animals: {
    // textSize (optional) overrides text.animalSize for that animal.
    // color (optional, [r, g, b]) overrides colors.animal for that animal.
    // plural (optional) for achievement text, default name + 's'.
    // noiseEvery (optional, [min, max] seconds) how often it makes its noise while wandering, default animalNoise.every.
    rabbit: { speed: 14, health: 1,  points: 1,  noise: 'squeak', lureCost: 5,    lureCostGrowth: 1.4, startingLures: 1, spawnSeconds: 5, textSize: 1.5 },
    pig:    { speed: 7,  health: 4,  points: 6,  noise: 'oink',   lureCost: 60,   lureCostGrowth: 1.4, startingLures: 0, color: [255, 150, 190] },
    deer:   { plural: 'deer', speed: 22, health: 6,  points: 15, noise: 'bleat',  lureCost: 300,  lureCostGrowth: 1.4, startingLures: 0, color: [184, 132, 80] },
    moose:  { plural: 'moose', speed: 10, health: 16, points: 40, noise: 'bellow', lureCost: 750,  lureCostGrowth: 1.4, startingLures: 0, color: [168, 150, 120], textSize: 2.6 },
    bear:   { speed: 6,  health: 30, points: 80, noise: 'roar',   lureCost: 1500, lureCostGrowth: 1.4, startingLures: 0, color: [240, 240, 240] },
    ferret: { speed: 40, health: 35, points: 150, noise: 'dook', lureCost: 3000, lureCostGrowth: 1.4, startingLures: 0, color: [232, 196, 110] },
    goose:  { plural: 'geese', speed: 16, health: 50, points: 300, noise: 'honk!', noiseEvery: [1, 2], lureCost: 6000, lureCostGrowth: 1.4, startingLures: 0, color: [190, 205, 215] },
    crab:   { speed: 9,  health: 60, points: 500, noise: 'snip snip', lureCost: 12000, lureCostGrowth: 1.4, startingLures: 0, color: [255, 30, 30] },
    // Moles don't walk in from an edge. Each one digs up out of the ground
    // somewhere on the battlefield, scurries about for a few seconds, then digs
    // back down and is gone (no points if it gets away). While it's digging
    // it's underground: it can't be hit, and AI units ignore it.
    //   burrow.emergeSeconds   how long it takes to dig out
    //   burrow.surfaceSeconds  how long it stays up (random in the range)
    //   burrow.burrowSeconds   how long it takes to dig back down
    mole:   { behaviour: 'burrower', speed: 12, health: 120, points: 900, noise: 'snuffle', lureCost: 20000, lureCostGrowth: 1.4, startingLures: 0, color: [205, 150, 120],
              burrow: { emergeSeconds: 0.8, surfaceSeconds: [5, 7], burrowSeconds: 0.7 } },
  },

  // The HOLE a mole leaves where it digs up or down, and the dirt it throws.
  // Sizes are % of screen; dirt speeds and gravity are % of screen per second.
  digging: {
    holeWord: 'HOLE',
    holeSize: 2.2,
    holeColor: [110, 80, 54],
    holeSeconds: 6,        // how long a HOLE stays (fading out over the last fadeSeconds)
    holeFadeSeconds: 1.5,
    dirtWord: 'dirt',
    dirtSize: 1.1,
    dirtColor: [150, 112, 76],
    dirtCount: [5, 8],     // bits of dirt thrown up each time
    dirtSpeed: [14, 30],
    dirtGravity: 90,
    dirtSeconds: 0.6,
  },

  // Animals that live in trees. They have no lures: they can jump out when a
  // plant breaks (see `releases` on the plant types). They ignore the animal cap.
  //   behaviour 'wander':  wanders for staySeconds (random in the range), then
  //                        runs off the nearest edge and is gone.
  //   behaviour 'webber':  runs at the nearest unit, covers it in COBWEBS
  //                        (see `cobwebs` below), then runs off the nearest edge.
  treeAnimals: {
    possum: { behaviour: 'wander', speed: 24, health: 20, points: 100, noise: 'hiss', color: [175, 170, 185], staySeconds: [9, 11] },
    spider: { behaviour: 'webber', speed: 32, health: 5,  points: 0,   noise: 'skitter', color: [196, 120, 230], textSize: 1.6 },
  },

  // What a spider does to the unit it reaches.
  cobwebs: {
    seconds: 15,         // how long the unit stays webbed
    slow: 0.7,           // speed and shooting speed are cut by this fraction (0.7 = 70% slower)
    reach: 1,            // % of screen: how close the spider must get to the unit's word
    word: 'COBWEBS',
    textSize: 1.5,       // % of screen
    color: '#d8d8e0',
  },

  // Trees and bushes. They grow in at random, soak up bullets, and give no points.
  //   size is font size in % of screen; it grows from startSize to maxSize over growSeconds.
  //   health grows with size: a full-grown plant has `health`, a sapling proportionally less.
  plants: {
    startCount: 10,         // fully grown plants on the battlefield when the game starts
    spawnEvery: [7.5, 17.5], // seconds between new plants (random in this range)
    maxPlants: 16,
    letterSpacing: -0.12,
    minGap: 17,             // % of screen to keep between new plants
    //   yRange: where the plant can appear, as fractions of battlefield height
    //   (trees start lower so their branches don't poke off the top).
    //   damagedColor: what the main word fades toward as it takes damage.
    types: {
      TREE: { weight: 1,   vertical: true,  startSize: 0.6, maxSize: 7, growSeconds: 90, health: 60, color: [150, 102, 58], damagedColor: [72, 62, 54], yRange: [0.3, 0.86], breakNoise: 'CRACK',
        // Each entry is rolled separately when the tree breaks, so both can appear.
        // minGrowth: the tree must be more than this fraction of full size.
        releases: [
          { animal: 'possum', chance: 1,   minGrowth: 0.75 },
          { animal: 'spider', chance: 0.3, minGrowth: 0 },
        ] },
      BUSH: { weight: 1.5, vertical: false, startSize: 0.5, maxSize: 4, growSeconds: 50, health: 30, color: [74, 132, 56],  damagedColor: [125, 92, 52], yRange: [0.1, 0.88], breakNoise: 'snap',
        releases: [
          { animal: 'spider', chance: 0.75, minGrowth: 0 },
        ] },
    },
    // Decoration only: BRANCHes and LEAFs can't be hit and take no damage.
    // Sizes are fractions of the plant's own font size, so they grow with it.
    decor: {
      branchColor: [168, 118, 70],
      leafColor: [104, 190, 76],
      treeBranches: [2, 3],     // how many BRANCHes come out of the top of a TREE
      branchSize: 0.42,
      branchAngle: [25, 55],    // degrees either side of straight up
      leavesPerBranch: [3, 4],
      leafSize: 0.28,
      leafFan: 75,              // degrees either side of the branch that leaves fan out
      bushLeaves: [2, 3],       // LEAFs sprinkled along the top of a BUSH
      bushLeafSize: 0.34,
    },
    // When a plant breaks, its BRANCHes and LEAFs fall to the ground as debris.
    // Debris is decoration only: it can't be hit and doesn't block bullets.
    debris: {
      max: 80,             // most debris words on the ground at once; the oldest go first
      scatter: [0.3, 0.9], // how far pieces land from the plant, as a fraction of its word length
      extraLeaves: [1, 3], // a few loose leaves on top of the plant's own
      fallSeconds: 0.35,   // how long pieces take to tumble into place
      fade: 0.45,          // how far the colour fades toward the plant's damaged colour
      alpha: 0.75,         // debris is drawn a little see-through so it reads as background
    },
  },

  colors: {
    background: '#0d110c',
    player: '#ffe14d',
    ai: '#ff9a3c',
    barrel: '#ffd08a',
    animal: [158, 228, 147],     // healthy
    animalHurt: [255, 70, 50],   // nearly dead
    bullet: '#e8e8e8',
    boom: '#ff5a36',
    noise: '#c9f2c1',
    points: '#ffe14d',
    highlight: '#ffffff',
  },
};
