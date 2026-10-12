/**
 * Charm-link catalogue, mirrored from the main site's collection page
 * (navilleracharms.vercel.app → Js_Folder/catalogue-data.js, `links`).
 * Prices, labels, and sold-out flags here should be kept in sync with it.
 *
 * `file` is the image path relative to public/charms. Each section's `gold`
 * set (if any) is the Gold toggle on the main site, at its own price.
 */

type CatalogueItem = { label: string; file: string; soldOut?: boolean };

type CatalogueSet = { price: number; items: CatalogueItem[] };

type CatalogueSection = CatalogueSet & {
  /** Category pill / cart subtitle in the editor. */
  category: string;
  sortItems?: boolean;
  gold?: CatalogueSet;
};

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

const labelled = (labels: string[], file: (n: number) => string): CatalogueItem[] =>
  labels.map((label, i) => ({ label, file: file(i + 1) }));

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export const CATALOGUE_SECTIONS: CatalogueSection[] = [
  {
    category: 'Plain Charms', price: 1.50,
    items: [{ label: 'Silver', file: 'Plain Links/Silver_Plain_Charm.png' }],
  },
  {
    category: 'Plain Charms', price: 2.50, sortItems: true,
    items: ['Gold', 'Red', 'Blue', 'Dark Blue', 'Black', 'Brown', 'Purple', 'Pink', 'Dark Pink', 'Green'].map(color => ({
      label: color,
      file: `Plain Links/${color.replace(' ', '')}_Plain_Charm.png`,
    })),
  },
  {
    category: 'Concave Links', price: 3.00, sortItems: true,
    items: labelled(['Star', 'Butterfly', 'Sparkle', 'Flower', 'Heart', 'Heart Outline', 'Paw', 'Double Heart'],
      n => `Concave Links/Concave_Silver_Links (${n}).png`),
    gold: {
      price: 3.50,
      items: labelled(['Star', 'Butterfly'], n => `Concave Links/Concave_Gold_Links (${n}).png`),
    },
  },
  {
    category: 'Gold Outline Links', price: 4.00, sortItems: true,
    items: labelled(['Heart', 'Double Heart', 'Star', 'Flower', 'Paw', 'Butterfly', 'Heart Outline', 'Sun', 'Cupid', 'Hello-Kitty'],
      n => `Golden Outline Links/Gold_Outline_Links (${n}).png`),
  },
  {
    category: 'Colored Links', price: 4.50, sortItems: true,
    items: labelled(['Red Heart', 'Pink Heart', 'Black Heart', 'Purple Heart', 'Double Pink Heart',
      'Double Black Heart', 'Red Star', 'Red Butterfly', 'Pink Butterfly', 'Strawberry', 'Yin-Yang', 'Double Grey Heart',
      'Black Star', 'Cherry'], n => `Colored Links/Colored_Silver_Links (${n}).png`),
    gold: {
      price: 5.00,
      items: labelled(['Cherry', 'Strawberry'], n => `Colored Links/Colored_Gold_Links (${n}).png`),
    },
  },
  {
    category: 'Letter Links', price: 3.50,
    items: LETTERS.map((label, i) => ({
      label,
      file: i === 0 ? 'Letter Links/letter_Letters Silver (1).png' : `Letter Links/Letters Silver (${i + 1}).png`,
    })),
    gold: {
      price: 4.50,
      items: LETTERS.map((label, i) => ({
        label,
        file: i === 0 ? 'Letter Links/letter_Letters Gold (1).png' : `Letter Links/Letters Gold (${i + 1}).png`,
      })),
    },
  },
  {
    category: 'Number Links', price: 3.50,
    items: range(1, 10).map(n => ({
      label: String(n - 1),
      file: n === 10 ? 'Number Links/number_number_Number.png' : `Number Links/Number (${n}).png`,
    })),
    gold: {
      price: 4.50,
      items: range(1, 10).map(n => ({ label: String(n - 1), file: `Number Links/Gold_Number (${n}).png` })),
    },
  },
  {
    category: 'Characters', price: 8.99,
    items: labelled(['Blossom', 'Bubbles', 'Buttercup', 'My Melody', 'Cinnamoroll', 'Cinnamoroll II', 'Hello Kitty', 'Spider-Kitty', 'Kuromi', 'Pompompurin',
      'Kirby', 'Badtz-Maru', 'Snoopy', 'Snoopy II', 'Captain America', 'Hulk', 'Spider-Man', 'Venom',
      'Groot', 'Doctor Strange', 'Iron-Man', 'Spider-Man Logo', 'Bulbasaur', 'Cubone', 'Pokemon'],
      n => `Character Links/Character_Premium_Charms  (${n}).png`)
      .map((item, i) => (i + 1 === 2 ? { ...item, soldOut: true } : item)),
  },
  {
    category: 'Animals', price: 8.99, sortItems: true,
    items: labelled(['Frog', 'Golden Retriever', 'Pug', 'Cat', 'Maltese', 'French Bulldog', 'Husky', 'Shiba', 'Paw'],
      n => `Animal Links/Animal_Premium_Links (${n}).png`),
    gold: {
      price: 9.99,
      items: labelled(['Cat', 'Black Cat', 'Strawberry Cake Cat', 'Butterfly'], n => `Animal Links/Animal_Premium_Links (${n + 10}).png`),
    },
  },
  {
    category: 'Cars', price: 8.99, sortItems: true,
    items: labelled(['Car', 'BMW', 'Mercedes', 'Lamborghini', 'Ferrari', 'Porsche', 'BMW Pink', 'Mercedes Pink',
      'Ferrari Pink', 'Mercedes Pink'], n => `Car Links/Cars_Premium_Charms (${n}).png`),
  },
  {
    category: 'Sports', price: 8.99, sortItems: true,
    items: labelled(['Volleyball', 'Basketball', 'Football', 'Paris Saint-Germain', 'Inter Milan', 'Real Madrid',
      'Manchester United', 'FC Barcelona', 'FC Bayern München', 'Juventus', 'AC Milan'],
      n => `Sport Links/Sports_Premium_Charms (${n}).png`),
  },
  {
    category: 'Premium Charms', price: 8.99,
    items: labelled([
      'Lavender Clover Gem', 'Red Clover', 'Black Clover', 'Lavender Clover', 'Pearl Clover', 'Pink Clover',
      'Pearl Clover Gem', 'Pink Clover Gem', 'Pink Flower', 'Lavender Flower', 'Cream Flower', 'White Flower',
      'Green & Purple Gummy Bears', 'Blue & Red Gummy Bears', 'Black Bow', 'Pink Layered Heart', 'Red Heart Gem', 'Playing Card Suits',
      'Pink Telephone', 'Heart Card', 'Black & White Checkered', 'Vintage Camera', 'Heart Sunglasses', '8 Ball',
      'Pink Checkered', 'Piano Keys', 'Blue Star Sunburst', 'Moon Sunburst', 'Diamond Checkered', 'Blue Stars',
      'Crescent Moon & Star', 'Racing Flags', 'Shit Happens', 'I Lost My Mind', 'I Love You', 'I Love My Boyfriend',
      'I Love My Girlfriend', 'Sexy', 'Crazy', 'Barbie', 'Anti Social', 'Spiderweb',
      'Black Bat', 'Black Spider', 'Dragon Tail', 'Dragon Body', 'Dragon Head',
    ], n => `Premium Links/Premium_Silver_Links (${n}).png`),
    gold: {
      price: 9.99,
      items: labelled([
        'Lavender Clover Gem', 'Red Clover', 'Black Clover', 'Lavender Clover', 'Pearl Clover', 'Pearl Clover Gem',
        'Pink Clover Gem', 'Black Clover Gem', 'Green Striped Clover Gem', 'Music Hearts', 'Crystal Gem', 'Crystal Paw I',
        'Crystal Butterfly I', 'Strawberry', 'Daisy I', 'Daisy II', 'Boba', 'Boys Lie',
        'Route 66', 'Cherries', 'Crystal Butterfly II', 'Crystal Flower Bud', 'Crystal Paw II', 'Pink Heart Gem',
        'Heart Lock', 'Butterfly Outline', 'Dice', 'Pink Bow', 'Sexy', 'Crazy',
      ], n => `Premium Links/Premium_Gold_Links (${n}).png`),
    },
  },
  {
    category: 'Flags', price: 8.00, sortItems: true,
    items: labelled(['Philippines', 'Netherlands', 'South Korea', 'India', 'Egypt', 'Czech Republic', 'UAE', 'Pakistan', 'United Kingdom', 'Palestine', 'Italy'],
      n => `Flag Links/Flags (${n}).png`),
  },
  {
    category: 'Dangling Links', price: 14.99, sortItems: true,
    items: labelled(['Pearl Shell Dangle', 'Butterfly Dangle'], n => `Dangling Links/Dangling_Silver_Links (${n}).png`),
    gold: {
      price: 15.99,
      items: labelled(['Red Bow Dangle', 'Crystal Leaf Dangle', 'Red Heart Cherries Dangle', 'Black Bow Dangle', 'Pastel Butterfly Dangle'],
        n => `Dangling Links/Dangling_Gold_Links (${n}).png`),
    },
  },
  {
    category: 'Magnet Hearts', price: 12.50,
    items: labelled(['Magnet Heart I', 'Magnet Heart II'], n => `Magnet Hearts/Silver_Dangling_Deluxe_Charms (${n}).png`),
    gold: {
      price: 12.50,
      items: labelled(['Magnet Heart I', 'Magnet Heart II'], n => `Magnet Hearts/Gold_Dangling_Deluxe_Charms (${n}).png`),
    },
  },
];

export type CatalogueEntry = {
  file: string;
  /** Name shown on the tile, in the cart, and on orders (e.g. "Gold Star"). */
  displayName: string;
  category: string;
  price: number;
  soldOut: boolean;
};

const toEntries = (set: CatalogueSet, category: string, gold: boolean, sortItems?: boolean): CatalogueEntry[] => {
  const items = sortItems ? [...set.items].sort((a, b) => a.label.localeCompare(b.label)) : set.items;
  return items.map(item => ({
    file: item.file,
    displayName: gold && !/gold/i.test(item.label) ? `Gold ${item.label}` : item.label,
    category,
    price: set.price,
    soldOut: !!item.soldOut,
  }));
};

/**
 * Every catalogue link in display order: sections cheapest first (same as the
 * main site's collection page), silver items before their gold counterparts.
 */
export const CATALOGUE_ENTRIES: CatalogueEntry[] = [...CATALOGUE_SECTIONS]
  .sort((a, b) => a.price - b.price)
  .flatMap(section => [
    ...toEntries(section, section.category, false, section.sortItems),
    ...(section.gold ? toEntries(section.gold, section.category, true, section.sortItems) : []),
  ]);

const ENTRY_BY_FILE = new Map(CATALOGUE_ENTRIES.map(entry => [entry.file, entry]));

export const getCatalogueEntry = (file: string): CatalogueEntry | undefined => ENTRY_BY_FILE.get(file);

/** Category pills, in catalogue order. */
export const CATALOGUE_CATEGORIES: string[] = [...new Set(CATALOGUE_ENTRIES.map(entry => entry.category))];
