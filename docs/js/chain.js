// MeQuest chain layer: reads straight from the onyx-1 RPC (no backend),
// writes through the Adena wallet.
(function () {
  const C = window.MQ_CONFIG;

  const b64 = (s) => btoa(unescape(encodeURIComponent(s)));
  const unb64 = (s) => decodeURIComponent(escape(atob(s || '')));

  async function abci(path, data) {
    const res = await fetch(C.rpc, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'abci_query', params: { path: path, data: b64(data) } })
    });
    const j = await res.json();
    const r = j.result && j.result.response && j.result.response.ResponseBase;
    if (!r) throw new Error('bad RPC response');
    if (r.Error) throw new Error(unb64(r.Log || '') || 'query failed');
    return unb64(r.Data);
  }

  // Render("<path>") of a realm, parsed as JSON.
  async function api(pkg, path) {
    const txt = await abci('vm/qrender', pkg + ':' + path);
    return JSON.parse(txt);
  }

  // Evaluate a read-only expression, e.g. CanClaim("g1...", 3). Returns the string value.
  async function evalStr(pkg, expr) {
    const out = await abci('vm/qeval', pkg + '.' + expr);
    const m = out.match(/^\("((?:[^"\\]|\\.)*)" string\)/);
    return m ? JSON.parse('"' + m[1] + '"') : out;
  }

  async function balance(addr) {
    const txt = await abci('bank/balances/' + addr, '');
    const m = txt.match(/(\d+)ugnot/);
    return m ? +m[1] : 0;
  }

  // ---------- wallet ----------
  const W = { address: '', connected: false, hasAdena: false };

  function detect() { W.hasAdena = !!window.adena; return W.hasAdena; }

  async function connect() {
    if (!detect()) throw new Error('NO_ADENA');
    const est = await window.adena.AddEstablish('MeQuest');
    if (est.status !== 'success' && est.type !== 'ALREADY_CONNECTED') throw new Error(est.message || 'connection refused');
    const acc = await window.adena.GetAccount();
    if (acc.status !== 'success') throw new Error(acc.message || 'no account');
    if (acc.data.chainId !== C.chainId) {
      const sw = await window.adena.SwitchNetwork(C.chainId);
      if (sw.status !== 'success') throw new Error('Switch Adena to the ' + C.chainId + ' network');
    }
    W.address = acc.data.address;
    W.connected = true;
    try { localStorage.setItem('mq-connected', '1'); } catch (e) {}
    return W.address;
  }

  // Reconnect silently if the user connected before.
  async function resume() {
    try {
      if (!detect() || localStorage.getItem('mq-connected') !== '1') return '';
      const acc = await window.adena.GetAccount();
      if (acc.status === 'success' && acc.data.address) {
        W.address = acc.data.address; W.connected = true;
        return W.address;
      }
    } catch (e) {}
    return '';
  }

  // Call a realm function through Adena. sendUgnot is optional.
  async function call(pkg, func, args, sendUgnot) {
    if (!W.connected) await connect();
    const res = await window.adena.DoContract({
      messages: [{
        type: '/vm.m_call',
        value: {
          caller: W.address,
          send: sendUgnot ? sendUgnot + 'ugnot' : '',
          pkg_path: pkg,
          func: func,
          args: (args || []).map(String)
        }
      }],
      gasFee: 1000000,
      gasWanted: 50000000,
      memo: 'MeQuest'
    });
    if (res.status !== 'success') {
      const msg = (res.message || '') + ' ' + JSON.stringify(res.data || '');
      const m = msg.match(/(check failed[^"\\]*|already [^"\\]*|daily cap[^"\\]*|Legendary needs[^"\\]*|VIP only[^"\\]*|not quite[^"\\]*|quest expired|all winner slots are taken|only [^"\\]*)/);
      throw new Error(m ? m[1] : (res.message || 'Transaction failed'));
    }
    return res.data || {};
  }

  window.Chain = { api: api, evalStr: evalStr, balance: balance, connect: connect, resume: resume, call: call, wallet: W, detect: detect, config: C };
})();
