# WON: War On Nature, Requirements

## 1. Overview

**War On Nature (WON)** is a tongue-in-cheek idle clicker game played in the browser. The player controls a man who hunts animals as they wander onto the screen. Each kill earns points, which the player spends on upgrades, on extra units that hunt by themselves, and on lures that bring in more (and different) animals. The goal is to destroy as much nature as possible.

The game is **endless**. There is no win condition or final goal; the player just keeps pushing the "Amount of Nature Destroyed" number higher.

The joke: nature is awesome, but people tend to treat it as an adversary. The tone should be light and satirical.

## 2. Platform

- A **browser game** built with HTML, CSS and JavaScript.
- Runs in modern desktop browsers (Chrome, Edge, Firefox).
- Needs a keyboard and a mouse.

## 3. Visual Style

- **Everything is text.** No images or sprites. Each entity is drawn as the word for what it is.
  - The player's man is drawn as `MAN1`.
  - A rabbit is drawn as `rabbit`, a pig as `pig`, and so on. Each animal can have its own text size; rabbits are drawn smaller than the others because they're small animals.
  - Each animal has its own colour: **rabbits green, pigs pink, deer brown, moose grey-brown, bears white, ferrets golden.** The same colour is used for the animal's name in the shop's lure list.
  - The tank is drawn as `TANK1` with the word `BARREL` on top of it, and fires `SHELL`s (see 5.5).
  - Trees are drawn as `TREE` and bushes as `BUSH` (see 6.5).
  - Letters in unit, animal and plant words are squished slightly closer together than normal.
  - A bullet is drawn as the word `BULLET` in **very small text**, much smaller than the unit and animal words. Like every moving entity, it rotates so its first letter faces the direction it is flying.
  - An explosion is drawn as the word `BOOM`, sized to match the bullet's **power** (explosion radius), so a bigger blast shows a bigger `BOOM`. It appears where the bullet hits, lasts a fraction of a second (about 0.3 s), and fades out.
- **Rotation:** as an entity moves, its word rotates so that the **left side of the word (the first letter) faces the direction of travel**. The word "leads" with its first letter.
  - Example: a rabbit moving straight down is drawn vertically, with `r` at the bottom and `t` at the top.
  - An entity that is not moving keeps its last facing.
  - **`MAN` labels turn smoothly** rather than snapping: when a `MAN` changes direction, its word rotates quickly (720° per second, so a full about-turn takes a quarter of a second) to face the new way. This applies to the player's `MAN1` and AI `MAN`s. Only the word turns gradually; the unit's movement changes direction instantly.
- Player units and animals should be easy to tell apart (e.g. different colours, or uppercase for player units and lowercase for animals).
- **Unit numbering:** every player unit is drawn with its type name followed by a number, so each unit can be told apart and upgraded on its own (see 5.1).
- The player-controlled `MAN1` should also look different from AI-controlled units (e.g. a different colour) so the player can always find themselves.

## 4. Play Area and Screen Scaling

- The game uses the **whole browser window**. The shop is a fixed panel on the right, and the **battlefield fills the rest of the window to its left**. Nothing on the battlefield ever goes behind the shop. The score and points display sits over the top-left corner of the battlefield.
- When the window is resized, the battlefield resizes with it.
- "Screen" in the rest of this document means the battlefield area, not the whole window.
- **All distances are relative to the screen size**, so the game is no harder or easier on a bigger screen:
  - **Range** is a percentage of the screen (e.g. range 20% means a unit can shoot 20% of the way across the screen).
  - "Screen size" here means the **shorter side** of the window (usually the height), so range is the same in every direction and ultrawide screens get no advantage.
  - The same rule applies to **power** (explosion radius) and to **movement speeds** (measured in percent of the screen per second), so everything keeps the same proportions at any window size.
- The player's `MAN1` starts at the **bottom middle** of the screen.
- Animals enter from **random positions along the left, right, and top edges** of the screen.

## 5. Player Units

### 5.1 Starting State and Unit Naming
- The game starts with **one player-controlled `MAN1`** at the bottom middle of the screen.
- There are **no AI units** at the start.
- **Units are numbered by type, in the order they are bought:**
  - `MAN1` is the player's man and is always controlled by the player.
  - `MAN2`, `MAN3`, … are bought later and are AI-controlled.
  - Other unit types are numbered the same way and count from 1 for each type (e.g. `TANK1`).
- A unit's number is its label everywhere: on the battlefield, in the shop, and in the save file.

### 5.2 Unit Attributes

| Attribute       | Description |
|-----------------|-------------|
| Speed           | How fast the unit moves, in % of screen per second. |
| Shooting speed  | How often the unit can fire a bullet (fire rate / cooldown). |
| Range           | How far a bullet can travel, as a % of the screen. |
| Damage          | How much damage a bullet does to the animal it hits. |
| Power           | Explosion radius of the bullet on impact, as a % of the screen. Every animal inside the radius takes damage, so one bullet can kill several animals. |

All attributes can be upgraded by spending points, **up to a maximum level of 8 each** for a `MAN` (6 for the `TANK` and `ARTILLERY`). Once an attribute reaches its maximum level its upgrade button shows "MAX" and can't be bought. A save with a level above the maximum is capped when it loads.

| `MAN` attribute | Level 0 | Each level adds | Level 8 (max) |
|-----------------|---------|-----------------|---------------|
| Speed           | 14% of screen/s | 2.5 | 34% of screen/s |
| Shooting speed  | 1 shot/s | 0.25 | 3 shots/s |
| Range           | 32% of screen | 2.5 | 52% of screen |
| Damage          | 1 | 1 | 9 |
| Power           | 2% radius | 1 | 10% radius |

**Upgrades are per unit.** Each upgrade applies to one unit only. Upgrading `MAN2`'s range has no effect on `MAN1` or `MAN3`.
- Every unit tracks its own level for each attribute.
- Upgrade costs go up separately for each unit and each attribute. Upgrading `MAN1`'s damage makes `MAN1`'s next damage upgrade cost more, but doesn't change what `MAN2`'s damage upgrade costs.
- A newly bought unit starts at the base stats for its type (level 0 in every attribute).

### 5.3 The Player-Controlled MAN1
- **Moving:** the player moves `MAN1` with **W A S D** (up, left, down, right). Diagonals work (e.g. W + D moves up and to the right) at the same speed as straight lines.
- `MAN1` can't leave the screen.
- **Shooting:** clicking the mouse fires a bullet from `MAN1` toward the cursor.
  - A click **always fires**, even if there is no animal under the cursor. Aiming is up to the player.
  - Bullets can only be fired as fast as the **shooting speed** allows. Clicks during the cooldown do nothing.
  - Holding the mouse button down fires over and over at the shooting-speed rate.
  - A bullet flies toward where the cursor was when it was fired. It explodes when it hits an animal or plant, or when it **reaches the point that was aimed at**, whichever comes first. If the cursor was further away than `MAN1`'s **range**, it explodes at the range limit instead. (AI units' bullets fly their full range.)
  - **Aim circle:** while the cursor is over the battlefield, a yellow circle shows where the next shot will explode, sized to `MAN1`'s **Power** (blast radius), with a small cross at its centre. If the cursor is further from `MAN1` than its range, the circle is drawn at the range limit along the line to the cursor, and is dashed and dimmer to show the shot won't reach the cursor. The circle grows as Power is upgraded and reaches further as Range is upgraded.
- `MAN1`'s word rotates to face the direction he moves, the same as every other entity.

### 5.4 AI Units (Bought)
- The player can **buy more `MAN`s** with points. Bought `MAN`s (`MAN2`, `MAN3`, `MAN4`) are controlled by the computer.
- **The player can own at most 3 AI `MAN`s** (4 `MAN`s in total including `MAN1`). Once the limit is reached, the shop shows the buy button as disabled with "limit reached".
- The player can also buy **one `TANK`** (see 5.5) and **one `ARTILLERY`** (see 5.6).
- New AI units appear at the bottom middle of the screen.
- **AI behaviour:**
  1. Find the **closest living animal**.
  2. Move toward it.
  3. When the animal is **within range**, stop and shoot. AI units aim where the animal is heading, but their **aim is slightly off** (a random error of up to a few degrees either side), so some shots miss, especially at long range.
  4. Keep shooting that animal until it is dead. **While shooting, the unit shuffles slowly** (about a third of its normal speed, picking a new direction every half second to a second or so) so AI units don't end up stacked on top of each other:
     - The shuffle direction is random but **within 90° of the direction it's shooting**, so it never drifts out of range.
     - If it gets closer than half its range to the target, it shuffles within 90° of **directly away** from the target instead, so units don't all close in on the same animal.
     - If another unit is very close, it leans as far away from that unit as those limits allow.
     - Once a unit is in range (90% of its range), it only goes back to chasing if the target gets clearly out of range (beyond 95%). This buffer stops it flickering between chasing and shuffling at the edge of its range.
  5. When it dies, go back to step 1.
  6. If there are no animals on screen, wait in place.

### 5.5 The TANK
- The player can own **a single `TANK`**, drawn as `TANK1`. It costs 400 points, and once bought the shop shows "limit reached".
- It is AI-controlled, **powerful but slow**: big damage and blast radius, long range, but it moves slowly and fires slowly.
- **Turning:** the tank can't change direction instantly. To head somewhere new it **stops and rotates on the spot** (45° per second) until it faces the right way, then drives forward. The `TANK1` word turns with it, following the usual rotation rule.
- **Barrel:** the word `BARREL` sits on top of the tank, sticking out from its centre in the direction it's aimed, with the first letter at the tip. The barrel **turns independently of the tank** (140° per second) and can point in any direction. It has a dark outline so it stays readable over the `TANK1` word.
- **Shooting:** the tank fires a **`SHELL`** out of the end of the barrel instead of a `BULLET`. A shell behaves exactly like a bullet (same speed, range, damage and explosion rules). The tank only fires once the barrel is lined up with its target, and its aim has the same slight error as other AI units.
- **Behaviour:** like other AI units, it locks on to the closest animal and keeps firing at it until it dies. It turns and drives toward the target until it's in range, and aims the barrel the whole time. It doesn't shuffle while shooting.
- It has the same five attributes as a `MAN`, but each has a **maximum level of 6** (not 8):

| `TANK` attribute | Level 0 | Each level adds | Level 6 (max) |
|------------------|---------|-----------------|---------------|
| Speed            | 5% of screen/s | 0.75 | 9.5% of screen/s |
| Shooting speed   | 0.35 shots/s | 0.08 | 0.83 shots/s |
| Range            | 45% of screen | 3 | 63% of screen |
| Damage           | 6 | 3 | 24 |
| Power            | 6% radius | 1.5 | 15% radius |

### 5.6 The ARTILLERY
- The player can own **a single `ARTILLERY`**, drawn as `ARTILLERY1`. It costs 900 points, and once bought the shop shows "limit reached".
- It works **exactly like the TANK** (the same `BARREL` that turns independently at 140° per second, fires `SHELL`s once lined up, same slight aim error), **except it can't move at all**.
- It appears in the **centre of the battlefield** and stays there. Its body never turns: the `ARTILLERY1` word lies flat and reads left to right, with its letters squished together more tightly than other unit labels. Only the barrel turns.
- Because it can't chase, it only targets animals **within its range**: it keeps firing at its current target while that target is in range, and otherwise switches to the closest animal in range. With nothing in range it waits.
- It has **no Speed attribute**. Its other four attributes have a **maximum level of 6**, like the TANK:

| `ARTILLERY` attribute | Level 0 | Each level adds | Level 6 (max) |
|-----------------------|---------|-----------------|---------------|
| Shooting speed        | 0.35 shots/s | 0.08 | 0.83 shots/s |
| Range                 | 55% of screen | 4 | 79% of screen |
| Damage                | 6 | 3 | 24 |
| Power                 | 6% radius | 1.5 | 15% radius |

- Spiders can web it, but since it never moves, only its shooting speed is slowed.

### 5.7 Bullets
- Each bullet travels in a straight line from the shooter.
- Bullets fly at a fixed speed that is **slow enough that a moving animal can get out of the way**, so shots at moving targets can miss.
- On impact it deals **damage** to the animal it hits and applies **power** (explosion radius) damage to every animal within that radius.
- A bullet that reaches its range without hitting anything explodes where it stops.

## 6. Nature (Animals)

### 6.1 Animal Attributes

| Attribute | Description |
|-----------|-------------|
| Name      | The type of animal (e.g. `rabbit`). This is also the word drawn on screen. |
| Speed     | How fast the animal moves, in % of screen per second. |
| Noise     | The noise the animal makes (e.g. rabbit: "squeak"). Shown as floating text (see 6.3). |
| Points    | Points awarded to the player for killing it. |
| Health    | How much damage it takes to kill the animal. |

### 6.2 Spawning (Lures)
- Animals spawn based on the **lures** the player owns.
- Each lure belongs to one animal type.
- **1 lure spawns 1 animal of its type every 10 seconds**, except for **rabbits, which spawn twice as fast: every 5 seconds per lure.** Each animal type can have its own spawn time in the config.
- **Owning more lures of a type makes that animal spawn more often.** The spawn interval is `spawn time ÷ number of lures`:
  - 1 rabbit lure = 1 rabbit every 5 s
  - 2 rabbit lures = 1 rabbit every 2.5 s
  - 2 pig lures = 1 pig every 5 s
- The player starts with **1 rabbit lure**, so at first only rabbits appear.
- New animal types are unlocked by **buying their first lure** with points.
- Spawned animals enter from a random point on the left, right, or top edge.

### 6.3 Animal Behaviour
- Animals walk in from their edge until they are fully on screen, then **wander** around the play area, changing direction gradually.
  - **Now and then an animal makes an abrupt change of direction** (every 3–8 seconds, turning 60–180° left or right at random), so its movement is harder to predict and lead.
- **Animals can't escape.** Once on screen, they bounce off the edges and stay until they are killed.
- **There's a cap on how many animals can be on screen at once** (60 to start, set in the config). While the cap is reached, spawning pauses and carries on when an animal dies.
- Animals make their noise, shown as floating text near the animal: when they spawn, now and then while wandering, and when they die.
- A damaged animal's word shifts in colour toward red, showing how hurt it is without a health bar.
- **Nature is defenceless.** Animals never attack or harm the player's units.

### 6.4 Starting Animal Roster (starting values, to be tuned in playtesting)

Speeds are in % of screen per second. "Lure cost" is the price of the first lure (for rabbit, of the second, since one is owned at the start). Each further lure of the same type costs 1.4× the one before.

| Animal  | Speed | Health | Points | Noise    | Spawn time per lure | Lure cost |
|---------|-------|--------|--------|----------|---------------------|-----------|
| rabbit  | 14    | 1      | 1      | squeak   | 5 s                 | 1 owned at start; extra lures from 5 |
| pig     | 7     | 4      | 6      | oink     | 10 s                | 60 |
| deer    | 22    | 6      | 15     | bleat    | 10 s                | 300 |
| moose   | 10    | 16     | 40     | bellow   | 10 s                | 750 |
| bear    | 6     | 30     | 80     | roar     | 10 s                | 1,500 |
| ferret  | 30    | 8      | 150    | dook     | 10 s                | 3,000 |

The moose is drawn in larger text than the other animals, because it's a big animal.

### 6.5 Trees and Bushes
- **The game starts with 10 fully grown trees and bushes** already on the battlefield (also after Reset Progress, and after reloading a save).
- After that, every so often (a random 7.5–17.5 seconds), a **tree or bush starts growing** at a random spot on the battlefield, away from other plants. There are at most 16 plants at once.
- **The battlefield is never bare for long:** if there are no trees or bushes left, a new one **starts growing immediately**, without waiting for the usual timer. The timer then restarts.
- **Trees** are drawn as `TREE` in **brown**, standing **vertically with the `T` at the top**.
  - A couple (2–3) of smaller **`BRANCH`** words come out of the top of the trunk at slightly random angles, fanning upward and outward.
  - At the tip of each branch, several (3–4) small green **`LEAF`** words fan out like a spray.
- **Bushes** are drawn as `BUSH` in **green**, lying **horizontally** and reading normally, left to right, with a sprinkling (2–3) of small green **`LEAF`** words along the top.
- Every plant's branches and leaves are random, so no two look quite the same. They are sized relative to the plant, so they grow with it.
- **Branches and leaves are decoration only.** The hit box is just the main `TREE` or `BUSH` word. Bullets pass straight through branches and leaves, and they take no damage.
- Plants **start tiny and grow** over time to a maximum size. A tree takes about 90 seconds to reach full size and a bush about 50 seconds. Trees grow bigger than bushes.
- Plants don't move.
- **Bullets hit plants.** A bullet that runs into a plant explodes there, and explosions damage plants within their radius, the same as animals. Plants get in the way of shots, so they act as cover for animals.
- Plants **can take a lot of damage before breaking**. A full-grown tree takes 60 damage and a full-grown bush 30, against a rabbit's 1. A plant that is still growing breaks more easily, in proportion to its size.
- As a plant takes damage, it withers: a tree fades from brown toward charcoal grey, a bush from green toward brown, and its branches and leaves fade with it.
- When a plant breaks it disappears with a floating "CRACK" (tree) or "snap" (bush).
- **Debris:** a broken plant leaves its `BRANCH` and `LEAF` words (plus 1–3 loose leaves) lying on the ground around where it stood, so the battlefield doesn't end up bare late in the game.
  - The pieces tumble from where they were on the plant to a random spot nearby, landing at random angles, in slightly faded colours and a little see-through.
  - Debris is **decoration only**: it's drawn underneath everything else, can't be hit, and doesn't block bullets.
  - At most **80 debris words** are on the ground at once. When a new break goes over the limit, the **oldest debris is removed** first.
  - Debris isn't saved, and is cleared on Reset Progress.
- **Breaking a plant gives no points** and doesn't add to "Amount of Nature Destroyed".
- **Possums:** when a **tree** that is **over 75% grown** breaks (not a bush, and not a young tree), a `possum` jumps out where the tree was, with a "hiss".
  - A possum has **20 health** and is worth **100 points**. It is grey, and it wanders like any other animal (sudden turns included) and can be hunted by AI units.
  - It **stays for about 10 seconds** (9–11), then runs straight for the nearest edge. Once it's fully off screen it's removed from the game, with no points.
  - Possums have **no lures**; breaking trees is the only way to get them. They don't count against the animal cap.
- **Spiders:** when **any tree** breaks (any size), there's a **30% chance** a `spider` comes out too, rolled separately from the possum, so both can appear. When **any bush** breaks, there's a **75% chance** of a spider.
  - A spider has **5 health**, is **fast** (32% of screen per second, the fastest creature), is purple, and is worth **no points** when killed (no "+0" is shown, and it doesn't add to Nature Destroyed).
  - It runs straight at the **nearest unit** (the player's MAN1 or any AI unit, including the TANK), with no wandering.
  - When it gets close enough, that unit is **covered in COBWEBS**: the word `COBWEBS` is drawn across it at a slant (fading out at the end), with a floating "webbed!". For **15 seconds**, the unit's **speed and shooting speed are cut by 70%**. Getting webbed again restarts the 15 seconds.
  - Once it has webbed a unit, the spider **runs off the nearest edge** and is removed from the game. It can still be shot on the way out.
  - Spiders have no lures and don't count against the animal cap.
- AI units never target plants; they only hunt animals.
- Plants aren't saved; after loading, the battlefield gets a fresh set of 10 fully grown plants.

## 7. Economy and Progression

- **Points:** earned by killing animals, whoever kills them (the player or an AI unit). Spent on upgrades, units and lures.
- **Score: "Amount of Nature Destroyed":** a running total that never goes down when points are spent. Shown on screen at all times.
- **Things to buy:**
  - Upgrades to an attribute (speed, shooting speed, range, damage, power) of one specific unit.
  - Extra `MAN`s (AI-controlled), up to 3. **Each extra `MAN` costs more than the one before.**
  - One `TANK` (400 points).
  - One `ARTILLERY` (900 points).
  - A first lure for a new animal type (unlocks that animal).
  - Extra lures for an animal type the player already has (that animal spawns more often).
- Costs go up with each purchase (e.g. multiply by a fixed factor each time) so progress keeps feeling earned.

## 8. User Interface

- **Battlefield:** fills the window to the left of the shop.
- **Score display:** "Amount of Nature Destroyed: N".
- **Points display:** current points available to spend.
- **Shop:** a panel listing everything the player can buy (upgrades, units, lures), showing each item's current level or count, its next cost, and a buy button. Buttons are disabled when the player can't afford them.
  - **Unit upgrades:** the shop lists the player's units by label (`MAN1`, `MAN2`, …). The player picks a unit, sees its current stats and levels, and buys upgrades for it.
  - Units are picked from the shop list, not by clicking them on the battlefield, because clicking the battlefield shoots.
  - The unit picked in the shop is highlighted on the battlefield with a white glow, keeping its normal colour, so the player can see which one they are upgrading.
- The shop is a **permanent panel on the right** of the window. It is always visible and can't be closed. The battlefield sits beside it, never behind it. The mouse is used for shooting, so clicking in the shop must **not** also fire a bullet.
- **Controls hint:** a short line on screen reminds the player: WASD to move, click to shoot.
- Text-only style throughout, to match the battlefield. The one exception is the advisers' pixel-art portraits (below).
- **Adviser popups:** toast-style popups appear in the **bottom-left** of the battlefield. Each shows a small pixel-art portrait of an adviser, their name and job title, and an inane remark.
  - The advisers are an original cast of bureaucrats (Finance, Public Relations, Outdoor Activities, Environment, Health & Safety), in the spirit of classic city-builder advisers.
  - A random adviser pipes up every 18–40 seconds or so. Some remarks mention the current points or Nature Destroyed.
  - Advisers also comment when the player unlocks a new animal's lure or buys a new unit.
  - New popups appear at the bottom and **stack upwards**, pushing older ones up. Up to 4 are shown at once; each disappears after about 9 seconds, or when clicked. Clicking a popup never fires a bullet.
  - Advisers, their looks and their lines live in `js/advisers.js`; timings are in the config.
- **Side panel tabs:** the right-hand panel has two tabs, **SHOP** and **ACHIEVEMENTS**. SHOP is shown by default. Reset Progress stays at the bottom under both tabs.
- **Achievements:**
  - Earned achievements pop up in the bottom-left **the same way as adviser remarks**, stacking with them, but with a pixel-art trophy instead of a face, an "ACHIEVEMENT UNLOCKED" heading and a gold accent.
  - The ACHIEVEMENTS tab lists **only the achievements earned so far**, newest first, each with its trophy, title, description and the date it was earned, plus a count ("5 of 14 unlocked").
  - Each achievement is earned once and kept. Achievements, kill counts and the player's shot count are saved; Reset Progress wipes them.
  - The achievements:
    - **First kill of each animal type** (including possums and spiders): "Hello rabbit, Goodbye rabbit", etc.
    - **15 kills of each animal type**: "Rabbit Exterminator", etc. Any unit's kill counts.
    - **Have 3 MANs** (MAN1 plus two hired MANs): "Three's a Crowd".
    - **The player personally fires 100 bullets** (shots by AI units don't count): "Trigger Happy".
  - Per-animal achievements are generated from the animal config, so a new animal type gets them automatically.

## 9. Saving Progress

- Progress is saved in the browser's **local storage**, so closing the tab or browser and coming back carries on where the player left off.
- **What is saved:**
  - Points and the "Amount of Nature Destroyed" score.
  - Every unit the player owns: its label (`MAN1`, `MAN2`, …), type, and level in each attribute.
  - Every lure the player owns and how many of each.
  - Achievements earned (and when), kills per animal type, and how many bullets the player has fired personally.
- **What is not saved:** where things are on the battlefield in the moment (animals on screen, bullets in flight, unit positions). On loading, units start back at the bottom middle, the battlefield starts with no animals and a fresh set of 10 fully grown plants, then animals spawn as normal.
- **When it saves:** automatically every few seconds (e.g. every 5 s), straight after every purchase, and when the page is closed.
- The save includes a version number, so a later update to the game can still load older saves.
- **No offline progress.** Points are only earned while the game is open and running in the browser. Nothing is earned while the game is closed, and loading a save never adds points for the time away.
  - Browsers slow down or pause pages in background tabs, so the game may run slowly or stop while its tab is hidden. That's expected and fine. The game picks up again when the tab comes back, without awarding catch-up points.
- A **Reset Progress** option in the UI wipes the save and starts a new game. It asks the player to confirm first.

## 10. Non-Functional Requirements

- Runs smoothly (about 60 fps) with many animals on screen.
- Game tuning values (speeds, ranges, costs, spawn rates, animal stats) live in one config file so they are easy to balance.

## 11. Open Questions

1. **More unit types:** `MAN`, `TANK` and `ARTILLERY` exist. Are there others to add (e.g. a `SNIPER` with long range)?
