/*
 * Topic pools. Each entry is [area, prompt].
 * The `area` shows as a small tag above the topic.
 * Add, remove or reword freely — ids are derived from the prompt text.
 */

const physics = [
  // Superposition (9702 · 8)
  ['Superposition', 'The double-slit experiment: how can a single particle, fired on its own, interfere with itself?'],
  ['Superposition', 'How does a diffraction grating split starlight into a spectrum precise enough to reveal what distant stars are made of?'],
  ['Superposition', 'Standing waves: how does a guitar string “choose” which notes it is allowed to play?'],
  ['Superposition', 'Noise-cancelling headphones: how can adding more sound make the world quieter?'],
  ['Superposition', 'How did Thomas Young measure the wavelength of light in 1801, and why did his result challenge Newton?'],
  ['Superposition', 'Why does blowing across the top of a bottle produce a note, and what decides its pitch?'],
  ['Superposition', 'Can you measure the speed of light with a microwave oven and a bar of chocolate?'],
  ['Superposition', 'Where do the shifting colours on a soap bubble come from?'],
  ['Superposition', 'Why does sound bend around corners so easily, when light seems to travel only in straight lines?'],

  // Waves (9702 · 7)
  ['Waves', 'The Doppler effect: how do a passing siren and a redshifted galaxy tell the same story?'],
  ['Waves', 'Why do polarised sunglasses cut the glare off water, and what does that prove about the nature of light?'],
  ['Waves', 'Why can radio waves pass through the walls of your house when visible light cannot?'],
  ['Waves', 'How do earthquake waves reveal that the Earth has a liquid outer core we can never visit?'],
  ['Waves', 'The Michelson–Morley experiment: how did the most famous “failed” experiment in physics kill the aether?'],

  // Particle physics (9702 · 11)
  ['Particle physics', 'Rutherford’s gold foil experiment: what did a handful of bouncing alpha particles reveal about the atom?'],
  ['Particle physics', 'Why can you never pull a single quark out on its own?'],
  ['Particle physics', 'Beta decay’s missing energy: why did Pauli have to invent the neutrino to save conservation of energy?'],
  ['Particle physics', 'If the Big Bang made matter and antimatter in equal amounts, why does anything exist at all?'],
  ['Particle physics', 'Why is a lone neutron unstable, yet neutrons locked inside nuclei can last for billions of years?'],
  ['Particle physics', 'Why can a sheet of paper stop alpha radiation, yet alpha is the most dangerous kind if swallowed?'],
  ['Particle physics', 'Neutrinos: how do trillions of them pass through your body every second without anything happening?'],

  // Quantum physics
  ['Quantum physics', 'The photoelectric effect: why can dim ultraviolet light eject electrons when blinding red light cannot?'],
  ['Quantum physics', 'The ultraviolet catastrophe: how did blackbody radiation force Planck to invent the quantum?'],
  ['Quantum physics', 'Quantum tunnelling: how can a particle cross a barrier it doesn’t have the energy to climb, and why does the Sun depend on it?'],
  ['Quantum physics', 'Electron diffraction: what does it actually mean for an electron to have a wavelength?'],
  ['Quantum physics', 'Why does every element glow with its own unique “barcode” of colours?'],

  // Physical quantities & measurement (9702 · 1)
  ['Physical quantities', 'Why was the kilogram redefined in 2019, and what was wrong with a lump of metal in a vault near Paris?'],
  ['Physical quantities', 'Faster-than-light neutrinos: how did a loose cable fool physicists in 2011, and what does it teach us about systematic error?'],
  ['Physical quantities', 'How did G. I. Taylor estimate the energy of the first atomic bomb from nothing but a photograph?'],
  ['Physical quantities', 'Why is the speed of light now a defined number rather than a measured one?'],

  // Kinematics (9702 · 2)
  ['Kinematics', 'Galileo argued a heavy and a light object must fall together without dropping anything. How, and how did Apollo 15 settle it?'],
  ['Kinematics', 'Why does a bullet fired horizontally hit the ground at the same moment as one that is simply dropped?'],
  ['Kinematics', 'Terminal velocity: why can a mouse survive a fall down a mine shaft that would kill a horse?'],

  // Dynamics (9702 · 3)
  ['Dynamics', 'Newton’s cradle: why does exactly one ball swing out, and never two at half the speed?'],
  ['Dynamics', 'How can a rocket accelerate in the vacuum of space with nothing to push against?'],
  ['Dynamics', 'Crumple zones and airbags: how does making a crash last longer save lives?'],
  ['Dynamics', 'The ballistic pendulum: how can a block of wood hanging on strings measure the speed of a bullet?'],
  ['Dynamics', 'Why do you feel heavier in a lift that starts moving upwards, and weightless in orbit even though gravity is still there?'],

  // Forces, density & pressure (9702 · 4)
  ['Forces, density & pressure', 'Archimedes and the golden crown: how could upthrust reveal whether a king had been cheated?'],
  ['Forces, density & pressure', 'The Magdeburg hemispheres: how did air pressure alone defeat two teams of horses?'],
  ['Forces, density & pressure', 'How can a crane lift loads heavier than itself without toppling over?'],
  ['Forces, density & pressure', 'Why can’t you touch your toes with your heels pressed against a wall?'],
  ['Forces, density & pressure', 'How does a hydraulic jack let one person lift a car with one hand?'],

  // Work, energy & power (9702 · 5)
  ['Work, energy & power', 'Why does doubling your speed roughly quadruple your braking distance?'],
  ['Work, energy & power', 'Could a person on an exercise bike generate enough power to boil a kettle?'],
  ['Work, energy & power', 'Why must the first hill of a roller coaster always be the tallest?'],
  ['Work, energy & power', 'Where does all the energy go when a bouncing ball finally comes to rest?'],

  // Deformation of solids (9702 · 6)
  ['Deformation of solids', 'What happens inside a metal when it stops springing back, and why does bending a paperclip back and forth eventually snap it?'],
  ['Deformation of solids', 'Weight for weight, spider silk rivals steel. So what does “strength” actually mean?'],
  ['Deformation of solids', 'Why does a stretched rubber band warm up, and why doesn’t it give back all the energy you put in?'],

  // Electricity (9702 · 9)
  ['Electricity', 'If electrons drift through a wire at under a millimetre per second, why does a light come on instantly?'],
  ['Electricity', 'Why can a bird perch safely on a high-voltage line, while a ladder touching one can kill?'],
  ['Electricity', 'Why do old filament bulbs usually blow at the exact moment you switch them on?'],
  ['Electricity', 'Superconductors: what happens when electrical resistance drops to exactly zero?'],

  // D.C. circuits (9702 · 10)
  ['D.C. circuits', 'How does a light-dependent resistor switch on a streetlight at dusk?'],
  ['D.C. circuits', 'Why do a car’s headlights dim for a moment when the starter motor turns?'],
  ['D.C. circuits', 'Kirchhoff’s laws: which deep conservation laws are hiding inside every circuit?'],
];

const cs = [
  // Information representation (9618 · 1)
  ['Information representation', 'Two’s complement: how do computers store negative numbers, and why did “Gangnam Style” break YouTube’s view counter?'],
  ['Information representation', 'Why does 0.1 + 0.2 not equal 0.3 in most programming languages?'],
  ['Information representation', 'Lossy compression: how does a JPEG throw away most of an image without you noticing?'],
  ['Information representation', 'Lossless compression: how can a file shrink without losing a single bit, and why can’t you keep compressing it forever?'],
  ['Information representation', 'How does a computer turn a sound wave into numbers, and why is CD audio sampled 44,100 times a second?'],
  ['Information representation', 'Bitmaps vs vectors: why does a logo stay razor-sharp at any size while a photo turns to blocks?'],
  ['Information representation', 'Unicode: how did computers go from 128 characters to every writing system on Earth, plus emoji?'],
  ['Information representation', 'The Year 2038 problem: what happens when a computer’s clock runs out of bits?'],
  ['Information representation', 'Binary-coded decimal: why would anyone deliberately “waste” bits when storing numbers?'],

  // Communication (9618 · 2)
  ['Communication', 'What actually happens, step by step, between typing a web address and the page appearing?'],
  ['Communication', 'Packet switching: how does a message chopped into pieces, sent down different routes, arrive intact?'],
  ['Communication', 'The world ran out of IPv4 addresses years ago, so how is the internet still working?'],
  ['Communication', 'Peer-to-peer: how did BitTorrent move vast amounts of data with no central server at all?'],
  ['Communication', 'How do devices sharing one network cable avoid talking over each other?'],
  ['Communication', 'How does streaming video adapt to your connection in real time without stopping to buffer?'],
  ['Communication', 'Is the cloud really “just someone else’s computer”? The genuine trade-offs of cloud computing.'],

  // Hardware & logic gates (9618 · 3)
  ['Logic gates', 'How can a handful of logic gates, wired together, add two numbers?'],
  ['Logic gates', 'Why is NAND called a universal gate? Could you build an entire computer from just one kind?'],
  ['Logic gates', 'Flip-flops: how does a circuit made only of gates actually remember a single bit?'],
  ['Hardware', 'Cache, RAM, flash, disk: why does a computer need so many different kinds of memory?'],
  ['Hardware', 'How does a touchscreen know exactly where your finger is?'],
  ['Hardware', 'How does a laser printer use static electricity to put toner on paper?'],
  ['Hardware', 'How does flash memory keep your data when the power is off?'],
  ['Hardware', 'Embedded systems: how many hidden computers are in your kitchen, and why don’t they need a full operating system?'],

  // Processor fundamentals (9618 · 4)
  ['Processor fundamentals', 'Fetch, decode, execute: how does a CPU actually carry out a single instruction?'],
  ['Processor fundamentals', 'The von Neumann bottleneck: why does a modern CPU spend so much of its time waiting?'],
  ['Processor fundamentals', 'Why doesn’t doubling the clock speed double performance, and why did clock speeds stall around 2005?'],
  ['Processor fundamentals', 'Interrupts: how does a computer notice your keypress while it is busy doing something else?'],
  ['Processor fundamentals', 'Assembly language: what does code look like one step above raw binary, and why does anyone still write it?'],
  ['Processor fundamentals', 'Bit shifting: how can a computer multiply by sliding digits sideways?'],

  // System software (9618 · 5)
  ['System software', 'How does an operating system make one processor appear to run a hundred programs at once?'],
  ['System software', 'Virtual memory: how can a program use more memory than the computer physically has, and what is thrashing?'],
  ['System software', 'Compilers vs interpreters: why does the same program often run far faster in C than in Python?'],
  ['System software', 'What does an operating system actually do that an app couldn’t do for itself?'],

  // Security, privacy & data integrity (9618 · 6)
  ['Security', 'Public-key encryption: how can two strangers agree on a secret while everyone is listening?'],
  ['Security', 'Digital certificates: how does your browser know it is really talking to your bank?'],
  ['Security', 'Why should a website never be able to tell you your own password?'],
  ['Security', 'Social engineering: why is the human usually the weakest link in computer security?'],
  ['Security', 'Worms vs viruses: how did WannaCry spread across the world in a single day?'],
  ['Security', 'Parity bits and checksums: how does a computer notice that data was corrupted on the way?'],
  ['Security', 'The Enigma machine: why was it breakable, and what did its flaws teach modern cryptography?'],
  ['Security', 'Why is “password123” cracked instantly, while a long random passphrase could take centuries?'],

  // Ethics & ownership (9618 · 7)
  ['Ethics & ownership', 'Open source vs proprietary: how did free software like Linux end up running most of the world’s servers?'],
  ['Ethics & ownership', 'Who owns the work when an AI is trained on millions of copyrighted examples?'],
  ['Ethics & ownership', 'Algorithmic bias: how can a program be unfair when it is “just maths”?'],
  ['Ethics & ownership', 'Should software engineers be licensed like doctors and civil engineers?'],
  ['Ethics & ownership', 'Can you own an algorithm? Copyright, patents and licences in software.'],
  ['Ethics & ownership', 'Is it ever right for a programmer to refuse to write code their employer asks for?'],

  // Databases (9618 · 8)
  ['Databases', 'Why do databases get normalised, and when is it smart to break the rules?'],
  ['Databases', 'Primary and foreign keys: how do relational databases link millions of records without duplicating them?'],
  ['Databases', 'SQL injection: how can typing a few characters into a login box destroy an entire database?'],
  ['Databases', 'How does a database stop two people booking the same airline seat at the same instant?'],

  // Algorithms & data structures (9618 · 9, 10)
  ['Algorithms', 'Binary search: how can you find one name among a billion in about thirty steps?'],
  ['Algorithms', 'Why is bubble sort so slow, and what makes some sorting algorithms fundamentally faster?'],
  ['Algorithms', 'Big O: why does code that is instant on a hundred items grind to a halt on a million?'],
  ['Algorithms', 'Recursion: how can a function solve a problem by calling itself, and what is a stack overflow?'],
  ['Algorithms', 'The travelling salesman problem: why can’t computers simply try every route?'],
  ['Algorithms', 'Dijkstra’s algorithm: how does a sat-nav find the shortest route through millions of roads?'],
  ['Data structures', 'Stacks and queues: how does the “undo” button remember everything you did?'],
  ['Data structures', 'Arrays vs linked lists: why is inserting into the middle of a list surprisingly expensive?'],
  ['Data structures', 'Hash tables: how can a program find any item instantly without searching for it?'],

  // Programming & software development (9618 · 11, 12)
  ['Programming paradigms', 'Procedural, object-oriented, functional: just styles, or genuinely different ways of thinking?'],
  ['Programming paradigms', 'Declarative vs imperative: what does it mean that SQL describes what you want, not how to get it?'],
  ['Software development', 'Why can testing prove the presence of bugs but never their absence?'],
  ['Software development', 'The Ariane 5 explosion: how did one number that didn’t fit destroy a rocket on its first flight?'],
  ['Software development', 'The Mars Climate Orbiter: how could a spacecraft be lost to a mix-up between units, and could better types have saved it?'],
];

const general = [
  // Probability & statistics
  ['Probability', 'The Monty Hall problem: why should you always switch doors?'],
  ['Probability', 'The birthday paradox: why do just 23 people give better-than-even odds of a shared birthday?'],
  ['Statistics', 'Simpson’s paradox: how can a treatment win in every group but lose overall?'],
  ['Probability', 'The false-positive paradox: how can a 99%-accurate test be wrong most of the time?'],
  ['Probability', 'The St. Petersburg paradox: why would no one pay much to play a game with infinite expected winnings?'],
  ['Probability', 'The two envelopes problem: why does switching seem to gain you money every single time?'],
  ['Statistics', 'Benford’s law: why do so many real-world numbers start with the digit 1, and how does it catch fraudsters?'],
  ['Statistics', 'Survivorship bias: what did the bullet holes on returning WWII bombers really mean?'],
  ['Probability', 'The Sleeping Beauty problem: when she wakes, should she believe the coin landed heads with probability ½ or ⅓?'],
  ['Statistics', 'Regression to the mean: why does appearing on a magazine cover seem to jinx athletes?'],
  ['Probability', 'The boy-born-on-a-Tuesday problem: how can an irrelevant-sounding detail change a probability?'],
  ['Statistics', 'The hot-hand fallacy: can a streak ever tell you anything, and why was the “fallacy” itself challenged?'],

  // Logic, infinity & mathematics
  ['Logic', 'Gödel’s incompleteness theorems: why are some true statements impossible to prove?'],
  ['Logic', 'The halting problem: why can no program decide whether every other program will finish?'],
  ['Logic', 'Russell’s paradox: does the set of all sets that don’t contain themselves contain itself?'],
  ['Logic', 'The liar paradox: is “this sentence is false” true, false, or neither?'],
  ['Logic', 'The unexpected hanging: how can a surprise be logically impossible and still happen?'],
  ['Logic', 'The Berry paradox: what is “the smallest number that cannot be described in fewer than twelve words”?'],
  ['Infinity', 'Hilbert’s Grand Hotel: how can a completely full hotel always make room for infinitely many more guests?'],
  ['Infinity', 'Cantor’s diagonal argument: why are some infinities bigger than others?'],
  ['Infinity', 'The Banach–Tarski paradox: how can one ball be cut up and reassembled into two identical copies of itself?'],
  ['Infinity', 'Zeno’s paradoxes: how can Achilles ever overtake the tortoise?'],
  ['Infinity', 'Gabriel’s horn: how can a shape hold a finite amount of paint but need an infinite amount to coat its surface?'],
  ['Mathematics', 'The four colour theorem: why was the first major proof checked by a computer so controversial?'],
  ['Mathematics', 'The Collatz conjecture: why can no one prove a rule a child could follow?'],
  ['Mathematics', 'The coastline paradox: why doesn’t Britain have a well-defined length?'],
  ['Mathematics', 'The Riemann hypothesis: why is one statement about prime numbers worth a million dollars?'],

  // Cosmos, time & physics puzzles
  ['Cosmology', 'The Fermi paradox: if the universe is so vast and so old, where is everybody?'],
  ['Cosmology', 'Olbers’ paradox: if the universe is full of stars, why is the night sky dark?'],
  ['Cosmology', 'The anthropic principle: is the universe fine-tuned for life, or are we just the observers who got lucky?'],
  ['Cosmology', 'Boltzmann brains: why might a lone brain flickering out of the void be more likely than our entire universe?'],
  ['Time', 'The twin paradox: how can one twin return from a space voyage younger than the other?'],
  ['Time', 'The grandfather paradox: could time travel ever be logically consistent?'],
  ['Time', 'The bootstrap paradox: if information loops back through time, who ever created it?'],
  ['Thermodynamics', 'Maxwell’s demon: can a tiny, clever being break the second law of thermodynamics?'],
  ['Philosophy of physics', 'Schrödinger’s cat: was it meant to explain quantum mechanics, or to mock it?'],

  // Games, economics & society
  ['Game theory', 'Braess’s paradox: how can building a new road make everyone’s journey slower?'],
  ['Game theory', 'The prisoner’s dilemma: why do rational individuals fail to cooperate, and how does repetition change that?'],
  ['Game theory', 'Parrondo’s paradox: how can two losing games combine into a winning one?'],
  ['Game theory', 'Newcomb’s paradox: one box or two, when a near-perfect predictor has already decided?'],
  ['Economics', 'The tragedy of the commons: why do shared resources get ruined, and how did Elinor Ostrom show they don’t have to be?'],
  ['Economics', 'Goodhart’s law: why does a measure stop working the moment it becomes a target?'],
  ['Economics', 'The Jevons paradox: how can more efficient engines lead to more fuel being burned?'],
  ['Economics', 'The Keynesian beauty contest: why do markets reward guessing what everyone else will guess?'],
  ['Social choice', 'Arrow’s impossibility theorem: why can no ranked voting system be perfectly fair?'],
  ['Psychology', 'The Abilene paradox: how can a group agree to do something nobody actually wants?'],
  ['Psychology', 'The Dunning–Kruger effect: a real bias, or partly a statistical illusion?'],

  // Mind & philosophy
  ['Philosophy', 'The Ship of Theseus: if every plank is replaced, is it still the same ship?'],
  ['Philosophy', 'The teleporter problem: if you are scanned, destroyed and rebuilt on Mars, did you survive the trip?'],
  ['Philosophy', 'The trolley problem: is there a real moral difference between doing harm and allowing it?'],
  ['Philosophy', 'The Sorites paradox: when does a heap of sand stop being a heap?'],
  ['Philosophy', 'Buridan’s ass: can a perfectly rational creature starve between two identical piles of hay?'],
  ['Philosophy', 'The Library of Babel: if a library holds every possible book, does it contain any knowledge at all?'],
  ['Philosophy of mind', 'The Chinese room: can a machine that perfectly manipulates symbols actually understand anything?'],
  ['Philosophy of mind', 'Mary’s room: does a scientist who knows everything about colour learn something new when she first sees red?'],
  ['Philosophy of mind', 'Moravec’s paradox: why is it easier to build a computer that beats grandmasters than one that folds laundry?'],
  ['Epistemology', 'The problem of induction: what justifies believing the Sun will rise tomorrow?'],
  ['Epistemology', 'Hempel’s raven paradox: does seeing a green apple support the claim that all ravens are black?'],
  ['Decision theory', 'Pascal’s mugging: how should we reason about tiny chances of enormous payoffs?'],
];

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function build(category, list) {
  return list.map(([area, text]) => ({ id: `${category}-${hash(text)}`, category, area, text }));
}

export const TOPICS = {
  physics: build('physics', physics),
  cs: build('cs', cs),
  general: build('general', general),
};
