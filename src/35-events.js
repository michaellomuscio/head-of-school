/* Dilemmas. Each has a condition, a weight, and choices. A choice has fixed effects (fx), an optional gamble (risk), and outcome text.
   fx keys: cash and endow are dollars at year-one prices (scaled for inflation); board and fq are direct points;
   sat, morale, rep, eq are points that fade over [weeks]; giving and apps are percent changes that fade. */
const FX_LABEL = { sat: 'Families', morale: 'Faculty', rep: 'Reputation', board: 'Board', giving: 'Giving', apps: 'Applications', fq: 'Teaching', eq: 'Teaching', ret: 'Retention' };
function applyFx(S, fx, label) {
  if (!fx) return;
  for (const k in fx) {
    const v = fx[k];
    if (k === 'cash') oneoff(S, v * S.costIdx);
    else if (k === 'endow') S.endow += v * S.costIdx;
    else if (k === 'board') S.board = clamp(S.board + v, 0, 100);
    else if (k === 'fq') S.fq = clamp(S.fq + v, 20, 96);
    else if (k === 'campaign') S.campaignFund += v * S.costIdx;
    else { const a = Array.isArray(v) ? v : [v, 40]; addMod(S, k, a[0], a[1], label); }
  }
}
function fxTags(S, fx) {
  const out = [];
  for (const k in fx || {}) {
    const v = Array.isArray(fx[k]) ? fx[k][0] : fx[k];
    if (k === 'cash') out.push([v >= 0 ? 'good' : 'bad', money(v * S.costIdx, true)]);
    else if (k === 'endow') out.push(['good', 'Endowment ' + money(v * S.costIdx, true)]);
    else if (k === 'campaign') out.push(['good', 'Building fund ' + money(v * S.costIdx, true)]);
    else out.push([v >= 0 ? 'good' : 'bad', FX_LABEL[k] + (v >= 0 ? ' ▲' : ' ▼')]);
  }
  return out;
}
const worstBuilding = (S) => S.bld.slice().sort((a, b) => a.cond - b.cond)[0];
const eliteRival = (S) => S.city.rivals[0];

const EVENTS = [
  { id: 'grade', w: 3, title: 'The B-plus', who: 'A parent, by appointment',
    text: (S) => 'One of your largest donors is in your office. Their daughter earned a B+ in chemistry, and they would like it to be an A−. They mention, twice, how much they have enjoyed supporting ' + S.name + '.',
    choices: [
      { label: 'Back the teacher. The grade stands.', fx: { morale: [4, 50], giving: [-8, 60] }, text: 'Word gets around the faculty room by lunch. The donor’s annual gift arrives late, and smaller.',
        risk: { p: 0.25, fx: { giving: [-10, 80], sat: [-1, 30] }, text: 'The family is telling other parents you are "inflexible." Their gift does not arrive at all.' } },
      { label: 'Ask the teacher to "take another look."', fx: { morale: [-7, 60], giving: [6, 50], fq: -0.5 }, text: 'The grade becomes an A−. The teacher updates her resume. Everyone knows why.' },
      { label: 'Offer every student a retake policy.', fx: { cash: -8000, morale: [-1, 30], sat: [1.5, 40] }, text: 'A new department-wide retake policy. The donor is half satisfied, the faculty half annoyed. Nobody can say you played favorites.' },
    ] },
  { id: 'poach', w: 3, when: (S) => S.fq > 50, title: 'An Offer from Across Town', who: 'Your best teacher',
    text: (S) => eliteRival(S).name + ' has offered your most admired teacher a 20% raise and a lighter load. She would rather stay. She would also like to pay her mortgage.',
    choices: [
      { label: 'Match the offer.', fx: { cash: -14000, morale: [-2, 30] }, text: 'She stays. Within a week, three colleagues ask what it takes to get the same deal.' },
      { label: 'Offer a department chair title and a research stipend.', fx: { cash: -5000 }, text: 'She thinks it over and stays. The title cost you almost nothing and meant a great deal.',
        risk: { p: 0.45, fx: { fq: -1.5, morale: [-3, 40] }, text: 'She thanks you warmly and takes the other job. Her students wear black on her last day.' } },
      { label: 'Wish her well.', fx: { fq: -1.5, morale: [-3, 40], sat: [-1.5, 30] }, text: 'She leaves in June. Two families mention her by name in their exit surveys.' },
    ] },
  { id: 'boiler', w: 4, when: (S) => avgCond(S) < 62 && season(S) === 'winter', title: 'The Boiler', who: 'Director of Facilities, 6:10 a.m.',
    text: (S) => 'The boiler in ' + BUILDINGS[worstBuilding(S).t].name + ' died overnight. It is 19 degrees outside. He has been warning about it for three budgets.',
    choices: [
      { label: 'Replace it properly.', fx: { cash: -120000 }, run: (S) => { worstBuilding(S).cond = Math.min(100, worstBuilding(S).cond + 14); }, text: 'A new high-efficiency system goes in over a long weekend. Expensive, and it will not happen again.' },
      { label: 'Patch it and pray.', fx: { cash: -35000 }, text: 'The patch holds. For now.',
        risk: { p: 0.5, fx: { cash: -70000, sat: [-4, 40] }, text: 'The patch fails in February. Three days of classes in coats, an emergency rental unit, and a parent email thread 140 replies long.' } },
      { label: 'Close the building for the week and teach in the gym.', fx: { sat: [-5, 40], morale: [-3, 30], cash: -60000 }, text: 'Seven classes share a gym floor. The photos on social media are not flattering.' },
    ] },
  { id: 'phones', w: 3, title: 'Phones', who: 'A faculty petition',
    text: () => 'Forty teachers have signed a petition to ban phones during the school day. A parent group is circulating a counter-petition about "safety and access to our children."',
    choices: [
      { label: 'Ban them, bell to bell.', fx: { morale: [5, 60], sat: [-3, 30], eq: [1.5, 96] }, text: 'A loud first month. By spring, teachers report students talking at lunch. A few parents never forgive you.' },
      { label: 'Buy locking pouches and phase it in.', fx: { cash: -30000, morale: [3, 50], eq: [1, 96], sat: [-1, 20] }, text: 'A calmer rollout. The pouches work until students learn to open them with a magnet, which takes nine days.' },
      { label: 'Leave it to each teacher.', fx: { morale: [-3, 40] }, text: 'Nothing changes, which was the point of the petition.' },
    ] },
  { id: 'ai', w: 3, title: 'The Essay Nobody Wrote', who: 'English department chair',
    text: () => 'Half of a tenth-grade essay set reads suspiciously alike. The faculty is split between banning AI tools outright and teaching students to use them well. Parents are asking what the policy is. There is no policy.',
    choices: [
      { label: 'Invest in training and write a real policy.', fx: { cash: -45000, eq: [2, 120], rep: [1.5, 96], morale: [2, 40] }, text: 'A summer of workshops, a clear policy, and assignments redesigned to show thinking. Two other schools ask to borrow it.' },
      { label: 'Ban it. Blue books and pencils.', fx: { morale: [1, 30], rep: [-1.5, 80], sat: [-1, 30] }, text: 'Handwriting improves. Tech-industry parents start asking pointed questions at open houses.' },
      { label: 'Let each department decide.', fx: { morale: [-2, 40], sat: [-2, 40] }, text: 'Six departments, six policies. Students are punished in history for what is required in science.' },
    ] },
  { id: 'post', w: 3, title: 'It Is Already on Group Chats', who: 'Dean’s office',
    text: () => 'A cruel video made by three ninth graders about a classmate is spreading. Parents of the target want expulsions. Parents of the three have each hired the same lawyer.',
    choices: [
      { label: 'Suspend all three, publicly firm.', fx: { sat: [1, 30], board: 1 }, text: 'Most families approve.', risk: { p: 0.35, fx: { cash: -40000, sat: [-2, 30] }, text: 'One family sues over process. You settle quietly, and it costs.' } },
      { label: 'Run a restorative process with real consequences.', run: (S) => { if (S.prog.well >= 2 || sk(S, 'students') >= 3) { applyFx(S, { sat: [3, 50], rep: [1, 60] }, 'Handled with care'); return 'Your counselors run it well. The three students apologize in a way that means something, and the target’s family stays.'; } applyFx(S, { sat: [-4, 50] }, 'Mishandled incident'); return 'Without trained counselors, the process reads as a slap on the wrist. The target’s family withdraws.'; },
        note: 'Works if Wellness is Solid or your Dean of Students is strong.' },
      { label: 'Handle it privately and say nothing.', fx: { sat: [-3, 50] }, text: 'Silence is read as indifference.', risk: { p: 0.3, fx: { rep: [-3, 80] }, text: 'A local reporter gets the video. "School declined to comment" is the whole second paragraph.' } },
    ] },
  { id: 'recession', w: 0, title: 'Hard Times', who: 'Business office',
    text: (S) => 'The recession has reached your families. Dozens have lost income since they signed their contracts, and the aid requests are piling up on the CFO’s desk.',
    choices: [
      { label: 'Fund every request.', fx: { cash: -260000, sat: [5, 80], ret: [3, 60], rep: [1.5, 80] }, text: 'No family leaves over money this year. People remember who stood by them.' },
      { label: 'Fund the most urgent half.', fx: { cash: -120000, sat: [1, 50], ret: [1, 60] }, text: 'Hard conversations, mostly kind ones. A few families go.' },
      { label: 'Hold the line. Contracts are contracts.', fx: { sat: [-5, 70], ret: [-4, 60], rep: [-2, 80] }, text: 'The budget holds. The parking lot is noticeably emptier in September.' },
    ] },
  { id: 'rink', w: 2, when: (S) => yr(S) >= 1, title: 'A Gift with Strings', who: 'A grateful grandparent',
    text: () => 'A wealthy grandparent offers $2 million, today, for an ice rink. The school has no hockey team. Running a rink costs about $150,000 a year. He is very excited.',
    choices: [
      { label: 'Ask him to fund the endowment instead.', text: 'He listens. He nods. He writes a check for half as much, to the endowment, with no strings.', fx: { endow: 1000000 },
        risk: { p: 0.4, fx: { endow: -1000000, giving: [-4, 50] }, text: 'He hears "no." The gift goes to the hospital, which now has a very nice atrium.' } },
      { label: 'Take the money. Build the rink.', run: (S) => { applyFx(S, { campaign: 2000000, sat: [1, 40] }, 'The rink'); S.flags.rink = true; return 'The building fund grows by $2 million. You now owe the world an ice rink, and the upkeep is yours forever. The gift sits in the building fund; the annual cost starts now.'; }, tags: [['good', 'Building fund +$2M'], ['bad', '−$150k every year']] },
      { label: 'Decline gracefully.', fx: { board: -2 }, text: 'The board chair calls to ask if you have lost your mind. You explain mission. She is not fully persuaded.' },
    ] },
  { id: 'lunch', w: 3, title: 'Lunch', who: 'Dining committee',
    text: () => 'The food-service contract is up. A national vendor will do it for $80,000 less. A local farm-to-table outfit will do it for $60,000 more. Students have opinions about the current tater tots.',
    choices: [
      { label: 'Take the savings.', fx: { cash: 80000, sat: [-4, 60] }, text: 'The savings are real. So is the Instagram account students start, devoted to photographs of the chicken.' },
      { label: 'Go local.', fx: { cash: -60000, sat: [4, 70], rep: [0.5, 60] }, text: 'Lunch becomes a line on the admission tour. A sophomore writes a college essay about the beets.' },
      { label: 'Renew as is.', fx: {}, text: 'The tater tots remain. Nobody is thrilled, and nobody leaves.' },
    ] },
  { id: 'misconduct', w: 2, title: 'A Serious Allegation', who: 'Division head, door closed',
    text: () => 'A student has reported a teacher for a pattern of inappropriate comments. The teacher is popular, tenured in everything but name, and denies it.',
    choices: [
      { label: 'Outside investigator, leave of absence, tell families.', fx: { cash: -55000, sat: [-1, 20], rep: [1, 60], board: 2 }, text: 'It is thorough, painful and by the book. The findings support the student. Counsel says you did everything right, which is the only good sentence in the report.' },
      { label: 'Negotiate a quiet resignation.', fx: { cash: -30000, morale: [-2, 30] }, text: 'The teacher is gone by Friday with a neutral reference.', risk: { p: 0.35, fx: { rep: [-7, 110], board: -6, sat: [-5, 60] }, text: 'A year from now the story breaks anyway, including the neutral reference. Your name is in the headline.' } },
      { label: 'Handle it internally with a warning.', fx: { morale: [1, 20] }, text: 'A stern conversation and a note in a file.', risk: { p: 0.55, fx: { rep: [-8, 120], board: -8, sat: [-6, 70], cash: -120000 }, text: 'A second student comes forward, with a lawyer. The warning letter becomes Exhibit A.' } },
    ] },
  { id: 'champs', w: 3, when: (S) => S.prog.ath >= 3, title: 'State Champions', who: 'Athletic director, hoarse',
    text: (S) => 'The girls’ soccer team just won the state title in overtime. The whole city saw it. Alumni you have never heard from are calling.',
    choices: [
      { label: 'Throw a parade and call every donor.', fx: { cash: -15000, giving: [10, 50], rep: [2, 60], sat: [2, 40] }, text: 'A banner goes up, the annual fund has its best month in years, and admission inquiries tick up.' },
      { label: 'Celebrate modestly. Academics first.', fx: { rep: [1, 40], morale: [1, 20] }, text: 'A dignified assembly. The faculty appreciate the restraint. The team notices it too.' },
    ] },
  { id: 'raises', w: 4, when: (S) => S.salaryIdx < 0.94, title: 'A Letter from the Faculty', who: 'Signed by thirty-one teachers',
    text: (S) => 'Faculty pay has fallen to ' + Math.round(S.salaryIdx * 100) + '% of what comparable schools pay. The letter is respectful. It also notes that ' + eliteRival(S).name + ' is hiring.',
    choices: [
      { label: 'Pay a one-time bonus now.', fx: { cash: -120000, morale: [7, 50] }, text: 'It helps this year. It does not change the pay scale, and everyone can do that math.' },
      { label: 'Promise a three-year plan to reach market.', fx: { morale: [6, 90], board: -1 }, run: (S) => { S.flags.payPromise = yr(S) + 3; }, text: 'The promise buys you real goodwill. Now you have to keep it: raises above inflation at the next budget meetings, or the trust is gone.' },
      { label: 'Explain the budget honestly and offer nothing.', fx: { morale: [-6, 70] }, text: 'They thank you for your candor. Several also thank their recruiters.' },
    ] },
  { id: 'book', w: 2, title: 'The Reading List', who: 'A parent group',
    text: () => 'Twelve parents want a novel removed from the eighth-grade reading list. The English department will not budge. Both sides have emailed the board chair.',
    choices: [
      { label: 'Stand behind the faculty.', fx: { morale: [4, 50], sat: [-2, 30] }, text: 'The book stays. Two families leave loudly. Most parents quietly respect it.' },
      { label: 'Offer an alternate title for families who ask.', fx: { morale: [-1, 20], sat: [1, 30] }, text: 'A reasonable compromise that pleases no one completely, which is how you know it is reasonable.' },
      { label: 'Pull the book.', fx: { morale: [-7, 70], sat: [-1, 30], rep: [-1.5, 60] }, text: 'The department chair resigns as chair. A student starts a banned-book club that meets, pointedly, outside your office.' },
    ] },
  { id: 'traffic', w: 2, when: (S) => students(S) > 400, title: 'The Pickup Line', who: 'City council member',
    text: (S) => 'The afternoon car line now backs up four blocks. Neighbors have organized, and a council member is threatening to cap your enrollment through zoning.',
    choices: [
      { label: 'Pay for a traffic study and stagger dismissal.', fx: { cash: -45000, sat: [-1, 20], rep: [1, 40] }, text: 'Staggered dismissal clears the street. The neighbors send a fruit basket, which is unprecedented.' },
      { label: 'Add a free shuttle from a satellite lot.', fx: { cash: -60000, sat: [2, 50] }, text: 'Parents love it. The line shrinks by half.' },
      { label: 'It is a public street.', fx: {}, text: 'You hold your ground.', risk: { p: 0.5, fx: { cash: -60000, rep: [-3, 70], board: -2 }, text: 'The council passes a conditional-use review. Lawyers, hearings, and a front-page photo of the car line.' } },
    ] },
  { id: 'bequest', w: 2, when: (S) => yr(S) >= 1, title: 'From the Class of 1961', who: 'An estate attorney',
    text: () => 'An alumna you never met has left the school $1.2 million. She taught kindergarten for forty years and, the attorney says, lived on almost nothing.',
    choices: [
      { label: 'Add it to the endowment.', fx: { endow: 1200000, board: 2 }, text: 'It will pay for a teacher’s salary, more or less, forever.' },
      { label: 'Name a scholarship fund for her.', run: (S) => { S.endow += 600000 * S.costIdx; applyFx(S, { rep: [1.5, 80], giving: [5, 60] }, 'Scholarship fund'); S.flags.scholar = (S.flags.scholar || 0) + 1; return 'Half goes to the endowment and half funds scholarships outright. Her former students show up to the dedication, some of them in their seventies.'; }, tags: [['good', 'Endowment +$600k'], ['good', 'Reputation ▲'], ['good', 'Giving ▲']] },
      { label: 'Put it in the building fund.', fx: { campaign: 1200000 }, text: 'It goes toward bricks. She would probably have preferred books, but bricks hold books.' },
    ] },
  { id: 'flu', w: 2, when: (S) => season(S) === 'winter', title: 'Norovirus', who: 'School nurse',
    text: () => 'Sixty students and nine teachers are out sick, and the number doubles daily. The winter concert is Thursday.',
    choices: [
      { label: 'Close for three days and deep clean.', fx: { cash: -25000, sat: [-1, 15] }, text: 'It burns out over the long weekend. Parents grumble about childcare and then get over it.' },
      { label: 'Stay open. Cancel the concert.', fx: { sat: [-3, 30], morale: [-3, 30] }, text: 'It takes three weeks to run its course. The teachers still standing cover four classes each.' },
    ] },
  { id: 'press', w: 2, title: 'A Reporter Calls', who: 'The city’s largest paper',
    text: () => 'A reporter wants to spend a week on campus for a feature on "what private school tuition actually buys." She will go where she likes and talk to whom she likes.',
    choices: [
      { label: 'Open the doors.', run: (S) => { const eq = EQavg(S); if (eq >= 62) { applyFx(S, { rep: [5, 100], apps: [12, 70] }, 'Newspaper feature'); return 'The piece is a love letter: small classes, a physics teacher who builds trebuchets, seniors who can hold a conversation. The phone rings for a month.'; } if (eq >= 52) { applyFx(S, { rep: [1, 60] }, 'Newspaper feature'); return 'A fair, mixed piece. "Good teachers, tired buildings." You have read worse.'; } applyFx(S, { rep: [-4, 100], sat: [-2, 40] }, 'Newspaper feature'); return 'The headline is "$25,000 a Year for This?" with a photo of a ceiling tile.'; }, note: 'The story will reflect your real teaching quality.' },
      { label: 'Decline politely.', fx: {}, text: 'She writes the story about another school instead.' },
    ] },
  { id: 'transfer', w: 2, when: (S) => S.prog.ath >= 2, title: 'The Recruit', who: 'Basketball coach',
    text: () => 'The best ninth-grade point guard in the state wants to transfer in. His grades are thin and his family needs full aid. Your coach has not slept.',
    choices: [
      { label: 'Admit him with full aid.', fx: { cash: -28000, rep: [1.5, 80], morale: [-2, 40] }, run: (S) => { S.grades[9].n++; S.grades[9].aid += 1; S.grades[9].an++; }, text: 'The gym is full every Friday. Some faculty wonder aloud what the admission standards are for people under six feet.' },
      { label: 'Admit him with full aid and a real support plan.', fx: { cash: -45000, rep: [1.5, 80], sat: [1, 40] }, run: (S) => { S.grades[9].n++; S.grades[9].aid += 1; S.grades[9].an++; }, text: 'A tutor, an advisor, and a coach who checks homework before practice. By junior year he is on the honor roll.' },
      { label: 'Hold to the standard.', fx: { morale: [2, 30] }, text: 'He enrolls across town and scores 31 against you in February.' },
    ] },
  { id: 'trustee', w: 2, title: 'The Trustee’s Son', who: 'Upper School head',
    text: () => 'A trustee’s son was caught with a stolen exam. The handbook says suspension and a note to colleges. The trustee chairs your compensation committee.',
    choices: [
      { label: 'Apply the handbook.', fx: { board: -4, morale: [4, 50], sat: [1, 30] }, text: 'The trustee is icy for a year. The faculty will run through walls for you.' },
      { label: 'Find a "learning-centered alternative."', fx: { board: 2, morale: [-6, 60] }, text: 'He writes a reflection essay.', risk: { p: 0.4, fx: { sat: [-4, 50], rep: [-2, 60] }, text: 'Students know exactly what happened. The honor council resigns in a group.' } },
    ] },
  { id: 'camp', w: 2, when: (S) => S.prog.aux <= 3 && season(S) !== 'summer', title: 'Summer Tenants', who: 'A national camp operator',
    text: () => 'A sports-camp company wants to rent the whole campus for eight weeks next summer for $130,000. Your facilities crew uses those weeks for repairs.',
    choices: [
      { label: 'Sign the lease.', fx: { cash: 130000, morale: [-1.5, 40] }, run: (S) => { for (const b of S.bld) b.cond = Math.max(5, b.cond - 1.5); }, text: 'The check clears. The gym floor needs refinishing a year early, and summer repairs slip.' },
      { label: 'Rent only the fields and gym.', fx: { cash: 55000 }, text: 'Less money, less wear, and the roofers still get their eight weeks.' },
      { label: 'No. Summer is for the campus.', fx: {}, text: 'The campus rests.' },
    ] },
  { id: 'ransom', w: 2, title: 'Encrypted', who: 'IT director',
    text: () => 'Every file on the school’s servers has been encrypted. The attackers want $70,000. Report cards are due in ten days. The last full backup is from October.',
    choices: [
      { label: 'Rebuild from the backup.', fx: { cash: -45000, morale: [-3, 30], sat: [-1, 20] }, text: 'Two weeks of teachers retyping grades from paper. Nothing is paid to criminals, and the new backups run nightly.' },
      { label: 'Pay.', fx: { cash: -70000 }, text: 'The key works.', risk: { p: 0.3, fx: { rep: [-3, 60], cash: -40000 }, text: 'The key works, and then the family data shows up for sale anyway. You are legally required to tell every parent.' } },
    ] },
  { id: 'windfall', w: 2, when: (S) => yr(S) >= 1 && S.city.rivals[2] && S.city.rivals[2].open, title: 'A School Closes', who: 'Director of Admission',
    text: (S) => S.city.rivals[2].name + ' has announced it will close in June. Forty families are suddenly looking, and most of them are looking at you. They are used to paying half your tuition.',
    choices: [
      { label: 'Welcome them with a transition discount.', run: (S) => { const add = admitWave(S, 34, 0.35); S.city.rivals[2].open = false; applyFx(S, { rep: [1.5, 60], sat: [-1, 30] }, 'Parish families'); return add + ' students enroll with two years of reduced tuition. Classes are fuller and the hallways louder. A few current parents ask why they pay full price.'; }, tags: [['good', 'Enrollment ▲'], ['bad', 'Aid ▲']] },
      { label: 'Admit those who can pay and qualify.', run: (S) => { const add = admitWave(S, 12, 0); S.city.rivals[2].open = false; return add + ' students enroll at full tuition. The rest scatter to public schools and the charter.'; }, tags: [['good', 'Enrollment ▲']] },
    ] },
  { id: 'union', w: 3, when: (S) => S.morale < 38, title: 'Cards Are Being Signed', who: 'A friendly warning',
    text: () => 'A teacher you trust tells you quietly that a union organizer met with faculty at a coffee shop on Tuesday. Thirty people came.',
    choices: [
      { label: 'Meet the faculty and put real money on the table.', fx: { cash: -150000, morale: [10, 80], board: -2 }, text: 'An emergency salary adjustment and a standing faculty compensation committee. The organizer stops returning calls.' },
      { label: 'Hire a labor lawyer.', fx: { cash: -70000, morale: [-6, 80], rep: [-2, 60] }, text: 'Mandatory "informational meetings." The vote fails narrowly. The faculty room goes quiet when you walk in.' },
      { label: 'Recognize the union.', fx: { morale: [8, 100], board: -6 }, run: (S) => { S.flags.union = true; }, text: 'A first contract takes a year to negotiate. Pay scales are now public, predictable and not entirely yours to set.' },
    ] },
  { id: 'accred', w: 2, when: (S) => yr(S) >= 2 && !S.flags.accred, title: 'The Visiting Team', who: 'Regional accreditation',
    text: () => 'Twelve educators from other schools spend four days in your classrooms, your files and your budget. Their report goes to the board.',
    choices: [
      { label: 'Show them everything.', run: (S) => { S.flags.accred = true; const eq = EQavg(S), fin = projNet(S) >= 0; let n = 0; if (eq >= 62) n++; if (fin) n++; if (S.morale >= 55) n++; if (avgCond(S) >= 60) n++; applyFx(S, { board: (n - 2) * 3, rep: [(n - 2) * 1.5, 80] }, 'Accreditation report'); return n >= 3 ? 'Full reaccreditation with commendations for teaching and stewardship. The chair of the visiting team asks if you are hiring.' : n === 2 ? 'Reaccredited, with a list of "major recommendations" the board reads very carefully.' : 'Reaccredited on a shortened term, with a required progress report on finances and facilities. The board chair wants to talk.'; }, note: 'They grade teaching, finances, morale and campus.' },
    ] },
  { id: 'legacyfam', w: 3, when: (S) => S.lastTuitionPct >= 6, title: 'Four Children, One Email', who: 'A third-generation family',
    text: (S) => 'A family with four children enrolled says the ' + S.lastTuitionPct + '% increase is the last straw. Their grandfather’s name is on the library door.',
    choices: [
      { label: 'Offer a sibling discount, for everyone.', fx: { cash: -70000, sat: [3, 60] }, text: 'A new sibling discount, school-wide. It costs real money and several large families stop touring elsewhere.' },
      { label: 'Offer them a private arrangement.', fx: { cash: -25000 }, text: 'They stay.', risk: { p: 0.4, fx: { sat: [-4, 50] }, text: 'They stay, and they tell people. By Friday the business office has eleven requests for "the same deal."' } },
      { label: 'Hold firm.', fx: { sat: [-2, 40], giving: [-5, 60] }, run: (S) => { for (const g of [1, 4, 7, 10]) if (S.grades[g].n > 4) S.grades[g].n--; }, text: 'They withdraw all four. The name stays on the library door, which is awkward for everyone.' },
    ] },
  { id: 'solarkids', w: 2, when: (S) => !has(S, 'solar'), title: 'A Student Proposal', who: 'The Environmental Club',
    text: () => 'Six students present a forty-slide plan for a composting program and a pilot solar canopy over the parking lot. They have done the math. Most of it is right.',
    choices: [
      { label: 'Fund the pilot.', fx: { cash: -38000, sat: [2, 50], rep: [1, 60] }, text: 'The canopy powers the lower school office. The students present at a state conference and one of them is quoted in the paper.' },
      { label: 'Praise the work, fund the compost bins.', fx: { cash: -3000, sat: [0.5, 20] }, text: 'They get compost bins. They are polite about it.' },
    ] },
  { id: 'merit', w: 2, when: (S) => profileAvg(S) > 54, title: 'A Banner Year', who: 'College counseling',
    text: () => 'Four National Merit finalists, a Regeneron semifinalist and a debate team headed to nationals. The admission office wants to buy a billboard.',
    choices: [
      { label: 'Buy the billboard.', fx: { cash: -22000, apps: [10, 60], rep: [1.5, 60] }, text: 'It goes up on the highway into downtown. Inquiries rise, and so does the pressure on next year’s juniors.' },
      { label: 'Tell the story in the alumni magazine.', fx: { giving: [6, 50], rep: [0.5, 40] }, text: 'Alumni love it. A few write checks.' },
    ] },
  { id: 'roof', w: 3, when: (S) => avgCond(S) < 52 && season(S) !== 'winter', title: 'Buckets in the Hallway', who: 'Head of maintenance',
    text: (S) => 'The roof over ' + BUILDINGS[worstBuilding(S).t].name + ' has failed in three places. A tour of prospective families walked past the buckets this morning.',
    choices: [
      { label: 'Replace the roof.', fx: { cash: -150000 }, run: (S) => { worstBuilding(S).cond = Math.min(100, worstBuilding(S).cond + 18); }, text: 'Six weeks of scaffolding and a roof that will outlast you.' },
      { label: 'Patch the leaks.', fx: { cash: -30000, sat: [-2, 40], apps: [-5, 40] }, text: 'The buckets come and go with the weather. Tour guides learn a new route.' },
    ] },
  { id: 'dinner', w: 2, when: (S) => !!S.campaign, title: 'The Lead Gift', who: 'Director of Advancement',
    text: () => 'The campaign needs a lead gift. One family could give it. They have asked for dinner with you, alone, and they have questions about where the school is going.',
    choices: [
      { label: 'Share the honest plan, problems included.', run: (S) => { if (S.rep >= 55 || S.board >= 65) { S.campaign.final *= 1.15; return 'They appreciate being treated like adults. The pledge arrives the next week and lifts the whole campaign.'; } S.campaign.final *= 0.97; return 'They listen carefully and decide to "wait and see." Fair enough.'; }, tags: [['good', 'Campaign ▲ if the school is on solid ground']] },
      { label: 'Sell the dream.', run: (S) => { if (rnd(S) < 0.5) { S.campaign.final *= 1.2; return 'You are good at this. They pledge more than you asked for.'; } S.campaign.final *= 0.92; return 'They have read your audit. The dream did not match the footnotes.'; }, tags: [['warn', 'A coin flip']] },
    ] },
  { id: 'snow', w: 3, when: (S) => season(S) === 'winter', title: 'Six Inches by Morning', who: 'Director of Facilities, 9:15 p.m.',
    text: () => 'The forecast says six inches by morning, or possibly none. Every other school in the city is waiting to see what you do, and several hundred families are refreshing their email.',
    choices: [
      { label: 'Close now, so families can plan.', fx: { sat: [1.5, 20] }, text: 'It snows eight inches. You are, briefly, the most popular adult in the city.',
        risk: { p: 0.35, fx: { sat: [-3, 25] }, text: 'The storm misses by forty miles and the sun is out by nine. Parents with jobs will bring this up until June.' } },
      { label: 'Call a two-hour delay.', fx: {}, text: 'The plows get through. A two-hour delay pleases nobody and harms nobody, which is the point of one.',
        risk: { p: 0.3, fx: { sat: [-4, 40], rep: [-1, 40] }, text: 'A bus slides into a ditch at 9:40. Nobody is hurt. Everybody has a phone.' } },
      { label: 'Decide at 5 a.m. with real information.', fx: { morale: [-2, 20] }, text: 'You make the right call at 5:10 a.m. The teachers who left home at 5:00 have feelings about it.' },
    ] },
  { id: 'prank', w: 2, when: (S) => season(S) === 'spring', title: 'Goat Number Three', who: 'Upper School head, out of breath',
    text: () => 'The seniors have released three goats in the Upper School, wearing the numbers 1, 2 and 4. Facilities has spent two hours looking for goat number 3.',
    choices: [
      { label: 'Laugh, and tell the story at commencement.', fx: { sat: [2, 40], morale: [-1.5, 30] }, text: 'The seniors adore you. The custodians, who met the goats first, adore you somewhat less.' },
      { label: 'Seniors clean up and cook breakfast for the facilities crew.', fx: { cash: -1500, sat: [1.5, 40], morale: [2.5, 40] }, text: 'Forty seniors in aprons flip pancakes for the maintenance staff. The goats go home. It is the best assembly of the year.' },
      { label: 'Bar the organizers from senior week.', fx: { sat: [-2.5, 40], morale: [1, 20] }, text: 'Rules are rules. The class gift this year is noticeably small.' },
    ] },
  { id: 'offer', w: 2, when: (S) => yr(S) >= 3 && S.rep >= 55, title: 'A Call from a Search Firm', who: 'A consultant you have met twice',
    text: () => 'A larger school two states away is looking for a head, and your name came up. The salary is half again what you make. She only wants "a conversation."',
    choices: [
      { label: 'Tell your board chair about the call, and stay.', fx: { board: 3 }, text: 'She is quiet for a moment, then thanks you for telling her. Your next contract reflects the conversation.' },
      { label: 'Take the conversation quietly.', fx: {}, text: 'It is flattering. On the flight home you realize you have unfinished work here.',
        risk: { p: 0.45, fx: { board: -7, morale: [-3, 40] }, text: 'A trustee’s college roommate sits on that search committee. Your chair hears about it at a wedding.' } },
      { label: 'Say no before she finishes the pitch.', fx: { morale: [1, 30] }, text: 'You tell no one. Somehow the faculty know by Friday, and they are pleased.' },
    ] },
  { id: 'gala', w: 3, when: (S) => season(S) !== 'summer', title: 'The Auction Catalog', who: 'Parents’ Association',
    text: () => 'The spring gala catalog is ready for your approval. Among the live auction items: front-row seats at graduation, a reserved parking space, and first choice of next year’s homeroom teacher.',
    choices: [
      { label: 'Approve it all. It is for the school.', fx: { cash: 70000, sat: [-3, 50], morale: [-3, 40] }, text: 'A record night. The teacher item sells for $9,000, and every family that could not bid learns exactly what was for sale.' },
      { label: 'Strike the teacher item and keep the rest.', fx: { cash: 45000, morale: [1.5, 30] }, text: 'A good night. The parking space goes for more than a used car.' },
      { label: 'Make it a free community night instead.', fx: { cash: -12000, sat: [3, 50], giving: [3, 40] }, text: 'Potluck tables, a student band and no paddles. It raises nothing that night. The annual fund has a good spring.' },
    ] },
  { id: 'viral', w: 2, when: (S) => S.fq > 48, title: 'Eleven Million Views', who: 'Director of Communications',
    text: () => 'A history teacher has been explaining the Peloponnesian War online with sock puppets. The videos have eleven million views. A streaming company has called him, and three parents have called you.',
    choices: [
      { label: 'Give him a studio and one fewer class.', fx: { cash: -20000, apps: [9, 70], rep: [1.5, 60], morale: [-1.5, 30] }, text: 'Admission tours now stop at his door. Several colleagues ask where their studios are.' },
      { label: 'Let it ride.', fx: { apps: [4, 40] }, text: 'The views keep climbing. So do inquiries.',
        risk: { p: 0.3, fx: { cash: -15000, sat: [-3, 40] }, text: 'A student whose family had opted out of all photography is clearly visible in episode nine. Lawyers are involved, briefly and expensively.' } },
      { label: 'Ask him to keep the school out of it.', fx: { morale: [-2, 30] }, text: 'He complies, and keeps teaching.',
        risk: { p: 0.4, fx: { fq: -0.8, sat: [-1, 30] }, text: 'He complies until June, then signs with the streaming company. The sock puppets go with him.' } },
    ] },
  { id: 'ap', w: 2, when: (S) => S.prog.acad >= 2 && !S.flags.apAsk, title: 'Drop the APs?', who: 'Academic council',
    text: () => 'The department chairs want to replace Advanced Placement courses with seminars of their own design. They say the tests have become the curriculum. Parents of juniors have heard, and they have a group chat.',
    choices: [
      { label: 'Adopt the school’s own advanced courses.', fx: { eq: [2.5, 140], morale: [4, 60], sat: [-3, 50] }, run: (S) => { S.flags.apAsk = 1; }, text: 'Teachers rebuild their courses over the summer with real energy. Parents ask, at every coffee, how colleges will know what an A means.',
        risk: { p: 0.3, fx: { rep: [-2, 80] }, text: 'The courses are better. Two colleges nonetheless say they "could not assess the rigor" of this year’s transcripts, and that sentence travels.' } },
      { label: 'Run both for three years and compare.', fx: { cash: -60000, eq: [1, 100] }, text: 'More sections, more cost, and real evidence at the end of it.' },
      { label: 'Keep the APs.', fx: { morale: [-2.5, 40] }, text: 'The chairs accept it. The proposal goes back in the drawer it came from.' },
    ] },
  { id: 'mascot', w: 2, when: (S) => !S.flags.mascot, title: 'The Mascot', who: 'Student council',
    text: () => 'Two hundred students have signed a petition to retire the school mascot, a scowling Colonel last redrawn in 1958. An alumni group has answered with a petition of its own, and a banner.',
    choices: [
      { label: 'Retire the Colonel. Let students choose what is next.', fx: { sat: [2, 50], giving: [-8, 70], rep: [1, 40] }, run: (S) => { S.flags.mascot = 1; later(S, 'mascot2', 30); }, text: 'The Colonel is retired with a ceremony more dignified than he was. Several classes from the 1970s pause their giving.' },
      { label: 'Keep the Colonel.', fx: { giving: [3, 40], sat: [-2, 40] }, run: (S) => { S.flags.mascot = 1; }, text: 'The Colonel scowls on. Students start wearing him ironically, which is worse.' },
      { label: 'Appoint a committee.', fx: { morale: [-1, 20] }, run: (S) => { S.flags.mascot = 1; later(S, 'mascot2', 44); }, text: 'The committee meets nine times and holds two listening sessions. It will report next year.' },
    ] },
  { id: 'mascot2', w: 0, title: 'The Vote', who: 'Student council',
    text: () => 'The ballots are in for a new mascot. The finalists are the Herons, the Foxes and, thanks to a write-in campaign nobody can trace, the Fighting Geese.',
    choices: [
      { label: 'Announce the winner: the Herons.', fx: { cash: -18000, sat: [1.5, 40] }, text: 'New uniforms, a new logo on the gym floor and a seven-foot heron costume. Kindergarten is thrilled.' },
      { label: 'Honor the write-in. Geese it is.', fx: { cash: -18000, sat: [3, 50], rep: [1, 50] }, text: 'The Fighting Geese sell more sweatshirts in a month than the Colonel sold in a decade. Opposing teams are unsettled.',
        risk: { p: 0.25, fx: { giving: [-4, 50] }, text: 'The sweatshirts sell out in a week. A few donors of a certain age ask whether the school still takes itself seriously.' } },
    ] },
  { id: 'security', w: 2, title: 'The Front Door', who: 'A full parents’ meeting',
    text: () => 'After a frightening week in the national news, three hundred parents fill the gym. They want to know who can walk into this school, and what you are going to do about it.',
    choices: [
      { label: 'Build a secure entrance and hire a safety director.', fx: { cash: -150000, sat: [3.5, 70] }, text: 'A staffed vestibule, new locks and a calm professional who knows every child’s name by October.' },
      { label: 'Train the staff and fix the locks.', fx: { cash: -40000, sat: [1.5, 50], morale: [1, 30] }, text: 'Threat-assessment training, working locks and a plan everyone has practiced. Less visible, and most of what the experts recommend.' },
      { label: 'Send a reassuring letter.', fx: { sat: [-3.5, 60] }, text: 'The letter is well written. It is forwarded widely, with commentary.' },
    ] },
  { id: 'land', w: 2, when: (S) => yr(S) >= 1 && !S.flags.landAsk, title: 'The Lot Next Door', who: 'A neighbor of forty years',
    text: (S) => 'The widow who owns the two acres behind the athletic fields is moving to be near her grandchildren. A developer has offered her ' + money(1400000 * S.costIdx) + '. She would rather sell to the school for ' + money(1100000 * S.costIdx) + ', if you can decide by Friday.',
    choices: [
      { label: 'Buy it.', fx: { board: 1 }, run: (S) => { const c = 1100000 * S.costIdx; S.flags.landAsk = 1; S.flags.land = true; if (S.cash < c + 250000 * S.costIdx) { takeDebt(S, c); S.cash -= c; S.ytd.capital += c; return 'The bank lends against the land itself, and the school grows by two acres. Faculty Housing and the Stadium will now cost far less to build.'; } S.cash -= c; S.ytd.capital += c; }, text: 'You pay cash, and the school grows by two acres. Faculty Housing and the Stadium will now cost far less to build.', tags: (S) => [['bad', S.cash < 1350000 * S.costIdx ? 'Debt +' + money(1100000 * S.costIdx) : money(-1100000 * S.costIdx)], ['good', 'Housing and Stadium cost 40% less']] },
      { label: 'Thank her and pass.', run: (S) => { S.flags.landAsk = 1; const nb = S.city.nbs.find((n) => n.type === 'south'); nb.kids += 14; applyFx(S, { sat: [-1.5, 50] }, 'Construction next door'); }, text: 'Forty townhouses go up along the fence line. The construction is loud. The families who move in are young.', tags: [['bad', 'Families ▼'], ['good', 'More children nearby']] },
    ] },
  { id: 'counsel', w: 2, when: (S) => S.prog.coll >= 2 && (season(S) === 'fall' || season(S) === 'winter'), title: 'One Phone Call', who: 'Parents of a senior',
    text: () => 'A senior has applied early to the university his father attended. His parents want your college counselor to call the dean of admission and "advocate." She has explained that it does not work that way. They would now like you to make the call.',
    choices: [
      { label: 'Back the counselor.', fx: { morale: [3, 50], giving: [-5, 50] }, text: 'He is deferred, then admitted in April. The parents credit their own persistence.' },
      { label: 'Make the call yourself.', fx: { giving: [5, 40], morale: [-4, 50] }, text: 'The dean is courteous. Your counselor is not, for some weeks.',
        risk: { p: 0.4, fx: { rep: [-2, 80] }, text: 'The dean is courteous and makes a note. Your next three applicants there are wait-listed.' } },
      { label: 'Invite the family in to talk through the whole list.', fx: { sat: [1, 30], morale: [1, 30] }, text: 'An hour with you and the counselor, a longer list and a calmer family. Mostly.' },
    ] },
  { id: 'remit', w: 2, when: (S) => !S.flags.remitAsk, title: 'Faculty Children', who: 'Faculty council',
    text: () => 'Teachers’ children attend at half tuition. The faculty council asks for full remission. "We teach everyone else’s children here," the letter says. "Most of us cannot afford to send our own."',
    choices: [
      { label: 'Full remission, starting this fall.', fx: { morale: [6, 120] }, run: (S) => { S.flags.remit = true; S.flags.remitAsk = 1; }, text: 'Nine faculty children enroll in September. Job postings now draw twice the applicants.', tags: [['good', 'Stronger hires for good'], ['bad', '−$85k every year']] },
      { label: 'Raise it to 75%.', fx: { cash: -35000, morale: [3, 60] }, run: (S) => { S.flags.remitAsk = 1; }, text: 'A real step. The council thanks you and notes, politely, that it is a step.' },
      { label: 'Not this year.', fx: { morale: [-3.5, 50] }, run: (S) => { S.flags.remitAsk = 1; }, text: 'You explain the budget. A veteran teacher enrolls her twins across town, where her husband teaches.' },
    ] },
  { id: 'lice', w: 2, when: (S) => season(S) === 'fall', title: 'A Note Home', who: 'School nurse',
    text: () => 'The Lower School has lice. Not a class. The Lower School.',
    choices: [
      { label: 'Bring in professional screeners for every grade.', fx: { cash: -9000, sat: [1, 30] }, text: 'Two days, every head checked, done. Parents are grateful in the way people are grateful to a dentist.' },
      { label: 'Send the letter and trust families to check.', fx: {}, text: 'It clears up in a week.',
        risk: { p: 0.5, fx: { sat: [-2.5, 40], morale: [-1.5, 30] }, text: 'It does not clear up. The second wave reaches the faculty room, and then your house.' } },
    ] },
  { id: 'speaker', w: 2, when: (S) => season(S) === 'winter' || season(S) === 'spring', title: 'The Commencement Speaker', who: 'Senior class officers',
    text: () => 'The seniors have voted for their commencement speaker: an alumna who is now a famous comedian. Her act includes ten minutes about this school. Your board chair has already invited a senator.',
    choices: [
      { label: 'The comedian. It is their graduation.', fx: { sat: [2, 40], rep: [1, 40] }, text: 'She is funny, generous and, at the end, unexpectedly moving. Grandparents ask for her autograph.',
        risk: { p: 0.3, fx: { board: -3 }, text: 'She does eleven minutes on the dress code and names two trustees. It is the most-watched commencement in school history. Your chair is not laughing.' } },
      { label: 'The senator.', fx: { board: 1, sat: [-1.5, 30] }, text: 'Twenty-two minutes on civic duty. The seniors are polite. Their beach balls are not.' },
      { label: 'Ask the seniors to choose a teacher instead.', fx: { morale: [3, 40], sat: [1, 30] }, text: 'They pick the physics teacher. He speaks for six minutes and half the faculty cries.' },
    ] },
  { id: 'brand', w: 2, title: 'The Brand Refresh', who: 'A consultancy with a very nice deck',
    text: (S) => 'For ' + money(85000 * S.costIdx) + ', a branding firm will give ' + S.name + ' a new logo, a new palette and a tagline: "Where Curiosity Meets Tomorrow." The crest would be "simplified."',
    choices: [
      { label: 'Buy the refresh.', fx: { cash: -85000, apps: [7, 70] }, text: 'The new website is handsome and inquiries rise. Nobody can recite the tagline, including you.',
        risk: { p: 0.4, fx: { giving: [-6, 60] }, text: 'The new website is handsome. The alumni have found the simplified crest, and they have found each other.' } },
      { label: 'Give the project to the art department and its students.', fx: { cash: -6000, sat: [1.5, 40], apps: [3, 50], morale: [1, 30] }, text: 'A junior redraws the crest by hand. It is on every sweatshirt by spring, and it cost you a pizza budget.' },
      { label: 'Keep what you have.', fx: {}, text: 'The deck goes in a drawer. The crest remains complicated.' },
    ] },
  { id: 'vip', w: 2, when: (S) => S.rep >= 50, title: 'A Famous Last Name', who: 'Director of Admission, whispering',
    text: () => 'A family everyone has heard of is moving to town. They want their two children enrolled next week, without testing or interviews, and they would like the school to say nothing about it.',
    choices: [
      { label: 'Enroll them quietly.', fx: { apps: [8, 60], morale: [-2, 40] }, run: (S) => { S.grades[3].n++; S.grades[7].n++; }, text: 'Two new students, and by Thursday every parent in the city knows who is in the carline. The admission committee would like to know what it is for.',
        risk: { p: 0.35, fx: { sat: [-2.5, 40] }, text: 'Two new students, a security detail in the parking lot and photographers at the gate. Parents are less charmed than they expected to be.' } },
      { label: 'Welcome them into the regular process.', run: (S) => { applyFx(S, { morale: [2, 40] }, 'Held the standard'); if (rnd(S) < 0.5) { S.grades[3].n++; S.grades[7].n++; applyFx(S, { rep: [2, 60] }, 'Held the standard'); return 'They apply like everyone else, and the children are delightful. The family tells people this is the first school that treated them normally.'; } const r = eliteRival(S); r.rep = clamp(r.rep + 2, 20, 95); return 'They enroll at ' + r.name + ' the next morning. Your admission staff stand a little taller anyway.'; }, tags: [['good', 'Faculty ▲'], ['warn', 'A coin flip']] },
    ] },
  { id: 'veteran', w: 2, title: 'The Yellow Notes', who: 'Upper School head',
    text: () => 'A teacher in his thirty-first year lectures from the same yellowed notes he wrote in his first. Alumni adore him. This year’s parents have started a spreadsheet.',
    choices: [
      { label: 'A real coaching plan, with real support.', fx: { cash: -12000 }, run: (S) => { if (sk(S, 'academic') >= 3) { applyFx(S, { eq: [1.5, 110], morale: [2, 40] }, 'A veteran renewed'); return 'Your Dean of Faculty sits in his class every week for a semester. By spring he has thrown out the notes and is teaching the best course of his career.'; } applyFx(S, { sat: [-1.5, 40] }, 'The yellow notes'); return 'Without a strong Dean of Faculty to run it, the plan is a memo. The notes remain yellow.'; }, note: 'Works with a strong Dean of Faculty.' },
      { label: 'Buy out his contract.', fx: { cash: -70000, fq: 0.6, morale: [-4, 50], giving: [-4, 50] }, text: 'He leaves with a generous check and a standing ovation he did not ask for. The faculty do the arithmetic on their own years of service.' },
      { label: 'Leave him be.', fx: { sat: [-2.5, 50] }, text: 'He has earned it, you tell yourself. The spreadsheet gets a second tab.' },
    ] },
  { id: 'merger', w: 1, when: (S) => yr(S) >= 3 && S.city.rivals[1].open && S.rep > S.city.rivals[1].rep + 6, title: 'A Quiet Lunch', who: 'A rival’s board chair',
    text: (S) => S.city.rivals[1].name + ' is running out of road. Over lunch, their chair proposes a merger: you take their students, their best teachers and ' + money(900000 * S.costIdx) + ' of their debt. Their campus would be sold.',
    choices: [
      { label: 'Merge the schools.', fx: { fq: 0.8, board: 2, sat: [-2.5, 50] }, run: (S) => { const add = admitWave(S, 80, 0.2, 11); S.debt += 900000 * S.costIdx; S.city.rivals[1].open = false; return add + ' students arrive in new sweatshirts, along with a dozen teachers’ worth of experience and one large loan. Check staffing before classes feel it.'; }, tags: [['good', 'Enrollment ▲'], ['bad', 'Debt ▲']] },
      { label: 'Decline, and hire their best teachers.', fx: { cash: -20000, fq: 0.8 }, run: (S) => { const r = S.city.rivals[1]; r.rep = clamp(r.rep - 5, 20, 95); r.rep0 -= 4; }, text: 'They limp on. Three of their strongest teachers are yours by August, which does not help them.' },
      { label: 'Decline.', fx: {}, text: 'You wish them well and mean it.' },
    ] },
  { id: 'rest', w: 2, when: (S) => yr(S) >= 1, title: 'Forty-One Days', who: 'Your assistant, kindly',
    text: () => 'Your assistant has counted. You have worked forty-one days in a row, including the Saturday you called "just a few emails." She has blocked next week on your calendar and is waiting to see what you do.',
    choices: [
      { label: 'Take the week.', fx: { board: -1, morale: [1.5, 30] }, text: 'The school does not burn down. Several people are surprised, including you. You come back with two good ideas and a tan.' },
      { label: 'Take a long weekend.', fx: {}, text: 'Three days. You check email only twice an hour.' },
      { label: 'Unblock the calendar.', fx: { board: 1 }, text: 'You power through, and it works. This time.',
        risk: { p: 0.45, fx: { board: -2, sat: [-1.5, 30], morale: [-1.5, 30] }, text: 'You power through until the flu makes the decision for you. Two weeks out, in February, with the budget due.' } },
    ] },
  { id: 'chair', w: 2, when: (S) => yr(S) >= 2 && !S.flags.chair, title: 'A New Chair', who: 'The Chair of the Board',
    text: () => 'Your board chair is stepping down in June after nine years. She can steer the choice of her successor, and she is asking who you could work with.',
    choices: [
      { label: 'The banker who chairs the finance committee.', run: (S) => { S.flags.chair = 'bank'; }, text: 'He reads every footnote. Lenders take his calls, and you will take his, at 6:45 a.m. A deficit budget will now cost you twice as much with the board.', tags: [['good', 'Cheaper borrowing'], ['bad', 'Deficits hurt more']] },
      { label: 'The alumna who led the last campaign.', run: (S) => { S.flags.chair = 'alum'; }, text: 'She knows every donor by first name, and she expects an advancement office worthy of them.', tags: [['good', 'Giving ▲ for good'], ['bad', 'Expects a Director of Advancement']] },
      { label: 'The parent of three who runs the auction.', run: (S) => { S.flags.chair = 'parent'; }, text: 'She hears what parents are saying, usually before you do. She will not forgive a tuition increase above 5%.', tags: [['good', 'Families ▲ for good'], ['bad', 'Big tuition increases hurt more']] },
    ] },
  { id: 'start', w: 2, when: (S) => !S.flags.lateStart, title: 'First Period', who: 'The school counselor and a pediatrician on your board',
    text: () => 'The research is not subtle: teenagers learn badly at 7:50 a.m. The proposal is to start the Upper School at 9:00. Coaches, bus drivers and every parent with a commute have concerns.',
    choices: [
      { label: 'Start at 9:00.', fx: { eq: [2, 130], sat: [-2.5, 40], morale: [1, 30] }, run: (S) => { S.flags.lateStart = 1; }, text: 'First-period grades rise and the nurse sees fewer students. Practices end in the dark, and carpools need a spreadsheet.' },
      { label: 'Try late-start Wednesdays.', fx: { eq: [0.8, 90] }, run: (S) => { S.flags.lateStart = 1; }, text: 'One humane morning a week. Students call it the best thing the school has ever done.' },
      { label: 'Keep the schedule.', fx: {}, text: 'The bell rings at 7:50. The research remains unsubtle.' },
    ] },
  { id: 'divest', w: 2, when: (S) => S.endow > 4e6, title: 'Divest', who: 'Students, with a slide deck',
    text: () => 'Sixty students and eleven teachers ask the board to move the endowment out of fossil fuels. The investment committee warns it could cost returns. The students have brought the committee’s own spreadsheet.',
    choices: [
      { label: 'Recommend divestment to the board.', fx: { sat: [1.5, 40], rep: [1.5, 60], board: -2 }, run: (S) => { S.endow *= 0.985; }, text: 'The board agrees, eight to six. Rebalancing costs about 1.5% of the endowment. The students are quoted in the paper.', tags: [['bad', 'Endowment −1.5%']] },
      { label: 'Give students a seat on the investment committee.', fx: { sat: [1, 30], board: -1 }, text: 'Two seniors now attend the quarterly meetings. They read the materials more closely than most trustees.' },
      { label: 'The endowment is not a debate topic.', fx: { sat: [-1.5, 30], morale: [-1, 30] }, text: 'The answer is no. The students hold a teach-in on the quad. It is well attended.' },
    ] },
  { id: 'naming', w: 3, when: (S) => !!S.campaign || S.builds.some((b) => BUILDINGS[b.t].sig), title: 'Naming Rights', who: 'Director of Advancement',
    text: (S) => 'A donor will give ' + money(1500000 * S.costIdx) + ' to put his family name on a building. His company spent last year in the news for cheating its workers out of overtime.',
    choices: [
      { label: 'Take the gift and put up the name.', fx: { campaign: 1500000 }, text: 'The letters go up in brushed steel. The building fund is much healthier.',
        risk: { p: 0.4, fx: { rep: [-4, 100], sat: [-2, 50] }, text: 'The letters go up in brushed steel. Within a week students have taped a pay stub over them, and the photograph is in the paper.' } },
      { label: 'Ask him to give anonymously.', run: (S) => { if (rnd(S) < 0.35) { applyFx(S, { campaign: 1500000 }, 'Anonymous gift'); return 'He thinks about it for a week and then, to everyone’s surprise, agrees. The building fund grows and the name stays off the wall.'; } applyFx(S, { giving: [-3, 40] }, 'A gift declined'); return 'He does not see the point of a gift nobody knows about. The money goes elsewhere.'; }, tags: [['warn', 'A long shot']] },
      { label: 'Decline the gift.', fx: { board: -2, morale: [2, 40], rep: [1, 50] }, text: 'The board chair sighs audibly. The faculty hear about it and so, eventually, does the newspaper, which is kind.' },
    ] },
  { id: 'val', w: 2, when: (S) => season(S) === 'spring', title: 'Two Hundredths of a Point', who: 'Registrar',
    text: () => 'Two seniors finish with averages of 4.412 and 4.410. The family in second place believes a dropped course was weighted wrongly, and their attorney has written to say so.',
    choices: [
      { label: 'Name them both.', fx: { sat: [0.5, 20] }, text: 'Two valedictorians, two speeches. Both are about fairness. Neither is short.' },
      { label: 'Stand by the registrar.', fx: { morale: [2, 30] }, text: 'The numbers stand, and so does the registrar, who has been right since 1998.',
        risk: { p: 0.35, fx: { cash: -35000 }, text: 'The numbers stand. The lawsuit that follows is dismissed in August, after it has cost you the price of a minibus.' } },
      { label: 'End class rank after this year.', fx: { sat: [-1, 30], eq: [0.8, 80], morale: [1, 30] }, text: 'This year’s two share the title. Next year’s juniors stop choosing courses by decimal point.' },
    ] },
  { id: 'grant', w: 2, when: (S) => yr(S) >= 1 && !S.flags.saturday, title: 'A Foundation Calls', who: 'A program officer',
    text: (S) => 'A local foundation will give ' + money(200000 * S.costIdx) + ' to start a free Saturday academy on your campus for middle schoolers from across the city. Your teachers would staff it, and the grant does not cover everything.',
    choices: [
      { label: 'Say yes.', fx: { cash: 120000, rep: [2.5, 140], apps: [6, 140], morale: [-1.5, 60] }, run: (S) => { saturdayAcademy(S); }, text: 'Ninety children arrive on the first Saturday. Some of their families had never been through your gates. Some of them will apply.' },
      { label: 'Say yes, and pay the teachers properly for it.', fx: { cash: 40000, rep: [2.5, 140], apps: [6, 140], morale: [1.5, 60] }, run: (S) => { saturdayAcademy(S); }, text: 'Ninety children, and teachers who are glad to be there. The grant covers most of it.' },
      { label: 'Decline. The faculty are stretched.', fx: {}, run: (S) => { S.flags.saturday = 1; }, text: 'The foundation takes the idea across town. Your Saturdays stay quiet.' },
    ] },
];
const EVENT_BY = {}; EVENTS.forEach((e) => (EVENT_BY[e.id] = e));
function saturdayAcademy(S) { S.flags.saturday = 1; for (const nb of S.city.nbs) if (nb.type === 'working' || nb.type === 'middle') nb.aware = clamp(nb.aware + 0.15, 0, 1); }

/* Adds a wave of mid-year students across K-8 (or up to maxG), some on aid. Returns how many fit. */
function admitWave(S, n, aidFrac, maxG) {
  let added = 0;
  for (let x = 0; x < n; x++) {
    const g = ri(S, 0, maxG || 8), G = S.grades[g];
    if (G.n + 1 > capG(S, g) * 1.08) continue;
    G.q = (G.q * G.n + 47) / (G.n + 1); G.n++; G.aid += aidFrac; if (aidFrac > 0) G.an++; added++;
  }
  return added;
}
function pickEvent(S) {
  const y = yr(S), pool = [];
  for (const e of EVENTS) {
    if (!e.w) continue;
    if (S.evLast[e.id] != null && y - S.evLast[e.id] < 4) continue;
    if (e.when && !e.when(S)) continue;
    pool.push(e);
  }
  if (!pool.length) return null;
  let t = rnd(S) * sum(pool.map((e) => e.w));
  for (const e of pool) { t -= e.w; if (t <= 0) return e; }
  return pool[0];
}
function queueEvent(S, id) { S.evLast[id] = yr(S); S.pending.push({ type: 'event', id, block: true }); }
function choiceTags(S, c) {
  const t = fxTags(S, c.fx).concat(typeof c.tags === 'function' ? c.tags(S) : c.tags || []);
  if (c.risk) t.push(['warn', 'Risk']);
  return t;
}
/* Returns the outcome text and clears the event. */
function resolveEvent(S, id, idx) {
  const e = EVENT_BY[id], c = e.choices[idx];
  let text = c.text || '';
  applyFx(S, c.fx, e.title);
  if (c.run) { const r = c.run(S); if (typeof r === 'string') text = r; }
  if (c.risk && rnd(S) < c.risk.p) { applyFx(S, c.risk.fx, e.title); text = c.risk.text; }
  if (S.flags.rink && !S.flags.rinkMod) { S.flags.rinkMod = true; }
  S.pending = S.pending.filter((p) => !(p.type === 'event' && p.id === id));
  log(S, e.title + ': ' + c.label.replace(/\.$/, ''), 'info');
  return text;
}
