/* Definitions: everything the game talks about, in one place. Panels, tooltips and the guide read from here. */
const MONTHS = ['July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March', 'April', 'May', 'June'];
const GRADE_NAMES = ['K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
const DIV_NAMES = ['Lower', 'Middle', 'Upper'];
const DIV_SPAN = ['K–5', '6–8', '9–12'];
const DIV_GRADES = [[0, 1, 2, 3, 4, 5], [6, 7, 8], [9, 10, 11, 12]];
const divOf = (g) => (g <= 5 ? 0 : g <= 8 ? 1 : 2);
const START_YEAR = 2026;

const MISSIONS = [
  { id: 'prep', name: 'College Preparatory', line: 'Rigor, results, and a college list parents quote at dinner parties.',
    perks: ['College counseling works 30% harder', 'Families pay a premium more willingly', 'Parents react twice as hard to college results'],
    beta: 0.93, collMul: 1.3, outcomeSat: 2, pw: { acad: 1.2, coll: 1.4 } },
  { id: 'whole', name: 'Progressive', line: 'Joyful, hands-on learning. Fewer tests, more projects, muddy boots.',
    perks: ['Families stay: +1.5% retention', 'Arts and Wellness cost 25% less', 'College results count for less either way'],
    ret: 0.015, disc: { arts: 0.75, well: 0.75 }, collRep: 0.6, morale: 3, pw: { arts: 1.3, well: 1.3 } },
  { id: 'stem', name: 'STEM & Innovation', line: 'Robots in the lobby, calculus by sophomore year.',
    perks: ['STEM costs 25% less and counts double', 'Extra pull in tech-heavy neighborhoods', 'Enrollment swings harder with the economy'],
    disc: { stem: 0.75 }, pw: { stem: 2 }, econSwing: 1.5 },
  { id: 'access', name: 'Community & Access', line: 'A school that looks like the whole city, not one zip code.',
    perks: ['40% more aid applicants, and they say yes more often', 'More families give to the annual fund', 'Full-pay families are more price sensitive'],
    beta: 1.08, aidApps: 1.4, part: 0.08 },
];
const MISSION_BY = {}; MISSIONS.forEach((m) => (MISSION_BY[m.id] = m));

const BASE_GRADES = [22, 24, 26, 27, 28, 29, 30, 31, 30, 33, 32, 31, 29];
const SCENARIOS = [
  { id: 'turnaround', name: 'The Turnaround', level: 'Standard',
    line: 'Three years of quiet deficits, an aging campus and a board that wants a plan. Good bones, thin margins.',
    scale: 1, overhead: 900000, cash: 0.95e6, endow: 5.5e6, debt: 2.4e6, salaryIdx: 0.94, fq: 60, morale: 52, sat: 56, rep: 47, board: 62, cond: 55,
    alumni: 2600, tuition: [19000, 23500, 27500], fac: [18, 10, 15], aid: 0.19,
    prog: { acad: 2, stem: 1, arts: 2, ath: 2, well: 1, coll: 2, aux: 1 }, team: { admissions: 2, business: 2, academic: 3 } },
  { id: 'steady', name: 'The Steady Ship', level: 'Gentler',
    line: 'A healthy school with a waiting list in some grades. The danger is comfort. The board wants ambition.',
    scale: 1.27, overhead: 1450000, maint: 0.015, cash: 2.4e6, endow: 14e6, debt: 1.5e6, salaryIdx: 1.0, fq: 67, morale: 62, sat: 66, rep: 60, board: 70, cond: 72,
    alumni: 4200, tuition: [20500, 25500, 29500], fac: [25, 14, 20], aid: 0.2,
    prog: { acad: 3, stem: 2, arts: 2, ath: 2, well: 2, coll: 3, aux: 2 }, team: { admissions: 3, business: 3, advancement: 3, academic: 3 } },
  { id: 'brink', name: 'On the Brink', level: 'Hard',
    line: 'Enrollment is sliding, the roof leaks and the bank has started calling. The last head left in March.',
    scale: 0.8, overhead: 320000, cash: 0.75e6, endow: 3.0e6, debt: 2.4e6, salaryIdx: 0.91, fq: 58, morale: 46, sat: 53, rep: 44, board: 68, cond: 47,
    alumni: 2100, tuition: [18000, 22000, 26000], fac: [14, 8, 11], aid: 0.21,
    prog: { acad: 2, stem: 1, arts: 1, ath: 2, well: 1, coll: 1, aux: 0 }, team: { business: 2, academic: 2 } },
];
const SCENARIO_BY = {}; SCENARIOS.forEach((s) => (SCENARIO_BY[s.id] = s));

/* Programs run at levels 0-5. `gate` is the building needed to go past level 3. */
const PROGRAMS = [
  { id: 'acad', name: 'Core Academics', does: 'Curriculum, advanced courses and classroom materials. The largest lever on teaching quality.', gate: 'library' },
  { id: 'stem', name: 'STEM & Innovation', does: 'Labs, robotics and computer science. Draws families who work in tech.', gate: 'science' },
  { id: 'arts', name: 'Arts', does: 'Music, theater and studio art. Lifts student life and widens your appeal.', gate: 'arts' },
  { id: 'ath', name: 'Athletics', does: 'Teams, coaches and travel. Builds spirit, Upper School retention and alumni giving.', gate: 'fieldhouse' },
  { id: 'well', name: 'Wellness & Learning Support', does: 'Counselors and learning specialists. Keeps families enrolled and supports a wider range of learners.', gate: null },
  { id: 'coll', name: 'College Counseling', does: 'Improves where seniors land. College results feed reputation.', gate: null },
  { id: 'aux', name: 'Summer & Auxiliary', does: 'Camps, after-school care and rentals. This one earns money.', gate: null, revenue: true },
];
const PROGRAM_BY = {}; PROGRAMS.forEach((p) => (PROGRAM_BY[p.id] = p));
const LEVEL_WORDS = ['None', 'Basic', 'Solid', 'Strong', 'Excellent', 'Signature'];

/* Buildings. `value` is replacement value (drives upkeep). `cap` adds seats per division. */
const BUILDINGS = {
  ls: { name: 'Lower School', start: true, value: 9e6, cap: [180, 0, 0] },
  main: { name: 'Main Hall', start: true, value: 11e6, cap: [0, 120, 0] },
  us: { name: 'Upper School', start: true, value: 10e6, cap: [0, 0, 200] },
  gym: { name: 'Old Gym', start: true, value: 4e6 },
  wingL: { name: 'Lower School Wing', cost: 3.2e6, weeks: 36, cap: [60, 0, 0], does: 'Adds 60 Lower School seats.', multi: true },
  wingM: { name: 'Middle School Wing', cost: 3.4e6, weeks: 36, cap: [0, 45, 0], does: 'Adds 45 Middle School seats.', multi: true },
  wingU: { name: 'Upper School Wing', cost: 4.2e6, weeks: 40, cap: [0, 0, 60], does: 'Adds 60 Upper School seats.', multi: true },
  library: { name: 'Library & Learning Commons', cost: 4.5e6, weeks: 44, sig: true, does: 'Unlocks Core Academics levels 4 and 5. Better facilities for every division.' },
  science: { name: 'Science & Innovation Center', cost: 9.5e6, weeks: 60, sig: true, does: 'Unlocks STEM levels 4 and 5. A signature building: reputation and applications rise.' },
  arts: { name: 'Performing Arts Center', cost: 8.0e6, weeks: 56, sig: true, does: 'Unlocks Arts levels 4 and 5. Rental income when Auxiliary is running.' },
  fieldhouse: { name: 'Field House', cost: 8.5e6, weeks: 56, sig: true, replaces: 'gym', does: 'Replaces the Old Gym. Unlocks Athletics levels 4 and 5 and brings rental income.' },
  dining: { name: 'Dining Commons', cost: 3.6e6, weeks: 40, does: 'Families and students notice lunch. Lifts satisfaction; small rental income.' },
  elc: { name: 'Early Learning Center', cost: 2.8e6, weeks: 32, does: 'A Pre-K that feeds Kindergarten: 25% more K applicants and better K yield. Earns tuition of its own.' },
  turf: { name: 'Stadium & Turf Field', cost: 2.2e6, weeks: 20, noSlot: true, does: 'Friday nights. Lifts spirit and satisfaction; rental income.' },
  solar: { name: 'Solar & Geothermal', cost: 1.4e6, weeks: 16, noSlot: true, does: 'Cuts building operating costs by 12% for good.' },
  housing: { name: 'Faculty Housing', cost: 2.6e6, weeks: 24, noSlot: true, does: 'Cottages near campus. Faculty morale, stronger hires, fewer departures.' },
};
const BUILD_ORDER = ['wingL', 'wingM', 'wingU', 'library', 'science', 'arts', 'fieldhouse', 'dining', 'elc', 'turf', 'solar', 'housing'];
const SIGNATURES = ['library', 'science', 'arts', 'fieldhouse'];

/* Campus geometry in tile coordinates (shared by the sim for slot counts and the renderer for drawing). */
const CAMPUS = { i0: 17, i1: 28, j0: 21, j1: 32, ci: 22.5, cj: 26.5 };
const FIXED_SITES = {
  ls: [17.5, 21.5, 20.1, 23.3], main: [20.9, 21.4, 24.9, 23.2], us: [25.6, 21.5, 27.6, 23.7],
  gym: [17.5, 27.0, 19.9, 28.8], field: [22.7, 29.5, 27.5, 31.6], quad: [20.6, 24.0, 24.8, 26.4],
};
const SLOTS = [
  [25.5, 24.5, 27.6, 26.3], [17.5, 24.3, 19.7, 26.1], [23.1, 27.0, 25.1, 28.7], [20.6, 27.0, 22.6, 28.7],
  [25.6, 27.0, 27.6, 28.7], [20.0, 29.6, 22.0, 31.4], [17.5, 29.6, 19.5, 31.4],
];

const ROLES = [
  { id: 'admissions', title: 'Director of Admission', does: 'More applications, better yield.',
    bios: ['Former college admission reader. Remembers every family’s dog.', 'Ran enrollment at a boarding school twice your size.', 'Ex-marketing lead who says "funnel" without irony.', 'Alum, parent of two, knows every preschool director in town.'] },
  { id: 'business', title: 'Chief Financial Officer', does: 'Lower operating costs, cheaper borrowing, stronger auxiliary income.',
    bios: ['CPA who reads bond covenants for fun.', 'Came from a hospital system. Finds savings in the phone bill.', 'Twenty years in school business offices. Has seen every budget trick.', 'Former bank lender. Negotiates like one.'] },
  { id: 'advancement', title: 'Director of Advancement', does: 'A bigger annual fund and stronger campaigns.',
    bios: ['Closed a seven-figure gift over a single lunch. Twice.', 'Warm, relentless, and never forgets a birthday.', 'Built an alumni program from a shoebox of index cards.', 'Came from the art museum. Knows who gives in this city.'] },
  { id: 'academic', title: 'Dean of Faculty', does: 'Stronger hires, faster teacher growth, better morale.',
    bios: ['Beloved former English teacher. Faculty would follow her anywhere.', 'Curriculum designer with a doctorate and a whistle.', 'Hires for character first. It shows.', 'Runs the best new-teacher mentoring in the region.'] },
  { id: 'students', title: 'Dean of Students', does: 'Happier families, steadier retention, calmer crises.',
    bios: ['Knows every student by name by October.', 'Former counselor. Parents call him before they call you.', 'Turns discipline meetings into turning points.', 'Coach, advisor, and the adult kids actually tell things to.'] },
];
const ROLE_BY = {}; ROLES.forEach((r) => (ROLE_BY[r.id] = r));

const FIRST_NAMES = ['Amara', 'Daniel', 'Priya', 'Marcus', 'Elena', 'Tomás', 'Grace', 'Kwame', 'Hannah', 'Luis', 'Mei', 'Jonah', 'Fatima', 'Owen', 'Nadia', 'Theo', 'Ines', 'Caleb', 'Ruth', 'Desmond', 'Sofia', 'Wyatt', 'Anika', 'Malik', 'Clara', 'Hiro', 'Leah', 'Andre', 'Beatrix', 'Samir'];
const LAST_NAMES = ['Okafor', 'Whitfield', 'Raman', 'Castellanos', 'Lindqvist', 'Abernathy', 'Nakamura', 'Delacroix', 'Mbeki', 'Halloran', 'Ferreira', 'Stroud', 'Kowalczyk', 'Bhatt', 'Ellery', 'Vance', 'Oyelaran', 'Prescott', 'Zhou', 'Maddox', 'Thibault', 'Greer', 'Ansari', 'Holloway', 'Petrov', 'Quill', 'Marchetti', 'Dunmore', 'Iyer', 'Calloway'];
const SCHOOL_STEMS = ['Hawthorne', 'Ashcombe', 'Marlowe', 'Linden', 'Thornfield', 'Brightwater', 'Wrenfield', 'Stonebridge', 'Larkspur', 'Fenwick', 'Oakhaven', 'Alderbrook', 'Kingsley', 'Summit Ridge'];
const SCHOOL_FORMS = ['{} Academy', '{} Day School', 'The {} School', '{} Country Day', '{} Hall'];
const CITY_NAMES = ['Port Halloran', 'Marrow Creek', 'Eastmere', 'Calder Falls', 'Wexley', 'New Tamsin', 'Bellhaven', 'Corliss Bay', 'Tolland Ridge', 'Verity'];
const MOTTOS = ['Lux et Labor', 'Learn by Doing', 'Mind, Hand, Heart', 'Veritas et Virtus', 'Non Sibi', 'Find a Way or Make One', 'Ask Better Questions'];
const SCHOOL_COLORS = [
  ['#1f4e8c', '#e3ac2f'], ['#7a1f2b', '#d8d2c4'], ['#1f6b4a', '#f2c14e'], ['#3b2a6e', '#e9b949'],
  ['#0f5e6e', '#f08a4b'], ['#b5441f', '#1d3557'], ['#24303e', '#d94f4f'], ['#5b6f1f', '#f3e9c6'],
];
const EMBLEMS = ['book', 'torch', 'tree', 'star', 'tower', 'sun'];

/* Neighborhood archetypes. Centers are tile coordinates; ranges are [min, max] and get rolled per city. */
const NB_TYPES = [
  { type: 'downtown', c: [22, 15.5], w: 0.8, kids: [90, 130], inc: [150, 190], growth: 0.005, pq: [46, 56], density: 0.97, tech: true,
    names: ['Downtown', 'City Center', 'The Exchange'], blurb: 'Towers, condos and two-career households. Few children, high incomes.' },
  { type: 'oldmoney', c: [35, 18], w: 1, kids: [120, 160], inc: [230, 280], growth: 0, pq: [68, 76], density: 0.8,
    names: ['Hawthorne Heights', 'Regent Hill', 'Laurel Crest'], blurb: 'Old houses, older trees. Private school is the default here, and loyalties run deep.' },
  { type: 'newsuburb', c: [35, 36], w: 1, kids: [180, 240], inc: [160, 200], growth: 0.03, pq: [72, 80], density: 0.5, tech: true,
    names: ['Fox Hollow', 'Stonemill Estates', 'Brighton Ridge'], blurb: 'New construction and young families. Growing fast, with strong public schools.' },
  { type: 'middle', c: [7, 20], w: 1, kids: [300, 360], inc: [85, 105], growth: 0.003, pq: [54, 62], density: 0.85,
    names: ['Westfield', 'Maple Flats', 'Garfield Park'], blurb: 'Teachers, nurses, small-business owners. Tuition is a stretch without aid.' },
  { type: 'south', c: [21, 37], w: 1, kids: [280, 340], inc: [98, 122], growth: 0.01, pq: [58, 66], density: 0.82,
    names: ['Southbrook', 'Linden Terrace', 'Kessler Park'], blurb: 'Comfortable and close to campus. Families here weigh you against a good public school.' },
  { type: 'working', c: [6, 36], w: 1, kids: [340, 400], inc: [48, 60], growth: -0.003, pq: [38, 46], density: 0.9,
    names: ['Millside', 'Tannery Row', 'Pike Street'], blurb: 'Lots of children, modest incomes, weak public options. Reachable only with real financial aid.' },
  { type: 'university', c: [8, 3.5], w: 1, kids: [110, 150], inc: [100, 125], growth: 0.005, pq: [56, 64], density: 0.85, tech: true, north: true,
    names: ['College Hill', 'University Park', 'Scholars Row'], blurb: 'Professors and researchers. They care about academics more than amenities.' },
  { type: 'arts', c: [22, 3.5], w: 1, kids: [80, 110], inc: [62, 80], growth: 0.02, incTrend: 0.022, pq: [40, 50], density: 0.7, north: true,
    names: ['The Foundry', 'Brickworks', 'Canal District'], blurb: 'Old warehouses turning into lofts and studios. Changing quickly.' },
  { type: 'streetcar', c: [36, 4], w: 1, kids: [220, 270], inc: [120, 145], growth: 0.005, pq: [62, 70], density: 0.85, north: true,
    names: ['Old Northside', 'Trolley Park', 'Elm Circle'], blurb: 'Established families across the river. A long drive without a bus.' },
];
const RIVAL_DEFS = [
  { id: 'elite', names: ['Aldermoor Hall', 'St. Crispin’s School', 'The Pemberton School'], home: 'oldmoney', price: 1.22, rep: 71, bias: 0.2,
    blurb: 'Traditional, selective and expensive. The school everyone compares you to.' },
  { id: 'prog', names: ['Riverbend Day School', 'Canopy School', 'Willow Bank School'], home: 'streetcar', price: 0.93, rep: 55, bias: 0,
    blurb: 'Progressive and friendly. Competes on warmth and price.' },
  { id: 'parish', names: ['St. Brigid Parish School', 'Holy Cross Parish School', 'St. Anselm School'], home: 'middle', price: 0.44, rep: 46, bias: 0, k8: true,
    blurb: 'K–8 only and half your price. Competes for cost-conscious families.' },
];

/* Where the head's own days go: ten a month. Two per area is the neutral habit; more helps with diminishing returns, less is noticed. */
const TIME_DAYS = 10;
const TIME_AREAS = [
  { id: 'faculty', name: 'In classrooms', does: 'Class visits, mentoring and hallway conversations. Lifts morale and helps teachers grow.' },
  { id: 'families', name: 'With families', does: 'Carline, coffees, games and concerts. Lifts family satisfaction.' },
  { id: 'donors', name: 'With donors', does: 'Lunches, visits and thank-you calls. Lifts the annual fund and campaigns.' },
  { id: 'admissions', name: 'At admission events', does: 'Open houses, tours and preschool visits. More applications and better yield.' },
  { id: 'board', name: 'With trustees', does: 'Committee meetings and one-on-ones. Builds board confidence, slowly.' },
];

/* Strategic plan pillars. The board asks for one after your first year and at every contract renewal; each is permanent.
   fx keys are read by the sim: morale, sat, rep, eq are standing points; apps, aidApps, giving, aux, upkeep, admin, beta, bus, outcome, nbApps are
   fractional changes; ret, trans, part, aidYield are probabilities; hire and q are quality points; fq is quality per year;
   cost, perFac and once are dollars at year-one prices. In perks, {$N} prints N dollars at today's prices and {$Nt} prints N per teacher. */
const PILLARS = [
  { id: 'faculty', name: 'Faculty First', line: 'A mentor for every new teacher and sabbaticals for the veterans.',
    perks: ['Stronger hires and faster teacher growth', 'Faculty morale +4', 'Costs about {$1800t} a year'], fx: { hire: 4, fq: 0.45, morale: 4, perFac: 1800 } },
  { id: 'door', name: 'The Open Door', line: 'A public promise that money will not be the reason a child cannot come.',
    perks: ['35% more aid applicants, and more of them say yes', 'More families give; reputation +1.5', 'Full-pay families grow more price sensitive'], fx: { aidApps: 0.35, aidYield: 0.05, part: 0.05, rep: 1.5, beta: 0.03 } },
  { id: 'select', name: 'Selective by Design', line: 'Fewer offers, a stronger class and a longer waiting list.',
    perks: ['Stronger applicants (+4 profile)', 'Reputation +2', 'Parents react half again as hard to college results'], fx: { q: 4, rep: 2, outcome: 0.5 } },
  { id: 'city', name: 'City as Classroom', line: 'Internships downtown, lab time at the university, studios in the arts district.',
    perks: ['20% more applicants from downtown, university and arts neighborhoods', 'Teaching quality +1.5', 'Costs {$110000} a year'], fx: { nbApps: 0.2, eq: 1.5, cost: 110000 }, nbTypes: ['downtown', 'university', 'arts'] },
  { id: 'global', name: 'Global Campus', line: 'Students from abroad, living with host families and paying full tuition.',
    perks: ['About 8 more full-pay Upper School applicants a year', 'Families −2.5 unless Wellness is Strong', 'Costs {$90000} a year'], fx: { intl: 8, satNeed: -2.5, cost: 90000 } },
  { id: 'yearround', name: 'Year-Round Campus', line: 'Camps, conferences and weddings. The gates never close.',
    perks: ['Auxiliary income +40%', 'Buildings wear faster', 'Faculty morale −1.5'], fx: { aux: 0.4, wear: 0.7, morale: -1.5 } },
  { id: 'green', name: 'Green Campus', line: 'Insulation, heat pumps and a garden the second grade runs.',
    perks: ['Building operating costs −10%', 'Reputation +1 and 4% more applicants', 'Costs {$350000} up front'], fx: { upkeep: -0.1, rep: 1, apps: 0.04, once: 350000 } },
  { id: 'giving', name: 'Culture of Giving', line: 'Every family asked, every gift thanked, every class with an agent.',
    perks: ['Annual fund and campaigns +14%', 'Families −1: the asking never stops'], fx: { giving: 0.14, sat: -1 } },
  { id: 'promise', name: 'The Tuition Promise', line: 'Increases held close to inflation, in writing.',
    perks: ['Retention +1.5% and 6% more applicants', 'Tuition can rise no more than 1.5 points above inflation'], fx: { ret: 0.015, apps: 0.06, tuitionCap: 1.5 } },
  { id: 'k12', name: 'One School, K–12', line: 'Fifth graders shadow sixth. Eighth graders choose Upper School courses in March.',
    perks: ['Far fewer families leave after grades 5 and 8', 'Families +1', 'Costs {$70000} a year'], fx: { trans: 0.04, sat: 1, cost: 70000 } },
  { id: 'lean', name: 'Lean Operations', line: 'Shared services, renegotiated contracts and a hard look at every line.',
    perks: ['Administrative and operating costs −6%', 'Faculty morale −2 and families −1'], fx: { admin: -0.06, morale: -2, sat: -1 } },
  { id: 'known', name: 'Known and Cared For', line: 'An advisor for every student and a counselor in every division.',
    perks: ['Families +2.5 and retention +0.8%', 'Costs {$130000} a year'], fx: { sat: 2.5, ret: 0.008, cost: 130000 } },
  { id: 'reach', name: 'Every Neighborhood', line: 'Buses, open houses in church halls and a tuition calculator in three languages.',
    perks: ['Bus routes cost half', 'More families in every neighborhood know you', 'Costs {$80000} a year'], fx: { bus: -0.5, aware: 0.06, cost: 80000 } },
];
const PILLAR_BY = {}; PILLARS.forEach((p) => (PILLAR_BY[p.id] = p));
