// Zagreb Park-Šuma Bingo — game logic.
// Officially protected park-šume (forest parks) of the City of Zagreb.
const PARKS = [
  "Susedgrad","Lisičine","Grmoščica","Šestinski dol","Zamorski breg",
  "Vrhovec","Jelenovac","Pantovčak","Prekrižje","Kraljevec",
  "Zelengaj","Tuškanac","Dubravkin put","Cmrok","Remetski kamenjak",
  "Mirogoj","Remete","Maksimir","Dotrščina","Miroševečina",
  "Dankovečina","Granešina","Oporovec","Čulinečina"
];
const FREE = 12;                       // center cell
const STORAGE_KEY = "parkSumaBingo:v1"; // localStorage slot

const board = document.getElementById('board');
const countEl = document.getElementById('count');
const banner = document.getElementById('banner');
const bannerMsg = document.getElementById('banner-msg');

function shuffle(a){ a=a.slice(); for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]];} return a; }
function mapsLink(name){ return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent("Park-šuma " + name + " Zagreb"); }

let cells = [];

// --- persistence -----------------------------------------------------------
// Saved shape: { order: [24 park names in cell order], marked: [park names] }.
// Keyed by name (not position) so it survives code tweaks and re-layouts.
function loadState(){
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if(!s || !Array.isArray(s.order) || s.order.length !== PARKS.length) return null;
    const set = new Set(s.order);                       // must be a full permutation
    if(set.size !== PARKS.length || !PARKS.every(p => set.has(p))) return null;
    return { order: s.order, marked: new Set(Array.isArray(s.marked) ? s.marked : []) };
  } catch(e){ return null; }                            // bad JSON / storage off
}

function saveState(){
  try {
    const order = [], marked = [];
    cells.forEach((c,i) => {
      if(i === FREE) return;
      order.push(c.dataset.name);
      if(c.classList.contains('marked')) marked.push(c.dataset.name);
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ order, marked }));
  } catch(e){ /* storage unavailable (private mode etc.) — run without it */ }
}

// --- board -----------------------------------------------------------------
function build(opts){
  const fresh = opts && opts.fresh;
  const saved = fresh ? null : loadState();
  const order = saved ? saved.order : shuffle(PARKS);
  const markedSet = saved ? saved.marked : new Set();

  board.innerHTML = '';
  cells = [];
  let p = 0;
  for(let i=0;i<25;i++){
    const cell = document.createElement('div');
    cell.className = 'cell';
    if(i === FREE){
      cell.classList.add('free','marked');
      cell.textContent = '🟢';
      cell.dataset.free = '1';
    } else {
      const name = order[p++];
      cell.dataset.name = name;
      cell.textContent = name;
      const pin = document.createElement('a');
      pin.className = 'pin'; pin.textContent = '📍';
      pin.href = mapsLink(name); pin.target = '_blank'; pin.rel = 'noopener';
      pin.title = 'Open in Google Maps';
      pin.addEventListener('click', e => e.stopPropagation());
      cell.appendChild(pin);
      if(markedSet.has(name)) cell.classList.add('marked');
      cell.addEventListener('click', () => toggle(cell));
    }
    board.appendChild(cell);
    cells.push(cell);
  }
  banner.classList.remove('show');
  updateCount();
  checkWin(false);   // re-highlight a winning line on restore, but don't pop the banner
  saveState();       // persist (captures a freshly shuffled card immediately)
}

function toggle(cell){
  cell.classList.toggle('marked');
  updateCount();
  saveState();
  checkWin(true);
}

function updateCount(){
  const n = cells.filter((c,i)=> i!==FREE && c.classList.contains('marked')).length;
  countEl.textContent = n + ' / 24';
}

const LINES = (() => {
  const L = [];
  for(let r=0;r<5;r++) L.push([0,1,2,3,4].map(c=>r*5+c));   // rows
  for(let c=0;c<5;c++) L.push([0,1,2,3,4].map(r=>r*5+c));   // cols
  L.push([0,6,12,18,24]); L.push([4,8,12,16,20]);           // diagonals
  return L;
})();

function checkWin(showBanner){
  const winning = LINES.filter(line => line.every(i => cells[i].classList.contains('marked')));
  cells.forEach(c => c.classList.remove('win'));
  if(winning.length){
    const idx = new Set(winning.flat());
    idx.forEach(i => cells[i].classList.add('win'));
    if(showBanner){
      bannerMsg.textContent = winning.length > 1
        ? "Double bingo! " + winning.length + " lines!"
        : "You linked up 5 forest parks!";
      banner.classList.add('show');
    }
  }
}

document.getElementById('new').addEventListener('click', () => build({fresh:true}));
document.getElementById('again').addEventListener('click', () => build({fresh:true}));
banner.addEventListener('click', e => { if(e.target === banner) banner.classList.remove('show'); });

build();
