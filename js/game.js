/* =========================================================
 * 개발자 키우기 - 게임 로직
 * ========================================================= */
'use strict';

const SAVE_KEY = 'codeIdle_v2';
const BALANCE_VER = 4;
const RELEASE_MIN = 1e6;
const OFFLINE_CAP = 12 * 3600;
const LINE_CAP = 3000;
const LINE_TRIM = 500;
const AUTO_TYPE_SPEED = 30;
const PENDING_CAP = 800;
const MAX_TYPED_PER_BUY = 3;
const KEY_GAIN_RATIO = 0.03;
const KEY_CHARS_MIN = 1;
const KEY_CHARS_MAX = 2;
const IDLE_MS = 1500;
const MAX_BUGS = 5;
const OFFER_SLOTS = 3;
const BANKRUPT_SEC = 45;
const ARCHIVE_MAX = 12;

/* =========================================================
 * 상태
 * ========================================================= */
function freshRun() {
  return { value: 0, runBest: 0, lv: { code: 0, key: 0, test: 0, review: 0, doc: 0, log: 0, ci: 0, srv: 0 }, stage: 0, refactoring: null, incident: null };
}
function freshCompany(career) {
  const subs = {}; AI_SUBS.forEach(s => { subs[s.id] = false; });
  const crew = {}; CREW.forEach(c => { crew[c.id] = false; });
  const crewNames = {};
  const used = new Set();
  CREW.forEach(c => {
    let n;
    do { n = pick(SURNAMES) + pick(GIVEN); } while (used.has(n));
    used.add(n);
    crewNames[c.id] = n;
  });
  return {
    company: '', crewNames, promoBase: 1, lastRefLines: 0,
    releaseMult: 1, version: 1, rep: career ? career.skills.network * 10 : 0, subs, crew,
    quests: { offers: [], active: [], nextOfferAt: 0, seq: 0 },
    file: 0, fileLines: 0, filesDone: 0, archive: [],
    lines: [], cur: '', curSrc: '', pending: '', filler: '', items: [], history: [], refactorCount: 0, lineOffset: 0, fillerIdx: 0,
    bugs: [], bugInfo: {}, bugQueue: 0, debt: 0, legacy: false, grade: -1, cleanUntil: 0,
    market: 1, equity: 1, bankrupt: 0, ceoMonths: 0,
  };
}
function freshCareer() {
  return {
    name: '', gender: '', level: 0, points: 0, route: null, ipo: false, cto: false, ach: {}, ng: 0,
    skills: { sql: 0, clean: 0, cicd: 0, nego: 0, lead: 0, typist: 0, network: 0 },
    stats: { keys: 0, linesTyped: 0, questsDone: 0, questsFailed: 0, bugsFixed: 0, refactors: 0, incidentsOk: 0, releases: 0, jobs: 0, playTime: 0, upgrades: 0, earned: 0, fridayOk: 0, nextGenDone: 0, bossDone: 0, challengeWords: 0, filesDone: 0, gradeS: 0, maxCombo: 0, founded: 0, bankrupts: 0, bestValue: 0 },
  };
}
function defaultState() {
  const c = freshCareer();
  const s = Object.assign(freshRun(), freshCompany(c), {
    career: c, settings: { sound: 'off', theme: (window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches) ? 'light' : 'dark' }, balanceVer: BALANCE_VER, time: 0, lastSave: Date.now(), buffs: [],
    nextEventAt: 150, nextChallengeAt: 60, challenge: null, timers: { logFix: 0, gemFix: 0, market: 0 },
    inv: { glass: 0 }, itemCd: {},
  });
  return s;
}

let state = defaultState();
let tab = 'upg';
let buyMax = false;
let autoAcc = 0;
let aiAcc = 0;
let secAcc = 0;
let sideAcc = 0;
let curEl = null;
let lastFloatAt = 0;
let lastKeyAt = 0;
let combo = 0;
let lastLiveGrade = 4;
let lastComboAt = 0;
let modalSpec = null;
let lastSideHtml = '';
let lastStatusHtml = '';
let lastExplorerHtml = '';
let resetArmed = false;
let audioCtx = null;

/* =========================================================
 * 유틸
 * ========================================================= */
const $ = id => document.getElementById(id);
const S = () => state.career.stats;
const SK = () => state.career.skills;
function ri(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function escHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

const KR_UNITS = ['', '만', '억', '조', '경', '해', '자', '양', '구', '간', '정', '재', '극', '항하사', '아승기', '나유타', '불가사의', '무량대수'];
// 1만 이상은 한국식 단위(만, 억, 조...)로 표시
function fmt(n) {
  if (typeof n !== 'number' || !isFinite(n)) return '0';
  if (n < 0) return '-' + fmt(-n);
  if (n < 100) return n.toFixed(1);
  if (n < 1e4) return Math.floor(n).toLocaleString();
  const k = Math.floor(Math.log10(n) / 4);
  if (k >= KR_UNITS.length) { const e = Math.floor(Math.log10(n)); return (n / Math.pow(10, e)).toFixed(2) + 'e' + e; }
  const v = n / Math.pow(10, 4 * k);
  return (v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : Math.floor(v).toString()) + KR_UNITS[k];
}
function won(n) { return fmt(n) + '원'; }
function fmtInt(n) { return Math.floor(n).toLocaleString(); }
function fmtSec(s) { return Math.max(0, Math.ceil(s)) + '초'; }
function pct(v) { return Math.round(v * 100) + '%'; }

/* =========================================================
 * 직급, 팀
 * ========================================================= */
function titleOf() {
  const c = state.career;
  if (c.route === 'ceo') return '대표';
  if (c.route === 'exec') return EXEC[c.level - 6].title;
  return TITLES[c.level];
}
function devName() { return state.career.name || '개발자'; }
function companyName() { return state.company || '무명 회사'; }
function authorText() { return devName() + (state.company ? ' (' + state.company + ')' : ''); }
function crewName(c) { return (state.crewNames && state.crewNames[c.id]) || '무명'; }
function randomCompany() { return pick(CO_PRE) + pick(CO_SUF); }
function isCeo() { return state.career.route === 'ceo'; }
function hasCrew(id) { return !!state.crew[id]; }
function hasSub(id) { return !!state.subs[id]; }

/* =========================================================
 * 수치 공식
 * ========================================================= */
function achCount() { return Object.keys(state.career.ach).length; }
function buffActive(b) { return state.time >= (b.from || 0) && state.time < b.until; }
function buffMult(kind) { let m = 1; for (const b of state.buffs) if (b.kind === kind && buffActive(b)) m *= b.mult; return m; }
function hasBuff(kind) { return state.buffs.some(b => b.kind === kind && buffActive(b)); }
// 같은 효과는 겹치지 않고 남은 시간만 새로 채워짐
function addBuff(kind, mult, sec, label, bad, delay) {
  const from = state.time + (delay || 0);
  const same = state.buffs.find(b => b.label === label && b.until > state.time);
  if (same) { same.from = Math.min(same.from, from); same.until = from + sec; return; }
  state.buffs.push({ kind, mult, from, until: from + sec, label, bad: !!bad });
}
function buffLeft(label) {
  const b = state.buffs.find(x => x.label === label && x.until > state.time);
  return b ? b.until - state.time : 0;
}

function salaryRate() {
  let s = 0;
  AI_SUBS.forEach(x => { if (hasSub(x.id)) s += x.fee; });
  CREW.forEach(x => { if (hasCrew(x.id)) s += x.salary; });
  return s * Math.pow(0.7, SK().lead);
}
function bugPenalty() { return Math.min(0.85, 0.6 + 0.05 * state.lv.log); }
function bugLossPct() { return 1 - Math.pow(bugPenalty(), state.bugs.length); }
function offlineEff() { return Math.min(1, 0.5 + 0.1 * state.lv.srv + (hasCrew('yoon') ? 0.2 : 0)); }
function reviewFactor(l) { return 1 / (1 + 0.25 * l); }
// 코드 한 줄당 복잡도 증가량: 처음엔 2%, 업그레이드 레벨 합이 오를수록 4%씩 줄어듦 (최소 0.1%)
function totalUpgradeLv() { let t = 0; for (const k in state.lv) t += state.lv[k]; return t; }
function lineDebt() { return Math.max(0.1, 2 * Math.pow(0.96, totalUpgradeLv())) * debtFactor(); }
function debtFactor() {
  return reviewFactor(state.lv.review) * Math.pow(0.75, SK().clean) * (hasCrew('park') ? 0.8 : 1) * (hasSub('claude') ? 0.9 : 1) * buffMult('calm');
}
function testFactor(l) { return 1 / (1 + 0.3 * l); }
function bugChanceAt(testLv) { return 0.012 * (1 + state.debt / 25) * testFactor(testLv) * Math.pow(0.75, SK().cicd) * (hasCrew('jung') ? 0.7 : 1); }
function bugChance() { return bugChanceAt(state.lv.test); }
function refactorDuration() {
  return Math.max(1.5, 8 * (state.legacy ? 2 : 1) * Math.pow(0.85, state.lv.ci) * Math.pow(0.7, SK().cicd) * (hasCrew('han') ? 0.7 : 1) * (hasCrew('park') ? 0.8 : 1));
}
function incidentTime() { return 30 + 5 * state.lv.log + (hasCrew('jung') ? 10 : 0); }
function logFixInterval(l) { return l >= 3 ? Math.max(5, 40 - 5 * (l - 3)) : 0; }
function questSlots() { return 1 + (hasCrew('lee') ? 1 : 0); }
function questRewardMult() { return (1 + 0.5 * SK().nego) * (hasCrew('lee') ? 1.25 : 1); }
function questRepMult() { const g = liveGrade(); return (g === 4 ? 2 : g === 3 ? 1.5 : 1) * (hasCrew('choi') ? 1.5 : 1); }
function questTimeMult() { return 1 + 0.1 * state.lv.doc; }
function deployBonus() { return 0.05 * state.lv.ci; }
// 배포할 때마다 성공률이 30~90%에서 랜덤으로 정해지고, 낮을수록 보상이 큼
function rollDeploy() {
  const p = clamp(Math.round((0.3 + Math.random() * 0.6 + deployBonus()) * 20) / 20, 0.3, 0.95);
  return { p, reward: incomeRef() * 60 / p, rep: p < 0.5 ? 2 : 1 };
}
// 회차 보너스: 엔딩 후 다시 시작할 때마다 수입 +30%
function ngMult() { return 1 + 0.3 * (state.career.ng || 0); }
function endingDone() { return state.career.cto || state.career.ipo; }
function newGamePlus() {
  const c = state.career;
  const ng = (c.ng || 0) + 1;
  const settings = state.settings;
  state = defaultState();
  state.settings = settings;
  Object.assign(state.career, { name: c.name, ach: c.ach, stats: c.stats, ng, points: 2 * ng });
  startFile();
  renderAllCode();
  lastSideHtml = '';
  save();
  askCompany('first', () => toast((ng + 1) + '회차 시작! 회차 보너스 수입 x' + ngMult().toFixed(1) + ', 경력 포인트 ' + (2 * ng) + '개로 시작'));
}
function ngChoice() { return { label: (state.career.ng + 2) + '회차 시작 (수입 x' + (1 + 0.3 * (state.career.ng + 1)).toFixed(1) + ', 경력 포인트 ' + (2 * (state.career.ng + 1)) + '개, 업적 유지)', alt: true, act: newGamePlus }; }

function careerMult() {
  const c = state.career;
  if (c.route === 'exec') return 2.25 * Math.pow(1.3, c.level - 5);
  if (c.route === 'ceo') return 2.25 * (c.ipo ? 5 : 1);
  return 1 + 0.25 * Math.min(c.level, 5);
}
function repMult() { return 1 + state.rep * 0.01 * (1 + 0.5 * SK().network); }
function achMult() { return 1 + 0.02 * achCount(); }
function fileMult() { return 1 + 0.05 * state.filesDone; }
function gradeMult() { return GRADE_MULT[liveGrade()]; }
// 개발 실력: 레벨당 초당 +1원(더하기), 10레벨마다 단계가 올라 x3(곱하기)
// 10레벨마다 단계가 오르고 x3
const TIER_MULT = 3;
function codeIncome(l) { return l * Math.pow(TIER_MULT, Math.floor(l / 10)); }
// 데스크 셋업: 레벨당 타이핑 1회 +1원, 10레벨마다 x3
function deskIncome(l) { return (1 + l) * Math.pow(TIER_MULT, Math.floor(l / 10)); }
// 인프라: 비싼 대신 레벨당 수입 x2
function srvMult(l) { return Math.pow(2, l); }
// 트래픽 폭주를 버티는 데 필요한 인프라 레벨
function trafficNeed() { return Math.max(1, state.stage - 1); }

// 일시 효과를 뺀 기본 수입
function baseRate() {
  const L = state.lv;
  let r = codeIncome(L.code) * srvMult(L.srv);
  r *= ngMult();
  r *= state.releaseMult * repMult() * Math.pow(1.5, SK().sql) * careerMult() * achMult() * fileMult() * gradeMult() * state.equity;
  return r * Math.max(0.1, 1 - salaryRate());
}
// 현재 초당 매출
function rate() {
  let r = baseRate();
  r *= 1 - state.debt / 200;
  if (state.legacy) r *= 0.7;
  r *= 1 - bugLossPct();
  if (state.refactoring) r *= 0.5;
  r *= buffMult('income');
  if (isCeo()) r *= state.career.ipo ? 3 : 3 * state.market;
  return r;
}
// 대표 루트의 초당 운영비 (임대료, 고정비)
// 대표 루트의 운영비: 시장 상황과 무관한 고정비. 회사가 오래될수록(1분 = 1달) 늘어남
function burnMult() { return Math.min(1.6, 1 + 0.02 * state.ceoMonths); }
function burnRate() {
  if (!isCeo() || state.career.ipo) return 0;
  return baseRate() * 1.5 * burnMult();
}
// 이 시장 상황 아래로 떨어지면 적자
function breakEvenMarket() { const g = rate() / state.market; return g > 0 ? burnRate() / g : 0; }
// 보상, 가격 계산 기준이 되는 초당 벌이 (자동 수입 + 초당 2회 타이핑)
function incomeRef() { return baseRate() + keyGainAt(state.lv.key) * 2; }
function netRate() { return rate() - burnRate(); }
// 콤보 300에서 최대 x2
const COMBO_MAX = 300;
function comboMult() { return 1 + Math.min(combo, COMBO_MAX) / COMBO_MAX; }
// 키를 멈춘 뒤 콤보가 끊기기까지 걸리는 시간(ms)
function comboWindow() { return 1300 * buffMult('combo'); }
function keyGainAt(keyLv) {
  return (deskIncome(keyLv) + baseRate() * KEY_GAIN_RATIO) * Math.pow(1.5, SK().typist);
}
function keyGain() {
  if (state.refactoring) return 0;
  return keyGainAt(state.lv.key) * buffMult('typing') * comboMult();
}
function cost(u) { return u.base * Math.pow(u.growth, state.lv[u.id]); }
function releaseGain() { return state.runBest < RELEASE_MIN ? 0 : Math.pow(state.runBest / 1e5, 0.3); }
function currentStage() {
  let s = 0;
  for (let i = 0; i < STAGES.length; i++) if (state.runBest >= STAGES[i].at) s = i;
  return s;
}
function addValue(v) {
  if (!(v > 0)) return;
  state.value += v;
  S().earned += v;
  if (state.value > state.runBest) state.runBest = state.value;
  if (state.runBest > S().bestValue) S().bestValue = state.runBest;
}
function addDebt(v) {
  state.debt = clamp(state.debt + v, 0, 100);
  if (state.debt >= 100 && !state.legacy) {
    state.legacy = true;
    toast('레거시화! 코드가 너무 엉켜서 수입 x0.7, 리팩토링 시간 2배. 리팩토링으로 풀어주세요');
  }
}
function addRep(v) { state.rep = Math.max(0, state.rep + v); }

function upgDesc(u) {
  const l = state.lv[u.id];
  const nx = (a, b) => '<b>' + a + '</b>, 다음 ' + b;
  switch (u.id) {
    case 'code': {
      const nextTier = (Math.floor(l / u.step) + 1) * u.step;
      return '자동 수입 초당 ' + nx('+' + won(codeIncome(l) * srvMult(state.lv.srv)), '+' + won(codeIncome(l + 1) * srvMult(state.lv.srv))) + '<br>Lv.' + nextTier + '에 다음 단계, 수입 x' + TIER_MULT + ' (배수 적용 전 기준)';
    }
    case 'key': {
      const nextTier = (Math.floor(l / u.step) + 1) * u.step;
      return '타이핑 1회당 기본 ' + nx('+' + won(deskIncome(l)), '+' + won(deskIncome(l + 1))) + '<br>Lv.' + nextTier + '에 다음 단계, 타이핑 x' + TIER_MULT;
    }
    case 'test': return '버그 발생 분당 ' + nx((bugChanceAt(l) * 60).toFixed(2) + '회', (bugChanceAt(l + 1) * 60).toFixed(2) + '회') + '<br>(복잡도가 높을수록 버그가 자주 생김)';
    case 'review': return '코드 복잡도 증가 ' + nx('-' + pct(1 - reviewFactor(l)), '-' + pct(1 - reviewFactor(l + 1)));
    case 'doc': return '의뢰 마감 시간 ' + nx('+' + (10 * l) + '%', '+' + (10 * (l + 1)) + '%');
    case 'log': {
      const base = '장애 대응 시간 <b>' + incidentTime() + '초</b>';
      if (l === 0) return base + '<br>다음 레벨: 버그가 생기면 그 줄로 자동 이동, 대응 시간 +5초';
      if (l < 3) return base + ', 버그 위치 자동 이동<br>다음 레벨: ' + (l + 1 >= 3 ? '버그 자동 수정 시작 (' + logFixInterval(3) + '초마다)' : '대응 시간 +5초');
      return base + '<br>버그 자동 수정 ' + nx(logFixInterval(l) + '초마다', logFixInterval(l + 1) + '초마다');
    }
    case 'ci': return '업그레이드 코드 입력 ' + nx('x' + (1 + 2 * l), 'x' + (3 + 2 * l)) + '<br>배포 성공률 +' + pct(deployBonus()) + ', 리팩토링 시간 ' + refactorDuration().toFixed(1) + '초';
    case 'srv': return '전체 수입 ' + nx('x' + fmt(srvMult(l)), 'x' + fmt(srvMult(l + 1))) + ' (비싸지만 곱하기)' + '<br>트래픽 폭주 대응에 Lv.' + trafficNeed() + ' 필요, 오프라인 수익 ' + pct(offlineEff());
  }
  return '';
}

/* =========================================================
 * 파일, 언어
 * ========================================================= */
function curFile() { return fileInfo(state.file); }
function curLang() { return LANGS[curFile().lang]; }

function startFile() {
  const f = curFile();
  const L = LANGS[f.lang];
  state.lines = L.docHeader(['파일명 : ' + f.name, '설명   : ' + f.desc, '작성자 : ' + authorText()]).concat(L.prologue(f, state.stage));
  state.cur = '';
  state.curSrc = '';
  state.pending = '';
  state.filler = '';
  state.items = [];
  state.history = [];
  state.refactorCount = 0;
  state.lineOffset = 0;
  state.fileLines = 0;
  state.lastRefLines = S().linesTyped;
  state.bugs = [];
  state.bugInfo = {};
  state.bugQueue = 0;
  if (state.file === 0 && state.version === 1 && L.hello) enqueue(L.hello);
}

function enqueue(lines, target, cat) {
  const ind = curLang().ind;
  state[target || 'pending'] += lines.map(l => l ? ind + l : '').join('\n') + '\n';
  if (cat) {
    state.items.push({ cat, lines });
    if (state.items.length > 400) state.items.splice(0, state.items.length - 400);
  }
}

function completeFile() {
  const f = curFile();
  const content = state.lines.slice(-400);
  if (state.cur) content.push(state.cur);
  state.archive.push({ idx: f.idx, name: f.name, lang: f.lang, lines: content });
  if (state.archive.length > ARCHIVE_MAX) state.archive.shift();
  const carry = state.bugs.length + state.bugQueue;
  state.filesDone++;
  S().filesDone++;
  const g = incomeRef() * 60;
  addValue(g);
  state.file++;
  startFile();
  state.bugQueue = carry;
  renderAllCode();
  $('code').scrollTop = 0;
  const nf = curFile();
  toast('파일 완성: ' + f.name + ' +' + won(g) + ', 파일 보너스 x' + fileMult().toFixed(2) + '. 다음 파일: ' + nf.name + ' (' + LANGS[nf.lang].name + ')');
}

/* =========================================================
 * 구매
 * ========================================================= */
function buy(id) {
  const u = UPGRADES.find(x => x.id === id);
  if (!u || state.runBest < u.unlock) return;
  if (hasBuff('freeze')) { toast('코드 프리징 기간에는 업그레이드를 살 수 없습니다'); return; }
  const L = curLang();
  const f = curFile();
  let bought = 0;
  let hidden = 0;
  do {
    const c = cost(u);
    if (!isFinite(c) || state.value < c) break;
    state.value -= c;
    state.lv[u.id]++;
    bought++;
    const lines = L.gen[u.id](state.lv[u.id], f, state.stage);
    if (bought <= MAX_TYPED_PER_BUY) enqueue(lines, 'pending', u.id);
    else { hidden++; state.items.push({ cat: u.id, lines }); }
  } while (buyMax && bought < 1000);
  if (hidden > 0) enqueue([L.cm('... ' + u.name + ' ' + hidden + '건 더 추가')]);
  if (bought > 0) {
    const before = tierIdx(u, state.lv[u.id] - bought), after = tierIdx(u, state.lv[u.id]);
    if (after > before) {
      const name = u.tiers[after];
      enqueue([L.cm(u.name + ' 단계 상승: ' + name)]);
      toast(u.name + ' 단계 상승! ' + name + (u.id === 'code' ? ' (자동 수입 x' + TIER_MULT + ')' : u.id === 'key' ? ' (타이핑 x' + TIER_MULT + ')' : ''));
    }
  }
  if (bought > 0) {
    S().upgrades += bought;
  }
}

/* =========================================================
 * 리팩토링
 * ========================================================= */
function today() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

const CATS = [['srv', '서버 설정'], ['code', '핵심 코드'], ['doc', '설계 문서'], ['test', '테스트'], ['log', '로그'], ['review', '코드 리뷰 이력'], ['ci', 'CI/CD 이력'], ['key', '개발 환경']];
const SUMMARY = {
  log: n => '실행 로그 ' + n + '곳 기록 중 (공통 로거 사용)',
  review: n => '코드리뷰 ' + n + '건 반영 완료',
  ci: n => 'CI 빌드 ' + n + '회 통과',
  key: () => '데스크 셋업: ' + tierName(UPGRADES[1], state.lv.key),
};

// 지금까지 만든 코드를 언어 규칙에 맞게 구역별로 정리하고 중복을 합친 결과
function buildRefactored(history) {
  const f = curFile();
  const L = LANGS[f.lang];
  const ind = L.ind;
  const out = L.docHeader(['파일명 : ' + f.name, '설명   : ' + f.desc, '작성자 : ' + authorText(), '작성일 : ' + today(), '', '수정이력'].concat(history.slice(-5).map(h => '  ' + h)));
  out.push(...L.prologue(f, state.stage));
  for (const [cat, title] of CATS) {
    const its = state.items.filter(x => x.cat === cat);
    if (!its.length) continue;
    const seen = new Set();
    const uniq = [];
    for (const it of its) { const k = it.lines.join('\n'); if (!seen.has(k)) { seen.add(k); uniq.push(it); } }
    out.push(...L.section(title).map(l => ind + l));
    if (SUMMARY[cat]) { out.push(ind + L.cm(SUMMARY[cat](uniq.length)), ''); continue; }
    if (cat === 'srv') { out.push(...L.common.srv(state.lv.srv).map(l => ind + l), ''); continue; }
    const keep = cat === 'code' ? 4 : 2;
    uniq.slice(0, keep).forEach(it => it.lines.forEach(l => out.push(l ? ind + l : '')));
    if (uniq.length > keep) {
      out.push('', ind + L.cm('... 나머지 ' + (uniq.length - keep) + '개는 아래 공통 모듈로 통합'));
      out.push(...L.common[cat](uniq.length - keep, f).map(l => ind + l));
    }
    out.push('');
  }
  out.push(...L.section('신규 개발 영역').map(l => ind + l));
  return out;
}

// 코드 상태: 지금 복잡도로 실시간 등급을 매김 (버그가 있으면 한 단계 하락). 등급에 따라 수입 배수가 붙음
const GRADE_DEBT = [70, 45, 25, 10];   // C, B, A, S가 되는 복잡도 상한(%)
function liveGrade() {
  let g = 0;
  for (let k = 0; k < GRADE_DEBT.length; k++) if (state.debt <= GRADE_DEBT[k]) g = k + 1;
  if (state.bugs.length) g = Math.max(0, g - 1);
  if (hasCrew('han')) g = Math.min(4, g + 1);
  return g;
}
// 리팩토링하면 복잡도 0, 버그도 사라지므로 최고 등급
function bestGrade() { return 4; }
function canRefactorNow() { return liveGrade() < bestGrade(); }

function totalLines() { return state.lineOffset + state.lines.length + 1; }
function refactorPreview() {
  const before = totalLines() + state.pending.split('\n').length - 1;
  const draft = state.history.concat(['v' + state.version + '.0 #' + (state.refactorCount + 1) + ' 미리보기']);
  return { before, after: buildRefactored(draft).length };
}

function doRefactor(reason) {
  const { before, after } = refactorPreview();
  const g = liveGrade();
  const summary = after < before ? before + '줄을 ' + after + '줄로 정리' : '구역별 구조 정리';
  const fixedByRefactor = state.bugs.length;
  S().bugsFixed += fixedByRefactor;
  state.history.push('v' + state.version + '.0 #' + (state.refactorCount + 1) + ' ' + reason + ', ' + summary + ', 코드 상태 ' + GRADES[g] + '에서 S로');
  state.refactorCount++;
  state.lines = buildRefactored(state.history);
  state.cur = '';
  state.curSrc = '';
  state.pending = '';
  state.filler = '';
  state.lineOffset = 0;
  state.debt = 0;
  state.legacy = false;
  state.bugs = [];
  state.bugInfo = {};
  state.refactoring = null;
  state.grade = g;
  state.cleanUntil = state.time + 30;
  state.lastRefLines = S().linesTyped;
  S().refactors++;
  if (g === 0) S().gradeS++;
  renderAllCode();
  $('code').scrollTop = 0;
  toast('리팩토링 완료: ' + summary + ', 코드 상태 ' + GRADES[g] + '에서 ' + GRADES[liveGrade()] + '로 (수입 x' + GRADE_MULT[liveGrade()] + ')' + (fixedByRefactor ? ', 버그 ' + fixedByRefactor + '개 함께 수정' : ''));
}

function startRefactor(reason, manual) {
  if (state.refactoring) return;
  if (manual) {
    if (!canRefactorNow()) { toast('코드 상태가 이미 S입니다. 코드를 더 쌓고 정리해 보세요'); return; }
  }
  const dur = refactorDuration();
  state.refactoring = { until: state.time + dur, dur, reason };
  toast('리팩토링 시작: ' + dur.toFixed(1) + '초 동안 개발 중단, 수입 절반');
}

function checkStage() {
  const s = currentStage();
  if (s <= state.stage) return;
  state.stage = s;
  doRefactor(STAGES[s].name + ' 전환');
}

/* =========================================================
 * 에디터
 * ========================================================= */
const HL_CACHE = {};
function hlRegex(langId) {
  if (HL_CACHE[langId]) return HL_CACHE[langId];
  const L = LANGS[langId];
  const parts = [
    '(' + L.cmRe + ')',
    '("[^"\\n]*"?|\'[^\'\\n]*\'?)',
    '(' + (L.tagRe || '@\\w+') + ')',
    '\\b(' + L.kw.join('|') + ')\\b',
    '\\b(\\d+L?)\\b',
    '\\b([a-zA-Z_]\\w*)(?=\\()',
    '\\b([A-Z][a-z]\\w*)\\b',
  ];
  HL_CACHE[langId] = new RegExp(parts.join('|'), 'gm');
  return HL_CACHE[langId];
}
function highlight(src, langId) {
  const lang = langId || curFile().lang;
  const L = LANGS[lang];
  const esc = src.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  if (L.blockRe && L.blockRe.test(src)) return '<span class="cm">' + esc + '</span>';
  return esc.replace(hlRegex(lang), (m, cm, str, tag, kw, num, fn, type) => {
    if (cm) return '<span class="cm">' + cm + '</span>';
    if (str) return '<span class="str">' + str + '</span>';
    if (tag) return '<span class="' + (L.tagRe ? 'tag' : 'dec') + '">' + tag + '</span>';
    if (kw) return '<span class="kw">' + kw + '</span>';
    if (num) return '<span class="num">' + num + '</span>';
    if (fn) return '<span class="fn">' + fn + '</span>';
    if (type) return '<span class="type">' + type + '</span>';
    return m;
  });
}

function lineHtml(no, text, cursor) {
  const info = state.bugs.includes(no) ? state.bugInfo[no] : null;
  let body;
  if (info) body = highlight(text.slice(0, info.pos)) + '<span class="typo">' + escHtml(text.substr(info.pos, info.len)) + '</span>' + highlight(text.slice(info.pos + info.len));
  else body = highlight(text);
  return '<div class="ln' + (info ? ' bug' : '') + '" data-no="' + no + '"><span class="no">' + no + '</span><span class="tx">' + body + (cursor ? '<span class="cursor"></span>' : '') + '</span></div>';
}

function renderAllCode() {
  const box = $('code');
  let html = '';
  for (let i = 0; i < state.lines.length; i++) html += lineHtml(state.lineOffset + i + 1, state.lines[i], false);
  html += lineHtml(totalLines(), state.cur, true);
  box.innerHTML = html;
  curEl = box.lastElementChild;
  lastExplorerHtml = '';
}

function updateCurLine() { curEl.querySelector('.tx').innerHTML = highlight(state.cur) + '<span class="cursor"></span>'; }

function commitLine() {
  const box = $('code');
  state.lines.push(state.cur);
  curEl.querySelector('.tx').innerHTML = highlight(state.cur);
  state.cur = '';
  state.fileLines++;
  S().linesTyped++;
  addDebt(lineDebt());
  const tmp = document.createElement('div');
  tmp.innerHTML = lineHtml(totalLines(), '', true);
  curEl = tmp.firstChild;
  box.appendChild(curEl);
  if (state.lines.length > LINE_CAP) {
    state.lines.splice(0, LINE_TRIM);
    state.lineOffset += LINE_TRIM;
    for (let i = 0; i < LINE_TRIM; i++) box.removeChild(box.firstChild);
    state.bugs = state.bugs.filter(n => n > state.lineOffset);
    for (const k in state.bugInfo) if (+k <= state.lineOffset) delete state.bugInfo[k];
  }
}

// src: 'pending'(업그레이드 코드, 자동 입력) 또는 'filler'(연습 코드, 키를 누른 만큼만 입력)
function typeFrom(src, n, follow) {
  const box = $('code');
  const atBottom = box.scrollTop + box.clientHeight >= box.scrollHeight - 40;
  const q = state[src];
  let taken = 0;
  const skipIndent = () => {
    while (taken < q.length && q[taken] === ' ' && state.cur.trim() === '') { state.cur += ' '; taken++; state.curSrc = src; }
  };
  skipIndent();
  let typed = 0;
  while (typed < n && taken < q.length) {
    const ch = q[taken++];
    typed++;
    if (ch === '\n') { commitLine(); state.curSrc = ''; }
    else { state.cur += ch; state.curSrc = src; }
    skipIndent();
  }
  state[src] = q.slice(taken);
  updateCurLine();
  if (follow || atBottom) box.scrollTop = box.scrollHeight;
}

function finishFillerLine() {
  const idx = state.filler.indexOf('\n');
  state.cur += idx < 0 ? state.filler : state.filler.slice(0, idx);
  state.filler = idx < 0 ? '' : state.filler.slice(idx + 1);
  commitLine();
  state.curSrc = '';
  updateCurLine();
}

function nextFiller() {
  const list = curLang().fillers(curFile());
  const snippet = list[state.fillerIdx % list.length];
  state.fillerIdx++;
  enqueue([''].concat(snippet), 'filler');
}

function typeOnce(follow) {
  let src;
  if (state.cur && state.curSrc) src = state.curSrc;
  else if (state.filler) src = 'filler';
  else if (state.pending) src = 'pending';
  else { nextFiller(); src = 'filler'; }
  typeFrom(src, ri(KEY_CHARS_MIN, KEY_CHARS_MAX), follow);
}

function hack() {
  S().keys++;
  const now = performance.now();
  lastKeyAt = now;
  playClick();
  if (state.refactoring) { showFloat('리팩토링 중'); return; }
  combo = now - lastComboAt <= comboWindow() ? combo + 1 : 1;
  lastComboAt = now;
  if (combo > S().maxCombo) S().maxCombo = combo;
  const g = keyGain();
  addValue(g);
  typeOnce(true);
  $('desk').classList.toggle('pose');
  showFloat('+' + won(g));
}

function aiKey() {
  if (state.refactoring) return;
  addValue(keyGainAt(state.lv.key) * buffMult('typing'));
  typeOnce(false);
}

function showFloat(text, good) {
  const now = performance.now();
  if (!good && now - lastFloatAt < 90) return;
  lastFloatAt = now;
  const el = document.createElement('div');
  el.className = 'float' + (good ? ' good' : '');
  el.textContent = text;
  $('editorPanel').appendChild(el);
  setTimeout(() => el.remove(), 700);
}

/* ---------- 타이핑 소리 (Web Audio로 직접 합성) ---------- */
function playClick() {
  const s = state.settings.sound;
  if (s === 'off') return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const t = audioCtx.currentTime;
    const len = Math.floor(audioCtx.sampleRate * 0.03);
    const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4);
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = { blue: 3500, red: 1200, silent: 700 }[s] * (0.9 + Math.random() * 0.2);
    filter.Q.value = 1.2;
    const gain = audioCtx.createGain();
    gain.gain.value = { blue: 0.6, red: 0.4, silent: 0.12 }[s];
    src.connect(filter).connect(gain).connect(audioCtx.destination);
    src.start(t);
    if (s === 'blue') {
      const o = audioCtx.createOscillator();
      o.frequency.value = 4200;
      const g2 = audioCtx.createGain();
      g2.gain.setValueAtTime(0.06, t + 0.012);
      g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
      o.connect(g2).connect(audioCtx.destination);
      o.start(t + 0.01);
      o.stop(t + 0.035);
    }
  } catch (e) { /* 소리를 못 내는 환경이면 무시 */ }
}

/* =========================================================
 * 버그, 장애
 * ========================================================= */
function bugEl(no) { return $('code').querySelector('.ln[data-no="' + no + '"]'); }

// 주석이 시작되는 위치 (주석 안에는 버그를 만들지 않음). 문자열 안의 // 는 건너뜀
function commentStart(text) {
  let inStr = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inStr) { if (ch === inStr) inStr = ''; continue; }
    if (ch === '"' || ch === "'") { inStr = ch; continue; }
    if (text.startsWith('//', i) || text.startsWith('--', i) || text.startsWith('<!--', i)) return i;
  }
  return text.length;
}

// 정상 코드 한 줄에 오타나 엉뚱한 글자를 섞음. pos, len은 틀린 부분 위치. 주석 부분은 건드리지 않음
function corrupt(text) {
  const start = text.length - text.trimStart().length;
  const end = text.slice(0, commentStart(text)).trimEnd().length;
  const code = text.slice(0, end);
  const opts = [];
  for (const [ok, bad] of TYPOS) {
    const i = code.indexOf(ok, start);
    if (i >= 0) opts.push({ text: text.slice(0, i) + bad + text.slice(i + ok.length), pos: i, len: bad.length });
  }
  const semi = code.lastIndexOf(';');
  if (semi >= 0) opts.push({ text: text.slice(0, semi) + ':' + text.slice(semi + 1), pos: semi, len: 1 });
  const eq = code.indexOf('==');
  if (eq >= 0) opts.push({ text: text.slice(0, eq) + '=' + text.slice(eq + 2), pos: eq, len: 1 });
  const paren = code.lastIndexOf(')');
  if (paren >= 0) opts.push({ text: text.slice(0, paren) + ']' + text.slice(paren + 1), pos: paren, len: 1 });
  if (!opts.length || Math.random() < 0.25) {
    const p = start + Math.floor(Math.random() * (end - start + 1));
    opts.push({ text: text.slice(0, p) + pick(STRAYS) + text.slice(p), pos: p, len: 1 });
  }
  return pick(opts);
}

function isCodeLine(t) {
  const s = t.trim();
  return s && !s.startsWith('//') && !s.startsWith('/*') && !s.startsWith('*') && !s.startsWith('--') && !s.startsWith('<!--');
}

function setLineDom(no) {
  const el = bugEl(no);
  if (!el) return;
  const fresh = document.createElement('div');
  fresh.innerHTML = lineHtml(no, state.lines[no - state.lineOffset - 1], false);
  el.replaceWith(fresh.firstChild);
}

function spawnBug() {
  const n = state.lines.length;
  const collect = (from, test) => {
    const out = [];
    for (let i = from; i < n; i++) {
      const no = state.lineOffset + i + 1;
      if (!state.bugs.includes(no) && test(state.lines[i])) out.push(no);
    }
    return out;
  };
  let cands = collect(Math.max(0, n - 30), isCodeLine);
  if (!cands.length) cands = collect(0, isCodeLine);
  if (!cands.length) cands = collect(0, t => t.trim());
  if (!cands.length) return false;
  const no = pick(cands);
  const idx = no - state.lineOffset - 1;
  const orig = state.lines[idx];
  const c = corrupt(orig);
  state.lines[idx] = c.text;
  state.bugInfo[no] = { orig, pos: c.pos, len: c.len };
  state.bugs.push(no);
  setLineDom(no);
  if (state.inv && state.inv.glass > 0) { useGlass(no); return true; }
  if (state.lv.log >= 1) findBug();
  return true;
}

function queueBugs(n) { for (let i = 0; i < n; i++) if (!spawnBug()) state.bugQueue++; }

function fixBug(no, silent) {
  const info = state.bugInfo[no];
  const idx = no - state.lineOffset - 1;
  if (info && idx >= 0 && idx < state.lines.length) state.lines[idx] = info.orig;
  delete state.bugInfo[no];
  state.bugs = state.bugs.filter(b => b !== no);
  setLineDom(no);
  S().bugsFixed++;
  showFloat(silent ? '버그 자동 수정' : '버그 수정!', true);
}

function findBug() {
  if (!state.bugs.length) return;
  const el = bugEl(state.bugs[state.bugs.length - 1]);
  if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center' });
}

function startIncident(count, sec, repWin, repLose, label) {
  queueBugs(count || 3);
  state.incident = { until: state.time + (sec || incidentTime()), repWin: repWin || 2, repLose: repLose || 3, label: label || '장애 대응' };
  findBug();
}

function checkIncident() {
  const inc = state.incident;
  if (!inc) return;
  if (state.bugs.length === 0 && state.bugQueue === 0) {
    const g = incomeRef() * 30;
    addValue(g);
    addRep(inc.repWin);
    S().incidentsOk++;
    state.incident = null;
    toast(inc.label + ' 성공! +' + won(g) + ', 평판 +' + inc.repWin);
  } else if (state.time > inc.until) {
    addRep(-inc.repLose);
    state.incident = null;
    toast(inc.label + ' 실패. 평판 -' + inc.repLose);
  }
}

/* =========================================================
 * 의뢰
 * ========================================================= */
function genQuest() {
  const all = state.quests.active.concat(state.quests.offers);
  const avail = KINDS.filter(k => state.rep >= k.rep && !(k.unique && all.some(q => q.kind === k.id)));
  let roll = Math.random() * avail.reduce((a, k) => a + k.w, 0);
  let k = avail[0];
  for (const x of avail) { roll -= x.w; if (roll <= 0) { k = x; break; } }
  const req = k.gen(Math.max(incomeRef(), 1));
  if (req.earn) req.earn = Math.ceil(req.earn);
  return { id: ++state.quests.seq, kind: k.id, client: pick(CLIENTS), title: pick(k.titles), req, time: k.time, rewardSec: k.rewardSec, repGain: k.repGain };
}
function kindOf(q) { return KINDS.find(k => k.id === q.kind); }
function reqProgress(q, key) {
  if (key === 'grade') return liveGrade() >= q.req.grade ? 1 : 0;
  return Math.max(0, S()[REQ_STAT[key]] - q.snap[key]);
}
function reqTarget(q, key) { return key === 'grade' ? 1 : q.req[key]; }
function questRatio(q) {
  const keys = Object.keys(q.req);
  return keys.reduce((a, k) => a + Math.min(1, reqProgress(q, k) / reqTarget(q, k)), 0) / keys.length;
}
function questReward(q, rush) { return incomeRef() * q.rewardSec * questRewardMult() * (rush ? 0.6 : 1); }
function questRep(q, rush) { const r = Math.ceil(q.repGain * questRepMult()); return rush ? Math.ceil(r / 2) : r; }

function acceptQuest(id) {
  const Q = state.quests;
  if (Q.active.length >= questSlots()) { toast('진행 중인 의뢰가 가득 찼습니다'); return; }
  const idx = Q.offers.findIndex(q => q.id === id);
  if (idx < 0) return;
  const q = Q.offers.splice(idx, 1)[0];
  q.snap = {};
  for (const k in REQ_STAT) q.snap[k] = S()[REQ_STAT[k]];
  q.time = Math.round(q.time * questTimeMult());
  q.endsAt = state.time + q.time;
  if (kindOf(q).boss) q.nextChange = state.time + 45;
  Q.active.push(q);
  const spawn = kindOf(q).spawn;
  if (spawn) { queueBugs(spawn); findBug(); }
  if (Q.nextOfferAt < state.time + 5) Q.nextOfferAt = state.time + 5;
}

function completeQuest(q, rush) {
  const g = questReward(q, rush);
  const rg = questRep(q, rush);
  addValue(g);
  addRep(rg);
  if (rush) addDebt(25);
  S().questsDone++;
  if (q.kind === 'next') S().nextGenDone++;
  if (q.kind === 'boss') S().bossDone++;
  state.quests.active = state.quests.active.filter(x => x !== q);
  toast((rush ? '급하게 납품: ' : '납품 완료: ') + q.client + ' "' + q.title + '" +' + won(g) + ', 평판 +' + rg + (rush ? ', 코드 복잡도 +25%' : ''));
}

function rushQuest(id) {
  const q = state.quests.active.find(x => x.id === id);
  if (q && questRatio(q) >= 0.5) completeQuest(q, true);
}

function tickQuests() {
  const Q = state.quests;
  for (const q of Q.active.slice()) {
    if (questRatio(q) >= 1) { completeQuest(q, false); continue; }
    if (state.time > q.endsAt) {
      const loss = Math.ceil(q.repGain / 2);
      addRep(-loss);
      S().questsFailed++;
      Q.active = Q.active.filter(x => x !== q);
      toast('마감 초과: ' + q.client + ' "' + q.title + '" 평판 -' + loss);
      continue;
    }
    if (q.nextChange && state.time >= q.nextChange) {
      q.req.lines = (q.req.lines || 0) + 10;
      q.nextChange += 45;
      toast(q.client + ': "이거 좀 바꿔주세요~" 코드 작성 목표 +10줄');
    }
  }
  if (Q.offers.length < OFFER_SLOTS && state.time >= Q.nextOfferAt) {
    Q.offers.push(genQuest());
    Q.nextOfferAt = state.time + (Q.offers.length < 2 ? 3 : 15) * (hasCrew('choi') ? 0.5 : 1);
  }
  if (hasCrew('lee') && Q.offers.length && Q.active.length < questSlots()) acceptQuest(Q.offers[0].id);
}

/* =========================================================
 * 팀
 * ========================================================= */
function subscribe(id) {
  const s = AI_SUBS.find(x => x.id === id);
  if (!s || hasSub(id) || state.rep < s.rep || state.value < s.cost) return;
  state.value -= s.cost;
  state.subs[id] = true;
  toast(s.name + ' 시작! 구독료는 수입의 ' + pct(s.fee * Math.pow(0.7, SK().lead)) + '씩 나갑니다');
}
function unsubscribe(id) {
  if (!hasSub(id)) return;
  state.subs[id] = false;
  toast(AI_SUBS.find(x => x.id === id).name + ' 해지');
}
function recruit(id) {
  const c = CREW.find(x => x.id === id);
  if (!c || hasCrew(id) || state.rep < c.rep || state.value < c.cost) return;
  state.value -= c.cost;
  state.crew[id] = true;
  toast(crewName(c) + ' ' + c.title + '(' + c.role + ') 합류! "잘 부탁드립니다"');
}
function aiKps() {
  let k = 0;
  AI_SUBS.forEach(s => { if (hasSub(s.id)) k += s.kps; });
  return k;
}

/* =========================================================
 * 릴리즈, 커리어
 * ========================================================= */
function canRelease() { return releaseGain() > state.releaseMult; }
function release() {
  if (!canRelease()) return;
  const g = releaseGain();
  const v = state.version;
  Object.assign(state, freshRun());
  state.version = v + 1;
  state.releaseMult = g;
  state.quests.active = [];
  state.quests.offers = [];
  state.quests.nextOfferAt = state.time + 3;
  S().releases++;
  save();
  toast('v' + v + '.0 릴리즈 완료! 배수 x' + fmt(g) + '. 코드와 파일은 그대로, 가치와 업그레이드는 처음부터');
}

function resetCompany() {
  const keep = { career: state.career, settings: state.settings, time: state.time, nextEventAt: state.nextEventAt, nextChallengeAt: state.nextChallengeAt, timers: state.timers };
  state = Object.assign(freshRun(), freshCompany(keep.career), keep, { buffs: [], challenge: null, lastSave: Date.now() });
  startFile();
  renderAllCode();
  lastSideHtml = '';
  save();
}

function jobCond() { const c = state.career; return { ver: state.version >= 4, rep: state.rep >= 20, ok: c.level < 5 && !c.route }; }
function canJobChange() { const j = jobCond(); return j.ver && j.rep && j.ok; }
function jobGain() { return 1 + Math.floor(Math.log10(Math.max(1, state.releaseMult))) + Math.floor(state.rep / 25); }
function jobChange() {
  if (!canJobChange()) return;
  const gain = jobGain();
  const c = state.career;
  c.points += gain;
  c.level++;
  c.stats.jobs++;
  resetCompany();
  askCompany('job', () => openModal({ title: TITLES[c.level] + '(으)로 이직 성공!', desc: companyName() + '에 ' + TITLES[c.level] + '(으)로 입사했습니다. 경력 포인트 +' + gain + '. 커리어 탭에서 스킬을 배우세요.<br>v1.0부터 다시 시작하고, 직급 보너스로 수입 x' + careerMult().toFixed(1) + '가 적용됩니다.', choices: [{ label: '출근하기' }] }));
}

// 사내 승진: 아무것도 초기화되지 않는 대신 경력 포인트가 적고 조건이 더 까다로움
function innerCond() {
  const c = state.career;
  return { ver: state.version >= state.promoBase + 3, rep: state.rep >= 25 + 5 * c.level, ok: c.level < 5 && !c.route, needVer: state.promoBase + 3, needRep: 25 + 5 * c.level };
}
function canInnerPromote() { const p = innerCond(); return p.ver && p.rep && p.ok; }
function innerPromote() {
  if (!canInnerPromote()) return;
  const c = state.career;
  c.level++;
  c.points += 1;
  state.promoBase = state.version;
  toast(companyName() + '에서 ' + TITLES[c.level] + '(으)로 승진! 경력 포인트 +1, 수입 x' + careerMult().toFixed(1) + '. 진행 상황은 그대로 유지됩니다');
}

function execIndex() { const c = state.career; return c.route === 'exec' ? c.level - 5 : 0; }
function nextExec() { const c = state.career; if (c.route === 'ceo' || c.level < 5 || c.cto) return null; return EXEC[execIndex()] || null; }
function canPromote() { const e = nextExec(); return !!e && state.runBest >= e.value && state.rep >= e.rep; }
function promote() {
  if (!canPromote()) return;
  const c = state.career;
  const e = nextExec();
  c.route = 'exec';
  c.level++;
  c.points += 2;
  if (e.title === 'CTO') {
    c.cto = true;
    openModal({ title: 'CTO 취임! 기술 총괄이 되었습니다', desc: endingStats() + '<br>안정적인 길 끝에 회사의 기술을 책임지는 자리에 올랐습니다. 계속 플레이하며 더 큰 숫자에 도전하세요.', choices: [{ label: '엔딩 카드 만들기', act: () => showCard('CTO 엔딩') }, { label: 'CTO로 계속 플레이', alt: true }, ngChoice()] });
  } else {
    toast(e.title + ' 승진! 경력 포인트 +2, 수입 x' + careerMult().toFixed(1));
  }
}

function canFound() { const c = state.career; return c.level >= 5 && !c.route; }
function found() {
  if (!canFound()) return;
  const c = state.career;
  c.route = 'ceo';
  c.ipo = false;
  c.stats.founded++;
  resetCompany();
  state.value = 1e5;
  askCompany('found', () => openModal({
    title: '창업! 이제 ' + companyName() + ' ' + devName() + ' 대표님입니다',
    desc: '자본금 ' + won(1e5) + '으로 시작합니다.<br>매출은 3배지만 <b>시장 상황</b>(x0.15~x3)에 따라 10초마다 크게 출렁입니다.<br>시장과 상관없이 매초 <b>운영비</b>(임대료, 인건비)가 나가고, 회사가 오래될수록 늘어납니다. 시장이 x0.5~0.8 아래로 떨어지면 적자예요.<br>세무조사, 해킹 같은 사고로 운영자금이 한 번에 깎이기도 합니다.<br>서비스 가치(운영자금)가 바닥난 채 ' + BANKRUPT_SEC + '초를 버티지 못하면 <b>폐업</b>합니다.<br>목표: 서비스 가치 ' + won(IPO_VALUE) + ' 달성으로 상장(IPO)',
    choices: [{ label: '사업 시작' }],
  }));
}

function goBankrupt() {
  const c = state.career;
  const lost = Math.ceil(c.points / 2);
  c.points -= lost;
  c.route = null;
  c.level = 5;
  c.stats.bankrupts++;
  const old = companyName();
  resetCompany();
  openModal({ title: '폐업했습니다', desc: old + '이(가) 운영자금이 바닥나 문을 닫았습니다. 경력 포인트 ' + lost + '을 잃었습니다.<br>다른 회사에 부장으로 재취업합니다. 다시 이사 승진이나 재창업에 도전하세요.', choices: [{ label: '재취업하기', act: () => askCompany('job') }] });
}

function checkIpo() {
  const c = state.career;
  if (c.route !== 'ceo' || c.ipo || state.runBest < IPO_VALUE) return;
  c.ipo = true;
  openModal({ title: '상장(IPO) 성공!', desc: endingStats() + '<br>회사가 상장했습니다! 이제 시장 리스크와 운영비 걱정 없이 수입 x10이 영구 적용됩니다.', choices: [{ label: '엔딩 카드 만들기', act: () => showCard('상장 엔딩') }, { label: '대표로 계속 플레이', alt: true }, ngChoice()] });
}

function endingStats() {
  const st = S();
  const h = Math.floor(st.playTime / 3600);
  const m = Math.floor(st.playTime % 3600 / 60);
  return '플레이 시간 ' + h + '시간 ' + m + '분<br>타이핑 ' + fmtInt(st.keys) + '회, 작성한 코드 ' + fmtInt(st.linesTyped) + '줄, 완성한 파일 ' + st.filesDone + '개<br>납품 ' + st.questsDone + '건, 버그 수정 ' + st.bugsFixed + '개, 이직 ' + st.jobs + '회<br>';
}

function learnSkill(id) {
  const sk = SKILLS.find(x => x.id === id);
  const c = state.career;
  const rank = c.skills[id];
  if (rank >= sk.max || c.points < rank + 1) return;
  c.points -= rank + 1;
  c.skills[id]++;
  toast(sk.name + ' Lv.' + c.skills[id] + ' 습득');
}

/* =========================================================
 * 상점
 * ========================================================= */
// 뒷모습 개발자 장면: 데스크 셋업 단계(0~7), 시간대, 성별, 직급별 옷에 따라 바뀜. 모니터 속 코드는 위로 흘러감
// 뒷모습 개발자 장면 (80x48 도트)
// tier: 데스크 셋업 단계 0~7, phase: day|dusk|night, gender: m|f, outfit: 0 후드티/가디건, 1 셔츠/블라우스, 2 정장, 3 터틀넥(대표)
function sceneSvg(tier, phase, gender, outfit, scale, opts) {
  opts = opts || {};
  const R = [];
  const r = (x, y, w, h, c, cls) => { if (w > 0 && h > 0) R.push('<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + c + '"' + (cls ? ' class="' + cls + '"' : '') + '/>'); };
  const oval = (cx, cy, rx, ry, c) => { for (let y = -ry; y <= ry; y++) { const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry)))); r(cx - w, cy + y, w * 2 + 1, 1, c); } };
  const night = phase === 'night', dusk = phase === 'dusk';

  // 벽과 창문
  r(0, 0, 80, 48, night ? '#141b2b' : dusk ? '#c9b3b8' : '#d3dce4');
  r(0, 26, 80, 3, night ? '#10172a' : dusk ? '#b9a2a8' : '#c3ced8'); // 걸레받이 느낌의 띠
  r(3, 1, 20, 8, night ? '#0b1020' : '#9fb0bf');
  r(4, 2, 18, 6, night ? '#1b2546' : dusk ? '#f2a36b' : '#dceefb');
  r(12, 2, 2, 6, night ? '#0b1020' : '#9fb0bf');
  if (night) { r(6, 3, 3, 3, '#f5f1c8'); r(7, 3, 2, 1, '#1b2546'); r(17, 4, 1, 1, '#c9d6ff'); r(20, 6, 1, 1, '#c9d6ff'); r(15, 6, 1, 1, '#8ea2d9'); }
  else if (dusk) { r(16, 5, 4, 2, '#ffcf6b'); r(4, 6, 8, 2, '#e88a5a'); }
  else { r(5, 3, 4, 1, '#ffffff'); r(15, 4, 5, 1, '#ffffff'); r(16, 3, 2, 1, '#ffffff'); }
  // 화분
  if (tier < 7) { r(72, 21, 5, 5, '#b5651d'); r(72, 21, 5, 1, '#cd7f32'); oval(74, 17, 3, 3, '#4caf50'); r(73, 15, 1, 3, '#66bb6a'); r(76, 16, 1, 2, '#388e3c'); }

  // 모니터 (화면 속 코드가 위로 흘러감)
  let mid = 0;
  const mon = (x, y, w, h, seed, speed) => {
    const id = 'scr' + (mid++);
    r(x, y, w, h, '#1d2328'); r(x, y, w, 1, '#2b3238');
    const sc = SCREEN[opts.theme] || SCREEN.dark;
    r(x + 1, y + 1, w - 2, h - 2, night && sc.night ? sc.night : sc.bg);
    const cols = sc.cols;
    const lens = [9, 5, 12, 7, 0, 10, 8, 4, 11, 6], ind = [0, 2, 4, 4, 0, 2, 4, 6, 2, 0];
    let lines = '';
    const add = (xx, yy, ww, c) => { if (ww > 0) lines += '<rect x="' + xx + '" y="' + yy + '" width="' + ww + '" height="1" fill="' + c + '"/>'; };
    for (let i = 0; i < 20; i++) {
      const k = (i + seed) % 10;
      const yy = y + 2 + i * 2;
      add(x + 2, yy, 1, sc.ln);
      if (!lens[k]) continue;
      const len = Math.min(lens[k], w - 6 - ind[k]);
      add(x + 4 + ind[k], yy, Math.ceil(len * 0.6), cols[k % cols.length]);
      add(x + 5 + ind[k] + Math.ceil(len * 0.6), yy, Math.floor(len * 0.4), cols[(k + 3) % cols.length]);
    }
    const steps = [];
    for (let s = 0; s < 10; s++) steps.push('0 ' + (-s * 2));
    R.push('<clipPath id="' + id + '"><rect x="' + (x + 1) + '" y="' + (y + 1) + '" width="' + (w - 2) + '" height="' + (h - 2) + '"/></clipPath><g clip-path="url(#' + id + ')"><g>' + lines +
      '<animateTransform attributeName="transform" type="translate" calcMode="discrete" values="' + steps.join(';') + '" dur="' + speed + 's" repeatCount="indefinite"/></g></g>');
    r(x + w - 3, y + h - 2, 1, 1, '#7cfc00'); // 전원 표시등
    if (night) r(x - 1, y - 1, w + 2, 1, 'rgba(86,156,214,.18)');
    const cx = x + Math.floor(w / 2);
    r(cx - 1, y + h, 3, 3, '#3d4a54'); r(cx - 5, y + h + 3, 11, 1, '#3d4a54'); r(cx - 5, y + h + 3, 11, 1, '#4b5a65');
  };
  mon(30, 4, 24, 20, 0, 2.4);
  if (tier >= 3) mon(7, 9, 21, 16, 3, 3.1);
  if (tier >= 7) mon(56, 9, 21, 16, 6, 2.8);

  // 책상
  const top = tier >= 4 ? (night ? '#a8865c' : '#d9b98a') : (night ? '#7d5f3e' : '#b58a57');
  const edge = tier >= 4 ? (night ? '#8a6c47' : '#bf9d6d') : (night ? '#5f4630' : '#8f6a40');
  r(0, 28, 80, 4, top); r(0, 28, 80, 1, tier >= 4 ? '#e6cba1' : '#c99b65'); r(0, 32, 80, 2, edge);
  if (tier >= 4) { // 모션 데스크: 기둥형 다리와 조작 패널
    r(8, 34, 3, 12, '#4a4f55'); r(69, 34, 3, 12, '#4a4f55'); r(5, 46, 9, 2, '#3a3f45'); r(66, 46, 9, 2, '#3a3f45');
    r(12, 32, 4, 1, '#2b2f33'); r(13, 32, 1, 1, '#7cfc00');
  } else { r(4, 34, 3, 14, night ? '#3a2c1d' : '#6b5338'); r(73, 34, 3, 14, night ? '#3a2c1d' : '#6b5338'); }
  // 마우스패드, 마우스, 커피, 밤 스탠드
  r(57, 26, 9, 2, '#2c2f33');
  if (tier >= 2) { r(61, 25, 3, 2, '#1b1b1b'); r(62, 26, 1, 1, '#e040fb'); } else { r(61, 25, 3, 2, '#d0d0d0'); }
  r(24, 23, 4, 5, '#f5f5f5'); r(24, 23, 4, 1, '#6b3d1e'); r(28, 24, 1, 2, '#f5f5f5');
  if (night) { r(2, 15, 1, 13, '#7a7a7a'); r(1, 14, 5, 2, '#9a9a9a'); r(0, 16, 12, 12, 'rgba(255,214,120,.10)'); }

  // 키보드 (사람 양옆으로 보임)
  if (tier >= 6) { r(27, 25, 28, 3, '#e9e9e9'); for (let i = 0; i < 13; i++) r(28 + i * 2, 25, 1, 1, '#c4c4c4'); r(27, 27, 28, 1, '#cfcfcf'); }
  else if (tier >= 1) { r(27, 25, 28, 3, '#26292c'); const k = ['#e74c3c', '#f1c40f', '#2ecc71', '#3498db', '#9b59b6', '#e67e22']; for (let i = 0; i < 13; i++) r(28 + i * 2, 25, 1, 1, k[i % 6]); r(27, 27, 28, 1, '#1a1c1e'); }
  else { r(27, 25, 28, 3, '#a7a7a7'); for (let i = 0; i < 13; i++) r(28 + i * 2, 25, 1, 1, '#c8c8c8'); r(27, 27, 28, 1, '#8f8f8f'); }

  // 책상 위 소품: 지금 쓰고 있는 아이템과 먹고 있는 음식
  const items = (opts.items || []).slice();
  const slots = [19, 66, 9, 0];
  let si = 0;
  for (const k of items) {
    const m = DESK_MINI[k];
    if (!m || si >= slots.length) continue;
    const ox = slots[si++], oy = 28 - m.rows.length;
    m.rows.forEach((row, yy) => { for (let xx = 0; xx < row.length; xx++) if (row[xx] !== '.') r(ox + xx, oy + yy, 1, 1, m.pal[row[xx]]); });
  }

  // 사람
  const skin = '#f2c6a0', skinS = '#dba982';
  const OUT = gender === 'm'
    ? [['#2f4f7f', '#26406a', '#1f3557'], ['#cfe0f5', '#b4cbe6', '#9fb8d6'], ['#2b2f3a', '#21242d', '#3a3f4d'], ['#1a1a1a', '#121212', '#2a2a2a']]
    : [['#e8a0b4', '#d48aa0', '#c27890'], ['#f7f4ee', '#e3ded4', '#d1cbbf'], ['#2c3550', '#232b42', '#3a4566'], ['#1a1a1a', '#121212', '#2a2a2a']];
  const [c1, c2, c3] = OUT[Math.min(outfit, 3)];
  // 몸과 어깨
  oval(41, 30, 13, 6, c1); r(28, 26, 27, 5, c1); r(30, 23, 23, 4, c1); r(32, 22, 19, 2, c1);
  r(30, 24, 3, 6, c2); r(50, 24, 3, 6, c2);                    // 옆구리 그림자
  // 팔과 손 (h1, h2 두 자세를 번갈아 보여줘서 타이핑 동작)
  r(26, 25, 4, 3, c1); r(53, 25, 4, 3, c1);
  r(25, 26, 3, 2, skin, 'h1'); r(55, 25, 3, 2, skin, 'h1');
  r(25, 25, 3, 2, skin, 'h2'); r(55, 26, 3, 2, skin, 'h2');
  if (outfit === 0 && gender === 'm') { r(36, 21, 11, 3, c2); r(38, 23, 7, 2, c3); r(39, 24, 1, 3, '#d9d9d9'); r(43, 24, 1, 3, '#d9d9d9'); } // 후드와 끈
  if (outfit === 1) { r(37, 21, 9, 2, c2); r(39, 22, 5, 1, c3); }        // 셔츠 깃
  if (outfit === 2) { r(37, 21, 9, 2, '#e8e8e8'); r(36, 22, 2, 2, c3); r(45, 22, 2, 2, c3); } // 정장 깃과 셔츠
  if (outfit === 3) { r(37, 20, 9, 3, c3); }                              // 터틀넥
  if (gender === 'm') {
    r(39, 19, 5, 3, skinS);                                               // 목
    oval(34, 14, 1, 2, skin); r(34, 14, 1, 1, skinS); oval(48, 14, 1, 2, skin); r(48, 14, 1, 1, skinS); // 귀
    oval(41, 13, 7, 7, '#2a1c13');
    r(35, 17, 13, 2, '#3a291d'); r(36, 19, 11, 1, '#4a3526');             // 투블럭 뒷머리
    r(37, 7, 5, 1, '#4a3526'); r(43, 8, 3, 1, '#4a3526'); r(39, 10, 2, 1, '#3d2a1e'); r(44, 11, 2, 1, '#3d2a1e'); // 머리결
  } else {
    r(39, 19, 5, 2, skinS);
    oval(41, 13, 7, 7, '#5a3420');
    r(34, 16, 15, 7, '#5a3420'); r(35, 23, 13, 3, '#4c2b1a');
    r(37, 8, 3, 1, '#7a4a2e'); r(44, 10, 2, 1, '#7a4a2e'); r(38, 17, 1, 8, '#6b3f26'); r(41, 18, 1, 7, '#6b3f26'); r(45, 17, 1, 8, '#6b3f26'); // 머리결
    r(38, 14, 6, 2, '#ffd166'); r(39, 14, 1, 1, '#fff1b8');               // 머리핀
  }

  // 의자 (사람 등을 가리는 높은 등받이)
  const gaming = tier >= 5;
  const fr = gaming ? '#1b1b1f' : '#2a2d31', frL = gaming ? '#2c2c33' : '#3d4248', me = gaming ? '#151518' : '#1c1f22', meL = gaming ? '#25252b' : '#30353a';
  r(32, 26, 18, 1, fr); r(31, 27, 20, 1, fr); r(30, 28, 22, 13, fr);
  r(32, 27, 18, 1, frL);
  r(31, 29, 20, 11, me);
  if (gaming) { // 게이밍 의자: 빨간 라인과 로고
    r(31, 29, 3, 11, '#c62828'); r(48, 29, 3, 11, '#c62828'); r(32, 27, 18, 1, '#e53935');
    r(39, 31, 4, 3, '#c62828'); r(40, 32, 2, 1, '#ff8a80');
    for (let y = 29; y < 40; y += 2) r(34, y, 14, 1, meL);
  } else {
    for (let y = 29; y < 40; y++) for (let x = 31 + (y % 2); x < 51; x += 2) r(x, y, 1, 1, meL); // 메쉬
    r(32, 35, 18, 2, frL);
  }
  r(26, 34, 5, 2, frL); r(51, 34, 5, 2, frL);
  r(27, 36, 2, 5, fr); r(53, 36, 2, 5, fr);
  r(29, 41, 24, 2, fr); r(29, 41, 24, 1, frL);
  r(40, 43, 2, 2, '#8a9199'); r(40, 43, 1, 2, '#b3bac2');
  r(33, 45, 16, 1, fr); r(30, 46, 6, 1, fr); r(46, 46, 6, 1, fr); r(39, 46, 4, 1, fr);
  [30, 35, 40, 45, 50].forEach(x => r(x, 47, 2, 1, '#111'));

  return '<svg viewBox="0 0 80 48" width="' + 80 * scale + '" height="' + 48 * scale + '" shape-rendering="crispEdges">' + R.join('') + '</svg>';
}
// 실제 시간 기준: 6~17시 낮, 17~19시 저녁, 그 외 밤
function dayPhase(d) { const h = (d || new Date()).getHours(); return h >= 6 && h < 17 ? 'day' : h < 19 ? 'dusk' : 'night'; }

function pixelArt(id, size) {
  const a = ITEM_ART[id];
  if (!a) return '';
  let r = '';
  a.rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      if (ch === '.') { x++; continue; }
      let x2 = x;
      while (x2 < row.length && row[x2] === ch) x2++;
      r += '<rect x="' + x + '" y="' + y + '" width="' + (x2 - x) + '" height="1" fill="' + a.pal[ch] + '"/>';
      x = x2;
    }
  });
  return '<svg class="pixel" viewBox="0 0 16 16" width="' + size + '" height="' + size + '" shape-rendering="crispEdges">' + r + '</svg>';
}
function itemPrice(it) { return Math.max(it.min, incomeRef() * it.sec); }
// 재사용 대기 시간 (사용한 순간부터 계산)
function itemCdLeft(id) { return Math.max(0, (state.itemCd[id] || 0) - state.time); }
function buyItem(id) {
  const it = ITEMS.find(x => x.id === id);
  const p = itemPrice(it);
  if (state.value < p) return;
  if (it.stack) {
    if ((state.inv[id] || 0) >= it.stack) { toast(it.name + '은(는) 최대 ' + it.stack + '개까지 가질 수 있습니다'); return; }
    state.value -= p;
    state.inv[id] = (state.inv[id] || 0) + 1;
    toast(it.name + ' 구입 (보관 ' + state.inv[id] + '개). 버그가 생기면 자동으로 고쳐줘요');
    if (id === 'glass' && state.bugs.length) useGlass(state.bugs[state.bugs.length - 1]);
    return;
  }
  const cd = itemCdLeft(id);
  if (cd > 0) { toast(it.name + ' 재사용 대기 중 (' + fmtSec(cd) + ')'); return; }
  state.value -= p;
  state.itemCd[id] = state.time + it.cd;
  if (id === 'coffee') { addBuff('typing', 1.5, 30, '커피 타이핑 x1.5'); S().coffee = (S().coffee || 0) + 1; }
  if (id === 'energy') { addBuff('income', 1.3, 60, '에너지 드링크 x1.3'); addBuff('income', 0.7, 15, '피곤함 x0.7', true, 60); }
  if (id === 'pizza') { addRep(1); addBuff('calm', 0, 30, '복잡도 증가 없음'); }
  if (id === 'wrist') addBuff('combo', 2, 60, '손목 받침대');
  toast(it.name + ' 사용!');
}
// 스마트글래스 1개를 써서 버그를 바로 고침
function useGlass(no) {
  if (!(state.inv.glass > 0)) return false;
  state.inv.glass--;
  fixBug(no, true);
  showFloat('스마트글래스가 버그를 잡았어요 (남은 ' + state.inv.glass + '개)', true);
  return true;
}

/* =========================================================
 * 이벤트
 * ========================================================= */
const EVENTS = [
  { w: 3, make: () => {
    const d = rollDeploy();
    const mood = d.p >= 0.75 ? '테스트도 끝났고 꽤 안정적입니다.' : d.p >= 0.5 ? '테스트가 조금 덜 끝났습니다.' : '테스트를 거의 못 했습니다. 위험합니다.';
    return {
      title: '금요일 배포 요청', desc: '고객사에서 금요일 오후 5시에 배포해 달라고 합니다. ' + mood + '<br>성공률이 낮을수록 성공했을 때 보상이 큽니다.',
      choices: [
        { label: '배포한다 (성공률 ' + pct(d.p) + ', 성공 시 +' + won(d.reward) + ', 평판 +' + d.rep + ')', act: () => {
          if (Math.random() < d.p) { addValue(d.reward); addRep(d.rep); S().fridayOk++; toast('배포 성공! +' + won(d.reward) + ', 평판 +' + d.rep); }
          else { toast('배포 실패! 운영 장애 발생'); startIncident(); }
        } },
        { label: '월요일로 미룬다 (평판 -1)', alt: true, act: () => addRep(-1) },
      ], def: 1 };
  } },
  { w: 2, make: () => {
    const q = state.quests.active.length ? pick(state.quests.active) : null;
    if (q) {
      q.req.lines = Math.ceil((q.req.lines || 7) * 1.5);
      q.endsAt += 60;
      return { title: '요구사항 변경', desc: q.client + '에서 요구사항을 바꿨습니다.<br>"' + q.title + '" 코드 작성 목표가 ' + q.req.lines + '줄로 늘고, 마감이 60초 연장됩니다.', choices: [{ label: '확인' }] };
    }
    addDebt(10);
    return { title: '요구사항 변경', desc: '기획이 바뀌어 기존 코드를 뜯어고쳐야 합니다. 코드 복잡도 +10%', choices: [{ label: '확인' }] };
  } },
  { w: 2, cond: () => state.lines.length >= 10, make: () => ({
    title: '새벽 2시 장애 알림', desc: '운영 서버에 장애가 발생했습니다.<br>' + incidentTime() + '초 안에 빨간 줄의 버그를 모두 클릭해서 잡으세요.',
    choices: [{ label: '대응 시작', act: () => startIncident() }], def: 0 }) },
  { w: 2, make: () => {
    const need = trafficNeed();
    if (state.lv.srv >= need || hasCrew('yoon')) { addBuff('income', 3, 30, '트래픽 폭주 x3'); return { title: '트래픽 폭주', desc: '이벤트 페이지에 사용자가 몰렸지만 서버가 버텨냈습니다!<br>30초 동안 수입 x3', choices: [{ label: '확인' }] }; }
    addBuff('income', 0.3, 20, '서버 다운 x0.3', true);
    return { title: '트래픽 폭주', desc: '사용자가 몰려 서버가 다운됐습니다. 20초 동안 수입 x0.3<br>(버티려면 서버 증설 Lv.' + need + ' 이상 필요)', choices: [{ label: '확인' }] };
  } },
  { w: 1, make: () => {
    addBuff('freeze', 1, 60, '코드 프리징', true);
    addBuff('typing', 2, 60, '문서화 x2');
    return { title: '코드 프리징', desc: '오픈 전 코드 프리징 기간입니다.<br>60초 동안 업그레이드를 살 수 없지만, 문서 작업 덕에 타이핑 수익이 2배가 됩니다.', choices: [{ label: '확인' }] };
  } },
  { w: 2, make: () => ({
    title: '야근 요청', desc: '팀장님이 오늘 야근 가능하냐고 묻습니다.',
    choices: [
      { label: '야근한다 (45초 타이핑 수익 x3, 코드 복잡도 +10%)', act: () => { addBuff('typing', 3, 45, '야근 x3'); addDebt(10); } },
      { label: '칼퇴한다', alt: true, act: () => toast('칼퇴 성공. 내일 봬요') },
    ], def: 1 }) },
  { w: 2, cond: () => state.lines.length >= 10, make: () => ({
    title: '"제 PC에선 되는데요?"', desc: '고객사에서 오류가 난다는데 내 PC에서는 멀쩡합니다.',
    choices: [
      { label: '로그를 뒤져 원인을 찾는다 (버그 2개 수정)', act: () => { startIncident(2, 40, 2, 1, '원인 분석'); } },
      { label: '"재부팅 한번 해보시겠어요?" (50% 확률)', alt: true, act: () => { if (Math.random() < 0.5) { addRep(1); toast('재부팅하니 됐답니다. 평판 +1'); } else { addRep(-2); toast('"그걸로 될 리가요" 평판 -2'); } } },
    ], def: 1 }) },
  { w: 1, cond: () => state.lines.length >= 10, make: () => ({
    title: '고객사 시연 중 에러!', desc: '임원들 앞에서 시연하는데 화면에 에러가 떴습니다. 15초 안에 버그를 잡으세요!',
    choices: [{ label: '침착하게 고친다', act: () => startIncident(1, 15, 3, 4, '시연 중 긴급 수정') }], def: 0 }) },
  { w: 1, make: () => ({
    title: '운영 DB에 DELETE를 날렸다', desc: 'WHERE 조건 없이 운영 DB에 DELETE를 실행해 버렸습니다... 어떻게 할까요?',
    choices: [
      { label: '바로 보고하고 백업으로 복구 (평판 -1, 30초 수입 x0.5)', act: () => { addRep(-1); addBuff('income', 0.5, 30, '복구 작업 x0.5', true); } },
      { label: '몰래 복구를 시도한다 (60% 성공)', alt: true, act: () => { if (Math.random() < 0.6) toast('휴... 아무도 모르게 복구했습니다'); else { addRep(-5); toast('들켰습니다. 평판 -5, 장애 발생'); startIncident(); } } },
    ], def: 0 }) },
  { w: 2, make: () => ({
    title: '점심 메뉴 고르기', desc: '오늘 점심은 뭐 먹을까요?',
    choices: LUNCH.slice().sort(() => Math.random() - 0.5).slice(0, 3).map(f => ({ label: f.label, act: () => { if (f.rep) addRep(f.rep); for (const b of f.buffs) addBuff(...b); } })),
    def: 0 }) },
  // 대표 전용
  { w: 3, cond: () => isCeo() && !state.career.ipo, make: () => ({
    title: '투자 유치 제안', desc: '벤처캐피털에서 투자를 제안했습니다. 지분 10%를 주면 ' + won(incomeRef() * 600) + '을 투자하겠답니다.',
    choices: [
      { label: '투자 받는다 (자금 확보, 수입 영구 x0.9)', act: () => { addValue(incomeRef() * 600); state.equity *= 0.9; } },
      { label: '거절한다', alt: true },
    ], def: 1 }) },
  { w: 2, cond: () => isCeo() && !state.career.ipo, make: () => { state.market = 0.2; return { title: '경기 침체', desc: '경기가 얼어붙어 매출이 급감했습니다. 시장 상황 x0.2<br>운영비는 그대로 나가니 운영자금이 바닥나지 않게 조심하세요.', choices: [{ label: '버텨보자' }] }; } },
  { w: 3, cond: () => isCeo() && !state.career.ipo, make: () => {
    const loss = state.value * 0.4;
    state.value -= loss;
    return { title: '세무조사', desc: '국세청에서 세무조사가 나왔습니다. 추징금으로 운영자금의 40%(' + won(loss) + ')가 나갔습니다.', choices: [{ label: '눈물을 머금고 납부' }] };
  } },
  { w: 2, cond: () => isCeo() && !state.career.ipo, make: () => ({
    title: '해킹 사고', desc: '서비스가 해킹당해 개인정보 유출 의혹이 생겼습니다.',
    choices: [
      { label: '바로 공지하고 보상 (운영자금 -30%, 평판 유지)', act: () => { const l = state.value * 0.3; state.value -= l; toast('보상금 ' + won(l) + ' 지급. 고객 신뢰는 지켰습니다'); } },
      { label: '조용히 넘어간다 (50% 확률로 들킴: 운영자금 -60%, 평판 -5)', alt: true, act: () => { if (Math.random() < 0.5) { const l = state.value * 0.6; state.value -= l; addRep(-5); toast('언론에 터졌습니다. 과징금 ' + won(l) + ', 평판 -5'); } else toast('다행히 조용히 지나갔습니다'); } },
    ], def: 0 }) },
  { w: 2, cond: () => isCeo(), make: () => { const g = incomeRef() * 300; addValue(g); addRep(3); return { title: '대형 계약 수주', desc: '대기업과 대형 계약을 맺었습니다! +' + won(g) + ', 평판 +3', choices: [{ label: '좋았어' }] }; } },
  { w: 2, cond: () => isCeo() && CREW.some(c => hasCrew(c.id)), make: () => {
    const c = pick(CREW.filter(x => hasCrew(x.id)));
    state.crew[c.id] = false;
    return { title: '핵심 인력 이탈', desc: crewName(c) + ' ' + c.title + '이(가) 경쟁사로 이직했습니다. 다시 섭외하려면 팀 탭에서 섭외하세요.', choices: [{ label: '아쉽지만 보내준다' }] };
  } },
];

function fireEvent() {
  const avail = EVENTS.filter(e => !e.cond || e.cond());
  let roll = Math.random() * avail.reduce((a, e) => a + e.w, 0);
  let ev = avail[0];
  for (const e of avail) { roll -= e.w; if (roll <= 0) { ev = e; break; } }
  openModal(ev.make());
}

/* ---------- 타이핑 챌린지 ---------- */
function startChallenge() {
  const words = WORDS.slice().sort(() => Math.random() - 0.5);
  state.challenge = { words, idx: 0, pos: 0, until: state.time + 15, combo: 0, done: 0, earned: 0 };
}
function challengeKey(ch) {
  const c = state.challenge;
  const word = c.words[c.idx % c.words.length];
  if (ch === word[c.pos]) {
    c.pos++;
    if (c.pos >= word.length) {
      const g = keyGainAt(state.lv.key) * 15 * (1 + c.combo * 0.5);
      addValue(g);
      c.earned += g;
      c.combo++;
      c.done++;
      c.idx++;
      c.pos = 0;
      S().challengeWords++;
      showFloat(word + ' 콤보 ' + c.combo + ' +' + won(g), true);
    }
  } else {
    c.pos = 0;
    c.combo = 0;
  }
}
function endChallenge() {
  const c = state.challenge;
  state.challenge = null;
  toast('타이핑 챌린지 종료: ' + c.done + '단어, +' + won(c.earned));
}

/* =========================================================
 * 모달
 * ========================================================= */
function openModal(spec) {
  modalSpec = spec;
  spec.openedAt = state.time;
  const box = $('modalBox');
  box.classList.toggle('wide', !!spec.wide);
  let html = '<h3>' + spec.title + '</h3><div class="m-desc">' + spec.desc + '</div>';
  if (spec.input) html += '<form id="modalForm"><input id="modalInput" maxlength="12" placeholder="' + spec.input + '" autocomplete="off"></form>';
  html += '<div class="m-btns">';
  spec.choices.forEach((c, i) => { html += '<button data-choice="' + i + '"' + (c.alt ? ' class="alt"' : '') + '>' + c.label + '</button>'; });
  html += '</div>';
  if (spec.def !== undefined) html += '<div class="m-auto" id="modalAuto"></div>';
  box.innerHTML = html;
  $('modal').classList.remove('hidden');
  const inp = $('modalInput');
  if (inp) { inp.focus(); $('modalForm').addEventListener('submit', e => { e.preventDefault(); closeModal(0); }); }
}
function closeModal(i) {
  const spec = modalSpec;
  if (!spec) return;
  const inp = $('modalInput');
  const val = inp ? inp.value : '';
  const c = spec.choices[i];
  if (c && c.keep) { if (c.act) c.act(val); return; }
  modalSpec = null;
  $('modal').classList.add('hidden');
  if (c && c.act) c.act(val);
}
$('modalBox').addEventListener('click', e => {
  const b = e.target.closest('[data-choice]');
  if (b) closeModal(+b.dataset.choice);
});

function askName(first) {
  openModal({
    title: first ? '반갑습니다, 신입 개발자님!' : '이름 바꾸기',
    desc: first ? '개발자 키우기는 신입 개발자로 시작해 CTO나 대표까지 성장하는 게임입니다.<br>이름을 알려주세요. 코드 파일의 작성자로도 들어갑니다.' : '새 이름을 입력하세요.',
    input: '이름 (최대 12자)',
    choices: [{ label: first ? '다음' : '바꾸기', act: v => { setName(v, !first); if (first) askGender(true); } }],
  });
}

function askGender(first) {
  const pickG = g => { state.career.gender = g; lastDeskKey = ''; lastSideHtml = ''; if (first) askCompany('first'); };
  openModal({
    title: '캐릭터를 골라주세요',
    desc: '에디터 오른쪽 아래에서 코딩하는 내 모습이에요. 설정 탭에서 언제든 바꿀 수 있습니다.',
    choices: [{ label: '남자', act: () => pickG('m') }, { label: '여자', act: () => pickG('f') }],
  });
}

// mode: first(처음 입사), job(이직), found(창업), rename(이름 바꾸기)
function askCompany(mode, after) {
  const suggest = randomCompany();
  const T = {
    first: ['어느 회사에 입사할까요?', '첫 직장의 회사 이름을 정해주세요. 비워두면 "' + suggest + '"(으)로 정해집니다.', '입사하기'],
    job: ['새 회사 이름', '이직할 회사 이름을 정해주세요. 비워두면 "' + suggest + '"(으)로 정해집니다.', '이직하기'],
    found: ['내 회사 이름', '창업할 회사 이름을 정해주세요. 비워두면 "' + suggest + '"(으)로 정해집니다.', '창업하기'],
    rename: ['회사 이름 바꾸기', '새 회사 이름을 입력하세요.', '바꾸기'],
  }[mode];
  openModal({
    title: T[0], desc: T[1], input: suggest,
    choices: [{ label: T[2], act: v => { setCompany(String(v || '').trim() || suggest); if (mode === 'first') showGuide(); if (after) after(); } }],
  });
}
function setCompany(v) {
  state.company = String(v).slice(0, 12);
  refreshAuthor();
  lastSideHtml = '';
}
function refreshAuthor() {
  state.lines = state.lines.map(l => l.replace(/작성자 : .*?( -->)?$/, (m, tail) => '작성자 : ' + authorText() + (tail || '')));
  renderAllCode();
}
function showGuide() {
  openModal({
    title: '코딩을 시작해볼까요?',
    desc: '<b>키보드 아무 키</b>나 누르거나 <b>에디터를 마우스로 클릭</b>하면 코드가 쳐지고 수익(서비스 가치)이 생깁니다.<br><br>모은 돈으로 오른쪽 <b>업그레이드</b>를 사서 수입을 늘리고, <b>의뢰</b> 탭에서 일감을 받아 평판을 쌓아보세요.<br>코드 줄에 마우스를 올리면 그 코드의 설명도 볼 수 있어요.',
    choices: [{ label: '시작하기' }],
  });
}
function setName(v, notify) {
  const name = String(v || '').trim().slice(0, 12);
  state.career.name = name || '개발자';
  refreshAuthor();
  lastSideHtml = '';
  if (notify) toast('이름을 ' + state.career.name + '(으)로 바꿨습니다');
}

/* =========================================================
 * 목표
 * ========================================================= */
function goalText() {
  const st = S();
  const c = state.career;
  const f = curFile();
  if (isCeo() && !c.ipo && state.bankrupt > 0) return '자금난! 운영자금이 바닥났습니다. ' + fmtSec(BANKRUPT_SEC - state.bankrupt) + ' 안에 매출을 회복하세요';
  if (st.questsDone === 0) return '의뢰 탭에서 의뢰를 수락하고 첫 납품을 하세요';
  if (st.filesDone === 0) return '타이핑해서 첫 파일 ' + f.name + '을(를) 완성하세요 (' + state.fileLines + ' / ' + f.target + '줄)';
  if (state.rep < 5 && c.level === 0) return '평판 5 달성: 신규 구축 의뢰와 Claude 구독 해금 (현재 ' + fmtInt(state.rep) + ')';
  if (st.releases === 0 && c.level === 0) return '서비스 가치 ' + won(RELEASE_MIN) + ' 달성 후 첫 릴리즈 (업그레이드 탭 아래)';
  if (c.level < 5 && !c.route) {
    const j = jobCond();
    if (canJobChange() || canInnerPromote()) return '커리어 탭에서 ' + TITLES[c.level + 1] + ' 이직 또는 사내 승진을 고르세요';
    return TITLES[c.level + 1] + ' 도전: 이직은 v4.0' + (j.ver ? ' 완료' : ' (현재 v' + state.version + '.0)') + '와 평판 20' + (j.rep ? ' 완료' : ' (현재 ' + fmtInt(state.rep) + ')') + ' 필요';
  }
  if (c.level === 5 && !c.route) return '부장 달성! 커리어 탭에서 이사 승진(안정) 또는 창업(고위험 고수익)을 고르세요';
  if (c.route === 'exec' && !c.cto) { const e = nextExec(); return e.title + ' 승진 조건: 서비스 가치 ' + won(e.value) + ', 평판 ' + e.rep + ' (현재 ' + won(state.runBest) + ', ' + fmtInt(state.rep) + ')'; }
  if (c.route === 'ceo' && !c.ipo) return '상장 목표: 서비스 가치 ' + won(IPO_VALUE) + ' (현재 ' + won(state.runBest) + '). 운영자금 관리에 주의하세요';
  if (st.nextGenDone === 0) return '평판 50을 모아 차세대 프로젝트를 수주하세요 (현재 ' + fmtInt(state.rep) + ')';
  return '더 많은 파일과 더 큰 숫자를 향해! 업적 ' + achCount() + ' / ' + ACHS.length;
}

/* =========================================================
 * 업적
 * ========================================================= */
const ACHS = [
  ['first_quest', '첫 납품', '의뢰 1건 완료', () => S().questsDone >= 1],
  ['quest10', '단골 고객', '의뢰 10건 완료', () => S().questsDone >= 10],
  ['quest50', '믿고 맡기는 개발자', '의뢰 50건 완료', () => S().questsDone >= 50],
  ['file1', '첫 파일 완성', '파일 1개 완성', () => S().filesDone >= 1],
  ['file6', '풀스택', '파일 6개 완성 (5개 언어)', () => S().filesDone >= 6],
  ['file30', '프로젝트 장인', '파일 30개 완성', () => S().filesDone >= 30],
  ['release1', '첫 릴리즈', '릴리즈 1회', () => S().releases >= 1],
  ['v5', '버전 5.0', 'v5.0 도달', () => state.version >= 5],
  ['job1', '첫 이직', '이직 1회', () => S().jobs >= 1],
  ['bujang', '부장 승진', '직급 부장 달성', () => state.career.level >= 5],
  ['exec', '임원의 길', '이사 승진', () => state.career.route === 'exec'],
  ['cto', 'CTO', 'CTO 취임', () => state.career.cto],
  ['founder', '창업가', '창업하기', () => S().founded >= 1],
  ['ipo', '상장 대표', 'IPO 성공', () => state.career.ipo],
  ['bankrupt', '쓴맛', '폐업 경험', () => S().bankrupts >= 1],
  ['bug100', '버그 헌터', '버그 100개 수정', () => S().bugsFixed >= 100],
  ['ref10', '리팩토링 장인', '리팩토링 10회', () => S().refactors >= 10],
  ['gradeS', '클린 코더', '코드 상태 D에서 리팩토링으로 S 만들기', () => S().gradeS >= 1],
  ['keys10k', '키보드 워리어', '타이핑 10,000회', () => S().keys >= 10000],
  ['combo200', '손가락 폭주', '콤보 300 달성', () => S().maxCombo >= 300],
  ['lines1k', '천 줄의 코드', '코드 1,000줄 작성', () => S().linesTyped >= 1000],
  ['incident5', '장애 해결사', '장애 5회 무사 대응', () => S().incidentsOk >= 5],
  ['friday', '금요일의 용자', '금요일 배포 성공', () => S().fridayOk >= 1],
  ['boss', '진상 대응 전문가', '진상 고객사 의뢰 완료', () => S().bossDone >= 1],
  ['words50', '타자 장인', '챌린지 단어 50개', () => S().challengeWords >= 50],
  ['nextgen', '차세대 완수', '차세대 의뢰 완료', () => S().nextGenDone >= 1],
  ['value15', '조 단위 클럽', '서비스 가치 1조원', () => S().bestValue >= 1e12],
  ['value30', '경 단위 클럽', '서비스 가치 1경원', () => S().bestValue >= 1e16],
];

/* =========================================================
 * 화면: 오른쪽 패널
 * ========================================================= */
const TABS = [['upg', '업그레이드'], ['quest', '의뢰'], ['team', '팀'], ['shop', '상점'], ['career', '커리어'], ['gloss', '백과사전'], ['ach', '업적'], ['set', '설정']];

function renderTabs() {
  renderMobileBadges();
  let html = '';
  for (const [id, name] of TABS) {
    let badge = '';
    if (id === 'quest' && state.quests.offers.length && state.quests.active.length < questSlots()) badge = '<span class="badge">' + state.quests.offers.length + '</span>';
    if (id === 'career' && (canJobChange() || canInnerPromote() || canFound() || canPromote() || SKILLS.some(s => state.career.skills[s.id] < s.max && state.career.points > state.career.skills[s.id]))) badge = '<span class="badge">!</span>';
    html += '<button data-tab="' + id + '" class="' + (tab === id ? 'on' : '') + '">' + name + badge + '</button>';
  }
  if ($('tabs').innerHTML !== html) $('tabs').innerHTML = html;
}

// [[충족 여부, 조건 글], ...]에서 아직 못 채운 조건만 모아서 표시
function needText(conds) { return conds.filter(c => !c[0]).map(c => c[1] + ' 필요').join('<br>'); }
function lockTag(text) { return '<span class="lock-tag">' + text + '</span>'; }
function q(id) { return id ? '<span class="q" data-gloss="' + id + '" title="백과사전에서 보기">?</span>' : ''; }

function sideUpg() {
  const freeze = hasBuff('freeze');
  let h = '<div class="sec-title">업그레이드 <button class="btn gray" data-act="mode">' + (buyMax ? '최대 구매' : '1개씩 구매') + '</button></div>';
  if (freeze) h += '<div class="note" style="color:var(--bad)">코드 프리징 중에는 살 수 없습니다</div>';
  for (const u of UPGRADES) {
    const locked = state.runBest < u.unlock;
    const c = cost(u);
    const cls = locked ? 'locked' : (state.value < c || freeze ? 'disabled' : '');
    h += '<div class="upg ' + cls + '" data-act="buy:' + u.id + '"><div><div class="upg-name">' + u.name + (locked ? '' : '<span class="upg-lv">Lv.' + state.lv[u.id] + '</span><span class="upg-tier">' + tierName(u, state.lv[u.id]) + '</span>') + q(u.gloss) + '</div>' +
      '<div class="upg-desc">' + (locked ? '잠겨 있는 업그레이드' : upgDesc(u)) + '</div></div><div class="upg-cost">' + (locked ? '' : won(c)) + '</div>' + (locked ? lockTag('서비스 가치 ' + won(u.unlock) + ' 필요') : '') + '</div>';
  }
  h += '<div class="divider"></div><div class="sec-title">릴리즈' + q('release') + '<span class="sub">v' + state.version + '.0</span></div>';
  if (state.runBest < RELEASE_MIN) {
    h += '<div class="info">서비스 가치 <b>' + won(RELEASE_MIN) + '</b> 달성 시 릴리즈 가능<br>이번 판 최고: ' + won(state.runBest) + '</div><button class="big-btn" disabled>릴리즈 불가</button>';
  } else {
    const g = releaseGain();
    h += '<div class="info">현재 배수 x' + fmt(state.releaseMult) + ', 릴리즈 시 <b>x' + fmt(g) + '</b>' + (g >= state.releaseMult * 2 ? ' (지금이 좋은 타이밍)' : ' (2배 이상일 때 추천)') + '<br>가치, 업그레이드, 진행 중 의뢰가 초기화됩니다. 코드, 파일, 평판, 팀은 유지됩니다.</div>' +
      '<button class="big-btn" data-act="release"' + (canRelease() ? '' : ' disabled') + '>' + (canRelease() ? 'v' + state.version + '.0 릴리즈' : '더 키워야 이득') + '</button>';
  }
  return h;
}

function reqLine(qq, key, active) {
  const label = REQ_LABEL[key];
  if (key === 'grade') {
    const ok = liveGrade() >= qq.req.grade;
    return '<div class="req' + (active && ok ? ' done' : '') + '">' + (active && ok ? '[완료] ' : '') + label + ' ' + GRADES[qq.req.grade] + ' 이상' + (active ? ' (현재 ' + GRADES[liveGrade()] + ')' : '') + '</div>';
  }
  const target = qq.req[key];
  if (!active) return '<div class="req">' + label + ' ' + (key === 'earn' ? won(target) : target + REQ_UNIT[key]) + '</div>';
  const p = Math.min(target, reqProgress(qq, key));
  const done = p >= target;
  const txt = key === 'earn' ? won(p) + ' / ' + won(target) : Math.floor(p) + ' / ' + target + REQ_UNIT[key];
  return '<div class="req' + (done ? ' done' : '') + '">' + (done ? '[완료] ' : '') + label + ' ' + txt + '</div>';
}

function sideQuest() {
  const Q = state.quests;
  let h = '<div class="sec-title">진행 중 <span class="sub">' + Q.active.length + ' / ' + questSlots() + '</span></div>';
  if (!Q.active.length) h += '<div class="note">아래 의뢰를 수락하세요. 조건을 채우면 자동으로 납품됩니다.</div>';
  for (const qq of Q.active) {
    const k = kindOf(qq);
    const left = qq.endsAt - state.time;
    const ratio = questRatio(qq);
    h += '<div class="card active"><div class="card-top"><span class="kind k-' + qq.kind + '">' + k.name + '</span>' + qq.client + '<span class="right">' + fmtSec(left) + '</span></div><div class="card-title">' + qq.title + '</div>';
    for (const key in qq.req) h += reqLine(qq, key, true);
    if (qq.nextChange) h += '<div class="req" style="color:var(--bad)">' + fmtSec(qq.nextChange - state.time) + ' 뒤 요구사항 또 변경 예정</div>';
    h += '<div class="bar" style="margin-top:6px"><div class="bar-fill ' + (left < 20 ? 'urgent' : 'time') + '" style="width:' + clamp(left / qq.time * 100, 0, 100) + '%"></div></div>' +
      '<div class="card-foot"><span>보상 약 ' + won(questReward(qq)) + ', 평판 +' + questRep(qq) + '</span><button class="btn warn' + (ratio >= 0.5 ? '' : ' off') + '" data-act="rush:' + qq.id + '">급하게 납품</button></div></div>';
  }
  h += '<div class="note">급하게 납품: 진행률 50% 이상이면 바로 납품. 보상 60%, 평판 절반, 코드 복잡도 +25%</div>';
  h += '<div class="divider"></div><div class="sec-title">들어온 의뢰 <span class="sub">' + (hasCrew('lee') ? 'PM이 자동 수락 중' : '조금씩 새 의뢰가 들어옴') + '</span></div>';
  const full = Q.active.length >= questSlots();
  for (const qq of Q.offers) {
    const k = kindOf(qq);
    h += '<div class="card"><div class="card-top"><span class="kind k-' + qq.kind + '">' + k.name + '</span>' + qq.client + '<span class="right">제한 ' + fmtSec(qq.time * questTimeMult()) + '</span></div><div class="card-title">' + qq.title + '</div>';
    for (const key in qq.req) h += reqLine(qq, key, false);
    h += '<div class="card-foot"><span>보상 약 ' + won(questReward(qq)) + ', 평판 +' + questRep(qq) + '</span><button class="btn' + (full ? ' off' : '') + '" data-act="accept:' + qq.id + '">수락</button></div></div>';
  }
  const nextKind = KINDS.find(k => state.rep < k.rep);
  if (nextKind) h += '<div class="note">평판 ' + nextKind.rep + ' 달성 시 ' + nextKind.name + ' 의뢰 해금</div>';
  return h;
}

function sideTeam() {
  const fee = x => pct(x * Math.pow(0.7, SK().lead));
  let h = '<div class="sec-title">AI 구독 <span class="sub">사원급 업무를 AI가 대신 타이핑</span></div><div class="note">구독료는 수입에서 매초 일정 비율로 나갑니다. 현재 월급과 구독료 합계: 수입의 ' + pct(salaryRate()) + '</div>';
  for (const s of AI_SUBS) {
    const locked = state.rep < s.rep;
    const on = hasSub(s.id);
    let btn;
    if (on) btn = '<button class="btn gray" data-act="unsub:' + s.id + '">해지</button>';
    else btn = '<button class="btn' + (!locked && state.value >= s.cost ? '' : ' off') + '" data-act="sub:' + s.id + '">' + won(s.cost) + '</button>';
    h += '<div class="row' + (locked ? ' locked' : '') + (on ? ' owned' : '') + '"><div><div class="row-name">' + s.name + (on ? '<span class="cnt">구독 중</span>' : '') + '</div><div class="row-desc">' + s.desc + '<br>구독료: 수입의 ' + fee(s.fee) + '</div></div>' + btn + (locked ? lockTag('평판 ' + s.rep + ' 필요') : '') + '</div>';
  }
  h += '<div class="divider"></div><div class="sec-title">장급 섭외 <span class="sub">한 번 섭외하면 함께 일함</span></div><div class="note">릴리즈해도 남고, 이직하면 헤어집니다.</div>';
  for (const c of CREW) {
    const locked = state.rep < c.rep;
    const on = hasCrew(c.id);
    const btn = on ? '<span class="cnt" style="color:var(--good);font-size:12px">합류</span>' : '<button class="btn' + (!locked && state.value >= c.cost ? '' : ' off') + '" data-act="crew:' + c.id + '">' + won(c.cost) + '</button>';
    h += '<div class="row' + (locked ? ' locked' : '') + (on ? ' owned' : '') + '"><div><div class="row-name">' + crewName(c) + ' ' + c.title + '<span class="role">' + c.role + '</span></div><div class="row-desc">' + c.desc + '<br>월급: 수입의 ' + fee(c.salary) + '</div></div>' + btn + (locked ? lockTag('평판 ' + c.rep + ' 필요') : '') + '</div>';
  }
  return h;
}

function sideShop() {
  let h = '<div class="sec-title">상점 <span class="sub">한 번 쓰고 사라지는 아이템</span></div><div class="note">가격은 지금 수입에 맞춰 바뀝니다. 쓰고 나면 재사용 대기 시간이 있어요.</div>';
  for (const it of ITEMS) {
    const p = itemPrice(it);
    const cd = it.stack ? 0 : itemCdLeft(it.id);
    const full = it.stack && (state.inv[it.id] || 0) >= it.stack;
    let btn;
    if (cd > 0) btn = '<button class="btn off" data-act="item:' + it.id + '">재사용 ' + fmtSec(cd) + '</button>';
    else if (full) btn = '<button class="btn off" data-act="item:' + it.id + '">가득 참</button>';
    else btn = '<button class="btn' + (state.value >= p ? '' : ' off') + '" data-act="item:' + it.id + '">' + won(p) + '</button>';
    const extra = it.stack ? '<br>보관 ' + (state.inv[it.id] || 0) + ' / ' + it.stack + '개' : '<br>재사용 대기 ' + it.cd + '초';
    h += '<div class="row"><div class="item-art">' + pixelArt(it.id, 40) + '</div><div style="flex:1"><div class="row-name">' + it.name + '</div><div class="row-desc">' + it.desc + extra + '</div></div>' + btn + '</div>';
  }
  return h;
}

function sideCareer() {
  const c = state.career;
  const j = jobCond();
  let h = '<div class="sec-title">커리어 <span class="sub">직급 보너스 수입 x' + careerMult().toFixed(1) + '</span></div>';
  h += '<div class="info">' + escHtml(companyName()) + ' ' + escHtml(devName()) + ' <b>' + titleOf() + '</b><br>경력 포인트 <b>' + c.points + '</b></div>';
  if (c.level < 5 && !c.route) {
    const p = innerCond();
    h += '<div class="divider"></div><div class="sec-title">' + TITLES[c.level + 1] + '(으)로 가는 두 가지 방법</div><div class="route-box">' +
      '<div class="route' + (canJobChange() ? '' : ' locked') + '"><h4>이직</h4>새 회사에서 v1.0부터 다시 시작. 평판, 팀, 릴리즈 배수, 파일이 초기화되는 대신 경력 포인트를 많이 받음<br>' +
      '조건: v4.0 ' + (j.ver ? '[완료]' : '(현재 v' + state.version + '.0)') + ', 평판 20 ' + (j.rep ? '[완료]' : '(현재 ' + fmtInt(state.rep) + ')') +
      '<button class="big-btn" data-act="job"' + (canJobChange() ? '' : ' disabled') + '>이직 (포인트 +' + jobGain() + ')</button>' + (canJobChange() ? '' : lockTag(needText([[j.ver, 'v4.0 도달'], [j.rep, '평판 20']]))) + '</div>' +
      '<div class="route' + (canInnerPromote() ? '' : ' locked') + '"><h4>사내 승진</h4>' + escHtml(companyName()) + '에 남아 승진. 아무것도 초기화되지 않지만 경력 포인트는 1만 받고 조건이 까다로움<br>' +
      '조건: v' + p.needVer + '.0 ' + (p.ver ? '[완료]' : '(현재 v' + state.version + '.0)') + ', 평판 ' + p.needRep + ' ' + (p.rep ? '[완료]' : '(현재 ' + fmtInt(state.rep) + ')') +
      '<button class="big-btn" data-act="inner"' + (canInnerPromote() ? '' : ' disabled') + '>승진 (포인트 +1)</button>' + (canInnerPromote() ? '' : lockTag(needText([[p.ver, 'v' + p.needVer + '.0 도달'], [p.rep, '평판 ' + p.needRep]]))) + '</div></div>';
    h += '<div class="note" style="margin-top:8px">부장이 되면 이사 루트와 대표(창업) 루트 중 하나를 고를 수 있습니다.</div>';
  }
  if (c.level >= 5 && !c.route) {
    const e = EXEC[0];
    h += '<div class="divider"></div><div class="sec-title">갈림길</div><div class="route-box">' +
      '<div class="route' + (canPromote() ? '' : ' locked') + '"><h4>이사 루트</h4>지금 회사에서 이사, 상무, 전무, CTO로 승진. 리스크 없이 꾸준히 강해짐<br>이사 조건: 가치 ' + won(e.value) + ', 평판 ' + e.rep + '<button class="big-btn" data-act="promote"' + (canPromote() ? '' : ' disabled') + '>이사 승진</button>' + (canPromote() ? '' : lockTag(needText([[state.runBest >= e.value, '가치 ' + won(e.value)], [state.rep >= e.rep, '평판 ' + e.rep]]))) + '</div>' +
      '<div class="route"><h4>대표 루트</h4>창업해서 매출 3배. 대신 시장이 크게 출렁이고 시장과 무관한 운영비와 세무조사, 해킹 같은 사고가 있으며, 자금이 바닥나면 폐업<button class="big-btn gold" data-act="found">창업하기</button></div></div>';
  }
  if (c.route === 'exec' && !c.cto) {
    const e = nextExec();
    h += '<div class="divider"></div><div class="sec-title">다음 승진: ' + e.title + '</div><div class="route-box" style="grid-template-columns:1fr"><div class="route' + (canPromote() ? '' : ' locked') + '">조건: 서비스 가치 ' + won(e.value) + ' (현재 ' + won(state.runBest) + '), 평판 ' + e.rep + ' (현재 ' + fmtInt(state.rep) + ')<br>승진은 초기화 없이 그 자리에서 이뤄집니다.' +
      '<button class="big-btn" data-act="promote"' + (canPromote() ? '' : ' disabled') + '>' + e.title + ' 승진</button>' + (canPromote() ? '' : lockTag(needText([[state.runBest >= e.value, '가치 ' + won(e.value)], [state.rep >= e.rep, '평판 ' + e.rep]]))) + '</div></div>';
  }
  if (c.route === 'ceo') {
    h += '<div class="divider"></div><div class="sec-title">회사 현황</div><div class="info">' +
      (c.ipo ? '상장 완료! 리스크 없이 수입 x10' : '시장 상황 <b>x' + state.market.toFixed(2) + '</b> (x' + breakEvenMarket().toFixed(2) + ' 아래로 가면 적자)<br>매출 ' + won(rate()) + '/초, 운영비 ' + won(burnRate()) + '/초 (창업 ' + state.ceoMonths + '개월째, 고정비 x' + burnMult().toFixed(2) + ')<br>지분 ' + pct(state.equity) + '<br>상장 조건: 서비스 가치 ' + won(IPO_VALUE)) + '</div>';
  }
  if (endingDone()) {
    h += '<div class="divider"></div><div class="sec-title">다음 회차 <span class="sub">지금 ' + (c.ng + 1) + '회차</span></div><div class="note">처음부터 다시 시작합니다. 이름, 업적, 기록, 설정은 남고 회차마다 수입 +30%, 경력 포인트 2개를 더 받고 시작해요.</div>' +
      '<button class="big-btn gold" data-act="ng">' + (c.ng + 2) + '회차 시작</button>';
  }
  h += '<div class="divider"></div><div class="sec-title">스킬 <span class="sub">Lv.n을 배우려면 포인트 n 필요</span></div>';
  for (const s of SKILLS) {
    const r = c.skills[s.id];
    const full = r >= s.max;
    const can = !full && c.points >= r + 1;
    h += '<div class="row"><div><div class="row-name">' + s.name + '<span class="cnt">Lv.' + r + ' / ' + s.max + '</span></div><div class="row-desc">레벨당 ' + s.desc + '</div></div>' +
      '<button class="btn' + (can ? '' : ' off') + '" data-act="skill:' + s.id + '">' + (full ? '마스터' : (r + 1) + 'P') + '</button></div>';
  }
  return h;
}

let glossHtmlCache = '';
function glossItem(g) {
  const text = (g.term + ' ' + (g.game || '') + ' ' + g.desc).toLowerCase();
  let h = '<div class="gl' + (g.game ? ' feat' : '') + '" id="g-' + g.id + '" data-text="' + escHtml(text) + '"><div class="gl-term">' + escHtml(g.term) + (g.game ? '<span class="gl-badge">게임 기능</span>' : '') + '</div>';
  if (g.game) h += '<div class="gl-sec"><span class="gl-lab game">게임에서</span><div class="gl-desc">' + escHtml(g.game) + '</div></div>';
  if (g.desc) h += g.game ? '<div class="gl-sec"><span class="gl-lab">실무에서</span><div class="gl-desc">' + escHtml(g.desc) + '</div></div>' : '<div class="gl-desc">' + escHtml(g.desc) + '</div>';
  if (g.ex) h += '<div class="gl-ex">' + escHtml(g.ex) + '</div>';
  return h + '</div>';
}
function sideGloss() {
  if (glossHtmlCache) return glossHtmlCache;
  let h = '<input class="gloss-search" id="glossSearch" placeholder="용어 검색 (예: 리팩토링, 트랜잭션, JOIN)" autocomplete="off">';
  const feats = GLOSS_GAME_ORDER.map(id => GLOSSARY.find(x => x.id === id)).filter(Boolean);
  h += '<div class="gl-cat" data-cat="게임 기능">게임 기능 <span class="gl-cat-sub">게임 속 규칙과 실제 개발 이야기를 함께</span></div>';
  for (const g of feats) h += glossItem(g);
  let cat = '';
  for (const g of GLOSSARY) {
    if (feats.includes(g)) continue;
    if (g.cat !== cat) { cat = g.cat; h += '<div class="gl-cat" data-cat="' + cat + '">' + cat + '</div>'; }
    h += glossItem(g);
  }
  glossHtmlCache = h;
  return h;
}

function sideAch() {
  let h = '<div class="sec-title">업적 <span class="sub">' + achCount() + ' / ' + ACHS.length + ', 개당 수입 +2%</span></div>';
  for (const [id, name, desc] of ACHS) {
    const done = state.career.ach[id];
    h += '<div class="ach' + (done ? ' done' : '') + '"><span class="mark"></span><div><div class="a-name">' + name + '</div><div class="a-desc">' + desc + '</div></div></div>';
  }
  const st = S();
  h += '<div class="divider"></div><div class="note">타이핑 ' + fmtInt(st.keys) + '회, 최고 콤보 ' + st.maxCombo + ', 작성 코드 ' + fmtInt(st.linesTyped) + '줄, 완성 파일 ' + st.filesDone + '개, 납품 ' + st.questsDone + '건, 버그 수정 ' + st.bugsFixed + '개, 리팩토링 ' + st.refactors + '회</div>';
  return h;
}

function sideSet() {
  const s = state.settings;
  let h = '<div class="sec-title">이름</div><div class="set-row"><span>' + escHtml(devName()) + '</span><button class="btn gray" data-act="rename">이름 바꾸기</button></div>';
  const gd = state.career.gender === 'f' ? 'f' : 'm';
  h += '<div class="sec-title">캐릭터</div><div class="set-row"><button class="btn ' + (gd === 'm' ? 'on' : 'gray') + '" data-act="gender:m">남자</button><button class="btn ' + (gd === 'f' ? 'on' : 'gray') + '" data-act="gender:f">여자</button></div>';
  h += '<div class="sec-title">회사</div><div class="set-row"><span>' + escHtml(companyName()) + '</span><button class="btn gray" data-act="recompany">회사 이름 바꾸기</button></div>';
  h += '<div class="sec-title">타이핑 소리</div><div class="set-row">';
  for (const [id, name] of SOUNDS) h += '<button class="btn ' + (s.sound === id ? 'on' : 'gray') + '" data-act="sound:' + id + '">' + name + '</button>';
  h += '</div><div class="sec-title">화면 모드</div><div class="set-row">';
  for (const t of THEMES.filter(t => t.mode)) h += '<button class="btn ' + (s.theme === t.id ? 'on' : 'gray') + '" data-act="theme:' + t.id + '">' + t.name + '</button>';
  h += '</div><div class="sec-title">특별 테마 <span class="sub">업적을 모으면 해금</span></div><div class="set-row">';
  for (const t of THEMES.filter(t => !t.mode)) {
    const ok = achCount() >= t.need;
    h += '<button class="btn ' + (s.theme === t.id ? 'on' : ok ? 'gray' : 'off') + '" data-act="theme:' + t.id + '">' + t.name + (ok ? '' : ' (업적 ' + t.need + ')') + '</button>';
  }
  h += '</div><div class="sec-title">결과 공유</div><div class="set-row"><button class="btn" data-act="card">기록 카드 만들기</button><button class="btn gray" data-act="share">기록 글로 복사</button></div>';
  h += '<div class="divider"></div><div class="sec-title">저장</div><div class="note">진행 상황은 이 브라우저에 5초마다 자동 저장됩니다. 다른 기기나 브라우저와는 따로 저장돼요.</div>';
  h += '<div class="set-row"><button class="btn gray" data-act="save">지금 저장</button><button class="btn ' + (resetArmed ? 'warn' : 'gray') + '" data-act="reset">' + (resetArmed ? '한 번 더 누르면 전체 초기화' : '전체 초기화') + '</button></div>';
  const dl = (url, name) => url ? '<a class="btn" href="' + url + '" target="_blank" rel="noopener">' + name + '</a>' : '<button class="btn off" disabled>' + name + ' (준비 중)</button>';
  h += '<div class="divider"></div><div class="sec-title">개발자 커피 사주기</div><div class="note">재밌게 즐기셨다면 커피 한 잔으로 응원해 주세요. 후원은 게임 내용에 영향을 주지 않습니다.</div><div class="set-row">' + dl(DONATE.toss, '토스') + dl(DONATE.kakao, '카카오페이') + '</div>';
  return h;
}

function renderSide() {
  renderTabs();
  const fn = { upg: sideUpg, quest: sideQuest, team: sideTeam, shop: sideShop, career: sideCareer, gloss: sideGloss, ach: sideAch, set: sideSet }[tab];
  const html = fn();
  if (html !== lastSideHtml) { $('side').innerHTML = html; lastSideHtml = html; }
}

function openGlossary(id) {
  tab = 'gloss';
  if (MOBILE_MQ.matches && mview === 'code') setMobileView('more');
  lastSideHtml = '';
  renderSide();
  const inp = $('glossSearch');
  if (inp) { inp.value = ''; filterGlossary(''); }
  const el = $('g-' + id);
  if (!el) return;
  el.scrollIntoView({ block: 'center' });
  el.classList.add('flash');
  setTimeout(() => el.classList.remove('flash'), 1600);
}

function filterGlossary(text) {
  const t = text.trim().toLowerCase();
  const side = $('side');
  side.querySelectorAll('.gl').forEach(el => { el.classList.toggle('hidden', !!t && !el.dataset.text.includes(t)); });
  side.querySelectorAll('.gl-cat').forEach(el => {
    let n = el.nextElementSibling, any = false;
    while (n && n.classList.contains('gl')) { if (!n.classList.contains('hidden')) any = true; n = n.nextElementSibling; }
    el.classList.toggle('hidden', !any);
  });
}

/* =========================================================
 * 화면: 에디터 주변
 * ========================================================= */
function renderExplorer() {
  let h = '';
  for (let i = Math.max(0, state.file - 6); i <= state.file + 1; i++) {
    const f = fileInfo(i);
    const badge = '';
    if (i < state.file) {
      const has = state.archive.some(a => a.idx === i);
      h += '<div class="ftab done" ' + (has ? 'data-view="' + i + '" title="완성한 코드 보기"' : 'title="오래된 파일이라 내용은 보관되지 않음"') + '>' + badge + f.name + '<span class="ex-check">완료</span></div>';
    } else if (i === state.file) {
      h += '<div class="ftab cur" id="curTab">' + badge + f.name + '</div>';
    } else {
      h += '<div class="ftab locked" title="지금 파일을 완성하면 열림">' + badge + f.name + '</div>';
    }
  }
  if (h !== lastExplorerHtml) {
    const el = $('explorer');
    el.innerHTML = h;
    lastExplorerHtml = h;
    const cur = $('curTab');
    if (cur) el.scrollLeft = Math.max(0, cur.offsetLeft - el.clientWidth + cur.offsetWidth + 80);
  }
}

function viewArchive(idx) {
  const a = state.archive.find(x => x.idx === idx);
  if (!a) return;
  const body = a.lines.map((l, i) => '<div class="ln"><span class="no">' + (i + 1) + '</span><span class="tx">' + highlight(l, a.lang) + '</span></div>').join('');
  openModal({ title: a.name + ' (완성본)', desc: '<div class="archive">' + body + '</div>', choices: [{ label: '닫기' }], wide: true });
}

function renderStatus() {
  const d = state.debt;
  let h = '<span class="debt">코드 복잡도' + '<span class="mini-bar"><span class="mini-fill" style="width:' + d + '%;background:' + (d > 60 ? 'var(--bad)' : d > 30 ? 'var(--gold)' : 'var(--cm)') + '"></span></span> ' + Math.floor(d) + '% (수입 -' + Math.floor(d / 2) + '%, 줄당 +' + lineDebt().toFixed(2) + '%, 업그레이드할수록 줄어듦)</span>';
  if (state.legacy) h += '<span class="alert">레거시화! 수입 x0.7</span>';
  if (state.bugs.length) h += '<span class="bug-count">버그 ' + state.bugs.length + '개 (수입 -' + pct(bugLossPct()) + ')</span><button class="btn warn" data-act="findbug">버그 찾기</button>';
  if (state.incident) h += '<span class="alert">' + state.incident.label + ' ' + fmtSec(state.incident.until - state.time) + '</span>';
  if (state.refactoring) h += '<span>리팩토링 중 ' + Math.max(0, state.refactoring.until - state.time).toFixed(1) + '초</span>';
  if (isCeo() && !state.career.ipo && state.bankrupt > 0) h += '<span class="alert">자금난! 폐업까지 ' + fmtSec(BANKRUPT_SEC - state.bankrupt) + '</span>';
  if (h !== lastStatusHtml) { $('status').innerHTML = h; lastStatusHtml = h; }
  $('code').classList.toggle('refactoring', !!state.refactoring);
}

function renderChallenge() {
  const el = $('challenge');
  const c = state.challenge;
  let h;
  if (!c) {
    el.classList.remove('on');
    h = S().keys >= 30 ? '타이핑 챌린지: 약 ' + fmtSec(state.nextChallengeAt - state.time) + ' 뒤 시작 (나온 단어를 정확히 치면 보너스)' : '타이핑 챌린지: 타이핑을 30번 하면 열립니다';
  } else {
    el.classList.add('on');
    const w = c.words[c.idx % c.words.length];
    h = '<span>타이핑 챌린지</span><span class="word"><span class="typed">' + w.slice(0, c.pos) + '</span><span class="rest">' + w.slice(c.pos) + '</span></span><span class="meta">콤보 ' + c.combo + ', 남은 시간 ' + fmtSec(c.until - state.time) + '</span>';
    if (MOBILE_MQ.matches) {
      const next = w[c.pos] || '';
      const pool = 'etaoinsrhldcumfpgwybvk';
      let seed = c.idx * 31 + c.pos * 7 + w.length;
      const keys = [next];
      while (keys.length < 4) { seed = (seed * 9301 + 49297) % 233280; const ch = pool[seed % pool.length]; if (!keys.includes(ch)) keys.push(ch); }
      keys.sort((a, b) => ((a.charCodeAt(0) * 7 + seed) % 11) - ((b.charCodeAt(0) * 7 + seed) % 11));
      h += '<span class="ckeys">' + keys.map(k => '<button data-ch="' + k + '">' + k + '</button>').join('') + '</span>';
    }
  }
  if (el.innerHTML !== h) el.innerHTML = h;
}

// 지속 효과를 아이콘으로 표시: 시간이 지날수록 회색이 아래에서부터 차오르고, 5초 남으면 깜빡임. 마우스를 올리면 설명
function buffList() {
  const list = [];
  for (const b of state.buffs) if (buffActive(b)) {
    const info = BUFF_INFO[b.label] || { icon: 'doc', name: b.label, desc: '' };
    list.push({ key: b.label, icon: info.icon, name: info.name, desc: info.desc, left: b.until - state.time, total: b.until - b.from, bad: b.bad });
  }
  if (state.time < state.cleanUntil) list.push({ key: 'clean', icon: 'broom', name: '방금 리팩토링', desc: '정리된 코드로 기분 좋은 상태', left: state.cleanUntil - state.time, total: 30 });
  if (state.inv && state.inv.glass > 0) list.push({ key: 'glass', icon: 'glass', name: '스마트글래스', desc: '버그가 생기면 1개를 써서 바로 고침', count: state.inv.glass });
  return list;
}
function renderBuffs() {
  const wrap = $('buffs');
  const list = buffList();
  const keys = new Set(list.map(x => x.key));
  wrap.querySelectorAll('.bicon').forEach(el => { if (!keys.has(el.dataset.key)) el.remove(); });
  for (const x of list) {
    let el = null;
    wrap.querySelectorAll('.bicon').forEach(e => { if (e.dataset.key === x.key) el = e; });
    if (!el) {
      el = document.createElement('div');
      el.className = 'bicon' + (x.bad ? ' bad' : '');
      el.dataset.key = x.key;
      el.innerHTML = pixelArt(x.icon, 24) + '<div class="bfill"></div><span class="bcount"></span><div class="btip"></div>';
      wrap.appendChild(el);
    }
    const timed = x.total > 0;
    el.querySelector('.bfill').style.height = timed ? clamp(100 * (1 - x.left / x.total), 0, 100) + '%' : '0%';
    el.classList.toggle('blink', timed && x.left <= 5);
    el.querySelector('.bcount').textContent = x.count ? x.count : '';
    el.querySelector('.btip').innerHTML = '<b>' + x.name + '</b><br>' + x.desc + (timed ? '<br>남은 시간 ' + fmtSec(x.left) : x.count ? '<br>보관 ' + x.count + '개' : '');
  }
  let m = wrap.querySelector('.chip.market');
  if (isCeo() && !state.career.ipo) {
    if (!m) { m = document.createElement('span'); m.className = 'chip market'; wrap.prepend(m); }
    m.classList.toggle('bad', state.market < 0.8);
    m.textContent = '시장 x' + state.market.toFixed(2);
  } else if (m) m.remove();
}

let lastDeskKey = '';
// 직급별 옷: 신입~대리 후드티(가디건), 과장~차장 셔츠(블라우스), 부장과 임원 정장, 대표 터틀넥
function outfitOf() {
  const c = state.career;
  if (c.route === 'ceo') return 3;
  if (c.route === 'exec' || c.level >= 5) return 2;
  return c.level >= 3 ? 1 : 0;
}
function renderDesk() {
  // 단계 목록(모니터 암 추가)을 그림 단계로 맞춤: 모니터 암은 듀얼 모니터 그림, 트리플 모니터 이후는 마지막 그림
  const ti = tierIdx(UPGRADES[1], state.lv.key);
  const t = ti <= 3 ? ti : Math.min(7, ti - 1);
  const overtime = state.buffs.some(b => b.label.startsWith('야근') && buffActive(b));
  const phase = overtime ? 'night' : dayPhase();
  const gender = state.career.gender === 'f' ? 'f' : 'm';
  const items = [];
  for (const b of state.buffs) if (buffActive(b) && !b.bad) { const ic = (BUFF_INFO[b.label] || {}).icon; if (ic && !items.includes(ic)) items.push(ic); }
  const theme = state.settings.theme;
  const key = [t, phase, gender, outfitOf(), theme, items.join('+')].join();
  if (key === lastDeskKey) return;
  lastDeskKey = key;
  $('desk').innerHTML = sceneSvg(t, phase, gender, outfitOf(), 2.5, { theme, items });
}

function renderTop() {
  $('value').textContent = won(state.value);
  if (isCeo() && !state.career.ipo) {
    const n = netRate();
    $('rateLabel').textContent = '초당 순이익';
    $('rate').textContent = won(n) + '/초';
    $('rate').classList.toggle('neg', n < 0);
  } else {
    $('rateLabel').textContent = '초당 가치';
    $('rate').textContent = won(rate()) + '/초';
    $('rate').classList.remove('neg');
  }
  $('keyGain').textContent = '+' + won(keyGain());
  $('rep').textContent = fmtInt(state.rep);
  $('mult').textContent = 'x' + fmt(state.releaseMult);
  $('ver').textContent = 'v' + state.version + '.0';
  $('titleChip').textContent = devName() + ' ' + titleOf();
  $('companyChip').textContent = (state.career.ng ? (state.career.ng + 1) + '회차 ' : '') + companyName();
  $('goal').textContent = goalText();

  const f = curFile();
  const L = LANGS[f.lang];
  $('filename').textContent = f.name;
  $('lines').textContent = totalLines().toLocaleString() + ' lines';
  $('stageName').textContent = STAGES[state.stage].name;
  const gc = $('gradeChip');
  const lg = liveGrade();
  const gcText = '코드 상태 ' + GRADES[lg];
  if (gc.textContent !== gcText) {
    if (lg < lastLiveGrade) { gc.classList.remove('drop'); void gc.offsetWidth; gc.classList.add('drop'); }
    gc.textContent = gcText;
    gc.title = '수입 x' + GRADE_MULT[lg] + ' (복잡도가 오르면 등급이 떨어짐, 백과사전 참고)';
  }
  lastLiveGrade = lg;
  gc.classList.remove('g0', 'g1', 'g2', 'g3', 'g4'); gc.classList.add('g' + lg);
  const rb = $('refactorBtn');
  const gain = Math.round((GRADE_MULT[bestGrade()] / GRADE_MULT[lg] - 1) * 100);
  const rbText = state.refactoring ? '리팩토링 중' : !canRefactorNow() ? '리팩토링' : '리팩토링 (' + GRADES[lg] + '에서 S로, 수입 +' + gain + '%)';
  if (rb.textContent !== rbText) rb.textContent = rbText;
  rb.classList.toggle('off', !!state.refactoring || !canRefactorNow());

  $('fileLabel').textContent = '파일 완성: ' + f.name + ' (완성하면 다음 파일이 열리고 파일 보너스 +5%)';
  $('fileVal').textContent = state.fileLines + ' / ' + f.target + '줄';
  $('fileBar').style.width = clamp(state.fileLines / f.target * 100, 0, 100) + '%';

  const s = state.stage;
  const next = STAGES[s + 1];
  if (next) {
    const prev = Math.max(STAGES[s].at, 1);
    const p = clamp(Math.log10(Math.max(state.runBest, 1) / prev) / Math.log10(next.at / prev), 0, 1);
    $('nextLabel').textContent = '다음 아키텍처: ' + next.name + ' (도달하면 코드가 자동 리팩토링)';
    $('nextVal').textContent = won(state.runBest) + ' / ' + won(next.at);
    $('nextBar').style.width = (p * 100) + '%';
  } else {
    $('nextLabel').textContent = '최종 아키텍처 도달';
    $('nextVal').textContent = '';
    $('nextBar').style.width = '100%';
  }
  if (modalSpec && modalSpec.def !== undefined) {
    const el = $('modalAuto');
    if (el) el.textContent = fmtSec(20 - (state.time - modalSpec.openedAt)) + ' 뒤 "' + modalSpec.choices[modalSpec.def].label + '" 자동 선택';
  }
}

function applyTheme() { document.body.className = 'theme-' + state.settings.theme; }

/* ---------- 코드 설명 (마우스를 올린 줄) ---------- */
let hoverNo = -1;
function explainLine(no) {
  if (no === hoverNo) return;
  hoverNo = no;
  const idx = no - state.lineOffset - 1;
  const text = idx === state.lines.length ? state.cur : state.lines[idx];
  if (text === undefined) return;
  const L = curLang();
  let comment = '';
  const t = text.trim();
  if ((L.blockRe && L.blockRe.test(text)) || t.startsWith('--') || t.startsWith('<!--')) comment = t.replace(/^(\/\*\*?|\*\/?|--|<!--)\s?/, '').replace(/\s?-->$/, '');
  else { const m = text.match(L.cmPick); if (m) comment = m[1]; }
  const terms = GLOSSARY.filter(g => g.m.some(tok => text.includes(tok))).slice(0, 5);
  let h = '<b>' + no + '번 줄</b>';
  if (state.bugs.includes(no)) h += '<span class="explain" style="color:var(--bad)">버그! 빨간 밑줄 부분이 잘못됐어요. 클릭하면 고쳐집니다.</span>';
  else if (comment) h += '<span class="explain">' + escHtml(comment) + '</span>';
  else if (!t) h += '<span class="explain">빈 줄 (코드를 읽기 쉽게 구역을 나눔)</span>';
  else h += '<span class="explain">설명 주석이 없는 줄이에요</span>';
  if (terms.length) h += '<span style="margin-left:6px">관련 용어</span>' + terms.map(g => '<button class="gl-chip" data-gloss="' + g.id + '">' + escHtml(g.term) + '</button>').join('');
  $('infobar').innerHTML = h;
}

/* =========================================================
 * 저장
 * ========================================================= */
function save() {
  state.lastSave = Date.now();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) { /* 저장 공간이 없으면 무시 */ }
}
function mergeInto(def, src) {
  for (const k in def) {
    if (!(k in src)) continue;
    const d = def[k], v = src[k];
    if (d && typeof d === 'object' && !Array.isArray(d) && v && typeof v === 'object' && !Array.isArray(v)) mergeInto(d, v);
    else def[k] = v;
  }
  return def;
}
// 숫자가 깨진 값(NaN, null 등)을 안전한 값으로 되돌림
function sanitize() {
  const num = (v, d) => (typeof v === 'number' && isFinite(v)) ? v : d;
  if (!state.inv || typeof state.inv !== 'object') state.inv = { glass: 0 };
  state.inv.glass = Math.max(0, Math.min(5, Math.floor(num(state.inv.glass, 0))));
  if (!state.itemCd || typeof state.itemCd !== 'object') state.itemCd = {};
  state.buffs = (state.buffs || []).map(b => b.label === '키캡 콤보 유지 2배' ? Object.assign(b, { label: '손목 받침대' }) : b);
  for (const k in state.lv) state.lv[k] = Math.max(0, Math.floor(num(state.lv[k], 0)));
  if (!isCeo()) state.value = Math.max(0, num(state.value, 0));
  else state.value = num(state.value, 0);
  state.runBest = Math.max(state.value, num(state.runBest, 0));
  state.releaseMult = Math.max(1, num(state.releaseMult, 1));
  state.debt = clamp(num(state.debt, 0), 0, 100);
  state.rep = Math.max(0, num(state.rep, 0));
  state.time = num(state.time, 0);
  state.market = clamp(num(state.market, 1), 0.1, 5);
  state.equity = clamp(num(state.equity, 1), 0.1, 1);
}
function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) { startFile(); return false; }
    const parsed = JSON.parse(raw);
    state = mergeInto(defaultState(), parsed);
    if ((parsed.balanceVer || 0) < BALANCE_VER) {
      // 밸런스 패치: 이름, 직급, 업적, 기록, 설정, 회사 이름은 남기고 회사 진행만 새로 시작
      const keep = { career: state.career, settings: state.settings, company: state.company };
      state = defaultState();
      Object.assign(state, keep);
      startFile();
      setTimeout(() => openModal({ title: '밸런스 패치 안내', desc: '수입 구조가 크게 바뀌어서 지금 회사의 진행(가치, 업그레이드, 파일, 평판)은 새로 시작합니다.<br>이름, 직급, 경력 포인트, 스킬, 업적, 기록은 그대로 남아요.', choices: [{ label: '확인' }] }), 300);
      return true;
    }
    state.bugs = state.bugs.filter(n => state.bugInfo[n]);
    sanitize();
    if (!state.lines.length) startFile();
    const sec = Math.min((Date.now() - state.lastSave) / 1000, OFFLINE_CAP);
    if (sec > 10 && !isCeo()) {
      const gain = rate() * sec * offlineEff();
      addValue(gain);
      setTimeout(() => toast('자리 비운 동안 PR ' + Math.max(1, Math.floor(sec / 60)) + '개 머지됨 +' + won(gain) + ' (오프라인 효율 ' + pct(offlineEff()) + ')'), 300);
    }
    return true;
  } catch (e) {
    state = defaultState();
    startFile();
    return false;
  }
}

let toastTimer;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}

function shareText() {
  const st = S();
  return '개발자 키우기 | ' + companyName() + ' ' + devName() + ' ' + titleOf() + '\n' +
    '작성한 코드 ' + fmtInt(st.linesTyped) + '줄, 완성 파일 ' + st.filesDone + '개, 납품 ' + st.questsDone + '건\n' +
    '최고 서비스 가치 ' + won(st.bestValue) + ', 업적 ' + achCount() + '/' + ACHS.length + '\n' + location.href;
}
/* ---------- 도트 기록 카드 (공유용 이미지) ---------- */
const CARD_W = 400, CARD_H = 225, CARD_S = 3;
let cardFontReady = null;
// 픽셀 한글 글꼴(Galmuri, OFL). 못 불러오면 기본 글꼴로 그림
function loadCardFont() {
  if (!cardFontReady) {
    cardFontReady = (async () => {
      try {
        const f = new FontFace('Galmuri11', 'url(fonts/Galmuri11.woff2)');
        const bold = new FontFace('Galmuri11Bold', 'url(fonts/Galmuri11-Bold.woff2)');
        await Promise.race([Promise.all([f.load(), bold.load()]), new Promise((_, rej) => setTimeout(rej, 3000))]);
        document.fonts.add(f); document.fonts.add(bold);
        return true;
      } catch (e) { return false; }
    })();
  }
  return cardFontReady;
}
function svgImage(svg) {
  return new Promise(res => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '));
  });
}
function drawArt(ctx, key, x, y, s) {
  const a = ITEM_ART[key];
  if (!a) return;
  a.rows.forEach((row, yy) => { for (let xx = 0; xx < row.length; xx++) if (row[xx] !== '.') { ctx.fillStyle = a.pal[row[xx]]; ctx.fillRect(x + xx * s, y + yy * s, s, s); } });
}
async function makeCard(ending) {
  const font = await loadCardFont();
  const F = font ? 'Galmuri11' : 'monospace', FB = font ? 'Galmuri11Bold' : 'monospace';
  const cv = document.createElement('canvas');
  cv.width = CARD_W * CARD_S; cv.height = CARD_H * CARD_S;
  const c = cv.getContext('2d');
  c.imageSmoothingEnabled = false;
  const P = CARD_S;
  const px = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x * P, y * P, w * P, h * P); };
  const text = (t, x, y, size, col, bold, align) => { c.font = (size * P) + 'px ' + (bold ? FB : F); c.fillStyle = col; c.textAlign = align || 'left'; c.textBaseline = 'top'; c.fillText(t, x * P, y * P); };
  const gold = '#d7ba7d', good = '#4ec9b0', muted = '#8a8a8a', strong = '#ffffff', accent = '#007acc';
  // 바탕과 창 테두리
  px(0, 0, CARD_W, CARD_H, '#141414');
  px(4, 4, CARD_W - 8, CARD_H - 8, '#1e1e1e');
  px(4, 4, CARD_W - 8, 14, '#2d2d2d');
  px(4, 18, CARD_W - 8, 1, accent);
  [['#f48771', 10], ['#d7ba7d', 18], ['#4ec9b0', 26]].forEach(([col, x]) => px(x, 9, 5, 5, col));
  text('개발자키우기.exe', 38, 7, 8, '#c8c8c8');
  text(new Date().toLocaleDateString('ko-KR'), CARD_W - 12, 7, 8, muted, false, 'right');
  // 왼쪽: 내 책상
  const t = (() => { const ti = tierIdx(UPGRADES[1], state.lv.key); return ti <= 3 ? ti : Math.min(7, ti - 1); })();
  const img = await svgImage(sceneSvg(t, dayPhase(), state.career.gender === 'f' ? 'f' : 'm', outfitOf(), 1, { theme: state.settings.theme, items: ['coffee'] }));
  px(14, 28, 164, 100, '#3c3c3c');
  if (img) c.drawImage(img, 16 * P, 30 * P, 160 * P, 96 * P); else px(16, 30, 160, 96, '#2d2d2d');
  // 엔딩 리본
  const done = ending !== '진행 중';
  px(14, 134, 164, 22, done ? gold : '#3a3a3a');
  px(16, 136, 160, 18, done ? '#3a3320' : '#2d2d2d');
  text(done ? ending + ' 달성!' : '진행 중인 기록', 96, 140, 11, done ? gold : '#c8c8c8', true, 'center');
  text(devName() + '  ' + titleOf(), 16, 164, 11, strong, true);
  text(companyName() + (state.career.ng ? '  ' + (state.career.ng + 1) + '회차' : ''), 16, 180, 8, muted);
  // 오른쪽: 기록
  const st = S();
  const hh = Math.floor(st.playTime / 3600), mm = Math.floor(st.playTime % 3600 / 60);
  text('PLAY LOG', 196, 28, 8, accent, true);
  px(196, 40, 190, 1, '#333333');
  const rows = [
    ['플레이 시간', hh + '시간 ' + mm + '분', strong],
    ['작성한 코드', fmtInt(st.linesTyped) + '줄', strong],
    ['고친 버그', fmtInt(st.bugsFixed) + '개', '#f48771'],
    ['최고 콤보', fmtInt(st.maxCombo), gold],
    ['마신 커피', fmtInt(st.coffee || 0) + '잔', '#ce9178'],
    ['납품한 의뢰', fmtInt(st.questsDone) + '건', strong],
    ['이직', fmtInt(st.jobs) + '번', strong],
    ['업적', achCount() + ' / ' + ACHS.length, good],
  ];
  rows.forEach(([k, v, col], i) => {
    const y = 48 + i * 17;
    text(k, 196, y, 9, '#b0b0b0');
    text(v, 386, y, 9, col, true, 'right');
    if (i < rows.length - 1) for (let x = 196; x < 386; x += 4) px(x, y + 14, 2, 1, '#2a2a2a');
  });
  drawArt(c, 'coffee', 196 * P, 188 * P, 1 * P);
  drawArt(c, 'glass', 214 * P, 188 * P, 1 * P);
  drawArt(c, 'gukbap', 232 * P, 188 * P, 1 * P);
  text('taeaeaexin.github.io/code-idle', 386, 200, 8, muted, false, 'right');
  return cv;
}
async function showCard(ending) {
  toast('기록 카드를 그리는 중...');
  const cv = await makeCard(ending);
  const url = cv.toDataURL('image/png');
  const fname = 'code-idle-' + (ending === '진행 중' ? 'record' : 'ending') + '.png';
  const save = () => { const a = document.createElement('a'); a.href = url; a.download = fname; document.body.appendChild(a); a.click(); a.remove(); };
  const choices = [{ label: '이미지 저장', keep: true, act: save }];
  if (navigator.canShare) {
    choices.push({ label: '공유하기', keep: true, act: () => cv.toBlob(b => {
      const file = new File([b], fname, { type: 'image/png' });
      if (navigator.canShare({ files: [file] })) navigator.share({ files: [file], text: '개발자 키우기 ' + ending + '! ' + location.href }).catch(() => {});
      else save();
    }) });
  }
  choices.push({ label: '닫기', alt: true });
  openModal({ title: ending === '진행 중' ? '내 기록 카드' : '엔딩 카드', wide: true, desc: '<img class="card-img" src="' + url + '" alt="개발자 키우기 기록 카드">', choices });
}
function share() {
  const text = shareText();
  const fallback = () => openModal({ title: '내 기록', desc: '아래 내용을 복사해서 공유하세요.<br><textarea class="share-box" readonly>' + escHtml(text) + '</textarea>', choices: [{ label: '닫기' }] });
  try {
    navigator.clipboard.writeText(text).then(() => toast('기록을 복사했습니다. 붙여넣기로 공유하세요'), fallback);
  } catch (e) { fallback(); }
}

/* =========================================================
 * 입력 처리
 * ========================================================= */
document.addEventListener('keydown', e => {
  const tag = e.target && e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  if (modalSpec && modalSpec.input) return;
  if (e.key === ' ' || e.key === 'Tab' || e.key === 'Backspace') e.preventDefault();
  if (state.challenge && e.key.length === 1 && /[a-z]/i.test(e.key)) challengeKey(e.key.toLowerCase());
  hack();
});

$('challenge').addEventListener('pointerdown', e => {
  const b = e.target.closest('[data-ch]');
  if (!b || !state.challenge) return;
  e.preventDefault();
  challengeKey(b.dataset.ch);
  hack();
});
$('code').addEventListener('click', e => {
  const ln = e.target.closest('.ln.bug');
  if (ln) fixBug(+ln.dataset.no);
  else hack();
});
$('code').addEventListener('mouseover', e => {
  const ln = e.target.closest('.ln');
  if (ln) explainLine(+ln.dataset.no);
});
$('infobar').addEventListener('click', e => {
  const g = e.target.closest('[data-gloss]');
  if (g) openGlossary(g.dataset.gloss);
});
$('explorer').addEventListener('click', e => {
  const el = e.target.closest('[data-view]');
  if (el) viewArchive(+el.dataset.view);
});

/* ---------- 모바일: 하단 탭 ---------- */
const MOBILE_MQ = window.matchMedia ? matchMedia('(max-width: 700px)') : { matches: false, addEventListener() {} };
const MORE_TABS = ['shop', 'career', 'gloss', 'ach', 'set'];
let mview = 'code';
function setMobileView(v) {
  mview = v;
  if (v === 'upg' || v === 'quest' || v === 'team') tab = v;
  else if (v === 'more' && !MORE_TABS.includes(tab)) tab = 'shop';
  document.body.classList.toggle('m-side', v !== 'code');
  document.body.classList.toggle('m-more', v === 'more');
  document.querySelectorAll('#mnav [data-m]').forEach(b => b.classList.toggle('on', b.dataset.m === v));
  lastSideHtml = '';
  renderSide();
  $('side').scrollTop = 0;
  window.scrollTo(0, 0);
}
$('mnav').addEventListener('click', e => {
  const b = e.target.closest('[data-m]');
  if (b) setMobileView(b.dataset.m);
});
function renderMobileBadges() {
  const q = state.quests.offers.length && state.quests.active.length < questSlots() ? state.quests.offers.length : '';
  if ($('mbQuest').textContent !== String(q)) $('mbQuest').textContent = q;
  const more = (canJobChange() || canInnerPromote() || canFound() || canPromote()) ? '!' : '';
  if ($('mbMore').textContent !== more) $('mbMore').textContent = more;
}

$('tabs').addEventListener('pointerdown', e => {
  const b = e.target.closest('[data-tab]');
  if (!b) return;
  tab = b.dataset.tab;
  lastSideHtml = '';
  renderSide();
  $('side').scrollTop = 0;
});

function doAction(act) {
  const [a, arg] = act.split(':');
  if (a === 'buy') buy(arg);
  else if (a === 'mode') buyMax = !buyMax;
  else if (a === 'release') release();
  else if (a === 'accept') acceptQuest(+arg);
  else if (a === 'rush') rushQuest(+arg);
  else if (a === 'sub') subscribe(arg);
  else if (a === 'unsub') unsubscribe(arg);
  else if (a === 'crew') recruit(arg);
  else if (a === 'item') buyItem(arg);
  else if (a === 'skill') learnSkill(arg);
  else if (a === 'job') jobChange();
  else if (a === 'inner') innerPromote();
  else if (a === 'ng') { if (endingDone()) newGamePlus(); }
  else if (a === 'recompany') askCompany('rename');
  else if (a === 'gender') { state.career.gender = arg; lastDeskKey = ''; }
  else if (a === 'promote') promote();
  else if (a === 'found') found();
  else if (a === 'findbug') findBug();
  else if (a === 'rename') askName(false);
  else if (a === 'sound') { state.settings.sound = arg; playClick(); }
  else if (a === 'theme') { const t = THEMES.find(x => x.id === arg); if (t && achCount() >= t.need) { state.settings.theme = arg; applyTheme(); } else toast('업적 ' + t.need + '개를 모으면 해금됩니다'); }
  else if (a === 'share') share();
  else if (a === 'card') showCard(state.career.cto ? 'CTO 엔딩' : state.career.ipo ? '상장 엔딩' : '진행 중');
  else if (a === 'save') { save(); toast('저장 완료'); }
  else if (a === 'reset') {
    if (!resetArmed) { resetArmed = true; setTimeout(() => { resetArmed = false; lastSideHtml = ''; }, 3000); }
    else { resetArmed = false; const settings = state.settings; state = defaultState(); state.settings = settings; startFile(); renderAllCode(); save(); askName(true); }
  }
  lastSideHtml = '';
  renderSide();
}
// 패널이 주기적으로 다시 그려져도 클릭이 씹히지 않도록 pointerdown으로 처리
$('side').addEventListener('pointerdown', e => {
  if (e.target.closest('input')) return;
  const g = e.target.closest('[data-gloss]');
  if (g) { e.preventDefault(); openGlossary(g.dataset.gloss); return; }
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled || el.classList.contains('locked')) return;
  doAction(el.dataset.act);
});
$('side').addEventListener('input', e => { if (e.target.id === 'glossSearch') filterGlossary(e.target.value); });
$('status').addEventListener('pointerdown', e => {
  const el = e.target.closest('[data-act]');
  if (el) doAction(el.dataset.act);
});
$('refactorBtn').addEventListener('click', e => { e.currentTarget.blur(); startRefactor('중복 제거', true); });
window.addEventListener('beforeunload', save);

/* =========================================================
 * 게임 루프
 * ========================================================= */
function perSecond() {
  sanitize();
  if (state.lines.length > 5 && state.bugs.length < MAX_BUGS && !state.refactoring && Math.random() < bugChance()) {
    if (spawnBug()) showFloat('버그 발생!');
  }
  while (state.bugQueue > 0 && spawnBug()) state.bugQueue--;

  const T = state.timers;
  if (state.lv.log >= 3 && state.bugs.length) { T.logFix += 1; if (T.logFix >= logFixInterval(state.lv.log)) { T.logFix = 0; fixBug(state.bugs[0], true); } }
  if (hasSub('gemini') && state.bugs.length) { T.gemFix += 1; if (T.gemFix >= 20) { T.gemFix = 0; fixBug(state.bugs[0], true); } }
  if (hasCrew('park') && liveGrade() <= 1 && !state.refactoring) startRefactor(crewName(CREW[0]) + ' 과장 리팩토링', false);

  if (isCeo() && !state.career.ipo) {
    T.market += 1;
    if (T.market >= 10) { T.market = 0; state.market = clamp(Math.pow(state.market, 0.85) * Math.exp((Math.random() - 0.5) * 1.1), 0.15, 3); }
    T.month = (T.month || 0) + 1;
    if (T.month >= 60) { T.month = 0; state.ceoMonths++; }
  }
  checkIpo();

  if (!modalSpec && state.time >= state.nextEventAt) {
    if (S().questsDone >= 1 || state.runBest >= 5e3) fireEvent();
    state.nextEventAt = state.time + (isCeo() && !state.career.ipo ? 60 + Math.random() * 40 : 100 + Math.random() * 60);
  }
  if (!state.challenge && state.time >= state.nextChallengeAt) {
    if (S().keys >= 30) startChallenge();
    state.nextChallengeAt = state.time + 70 + Math.random() * 30;
  }
  for (const [id, name, , check] of ACHS) {
    if (!state.career.ach[id] && check()) { state.career.ach[id] = true; toast('업적 달성: ' + name + ' (수입 +2%)'); }
  }
  state.buffs = state.buffs.filter(b => b.until > state.time);
}

let last = performance.now();
// 콤보 게이지: 키를 치면 가득 차고, 멈추면 줄어들다 0이 되면 끊김
let comboShown = 0;
function renderCombo(now) {
  const left = comboWindow() - (now - lastComboAt);
  const live = combo > 0 && left > 0;
  if (!live && combo > 0) {
    if (combo >= 10) showFloat('콤보 끊김 (' + combo + ')');
    combo = 0;
  }
  const ratio = live ? left / comboWindow() : 0;
  const bar = $('comboBar');
  $('cbFill').style.width = (ratio * 100).toFixed(1) + '%';
  const m = comboMult();
  const lvl = !live ? 0 : m >= 2 ? 4 : m >= 1.6 ? 3 : m >= 1.3 ? 2 : 1;
  if (bar.dataset.lv !== String(lvl)) bar.dataset.lv = lvl;
  bar.classList.toggle('low', live && ratio < 0.2);
  if (comboShown !== (live ? combo : 0)) {
    comboShown = live ? combo : 0;
    $('cbLabel').textContent = live ? '콤보 ' + combo : '콤보';
    $('cbMult').textContent = 'x' + m.toFixed(2);
  }
}
function loop(now) {
  const dt = Math.min((now - last) / 1000, 1);
  last = now;
  renderCombo(now);
  if (!modalSpec || !modalSpec.input) {
    state.time += dt;
    S().playTime += dt;

    addValue(rate() * dt);
    if (isCeo() && !state.career.ipo) {
      state.value -= burnRate() * dt;
      if (state.value <= 0) {
        state.value = 0;
        if (netRate() < 0) state.bankrupt += dt;
      } else state.bankrupt = Math.max(0, state.bankrupt - dt * 2);
      if (state.bankrupt >= BANKRUPT_SEC) goBankrupt();
    }
    checkStage();
    if (state.refactoring && state.time >= state.refactoring.until) doRefactor(state.refactoring.reason);

    const speed = AUTO_TYPE_SPEED * (1 + 2 * state.lv.ci) * (hasSub('copilot') ? 2 : 1);
    autoAcc += dt * speed;
    const n = Math.floor(autoAcc);
    autoAcc -= n;
    if (state.pending && !state.refactoring) {
      const idle = performance.now() - lastKeyAt > IDLE_MS;
      if (idle && state.curSrc === 'filler' && !aiKps()) finishFillerLine();
      const canAuto = state.curSrc === 'pending' || (state.cur === '' && (!state.filler || idle));
      if (canAuto) {
        if (state.pending.length > PENDING_CAP) typeFrom('pending', state.pending.length - PENDING_CAP, false);
        if (n > 0) typeFrom('pending', n, false);
      }
    }
    const kps = aiKps();
    if (kps > 0) {
      aiAcc += dt * kps;
      let k = 0;
      while (aiAcc >= 1 && k++ < 30) { aiKey(); aiAcc--; }
    }
    if (state.fileLines >= curFile().target) completeFile();

    tickQuests();
    checkIncident();
    if (state.challenge && state.time > state.challenge.until) endChallenge();
    if (modalSpec && modalSpec.def !== undefined && state.time - modalSpec.openedAt > 20) closeModal(modalSpec.def);

    secAcc += dt;
    if (secAcc >= 1) { secAcc -= 1; perSecond(); }
  }

  renderTop();
  renderChallenge();
  sideAcc += dt;
  if (sideAcc >= 0.1) { sideAcc = 0; renderSide(); renderStatus(); renderBuffs(); renderExplorer(); renderDesk(); }
  requestAnimationFrame(loop);
}

const loaded = load();
applyTheme();
renderAllCode();
$('code').scrollTop = $('code').scrollHeight;
setInterval(save, 5000);
if (!state.career.name) askName(true);
else if (!state.company) askCompany('first');
else if (!state.career.gender) askGender(false);
requestAnimationFrame(loop);
