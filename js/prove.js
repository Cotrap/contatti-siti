/* Prove cliccabili delle proposte. Nessun invio: i moduli mostrano dove arriverebbe la richiesta. */
(function () {
  'use strict';
  var SCRIPT = document.currentScript;
  var BASE = (SCRIPT && SCRIPT.getAttribute('data-base')) || '';
  var conta = 0;

  /* ---------- utilità ---------- */
  function el(tag, props, figli) {
    var e = document.createElement(tag);
    if (props) Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'text') e.textContent = v;
      else if (k === 'class') e.className = v;
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    });
    (figli || []).forEach(function (f) { if (f) e.appendChild(typeof f === 'string' ? document.createTextNode(f) : f); });
    return e;
  }
  function uid(p) { conta += 1; return p + '-' + conta; }
  function opzioni(sel, voci, vuoto) {
    sel.innerHTML = '';
    if (vuoto !== null) sel.appendChild(el('option', { value: '', text: vuoto }));
    voci.forEach(function (v) { sel.appendChild(el('option', { value: v[0], text: v[1] })); });
  }
  function scelta(voci, vuoto) { var s = el('select', { id: uid('s') }); opzioni(s, voci, vuoto); return s; }
  function campo(etichetta, controllo, facoltativo) {
    if (!controllo.id) controllo.id = uid('c');
    return el('div', { class: 'pv-campo' }, [el('label', { for: controllo.id, text: etichetta + (facoltativo ? ' (facoltativo)' : '') }), controllo]);
  }
  function testo(tipo) { return el('input', { type: tipo || 'text', id: uid('t') }); }
  function area() { return el('textarea', { id: uid('a') }); }
  function file() { return el('input', { type: 'file', id: uid('f'), accept: 'image/*,application/pdf' }); }
  function collegamento(t, href) {
    var a = el('a', { href: href, text: t });
    if (/^https?:/.test(href)) { a.target = '_blank'; a.rel = 'noopener'; }
    return a;
  }
  function riga(etichetta, nodo) { return el('li', {}, [etichetta + ': ', nodo]); }
  function blocco(titolo, nodi) { return el('div', { class: 'pv-blocco' }, [el('h3', { text: titolo })].concat(nodi)); }
  function nome(t) { return el('p', { class: 'pv-nome', text: t }); }
  function par(t) { return el('p', { text: t }); }
  function mostra(n, si) { n.hidden = !si; }

  /* ---------- dati del sito di acquisto (tratte e fermate) ---------- */
  var dati = { base: null, tratte: {} };
  var VERSIONE = (SCRIPT && /[?&]v=([^&]+)/.exec(SCRIPT.src) || [])[1];
  function json(p) { return fetch(BASE + p + (VERSIONE ? '?v=' + VERSIONE : '')).then(function (r) { if (!r.ok) throw new Error(p); return r.json(); }); }
  function base() { return dati.base ? Promise.resolve(dati.base) : json('dati/vettori/base.json').then(function (b) { dati.base = b; return b; }); }
  function tratte(c) {
    return dati.tratte[c] ? Promise.resolve(dati.tratte[c]) : json('dati/vettori/t/' + encodeURIComponent(c) + '.json').then(function (d) { dati.tratte[c] = d; return d; });
  }
  // SITA SUD ha più numeri sul sito di acquisto: per il cliente è un solo vettore
  function gruppi(ids) {
    var g = {};
    ids.forEach(function (id) { var n = dati.base.vettori[id].n; (g[n] = g[n] || []).push(String(id)); });
    return Object.keys(g).sort().map(function (n) { return g[n]; });
  }
  function vettore(ids) { return dati.base.vettori[ids[0]]; }
  // punti vendita e titoli di viaggio pubblicati dai vettori (dati/vettori-info.json; l'elenco «Altri vettori» della pagina Titoli di viaggio mostra solo sito e telefono)
  function info() {
    if (dati.info) return Promise.resolve(dati.info);
    return json('dati/vettori-info.json').then(function (d) {
      dati.info = {};
      d.forEach(function (v) { (v.ids || []).forEach(function (id) { dati.info[id] = v; }); });
      return dati.info;
    }).catch(function () { dati.info = {}; return dati.info; });
  }
  function esterno(t, href) { var a = collegamento(t, href); a.setAttribute('data-esterno', '1'); return a; }
  function doveComprare(ids) {
    if (ids[0] === '2') return el('p', {}, ['Biglietti e abbonamenti: ', collegamento('punti vendita delle linee COTRAP', BASE + 'pagine/titoli.html#punti-vendita'), '.']);
    var v = dati.info && dati.info[ids[0]];
    if (!v) return null;
    if (!v.pv && !v.tt) return par('Per punti vendita e titoli di viaggio chiedi al vettore: ' + v.tel + '.');
    var ul = el('ul', { class: 'pv-recapiti' });
    function voce(nome, x, prima) {
      if (!x) return el('li', { text: nome + ': chiedi al vettore, ' + v.tel });
      return el('li', {}, [prima ? prima + ' ' : '', esterno(x.testo, x.url)]);
    }
    ul.appendChild(voce('Punti vendita', v.pv, v.prima));
    (v.extra || []).forEach(function (x) { ul.appendChild(el('li', {}, [esterno(x.testo, x.url)])); });
    if (!v.unisci) ul.appendChild(voce('Titoli di viaggio', v.tt));
    if (v.nota === 'altre linee') ul.appendChild(el('li', { text: 'Per le altre linee chiedi al vettore: ' + v.tel }));
    return el('div', {}, [par('Dove comprare biglietti e abbonamenti:'), ul]);
  }
  // la scheda del vettore nella pagina Aziende consorziate (stesso indirizzo di studio/script/aziende-sito.py)
  function schedaVettore(ids) {
    if (ids[0] === '2') return null;   // linee COTRAP: pagina Titoli di viaggio
    var v = dati.info && dati.info[ids[0]], n = v ? v.nome : vettore(ids).n;
    var id = n.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return el('p', {}, [collegamento('Recapiti e tutte le informazioni del vettore', BASE + 'pagine/aziende.html#' + id)]);
  }
  // nome da scegliere nell'elenco «Vettore di riferimento» di My Card
  function sceltaMyCard(ids) {
    var n = vettore(ids).n;
    if (/^S\.T\.P\. Bari/i.test(n)) return el('p', {}, ['Per S.T.P. Bari richiedi la tessera su ', collegamento('mycard.stpspa.it', 'https://mycard.stpspa.it/'), '.']);
    if (ids[0] === '2') return par('Su My Card scegli “CO.TR.A.P. (Solo linee ANDRIA-BARI Z.I., CORATO-TRANI, BITONTO-S.SPIRITO)”.');
    var v = dati.info && dati.info[ids[0]];
    if (v && v.mc) return par('Su My Card scegli “' + v.mc + '” nell’elenco.');
    if (v) return par('Questo vettore non è nell’elenco di My Card: chiedi la tessera al vettore.');
    return par('Su My Card scegli questo vettore nell’elenco. Se non c’è, contattalo direttamente.');
  }
  function recapiti(ids) {
    var ul = el('ul', { class: 'pv-recapiti' });
    ids.forEach(function (id) {
      var v = dati.base.vettori[id];
      if (ids.length > 1 && v.sd) ul.appendChild(el('li', { class: 'pv-sede', text: v.sd }));
      if (v.t) {
        var li = el('li', {}, ['Telefono: ']);
        v.t.split(/\s*[\/·]\s*/).forEach(function (num, i) {
          if (i) li.appendChild(document.createTextNode(' · '));
          var cifre = num.replace(/\(.*?\)/g, '').replace(/[^0-9+]/g, '');
          li.appendChild(cifre ? collegamento(num.trim(), 'tel:' + cifre) : document.createTextNode(num));
        });
        ul.appendChild(li);
      }
      if (v.e) ul.appendChild(riga('Email', collegamento(v.e, 'mailto:' + v.e)));
      if (v.s) ul.appendChild(riga('Sito', collegamento(v.s.replace(/^https?:\/\//, '').replace(/\/$/, ''), v.s)));
    });
    return ul.children.length ? ul : null;
  }

  /* ---------- domande frequenti: la risposta prima di scrivere (dati/domande.json) ---------- */
  // parole che non aiutano a capire la domanda
  var VUOTE = ('a ad ai al alla alle allo agli anche avere c che chi ci col con cosa come cui da dai dal dalla dalle dei del della delle dello degli di dove e ed ' +
    'essere fa faccio fare fatto gli ha hanno ho i il in io la le lo loro ma me mi mia mie miei mio ne nei nel nella nelle no noi o per perche piu po poi posso ' +
    'potete puo qual quale quali quando quanto quanta questa questo se si sia siete sono su sul sulla sui ti tra tu tua tue tuo tuoi un una uno vi voi vorrei voglio ' +
    'salve buongiorno buonasera ciao grazie bus autobus pullman corriera ora era non portare porto sapere usare chiedere chiedo serve servono').split(' ');
  // nomi di luoghi: servono alla tratta, non a capire l'argomento (contano poco)
  var LUOGHI = 'bari brindisi foggia taranto lecce molfetta andria trani barletta bisceglie bitonto corato ruvo terlizzi giovinazzo modugno altamura gravina gioia acquaviva putignano monopoli fasano ostuni polignano conversano castellana manfredonia cerignola lucera vieste gallipoli otranto matera potenza napoli salerno';
  // parole diverse per la stessa cosa (radici)
  var SINONIMI = { pers: ['smarrit', 'dimenticat'], smarrit: ['pers'], dimenticat: ['pers', 'smarrit'], mail: ['email'], email: ['mail'],
    valig: ['bagagl'], trolley: ['bagagl'], can: ['animal'], gatt: ['animal'], cagnolin: ['animal'],
    invalid: ['disabil'], disabil: ['invalid'], handicap: ['invalid'], '104': ['invalid'], aer: ['aeroport'], vol: ['aeroport'],
    mycard: ['card', 'tesser'], card: ['mycard', 'tesser'], tesserin: ['tesser'], cellular: ['telefon'], sold: ['rimbors'],
    prezz: ['cost'], cost: ['prezz'], tariff: ['prezz', 'cost'] };
  // parole da non accorciare (sita e sito sono cose diverse)
  var INTERE = ['sita', 'sito', 'siti'];
  function normale(s) { return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); }
  function radici(s) {
    return normale(s).split(' ').filter(function (w) { return w && VUOTE.indexOf(w) < 0 && (w.length > 1 || /\d/.test(w)); })
      .map(function (w) { return INTERE.indexOf(w) >= 0 ? w : w.length > 3 ? w.replace(/[aeiou]+$/, '') : w; });
  }
  function combacia(gruppo, campo) {
    return gruppo.some(function (a) { return campo.some(function (b) {
      return a === b || (Math.min(a.length, b.length) >= 5 && (a.indexOf(b) === 0 || b.indexOf(a) === 0)); }); });
  }
  function domande() {
    if (dati.domande) return Promise.resolve(dati.domande);
    return json('dati/domande.json').then(function (D) {
      D.perId = {};
      D.domande.forEach(function (x, i) {
        x.i = i; x.r = { d: radici(x.domanda), p: radici(x.parole), t: radici(x.risposta.replace(/<[^>]+>/g, ' ')) };
        D.perId[x.id] = x;
      });
      dati.domande = D; return D;
    });
  }
  // le risposte migliori per quello che il cliente ha scritto: conta le parole trovate nella domanda, nelle parole chiave e nella risposta
  function cercaDomande(D, testo) {
    var chiavi = Object.keys(SINONIMI);
    var gruppi = radici(testo).map(function (r) {
      var g = [r];
      chiavi.forEach(function (k) { if (r === k || (k.length >= 4 && r.indexOf(k) === 0)) g = g.concat(SINONIMI[k]); });
      return g;
    });
    if (!gruppi.length) return [];
    var pos = {}; D.frequenti.forEach(function (id, i) { pos[id] = i; });
    var luoghi = radici(LUOGHI);
    var ris = D.domande.map(function (x) {
      var tot = 0, nellaDomanda = 0;
      gruppi.forEach(function (g) {
        var peso = combacia(g, x.r.d) ? 3 : combacia(g, x.r.p) ? 2 : combacia(g, x.r.t) ? 1 : 0;
        if (peso && luoghi.indexOf(g[0]) >= 0) peso = 1;
        tot += peso; if (peso === 3) nellaDomanda += 1;
      });
      return { x: x, tot: tot, densita: nellaDomanda / Math.max(1, x.r.d.length) };
    }).filter(function (o) { return o.tot > 0; });
    if (!ris.length) return [];
    var migliore = Math.max.apply(null, ris.map(function (o) { return o.tot; }));
    function posto(o) { return o.x.id in pos ? pos[o.x.id] : 99; }
    return ris.filter(function (o) { return o.tot >= migliore * 0.4; })
      .sort(function (a, b) { return b.tot - a.tot || b.densita - a.densita || posto(a) - posto(b) || a.x.i - b.x.i; })
      .slice(0, 6).map(function (o) { return o.x; });
  }
  function voceDomanda(x, aperta) {
    var corpo = el('div');
    corpo.innerHTML = x.risposta.replace(/href="pagine\//g, 'href="' + BASE + 'pagine/');
    return el('details', { class: 'pv-dom', open: aperta || null }, [el('summary', { text: x.domanda }), corpo]);
  }
  function vaiAlModulo() {
    var m = document.querySelector('[data-prova="cotrap-pagina"], [data-prova="cotrap-completo"], [data-prova="cotrap-prova"]');
    if (!m) return;
    m.scrollIntoView({ behavior: 'smooth', block: 'start' });
    var s = m.querySelector('select'); if (s) setTimeout(function () { s.focus({ preventScroll: true }); }, 400);
  }
  function Domande(radice) {
    radice.classList.add('pv', 'pv-domande');
    var input = el('input', { type: 'search', placeholder: 'Scrivi la tua domanda, per esempio: ho perso il biglietto', 'aria-label': 'Scrivi la tua domanda', autocomplete: 'off' });
    var temi = el('div', { class: 'pv-domande-temi', role: 'group', 'aria-label': 'Argomenti' });
    var sotto = el('p', { class: 'pv-domande-sotto' });
    var elenco = el('div', { class: 'pv-domande-elenco', 'aria-live': 'polite' });
    var nessuna = el('p', { class: 'pv-domande-nessuna', hidden: true, text: 'Nessuna risposta per queste parole: prova con altre parole o scegli un argomento.' });
    radice.appendChild(el('div', { class: 'pv-domande-cerca' }, [input]));
    radice.appendChild(temi); radice.appendChild(sotto); radice.appendChild(elenco); radice.appendChild(nessuna);
    radice.appendChild(el('p', { class: 'pv-domande-fine' }, ['Non hai trovato la risposta? ', el('button', { type: 'button', class: 'pv-link', text: 'Scrivici con il modulo qui sotto', onclick: vaiAlModulo })]));
    domande().then(function (D) {
      var bottoni = [];
      function mostraVoci(voci, titolo, apriPrima) {
        elenco.innerHTML = ''; sotto.textContent = titolo;
        voci.forEach(function (x, i) { elenco.appendChild(voceDomanda(x, apriPrima && i === 0)); });
        mostra(nessuna, !voci.length); mostra(sotto, voci.length > 0);
      }
      function scegliTema(t) {
        bottoni.forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-tema') === t ? 'true' : 'false'); });
        if (!t) return mostraVoci(D.frequenti.map(function (id) { return D.perId[id]; }), 'Le domande più frequenti', false);
        var nome = D.temi.filter(function (x) { return x[0] === t; })[0][1];
        mostraVoci(D.domande.filter(function (x) { return x.tema === t; }), nome, false);
      }
      [['', 'Più frequenti']].concat(D.temi).forEach(function (t) {
        var b = el('button', { type: 'button', text: t[1], 'data-tema': t[0], 'aria-pressed': 'false', onclick: function () { input.value = ''; scegliTema(t[0]); } });
        bottoni.push(b); temi.appendChild(b);
      });
      var attesa = null;
      input.addEventListener('input', function () {
        clearTimeout(attesa);
        attesa = setTimeout(function () {
          if (!input.value.trim()) return scegliTema('');
          bottoni.forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
          mostraVoci(cercaDomande(D, input.value), 'Risposte per la tua domanda', true);
        }, 150);
      });
      scegliTema('');
    }).catch(function () { radice.hidden = true; });
  }

  /* ---------- scelta della corsa: trova il vettore ---------- */
  function Trova(radice, avvisa) {
    var gruppo = uid('corsa');
    var rExt = el('input', { type: 'radio', name: gruppo, value: 'ext', checked: true });
    var rUrb = el('input', { type: 'radio', name: gruppo, value: 'urb' });
    var selDa = scelta([], 'Caricamento…'), selA = scelta([], 'Scegli prima il comune di partenza');
    var selF = scelta([], ''), selC = scelta([], 'Caricamento…');
    selA.disabled = true;
    var bFermata = el('div', { hidden: true }, [
      el('p', { class: 'pv-nota', text: 'Su questa tratta viaggiano più vettori: scegli la fermata dove sali.' }),
      campo('Fermata di partenza', selF)]);
    var bExt = el('div', {}, [campo('Comune di partenza', selDa), campo('Comune di arrivo', selA), bFermata]);
    var bUrb = el('div', { hidden: true }, [campo('Città', selC)]);
    radice.appendChild(el('fieldset', { class: 'pv-campo' }, [el('legend', { text: 'La corsa' }),
      el('div', { class: 'pv-radio' }, [el('label', {}, [rExt, ' Tra due comuni']), el('label', {}, [rUrb, ' In città (autobus urbano)'])])]));
    radice.appendChild(bExt); radice.appendChild(bUrb);
    radice.appendChild(el('p', { class: 'pv-piccolo' }, [el('button', { type: 'button', class: 'pv-link', text: 'Non trovo la mia corsa', onclick: function () { avvisa({ stato: 'sconosciuto' }); } })]));
    var t = null;

    base().then(function (b) {
      opzioni(selDa, b.partenze, 'Scegli il comune di partenza…');
      opzioni(selC, b.urbani.map(function (u) { return [u[0], u[1]]; }), 'Scegli la città…');
    });
    function urbano() { return rUrb.checked; }
    function valuta() {
      if (!dati.base) return avvisa({ stato: 'vuoto' });
      if (urbano()) {
        if (!selC.value) return avvisa({ stato: 'vuoto' });
        var u = dati.base.urbani.filter(function (x) { return x[0] === selC.value; })[0];
        var gu = gruppi(u[2]);
        return avvisa(gu.length === 1 ? { stato: 'trovato', ids: gu[0] } : { stato: 'biglietto', gruppi: gu });
      }
      var a = selA.value;
      if (!t || !a) { mostra(bFermata, false); return avvisa({ stato: 'vuoto' }); }
      var g = gruppi(t.d[a]);
      if (g.length === 1) { mostra(bFermata, false); return avvisa({ stato: 'trovato', ids: g[0] }); }
      if (bFermata.hidden || selF.getAttribute('data-arrivo') !== a) {
        var voci = [];
        t.f.forEach(function (f, i) { if (f[2].indexOf(a) >= 0) voci.push([String(i), f[0]]); });
        voci.push(['?', 'Non ricordo la fermata']);
        opzioni(selF, voci, 'Scegli la fermata…');
        selF.setAttribute('data-arrivo', a);
        mostra(bFermata, true);
        return avvisa({ stato: 'fermata' });
      }
      if (!selF.value) return avvisa({ stato: 'fermata' });
      if (selF.value === '?') return avvisa({ stato: 'biglietto', gruppi: g });
      return avvisa({ stato: 'trovato', ids: [String(t.f[+selF.value][1])] });
    }
    selDa.addEventListener('change', function () {
      t = null; mostra(bFermata, false); avvisa({ stato: 'vuoto' });
      opzioni(selA, [], 'Scegli prima il comune di partenza'); selA.disabled = true;
      var c = selDa.value; if (!c) return;
      tratte(c).then(function (d) {
        if (selDa.value !== c) return;
        t = d;
        var voci = Object.keys(d.d).map(function (k) { return [k, dati.base.nomi[k] || k]; })
          .sort(function (x, y) { return x[1].localeCompare(y[1], 'it'); });
        opzioni(selA, voci, 'Scegli il comune di arrivo…'); selA.disabled = false;
      });
    });
    selA.addEventListener('change', function () { mostra(bFermata, false); valuta(); });
    selF.addEventListener('change', valuta);
    selC.addEventListener('change', valuta);
    [rExt, rUrb].forEach(function (r) { r.addEventListener('change', function () { mostra(bExt, !urbano()); mostra(bUrb, urbano()); valuta(); }); });
    return { valuta: valuta };
  }

  /* ---------- modulo Contatti di cotrap.it ---------- */
  var TIPI_COTRAP = [
    ['generiche', 'Informazioni generiche'],
    ['info', 'Informazioni su una corsa'],
    ['rimborso', 'Rimborso per corsa cancellata o in ritardo'],
    ['oggetto', 'Oggetto smarrito o bagaglio'],
    ['reclamo', 'Reclamo'],
    ['fattura', 'Richiesta di fattura'],
    ['online', 'Problemi con il sito di acquisto o l’app'],
    ['mycard', 'Tessera My Card']
  ];
  var CON_CORSA = ['info', 'rimborso', 'oggetto', 'reclamo'];
  var REGOLE_COTRAP = {
    rimborso: ['Hai diritto al rimborso se la corsa è cancellata o parte con più di 60 minuti di ritardo (30 minuti in città). Non vale in caso di scioperi, calamità ed emergenze imprevedibili.', 'Puoi chiederlo anche durante il viaggio o subito dopo, mostrando il biglietto o l’abbonamento.'],
    reclamo: ['Puoi presentare il reclamo entro 3 mesi dal viaggio.', 'Puoi scrivere anche in inglese: ti rispondiamo in inglese. / You can write in English: we will reply in English.']
  };

  // informativa breve sotto il modulo: per rispondere non serve il consenso (GDPR art. 6.1 b e c); la richiesta va al vettore della corsa
  function informativa(tipo) {
    var testi = ['Titolare del trattamento è CO.TR.A.P. – Consorzio Trasporti Aziende Pugliesi, via Bruno Buozzi 36, 70132 Bari.',
      'Usiamo i dati del modulo solo per rispondere alla tua richiesta. Se riguarda una corsa, la mandiamo al vettore che l’ha fatta, che ti risponde. Non serve il tuo consenso: i dati ci servono per fare quello che ci chiedi.',
      'Nome, cognome, email e dati del viaggio servono; telefono e foto del biglietto sono facoltativi. Non scrivere informazioni sulla tua salute se non servono alla richiesta.'];
    if (tipo === 'reclamo') testi.push('Registriamo il reclamo e lo passiamo al vettore della corsa, che ti risponde. Lo conserviamo per almeno 24 mesi dalla data del viaggio, come chiede l’Autorità di regolazione dei trasporti. Se scrivi per un’altra persona, delega e documento servono solo a controllare la delega.');
    if (tipo === 'fattura') testi.push('I dati delle fatture li conserviamo per 10 anni, come chiede la legge.');
    testi.push('Puoi chiedere di vedere, correggere o cancellare i tuoi dati, o di limitarne l’uso, scrivendo a info@cotrap.it. Puoi fare reclamo al Garante per la protezione dei dati personali.');
    return el('div', { class: 'pv-informativa' }, [el('b', { text: 'Come usiamo i tuoi dati' })].concat(testi.map(par)).concat([
      el('p', {}, ['Informativa completa: ', collegamento('privacy', 'https://www.iubenda.com/privacy-policy/76585997'), '.'])]));
  }

  function destinazioneCotrap(tipo, ids) {
    if (tipo === 'fattura') return { nome: 'Ufficio fatture COTRAP' };
    if (tipo === 'online' || tipo === 'generiche') return { nome: 'info@cotrap.it' };
    if (tipo === 'reclamo') return { nome: 'reclami@cotrap.it' };
    if (!ids) return { nome: 'Ufficio COTRAP (info@cotrap.it)' };
    if (tipo === 'rimborso' && ['1', '15', '16'].indexOf(ids[0]) >= 0) return { nome: 'Ufficio rimborsi SITA Puglia', recapiti: ids };
    if (ids[0] === '2') {
      if (tipo === 'rimborso') return { nome: 'Ufficio rimborsi COTRAP' };
      if (tipo === 'oggetto') return { nome: 'info@cotrap.it', note: ['Gli oggetti trovati sulle linee COTRAP restano almeno 30 giorni in sede, a Bari in via Bruno Buozzi 36 (dal lunedì al sabato, 7:45–14:00).'] };
      return { nome: 'info@cotrap.it' };
    }
    var conEmail = ids.filter(function (id) { return dati.base.vettori[id].e; });
    if (!conEmail.length) return { nome: 'info@cotrap.it', recapiti: ids };
    return { nome: vettore(ids).n, recapiti: ids };
  }

  function ModuloCotrap(radice, opz) {
    opz = opz || {};
    radice.classList.add('pv');
    var sx = el('div'), dx = el('div');
    radice.appendChild(opz.colonna ? el('div', {}, [sx, el('div', { style: 'margin-top:18px' }, [dx])]) : el('div', { class: 'pv-griglia' }, [sx, dx]));
    if (opz.titolo) sx.appendChild(el('h2', { class: 'pv-titolo', text: opz.titolo }));

    var selTipo = scelta(TIPI_COTRAP, 'Scegli…');
    var campoTipo = campo('Di cosa hai bisogno?', selTipo);
    sx.appendChild(campoTipo);
    if (opz.tipo) mostra(campoTipo, false);   // richiesta già scelta nella pagina Contatti
    // prima di scrivere: le risposte pronte per quello che il cliente ha scelto
    var bRisposte = el('div', { class: 'pv-suggerite', hidden: true }); sx.appendChild(bRisposte);
    var bCorsa = el('div', { hidden: true }); sx.appendChild(bCorsa);
    var bDati = el('div', { hidden: true }); if (opz.completo) sx.appendChild(bDati);

    var attesa = el('p', { class: 'pv-attesa', text: 'Qui compare a chi arriva la tua richiesta.' });
    var esito = el('div', { class: 'pv-esito', hidden: true, 'aria-live': 'polite' });
    dx.appendChild(attesa); dx.appendChild(esito);

    var stato = { ids: null, noto: false };
    var trova = null;
    info();

    function svuota() { esito.innerHTML = ''; mostra(esito, false); mostra(attesa, true); mostra(bDati, false); stato.noto = false; }
    function pronto() { mostra(attesa, false); mostra(esito, true); }

    function mostraDestinazione() {
      var tipo = selTipo.value, d = destinazioneCotrap(tipo, stato.ids);
      esito.innerHTML = '';
      if (CON_CORSA.indexOf(tipo) >= 0) {
        if (stato.ids) esito.appendChild(blocco('Vettore della corsa', [nome(vettore(stato.ids).n),
          par('Sul biglietto è scritto sotto il logo COTRAP; sul biglietto online, alla voce «Gestito da».'),
          tipo === 'info' ? doveComprare(stato.ids) : null, schedaVettore(stato.ids)]));
        else esito.appendChild(blocco('Vettore non trovato', [par('La richiesta arriva all’ufficio COTRAP con i dati della corsa.')]));
      }
      var nodi = [nome(d.nome)];
      (d.note || []).forEach(function (n) { nodi.push(par(n)); });
      if (d.recapiti) nodi.push(recapiti(d.recapiti));
      esito.appendChild(blocco('La richiesta va a', nodi));
      pronto();
      stato.noto = true;
      if (opz.completo) preparaDati(tipo);
    }

    function mostraMyCard() {
      esito.innerHTML = '';
      var ul = el('ul', { class: 'pv-recapiti' }, [
        riga('Sito di assistenza', collegamento('assistenza.tecbus.eu', 'https://assistenza.tecbus.eu/submit_ticket/next/tessere-elettroniche')),
        el('li', { text: 'Telefono e WhatsApp: 328 803 2801, dal lunedì al venerdì non festivi, dalle 9.00 alle 13.00' })]);
      esito.appendChild(blocco('Per la tessera My Card risponde', [nome('Assistenza My Card'), ul]));
      pronto();
    }

    function sceltaBiglietto(g) {
      esito.innerHTML = '';
      var s = el('div', { class: 'pv-scelte' });
      g.forEach(function (ids) { s.appendChild(el('button', { type: 'button', text: vettore(ids).n, onclick: function () { stato.ids = ids; mostraDestinazione(); } })); });
      s.appendChild(el('button', { type: 'button', text: 'Non ho il biglietto', onclick: function () { stato.ids = null; mostraDestinazione(); } }));
      esito.appendChild(blocco('Guarda il biglietto', [par('Sul biglietto il nome del vettore è sotto il logo COTRAP; sul biglietto online, alla voce «Gestito da». Scegli quello che leggi:'), s]));
      pronto();
    }

    function preparaDati(tipo) {
      bDati.innerHTML = '';
      var fattura = tipo === 'fattura';
      if (REGOLE_COTRAP[tipo]) bDati.appendChild(el('div', { class: 'pv-regole' }, [el('b', { text: 'Prima di inviare' })].concat(REGOLE_COTRAP[tipo].map(par))));
      bDati.appendChild(el('p', { class: 'pv-passo', text: 'I tuoi dati' }));
      if (fattura) {
        bDati.appendChild(campo('Nome e cognome o ragione sociale', testo()));
        bDati.appendChild(el('div', { class: 'pv-due' }, [campo('Email', testo('email')), campo('Numero del biglietto', testo())]));
        bDati.appendChild(el('div', { class: 'pv-due' }, [campo('Codice fiscale o partita IVA', testo()), campo('Codice destinatario o PEC', testo())]));
        bDati.appendChild(campo('Messaggio', area(), true));
      } else {
        bDati.appendChild(el('div', { class: 'pv-due' }, [campo('Nome', testo()), campo('Cognome', testo())]));
        bDati.appendChild(el('div', { class: 'pv-due' }, [campo('Email', testo('email')), campo('Telefono', testo('tel'), true)]));
        if (CON_CORSA.indexOf(tipo) >= 0) bDati.appendChild(el('div', { class: 'pv-due' }, [campo('Giorno del viaggio', testo('date')), campo('Ora della corsa', testo('time'))]));
        if (tipo === 'reclamo') {
          bDati.appendChild(campo('Numero del biglietto o codice di prenotazione', testo()));
          // delega e documento solo se scrive per un'altra persona (Delibera ART 28/2021, Misura 2)
          var altra = el('input', { type: 'checkbox' });
          var bAltra = el('div', { hidden: true }, [campo('Nome e cognome della persona', testo()),
            el('div', { class: 'pv-due' }, [campo('Delega firmata (PDF o foto)', file()), campo('Documento d’identità della persona (PDF o foto)', file())])]);
          altra.addEventListener('change', function () { bAltra.hidden = !altra.checked; });
          bDati.appendChild(el('div', { class: 'pv-campo' }, [el('label', { class: 'pv-spunta' }, [altra, ' Scrivo per un’altra persona'])]));
          bDati.appendChild(bAltra);
          var motivi = ['Condizioni o prezzi del biglietto che ti sembrano discriminatori', 'Diritti delle persone con disabilità o a mobilità ridotta',
            'Informazioni sul viaggio', 'Informazioni sui tuoi diritti di passeggero', 'Difficoltà a presentare il reclamo',
            'Altro: ritardo, corsa non effettuata, comportamento del personale, pulizia…'];
          bDati.appendChild(el('fieldset', { class: 'pv-campo' }, [el('legend', { text: 'Di cosa ti lamenti? (puoi sceglierne più di uno)' })].concat(
            motivi.map(function (m) { return el('label', { class: 'pv-spunta' }, [el('input', { type: 'checkbox' }), ' ' + m]); }))));
        }
        bDati.appendChild(campo('Messaggio', area()));
        if (['rimborso', 'reclamo', 'oggetto'].indexOf(tipo) >= 0) bDati.appendChild(campo('Foto del biglietto', file(), true));
        if (tipo === 'reclamo') {
          var denaro = el('input', { type: 'radio', name: 'indennizzo', value: 'denaro' }), buono = el('input', { type: 'radio', name: 'indennizzo', value: 'buono' });
          bDati.appendChild(el('fieldset', { class: 'pv-campo' }, [el('legend', { text: 'Se ti spetta un indennizzo, come vuoi riceverlo?' }),
            el('div', { class: 'pv-radio' }, [el('label', {}, [denaro, ' In denaro']), el('label', {}, [buono, ' Buono o altro servizio'])]),
            el('p', { class: 'pv-piccolo', text: 'Le coordinate bancarie te le chiediamo solo se l’indennizzo ti spetta.' })]));
        }
      }
      bDati.appendChild(informativa(tipo));
      bDati.appendChild(el('div', { class: 'pv-campo' }, [el('label', { class: 'pv-spunta' }, [el('input', { type: 'checkbox' }), ' Ho letto l’', collegamento('informativa sulla privacy', 'https://www.iubenda.com/privacy-policy/76585997')])]));
      bDati.appendChild(el('button', { type: 'button', class: 'pv-invia', text: 'Simula invio', onclick: invia }));
      mostra(bDati, true);
    }

    function invia() {
      var d = destinazioneCotrap(selTipo.value, stato.ids);
      esito.innerHTML = '';
      esito.appendChild(el('div', { class: 'pv-conferma' }, [
        el('h3', { text: 'Esempio di conferma' }),
        par('Destinatario della richiesta: ' + d.nome + (/\.$/.test(d.nome) ? '' : '.')),
        par('Sul sito attivo il cliente riceve il numero della richiesta per email. Questa prova non invia messaggi.'),
        el('button', { type: 'button', class: 'pv-link', text: 'Nuova richiesta', onclick: function () { selTipo.value = opz.tipo || ''; cambiaTipo(); } })]));
      mostra(bDati, false);
      pronto();
    }

    function suggerisci(tipo) {
      bRisposte.innerHTML = ''; mostra(bRisposte, false);
      if (!tipo || opz.senzaRisposte) return;
      domande().then(function (D) {
        var voci = (D.per_tipo[tipo] || []).map(function (id) { return D.perId[id]; }).filter(Boolean);
        if (selTipo.value !== tipo || !voci.length) return;
        bRisposte.appendChild(el('p', { class: 'pv-passo', text: 'Forse la risposta è già qui' }));
        voci.forEach(function (x) { bRisposte.appendChild(voceDomanda(x, false)); });
        mostra(bRisposte, true);
      }).catch(function () {});
    }

    function cambiaTipo() {
      svuota(); stato.ids = null;
      var tipo = selTipo.value;
      mostra(bCorsa, false);
      suggerisci(tipo);
      if (!tipo) return;
      if (tipo === 'mycard') return mostraMyCard();
      if (CON_CORSA.indexOf(tipo) < 0) return mostraDestinazione();
      mostra(bCorsa, true);
      if (!trova) {
        trova = Trova(bCorsa, function (s) {
          if (s.stato === 'trovato') { stato.ids = s.ids; mostraDestinazione(); }
          else if (s.stato === 'biglietto') { mostra(bDati, false); sceltaBiglietto(s.gruppi); }
          else if (s.stato === 'sconosciuto') { stato.ids = null; mostraDestinazione(); }
          else { svuota(); }
        });
      } else trova.valuta();
    }
    selTipo.addEventListener('change', cambiaTipo);
    if (opz.tipo) { selTipo.value = opz.tipo; cambiaTipo(); return; }
    var q = /[?&]tipo=([a-z]+)/.exec(location.search);
    if (q && opz.completo && TIPI_COTRAP.some(function (t) { return t[0] === q[1]; })) { selTipo.value = q[1]; cambiaTipo(); }
  }

  /* ---------- pagina Contatti: 1 argomento → 2 risposta → 3 scrivici (un passo alla volta) ---------- */
  function Assistenza(radice) {
    radice.classList.add('pv', 'pv-domande', 'pv-assistenza');
    var D = null, stato = { passo: 1, tema: null, cerca: '', tipoModulo: null }, modulo = null;
    // indicatore dei passi
    var passi = el('ol', { class: 'pv-passi' });
    var bottoniPassi = ['Argomento', 'Risposta', 'Scrivici'].map(function (n, i) {
      var b = el('button', { type: 'button', onclick: function () { vai(i + 1); } }, [el('span', { text: String(i + 1) }), n]);
      passi.appendChild(el('li', {}, [b]));
      return b;
    });
    // passo 1: argomenti o domanda scritta
    var griglia = el('div', { class: 'pv-argomenti' });
    var cerca = el('input', { type: 'search', id: uid('q'), placeholder: 'Per esempio: ho perso il biglietto', autocomplete: 'off' });
    var bCerca = el('button', { type: 'submit', class: 'pv-invia', text: 'Cerca' });
    var titolo1 = el('h3', { class: 'pv-assist-titolo', tabindex: '-1', text: 'Di cosa hai bisogno?' });
    var p1 = el('div', { class: 'pv-assist-passo' }, [titolo1, griglia,
      el('form', { class: 'pv-assist-cerca', onsubmit: function (e) { e.preventDefault(); if (cerca.value.trim()) cercaDomanda(cerca.value); } }, [
        el('label', { for: cerca.id, text: 'Oppure scrivi la tua domanda' }),
        el('div', { class: 'pv-assist-riga' }, [el('div', { class: 'pv-domande-cerca' }, [cerca]), bCerca])])]);
    // passo 2: risposte e scelta
    var titolo2 = el('h3', { class: 'pv-assist-titolo', tabindex: '-1' });
    var elenco = el('div', { class: 'pv-domande-elenco' });
    var nessuna = el('p', { class: 'pv-domande-nessuna', hidden: true, text: 'Non abbiamo una risposta pronta per queste parole.' });
    var decidi = el('div', { class: 'pv-decidi' }, [
      el('p', { class: 'pv-decidi-domanda', text: 'Hai trovato la risposta?' }),
      el('div', { class: 'pv-decidi-bottoni' }, [
        el('button', { type: 'button', class: 'pv-invia pv-secondario', text: 'Sì, grazie', onclick: grazie }),
        el('button', { type: 'button', class: 'pv-invia', text: 'No, scrivici', onclick: function () { vai(3); } })])]);
    var fatto = el('div', { class: 'pv-conferma', hidden: true }, [el('h3', { text: 'Bene!' }), par('Se ti serve altro, scegli un altro argomento.'),
      el('button', { type: 'button', class: 'pv-link', text: 'Torna agli argomenti', onclick: function () { vai(1); } })]);
    var p2 = el('div', { class: 'pv-assist-passo', hidden: true }, [indietro('Cambia argomento', 1), titolo2, elenco, nessuna, decidi, fatto]);
    // passo 3: modulo della richiesta, o assistenza My Card
    var titolo3 = el('h3', { class: 'pv-assist-titolo', tabindex: '-1' });
    var richiesta = el('p', { class: 'pv-assist-richiesta' });
    var corpo3 = el('div');
    var p3 = el('div', { class: 'pv-assist-passo', hidden: true }, [indietro('Torna alle risposte', 2), titolo3, richiesta, corpo3]);
    [passi, p1, p2, p3].forEach(function (n) { radice.appendChild(n); });

    function indietro(testo, n) { return el('button', { type: 'button', class: 'pv-link pv-indietro', text: '← ' + testo, onclick: function () { vai(n); } }); }
    function tema(id) { return D.temi.filter(function (t) { return t.id === id; })[0] || D.temi[D.temi.length - 1]; }
    function nomeRichiesta(tipo) { return (TIPI_COTRAP.filter(function (t) { return t[0] === tipo; })[0] || ['', ''])[1]; }
    function grazie() { mostra(decidi, false); mostra(fatto, true); }
    function scriviIndirizzo() {
      var u = new URL(location.href);
      ['argomento', 'passo', 'tipo'].forEach(function (k) { u.searchParams.delete(k); });
      if (stato.passo > 1 && stato.tema && !stato.cerca) { u.searchParams.set('argomento', stato.tema); u.searchParams.set('passo', String(stato.passo)); }
      history.replaceState(null, '', u.pathname + u.search + u.hash);
    }
    function vai(n) {
      if (n > 1 && !stato.tema) n = 1;
      stato.passo = n;
      [p1, p2, p3].forEach(function (p, i) { mostra(p, i + 1 === n); });
      bottoniPassi.forEach(function (b, i) {
        b.disabled = i + 1 > n || (i > 0 && !stato.tema);
        if (i + 1 === n) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
      });
      if (n === 2) { mostra(decidi, true); mostra(fatto, false); }
      if (n === 3) preparaModulo();
      scriviIndirizzo();
      var t = [titolo1, titolo2, titolo3][n - 1];
      // torna all'inizio del percorso se si è scesi sotto (170 px: spazio della testata fissa del sito)
      var y = radice.getBoundingClientRect().top + window.scrollY - 170;
      if (window.scrollY > y) window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
      setTimeout(function () { t.focus({ preventScroll: true }); }, 50);
    }
    function mostraVoci(voci, apriPrima) {
      elenco.innerHTML = '';
      voci.forEach(function (x, i) { elenco.appendChild(voceDomanda(x, (apriPrima && i === 0) || voci.length === 1)); });
      mostra(nessuna, !voci.length);
    }
    function apriTema(id, passo) {
      var t = tema(id);
      stato.tema = t.id; stato.cerca = ''; stato.tipoModulo = null; cerca.value = '';
      titolo2.textContent = t.nome;
      var voci = D.domande.filter(function (x) { return x.temi[0] === t.id; }).concat(D.domande.filter(function (x) { return x.temi[0] !== t.id && x.temi.indexOf(t.id) > 0; }));
      mostraVoci(voci, false);
      vai(passo || 2);
    }
    function cercaDomanda(testo) {
      var voci = cercaDomande(D, testo);
      stato.cerca = testo; stato.tipoModulo = null;
      stato.tema = voci.length ? voci[0].temi[0] : 'viaggio';
      titolo2.textContent = 'Risposte per la tua domanda';
      mostraVoci(voci, true);
      vai(2);
    }
    function preparaModulo() {
      var t = tema(stato.tema), tipo = stato.tipoModulo || t.tipo;
      if (tipo === 'mycard') {
        titolo3.textContent = 'Assistenza My Card';
        richiesta.textContent = 'Per la tessera My Card risponde l’assistenza My Card: scrivi o chiama.';
        corpo3.innerHTML = ''; modulo = null;
        corpo3.appendChild(el('div', { class: 'pv-esito' }, [
          el('ul', { class: 'pv-recapiti' }, [
            riga('Richiesta online', collegamento('assistenza.tecbus.eu', 'https://assistenza.tecbus.eu/submit_ticket/next/tessere-elettroniche')),
            el('li', { text: 'Telefono e WhatsApp: 328 803 2801, dal lunedì al venerdì non festivi, dalle 9.00 alle 13.00' })]),
          el('p', { class: 'pv-piccolo' }, ['Per l’abbonamento o un’altra richiesta ',
            el('button', { type: 'button', class: 'pv-link', text: 'scrivici', onclick: function () { stato.tipoModulo = 'info'; preparaModulo(); } }), '.'])]));
        return;
      }
      titolo3.textContent = 'Scrivici';
      richiesta.textContent = 'Richiesta: ' + nomeRichiesta(tipo);
      if (modulo && modulo.tipo === tipo) return;   // stessa richiesta: restano i dati già scritti
      corpo3.innerHTML = '';
      var n = el('div', { 'data-prova': 'cotrap-pagina', 'data-avviata': '1' });
      corpo3.appendChild(n);
      ModuloCotrap(n, { completo: true, colonna: true, tipo: tipo, senzaRisposte: true });
      modulo = { tipo: tipo };
    }
    domande().then(function (dd) {
      D = dd;
      D.temi.forEach(function (t) {
        griglia.appendChild(el('button', { type: 'button', onclick: function () { apriTema(t.id); } },
          [el('i', { class: 'fa-solid ' + t.icona, 'aria-hidden': 'true' }), el('span', { text: t.nome })]));
      });
      // arrivo da un'altra pagina: ?argomento=…&passo=… oppure ?tipo=… (richiesta già scelta: si va al modulo)
      var u = new URL(location.href), a = u.searchParams.get('argomento'), tp = u.searchParams.get('tipo');
      if (a && D.temi.some(function (t) { return t.id === a; })) return apriTema(a, Math.min(3, Math.max(2, +u.searchParams.get('passo') || 2)));
      var t = tp && D.temi.filter(function (x) { return x.tipo === tp; })[0];
      if (t) { apriTema(t.id, 3); return; }
      vai(1);
    }).catch(function () {
      // senza risposte pronte resta il modulo
      titolo1.textContent = 'Scrivici';
      var n = el('div', { 'data-prova': 'cotrap-pagina', 'data-avviata': '1' }); p1.innerHTML = ''; p1.appendChild(n);
      ModuloCotrap(n, { completo: true, colonna: true }); mostra(passi, false);
    });
  }

  /* ---------- guida scelta vettore: il vettore dalla corsa ---------- */
  function TrovaVettore(radice) {
    radice.classList.add('pv', 'pv-guida');
    var domande = el('div'); radice.appendChild(domande);
    var esito = el('div', { class: 'pv-esito', hidden: true, 'aria-live': 'polite' }); radice.appendChild(esito);
    function scrivi(titolo, nodi) { esito.innerHTML = ''; esito.appendChild(blocco(titolo, nodi)); mostra(esito, true); }
    info();
    Trova(domande, function (s) {
      if (s.stato === 'trovato') info().then(function () {
        scrivi('Il tuo vettore', [nome(vettore(s.ids).n), sceltaMyCard(s.ids), doveComprare(s.ids), schedaVettore(s.ids)]);
      });
      else if (s.stato === 'biglietto') scrivi('Su questa tratta viaggiano più vettori',
        [el('ul', { class: 'pv-recapiti' }, s.gruppi.map(function (g) { return el('li', { text: vettore(g).n }); })), par('Scegli quello con cui viaggi più spesso.')]);
      else if (s.stato === 'sconosciuto') scrivi('Corsa non trovata', [el('p', {}, ['Scrivici dalla pagina ', collegamento('Contatti', 'contatti.html'), ': ti aiutiamo a trovare il vettore.'])]);
      else { esito.innerHTML = ''; mostra(esito, false); }
    });
  }

  /* ---------- modulo di sitasudtrasporti.it ---------- */
  var SEDI = [['bari', 'Bari (Puglia)', 'puglia'], ['foggia', 'Foggia (Puglia)', 'puglia'], ['potenza', 'Potenza (Basilicata)', 'basilicata'], ['matera', 'Matera (Basilicata)', 'basilicata'], ['salerno', 'Salerno (Campania)', 'campania']];
  var TIPI_SITA = [['info', 'Informazioni'], ['noleggio', 'Noleggio'], ['oggetto', 'Oggetto smarrito'], ['reclamo', 'Reclamo'], ['rimborso', 'Rimborso'], ['fattura', 'Richiesta di fattura']];
  var REGIONE = { puglia: 'Puglia', basilicata: 'Basilicata', campania: 'Campania' };
  function destinazioneSita(reg, tipo) {
    var R = REGIONE[reg];
    if (tipo === 'fattura') return 'Ufficio fatture SITA ' + R + ' · fatturazione.' + reg + '@sitasudtrasporti.it';
    if (tipo === 'reclamo') return reg === 'campania' ? 'Ufficio reclami SITA Campania · reclami.campania@sitasudtrasporti.it' : 'Ufficio reclami SITA ' + R;
    if (tipo === 'rimborso') return 'Ufficio rimborsi SITA ' + R;
    if (tipo === 'oggetto' && reg === 'campania') return 'Ufficio clienti SITA Campania · clienti.campania@sitasudtrasporti.it';
    return 'Ufficio informazioni SITA ' + R + ' · info.' + reg + '@sitasudtrasporti.it';
  }
  function regoleSita(reg, tipo) {
    if (tipo === 'rimborso' && reg === 'puglia') return ['Hai diritto al rimborso solo se la corsa è cancellata o parte con più di 60 minuti di ritardo (30 minuti in città). Non vale in caso di scioperi, calamità ed emergenze imprevedibili.', 'Il biglietto online non usato non si rimborsa.'];
    if (tipo === 'rimborso' && reg === 'basilicata') return ['Per le linee statali: il biglietto si annulla almeno 48 ore prima della partenza, con una penale del 25%.', 'Nessun rimborso per i biglietti comprati il giorno prima o il giorno stesso, o già cambiati di data. I rimborsi approvati sono gestiti entro 15 giorni lavorativi.'];
    if (tipo === 'fattura' && reg !== 'campania') return ['Chiedi la fattura entro le 23:59 del giorno dell’acquisto.'];
    return null;
  }

  function ModuloSemplice(radice, cfg) {
    radice.classList.add('pv'); if (cfg.classe) radice.classList.add(cfg.classe);
    var sx = el('div'), dx = el('div');
    radice.appendChild(el('div', { class: 'pv-griglia' }, [sx, dx]));
    if (cfg.titolo) sx.appendChild(el('h2', { class: 'pv-titolo', text: cfg.titolo }));
    var controlli = cfg.scelte.map(function (s) { var sel = scelta(s.voci, 'Scegli…'); sx.appendChild(campo(s.etichetta, sel)); return sel; });
    var extra = el('div'); sx.appendChild(extra);
    var bDati = el('div', { hidden: true }); sx.appendChild(bDati);
    var attesa = el('p', { class: 'pv-attesa', text: 'Qui compare l’ufficio a cui arriva la richiesta.' });
    var esito = el('div', { class: 'pv-esito', hidden: true, 'aria-live': 'polite' });
    dx.appendChild(attesa); dx.appendChild(esito);

    function valori() { return controlli.map(function (c) { return c.value; }); }
    function aggiorna() {
      var v = valori();
      extra.innerHTML = ''; bDati.innerHTML = '';
      if (v.some(function (x) { return !x; })) { mostra(bDati, false); mostra(esito, false); mostra(attesa, true); return; }
      var r = cfg.risolvi(v, extra);
      esito.innerHTML = '';
      esito.appendChild(blocco('La richiesta va a', [nome(r.destinazione)].concat((r.note || []).map(par))));
      mostra(attesa, false); mostra(esito, true);
      if (r.regole) bDati.appendChild(el('div', { class: 'pv-regole' }, [el('b', { text: 'Prima di inviare' })].concat(r.regole.map(par))));
      bDati.appendChild(el('p', { class: 'pv-passo', text: 'I tuoi dati' }));
      cfg.campi(v, bDati);
      bDati.appendChild(el('div', { class: 'pv-campo' }, [el('label', { class: 'pv-spunta' }, [el('input', { type: 'checkbox' }), ' Ho letto l’',
        collegamento('informativa sulla privacy', cfg.privacy)])]));
      bDati.appendChild(el('button', { type: 'button', class: 'pv-invia', text: 'Simula invio', onclick: function () {
        esito.innerHTML = '';
        var destinazione = cfg.risolvi(valori(), null).destinazione;
        esito.appendChild(el('div', { class: 'pv-conferma' }, [el('h3', { text: 'Esempio di conferma' }),
          par('Destinatario della richiesta: ' + destinazione + (/\.$/.test(destinazione) ? '' : '.')),
          par('Sul sito attivo il cliente riceve il numero della richiesta per email. Questa prova non invia messaggi.'),
          el('button', { type: 'button', class: 'pv-link', text: 'Nuova richiesta', onclick: function () { controlli.forEach(function (c) { c.value = ''; }); aggiorna(); } })]));
        mostra(bDati, false);
      } }));
      mostra(bDati, true);
    }
    controlli.forEach(function (c) { c.addEventListener('change', aggiorna); });
  }

  function datiPersona(box) {
    box.appendChild(el('div', { class: 'pv-due' }, [campo('Nome', testo()), campo('Cognome', testo())]));
    box.appendChild(el('div', { class: 'pv-due' }, [campo('Email', testo('email')), campo('Telefono', testo('tel'), true)]));
  }
  function datiViaggio(box, conFoto) {
    box.appendChild(el('div', { class: 'pv-due' }, [campo('Partenza', testo()), campo('Arrivo', testo())]));
    box.appendChild(el('div', { class: 'pv-due' }, [campo('Giorno del viaggio', testo('date')), campo('Ora della corsa', testo('time'))]));
    if (conFoto) box.appendChild(campo('Foto del biglietto', file()));
  }

  function ModuloSita(radice) {
    ModuloSemplice(radice, {
      classe: 'pv-sita',
      privacy: 'https://sitasudtrasporti.it/privacy-policy/',
      scelte: [{ etichetta: 'Sede', voci: SEDI.map(function (s) { return [s[0], s[1]]; }) }, { etichetta: 'Di cosa hai bisogno?', voci: TIPI_SITA }],
      risolvi: function (v) {
        var reg = SEDI.filter(function (s) { return s[0] === v[0]; })[0][2];
        return { destinazione: destinazioneSita(reg, v[1]), regole: regoleSita(reg, v[1]) };
      },
      campi: function (v, box) {
        var tipo = v[1];
        if (tipo === 'fattura') {
          box.appendChild(campo('Nome e cognome o ragione sociale', testo()));
          box.appendChild(el('div', { class: 'pv-due' }, [campo('Codice fiscale o partita IVA', testo()), campo('Indirizzo', testo())]));
          box.appendChild(el('div', { class: 'pv-due' }, [campo('Email', testo('email')), campo('PEC o codice destinatario', testo(), true)]));
          box.appendChild(campo('Numero del biglietto', testo()));
          box.appendChild(campo('Copia del biglietto', file()));
          return;
        }
        datiPersona(box);
        if (tipo === 'rimborso') {
          box.appendChild(campo('Codice del biglietto', testo()));
          datiViaggio(box, true);
          box.appendChild(el('div', { class: 'pv-due' }, [campo('IBAN', testo()), campo('Intestatario del conto', testo())]));
        } else if (tipo === 'reclamo' || tipo === 'oggetto') {
          datiViaggio(box, tipo === 'reclamo');
        }
        box.appendChild(campo('Messaggio', area()));
      }
    });
  }

  /* ---------- modulo di marozzivt.it ---------- */
  var TIPI_MAROZZI = [['info', 'Informazioni'], ['reclamo', 'Reclamo'], ['rimborso', 'Rimborso di un biglietto Marozzi'], ['rimborso-sita', 'Rimborso SITA Basilicata (linee statali)'],
    ['bagaglio', 'Bagaglio perso'], ['oggetto', 'Oggetto smarrito'], ['noleggio', 'Noleggio'], ['fattura', 'Richiesta di fattura']];
  var FATTURA_MAROZZI = { marozzi: ['Marozzi', 'Ufficio fatture Marozzi · fatturazione@marozzivt.it'], cotrap: ['COTRAP', 'Ufficio fatture COTRAP'],
    basilicata: ['SITA Basilicata', 'Ufficio fatture SITA Basilicata · fatturazione.basilicata@sitasudtrasporti.it'], campania: ['SITA Campania (Salerno)', 'Ufficio fatture SITA Campania · fatturazione.campania@sitasudtrasporti.it'] };
  function ModuloMarozzi(radice) {
    var selVettore = null;
    ModuloSemplice(radice, {
      classe: 'pv-marozzi',
      privacy: 'https://www.marozzivt.it/informativa-sulla-privacy/',
      scelte: [{ etichetta: 'Di cosa hai bisogno?', voci: TIPI_MAROZZI }],
      risolvi: function (v, extra) {
        var t = v[0];
        if (t === 'fattura') {
          if (extra) {
            selVettore = scelta(Object.keys(FATTURA_MAROZZI).map(function (k) { return [k, FATTURA_MAROZZI[k][0]]; }), null);
            extra.appendChild(campo('Vettore del biglietto', selVettore));
            selVettore.addEventListener('change', function () { var n = radice.querySelector('.pv-esito .pv-nome'); if (n) n.textContent = FATTURA_MAROZZI[selVettore.value][1]; });
          }
          return { destinazione: FATTURA_MAROZZI[selVettore ? selVettore.value : 'marozzi'][1] };
        }
        var d = { info: 'info@marozzivt.it', reclamo: 'reclami@marozzivt.it', rimborso: 'Ufficio rimborsi Marozzi · rimborsi@marozzivt.it',
          'rimborso-sita': 'Ufficio rimborsi SITA Basilicata', bagaglio: 'reclami@marozzivt.it', oggetto: 'info@marozzivt.it', noleggio: 'noleggi@marozzivt.it' }[t];
        return { destinazione: d, regole: t === 'rimborso-sita' ? regoleSita('basilicata', 'rimborso') : null };
      },
      campi: function (v, box) {
        var t = v[0];
        if (t === 'fattura') {
          box.appendChild(campo('Tipologia', scelta([['ditta', 'Ditta o società'], ['professionista', 'Professionista'], ['persona', 'Persona fisica']], null)));
          box.appendChild(el('div', { class: 'pv-due' }, [campo('Partita IVA o codice fiscale', testo()), campo('Indirizzo', testo())]));
          box.appendChild(el('div', { class: 'pv-due' }, [campo('Email', testo('email')), campo('PEC', testo('email'), true)]));
          box.appendChild(el('div', { class: 'pv-due' }, [campo('Codice SDI', testo(), true), campo('Numeri dei biglietti', testo())]));
          return;
        }
        datiPersona(box);
        if (t === 'rimborso') {
          var lista = el('div'); box.appendChild(lista);
          var aggiungi = function () {
            var n = lista.children.length + 1; if (n > 5) return;
            var b = el('div', { class: 'pv-biglietti' }, [el('p', { class: 'pv-passo', text: 'Biglietto ' + n })]);
            b.appendChild(el('div', { class: 'pv-due' }, [campo('Codice del biglietto', testo()), campo('Data del viaggio', testo('date'))]));
            b.appendChild(el('div', { class: 'pv-due' }, [campo('Partenza', testo()), campo('Arrivo', testo())]));
            b.appendChild(el('div', { class: 'pv-due' }, [campo('Prezzo', testo()), campo('File del biglietto', file())]));
            lista.appendChild(b);
            if (n === 5) altro.hidden = true;
          };
          var altro = el('button', { type: 'button', class: 'pv-link', text: 'Aggiungi un altro biglietto (fino a 5)', onclick: function () { aggiungi(); } });
          aggiungi(); box.appendChild(el('p', {}, [altro]));
          var modo = scelta([['bonifico', 'Bonifico'], ['vaglia', 'Vaglia postale'], ['estero', 'Bonifico estero']], null);
          box.appendChild(campo('Modalità di rimborso', modo));
          var banca = el('div', { class: 'pv-due' }, [campo('IBAN', testo()), campo('Intestatari del conto', testo())]);
          box.appendChild(banca);
          modo.addEventListener('change', function () { banca.hidden = modo.value === 'vaglia'; });
          return;
        }
        if (t === 'rimborso-sita' || t === 'reclamo' || t === 'bagaglio') {
          box.appendChild(campo('Codice del biglietto', testo()));
          datiViaggio(box, t !== 'bagaglio');
        }
        if (t === 'rimborso-sita') box.appendChild(el('div', { class: 'pv-due' }, [campo('IBAN', testo()), campo('Intestatario del conto', testo())]));
        box.appendChild(campo('Messaggio', area()));
      }
    });
  }

  /* ---------- scheda dei dati di un consorziato: le stesse voci del questionario (studio/script/questionario-vettori.py) ---------- */
  function SchedaAzienda(radice) {
    radice.classList.add('pv');
    var sx = el('div'), dx = el('div');
    radice.appendChild(el('div', { class: 'pv-griglia' }, [sx, dx]));
    sx.appendChild(el('h2', { class: 'pv-titolo', text: 'Aggiorna i dati dell’azienda' }));
    var sel = scelta([], 'Caricamento…');
    sx.appendChild(campo('Azienda consorziata', sel));
    var corpo = el('div', { hidden: true }); sx.appendChild(corpo);
    var attesa = el('p', { class: 'pv-attesa', text: 'Qui compare la scheda aggiornata.' });
    var anteprima = el('div', { hidden: true }); dx.appendChild(attesa); dx.appendChild(anteprima);
    var elenco = [];
    // voci pubblicate nella pagina Aziende consorziate
    var GRUPPI = [
      ['Recapiti per i clienti', [['t', 'Telefono per i clienti'], ['o', 'Giorni e orari del telefono'], ['w', 'WhatsApp'], ['e', 'Email per i clienti'],
        ['u', 'Biglietteria o ufficio aperto al pubblico: indirizzo e orari'], ['s', 'Sito']]],
      ['Biglietti e abbonamenti', [['v', 'Punti vendita: collegamento o elenco'], ['p', 'Titoli di viaggio e prezzi: collegamento'], ['k', 'Tessera per l’abbonamento']]],
      ['Assistenza', [['b', 'Rimborsi: dove li chiede il cliente di persona'], ['x', 'Oggetti smarriti: dove e quando'],
        ['d', 'Persone con disabilità: dove si ritirano i biglietti gratuiti']]]];
    // voci per COTRAP, non pubblicate
    var INTERNI = [['r', 'Casella che riceve i reclami inoltrati da COTRAP'], ['a', 'Casella per gli avvisi e le comunicazioni di COTRAP']];
    var CAMPI = [].concat.apply([], GRUPPI.map(function (g) { return g[1]; })).concat(INTERNI);
    var input = {};
    function trova(n) { return elenco.findIndex(function (x) { return x.n === n || (x.vn || []).indexOf(n) >= 0; }); }
    json('dati/aziende-scheda.json').then(function (a) {
      elenco = a;
      opzioni(sel, a.map(function (x, i) { return [String(i), x.n]; }), 'Scegli l’azienda…');
      var q = /[?&]azienda=([^&]+)/.exec(location.search);
      if (q) { var i = trova(decodeURIComponent(q[1])); if (i >= 0) { sel.value = String(i); apri(); } }
    });
    function voce(c, az) {
      var i = testo('text');
      i.value = az[c[0]] || ''; i.setAttribute('data-prima', az[c[0]] || '');
      if (!i.value) i.placeholder = 'Non indicato';
      input[c[0]] = i; return campo(c[1], i);
    }
    function apri() {
      corpo.innerHTML = ''; anteprima.innerHTML = ''; mostra(anteprima, false); mostra(attesa, true);
      if (!sel.value) { mostra(corpo, false); return; }
      var az = elenco[+sel.value];
      GRUPPI.forEach(function (g) {
        corpo.appendChild(el('p', { class: 'pv-passo', text: g[0] }));
        g[1].forEach(function (c) { corpo.appendChild(voce(c, az)); });
      });
      corpo.appendChild(el('p', { class: 'pv-passo', text: 'Per COTRAP, non pubblicati' }));
      corpo.appendChild(el('p', { class: 'pv-piccolo', text: 'Questi dati servono solo alle comunicazioni tra COTRAP e l’azienda e all’inoltro delle richieste dei clienti: non vengono pubblicati. Indica caselle d’ufficio, non personali.' }));
      var si = el('input', { type: 'radio', name: 'modulo-cotrap', value: 'si' }), no = el('input', { type: 'radio', name: 'modulo-cotrap', value: 'no' });
      corpo.appendChild(el('fieldset', { class: 'pv-campo' }, [el('legend', { text: 'L’azienda vuole ricevere da COTRAP le richieste dei clienti sulle sue corse?' }),
        el('div', { class: 'pv-radio' }, [el('label', {}, [si, ' Sì']), el('label', {}, [no, ' No'])])]));
      var casella = testo('email'); var bCasella = campo('Casella che riceve le richieste', casella); bCasella.hidden = true; corpo.appendChild(bCasella);
      [si, no].forEach(function (r) { r.addEventListener('change', function () { bCasella.hidden = !si.checked; }); });
      INTERNI.forEach(function (c) { corpo.appendChild(voce(c, az)); });
      corpo.appendChild(el('button', { type: 'button', class: 'pv-invia', text: 'Conferma i dati', onclick: function () { conferma(az, si.checked ? casella.value : null); } }));
      mostra(corpo, true);
    }
    function conferma(az, casella) {
      anteprima.innerHTML = '';
      var oggi = new Date().toLocaleDateString('it-IT');
      var scheda = el('div', { class: 'pv-esito' }, [el('h3', { text: 'Scheda su cotrap.it' }), nome(az.n)]);
      var vuota = true;
      GRUPPI.forEach(function (g) {
        var ul = el('ul', { class: 'pv-recapiti' });
        g[1].forEach(function (c) { var v = input[c[0]].value.trim(); if (v) ul.appendChild(el('li', { text: c[1] + ': ' + v })); });
        if (ul.children.length) { vuota = false; scheda.appendChild(el('p', { class: 'pv-passo', style: 'margin-top:12px', text: g[0] })); scheda.appendChild(ul); }
      });
      if (vuota) scheda.appendChild(par('Nessun dato indicato.'));
      scheda.appendChild(el('p', { class: 'pv-piccolo', text: 'Dati confermati dall’azienda il ' + oggi + '.' }));
      anteprima.appendChild(scheda);
      var cambi = el('ul', { class: 'pv-recapiti' });
      CAMPI.forEach(function (c) {
        var prima = input[c[0]].getAttribute('data-prima'), dopo = input[c[0]].value.trim();
        if (prima !== dopo) cambi.appendChild(el('li', { text: c[1] + ': «' + (prima || 'non indicato') + '» → «' + (dopo || 'non indicato') + '»' }));
      });
      if (casella) cambi.appendChild(el('li', { text: 'Richieste dal modulo di cotrap.it: a ' + casella }));
      if (!cambi.children.length) cambi.appendChild(el('li', { text: 'Nessuna modifica: dati confermati.' }));
      anteprima.appendChild(el('div', { class: 'pv-esito', style: 'margin-top:14px' }, [el('h3', { text: 'Registro delle modifiche · ' + oggi }), cambi]));
      mostra(attesa, false); mostra(anteprima, true);
    }
    sel.addEventListener('change', apri);
    return { scegli: function (n) { var i = trova(n); if (i >= 0) { sel.value = String(i); apri(); sel.scrollIntoView({ behavior: 'smooth', block: 'center' }); } } };
  }

  /* ---------- elenco dei vettori della pagina Titoli di viaggio: ricerca per nome ---------- */
  function ElencoVettori(d) {
    var voci = [].slice.call(d.querySelectorAll('.pv-vettori-elenco > li'));
    var nessuno = d.querySelector('.pv-vettori-nessuno');
    var corpo = d.querySelector('.pv-vettori-corpo');
    function norma(s) { return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); }
    function contiene(testo, parole) {
      var voci = testo.split(' ').filter(Boolean);
      return parole.every(function (p) { return voci.some(function (v) { return v.indexOf(p) === 0; }); });
    }
    var cerca = el('input', { type: 'search', placeholder: 'Cerca il vettore', 'aria-label': 'Cerca il vettore', autocomplete: 'off' });
    cerca.addEventListener('input', function () {
      var parole = norma(cerca.value).split(' ').filter(Boolean), n = 0;
      voci.forEach(function (li) { var si = contiene(norma(li.getAttribute('data-cerca')), parole); li.hidden = !si; if (si) n += 1; });
      nessuno.hidden = n > 0;
    });
    corpo.insertBefore(el('div', { class: 'pv-vettori-ricerca' }, [el('i', { class: 'fa-solid fa-magnifying-glass', 'aria-hidden': 'true' }), cerca]), corpo.firstChild);
    // chi arriva da «punti vendita del tuo vettore» trova l'elenco già aperto
    function apri() { if (/^#(altri-vettori|elenco-vettori)$/.test(location.hash)) d.open = true; }
    apri();
    window.addEventListener('hashchange', apri);
  }

  /* ---------- aziende consorziate: ricerca per nome o comune; il collegamento #vettore apre la sua scheda ---------- */
  function Aziende(radice) {
    var voci = [].slice.call(radice.querySelectorAll('.pv-az'));
    var nessuno = radice.querySelector('.pv-aziende-nessuno');
    var conta = radice.querySelector('.pv-aziende-conta');
    var tutte = conta ? conta.textContent : '';
    function norma(s) { return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); }
    var testi = voci.map(function (li) { return norma(li.getAttribute('data-cerca')).split(' ').filter(Boolean); });
    var cerca = el('input', { type: 'search', placeholder: 'Cerca per nome del vettore o per comune', 'aria-label': 'Cerca per nome del vettore o per comune', autocomplete: 'off' });
    cerca.addEventListener('input', function () {
      var parole = norma(cerca.value).split(' ').filter(Boolean), n = 0;
      voci.forEach(function (li, i) {
        var si = parole.every(function (p) { return testi[i].some(function (v) { return v.indexOf(p) === 0; }); });
        li.hidden = !si; if (si) n += 1;
      });
      if (nessuno) nessuno.hidden = n > 0;
      if (conta) conta.textContent = parole.length ? (n === 1 ? '1 vettore trovato' : n + ' vettori trovati') : tutte;
    });
    radice.insertBefore(el('div', { class: 'pv-vettori-ricerca pv-aziende-ricerca' }, [el('i', { class: 'fa-solid fa-magnifying-glass', 'aria-hidden': 'true' }), cerca]), radice.firstChild);
    function apri() {
      var id = decodeURIComponent(location.hash.slice(1));
      var li = id && document.getElementById(id);
      if (!li || !li.classList.contains('pv-az')) return;
      voci.forEach(function (v) { v.classList.remove('pv-az-scelta'); });
      var d = li.querySelector('details'); if (d) d.open = true;
      li.classList.add('pv-az-scelta');
      li.scrollIntoView({ block: 'start' });
    }
    apri();
    window.addEventListener('hashchange', apri);
    window.addEventListener('load', function () { setTimeout(apri, 60); });   // dopo immagini e caratteri la posizione cambia
  }

  /* ---------- questionario online per i vettori: per ogni voce «dati che abbiamo» e la correzione ---------- */
  // le risposte della prova restano solo nella pagina aperta
  var risposteDellaSessione = [];
  function tutteLeRisposte() { return risposteDellaSessione; }
  function testoDato(v) { return Array.isArray(v) ? v.join(' · ') : (v || ''); }

  function Questionario(radice) {
    radice.classList.add('pv', 'pv-questionario');
    json('dati/questionario.json').then(function (Q) {
      radice.innerHTML = '';
      var sel = scelta(Q.aziende.map(function (a) { return [a.id, a.nome]; }), 'Scegli il vettore…');
      radice.appendChild(el('div', { class: 'pv-q-link' }, [campo('Scegli un vettore per la prova', sel)]));
      var corpo = el('div'); radice.appendChild(corpo);
      function apri() {
        corpo.innerHTML = '';
        var az = Q.aziende.filter(function (a) { return a.id === sel.value; })[0];
        if (!az) return;
        var input = {};
        corpo.appendChild(el('p', { class: 'pv-q-intro' }, [el('b', { text: az.nome }), ': per ogni voce trovi i dati che abbiamo. Se sono giusti lascia vuoto; se no, scrivi la correzione.']));
        Q.sezioni.forEach(function (s) {
          var box = el('fieldset', { class: 'pv-q-sezione' }, [el('legend', { text: s.lettera + '. ' + s.titolo })]);
          if (s.nota) box.appendChild(el('p', { class: 'pv-piccolo', text: s.nota }));
          s.campi.forEach(function (c) {
            var abbiamo = testoDato(az.dati[c.id]);
            var voce = el('div', { class: 'pv-q-voce' }, [el('div', { class: 'pv-q-nome' }, [el('b', { text: c.voce }),
              c.aiuto ? el('span', { text: c.aiuto }) : null, !c.pubblico && s.lettera !== 'H' ? el('em', { text: 'non pubblicato' }) : null])]);
            if (s.lettera !== 'H') voce.appendChild(el('p', { class: 'pv-q-abbiamo' + (abbiamo ? '' : ' pv-q-vuoto'), text: abbiamo ? 'Dati che abbiamo: ' + abbiamo : (c.pubblico ? 'Non lo abbiamo' : 'Indicate il dato aggiornato') }));
            var ctrl;
            if (c.scelte) {
              var nomeR = 'q-' + c.id;
              ctrl = el('div', { class: 'pv-radio' }, c.scelte.map(function (x) { return el('label', {}, [el('input', { type: 'radio', name: nomeR, value: x }), ' ' + x]); }));
              ctrl.valore = function () { var r = ctrl.querySelector('input:checked'); return r ? r.value : ''; };
            } else {
              ctrl = testo(c.id === 'ref_email' ? 'email' : (c.id === 'ref_tel' ? 'tel' : 'text'));
              ctrl.setAttribute('placeholder', s.lettera === 'H' ? '' : 'Correzione o dato mancante');
              ctrl.setAttribute('aria-label', c.voce);
              ctrl.valore = function () { return ctrl.value.trim(); };
            }
            input[c.id] = { campo: c, prima: abbiamo, ctrl: ctrl, sezione: s.lettera };
            voce.appendChild(ctrl);
            box.appendChild(voce);
          });
          corpo.appendChild(box);
        });
        var note = area(); corpo.appendChild(campo('Note', note, true));
        var ok = el('input', { type: 'checkbox' });
        corpo.appendChild(el('div', { class: 'pv-campo' }, [el('label', { class: 'pv-spunta' }, [ok,
          ' Confermo i dati e autorizzo COTRAP a pubblicare su cotrap.it quelli destinati ai clienti, dopo la verifica delle risposte. Le voci «non pubblicato» e i dati del referente restano riservati.'])]));
        var avviso = el('p', { class: 'pv-q-avviso', hidden: true, text: 'Per registrare la prova, conferma i dati.' });
        var avvisoReferente = el('p', { class: 'pv-q-avviso', hidden: true, text: 'Inserisci nome ed email validi del referente.' });
        corpo.appendChild(avviso);
        corpo.appendChild(avvisoReferente);
        corpo.appendChild(el('p', { class: 'pv-piccolo', text: 'I dati del referente servono solo alle comunicazioni tra COTRAP e l’azienda e non vengono pubblicati. Per cambiare i dati in futuro scrivete a info@cotrap.it.' }));
        corpo.appendChild(el('button', { type: 'button', class: 'pv-invia', text: 'Registra nella prova', onclick: function () {
          if (!ok.checked) { mostra(avviso, true); return; }
          if (!input.ref_nome.ctrl.valore() || !input.ref_email.ctrl.valore() || !input.ref_email.ctrl.checkValidity()) {
            mostra(avvisoReferente, true);
            (input.ref_nome.ctrl.valore() ? input.ref_email.ctrl : input.ref_nome.ctrl).focus();
            return;
          }
          var correzioni = [], referente = {}, scelte = {};
          Object.keys(input).forEach(function (k) {
            var x = input[k], v = x.ctrl.valore();
            if (!v) return;
            if (x.sezione === 'H') referente[x.campo.voce] = v;
            else if (x.campo.scelte) scelte[x.campo.voce] = v;
            else correzioni.push({ voce: x.campo.voce, prima: x.prima, dopo: v });
          });
          var r = { vettore: az.nome, data: new Date().toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' }), referente: referente,
            correzioni: correzioni, scelte: scelte, note: note.value.trim() };
          var vociCompilate = correzioni.length + Object.keys(scelte).length;
          risposteDellaSessione.unshift(r);
          window.dispatchEvent(new Event('pv-risposte'));
          corpo.innerHTML = '';
          corpo.appendChild(el('div', { class: 'pv-conferma' }, [el('h3', { text: 'Risposta aggiunta alla prova' }),
            par(vociCompilate ? vociCompilate + (vociCompilate === 1 ? ' voce compilata' : ' voci compilate') + ' nell’archivio qui sotto.' : 'Dati confermati nell’archivio qui sotto.'),
            par('La prova non invia email e si svuota quando chiudi o ricarichi la pagina.'),
            el('button', { type: 'button', class: 'pv-link', text: 'Compila per un altro vettore', onclick: function () { sel.value = ''; apri(); sel.focus(); } })]));
        } }));
      }
      sel.addEventListener('change', apri);
      var q = /[?&](?:v|vettore)=([^&]+)/.exec(location.search);
      sel.value = q ? decodeURIComponent(q[1]) : 'miccolis';
      apri();
    });
  }

  function Risposte(radice) {
    radice.classList.add('pv', 'pv-risposte');
    function csv() {
      var righe = [['Vettore', 'Inviato', 'Voce', 'Prima', 'Dopo']];
      tutteLeRisposte().forEach(function (r) {
        var inizio = righe.length;
        r.correzioni.forEach(function (c) { righe.push([r.vettore, r.data, c.voce, c.prima, c.dopo]); });
        Object.keys(r.scelte).forEach(function (k) { righe.push([r.vettore, r.data, k, '', r.scelte[k]]); });
        Object.keys(r.referente).forEach(function (k) { righe.push([r.vettore, r.data, 'Referente: ' + k, '', r.referente[k]]); });
        if (r.note) righe.push([r.vettore, r.data, 'Note', '', r.note]);
        if (righe.length === inizio) righe.push([r.vettore, r.data, 'Dati confermati', '', '']);
      });
      var testoCsv = righe.map(function (x) { return x.map(function (c) {
        var valore = String(c);
        if (/^[\s]*[=+@-]/.test(valore)) valore = "'" + valore;
        return '"' + valore.replace(/"/g, '""') + '"';
      }).join(';'); }).join('\r\n');
      var url = URL.createObjectURL(new Blob(['﻿' + testoCsv], { type: 'text/csv' }));
      var a = el('a', { href: url, download: 'risposte-questionario.csv' });
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    }
    function disegna() {
      radice.innerHTML = '';
      var a = tutteLeRisposte();
      var t = el('table', { class: 'pv-tab' }, [el('tr', {}, ['Vettore', 'Registrato', 'Referente', 'Voci compilate', 'Risposta'].map(function (x) { return el('th', { text: x }); }))]);
      if (!a.length) {
        t.appendChild(el('tr', {}, [el('td', { colspan: '5', text: 'Nessuna risposta nella prova. Le risposte registrate qui sopra compariranno in questa tabella.' })]));
        radice.appendChild(el('div', { class: 'tab-scroll' }, [t]));
        return;
      }
      a.forEach(function (r) {
        var ref = r.referente['Nome e cognome'] || '—';
        var idDettaglio = uid('risposta');
        var apriRisposta = el('button', { type: 'button', class: 'pv-link', text: 'Vedi', 'aria-controls': idDettaglio, 'aria-expanded': 'false' });
        var riga = el('tr', {}, [el('td', {}, [el('b', { text: r.vettore })]), el('td', { text: r.data }), el('td', { text: ref }), el('td', { text: String(r.correzioni.length + Object.keys(r.scelte).length) }), el('td', {}, [apriRisposta])]);
        var det = el('tr', { hidden: true, id: idDettaglio }, [el('td', { colspan: '5' }, [
          r.correzioni.length ? el('ul', { class: 'pv-recapiti' }, r.correzioni.map(function (c) { return el('li', {}, [el('b', { text: c.voce + ': ' }), (c.prima ? '«' + c.prima + '» → ' : '') + '«' + c.dopo + '»']); })) : par('Nessuna correzione: dati confermati.'),
          Object.keys(r.scelte).length ? el('ul', { class: 'pv-recapiti' }, Object.keys(r.scelte).map(function (k) { return el('li', {}, [el('b', { text: k + ': ' }), r.scelte[k]]); })) : null,
          Object.keys(r.referente).length ? el('div', {}, [el('b', { text: 'Referente' }), el('ul', { class: 'pv-recapiti' }, Object.keys(r.referente).map(function (k) { return el('li', {}, [el('b', { text: k + ': ' }), r.referente[k]]); }))]) : null,
          r.note ? par('Note: ' + r.note) : null])]);
        function apriChiudi() { det.hidden = !det.hidden; apriRisposta.textContent = det.hidden ? 'Vedi' : 'Chiudi'; apriRisposta.setAttribute('aria-expanded', String(!det.hidden)); }
        apriRisposta.addEventListener('click', apriChiudi);
        t.appendChild(riga); t.appendChild(det);
      });
      radice.appendChild(el('div', { class: 'tab-scroll' }, [t]));
      radice.appendChild(el('p', { class: 'pv-q-azioni' }, [el('button', { type: 'button', class: 'pv-link', text: 'Scarica CSV', onclick: csv }), ' · ',
        el('button', { type: 'button', class: 'pv-link', text: 'Cancella le prove', onclick: function () { risposteDellaSessione = []; disegna(); } })]));
    }
    disegna();
    window.addEventListener('pv-risposte', disegna);
  }

  /* ---------- i collegamenti restano dentro la proposta ---------- */
  var avviso = null, tempo = null;
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || a.hasAttribute('data-esterno')) return;   // pagine dei siti dei vettori: si aprono in una scheda nuova
    var h = a.getAttribute('href') || '';
    if (!a.hasAttribute('data-fuori') && !/^(https?:|mailto:|tel:)/i.test(h)) return;
    e.preventDefault();
    if (!avviso) { avviso = el('div', { class: 'pv-avviso', role: 'status' }); document.body.appendChild(avviso); }
    avviso.textContent = 'Collegamento non attivo nella proposta.';
    avviso.classList.add('pv-avviso-su');
    clearTimeout(tempo); tempo = setTimeout(function () { avviso.classList.remove('pv-avviso-su'); }, 2200);
  }, true);

  /* ---------- avvio ---------- */
  var MODULI = { 'cotrap-prova': function (n) { ModuloCotrap(n, {}); }, 'cotrap-completo': function (n) { ModuloCotrap(n, { completo: true }); },
    'cotrap-pagina': function (n) { ModuloCotrap(n, { completo: true, colonna: true }); },
    'trova-vettore': TrovaVettore, 'domande': Domande, 'assistenza': Assistenza, 'aziende': Aziende, 'questionario': Questionario, 'risposte': Risposte, 'sita': ModuloSita, 'marozzi': ModuloMarozzi, 'scheda': function (n) { window.schedaAzienda = SchedaAzienda(n); } };
  function avvia() {
    document.querySelectorAll('[data-prova]').forEach(function (n) { var f = MODULI[n.getAttribute('data-prova')]; if (f && !n.getAttribute('data-avviata')) { n.setAttribute('data-avviata', '1'); f(n); } });
    document.querySelectorAll('details.pv-vettori').forEach(function (d) { if (!d.getAttribute('data-avviata')) { d.setAttribute('data-avviata', '1'); ElencoVettori(d); } });
    document.querySelectorAll('[data-scegli-azienda]').forEach(function (b) { b.addEventListener('click', function () { if (window.schedaAzienda) window.schedaAzienda.scegli(b.getAttribute('data-scegli-azienda')); }); });
    document.querySelectorAll('.schede-siti').forEach(function (g) {
      var bottoni = g.querySelectorAll('button');
      bottoni.forEach(function (b) { b.addEventListener('click', function () {
        bottoni.forEach(function (x) { x.setAttribute('aria-selected', x === b ? 'true' : 'false'); document.getElementById(x.getAttribute('aria-controls')).hidden = x !== b; });
      }); });
    });
  }
  window.proveAvvia = avvia;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', avvia); else avvia();
})();
