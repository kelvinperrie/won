// The advisers who pop up in the bottom-left with unhelpful remarks.
// Portraits are drawn as 16x16 pixel art from the `look` settings below.
//
//   look.hair: 'short' | 'bald' | 'bob' | 'flattop' | 'bun'
//   lines:     things they say at random. {points} and {destroyed} are filled in.
//   on:        things they say when something happens. {name} is filled in.
//   eventOnly: never pipes up at random; only speaks for their `on` events
//              (e.g. Knockoff Spidey, who only turns up when a unit is webbed).
//   look.mask: a masked face (big eye lenses, no hair or mouth) instead of a normal one;
//              look.skin is the mask colour and look.maskLines the web lines drawn on it.

const ADVISERS = {
  spidey: {
    name: 'Knockoff Spidey',
    title: 'Web Safety Officer',
    eventOnly: true,
    look: { skin: '#c8282e', hair: 'none', hairColor: '#c8282e', suit: '#2a4aa8', tie: '#c8282e', glasses: false, mask: true, maskLines: '#5a1014' },
    lines: [],
    on: {
      webbed: [
        '{name}, you\'ve been webbed! Moving and shooting at a crawl. Don\'t say I didn\'t warn you.',
        'Webbed again, {name}? My spider sense says you\'re terrible at this.',
        'THWIP! That\'s the sound of {name} getting webbed. Hold still, it builds character.',
        'Citizen {name}! You are covered in COBWEBS. This is a teachable moment.',
        'With great firepower comes great responsibility to look out for spiders, {name}.',
      ],
    },
  },
  finance: {
    name: 'Gordon Pillsbury',
    title: 'Finance Adviser',
    look: { skin: '#e8b994', hair: 'bald', hairColor: '#8a7a6a', suit: '#5a6070', tie: '#a03030', glasses: true },
    lines: [
      'I have run the numbers. They are mostly zeros, but in a good order.',
      'Every rabbit is a small, furry liability. Remove liabilities.',
      'We have {points} points. I recommend we have more.',
      'Interest rates are up. I am not sure what that means for us. Possibly nothing.',
      'I have balanced the budget. It fell over again while I was getting coffee.',
      'Accounting has classified the deer as "assets with legs".',
      'Buy low, sell high. Not sure how that applies here, but it never hurts to say.',
    ],
    on: {
      buyUnit: ['Another {name}? Bold. Irresponsible, but bold.'],
    },
  },
  pr: {
    name: 'Darlene Fesk',
    title: 'Public Relations',
    look: { skin: '#f0c8a8', hair: 'bob', hairColor: '#c04a2a', suit: '#a83848', tie: null, glasses: false, earrings: true },
    lines: [
      'Polls show 0% of rabbits approve of us. Margin of error: also 0%.',
      'Let\'s not call it "destroying nature". Let\'s call it "nature rightsizing".',
      'Press release drafted: "Things Are Happening". Thoughts?',
      'A journalist asked what we stand for. I said "yes" and hung up.',
      'Our new slogan: "Trees: Who Needs Them?" It tested well with no one.',
      'The pigs are trending. Not in a good way. For the pigs.',
      'Remember, there are no bad headlines. Only headlines.',
    ],
    on: {
      unlockLure: ['Great news, {name}s are now coming to us! I\'ll spin it as "outreach".'],
    },
  },
  outdoors: {
    name: 'Hank Bristle',
    title: 'Outdoor Activities',
    look: { skin: '#d49a70', hair: 'flattop', hairColor: '#3a2a1a', suit: '#4a6a3a', tie: '#c89a30', glasses: false, mustache: true },
    lines: [
      'Saw a squirrel earlier. Didn\'t like the look of it.',
      'Back in my day we hunted with sticks. Then we hunted the sticks.',
      'Ever notice how deer just... stand there? Suspicious.',
      'Tip: animals are easier to hit when they\'re where you\'re aiming.',
      'The bears respect me. I can feel it. Somewhere deep.',
      'Wind\'s coming from the north. Or it\'s just me breathing. Hard to say.',
      'A moose is basically a horse that made bad choices.',
      'Never trust a mole. Anything that lives underground and wears velvet is up to something.',
    ],
    on: {
      unlockLure: ['{name}s, eh? I\'ve been waiting my whole life for this. Or since Tuesday.'],
      buyUnit: ['A {name}! Finally someone who listens to me.'],
    },
  },
  environment: {
    name: 'Dr. Ingrid Moss',
    title: 'Environmental Adviser',
    look: { skin: '#c88a64', hair: 'bun', hairColor: '#2a2420', suit: '#6a5038', tie: null, glasses: true },
    lines: [
      'I\'d like to formally register my concern. There. It\'s registered.',
      'Nature destroyed so far: {destroyed}. I\'ve stopped crying at the number. Mostly.',
      'Did you know trees make oxygen? No reason. Just a fun fact.',
      'I have filed a report. It is now underneath several other reports.',
      'The bushes have filed a complaint. I\'m handling it personally.',
      'I was hired to advise. Nobody said anyone had to listen.',
      'Somewhere a bee is very disappointed in all of us.',
    ],
    on: {
      unlockLure: ['Oh good. {name}s. I\'ll update the endangered list in pencil.'],
    },
  },
  safety: {
    name: 'Terry Vandersloot',
    title: 'Health & Safety',
    look: { skin: '#f4d4b4', hair: 'short', hairColor: '#d8b850', suit: '#3a5a90', tie: '#e0e0e0', glasses: false },
    lines: [
      'Reminder: point the BULLET end away from the MAN end.',
      'It has been 0 days since our last incident. A new record, sort of.',
      'Please stay hydrated. Explosions are very dehydrating.',
      'I put up a sign that says "Caution". Caution of what? Yes.',
      'Hard hats are mandatory. Nobody has one. I\'ve made a note.',
      'Our safety rating is "technically legal". Let\'s keep it that way.',
      'Don\'t run with scissors. Or rabbits. Especially both.',
    ],
    on: {
      buyUnit: ['A new {name}. I\'ll need them to watch a 4-hour safety video.'],
    },
  },
};
