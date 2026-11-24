// MeQuest site logic: the v4 design, driven by live data from the realm.
(function () {
  const C = window.MQ_CONFIG;
  const Chain = window.Chain;
  const ART = (k) => 'art/' + (k || 'emblem') + '.png';
  const UG = 1e6;
  const fmt = (n) => (Math.round(n * 100) / 100).toString();
  const gnot = (ug) => fmt(ug / UG);
  const shortA = (a) => a ? a.slice(0, 5) + '…' + a.slice(-4) : '';
  const disp = (w) => w ? (w.name ? '@' + w.name : shortA(w.addr)) : '';
  const initial = (w) => w && w.name ? w.name.charAt(0).toUpperCase() : (w && w.addr ? w.addr.charAt(2).toUpperCase() : '?');
  const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
  const ago = (ts, now) => { const s = Math.max(0, Math.round(now / 1000 - ts)); return s < 60 ? 'just now' : s < 3600 ? Math.floor(s / 60) + 'm ago' : s < 86400 ? Math.floor(s / 3600) + 'h ago' : Math.floor(s / 86400) + 'd ago'; };

  const RN = ['', 'Common', 'Rare', 'Epic', 'Legendary'];
  const RS = {
    Common: { cls: 'mqk mqk-c', chip: 'color: #57534E; background: #F4F1EC', max: 0, col: '#A8A29E', holo: '' },
    Rare: { cls: 'mqk mqk-r2', chip: 'color: #1D4ED8; background: #EAF1FE', max: 500, col: '#2563EB', holo: '' },
    Epic: { cls: 'mqk mqk-e', chip: 'color: #6D28D9; background: #F1EAFE', max: 100, col: '#7C3AED', holo: 'mq-holo mq-holo-e' },
    Legendary: { cls: 'mqk mqk-l', chip: 'color: #74572A; background: #F3EBDD', max: 10, col: '#B8955A', holo: 'mq-holo' }
  };

  // The 17-card Season 1 set (8 Common / 5 Rare / 3 Epic / 1 Legendary).
  const CAT = [
    ['wallet', 'Wallet Ready', 'Common', 'Hold any GNOT', 'Make a Gno wallet with Adena. This is where your GNOT and cards live.'],
    ['faucet', 'Faucet Fan', 'Common', 'Hold at least 1 GNOT', 'Grab free test GNOT from the faucet so you can pay tiny fees on testnet.'],
    ['checkin', 'First Check-in', 'Common', 'Do your first daily check-in', 'Check in once. Come back tomorrow to start a streak.'],
    ['guest', 'Guestbook Signer', 'Common', 'Pass the 3 Learn Gno lessons', 'Answer three lessons on the mqlearn realm. It reports you to MeQuest by itself.'],
    ['butterfly', 'Social Butterfly', 'Common', 'Finish a social quest', 'Post with your MeQuest code. Paid after the project approves.'],
    ['name', 'Name Taken', 'Common', 'Register a gno.land username', 'Claim a name on the Gno users realm so people see @you, not a long address.'],
    ['bird', 'Early Bird', 'Common', 'Be one of the first 100 wallets', 'Only the first 100 wallets to join Season 1 get this.'],
    ['recruit', 'Recruiter', 'Common', 'Invite a friend who earns a card', 'Share your invite link. You earn when your friend gets their first card.'],
    ['explorer', 'Explorer', 'Rare', 'Earn cards from 3 projects', 'Try quests from three different Gno projects.'],
    ['week', 'Week Warrior', 'Rare', 'Check in 7 days in a row', 'Miss a day and the streak restarts.'],
    ['maker', 'Quest Maker', 'Rare', 'Post a funded quest', 'Lock GNOT into a quest of your own and bring users to your app.'],
    ['realm', 'First Realm', 'Rare', 'Deploy a realm that calls MeQuest', 'Deploy your own realm under your address and have it call MeQuest. Its path proves you built it.'],
    ['founder', 'Founding Quester', 'Rare', 'Collect 10 cards in Season 1', 'For the people who were here first.'],
    ['squad', 'Squad Leader', 'Epic', '5 invited friends earn a card', 'Bring a squad. Five friends you invited each earn a card.'],
    ['builder', 'Realm Builder', 'Epic', 'Finish the whole starter path', 'Own all five starter-path cards.'],
    ['unbreak', 'Unbreakable', 'Epic', 'Check in 30 days in a row', 'A full month without missing a day.'],
    ['champ', 'Season Champion', 'Legendary', 'Finish Season 1 in the top 3', 'Given by MeQuest when the season clock hits zero. Only 10 can ever exist.']
  ];
  const LEARN_PATH = ['wallet', 'faucet', 'name', 'guest', 'realm'];

  const AUTO = ['hold', 'name', 'card', 'checkin', 'early', 'invites', 'projects', 'cards', 'posted'];
  const KIND = {
    auto: { label: 'auto-verified', style: 'color: #166534; background: #E8F3EA; border: 1px solid #B9DCC1' },
    partner: { label: 'partner realm', style: 'color: #6D28D9; background: #F1EAFE; border: 1px solid #DCCBFB' },
    social: { label: 'social · approved', style: 'color: #1D4ED8; background: #EAF1FE; border: 1px solid #C7D7FB' },
    grant: { label: 'given by project', style: 'color: #74572A; background: #F3EBDD; border: 1px solid #E2D2B5' }
  };
  const group = (k) => AUTO.indexOf(k) >= 0 ? 'auto' : (k === 'push' || k === 'myrealm') ? 'partner' : k === 'manual' ? 'social' : 'grant';

  function checkShort(q) {
    const a = q.arg;
    switch (q.kind) {
      case 'hold': return +a < 1000 ? 'holds any GNOT' : 'balance ≥ ' + gnot(+a) + ' GNOT';
      case 'name': return 'users.ResolveAddress(addr)';
      case 'card': return 'owns cards #' + a.split(',').join(', #');
      case 'checkin': return 'check-in streak ≥ ' + a;
      case 'early': return 'joined in the first ' + a;
      case 'invites': return 'invited friends ≥ ' + a;
      case 'projects': return 'cards from ' + a + ' projects';
      case 'cards': return 'cards owned ≥ ' + a;
      case 'posted': return 'posted a funded quest';
      case 'push': return 'reported by ' + a.split('/').slice(-1)[0];
      case 'myrealm': return 'your realm calls ProveRealm';
      case 'manual': return 'approved by project';
      default: return 'granted by project';
    }
  }
  function checkCode(q) {
    const a = q.arg, id = q.id;
    const v = (expr) => 'func Verify(addr address) bool {\n    return ' + expr + '\n}\n// plus board rules: one win per wallet, 10 claims a day, slots left';
    switch (q.kind) {
      case 'hold': return v('banker.GetCoin(addr, "ugnot") >= ' + a);
      case 'name': return v('users.ResolveAddress(addr) != nil');
      case 'card': return v(a.split(',').map((x) => 'HasCard(addr, ' + x.trim() + ')').join(' &&\n        '));
      case 'checkin': return v('StreakOf(addr) >= ' + a);
      case 'early': return v('joinRank[addr] <= ' + a);
      case 'invites': return v('invitesDone[addr] >= ' + a + '  // friends who earned a card');
      case 'projects': return v('ProjectsDone(addr) >= ' + a);
      case 'cards': return v('len(cards[addr]) >= ' + a);
      case 'posted': return v('posted[addr] >= ' + a);
      case 'push': return '// in the partner realm (' + a + '):\nmequest.Complete(cross(cur), ' + id + ', user)\n// MeQuest only accepts this call from that exact realm path';
      case 'myrealm': return '// deploy at gno.land/r/<your g1 address>/hello\npackage hello\n\nimport "' + C.mequest + '"\n\nfunc Hello(cur realm) {\n    mequest.ProveRealm(cross(cur), ' + id + ')\n}\n// MeQuest checks the caller path starts with your own address';
      case 'manual': return '// you post with your code, the project checks it and calls:\nmequest.Review(cross(cur), ' + id + ', addr, true)';
      default: return 'mequest.Grant(cross(cur), ' + id + ', addr)  // quest funder only';
    }
  }

  // bech32 for the cheater test's fresh fake wallet
  const B32 = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
  function polymod(v) { const G = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3]; let c = 1; for (const x of v) { const b = c >> 25; c = ((c & 0x1ffffff) << 5) ^ x; for (let i = 0; i < 5; i++) if ((b >> i) & 1) c ^= G[i]; } return c; }
  function fakeAddr() {
    const bytes = Array.from(crypto.getRandomValues(new Uint8Array(20)));
    const data = []; let acc = 0, bits = 0;
    for (const b of bytes) { acc = (acc << 8) | b; bits += 8; while (bits >= 5) { bits -= 5; data.push((acc >> bits) & 31); } }
    if (bits) data.push((acc << (5 - bits)) & 31);
    const hrp = 'g'; const hx = [...hrp].map((c) => c.charCodeAt(0) >> 5).concat([0], [...hrp].map((c) => c.charCodeAt(0) & 31));
    const pm = polymod(hx.concat(data, [0, 0, 0, 0, 0, 0])) ^ 1;
    const cs = []; for (let i = 0; i < 6; i++) cs.push((pm >> (5 * (5 - i))) & 31);
    return hrp + '1' + data.concat(cs).map((d) => B32[d]).join('');
  }

  class MeQuestApp extends DCLogic {
    constructor(props) {
      super(props);
      const ref = (new URLSearchParams(location.search).get('ref') || '').trim();
      const hash = (location.hash || '').replace('#', '');
      this.state = {
        page: 'home', menuOpen: false, filter: 'all', qSel: 0, claim: {}, step: 0, lines: {},
        reveal: null, cardTab: 'all', openCard: null, query: '', result: '', myTab: 'progress',
        postTab: 'new', pKind: 'builtin', pCheck: 'HoldsGNOT', pTitle: '', pDesc: '', pPath: '', pReward: '0.5', pSlots: '20',
        testStep: 0, testRan: false, cases: null, now: Date.now(), lastSync: 0, countP: 0, heroStep: 1,
        toast: null, busy: false, quizAnswer: '', vipMsg: '', reviews: [], ref: ref.startsWith('g1') ? ref : '',
        d: { stats: null, quests: [], receipts: [], top: [], me: null, learn: [], vip: [], loaded: false, error: '' }
      };
      Object.assign(this.state, this.fromHash(hash));
      this.timers = [];
    }

    componentDidMount() {
      const start = Date.now();
      const tick = () => { const p = Math.min(1, (Date.now() - start) / 1400); this.setState({ countP: p }); if (p < 1) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
      setInterval(() => this.setState((s) => ({ now: Date.now(), heroStep: s.heroStep >= 6 ? 1 : s.heroStep + 1 })), 1000);
      setInterval(() => this.load(), 12000);
      window.addEventListener('hashchange', () => { this.setState(Object.assign({ menuOpen: false }, this.fromHash(location.hash.replace('#', '')))); window.scrollTo(0, 0); });
      Chain.resume().then(() => this.load());
      if (!Chain.detect() && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
        this.toast('View-only on phone: everything here is live, but claiming needs the Adena wallet on a desktop browser.', 'info');
      }
    }

    fromHash(hash) {
      const PAGES = ['home', 'quests', 'my', 'board', 'collection', 'learn', 'passport', 'cases', 'post'];
      const m = (hash || '').match(/^quest-(\d+)$/);
      if (m) return { page: 'quest', qSel: +m[1] };
      return { page: PAGES.indexOf(hash) >= 0 ? hash : 'home' };
    }

    later(fn, ms) { this.timers.push(setTimeout(fn, ms)); }
    toast(text, tone, action) { this.setState({ toast: { text: text, tone: tone || 'info', action: action || null } }); }
    me() { return Chain.wallet.address; }

    async load() {
      const P = C.mequest;
      try {
        const [stats, quests, receipts, top] = await Promise.all([
          Chain.api(P, 'api/stats'), Chain.api(P, 'api/quests'), Chain.api(P, 'api/receipts'), Chain.api(P, 'api/top')
        ]);
        const addr = this.me();
        const extra = await Promise.all([
          addr ? Chain.api(P, 'api/p/' + addr) : Promise.resolve(null),
          Chain.api(C.learn, 'api/' + (addr || 'none')).catch(() => []),
          Chain.api(C.vip, 'api').catch(() => [])
        ]);
        this.setState((s) => ({ lastSync: Date.now(), d: { stats, quests, receipts, top, me: extra[0], learn: extra[1], vip: extra[2], loaded: true, error: '' } }));
        if (this.state.page === 'post' && this.state.postTab === 'review') this.loadReviews();
        if (addr && this.state.ref && extra[0] && !extra[0].hasInviter && !extra[0].cards.length && this.state.ref !== addr && !this.askedRef) {
          this.askedRef = true;
          this.toast('You were invited by ' + shortA(this.state.ref) + '. Link them as your inviter so they get credit when you earn your first card.', 'info', { label: 'Link inviter', run: () => this.tx(C.mequest, 'SetInviter', [this.state.ref], 0, 'Inviter linked ✓') });
        }
      } catch (e) {
        this.setState((s) => ({ d: Object.assign({}, s.d, { error: String(e.message || e) }) }));
      }
    }

    async loadReviews() {
      const addr = this.me();
      if (!addr) return;
      const mine = this.state.d.quests.filter((q) => q.funder.addr === addr && q.pending > 0);
      const full = await Promise.all(mine.map((q) => Chain.api(C.mequest, 'api/q/' + q.id).catch(() => null)));
      const reviews = [];
      full.forEach((q) => { if (q) q.queue.forEach((x) => reviews.push({ quest: q, who: x.who, proof: x.proof })); });
      this.setState({ reviews: reviews });
    }

    async connect() {
      try {
        await Chain.connect();
        this.toast('Connected ' + shortA(this.me()) + ' on ' + C.chainId, 'ok');
        await this.load();
      } catch (e) {
        if (String(e.message) === 'NO_ADENA') {
          const mobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
          this.toast(mobile ? 'Adena is a desktop browser extension. Open MeQuest on a computer with Adena to claim.' : 'Install the Adena wallet extension, then reload this page.', 'warn',
            mobile ? null : { label: 'Get Adena', run: () => window.open('https://www.adena.app/', '_blank', 'noopener') });
        } else this.toast(e.message || 'Could not connect', 'err');
      }
    }

    // Send a transaction through Adena, then refresh.
    async tx(pkg, func, args, sendUg, okText) {
      if (!this.me()) { await this.connect(); if (!this.me()) return null; }
      this.setState({ busy: true });
      this.toast('Approve the transaction in Adena…', 'info');
      try {
        const res = await Chain.call(pkg, func, args, sendUg);
        this.toast(okText || 'Done ✓', 'ok');
        await this.load();
        return res;
      } catch (e) {
        this.toast(e.message || 'Transaction failed', 'err');
        return null;
      } finally {
        this.setState({ busy: false });
      }
    }

    renderVals() {
      const S = this.state, D = S.d;
      const set = (o) => this.setState(o);
      const go = (page) => () => { this.setState({ page: page, menuOpen: false }); try { history.replaceState(null, '', page === 'home' ? location.pathname + location.search : '#' + page); window.scrollTo(0, 0); } catch (e) {} };
      const addr = this.me();
      const me = D.me;
      const myCards = me ? me.cards : [];
      const ownedQuest = {}; myCards.forEach((c) => { ownedQuest[c.quest] = c; });
      const ownedArt = {}; myCards.forEach((c) => { if (!ownedArt[c.art] || c.rarity > ownedArt[c.art].rarity) ownedArt[c.art] = c; });
      const pendingSet = {}; (me ? me.pending : []).forEach((id) => { pendingSet[id] = true; });
      const now = Date.now();
      const tabCls = (on) => on ? 'tab tab-on' : 'tab';
      const myDisp = me ? disp(me.who) : (addr ? shortA(addr) : 'Guest');

      // ---------- quests ----------
      const Q = D.quests;
      const openQ = (id) => () => { this.timers.forEach(clearTimeout); this.timers = []; this.setState({ page: 'quest', qSel: id, step: 0, menuOpen: false, quizAnswer: '' }); try { history.replaceState(null, '', '#quest-' + id); window.scrollTo(0, 0); } catch (e) {} };
      const statusOf = (q) => ownedQuest[q.id] ? 'claimed' : pendingSet[q.id] ? 'pending' : S.claim[q.id];
      const ST = {
        checking: ['checking…', 'background: #111111; color: #C6A66B'], verified: ['verified', 'background: #E8F3EA; color: #166534'],
        claimed: ['claimed ✓', 'background: #E8F3EA; color: #166534'], failed: ['failed', 'background: #FDECEC; color: #B91C1C'],
        waiting: ['waiting for partner', 'background: #F1EAFE; color: #6D28D9'], pending: ['pending review', 'background: #F3EBDD; color: #74572A']
      };
      const ease = 1 - Math.pow(1 - S.countP, 3);
      const live = (q) => q.expires * 1000 > now && q.claimed < q.max;
      const qView = (q) => {
        const g = group(q.kind), status = statusOf(q), rar = RN[q.rarity], cat = CAT.find((c) => c[0] === q.art);
        const pct = Math.round(q.claimed / q.max * 100);
        const left = q.max - q.claimed;
        return {
          id: q.id, title: q.title, desc: q.desc || (cat ? cat[4] : ''), check: checkShort(q), kind: g,
          kindLabel: KIND[g].label, kindStyle: KIND[g].style, art: ART(q.art), cardName: cat ? cat[1] : q.title, rarity: rar, rarityUp: rar.toUpperCase(),
          rarChip: RS[rar].chip, cardCls: RS[rar].cls,
          reward: q.pay === 'fixed' ? gnot(q.reward) : 'split', poolLeft: gnot(q.pool) + ' GNOT', poolTotal: gnot(q.funded),
          claimedLabel: q.claimed + ' of ' + q.max + ' claimed', pct: pct,
          hasStatus: !!status, statusLabel: status ? ST[status][0] : '', statusStyle: status ? ST[status][1] : '',
          lowNoStatus: !status && live(q) && left / q.max < 0.2,
          barStyle: 'width: ' + Math.max(3, Math.round(pct * ease)) + '%; background: ' + (left / q.max < 0.2 ? 'linear-gradient(90deg, #D9A441, #C2410C)' : 'linear-gradient(90deg, #C6A66B, #A7834A)'),
          ends: new Date(q.expires * 1000).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
          open: openQ(q.id), live: live(q), raw: q
        };
      };
      const allQ = Q.map(qView);
      const liveQ = allQ.filter((q) => q.live || q.hasStatus);
      const quests = liveQ.filter((q) => S.filter === 'all' || q.kind === S.filter);
      const cnt = (k) => liveQ.filter((q) => q.kind === k).length;
      const filters = [['all', 'All · ' + liveQ.length], ['auto', 'Auto-verified · ' + cnt('auto')], ['partner', 'Partner realm · ' + cnt('partner')], ['social', 'Social · ' + cnt('social')]]
        .map(([id, label]) => ({ label: label, cls: tabCls(S.filter === id), pick: () => set({ filter: id }) }));
      const pickable = liveQ.filter((q) => !q.hasStatus && q.kind !== 'grant' && q.raw.pay === 'fixed');
      const featured = [2, 1, 3].map((r) => pickable.find((q) => q.raw.rarity === r)).filter(Boolean).concat(pickable).filter((q, i, arr) => arr.indexOf(q) === i).slice(0, 3);

      // ---------- cards ----------
      const CARDS = CAT.map((c) => {
        const rar = c[2], rs = RS[rar];
        const linked = Q.filter((q) => q.art === c[0]);
        const minted = linked.reduce((t, q) => t + q.claimed, 0);
        const mine = ownedArt[c[0]];
        const own = !!mine;
        const lq = linked.find((q) => live(q)) || linked[0];
        const cap = rs.max;
        const pctN = cap ? Math.round(minted / cap * 100) : Math.min(100, minted);
        const lqv = lq ? qView(lq) : null;
        return {
          id: c[0], name: c[1], rarity: rar, img: ART(c[0]), minted: minted, max: cap || '∞', how: c[3], story: c[4],
          reward: lq && lq.pay === 'fixed' ? gnot(lq.reward) : lq ? 'split' : '—',
          check: lq ? checkCode(lq) : '// this card has no live quest yet',
          cls: rs.cls, holo: !!rs.holo, holoOwned: !!rs.holo && own, holoCls: rs.holo || 'mq-holo', own: own,
          binderCls: rs.cls + (own ? '' : ' mqk-lock'),
          tag: own ? rar.toUpperCase() + ' · #' + String(mine.serial).padStart(3, '0') + (cap ? '/' + cap : '') + ' · ' + mine.season : rar.toUpperCase() + ' · ' + minted + ' minted',
          aria: c[1] + ', ' + rar + (own ? ', owned' : ', not owned yet') + '. Open details',
          ownLabel: own ? 'owned ✓' : 'not yet',
          ownStyle: own ? 'position: relative; background: #E8F3EA; color: #166534' : 'position: relative; background: #F4EEE4; color: #6B645B',
          chipStyle: 'text-transform: uppercase; ' + rs.chip,
          leftLabel: cap ? minted + ' minted · ' + (cap - minted) + ' left of ' + cap : minted + ' minted · no cap on Commons',
          barStyle: 'width: ' + Math.max(2, pctN) + '%; background: ' + rs.col,
          owner: own ? myDisp + ' · ' + mine.season : c[3],
          proof: own ? 'quest #' + mine.quest + ' · serial #' + mine.serial : '',
          hasQuest: !!lq, go: lq ? openQ(lq.id) : () => {},
          quest: lqv,
          open: () => set({ openCard: c[0] })
        };
      });
      const cardById = (id) => CARDS.find((c) => c.id === id) || CARDS[0];
      const ownedCount = CARDS.filter((c) => c.own).length;
      const cardTabs = [['all', 'All 17'], ['Common', 'Common · 8'], ['Rare', 'Rare · 5'], ['Epic', 'Epic · 3'], ['Legendary', 'Legendary · 1']]
        .map(([id, label]) => ({ label: label, cls: tabCls(S.cardTab === id), pick: () => set({ cardTab: id }) }));
      const cards = CARDS.filter((c) => S.cardTab === 'all' || c.rarity === S.cardTab);
      const sel = cardById(S.openCard);
      const commonOwned = CARDS.filter((c) => c.rarity === 'Common' && c.own).length;
      const earnedUg = (D.receipts || []).filter((r) => r.ok && r.who.addr === addr).reduce((t, r) => t + r.paid, 0);

      // ---------- quest detail ----------
      const qRaw = Q.find((q) => q.id === S.qSel) || Q[0];
      const q1 = qRaw ? qView(qRaw) : { title: 'Loading quests…', desc: '', art: ART('emblem'), kindLabel: '', kindStyle: '', reward: '', poolLeft: '', ends: '', rarity: 'Common', rarityUp: 'COMMON', cardCls: 'mqk mqk-c', cardName: '', raw: { kind: 'hold', id: 0, arg: '1' } };
      const qk = qRaw ? qRaw.kind : 'hold';
      const g = qRaw ? group(qk) : 'auto';
      q1.ruleTitle = g === 'auto' ? 'The rule, in code' : g === 'partner' ? 'The code that reports you' : g === 'social' ? 'How it gets approved' : 'Who can give it';
      q1.code = qRaw ? checkCode(qRaw) : '';
      const isLearn = qRaw && qk === 'push' && qRaw.arg === C.learn;
      q1.partnerHelp = isLearn ? 'Answer the three lessons below. When you pass lesson 3, the mqlearn realm calls MeQuest and your card is minted automatically.'
        : qk === 'myrealm' ? 'Deploy the realm shown on the left under your own address (play.gno.land works), call Hello once, and this quest completes itself.'
        : 'Do the action on the partner app. Its realm reports you to MeQuest.';
      q1.partnerCta = qk === 'myrealm' ? 'Open play.gno.land' : 'I did it · watch for the report';
      const statusNow = qRaw ? statusOf(qRaw) : undefined;
      const lineSet = S.lines[qRaw ? qRaw.id : 0] || [];
      let logLines = lineSet.slice(0, S.claim[qRaw && qRaw.id] === 'checking' ? S.step : lineSet.length);
      if (!logLines.length && statusNow === 'claimed') {
        const c = ownedQuest[qRaw.id];
        logLines = [['$ receipt for quest #' + qRaw.id, '#EDE6DA'], ['  ' + checkShort(qRaw) + ' → true', '#86EFAC'], ['  minted "' + q1.cardName + '" #' + c.serial + ' to ' + shortA(addr) + ' ✓', '#C4B5FD']];
      }
      if (!logLines.length && statusNow === 'pending') logLines = [['$ proof submitted', '#EDE6DA'], ['  waiting for the project to review', '#C6A66B']];
      if (!logLines.length && statusNow === 'waiting') logLines = [['$ watching for a report from ' + (qRaw.arg || 'your realm'), '#EDE6DA'], ['  no report yet · this updates by itself', '#A79E91']];
      logLines = logLines.map((l) => ({ text: l[0], style: 'color: ' + l[1] + '; white-space: pre-wrap' }));
      const today = me ? me.today : 0;
      const capped = today >= 10;
      const done = statusNow === 'claimed';
      const canAct = !!qRaw && qRaw.expires * 1000 > now && qRaw.claimed < qRaw.max;
      const act = {
        check: g === 'auto' && !statusNow && !capped && canAct,
        checking: statusNow === 'checking',
        claim: statusNow === 'verified',
        retry: statusNow === 'failed',
        partner: g === 'partner' && !isLearn && !statusNow && !capped && canAct,
        partnerWait: g === 'partner' && statusNow === 'waiting',
        social: g === 'social' && !statusNow && !capped && canAct,
        done: done, capped: capped && !statusNow
      };
      const SB = {
        none: [canAct ? 'Not started' : 'Closed · no slots or time left', '#F4EEE4', '#4A443D', '#A8A29E'],
        checking: ['Checking on-chain · free dry run', '#111111', '#C6A66B', '#C6A66B'],
        verified: ['Verified · claim it in one transaction', '#E8F3EA', '#166534', '#15803D'],
        claimed: ['Claimed · paid and minted', '#E8F3EA', '#166534', '#15803D'],
        failed: ['Failed · ' + (S.claim['why' + (qRaw && qRaw.id)] || 'check returned false'), '#FDECEC', '#B91C1C', '#B91C1C'],
        waiting: ['Waiting for the partner realm to report you', '#F1EAFE', '#6D28D9', '#7C3AED'],
        pending: ['Pending review by the project', '#F3EBDD', '#74572A', '#A7834A']
      };
      if (g === 'grant' && !statusNow) SB.none[0] = 'Given out by the project · nothing to claim';
      const sb = SB[statusNow || 'none'];
      const setClaim = (id, st, why) => this.setState((s) => ({ claim: Object.assign({}, s.claim, { [id]: st, ['why' + id]: why || '' }) }));

      const doCheck = async () => {
        if (!qRaw) return;
        if (!addr) { await this.connect(); if (!this.me()) return; }
        const id = qRaw.id, who = this.me();
        this.timers.forEach(clearTimeout); this.timers = [];
        let res;
        try { res = await Chain.evalStr(C.mequest, 'CanClaim("' + who + '", ' + id + ')'); } catch (e) { this.toast('Could not reach the realm: ' + e.message, 'err'); return; }
        const ok = res === 'ok';
        const lines = [['$ mequest.CanClaim(' + shortA(who) + ', ' + id + ')', '#EDE6DA'], ['  ' + checkShort(qRaw), '#A79E91']]
          .concat(ok ? [['  Verify → true', '#86EFAC'], ['  one win per wallet · ' + (today + 1) + '/10 today → ok', '#A79E91'], ['  ready to pay ' + q1.reward + ' GNOT ✓', '#C6A66B']]
            : [['  → ' + res, '#FCA5A5'], ['  Verify → false · no payout ✗', '#FCA5A5']]);
        this.setState((s) => ({ lines: Object.assign({}, s.lines, { [id]: lines }), step: 1 }));
        setClaim(id, 'checking');
        for (let i = 2; i <= lines.length; i++) this.later(() => this.setState({ step: i }), (i - 1) * 450);
        this.later(() => setClaim(id, ok ? 'verified' : 'failed', ok ? '' : res), lines.length * 450);
      };
      const doClaim = async () => {
        const id = qRaw.id;
        const before = this.state.lines[id] || [];
        const res = await this.tx(C.mequest, 'Claim', [id], 0, 'Claimed ✓');
        if (!res) return;
        const c = (this.state.d.me && this.state.d.me.cards.find((x) => x.quest === id)) || { serial: '?' };
        this.setState((s) => ({
          claim: Object.assign({}, s.claim, { [id]: undefined }),
          lines: Object.assign({}, s.lines, { [id]: before.concat([['  tx sent · block ' + (res.height || '…'), '#EDE6DA'], ['  paid ' + q1.reward + ' GNOT ✓', '#C6A66B'], ['  minted "' + q1.cardName + '" #' + c.serial + ' ✓', '#C4B5FD']]) }),
          reveal: { art: qRaw.art, rarity: qRaw.rarity, serial: c.serial, reward: q1.reward, title: q1.cardName }
        }));
      };

      // what to do when a check fails
      const why = S.claim['why' + (qRaw && qRaw.id)] || '';
      let fix = { show: false, label: '', run: () => {} };
      if (statusNow === 'failed') {
        if (/streak|joined yet/.test(why)) fix = { show: true, label: me && me.checkedToday ? 'Checked in today ✓ · come back tomorrow' : 'Check in today', run: () => this.tx(C.mequest, 'CheckIn', [], 0, 'Checked in ✓') };
        else if (/username/.test(why)) fix = { show: true, label: 'Register a username', run: () => window.open(C.explorer + '/r/sys/namereg/v0$help', '_blank', 'noopener') };
        else if (/hold at least/.test(why)) fix = { show: true, label: 'Get test GNOT from the faucet', run: () => window.open('https://faucet.gno.land', '_blank', 'noopener') };
        else if (/quest #(\d+) first/.test(why)) { const n = +why.match(/quest #(\d+) first/)[1]; fix = { show: true, label: 'Go to quest #' + n, run: openQ(n) }; }
        else if (/invited/.test(why)) fix = { show: true, label: 'Copy my invite link', run: () => copyInvite() };
        else if (/post a funded/.test(why)) fix = { show: true, label: 'Post a quest', run: go('post') };
        else if (/projects|cards, needs/.test(why)) fix = { show: true, label: 'Find more quests', run: go('quests') };
      }

      // Learn Gno quiz (mqlearn push quest)
      const L = D.learn || [];
      const nextLesson = L.find((l) => !l.passed);
      const quiz = {
        show: !!(isLearn && !done && nextLesson && addr && canAct), n: nextLesson ? nextLesson.n : 0, q: nextLesson ? nextLesson.q : '', answer: S.quizAnswer,
        set: (e) => set({ quizAnswer: e && e.target ? e.target.value : '' }),
        submit: async (e) => {
          if (e && e.preventDefault) e.preventDefault();
          const ans = (S.quizAnswer || (document.getElementById('quizans') || {}).value || '').trim();
          if (!ans) { this.toast('Type an answer first.', 'warn'); return; }
          const r = await this.tx(C.learn, 'Answer', [nextLesson.n, ans], 0, nextLesson.n === 3 ? 'Lesson 3 passed · MeQuest card minted ✓' : 'Lesson ' + nextLesson.n + ' passed ✓');
          if (r) {
            this.setState({ quizAnswer: '' });
            if (nextLesson.n === 3) this.setState({ reveal: { art: qRaw.art, rarity: qRaw.rarity, serial: '', reward: q1.reward, title: q1.cardName } });
          }
        }
      };

      // ---------- my quests ----------
      const TONE = { amber: ['#F3EBDD', '#74572A'], green: ['#E8F3EA', '#166534'], red: ['#FDECEC', '#B91C1C'], purple: ['#F1EAFE', '#6D28D9'], dark: ['#111111', '#C6A66B'] };
      const myAll = [];
      if (me) myAll.push({ group: 'progress', title: 'Daily check-in streak', detail: me.streak ? 'Day ' + me.streak + ' · ' + (me.checkedToday ? 'come back tomorrow' : 'check in today to keep it') : 'Start a streak today', art: ART('checkin'), chip: me.checkedToday ? 'done today' : 'open', tone: me.checkedToday ? 'green' : 'amber', bar: Math.min(100, Math.round((me.streak || 0) / 7 * 100)), action: me.checkedToday ? null : () => this.tx(C.mequest, 'CheckIn', [], 0, 'Checked in ✓'), actionLabel: 'Check in' });
      Q.forEach((q) => {
        const st = statusOf(q), v = qView(q);
        if (!st) return;
        if (st === 'checking' || st === 'verified') myAll.push({ group: 'progress', title: q.title, detail: st === 'checking' ? 'Checking on-chain…' : 'Verified · claim your card', art: v.art, chip: st, tone: st === 'checking' ? 'dark' : 'green', action: openQ(q.id), actionLabel: 'Open' });
        if (st === 'waiting') myAll.push({ group: 'progress', title: q.title, detail: 'Waiting for the partner realm to report you', art: v.art, chip: 'waiting', tone: 'purple', action: openQ(q.id), actionLabel: 'Open' });
        if (st === 'pending') myAll.push({ group: 'pending', title: q.title, detail: 'Proof submitted · waiting for the project to review', art: v.art, chip: 'pending review', tone: 'amber', action: openQ(q.id), actionLabel: 'View' });
        if (st === 'claimed') { const c = ownedQuest[q.id]; myAll.push({ group: 'done', title: q.title, detail: (q.pay === 'fixed' ? '+' + gnot(q.reward) + ' GNOT · ' : '') + v.cardName + ' #' + c.serial + ' minted', art: v.art, chip: 'claimed', tone: 'green' }); }
        if (st === 'failed') myAll.push({ group: 'failed', title: q.title, detail: S.claim['why' + q.id] || 'Check returned false', art: v.art, chip: 'failed', tone: 'red', action: openQ(q.id), actionLabel: 'Fix' });
      });
      const counts = { progress: 0, pending: 0, done: 0, failed: 0 };
      myAll.forEach((m) => { counts[m.group]++; });
      const myTabs = [['progress', 'In progress'], ['pending', 'Pending'], ['done', 'Done'], ['failed', 'Needs a fix']]
        .map(([id, label]) => ({ label: label, n: counts[id], cls: tabCls(S.myTab === id), pick: () => set({ myTab: id }) }));
      const myList = myAll.filter((m) => m.group === S.myTab).map((m, i) => {
        const t = TONE[m.tone];
        return {
          title: m.title, detail: m.detail, art: m.art, chip: m.chip, chipStyle: 'background: ' + t[0] + '; color: ' + t[1],
          dotStyle: m.tone === 'amber' ? 'display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: #A7834A' : 'display: none',
          hasBar: typeof m.bar === 'number', barStyle: 'width: ' + (m.bar || 0) + '%; background: linear-gradient(90deg, #C6A66B, #A7834A)',
          hasAction: !!m.action, action: m.action || (() => {}), actionLabel: m.actionLabel || '', rowStyle: 'flex-wrap: wrap; ' + (i ? 'border-top: 1px solid #F1ECE4' : '')
        };
      });

      // ---------- leaderboard ----------
      const top = D.top || [];
      const myIdx = top.findIndex((r) => r.who.addr === addr);
      const myRank = myIdx >= 0 ? myIdx + 1 : '—';
      const AV = [['#DBE7FD', '#1D4ED8'], ['#E8F3EA', '#166534'], ['#F1EAFE', '#6D28D9'], ['#FDECEC', '#B91C1C'], ['#F3EBDD', '#74572A']];
      const pod = (i) => {
        const r = top[i];
        if (!r) return { name: 'open spot', initial: '?', line: 'be here', art: ART('emblem'), alt: '' };
        const c = CAT.find((x) => x[0] === r.bestArt);
        return { name: disp(r.who), initial: initial(r.who), line: plural(r.cards, 'card') + ' · ' + r.points + ' pts', art: ART(r.bestArt), alt: c ? 'Best card: ' + c[1] : '' };
      };
      const podium = { a: pod(0), b: pod(1), c: pod(2) };
      const rows = top.slice(3, 50).map((r, i) => {
        const you = r.who.addr === addr, c = CAT.find((x) => x[0] === r.bestArt), av = AV[i % AV.length];
        return {
          name: disp(r.who), cards: r.cards, gnot: r.points + ' pts', place: i + 4, you: you, initial: initial(r.who),
          card: ART(r.bestArt), cardAlt: c ? 'Best card: ' + c[1] : '', move: RN[r.best] || '—', moveStyle: r.best ? RS[RN[r.best]].chip : 'color: #6B645B; background: #F4EEE4',
          avStyle: 'width: 38px; height: 38px; flex-shrink: 0; border-radius: 50%; display: flex; align-items: center; justify-content: center; font: 800 15px Montserrat, sans-serif; background: ' + av[0] + '; color: ' + av[1],
          barStyle: 'height: 100%; border-radius: 999px; width: ' + Math.round(r.points / Math.max(1, top[0].points) * 100) + '%; background: ' + (you ? 'linear-gradient(90deg, #C6A66B, #A7834A)' : '#CFC3B1'),
          style: (i ? 'border-top: 1px solid #F1ECE4; ' : '') + (you ? 'background: linear-gradient(90deg, #F6EFE3, #FFFFFF); box-shadow: inset 4px 0 0 #B8955A' : '')
        };
      });
      const ahead = myIdx > 0 ? top[myIdx - 1] : null;
      const youLine = !addr ? 'Connect your wallet to see your rank.' : myIdx < 0 ? 'No cards yet. Claim your first one to get on the board.'
        : myIdx === 0 ? "You're #1 this season. Keep it." : "You're #" + myRank + ' · ' + plural(ahead.points - top[myIdx].points + 1, 'pt') + ' behind ' + disp(ahead.who);
      const week = {}; (D.receipts || []).filter((r) => r.ok && now / 1000 - r.at < 7 * 86400).forEach((r) => { const k = r.who.addr; week[k] = week[k] || { who: r.who, n: 0, art: r.art, r: 0 }; week[k].n++; if (r.rarity >= week[k].r) { week[k].r = r.rarity; week[k].art = r.art; } });
      const qw = Object.values(week).sort((a, b) => b.n - a.n)[0];
      const qotw = qw ? { name: disp(qw.who), art: ART(qw.art), a: plural(qw.n, 'card') + ' this week', b: 'best: ' + RN[qw.r] } : { name: 'Nobody yet', art: ART('emblem'), a: '0 cards', b: 'claim one to take it' };
      const doFind = () => {
        const raw = S.query.trim().toLowerCase().replace(/^@/, '');
        if (!raw) { set({ result: 'Type a @name or g1 address first.' }); return; }
        const i = top.findIndex((r) => (r.who.name || '').toLowerCase() === raw || r.who.addr.toLowerCase() === raw);
        set({ result: i >= 0 ? disp(top[i].who) + ' is #' + (i + 1) + ' · ' + plural(top[i].cards, 'card') + ' · ' + top[i].points + ' pts' : 'No cards yet for that name.' });
      };

      // ---------- season clock ----------
      let left = Math.max(0, Date.parse(C.seasonEnd) - S.now);
      const dd = Math.floor(left / 864e5); left -= dd * 864e5;
      const hh = Math.floor(left / 36e5); left -= hh * 36e5;
      const mi = Math.floor(left / 6e4); left -= mi * 6e4;
      const se = Math.floor(left / 1e3);
      const pad = (n) => String(n).padStart(2, '0');
      const clock = [{ v: dd, l: 'DAYS' }, { v: pad(hh), l: 'HRS' }, { v: pad(mi), l: 'MIN' }, { v: pad(se), l: 'SEC' }];
      const syncS = S.lastSync ? Math.max(0, Math.round((S.now - S.lastSync) / 1000)) : -1;

      // ---------- learn path ----------
      let firstOpen = -1;
      const steps = LEARN_PATH.map((k, i) => {
        const c = cardById(k), own = c.own;
        if (!own && firstOpen < 0) firstOpen = i;
        return { c: c, own: own, i: i };
      }).map((x) => {
        const cur = x.i === firstOpen, c = x.c;
        return {
          title: c.how, art: c.img, num: x.own ? '✓' : String(x.i + 1), isCurrent: cur, open: c.hasQuest ? c.go : go('quests'),
          status: x.own ? 'Done · ' + c.name + ' card earned' : cur ? 'Up next · ' + (c.reward !== '—' ? c.reward + ' GNOT + ' : '') + c.rarity + ' card' : 'Unlocks after step ' + x.i,
          style: 'display: flex; flex-wrap: wrap; align-items: center; gap: 14px; padding: 14px 16px; ' + (cur ? 'border: 1.5px solid #B8955A; background: linear-gradient(90deg, #F6EFE3, #FFFFFF)' : '') + (!x.own && !cur ? 'opacity: .62' : ''),
          dotStyle: 'width: 36px; height: 36px; flex-shrink: 0; border-radius: 50%; display: flex; align-items: center; justify-content: center; font: 800 15px Montserrat, sans-serif; ' + (x.own ? 'background: #15803D; color: #FFFFFF' : cur ? 'background: #111111; color: #C6A66B' : 'background: #EFE8DC; color: #6B645B'),
          artStyle: 'width: 48px; height: 48px; object-fit: contain; flex-shrink: 0' + (x.own || cur ? '' : '; filter: grayscale(1); opacity: .5')
        };
      });
      const learnDone = steps.filter((s) => s.num === '✓').length;
      const learnLeftN = LEARN_PATH.filter((k) => !cardById(k).own).reduce((t, k) => t + (parseFloat(cardById(k).reward) || 0), 0);

      // ---------- home stats / hero / feed ----------
      const st = D.stats || { open: 0, paid: 0, cards: 0, joined: 0 };
      const rec = D.receipts || [];
      const dayN = Math.floor(now / 864e5);
      const hist = (fn) => { const v = []; for (let i = 7; i >= 0; i--) v.push(rec.filter((r) => Math.floor(r.at / 86400) <= dayN - i).reduce(fn, 0)); return v; };
      const spark = (vals) => {
        const lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals), sp = (hi - lo) || 1;
        const pts = vals.map((v, i) => (i * 100 / (vals.length - 1)).toFixed(1) + ',' + (27 - (v - lo) / sp * 24).toFixed(1));
        return { line: pts.join(' '), area: '0,30 ' + pts.join(' ') + ' 100,30' };
      };
      const todayRec = rec.filter((r) => r.at > now / 1000 - 86400);
      const stats = [
        { value: st.open, deltaText: (st.locked ? gnot(st.locked) + ' GNOT locked' : 'none yet'), label: 'Quests live', c: '#111111', fill: 'rgba(28,26,23,.08)', hist: [st.open, st.open, st.open, st.open, st.open, st.open, st.open, st.open], fmtv: (v) => String(Math.round(v)) },
        { value: st.paid / UG, deltaText: '+' + fmt(todayRec.reduce((t, r) => t + (r.ok ? r.paid : 0), 0) / UG) + ' today', label: 'GNOT paid out', c: '#8A6A2F', fill: 'rgba(217,142,30,.15)', hist: hist((t, r) => t + (r.ok ? r.paid : 0)), fmtv: (v) => fmt(v) },
        { value: st.cards, deltaText: '+' + todayRec.filter((r) => r.ok).length + ' today', label: 'Cards minted', c: '#6D28D9', fill: 'rgba(124,58,237,.12)', hist: hist((t, r) => t + (r.ok ? 1 : 0)), fmtv: (v) => String(Math.round(v)) },
        { value: st.joined || 0, deltaText: (st.players || 0) + ' hold cards', label: 'Wallets joined', c: '#166534', fill: 'rgba(21,128,61,.12)', hist: [0, 0, 0, 0, 0, 0, 0, st.joined || 0], fmtv: (v) => String(Math.round(v)), deltaLabel: 'with cards' }
      ].map((x, i) => {
        const s = spark(x.hist);
        return {
          label: x.label, deltaText: x.deltaText, c: x.c, fill: x.fill, line: s.line, area: s.area, shown: x.fmtv(x.value * ease),
          numStyle: 'font: 800 34px/1 Montserrat, sans-serif; letter-spacing: -.02em; color: ' + x.c, dotStyle: 'width: 8px; height: 8px; border-radius: 50%; background: ' + x.c
        };
      });
      const lastOk = rec.find((r) => r.ok);
      const HERO = lastOk ? [
        ['$ mequest.Claim(' + lastOk.quest + ')  // "' + lastOk.title + '"', '#EDE6DA'], ['  caller ' + shortA(lastOk.who.addr), '#A79E91'], ['  ' + lastOk.check, '#86EFAC'],
        ['  sent ' + gnot(lastOk.paid) + ' GNOT ✓', '#C6A66B'], ['  minted ' + RN[lastOk.rarity] + ' card ✓', '#C4B5FD'], ['  block ' + lastOk.height + ' · ' + ago(lastOk.at, now), '#A79E91']
      ] : [
        ['$ mequest.CanClaim(addr, 1)', '#EDE6DA'], ['  users.ResolveAddress(addr)', '#A79E91'], ['  Verify → true', '#86EFAC'], ['  one win per wallet → ok', '#A79E91'], ['  waiting for the first claim…', '#C6A66B'], ['', '#A79E91']
      ];
      const heroLines = HERO.slice(0, Math.min(S.heroStep, HERO.length)).map((l) => ({ text: l[0], style: 'color: ' + l[1] + '; white-space: pre' }));
      const RC = { Common: '#57534E', Rare: '#1D4ED8', Epic: '#6D28D9', Legendary: '#8A6A2F' };
      let fb = rec.filter((r) => r.ok).slice(0, 10).map((r) => ({ who: disp(r.who), what: r.title, gnot: gnot(r.paid), rarity: RN[r.rarity] }));
      if (!fb.length) fb = [{ who: 'MeQuest', what: 'is live on onyx-1 · be the first claim', gnot: '0', rarity: 'Common' }];
      while (fb.length < 6) fb = fb.concat(fb);
      const feed = fb.concat(fb).map((f) => ({ who: f.who, what: f.what, gnot: f.gnot, rarity: f.rarity, rarStyle: 'color: ' + RC[f.rarity] + '; border: 1px solid ' + RC[f.rarity] + '55' }));

      // ---------- cheater test (real read-only checks) ----------
      const autoQ = Q.filter((q) => AUTO.indexOf(q.kind) >= 0);
      const testQ = autoQ.filter((q) => q.claimed > 0).sort((a, b) => b.claimed - a.claimed)[0] || autoQ.find((q) => q.kind === 'name') || autoQ[0];
      const runTest = async () => {
        if (!testQ) { this.toast('No auto-verified quest to test yet.', 'warn'); return; }
        this.timers.forEach(clearTimeout); this.timers = [];
        set({ testStep: 1, testRan: true, cases: null });
        const full = await Chain.api(C.mequest, 'api/q/' + testQ.id).catch(() => null);
        const winner = full && full.winners[0] ? full.winners[0].who.addr : '';
        const real = addr || (top[0] && top[0].who.addr) || winner || fakeAddr();
        const fake = fakeAddr();
        const ev = (a) => a ? Chain.evalStr(C.mequest, 'CanClaim("' + a + '", ' + testQ.id + ')').catch((e) => 'error: ' + e.message) : Promise.resolve('no winner yet');
        const [r1, r2, r3] = await Promise.all([ev(real), ev(fake), ev(winner)]);
        const mk = (who, a, r) => {
          const ok = r === 'ok';
          const blocked = /already claimed/.test(r);
          return {
            who: who, ok: ok, badge: ok ? 'WOULD PAY' : blocked ? 'BLOCKED' : 'REJECTED',
            lines: [['$ CanClaim(' + shortA(a) + ', ' + testQ.id + ')', '#EDE6DA'], ['  ' + checkShort(testQ), '#A79E91'], ['  → ' + r, ok ? '#86EFAC' : '#FCA5A5'], [ok ? '  Verify → true · would pay ✓' : '  no payout ✗', ok ? '#C6A66B' : '#FCA5A5']]
          };
        };
        const cases = [mk(addr ? 'Your wallet' : 'A real quester', real, r1), mk('Fresh fake wallet', fake, r2), winner ? mk('Winner, 2nd try', winner, r3) : { who: 'Winner, 2nd try', badge: 'NO WINNER YET', ok: false, lines: [['$ nobody has won quest #' + testQ.id + ' yet', '#EDE6DA'], ['  claim it, then run this again', '#A79E91']] }];
        set({ cases: cases });
        for (let i = 2; i <= 5; i++) this.later(() => this.setState({ testStep: i }), (i - 1) * 500);
      };
      const ts = S.testStep, fin = ts >= 5;
      const cases3 = (S.cases || [{ who: 'Your wallet', lines: [] }, { who: 'Fresh fake wallet', lines: [] }, { who: 'Winner, 2nd try', lines: [] }]).map((c) => ({
        who: c.who, waiting: ts === 0 || !S.cases, lines: (c.lines || []).slice(0, ts).map((l) => ({ text: l[0], style: 'color: ' + l[1] + '; white-space: pre-wrap' })),
        badge: !S.cases ? (ts === 0 ? 'not run' : 'running…') : !fin ? 'running…' : c.badge,
        badgeStyle: !fin || !S.cases ? 'background: #F4EEE4; color: #6B645B' : c.ok ? 'background: #E8F3EA; color: #166534' : 'background: #FDECEC; color: #B91C1C'
      }));
      const receipts = rec.map((r) => ({
        id: 'case #' + String(r.n).padStart(3, '0'), quest: r.title, who: disp(r.who), check: r.check,
        paid: r.ok ? (r.paid ? gnot(r.paid) + ' GNOT + ' : '') + RN[r.rarity] + ' card' : 'nothing', tx: r.height, ago: ago(r.at, now),
        result: r.ok ? 'PAID' : 'REJECTED', badgeStyle: r.ok ? 'color: #166534; background: #E8F3EA' : 'color: #B91C1C; background: #FDECEC',
        style: 'padding: 16px; display: flex; flex-direction: column; gap: 10px' + (r.ok ? '' : '; border-color: #F7C9C9')
      }));

      // ---------- post a quest ----------
      const CHK = {
        HoldsGNOT: { kind: 'hold', arg: '1000000', art: 'faucet', code: 'banker.GetCoin(addr, "ugnot") >= 1000000' },
        HasUsername: { kind: 'name', arg: '', art: 'name', code: 'users.ResolveAddress(addr) != nil' },
        CheckInStreak: { kind: 'checkin', arg: '3', art: 'checkin', code: 'StreakOf(addr) >= 3' },
        CardsOwned: { kind: 'cards', arg: '3', art: 'founder', code: 'len(cards[addr]) >= 3' }
      };
      const postTabs = [['new', 'New quest'], ['review', 'Review queue · ' + S.reviews.length]].map(([id, label]) => ({ label: label, cls: tabCls(S.postTab === id), pick: () => { set({ postTab: id }); if (id === 'review') this.loadReviews(); } }));
      const kinds = [['builtin', 'Built-in check', 'MeQuest checks it'], ['partner', 'Partner realm', 'your realm reports'], ['social', 'Social', 'you approve posts']].map(([id, label, sub]) => ({
        label: label, sub: sub, pick: () => set({ pKind: id }),
        style: 'min-height: 64px; padding: 10px; border-radius: 14px; cursor: pointer; text-align: left; font: inherit; font-size: 14px; ' + (S.pKind === id ? 'background: #111111; color: #FAF8F4; border: 1px solid #111111' : 'background: #FFFFFF; color: #111111; border: 1px solid #E3D9CB')
      }));
      const checks = Object.keys(CHK).map((k) => ({ label: k, cls: tabCls(S.pCheck === k), pick: () => set({ pCheck: k }) }));
      const pCode = S.pKind === 'builtin' ? 'func Verify(addr address) bool {\n    return ' + CHK[S.pCheck].code + '\n}'
        : S.pKind === 'partner' ? '// add one line to your realm where the action happens:\nmequest.Complete(cross(cur), <quest id>, user)\n// only ' + (S.pPath || 'your realm path') + ' is accepted'
          : '// players post with their code (MQ-xxxx).\n// you check it here and approve:\nmequest.Review(cross(cur), <quest id>, addr, true)';
      const r = parseFloat(S.pReward) || 0, n = parseInt(S.pSlots, 10) || 0;
      const approved = me && me.approved;
      const pPrev = {
        title: S.pTitle.trim() || 'Your quest title', kindLabel: S.pKind === 'builtin' ? 'auto-verified' : S.pKind === 'partner' ? 'partner realm' : 'social · approved',
        kindStyle: (S.pKind === 'builtin' ? KIND.auto : S.pKind === 'partner' ? KIND.partner : KIND.social).style,
        check: S.pKind === 'builtin' ? CHK[S.pCheck].code : S.pKind === 'partner' ? 'reported by your realm' : 'approved by you'
      };
      const doPost = async () => {
        const title = S.pTitle.trim();
        if (!title) { this.toast('Give your quest a title.', 'warn'); return; }
        const ugEach = Math.round(r * UG);
        if (ugEach < 1 || n < 1 || n > 500) { this.toast('Set a reward above 0 and 1–500 slots.', 'warn'); return; }
        let kind, arg, art;
        if (S.pKind === 'builtin') { kind = CHK[S.pCheck].kind; arg = CHK[S.pCheck].arg; art = CHK[S.pCheck].art; }
        else if (S.pKind === 'partner') { kind = 'push'; arg = S.pPath.trim(); art = 'explorer'; if (!/^gno\.land\/r\/.+/.test(arg)) { this.toast('Enter your realm path, like gno.land/r/yourname/app', 'warn'); return; } }
        else { kind = 'manual'; arg = ''; art = 'butterfly'; }
        const days = Math.max(1, Math.min(90, Math.ceil((Date.parse(C.seasonEnd) - Date.now()) / 864e5)));
        const res = await this.tx(C.mequest, 'CreateQuest', [title, S.pDesc.trim(), art, 1, kind, arg, 'fixed', n, days], ugEach * n, 'Quest posted and funded ✓');
        if (res) this.setState({ pTitle: '', pDesc: '', page: 'quests' });
      };
      const decide = (x, ok) => async () => {
        const res = await this.tx(C.mequest, 'Review', [x.quest.id, x.who.addr, ok], 0, ok ? 'Approved · paid and minted ✓' : 'Rejected');
        if (res) this.loadReviews();
      };
      const reviewList = S.reviews.map((x) => ({
        who: disp(x.who), quest: x.quest.title, link: x.proof.replace(/^https?:\/\//, '').slice(0, 40), href: /^https?:\/\//.test(x.proof) ? x.proof : '#',
        code: 'MQ-' + x.who.addr.slice(-4).toUpperCase(), ago: 'waiting', initial: initial(x.who), approve: decide(x, true), reject: decide(x, false)
      }));

      // ---------- passport extras ----------
      const myCode = addr ? 'MQ-' + addr.slice(-4).toUpperCase() : 'MQ-····';
      const site = location.origin + location.pathname;
      const shareUrl = 'https://x.com/intent/post?text=' + encodeURIComponent('My MeQuest passport on Gno.land: ' + ownedCount + '/17 cards, rank #' + myRank + '. Quests that verify themselves.') + '&url=' + encodeURIComponent(site);
      const copyInvite = () => {
        if (!addr) { this.connect(); return; }
        const link = site + '?ref=' + addr;
        try { navigator.clipboard.writeText(link); this.toast('Invite link copied. Friends who open it can link you as their inviter.', 'ok'); }
        catch (e) { this.toast(link, 'info'); }
      };
      const VIPL = (D.vip || []).slice(0, 5).map((v) => ({ rank: v.rank, who: shortA(v.addr), msg: v.msg }));
      const canVip = me && me.best >= 2;
      const vip = {
        status: !addr ? 'connect to sign' : canVip ? 'open to you' : 'needs a Rare card or better', placeholder: canVip ? 'Say gm to the other VIPs' : 'Earn a Rare card to unlock',
        msg: S.vipMsg, set: (e) => set({ vipMsg: e && e.target ? e.target.value : '' }), list: VIPL,
        submit: async (e) => {
          if (e && e.preventDefault) e.preventDefault();
          const m = (S.vipMsg || (document.getElementById('vipmsg') || {}).value || '').trim();
          if (!m) { this.toast('Write a message first.', 'warn'); return; }
          const res = await this.tx(C.vip, 'Sign', [m], 0, 'Signed the VIP guestbook ✓');
          if (res) set({ vipMsg: '' });
        }
      };

      // ---------- wallet / nav ----------
      const hasAdena = Chain.detect();
      const wallet = addr
        ? { chip: shortA(addr), dot: 'mq-dot-g', chipStyle: 'background: #E8F3EA; color: #166534', cta: '' }
        : { chip: hasAdena ? 'Connect Adena' : 'View only', dot: 'mq-dot-a', chipStyle: 'background: #F3EBDD; color: #74572A', cta: hasAdena ? 'Connect Adena to play' : 'Adena (desktop) needed to claim' };
      const walletAction = addr ? go('passport') : () => this.connect();
      const meV = {
        initial: me ? initial(me.who) : addr ? addr.charAt(2).toUpperCase() : '?', display: myDisp,
        line: addr ? shortA(addr) + ' · ' + C.chainId : hasAdena ? 'tap to connect Adena' : 'view only · ' + C.chainId,
        short: addr ? shortA(addr) : 'not connected', rank: me ? me.rank : 'Newcomer',
        streak: me ? me.streak + (me.streak === 1 ? ' day' : ' days') : '—', joinRank: me && me.joinRank ? '#' + me.joinRank : '—', invites: me ? me.invites : 0
      };
      const pendingN = me ? me.pending.length : 0;
      const reviewN = Q.filter((q) => q.funder.addr === addr).reduce((t, q) => t + q.pending, 0);
      const NAV = [
        ['home', 'Home', 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z', '', false],
        ['quests', 'Quests', 'M5 4h14v16H5zM8 9h8M8 13h8M8 17h5', String(liveQ.length || ''), false],
        ['my', 'My quests', 'M9 11l3 3 8-8M20 12v7a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h11', pendingN ? pendingN + ' pending' : '', pendingN > 0],
        ['board', 'Leaderboard', 'M8 21V11M16 21V7M12 21V3M4 21h16', myIdx >= 0 ? '#' + myRank : '', false],
        ['collection', 'Collection', 'M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM9 8h6', ownedCount + '/17', false],
        ['learn', 'Learn Gno', 'M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2zM4 19V5', learnDone + '/5', false],
        ['passport', 'Passport', 'M3 5h18v14H3zM14 10h4M14 14h3M6 16c.8-1.6 2-2.2 3-2.2s2.2.6 3 2.2M9 11.6a1.6 1.6 0 1 0 0-.01', '', false],
        ['cases', 'Case files', 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', '', false],
        ['post', 'Post a quest', 'M12 5v14M5 12h14', reviewN ? reviewN + ' to review' : '', reviewN > 0]
      ];
      const activePage = S.page === 'quest' ? 'quests' : S.page;
      const nav = NAV.map((x) => ({ label: x[1], icon: x[2], count: x[3], hasCount: !!x[3], cntCls: x[4] ? 'cnt cnt-a' : 'cnt', cls: activePage === x[0] ? 'nav nav-on' : 'nav', current: activePage === x[0] ? 'page' : 'false', go: go(x[0]) }));
      const pg = {}; ['home', 'quests', 'quest', 'my', 'board', 'collection', 'learn', 'passport', 'cases', 'post'].forEach((k) => { pg[k] = S.page === k; });

      const rvA = S.reveal || { art: 'emblem', rarity: 1, serial: '', reward: '', title: '' };
      const rvR = RN[rvA.rarity] || 'Common';
      const TOAST = { info: ['#111111', '#FAF8F4'], ok: ['#E8F3EA', '#166534'], warn: ['#F3EBDD', '#74572A'], err: ['#FDECEC', '#B91C1C'] };
      const tt = S.toast ? TOAST[S.toast.tone] || TOAST.info : TOAST.info;
      const toast = {
        show: !!S.toast || !!D.error, text: S.toast ? S.toast.text : D.error === 'PENDING' ? 'MeQuest is deployed on onyx-1 and waiting for the testnet\'s approval check. Quests appear here the moment it switches on.' : 'Can\'t reach the onyx-1 testnet right now (' + D.error + '). Retrying…',
        style: 'display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 10px 14px; border-radius: 14px; font-size: 14px; font-weight: 600; background: ' + (S.toast ? tt[0] : D.error === 'PENDING' ? '#F3EBDD' : '#FDECEC') + '; color: ' + (S.toast ? tt[1] : D.error === 'PENDING' ? '#74572A' : '#B91C1C'),
        hasAction: !!(S.toast && S.toast.action), actionLabel: S.toast && S.toast.action ? S.toast.action.label : '',
        action: () => { const a = S.toast && S.toast.action; set({ toast: null }); if (a) a.run(); }, close: () => set({ toast: null })
      };

      return {
        pg: pg, nav: nav, menuOpen: S.menuOpen, menuLabel: S.menuOpen ? 'Close menu' : 'Open menu', toggleMenu: () => set({ menuOpen: !S.menuOpen }),
        goHome: go('home'), goQuests: go('quests'), goCases: go('cases'), goLearn: go('learn'), goCollection: go('collection'), goPost: go('post'), goPassport: go('passport'),
        art: { name: ART('name'), realm: ART('realm'), builder: ART('builder'), explorer: ART('explorer'), champ: ART('champ'), recruit: ART('recruit'), week: ART('week') },
        wallet: wallet, walletAction: walletAction, me: meV, toast: toast, needWallet: !addr,
        realmPath: C.mequest, questCount: liveQ.length, noQuests: quests.length === 0, emptyQuests: D.loaded ? 'No open quests in this filter yet.' : 'Loading quests from the realm…',
        countdown: dd + 'd ' + hh + 'h', clock: clock, syncAgo: syncS < 0 ? 'loading…' : syncS < 2 ? 'just now' : syncS + 's ago',
        myRank: myRank, ownedCount: ownedCount, claimsToday: today,
        capBar: 'width: ' + (today * 10) + '%; background: ' + (today >= 8 ? 'linear-gradient(90deg, #D9A441, #C2410C)' : 'linear-gradient(90deg, #C6A66B, #A7834A)'),
        stats: stats, heroLines: heroLines, feed: feed, featured: featured, learnDone: learnDone,
        filters: filters, quests: quests,
        q1: q1, logLines: logLines, logIdle: logLines.length === 0, act: act,
        statusBox: 'display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: 14px; font-size: 14px; font-weight: 600; background: ' + sb[1] + '; color: ' + sb[2],
        statusDot: 'width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; background: ' + sb[3], statusText: sb[0],
        doCheck: doCheck, doRetry: () => { setClaim(qRaw.id, undefined); this.setState((s) => ({ lines: Object.assign({}, s.lines, { [qRaw.id]: [] }) })); }, doClaim: doClaim,
        doPartnerStart: () => { if (qk === 'myrealm') window.open('https://play.gno.land', '_blank', 'noopener'); else setClaim(qRaw.id, 'waiting'); },
        fix: fix, quiz: quiz, myCode: myCode,
        postLink: S.postLink || '', setPostLink: (e) => set({ postLink: e && e.target ? e.target.value : '' }),
        doSubmit: async (e) => {
          if (e && e.preventDefault) e.preventDefault();
          const link = (S.postLink || (document.getElementById('postlink') || {}).value || '').trim();
          if (!/^https?:\/\/\S+$/.test(link)) { this.toast('Paste the full link to your post.', 'warn'); return; }
          const res = await this.tx(C.mequest, 'Submit', [qRaw.id, link.slice(0, 280)], 0, 'Submitted · the project will review it');
          if (res) set({ postLink: '' });
        },
        myTabs: myTabs, myList: myList, myEmpty: myList.length === 0,
        rows: rows, noRows: rows.length === 0, hasRows: rows.length > 0, podium: podium, qotw: qotw, playerCount: top.length, youLine: youLine,
        query: S.query, setQuery: (e) => set({ query: e && e.target ? e.target.value : '' }), findRank: (e) => { if (e && e.preventDefault) e.preventDefault(); doFind(); }, hasResult: !!S.result, result: S.result,
        cardTabs: cardTabs, cards: cards, binder: CARDS, sel: sel, cardOpen: !!S.openCard, closeCard: () => set({ openCard: null }),
        commonOwned: commonOwned, setBar: 'width: ' + Math.round(commonOwned / 8 * 100) + '%; background: #A8A29E', earned: gnot(earnedUg) + ' GNOT',
        steps: steps, learnLeft: fmt(learnLeftN), learnBar: 'width: ' + Math.max(3, learnDone * 20) + '%; background: linear-gradient(90deg, #C6A66B, #A7834A)',
        cases3: cases3, receipts: receipts, noReceipts: receipts.length === 0, runLabel: S.testRan ? 'Run it again' : 'Run the cheater test', runTest: runTest,
        postTabs: postTabs, postNew: S.postTab === 'new', postReview: S.postTab === 'review', kinds: kinds, pk: { builtin: S.pKind === 'builtin', partner: S.pKind === 'partner' }, checks: checks, pCode: pCode,
        pTitle: S.pTitle, setPTitle: (e) => set({ pTitle: e && e.target ? e.target.value : '' }),
        pDesc: S.pDesc, setPDesc: (e) => set({ pDesc: e && e.target ? e.target.value : '' }),
        pPath: S.pPath, setPPath: (e) => set({ pPath: e && e.target ? e.target.value : '' }),
        pReward: S.pReward, setPReward: (e) => set({ pReward: e && e.target ? e.target.value : '' }),
        pSlots: S.pSlots, setPSlots: (e) => set({ pSlots: e && e.target ? e.target.value : '' }),
        pDays: Math.max(1, Math.min(90, Math.ceil((Date.parse(C.seasonEnd) - S.now) / 864e5))),
        pRarityNote: approved ? 'you can post up to Legendary' : 'Common card · approved projects can post Epic and Legendary',
        pTotal: fmt(r * n), pPrev: pPrev, doPost: doPost, postLabel: S.busy ? 'Waiting for Adena…' : addr ? 'Fund and post quest' : 'Connect Adena to post',
        reviewList: reviewList, reviewCount: S.reviews.length, reviewEmpty: S.reviews.length === 0,
        doCheckIn: () => this.tx(C.mequest, 'CheckIn', [], 0, 'Checked in ✓'),
        checkInLabel: !addr ? 'Connect to check in' : me && me.checkedToday ? 'Checked in today ✓' : 'Check in today',
        inviteLabel: 'Copy my invite link', copyInvite: copyInvite, shareUrl: shareUrl, vip: vip,
        revealOpen: !!S.reveal,
        rev: { cls: RS[rvR].cls, holo: !!RS[rvR].holo, holoCls: RS[rvR].holo || 'mq-holo', tag: rvR.toUpperCase() + (rvA.serial ? ' · #' + String(rvA.serial).padStart(3, '0') : '') + ' · S1', img: ART(rvA.art), name: rvA.title, rarityUp: rvR.toUpperCase(), reward: rvA.reward, owner: myDisp + ' · Season 1' },
        revealToPassport: () => { set({ reveal: null, page: 'passport' }); try { window.scrollTo(0, 0); } catch (e) {} },
        revealClose: () => set({ reveal: null })
      };
    }
  }

  window.MeQuestApp = MeQuestApp;
})();
