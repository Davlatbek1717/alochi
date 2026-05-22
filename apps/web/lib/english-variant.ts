/**
 * US ↔ UK English spelling equivalence (frontend copy).
 *
 * The platform teaches BOTH American and British English. Free-text answers
 * graded client-side must be accepted regardless of which variant the
 * student uses (color vs colour, organize vs organise, etc.). This module
 * normalises any English text toward the American form so exact-match
 * checks treat the two variants as identical.
 *
 * Scope is intentionally limited to *spelling* differences, which are
 * systematic and unambiguous. Vocabulary differences (lift/elevator) are
 * left to the LLM graders, which understand them in context.
 *
 * Keep this file byte-for-byte in sync with
 * `apps/api/src/ai/english-variant.ts` (the backend copy).
 */

/** Lowercase British spelling → American spelling. */
const UK_TO_US: Record<string, string> = {
  // -our → -or
  colour: 'color', colours: 'colors', coloured: 'colored', colouring: 'coloring', colourful: 'colorful',
  favour: 'favor', favours: 'favors', favoured: 'favored', favourite: 'favorite', favourites: 'favorites',
  honour: 'honor', honours: 'honors', honoured: 'honored', honourable: 'honorable',
  labour: 'labor', labours: 'labors', laboured: 'labored',
  neighbour: 'neighbor', neighbours: 'neighbors', neighbourhood: 'neighborhood', neighbourhoods: 'neighborhoods',
  behaviour: 'behavior', behaviours: 'behaviors',
  flavour: 'flavor', flavours: 'flavors', flavoured: 'flavored',
  harbour: 'harbor', harbours: 'harbors',
  humour: 'humor',
  rumour: 'rumor', rumours: 'rumors',
  odour: 'odor', odours: 'odors',
  armour: 'armor',
  parlour: 'parlor',
  saviour: 'savior',
  vapour: 'vapor',
  vigour: 'vigor',
  splendour: 'splendor',
  // -re → -er
  centre: 'center', centres: 'centers', centred: 'centered',
  theatre: 'theater', theatres: 'theaters',
  metre: 'meter', metres: 'meters',
  litre: 'liter', litres: 'liters',
  fibre: 'fiber', fibres: 'fibers',
  calibre: 'caliber',
  sabre: 'saber',
  sombre: 'somber',
  spectre: 'specter',
  // -ise/-yse → -ize/-yze
  organise: 'organize', organises: 'organizes', organised: 'organized', organising: 'organizing',
  organisation: 'organization', organisations: 'organizations',
  realise: 'realize', realises: 'realizes', realised: 'realized', realising: 'realizing',
  recognise: 'recognize', recognises: 'recognizes', recognised: 'recognized', recognising: 'recognizing',
  apologise: 'apologize', apologises: 'apologizes', apologised: 'apologized', apologising: 'apologizing',
  memorise: 'memorize', memorised: 'memorized', memorising: 'memorizing',
  emphasise: 'emphasize', emphasised: 'emphasized',
  summarise: 'summarize', summarised: 'summarized',
  analyse: 'analyze', analysed: 'analyzed', analysing: 'analyzing',
  paralyse: 'paralyze',
  // -ll- → -l-
  travelled: 'traveled', travelling: 'traveling', traveller: 'traveler', travellers: 'travelers',
  cancelled: 'canceled', cancelling: 'canceling',
  modelled: 'modeled', modelling: 'modeling',
  labelled: 'labeled', labelling: 'labeling',
  signalled: 'signaled', signalling: 'signaling',
  marvellous: 'marvelous',
  jewellery: 'jewelry',
  woollen: 'woolen',
  fuelled: 'fueled', fuelling: 'fueling',
  // -ogue → -og
  catalogue: 'catalog', catalogues: 'catalogs',
  dialogue: 'dialog', dialogues: 'dialogs',
  analogue: 'analog',
  monologue: 'monolog',
  // -ce → -se
  defence: 'defense', offence: 'offense', licence: 'license', pretence: 'pretense',
  practise: 'practice', practises: 'practices', practised: 'practiced', practising: 'practicing',
  // misc
  grey: 'gray', greys: 'grays', greyish: 'grayish',
  plough: 'plow', ploughs: 'plows',
  pyjamas: 'pajamas',
  tyre: 'tire', tyres: 'tires',
  kerb: 'curb',
  mum: 'mom', mummy: 'mommy',
  aeroplane: 'airplane', aeroplanes: 'airplanes',
  aluminium: 'aluminum',
  doughnut: 'donut', doughnuts: 'donuts',
  programme: 'program', programmes: 'programs',
  cheque: 'check', cheques: 'checks',
  storey: 'story', storeys: 'stories',
  moustache: 'mustache',
  sceptical: 'skeptical', sceptic: 'skeptic',
  cosy: 'cozy',
  gaol: 'jail',
  encyclopaedia: 'encyclopedia',
  manoeuvre: 'maneuver',
};

/**
 * Normalise English text toward the American spelling. Lowercases, collapses
 * whitespace, and rewrites each British-spelled word to its American form.
 */
export function normalizeEnglishVariant(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/[a-z]+/g, (word) => UK_TO_US[word] ?? word);
}

/**
 * True when two English strings are equal once US/UK spelling differences
 * are normalised away. Used by exact-match graders so "colour" and "color"
 * both pass.
 */
export function englishVariantsEqual(a: string, b: string): boolean {
  return normalizeEnglishVariant(a) === normalizeEnglishVariant(b);
}
