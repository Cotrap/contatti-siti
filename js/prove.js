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

  /* ---------- dati della biglietteria (tratte e fermate) ---------- */
  var dati = { base: null, tratte: {} };
  function json(p) { return fetch(BASE + p).then(function (r) { if (!r.ok) throw new Error(p); return r.json(); }); }
  function base() { return dati.base ? Promise.resolve(dati.base) : json('dati/vettori/base.json').then(function (b) { dati.base = b; return b; }); }
  function tratte(c) {
    return dati.tratte[c] ? Promise.resolve(dati.tratte[c]) : json('dati/vettori/t/' + encodeURIComponent(c) + '.json').then(function (d) { dati.tratte[c] = d; return d; });
  }
  // SITA SUD ha più numeri in biglietteria: per il cliente è un solo vettore
  function gruppi(ids) {
    var g = {};
    ids.forEach(function (id) { var n = dati.base.vettori[id].n; (g[n] = g[n] || []).push(String(id)); });
    return Object.keys(g).sort().map(function (n) { return g[n]; });
  }
  function vettore(ids) { return dati.base.vettori[ids[0]]; }
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
    ['online', 'Problemi con la biglietteria online o l’app'],
    ['mycard', 'Tessera My Card']
  ];
  var CON_CORSA = ['info', 'rimborso', 'oggetto', 'reclamo'];
  var REGOLE_COTRAP = {
    rimborso: ['Hai diritto al rimborso se la corsa è cancellata o parte con più di 60 minuti di ritardo (30 minuti in città). Non vale in caso di scioperi, calamità ed emergenze imprevedibili.', 'Puoi chiederlo anche durante il viaggio o subito dopo, mostrando il biglietto o l’abbonamento.'],
    reclamo: ['Puoi presentare il reclamo entro 3 mesi dal viaggio.']
  };

  function destinazioneCotrap(tipo, ids) {
    if (tipo === 'fattura') return { nome: 'Ufficio fatture COTRAP' };
    if (tipo === 'online' || tipo === 'generiche') return { nome: 'info@cotrap.it' };
    if (tipo === 'reclamo') return { nome: 'reclami@cotrap.it' };
    if (!ids) return { nome: 'Ufficio COTRAP (info@cotrap.it)' };
    if (ids[0] === '2') {
      if (tipo === 'rimborso') return { nome: 'Ufficio rimborsi COTRAP' };
      if (tipo === 'oggetto') return { nome: 'info@cotrap.it', note: ['Gli oggetti trovati sulle linee CO.TR.A.P. restano almeno 30 giorni in sede, a Bari in via Bruno Buozzi 36 (dal lunedì al sabato, 7:45–14:00).'] };
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
    sx.appendChild(campo('Di cosa hai bisogno?', selTipo));
    var bCorsa = el('div', { hidden: true }); sx.appendChild(bCorsa);
    var bDati = el('div', { hidden: true }); if (opz.completo) sx.appendChild(bDati);

    var attesa = el('p', { class: 'pv-attesa', text: 'Qui compare il vettore della corsa.' });
    var esito = el('div', { class: 'pv-esito', hidden: true, 'aria-live': 'polite' });
    dx.appendChild(attesa); dx.appendChild(esito);

    var stato = { ids: null, noto: false };
    var trova = null;

    function svuota() { esito.innerHTML = ''; mostra(esito, false); mostra(attesa, true); mostra(bDati, false); stato.noto = false; }
    function pronto() { mostra(attesa, false); mostra(esito, true); }

    function mostraDestinazione() {
      var tipo = selTipo.value, d = destinazioneCotrap(tipo, stato.ids);
      esito.innerHTML = '';
      if (CON_CORSA.indexOf(tipo) >= 0) {
        if (stato.ids) esito.appendChild(blocco('Vettore della corsa', [nome(vettore(stato.ids).n),
          par('Sul biglietto è scritto sotto il logo COTRAP; sul biglietto online, alla voce «Gestito da».')]));
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
        riga('Richiesta online', collegamento('assistenza.tecbus.eu', 'https://assistenza.tecbus.eu/submit_ticket/next/tessere-elettroniche')),
        el('li', { text: 'Telefono e WhatsApp: 328 803 2801, dal lunedì al venerdì, 9–13, esclusi i festivi' })]);
      esito.appendChild(blocco('Per la tessera My Card risponde', [nome('Assistenza My Card'), ul]));
      pronto();
    }

    function sceltaBiglietto(g) {
      esito.innerHTML = '';
      var s = el('div', { class: 'pv-scelte' });
      g.forEach(function (ids) { s.appendChild(el('button', { type: 'button', text: vettore(ids).n, onclick: function () { stato.ids = ids; mostraDestinazione(); } })); });
      s.appendChild(el('button', { type: 'button', text: 'Non ho il biglietto', onclick: function () { stato.ids = null; mostraDestinazione(); } }));
      esito.appendChild(blocco('Guarda il biglietto', [par('Sotto il logo COTRAP c’è il nome del vettore. Scegli quello che leggi:'), s]));
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
        if (tipo === 'reclamo') bDati.appendChild(campo('Numero del biglietto o codice di prenotazione', testo()));
        bDati.appendChild(campo('Messaggio', area()));
        if (['rimborso', 'reclamo', 'oggetto'].indexOf(tipo) >= 0) bDati.appendChild(campo('Foto del biglietto', file(), true));
      }
      bDati.appendChild(el('div', { class: 'pv-campo' }, [el('label', { class: 'pv-spunta' }, [el('input', { type: 'checkbox' }), ' Ho letto l’', collegamento('informativa sulla privacy', 'https://www.iubenda.com/privacy-policy/76585997')])]));
      bDati.appendChild(el('button', { type: 'button', class: 'pv-invia', text: 'Invia', onclick: invia }));
      mostra(bDati, true);
    }

    function invia() {
      var d = destinazioneCotrap(selTipo.value, stato.ids);
      esito.innerHTML = '';
      esito.appendChild(el('div', { class: 'pv-conferma' }, [
        el('h3', { text: 'Richiesta inviata' }),
        par('Numero della richiesta: 1234'),
        par('La richiesta è arrivata a: ' + d.nome + (/\.$/.test(d.nome) ? '' : '.')),
        par('Riceverai per email la conferma con il numero della richiesta.'),
        el('button', { type: 'button', class: 'pv-link', text: 'Nuova richiesta', onclick: function () { selTipo.value = ''; cambiaTipo(); } })]));
      mostra(bDati, false);
      pronto();
    }

    function cambiaTipo() {
      svuota(); stato.ids = null;
      var tipo = selTipo.value;
      mostra(bCorsa, false);
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
    var q = /[?&]tipo=([a-z]+)/.exec(location.search);
    if (q && opz.completo && TIPI_COTRAP.some(function (t) { return t[0] === q[1]; })) { selTipo.value = q[1]; cambiaTipo(); }
  }

  /* ---------- guida scelta vettore: il vettore dalla corsa ---------- */
  function TrovaVettore(radice) {
    radice.classList.add('pv', 'pv-guida');
    var domande = el('div'); radice.appendChild(domande);
    var esito = el('div', { class: 'pv-esito', hidden: true, 'aria-live': 'polite' }); radice.appendChild(esito);
    function scrivi(titolo, nodi) { esito.innerHTML = ''; esito.appendChild(blocco(titolo, nodi)); mostra(esito, true); }
    Trova(domande, function (s) {
      if (s.stato === 'trovato') scrivi('Il tuo vettore', [nome(vettore(s.ids).n), par('Su My Card scegli questo vettore nell’elenco.')]);
      else if (s.stato === 'biglietto') scrivi('Su questa corsa viaggiano più vettori',
        [el('ul', { class: 'pv-recapiti' }, s.gruppi.map(function (g) { return el('li', { text: vettore(g).n }); })), par('Scegli quello con cui viaggi più spesso.')]);
      else if (s.stato === 'sconosciuto') scrivi('Corsa non trovata', [el('p', {}, ['Scrivici dalla pagina ', collegamento('Contatti', 'contatti.html'), ': ti aiutiamo a trovarlo.'])]);
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
    sx.appendChild(el('h2', { class: 'pv-titolo', text: cfg.titolo }));
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
      bDati.appendChild(el('div', { class: 'pv-campo' }, [el('label', { class: 'pv-spunta' }, [el('input', { type: 'checkbox' }), ' Ho letto l’informativa sulla privacy'])]));
      bDati.appendChild(el('button', { type: 'button', class: 'pv-invia', text: 'Invia', onclick: function () {
        esito.innerHTML = '';
        esito.appendChild(el('div', { class: 'pv-conferma' }, [el('h3', { text: 'Richiesta inviata' }),
          par('Numero della richiesta: 1234'), par('La richiesta è arrivata a: ' + cfg.risolvi(valori(), null).destinazione + (/\.$/.test(cfg.risolvi(valori(), null).destinazione) ? '' : '.')),
          par('Riceverai per email la conferma con il numero della richiesta.'),
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
      classe: 'pv-sita', titolo: 'Contattaci',
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
      classe: 'pv-marozzi', titolo: 'Scrivici',
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

  /* ---------- scheda dei recapiti di un consorziato ---------- */
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
    var CAMPI = [['t', 'Telefono per i clienti'], ['o', 'Orari dell’ufficio'], ['e', 'Email per le richieste dei clienti'], ['r', 'Email o pagina per i reclami'],
      ['b', 'Ufficio o email per i rimborsi'], ['x', 'Oggetti smarriti: dove e quando'], ['v', 'Rivendite: elenco o collegamento'], ['s', 'Sito']];
    var input = {};
    json('dati/aziende.json').then(function (a) {
      elenco = a;
      opzioni(sel, a.map(function (x, i) { return [String(i), x.n]; }), 'Scegli l’azienda…');
      var q = /[?&]azienda=([^&]+)/.exec(location.search);
      if (q) { var i = a.findIndex(function (x) { return x.n === decodeURIComponent(q[1]); }); if (i >= 0) { sel.value = String(i); apri(); } }
    });
    function apri() {
      corpo.innerHTML = ''; anteprima.innerHTML = ''; mostra(anteprima, false); mostra(attesa, true);
      if (!sel.value) { mostra(corpo, false); return; }
      var az = elenco[+sel.value];
      CAMPI.forEach(function (c) {
        var i = testo(c[0] === 'e' || c[0] === 'r' ? 'text' : 'text');
        i.value = az[c[0]] || ''; i.setAttribute('data-prima', az[c[0]] || '');
        if (!i.value) i.placeholder = 'Non indicato';
        input[c[0]] = i; corpo.appendChild(campo(c[1], i));
      });
      var si = el('input', { type: 'radio', name: 'modulo-cotrap', value: 'si' }), no = el('input', { type: 'radio', name: 'modulo-cotrap', value: 'no' });
      corpo.appendChild(el('fieldset', { class: 'pv-campo' }, [el('legend', { text: 'L’azienda vuole ricevere le richieste dei clienti dal modulo di cotrap.it?' }),
        el('div', { class: 'pv-radio' }, [el('label', {}, [si, ' Sì']), el('label', {}, [no, ' No'])])]));
      var casella = testo('email'); var bCasella = campo('Casella che riceve le richieste', casella); bCasella.hidden = true; corpo.appendChild(bCasella);
      [si, no].forEach(function (r) { r.addEventListener('change', function () { bCasella.hidden = !si.checked; }); });
      corpo.appendChild(el('button', { type: 'button', class: 'pv-invia', text: 'Conferma i dati', onclick: function () { conferma(az, si.checked ? casella.value : null); } }));
      mostra(corpo, true);
    }
    function conferma(az, casella) {
      anteprima.innerHTML = '';
      var oggi = new Date().toLocaleDateString('it-IT');
      var scheda = el('div', { class: 'pv-esito' }, [el('h3', { text: 'Scheda su cotrap.it' }), nome(az.n)]);
      var ul = el('ul', { class: 'pv-recapiti' });
      CAMPI.forEach(function (c) { var v = input[c[0]].value.trim(); if (v) ul.appendChild(el('li', { text: c[1] + ': ' + v })); });
      if (!ul.children.length) ul.appendChild(el('li', { text: 'Nessun recapito indicato.' }));
      scheda.appendChild(ul);
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
    return { scegli: function (n) { var i = elenco.findIndex(function (x) { return x.n === n; }); if (i >= 0) { sel.value = String(i); apri(); sel.scrollIntoView({ behavior: 'smooth', block: 'center' }); } } };
  }

  /* ---------- i collegamenti restano dentro la proposta ---------- */
  var avviso = null, tempo = null;
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
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
    'trova-vettore': TrovaVettore, 'sita': ModuloSita, 'marozzi': ModuloMarozzi, 'scheda': function (n) { window.schedaAzienda = SchedaAzienda(n); } };
  function avvia() {
    document.querySelectorAll('[data-prova]').forEach(function (n) { var f = MODULI[n.getAttribute('data-prova')]; if (f && !n.getAttribute('data-avviata')) { n.setAttribute('data-avviata', '1'); f(n); } });
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
