/* ==========================================================================
   NUTRITRACK - APP.JS
   ========================================================================== */

// --- DATABASE E STATO INIZIALE ---
const CHIAVE_UTENTI = "nutritrack_utenti";
const CHIAVE_SESSIONE = "nutritrack_sessione";

const TIPI_PASTO = ["Colazione", "Pranzo", "Spuntino", "Cena"];

// Stato dell'utente loggato (caricato da caricaDatiUtente)
let utenteCorrente = null;   // chiave dell'account (nome utente in minuscolo)
let profilo = null;          // dati personali
let nomeUtente = "";
let OBIETTIVO_KCAL = 0;      // calcolato dai dati personali, non modificabile a mano

// Database alimenti predefinito completo
const dbAlimenti = [
    { id: "db1", nome: "Mela", kcal100: 52, prot100: 0.3, carb100: 14, gras100: 0.2, unita: "g" },
    { id: "db2", nome: "Banana", kcal100: 89, prot100: 1.1, carb100: 23, gras100: 0.3, unita: "g" },
    { id: "db3", nome: "Petto di pollo", kcal100: 165, prot100: 31, carb100: 0, gras100: 3.6, unita: "g" },
    { id: "db4", nome: "Riso basmati (crudo)", kcal100: 350, prot100: 7, carb100: 78, gras100: 0.9, unita: "g" },
    { id: "db5", nome: "Pasta (cruda)", kcal100: 355, prot100: 12, carb100: 72, gras100: 1.5, unita: "g" },
    { id: "db6", nome: "Uovo (1 intero)", kcal100: 155, prot100: 13, carb100: 1.1, gras100: 11, unita: "g" },
    { id: "db7", nome: "Olio extravergine d'oliva", kcal100: 884, prot100: 0, carb100: 0, gras100: 100, unita: "g" },
    { id: "db8", nome: "Pane comune", kcal100: 265, prot100: 9, carb100: 49, gras100: 3.2, unita: "g" },
    { id: "db9", nome: "Latte parzialmente scremato", kcal100: 46, prot100: 3.4, carb100: 4.8, gras100: 1.5, unita: "ml" },
    { id: "db10", nome: "Yogurt greco 0%", kcal100: 59, prot100: 10, carb100: 3.6, gras100: 0.4, unita: "g" },
    { id: "db11", nome: "Tonno al naturale", kcal100: 100, prot100: 23, carb100: 0, gras100: 0.8, unita: "g" },
    { id: "db12", nome: "Mandorle", kcal100: 579, prot100: 21, carb100: 22, gras100: 50, unita: "g" },
    { id: "db13", nome: "Salmone fresco", kcal100: 208, prot100: 20, carb100: 0, gras100: 13, unita: "g" },
    { id: "db14", nome: "Fiocchi d'avena", kcal100: 389, prot100: 17, carb100: 66, gras100: 7, unita: "g" },
    { id: "db15", nome: "Avocado", kcal100: 160, prot100: 2, carb100: 9, gras100: 15, unita: "g" }
];

let alimenti = [];
let pasti = [];
let allenamenti = [];
let pesi = [];     // [{ data: "AAAA-MM-GG", kg }] ordinati per data
let sonno = [];    // [{ data: "AAAA-MM-GG", ore }] ordinati per data
let annoPeso = new Date().getFullYear();

// --- ARCHIVIO DATI PER UTENTE (localStorage) ---
function chiaveDati(nome) {
    return `nutritrack_u:${utenteCorrente}:${nome}`;
}

function leggiDati(nome, predefinito) {
    try {
        const v = JSON.parse(localStorage.getItem(chiaveDati(nome)));
        return v ?? predefinito;
    } catch (e) {
        return predefinito;
    }
}

function salvaDati(nome, valore) {
    localStorage.setItem(chiaveDati(nome), JSON.stringify(valore));
    if (nome === "allenamenti") aggiornaObiettivo();
    if (["pasti", "allenamenti", "pesi", "sonno"].includes(nome)) controllaMissioni();
}

let dataSelezionata = oggiISO();
let offsetSettimana = 0;
let calAnno, calMese;

// --- UTILITY DATE ---
function oggiISO() {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const g = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${m}-${g}`;
}

function fDataIta(iso) {
    if (!iso) return "";
    const p = iso.split("-");
    return `${p[2]}/${p[1]}/${p[0]}`;
}

function kcalDelGiorno(iso) {
    return pasti
        .filter(p => p.data === iso)
        .reduce((sum, p) => sum + Number(p.kcal), 0);
}

// --- NAVIGAZIONE PAGINE ---
function mostraPagina(id, el) {
    document.querySelectorAll(".pagina").forEach(p => p.classList.remove("attiva"));
    document.querySelectorAll(".menu-item").forEach(m => m.classList.remove("attivo"));

    const pag = document.getElementById(id);
    if (pag) pag.classList.add("attiva");

    // Peso/Sonno e dettaglio kcal non hanno una voce nel menu: resta evidenziata la Home
    const idMenu = (id === "progressi" || id === "dettaglio-kcal") ? "home" : id;
    const voce = el || document.querySelector(`.menu-item[onclick*="'${idMenu}'"]`);
    if (voce) voce.classList.add("attivo");

    if (id === "home") mostraHome();
    if (id === "cronologia") mostraCronologia();
    if (id === "calendario") mostraCalendario();
    if (id === "alimenti") mostraAlimenti();
    if (id === "allenamenti") mostraAllenamenti();
    if (id === "dettaglio-kcal") mostraDettaglioKcal();
    if (id === "progressi") mostraProgressi();
}

// --- HOME & GRAFICO ---
function cambiaSettimana(delta) {
    if (delta > 0 && offsetSettimana >= 0) return;
    offsetSettimana += delta;
    mostraHome();
}

function mostraHome() {
    document.getElementById("saluto").textContent = nomeUtente ? `Ciao ${nomeUtente}! 👋` : "Ciao! 👋";
    aggiornaObiettivo();

    const kcal = kcalDelGiorno(oggiISO());
    const percentuale = OBIETTIVO_KCAL ? Math.round((kcal / OBIETTIVO_KCAL) * 100) : 0;

    document.getElementById("kcalOggi").textContent = kcal + " kcal";
    document.getElementById("obiettivoTesto").textContent = KCAL_ALLENAMENTO_OGGI > 0
        ? `su ${OBIETTIVO_KCAL} kcal (🏃 +${KCAL_ALLENAMENTO_OGGI}) · tocca per dettagli`
        : `su ${OBIETTIVO_KCAL} kcal · tocca per dettagli`;
    document.querySelector(".cerchio span").textContent = percentuale + "%";

    const btnAvanti = document.getElementById("btnSettimanaAvanti");
    if (btnAvanti) {
        if (offsetSettimana >= 0) {
            btnAvanti.style.opacity = "0.3";
            btnAvanti.style.cursor = "default";
            btnAvanti.disabled = true;
        } else {
            btnAvanti.style.opacity = "1";
            btnAvanti.style.cursor = "pointer";
            btnAvanti.disabled = false;
        }
    }

    const titolo = document.getElementById("titoloSettimana");
    const oggi = new Date();
    const giornoSettimana = oggi.getDay();
    const diffALunedi = (giornoSettimana === 0 ? -6 : 1 - giornoSettimana);

    const lunediCorrente = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate() + diffALunedi);
    const lunediTarget = new Date(lunediCorrente.getFullYear(), lunediCorrente.getMonth(), lunediCorrente.getDate() + offsetSettimana * 7);
    const domenicaTarget = new Date(lunediTarget.getFullYear(), lunediTarget.getMonth(), lunediTarget.getDate() + 6);

    const fFormat = (d) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;

    if (titolo) {
        if (offsetSettimana === 0) {
            titolo.textContent = "Settimana corrente";
        } else {
            titolo.textContent = `${fFormat(lunediTarget)} - ${fFormat(domenicaTarget)}`;
        }
    }

    const grafico = document.getElementById("graficoKcal");
    const etichetteGiorni = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
    const dati = [];

    for (let i = 0; i < 7; i++) {
        const d = new Date(lunediTarget.getFullYear(), lunediTarget.getMonth(), lunediTarget.getDate() + i);
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const g = String(d.getDate()).padStart(2, "0");
        const iso = `${d.getFullYear()}-${m}-${g}`;
        dati.push({ iso, etichetta: etichetteGiorni[i], kcal: kcalDelGiorno(iso) });
    }

    const massimo = Math.max(OBIETTIVO_KCAL, 1, ...dati.map(x => x.kcal));

    grafico.innerHTML = dati.map(x => `
        <div class="colonna-grafico" style="cursor:pointer" onclick="apriCalendario('${x.iso}')">
            <em class="val">${x.kcal > 0 ? x.kcal : "-"}</em>
            <div class="barra" style="height:${(x.kcal / massimo) * 100}px"></div>
            <span>${x.etichetta}</span>
        </div>
    `).join("");

    const boxAll = document.getElementById("allenamentiHome");
    if (allenamenti.length === 0) {
        boxAll.innerHTML = '<p class="vuoto">Nessun allenamento registrato.</p>';
    } else {
        const recenti = [...allenamenti].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 3);
        boxAll.innerHTML = recenti.map(a => htmlAllenamento(a, false)).join("");
    }

    aggiornaMiniCard();
    aggiornaSchedaPunti();
}

// --- DETTAGLIO KCAL E MACRONUTRIENTI ---
function calcolaMacroPasto(p) {
    let prot = p.prot || 0;
    let carb = p.carb || 0;
    let gras = p.gras || 0;

    if (!prot && !carb && !gras) {
        const tutti = [...dbAlimenti, ...alimenti];
        const trovato = tutti.find(a => a.nome.toLowerCase() === p.alimento.toLowerCase());
        if (trovato) {
            prot = Math.round(((trovato.prot100 || 0) * p.quantita) / 100 * 10) / 10;
            carb = Math.round(((trovato.carb100 || 0) * p.quantita) / 100 * 10) / 10;
            gras = Math.round(((trovato.gras100 || 0) * p.quantita) / 100 * 10) / 10;
        }
    }

    return { prot, carb, gras };
}

function mostraDettaglioKcal() {
    // L'obiettivo è in sola lettura: si cambia dai dati personali
    aggiornaObiettivo();
    document.getElementById("obiettivoKcalValore").textContent = OBIETTIVO_KCAL + " kcal";
    document.getElementById("obiettivoDettaglio").textContent = KCAL_ALLENAMENTO_OGGI > 0
        ? `Base ${OBIETTIVO_BASE} kcal + ${KCAL_ALLENAMENTO_OGGI} kcal bruciate oggi con l'allenamento`
        : `Base ${OBIETTIVO_BASE} kcal · gli allenamenti di oggi si sommano all'obiettivo`;

    const pastiOggi = pasti.filter(p => p.data === oggiISO());

    // Totali per tipo di pasto e totale della giornata
    const perPasto = {};
    TIPI_PASTO.forEach(t => { perPasto[t] = { prot: 0, carb: 0, gras: 0, kcal: 0 }; });
    const totale = { prot: 0, carb: 0, gras: 0, kcal: 0 };

    pastiOggi.forEach(p => {
        const m = calcolaMacroPasto(p);
        const kcal = Number(p.kcal) || 0;

        if (perPasto[p.pasto]) {
            perPasto[p.pasto].prot += m.prot;
            perPasto[p.pasto].carb += m.carb;
            perPasto[p.pasto].gras += m.gras;
            perPasto[p.pasto].kcal += kcal;
        }
        totale.prot += m.prot;
        totale.carb += m.carb;
        totale.gras += m.gras;
        totale.kcal += kcal;
    });

    // Macronutrienti: grammi e % sulle calorie dei macro (carbo e proteine 4 kcal/g, grassi 9 kcal/g)
    const fmt = n => String(Number(n.toFixed(1)));
    const macro = [
        { etichetta: "Carboidrati", campo: "carb", kcalPerGrammo: 4, classe: "carb" },
        { etichetta: "Proteine", campo: "prot", kcalPerGrammo: 4, classe: "prot" },
        { etichetta: "Grassi", campo: "gras", kcalPerGrammo: 9, classe: "gras" }
    ];
    const kcalMacroTot = macro.reduce((somma, m) => somma + totale[m.campo] * m.kcalPerGrammo, 0);

    document.getElementById("barreMacro").innerHTML = macro.map(m => {
        const perc = kcalMacroTot > 0
            ? Math.round((totale[m.campo] * m.kcalPerGrammo / kcalMacroTot) * 100)
            : 0;
        return `
            <div class="macro-riga">
                <div class="macro-testa">
                    <span>${m.etichetta}</span>
                    <span class="macro-valore">${fmt(totale[m.campo])} g</span>
                    <span class="macro-perc">${perc}%</span>
                </div>
                <div class="macro-barra">
                    <div class="macro-riempimento ${m.classe}" style="width:${perc}%"></div>
                </div>
            </div>
        `;
    }).join("");

    // Kcal di ogni pasto
    document.getElementById("listaKcalPasti").innerHTML = TIPI_PASTO.map(t => `
        <div class="kcal-pasto">
            <span>${t}</span>
            <span>${perPasto[t].kcal} kcal</span>
        </div>
    `).join("");

    // Elenco dei singoli alimenti di oggi
    const boxRiepilogo = document.getElementById("riepilogoPastiOggi");
    if (pastiOggi.length === 0) {
        boxRiepilogo.innerHTML = '<p class="vuoto">Nessun pasto registrato per oggi.</p>';
        return;
    }

    boxRiepilogo.innerHTML = pastiOggi.map(p => {
        const m = calcolaMacroPasto(p);
        return `
            <div class="elemento">
                <h4>${p.alimento}</h4>
                <p><strong>${p.pasto}</strong> · ${p.quantita}g · ${p.kcal} kcal</p>
                <p style="font-size:12px;color:var(--testo-2);margin-top:6px">
                    Proteine: ${m.prot}g | Carboidrati: ${m.carb}g | Grassi: ${m.gras}g
                </p>
            </div>
        `;
    }).join("");
}

function mostraTabDettaglio(tab) {
    const macro = tab === "macro";
    document.getElementById("pannelloMacro").style.display = macro ? "" : "none";
    document.getElementById("pannelloPasti").style.display = macro ? "none" : "";
    document.getElementById("tabMacro").classList.toggle("attivo", macro);
    document.getElementById("tabPasti").classList.toggle("attivo", !macro);
}

// --- DIARIO & PASTI ---
function mostraCronologia() {
    const lbl = document.getElementById("dataDiarioTesto");
    if (lbl) lbl.textContent = dataSelezionata === oggiISO() ? "Oggi (" + fDataIta(dataSelezionata) + ")" : fDataIta(dataSelezionata);

    const lista = document.getElementById("listaPasti");
    const filtrati = pasti.filter(p => p.data === dataSelezionata);

    if (filtrati.length === 0) {
        lista.innerHTML = '<p class="vuoto">Nessun pasto registrato per questo giorno.</p>';
        return;
    }

    lista.innerHTML = filtrati.map(p => `
        <div class="elemento">
            <h4>${p.alimento}</h4>
            <p><strong>${p.pasto}</strong> · ${p.quantita}g · ${p.kcal} kcal</p>
            <button class="modifica" onclick="apriModificaPasto(${p.id})">✏️</button>
            <button class="elimina" onclick="eliminaPasto(${p.id})">✕</button>
        </div>
    `).join("");
}

let alimentoSelezionato = null;

function cercaAlimentiDB() {
    const q = document.getElementById("cercaAlimento").value.toLowerCase().trim();
    const resBox = document.getElementById("risultatiRicerca");

    if (!q) {
        resBox.style.display = "none";
        return;
    }

    const tutti = [...dbAlimenti, ...alimenti];
    const trovati = tutti.filter(a => a.nome.toLowerCase().includes(q));

    if (trovati.length === 0) {
        resBox.innerHTML = '<div style="padding:10px;font-size:13px;color:var(--muted)">Nessun alimento trovato</div>';
    } else {
        resBox.innerHTML = trovati.map(a => `
            <div style="padding:10px;border-bottom:1px solid var(--bordo-soft);cursor:pointer" onclick='selezionaAlimentoRicerca(${JSON.stringify(a)})'>
                <strong>${a.nome}</strong> <small style="color:var(--muted)">(${a.kcal100} kcal / 100g)</small>
            </div>
        `).join("");
    }
    resBox.style.display = "block";
}

function selezionaAlimentoRicerca(item) {
    alimentoSelezionato = item;
    document.getElementById("cercaAlimento").value = item.nome;
    document.getElementById("risultatiRicerca").style.display = "none";
    calcolaKcalPasto();
}

function calcolaKcalPasto() {
    const q = parseFloat(document.getElementById("quantitaPasto").value) || 0;
    const txt = document.getElementById("kcalCalcolate");
    if (alimentoSelezionato && q > 0) {
        const est = Math.round((alimentoSelezionato.kcal100 * q) / 100);
        txt.textContent = `Calorie stimate: ${est} kcal`;
    } else {
        txt.textContent = "Calorie stimate: 0 kcal";
    }
}

function aggiungiPasto(e) {
    e.preventDefault();
    const nome = document.getElementById("cercaAlimento").value.trim();
    const q = parseFloat(document.getElementById("quantitaPasto").value);
    const tipo = document.getElementById("tipoPasto").value;

    if (!nome || !q) return;

    let kcal = 0;
    let prot = 0;
    let carb = 0;
    let gras = 0;

    if (alimentoSelezionato && alimentoSelezionato.nome.toLowerCase() === nome.toLowerCase()) {
        kcal = Math.round((alimentoSelezionato.kcal100 * q) / 100);
        prot = Math.round((alimentoSelezionato.prot100 * q) / 100 * 10) / 10;
        carb = Math.round((alimentoSelezionato.carb100 * q) / 100 * 10) / 10;
        gras = Math.round((alimentoSelezionato.gras100 * q) / 100 * 10) / 10;
    } else {
        kcal = Math.round(q * 1.5);
    }

    const nuovo = {
        id: Date.now(),
        data: dataSelezionata,
        pasto: tipo,
        alimento: nome,
        quantita: q,
        kcal: kcal,
        prot: prot,
        carb: carb,
        gras: gras
    };

    pasti.push(nuovo);
    salvaDati("pasti", pasti);

    document.getElementById("formPasto").reset();
    document.getElementById("kcalCalcolate").textContent = "Calorie stimate: 0 kcal";
    alimentoSelezionato = null;

    mostraToast("Pasto aggiunto!");
    mostraCronologia();
    mostraHome();
}

function eliminaPasto(id) {
    pasti = pasti.filter(p => p.id !== id);
    salvaDati("pasti", pasti);
    mostraToast("Pasto eliminato");
    mostraCronologia();
    mostraHome();
}

// --- MODIFICA PASTO ---
let idPastoInModifica = null;

function apriModificaPasto(id) {
    const p = pasti.find(x => x.id === id);
    if (!p) return;
    idPastoInModifica = id;
    document.getElementById("modTipoPasto").value = p.pasto;
    document.getElementById("modQuantitaPasto").value = p.quantita;
    calcolaModKcal();
    document.getElementById("modaleModificaPasto").style.display = "flex";
}

function calcolaModKcal() {
    const p = pasti.find(x => x.id === idPastoInModifica);
    if (!p) return;
    const q = parseFloat(document.getElementById("modQuantitaPasto").value) || 0;
    const ratio = p.quantita > 0 ? p.kcal / p.quantita : 1.5;
    const est = Math.round(q * ratio);
    document.getElementById("modKcalTesto").textContent = `Nuove calorie stimate: ${est} kcal`;
}

function chiudiModalePasto() {
    document.getElementById("modaleModificaPasto").style.display = "none";
    idPastoInModifica = null;
}

function confermaModificaPasto() {
    const p = pasti.find(x => x.id === idPastoInModifica);
    if (!p) return;
    const q = parseFloat(document.getElementById("modQuantitaPasto").value);
    if (!q) return;

    const ratio = p.quantita > 0 ? p.kcal / p.quantita : 1.5;
    const fattore = p.quantita > 0 ? q / p.quantita : 1;
    p.pasto = document.getElementById("modTipoPasto").value;
    p.prot = Math.round((p.prot || 0) * fattore * 10) / 10;
    p.carb = Math.round((p.carb || 0) * fattore * 10) / 10;
    p.gras = Math.round((p.gras || 0) * fattore * 10) / 10;
    p.quantita = q;
    p.kcal = Math.round(q * ratio);

    salvaDati("pasti", pasti);
    chiudiModalePasto();
    mostraToast("Pasto aggiornato!");
    mostraCronologia();
    mostraHome();
}

// --- GESTIONE ALIMENTI PERSONALIZZATI ---
function salvaAlimento(e) {
    e.preventDefault();
    const nome = document.getElementById("nomeAlimento").value.trim();
    const kcal100 = parseFloat(document.getElementById("kcal100").value);
    const prot100 = parseFloat(document.getElementById("prot100").value) || 0;
    const carb100 = parseFloat(document.getElementById("carb100").value) || 0;
    const gras100 = parseFloat(document.getElementById("gras100").value) || 0;

    if (!nome || isNaN(kcal100)) return;

    const nuovo = {
        id: "cust_" + Date.now(),
        nome,
        kcal100,
        prot100,
        carb100,
        gras100,
        unita: "g"
    };

    alimenti.push(nuovo);
    salvaDati("alimenti", alimenti);

    document.getElementById("formAlimento").reset();
    mostraToast("Alimento salvato!");
    mostraAlimenti();
}

function mostraAlimenti() {
    // 1. Alimenti Personalizzati Inseriti
    const boxCust = document.getElementById("listaAlimentiPersonalizzati");
    if (boxCust) {
        if (alimenti.length === 0) {
            boxCust.innerHTML = '<p class="vuoto">Nessun alimento personalizzato salvato.</p>';
        } else {
            boxCust.innerHTML = alimenti.map(a => `
                <div class="elemento">
                    <h4>${a.nome}</h4>
                    <p>${a.kcal100} kcal / 100${a.unita || 'g'}</p>
                    <p style="font-size:12px;color:var(--testo-2);margin-top:4px">
                        P: ${a.prot100 || 0}g | C: ${a.carb100 || 0}g | G: ${a.gras100 || 0}g
                    </p>
                    <button class="modifica" onclick="apriModificaAlimento('${a.id}')">✏️</button>
                    <button class="elimina" onclick="eliminaAlimento('${a.id}')">✕</button>
                </div>
            `).join("");
        }
    }

    // 2. Elementi recenti nei pasti
    const container = document.getElementById("listaElementiRecenti");
    if (!container) return;

    if (pasti.length === 0) {
        container.innerHTML = '<p class="vuoto">Nessun elemento recente.</p>';
        return;
    }

    const ultimiCinque = [...pasti]
        .sort((a, b) => b.id - a.id)
        .slice(0, 5);

    container.innerHTML = ultimiCinque.map(p => `
        <div class="elemento">
            <h4>${p.alimento}</h4>
            <p><strong>${p.pasto}</strong> · ${p.quantita}g · ${p.kcal} kcal</p>
            <p style="font-size:12px;color:var(--muted);margin-top:4px">Data: ${fDataIta(p.data)}</p>
        </div>
    `).join("");
}

function eliminaAlimento(id) {
    alimenti = alimenti.filter(a => a.id !== id);
    salvaDati("alimenti", alimenti);
    mostraToast("Alimento eliminato");
    mostraAlimenti();
}

let idAlimentoInModifica = null;

function apriModificaAlimento(id) {
    const a = alimenti.find(x => x.id === id);
    if (!a) return;
    idAlimentoInModifica = id;
    document.getElementById("modNomeAlimento").value = a.nome;
    document.getElementById("modKcal100").value = a.kcal100;
    document.getElementById("modProt100").value = a.prot100 || 0;
    document.getElementById("modCarb100").value = a.carb100 || 0;
    document.getElementById("modGras100").value = a.gras100 || 0;
    document.getElementById("modaleModificaAlimento").style.display = "flex";
}

function chiudiModaleAlimento() {
    document.getElementById("modaleModificaAlimento").style.display = "none";
    idAlimentoInModifica = null;
}

function confermaModificaAlimento() {
    const a = alimenti.find(x => x.id === idAlimentoInModifica);
    if (!a) return;

    const nome = document.getElementById("modNomeAlimento").value.trim();
    const kcal100 = parseFloat(document.getElementById("modKcal100").value);
    const prot100 = parseFloat(document.getElementById("modProt100").value) || 0;
    const carb100 = parseFloat(document.getElementById("modCarb100").value) || 0;
    const gras100 = parseFloat(document.getElementById("modGras100").value) || 0;

    if (!nome || isNaN(kcal100)) {
        mostraToast("Inserisci nome e kcal validi", true);
        return;
    }

    a.nome = nome;
    a.kcal100 = kcal100;
    a.prot100 = prot100;
    a.carb100 = carb100;
    a.gras100 = gras100;

    salvaDati("alimenti", alimenti);
    chiudiModaleAlimento();
    mostraToast("Alimento aggiornato!");
    mostraAlimenti();
}

// --- ALLENAMENTI ---
function salvaAllenamento(e) {
    e.preventDefault();
    const tipo = document.getElementById("tipoAllenamento").value.trim();
    const durata = parseFloat(document.getElementById("durataAllenamento").value);
    const kcal = parseFloat(document.getElementById("kcalBruciate").value) || 0;
    const note = document.getElementById("noteAllenamento").value.trim();

    if (!tipo || !durata) return;

    const nuovo = {
        id: Date.now(),
        data: dataSelezionata,
        tipo,
        durata,
        kcal,
        note
    };

    allenamenti.push(nuovo);
    salvaDati("allenamenti", allenamenti);

    document.getElementById("formAllenamento").reset();
    mostraToast("Allenamento salvato!");
    mostraAllenamenti();
    mostraHome();
}

function htmlAllenamento(a, mostraElimina = true) {
    return `
        <div class="elemento">
            <h4>${a.tipo}</h4>
            <p>⏱️ ${a.durata} min ${a.kcal > 0 ? "· 🔥 " + a.kcal + " kcal" : ""}</p>
            ${a.note ? `<p style="font-size:13px;color:var(--testo-2);margin-top:4px">${a.note}</p>` : ""}
            <p style="font-size:12px;color:var(--muted);margin-top:4px">Data: ${fDataIta(a.data)}</p>
            ${mostraElimina ? `<button class="elimina" onclick="eliminaAllenamento(${a.id})">✕</button>` : ""}
        </div>
    `;
}

function mostraAllenamenti() {
    const list = document.getElementById("listaAllenamenti");
    if (allenamenti.length === 0) {
        list.innerHTML = '<p class="vuoto">Nessun allenamento registrato.</p>';
        return;
    }

    const ordinati = [...allenamenti].sort((a, b) => b.data.localeCompare(a.data));
    list.innerHTML = ordinati.map(a => htmlAllenamento(a, true)).join("");
}

function eliminaAllenamento(id) {
    allenamenti = allenamenti.filter(a => a.id !== id);
    salvaDati("allenamenti", allenamenti);
    mostraToast("Allenamento eliminato");
    mostraAllenamenti();
    mostraHome();
}

// --- CALENDARIO ---
function mostraCalendario() {
    const ora = new Date();
    if (calAnno === undefined) calAnno = ora.getFullYear();
    if (calMese === undefined) calMese = ora.getMonth();

    const mesiNomi = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
    document.getElementById("meseAnnoCal").textContent = `${mesiNomi[calMese]} ${calAnno}`;

    const primoGiorno = new Date(calAnno, calMese, 1);
    const ultimoGiorno = new Date(calAnno, calMese + 1, 0);

    let offsetInizio = primoGiorno.getDay() - 1;
    if (offsetInizio === -1) offsetInizio = 6;

    const griglia = document.getElementById("grigliaCalendario");
    let html = "";

    for (let i = 0; i < offsetInizio; i++) {
        html += '<div class="cal-giorno vuoto"></div>';
    }

    for (let g = 1; g <= ultimoGiorno.getDate(); g++) {
        const mStr = String(calMese + 1).padStart(2, "0");
        const gStr = String(g).padStart(2, "0");
        const iso = `${calAnno}-${mStr}-${gStr}`;

        const kcalG = kcalDelGiorno(iso);
        const haAll = allenamenti.some(a => a.data === iso);
        const eOggi = iso === oggiISO();
        const eSel = iso === dataSelezionata;

        let cls = "cal-giorno";
        if (kcalG > 0) cls += " dati";
        if (eOggi) cls += " oggi";
        if (eSel) cls += " sel";

        html += `
            <div class="${cls}" onclick="selezionaDataCal('${iso}')">
                <span>${g}</span>
                ${kcalG > 0 ? `<small>${kcalG}</small>` : ""}
                ${haAll ? '<div class="pallino"></div>' : ""}
            </div>
        `;
    }

    griglia.innerHTML = html;
    aggiornaDettaglioCal();
}

function cambiaMese(delta) {
    calMese += delta;
    if (calMese < 0) {
        calMese = 11;
        calAnno--;
    } else if (calMese > 11) {
        calMese = 0;
        calAnno++;
    }
    mostraCalendario();
}

function selezionaDataCal(iso) {
    dataSelezionata = iso;
    mostraCalendario();
}

function apriCalendario(iso) {
    dataSelezionata = iso;
    const p = iso.split("-");
    calAnno = parseInt(p[0]);
    calMese = parseInt(p[1]) - 1;

    const btnCal = document.querySelectorAll(".menu-item")[2];
    mostraPagina("calendario", btnCal);
}

function aggiornaDettaglioCal() {
    const box = document.getElementById("dettaglioGiornoCal");
    const pastiG = pasti.filter(p => p.data === dataSelezionata);
    const allG = allenamenti.filter(a => a.data === dataSelezionata);
    const totKcal = kcalDelGiorno(dataSelezionata);

    if (pastiG.length === 0 && allG.length === 0) {
        box.innerHTML = `
            <div class="card" style="text-align:center">
                <h3>${fDataIta(dataSelezionata)}</h3>
                <p style="color:var(--muted);margin:10px 0">Nessuna attività registrata per questo giorno.</p>
                <button class="btn-piccolo" onclick="vaiAlDiarioPerData('${dataSelezionata}')">Aggiungi pasti nel Diario</button>
            </div>
        `;
        return;
    }

    box.innerHTML = `
        <div class="card">
            <h3>${fDataIta(dataSelezionata)} · Totale: ${totKcal} kcal</h3>
            ${pastiG.length > 0 ? '<h4 style="margin-top:10px;margin-bottom:6px">Pasti:</h4>' + pastiG.map(p => `<p style="font-size:14px;color:var(--testo-2)">• ${p.pasto}:${p.alimento} (${p.quantita}g,${p.kcal} kcal)</p>`).join("") : ""}
            ${allG.length > 0 ? '<h4 style="margin-top:10px;margin-bottom:6px">Allenamenti:</h4>' + allG.map(a => `<p style="font-size:14px;color:var(--testo-2)">• ${a.tipo} (${a.durata} min,${a.kcal} kcal)</p>`).join("") : ""}
            <button class="btn-piccolo" onclick="vaiAlDiarioPerData('${dataSelezionata}')">Gestisci nel Diario</button>
        </div>
    `;
}

function vaiAlDiarioPerData(iso) {
    dataSelezionata = iso;
    const btnDiario = document.querySelectorAll(".menu-item")[1];
    mostraPagina("cronologia", btnDiario);
}

// --- ACCOUNT: UTENTI, REGISTRAZIONE, LOGIN ---
// Nota: non c'è un server. Gli account vivono nel localStorage di questo browser
// (la password è salvata solo come hash con salt, mai in chiaro).
function leggiUtenti() {
    try {
        return JSON.parse(localStorage.getItem(CHIAVE_UTENTI)) || [];
    } catch (e) {
        return [];
    }
}

function salvaUtenti(utenti) {
    localStorage.setItem(CHIAVE_UTENTI, JSON.stringify(utenti));
}

function trovaUtente(chiave) {
    return leggiUtenti().find(u => u.chiave === chiave);
}

function generaSalt() {
    const b = new Uint8Array(16);
    crypto.getRandomValues(b);
    return Array.from(b, x => x.toString(16).padStart(2, "0")).join("");
}

// Hash di riserva, usato solo se il browser non offre crypto.subtle (pagina non sicura)
function hashSemplice(str) {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) {
        const ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

async function calcolaHash(password, salt, alg) {
    if (alg === "pbkdf2") {
        const enc = new TextEncoder();
        const chiave = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
        const bits = await crypto.subtle.deriveBits(
            { name: "PBKDF2", salt: enc.encode(salt), iterations: 100000, hash: "SHA-256" },
            chiave,
            256
        );
        return Array.from(new Uint8Array(bits), x => x.toString(16).padStart(2, "0")).join("");
    }
    return hashSemplice(salt + password);
}

// Requisiti password: almeno 8 caratteri, una maiuscola, un numero
function validaPassword(pw) {
    return {
        len: pw.length >= 8,
        upper: /\p{Lu}/u.test(pw),
        num: /[0-9]/.test(pw)
    };
}

function passwordValida(pw) {
    const r = validaPassword(pw);
    return r.len && r.upper && r.num;
}

function aggiornaRequisitiPassword() {
    const r = validaPassword(document.getElementById("regPassword").value);
    document.querySelectorAll("#requisitiPassword li").forEach(li => {
        li.classList.toggle("ok", r[li.dataset.req]);
    });
}

function mostraTabAuth(tab) {
    const login = tab === "login";
    document.getElementById("formLogin").style.display = login ? "" : "none";
    document.getElementById("formRegistrazione").style.display = login ? "none" : "";
    document.getElementById("tabLogin").classList.toggle("attivo", login);
    document.getElementById("tabRegistrati").classList.toggle("attivo", !login);
    document.getElementById("erroreLogin").textContent = "";
    document.getElementById("erroreRegistrazione").textContent = "";
}

function mostraSchermataAuth() {
    document.querySelector(".app").style.display = "none";
    document.getElementById("modaleDatiPersonali").style.display = "none";
    chiudiModalePasto();
    chiudiModaleAlimento();
    document.getElementById("schermataAuth").style.display = "flex";
    mostraTabAuth(leggiUtenti().length > 0 ? "login" : "registrati");
}

async function eseguiRegistrazione(e) {
    e.preventDefault();
    const err = document.getElementById("erroreRegistrazione");
    const username = document.getElementById("regUsername").value.trim();
    const pw = document.getElementById("regPassword").value;
    const pw2 = document.getElementById("regPassword2").value;
    err.textContent = "";

    if (!/^[A-Za-z0-9_.-]{3,20}$/.test(username)) {
        err.textContent = "Il nome utente deve avere 3-20 caratteri: lettere, numeri, _ . -";
        return;
    }
    if (!passwordValida(pw)) {
        err.textContent = "La password deve avere almeno 8 caratteri, una maiuscola e un numero.";
        return;
    }
    if (pw !== pw2) {
        err.textContent = "Le due password non coincidono.";
        return;
    }

    const utenti = leggiUtenti();
    const chiave = username.toLowerCase();
    if (utenti.some(u => u.chiave === chiave)) {
        err.textContent = "Questo nome utente è già in uso.";
        return;
    }

    try {
        const salt = generaSalt();
        const alg = (window.crypto && crypto.subtle) ? "pbkdf2" : "semplice";
        const hash = await calcolaHash(pw, salt, alg);
        const primoAccount = utenti.length === 0;

        utenti.push({ chiave, username, salt, alg, hash, creato: new Date().toISOString() });
        salvaUtenti(utenti);
        if (primoAccount) migraDatiEsistenti(chiave);

        localStorage.setItem(CHIAVE_SESSIONE, chiave);
        document.getElementById("formRegistrazione").reset();
        aggiornaRequisitiPassword();
        avviaSessione(chiave);
    } catch (ex) {
        err.textContent = "Registrazione non riuscita. Riprova.";
    }
}

async function eseguiLogin(e) {
    e.preventDefault();
    const err = document.getElementById("erroreLogin");
    const username = document.getElementById("loginUsername").value.trim();
    const pw = document.getElementById("loginPassword").value;
    err.textContent = "";

    const utente = trovaUtente(username.toLowerCase());
    let corretta = false;

    try {
        if (utente) {
            const hash = await calcolaHash(pw, utente.salt, utente.alg);
            corretta = hash === utente.hash;
        }
    } catch (ex) {
        err.textContent = "Impossibile verificare la password su questa connessione: apri il sito in https.";
        return;
    }

    if (!corretta) {
        err.textContent = "Nome utente o password errati.";
        return;
    }

    localStorage.setItem(CHIAVE_SESSIONE, utente.chiave);
    document.getElementById("formLogin").reset();
    avviaSessione(utente.chiave);
}

// I dati salvati prima dell'introduzione degli account passano al primo account creato
function migraDatiEsistenti(chiave) {
    const vecchi = {
        pasti: "nutritrack_pasti",
        alimenti: "nutritrack_alimenti",
        allenamenti: "nutritrack_allenamenti"
    };
    Object.entries(vecchi).forEach(([nome, k]) => {
        const v = localStorage.getItem(k);
        if (v !== null) {
            localStorage.setItem(`nutritrack_u:${chiave}:${nome}`, v);
            localStorage.removeItem(k);
        }
    });

    const vecchioNome = localStorage.getItem("nutritrack_nome");
    if (vecchioNome) {
        localStorage.setItem(`nutritrack_u:${chiave}:nome_suggerito`, JSON.stringify(vecchioNome));
    }
    localStorage.removeItem("nutritrack_nome");
    localStorage.removeItem("nutritrack_obiettivo");
}

function caricaDatiUtente() {
    profilo = leggiDati("profilo", null);
    alimenti = leggiDati("alimenti", []);
    pasti = leggiDati("pasti", []);
    allenamenti = leggiDati("allenamenti", []);
    pesi = leggiDati("pesi", []);
    sonno = leggiDati("sonno", []);
    gioco = Object.assign(nuovoGioco(), leggiDati("gioco", {}));
    sveglia = Object.assign(nuovaSveglia(), leggiDati("sveglia", {}));
    nomeUtente = profilo ? profilo.nome : "";
    aggiornaObiettivo();
}

function avviaSessione(chiave) {
    utenteCorrente = chiave;
    caricaDatiUtente();

    dataSelezionata = oggiISO();
    offsetSettimana = 0;
    calAnno = undefined;
    calMese = undefined;
    annoPeso = new Date().getFullYear();
    applicaTema(leggiDati("tema", localStorage.getItem(CHIAVE_TEMA) || "foresta"), false);

    aggiornaMenuUtente();
    document.getElementById("schermataAuth").style.display = "none";
    document.querySelector(".app").style.display = "";
    mostraPagina("home", document.querySelectorAll(".menu-item")[0]);

    giornoCorrente = oggiISO();
    if (profilo) {
        // accesso di oggi: punti e streak
        const msg = registraAccesso();
        aggiornaSchedaPunti();
        if (msg) mostraToast(msg);
        controllaMissioni();
    } else {
        // Primo accesso: servono i dati personali per calcolare le kcal giornaliere
        apriDatiPersonali(true);
    }

    avviaTimerSveglia();
    ripristinaWakeLock();
    controllaSveglia();
}

function logout() {
    chiudiMenuUtente();
    localStorage.removeItem(CHIAVE_SESSIONE);
    utenteCorrente = null;
    profilo = null;
    nomeUtente = "";
    OBIETTIVO_KCAL = 0;
    alimenti = [];
    pasti = [];
    allenamenti = [];
    pesi = [];
    sonno = [];
    gioco = nuovoGioco();
    sveglia = nuovaSveglia();
    OBIETTIVO_BASE = 0;
    KCAL_ALLENAMENTO_OGGI = 0;
    giornoCorrente = null;
    clearInterval(timerSveglia);
    fermaSuonoSveglia();
    overlayAperto = false;
    rilasciaWakeLock();
    document.getElementById("overlaySveglia").style.display = "none";
    document.getElementById("modaleMissioni").style.display = "none";
    mostraSchermataAuth();
}

// --- MENU A TENDINA UTENTE ---
function aggiornaMenuUtente() {
    const utente = trovaUtente(utenteCorrente);
    if (!utente) return;
    const nome = (profilo && profilo.nome) || utente.username;
    document.getElementById("avatarUtente").textContent = nome.charAt(0).toUpperCase();
    document.getElementById("nomeUtenteMenu").textContent = utente.username;
    document.getElementById("menuNome").textContent = nome;
    document.getElementById("menuUsername").textContent = "@" + utente.username;
}

function toggleMenuUtente(e) {
    e.stopPropagation();
    const menu = document.getElementById("menuUtente");
    const aprire = menu.style.display === "none";
    menu.style.display = aprire ? "block" : "none";
    document.getElementById("btnUtente").setAttribute("aria-expanded", String(aprire));
}

function chiudiMenuUtente() {
    document.getElementById("menuUtente").style.display = "none";
    document.getElementById("btnUtente").setAttribute("aria-expanded", "false");
}

document.addEventListener("click", (e) => {
    if (!e.target.closest("#dropdownUtente")) chiudiMenuUtente();
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") chiudiMenuUtente();
});

// --- DATI PERSONALI E OBIETTIVO KCAL ---
// Formula di Mifflin-St Jeor con vita quotidiana "sedentaria" (x1.2). Non c'è più il livello
// di attività: gli allenamenti registrati oggi si sommano alle kcal giornaliere di oggi.
const FATTORE_BASE = 1.2;
let OBIETTIVO_BASE = 0;          // kcal giornaliere senza allenamento
let KCAL_ALLENAMENTO_OGGI = 0;   // kcal bruciate negli allenamenti di oggi

function calcolaObiettivoBase(p) {
    const bmr = 10 * p.peso + 6.25 * p.altezza - 5 * p.eta + (p.sesso === "M" ? 5 : -161);
    const minimo = p.sesso === "M" ? 1500 : 1200;
    return Math.max(minimo, Math.round((bmr * FATTORE_BASE) / 10) * 10);
}

function kcalAllenamenti(iso) {
    return Math.round(allenamenti
        .filter(a => a.data === iso)
        .reduce((somma, a) => somma + (Number(a.kcal) || 0), 0));
}

function aggiornaObiettivo() {
    OBIETTIVO_BASE = profilo ? calcolaObiettivoBase(profilo) : 0;
    KCAL_ALLENAMENTO_OGGI = profilo ? kcalAllenamenti(oggiISO()) : 0;
    OBIETTIVO_KCAL = OBIETTIVO_BASE ? OBIETTIVO_BASE + KCAL_ALLENAMENTO_OGGI : 0;
}

function leggiFormProfilo() {
    return {
        nome: document.getElementById("dpNome").value.trim(),
        sesso: document.getElementById("dpSesso").value,
        eta: parseInt(document.getElementById("dpEta").value),
        peso: parseFloat(document.getElementById("dpPeso").value),
        altezza: parseFloat(document.getElementById("dpAltezza").value)
    };
}

function profiloValido(p) {
    return p.nome.length > 0
        && p.eta >= 14 && p.eta <= 100
        && p.peso >= 30 && p.peso <= 300
        && p.altezza >= 120 && p.altezza <= 230;
}

function aggiornaAnteprimaKcal() {
    const p = leggiFormProfilo();
    document.getElementById("dpAnteprima").textContent =
        profiloValido(p) ? `${calcolaObiettivoBase(p)} kcal al giorno` : "—";
}

let primoAccessoDati = false;

function apriDatiPersonali(primoAccesso) {
    chiudiMenuUtente();
    primoAccessoDati = !!primoAccesso;

    const utente = trovaUtente(utenteCorrente);
    const p = profilo || {};

    document.getElementById("dpTitolo").textContent = primoAccesso ? "Benvenuto! Iniziamo dai tuoi dati" : "Dati personali";
    document.getElementById("dpIntro").textContent = primoAccesso
        ? "Servono per calcolare le tue kcal giornaliere. Potrai modificarli quando vuoi dal menu in alto a destra."
        : "Se cambi i dati, l'obiettivo calorico giornaliero viene ricalcolato.";

    document.getElementById("dpNome").value = p.nome || leggiDati("nome_suggerito", "") || utente.username;
    document.getElementById("dpSesso").value = p.sesso || "M";
    document.getElementById("dpEta").value = p.eta || "";
    document.getElementById("dpPeso").value = p.peso || "";
    document.getElementById("dpAltezza").value = p.altezza || "";
    document.getElementById("dpErrore").textContent = "";
    document.getElementById("btnAnnullaDati").textContent = primoAccesso ? "Esci" : "Annulla";
    document.getElementById("dpLogo").hidden = !primoAccesso;

    aggiornaAnteprimaKcal();
    document.getElementById("modaleDatiPersonali").style.display = "flex";
}

function chiudiModaleDatiPersonali() {
    document.getElementById("modaleDatiPersonali").style.display = "none";
}

function annullaDatiPersonali() {
    if (primoAccessoDati) {
        logout();
    } else {
        chiudiModaleDatiPersonali();
    }
}

function aggiornaPaginaCorrente() {
    const attiva = document.querySelector(".pagina.attiva");
    if (!attiva) return;
    const funzioni = {
        "home": mostraHome,
        "cronologia": mostraCronologia,
        "calendario": mostraCalendario,
        "alimenti": mostraAlimenti,
        "allenamenti": mostraAllenamenti,
        "dettaglio-kcal": mostraDettaglioKcal,
        "progressi": mostraProgressi
    };
    if (funzioni[attiva.id]) funzioni[attiva.id]();
}

function salvaDatiPersonali(e) {
    e.preventDefault();
    const p = leggiFormProfilo();

    if (!profiloValido(p)) {
        document.getElementById("dpErrore").textContent =
            "Controlla i dati: età 14-100 anni, peso 30-300 kg, altezza 120-230 cm.";
        return;
    }

    const primo = primoAccessoDati;
    const pesoPrecedente = profilo ? profilo.peso : null;
    profilo = p;
    salvaDati("profilo", profilo);
    aggiornaObiettivo();
    // il peso dei dati personali compare anche nel grafico del peso
    if (pesoPrecedente !== p.peso || pesi.length === 0) impostaPeso(oggiISO(), p.peso);
    localStorage.removeItem(chiaveDati("nome_suggerito"));

    nomeUtente = p.nome;

    chiudiModaleDatiPersonali();
    aggiornaMenuUtente();
    aggiornaPaginaCorrente();
    mostraToast(primo
        ? `Tutto pronto! Kcal giornaliere: ${OBIETTIVO_KCAL}`
        : `Dati aggiornati! Nuove kcal giornaliere: ${OBIETTIVO_KCAL}`);

    // primo accesso: l'accesso di oggi dà i primi punti e accende la streak
    if (primo) {
        const msg = registraAccesso();
        aggiornaSchedaPunti();
        if (msg) mostraToast(msg);
    }
}

// --- TEMI ---
const CHIAVE_TEMA = "nutritrack_tema";

const TEMI = [
    { id: "foresta", nome: "Foresta", colori: ["#1f8f5f", "#e6f5ed"], barra: "#f3f5f7" },
    { id: "oceano", nome: "Oceano", colori: ["#1e78d4", "#e3effc"], barra: "#f0f5fa" },
    { id: "tramonto", nome: "Tramonto", colori: ["#dd5a2c", "#fdebe3"], barra: "#faf5f1" },
    { id: "lavanda", nome: "Lavanda", colori: ["#7b52d6", "#efe9fb"], barra: "#f6f3fb" },
    { id: "notte", nome: "Notte", colori: ["#34c38a", "#12161c"], barra: "#12161c" }
];

function costruisciSelettoreTemi() {
    document.getElementById("selettoreTemi").innerHTML = TEMI.map(t => `
        <button type="button" class="tema-opzione" data-id="${t.id}" title="${t.nome}" aria-label="Tema ${t.nome}"
            style="background:linear-gradient(135deg, ${t.colori[0]} 50%, ${t.colori[1]} 50%)"
            onclick="applicaTema('${t.id}', true)"></button>
    `).join("");
}

// Il logo ha il colore del tema: img/logo-<icona|completo>-<tema>.png
function aggiornaLogo(idTema) {
    document.querySelectorAll(".logo-img[data-logo]").forEach(img => {
        img.src = `img/logo-${img.dataset.logo}-${idTema}.png`;
    });
    const icona = document.querySelector('link[rel="icon"]');
    if (icona) icona.href = `img/logo-icona-${idTema}.png`;
}

function applicaTema(id, salva) {
    const tema = TEMI.find(t => t.id === id) || TEMI[0];
    document.documentElement.dataset.tema = tema.id;

    document.querySelectorAll("#selettoreTemi .tema-opzione").forEach(b => {
        b.classList.toggle("attivo", b.dataset.id === tema.id);
    });
    document.getElementById("nomeTema").textContent = tema.nome;

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", tema.barra);
    aggiornaLogo(tema.id);

    localStorage.setItem(CHIAVE_TEMA, tema.id);          // ultimo tema usato su questo dispositivo
    if (salva && utenteCorrente) salvaDati("tema", tema.id);  // tema scelto dall'utente
}

// --- PROGRESSI: PESO E SONNO ---
const MESI_BREVI = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
const MESI_LUNGHI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
const GIORNI_BREVI = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];

function fmtNum(n, decimali = 1) {
    return String(Number(n.toFixed(decimali)));
}

function fmtOre(ore) {
    const tot = Math.round(ore * 60);
    const h = Math.floor(tot / 60);
    const m = tot % 60;
    return m ? `${h}h ${String(m).padStart(2, "0")}m` : `${h}h`;
}

function fDataLunga(iso) {
    const [a, m, g] = iso.split("-").map(Number);
    return `${g} ${MESI_LUNGHI[m - 1]} ${a}`;
}

function aggiungiGiorni(iso, delta) {
    const [a, m, g] = iso.split("-").map(Number);
    const d = new Date(a, m - 1, g + delta);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function giornoDellAnno(iso) {
    const [a, m, g] = iso.split("-").map(Number);
    return Math.round((Date.UTC(a, m - 1, g) - Date.UTC(a, 0, 1)) / 86400000);
}

function giorniNellAnno(anno) {
    return (anno % 4 === 0 && anno % 100 !== 0) || anno % 400 === 0 ? 366 : 365;
}

function etichettaGiorno(iso) {
    if (iso === oggiISO()) return "oggi";
    if (iso === aggiungiGiorni(oggiISO(), -1)) return "ieri";
    return fDataIta(iso).slice(0, 5);
}

// Asse con valori "tondi" (passi 0.5, 1, 2, 5, 10...) che racchiude i dati
function scalaAsse(minimo, massimo) {
    let lo = minimo, hi = massimo;
    if (hi - lo < 2) {
        const centro = (hi + lo) / 2;
        lo = centro - 1;
        hi = centro + 1;
    }
    const grezzo = (hi - lo) / 4;
    const passo = [0.5, 1, 2, 5, 10, 20, 50].find(x => x >= grezzo) || 50;
    const min = Math.floor((lo - passo * 0.25) / passo) * passo;
    const max = Math.ceil((hi + passo * 0.25) / passo) * passo;
    const tacche = [];
    for (let v = min; v <= max + 1e-9; v += passo) tacche.push(Math.round(v * 100) / 100);
    return { min, max, passo, tacche };
}

// Curva morbida che passa dai punti senza "sbandare" (interpolazione monotona)
function percorsoMorbido(pt) {
    const n = pt.length;
    if (n === 1) return `M${pt[0].x},${pt[0].y}`;
    if (n === 2) return `M${pt[0].x},${pt[0].y}L${pt[1].x},${pt[1].y}`;

    const dx = [], m = [], t = [];
    for (let i = 0; i < n - 1; i++) {
        dx[i] = pt[i + 1].x - pt[i].x;
        m[i] = (pt[i + 1].y - pt[i].y) / dx[i];
    }
    t[0] = m[0];
    t[n - 1] = m[n - 2];
    for (let i = 1; i < n - 1; i++) {
        t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
    }
    for (let i = 0; i < n - 1; i++) {
        if (m[i] === 0) {
            t[i] = 0;
            t[i + 1] = 0;
        } else {
            const a = t[i] / m[i], b = t[i + 1] / m[i], somma = a * a + b * b;
            if (somma > 9) {
                const k = 3 / Math.sqrt(somma);
                t[i] = k * a * m[i];
                t[i + 1] = k * b * m[i];
            }
        }
    }

    let d = `M${pt[0].x},${pt[0].y}`;
    for (let i = 0; i < n - 1; i++) {
        const c1x = pt[i].x + dx[i] / 3, c1y = pt[i].y + t[i] * dx[i] / 3;
        const c2x = pt[i + 1].x - dx[i] / 3, c2y = pt[i + 1].y - t[i + 1] * dx[i] / 3;
        d += `C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${pt[i + 1].x.toFixed(1)},${pt[i + 1].y.toFixed(1)}`;
    }
    return d;
}

let sezioneProgressi = "peso";

// Dalla Home: tocchi Peso o Sonno e vedi solo quella sezione
function apriProgressi(sezione) {
    sezioneProgressi = sezione === "sonno" ? "sonno" : "peso";
    mostraPagina("progressi");
    window.scrollTo(0, 0);
}

function mostraProgressi() {
    const peso = sezioneProgressi === "peso";
    document.getElementById("sezPeso").style.display = peso ? "" : "none";
    document.getElementById("sezSonno").style.display = peso ? "none" : "";
    document.getElementById("titoloProgressi").textContent = peso ? "Peso" : "Sonno";
    document.getElementById("sottotitoloProgressi").textContent = peso ? "Il tuo andamento nell'anno" : "Riposo e sveglia";

    const oggi = oggiISO();
    ["pesoData", "sonnoData"].forEach(id => {
        const campo = document.getElementById(id);
        campo.max = oggi;
        if (!campo.value) campo.value = oggi;
    });

    if (peso) {
        mostraPeso();
    } else {
        mostraSveglia();
        mostraSonnoPagina();
    }
}

// ----- PESO -----
function pesiDellAnno() {
    return pesi.filter(p => p.data.startsWith(annoPeso + "-"));
}

function cambiaAnnoPeso(delta) {
    const nuovo = annoPeso + delta;
    if (nuovo > new Date().getFullYear()) return;
    annoPeso = nuovo;
    mostraPeso();
}

function impostaPeso(data, kg) {
    const i = pesi.findIndex(p => p.data === data);
    if (i >= 0) pesi[i].kg = kg;
    else pesi.push({ data, kg });
    pesi.sort((a, b) => a.data.localeCompare(b.data));
    salvaDati("pesi", pesi);
    return sincronizzaPesoProfilo();
}

// L'ultimo peso registrato è il peso attuale: aggiorna dati personali e obiettivo kcal
function sincronizzaPesoProfilo() {
    if (!profilo || pesi.length === 0) return false;
    const ultimo = pesi[pesi.length - 1].kg;
    if (profilo.peso === ultimo) return false;
    profilo.peso = ultimo;
    salvaDati("profilo", profilo);
    aggiornaObiettivo();
    return true;
}

function salvaPeso(e) {
    e.preventDefault();
    const data = document.getElementById("pesoData").value;
    const kg = parseFloat(document.getElementById("pesoKg").value);

    if (!data || data > oggiISO()) {
        mostraToast("Scegli una data valida (non nel futuro)", true);
        return;
    }
    if (!(kg >= 30 && kg <= 300)) {
        mostraToast("Inserisci un peso tra 30 e 300 kg", true);
        return;
    }

    const obiettivoCambiato = impostaPeso(data, Math.round(kg * 10) / 10);
    document.getElementById("pesoKg").value = "";
    annoPeso = Number(data.slice(0, 4));
    mostraPeso();
    mostraToast(obiettivoCambiato ? `Peso salvato · nuovo obiettivo ${OBIETTIVO_KCAL} kcal` : "Peso salvato ⚖️");
}

function eliminaPeso(data) {
    pesi = pesi.filter(p => p.data !== data);
    salvaDati("pesi", pesi);
    sincronizzaPesoProfilo();
    mostraPeso();
    mostraToast("Misurazione eliminata");
}

function mostraDettaglioPeso(iso) {
    const v = pesi.find(p => p.data === iso);
    if (!v) return;
    document.getElementById("dettaglioPunto").innerHTML = `<strong>${fDataLunga(iso)}</strong> · ${fmtNum(v.kg)} kg`;
}

function mostraPeso() {
    const anno = annoPeso;
    const voci = pesiDellAnno();

    document.getElementById("annoPeso").textContent = anno;
    document.getElementById("btnAnnoAvanti").disabled = anno >= new Date().getFullYear();
    document.getElementById("dettaglioPunto").textContent = voci.length
        ? "Tocca un punto per vedere i dettagli"
        : "Nessuna misurazione in questo anno";

    // Riepilogo: attuale, variazione dall'inizio dell'anno, media
    let attuale = "—", variazione = "—", media = "—", classeVar = "";
    if (voci.length) {
        const primo = voci[0].kg, ultimo = voci[voci.length - 1].kg;
        attuale = `${fmtNum(ultimo)} kg`;
        media = `${fmtNum(voci.reduce((somma, v) => somma + v.kg, 0) / voci.length)} kg`;
        if (voci.length > 1) {
            const delta = ultimo - primo;
            const segno = delta > 0.04 ? "+" : delta < -0.04 ? "−" : "";
            variazione = `${segno}${fmtNum(Math.abs(delta))} kg`;
        }
    }
    document.getElementById("statPeso").innerHTML = `
        <div class="stat"><small>Attuale</small><strong>${attuale}</strong></div>
        <div class="stat"><small>Variazione</small><strong class="${classeVar}">${variazione}</strong></div>
        <div class="stat"><small>Media</small><strong>${media}</strong></div>
    `;

    document.getElementById("graficoPeso").innerHTML = svgGraficoPeso(anno, voci);

    // Ultime misurazioni
    const box = document.getElementById("listaPesi");
    if (!voci.length) {
        box.innerHTML = "";
        return;
    }
    box.innerHTML = '<h4 class="titolo-lista">Ultime misurazioni</h4>' +
        voci.slice(-5).reverse().map((v, i) => {
            const prec = voci[voci.length - 2 - i];
            const diff = prec ? v.kg - prec.kg : null;
            const testoDiff = diff === null ? "" : (Math.abs(diff) < 0.05 ? "=" : (diff > 0 ? "+" : "−") + fmtNum(Math.abs(diff)));
            return `
                <div class="riga-lista">
                    <div><strong>${fmtNum(v.kg)} kg</strong><small>${fDataLunga(v.data)}</small></div>
                    <div class="riga-dx">
                        <span>${testoDiff}</span>
                        <button type="button" class="btn-elimina-mini" onclick="eliminaPeso('${v.data}')" aria-label="Elimina">✕</button>
                    </div>
                </div>
            `;
        }).join("");
}

function svgGraficoPeso(anno, voci) {
    const W = 300, H = 210, L = 34, R = 10, T = 18, B = 26;
    const pw = W - L - R, ph = H - T - B;
    const nGiorni = giorniNellAnno(anno);

    let lo, hi;
    if (voci.length) {
        lo = Math.min(...voci.map(v => v.kg));
        hi = Math.max(...voci.map(v => v.kg));
    } else {
        const base = profilo ? profilo.peso : 70;
        lo = base - 5;
        hi = base + 5;
    }
    const sc = scalaAsse(lo, hi);
    const yDi = v => T + ph - ((v - sc.min) / (sc.max - sc.min)) * ph;
    const xDiGiorno = g => L + (Math.min(g, nGiorni - 1) / (nGiorni - 1)) * pw;

    let svg = `<svg viewBox="0 0 ${W} ${H}" class="svg-grafico" role="img" aria-label="Grafico del peso nel ${anno}">`;
    svg += `<defs><linearGradient id="gradPeso" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" style="stop-color:var(--primario);stop-opacity:0.3"/>
        <stop offset="100%" style="stop-color:var(--primario);stop-opacity:0"/>
    </linearGradient></defs>`;

    // asse y: linee guida e valori
    sc.tacche.forEach(v => {
        const y = yDi(v);
        svg += `<line class="griglia" x1="${L}" y1="${y.toFixed(1)}" x2="${L + pw}" y2="${y.toFixed(1)}"/>`;
        svg += `<text class="etichetta" x="${L - 6}" y="${(y + 3).toFixed(1)}" text-anchor="end">${fmtNum(v, sc.passo < 1 ? 1 : 0)}</text>`;
    });
    svg += `<text class="etichetta" x="${L - 6}" y="8" text-anchor="end">kg</text>`;

    // asse x: mesi
    for (let m = 0; m < 12; m++) {
        const g0 = Math.round((Date.UTC(anno, m, 1) - Date.UTC(anno, 0, 1)) / 86400000);
        const g1 = Math.round((Date.UTC(anno, m + 1, 1) - Date.UTC(anno, 0, 1)) / 86400000);
        const x0 = xDiGiorno(g0), x1 = xDiGiorno(g1);
        if (m > 0) svg += `<line class="griglia-v" x1="${x0.toFixed(1)}" y1="${T}" x2="${x0.toFixed(1)}" y2="${T + ph}"/>`;
        svg += `<text class="etichetta" x="${((x0 + x1) / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle">${MESI_BREVI[m]}</text>`;
    }

    svg += `<line class="asse" x1="${L}" y1="${T}" x2="${L}" y2="${T + ph}"/>`;
    svg += `<line class="asse" x1="${L}" y1="${T + ph}" x2="${L + pw}" y2="${T + ph}"/>`;

    if (!voci.length) {
        svg += `<text class="vuoto-svg" x="${W / 2}" y="${T + ph / 2}" text-anchor="middle">Nessun peso registrato nel ${anno}</text>`;
    } else {
        const pt = voci.map(v => ({ x: xDiGiorno(giornoDellAnno(v.data)), y: yDi(v.kg), data: v.data }));
        const linea = percorsoMorbido(pt);
        const base = T + ph;
        if (pt.length > 1) {
            svg += `<path d="${linea}L${pt[pt.length - 1].x.toFixed(1)},${base}L${pt[0].x.toFixed(1)},${base}Z" fill="url(#gradPeso)"/>`;
        }
        svg += `<path class="linea-peso" d="${linea}"/>`;

        const ultimo = pt[pt.length - 1];
        if (pt.length <= 60) {
            pt.forEach(p => { svg += `<circle class="punto" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5"/>`; });
        }
        svg += `<circle class="punto-ultimo" cx="${ultimo.x.toFixed(1)}" cy="${ultimo.y.toFixed(1)}" r="5.5"/>`;
        if (pt.length <= 120) {
            pt.forEach(p => {
                svg += `<circle class="hit" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="11" onclick="mostraDettaglioPeso('${p.data}')"/>`;
            });
        }
    }
    return svg + "</svg>";
}

// ----- SONNO -----
function ultimi7Giorni() {
    const oggi = oggiISO();
    const giorni = [];
    for (let i = 6; i >= 0; i--) giorni.push(aggiungiGiorni(oggi, -i));
    return giorni;
}

function oreSonno(iso) {
    const v = sonno.find(x => x.data === iso);
    return v ? v.ore : null;
}

function impostaSonno(data, ore) {
    const i = sonno.findIndex(x => x.data === data);
    if (i >= 0) sonno[i].ore = ore;
    else sonno.push({ data, ore });
    sonno.sort((a, b) => a.data.localeCompare(b.data));
    salvaDati("sonno", sonno);
}

function salvaSonno(e) {
    e.preventDefault();
    const data = document.getElementById("sonnoData").value;
    const ore = parseFloat(document.getElementById("sonnoOre").value);

    if (!data || data > oggiISO()) {
        mostraToast("Scegli una data valida (non nel futuro)", true);
        return;
    }
    if (!(ore > 0 && ore <= 24)) {
        mostraToast("Inserisci un valore tra 0 e 24 ore", true);
        return;
    }

    impostaSonno(data, Math.round(ore * 4) / 4);

    document.getElementById("sonnoOre").value = "";
    mostraSonnoPagina();
    mostraToast("Sonno salvato 😴");
}

function eliminaSonno(data) {
    sonno = sonno.filter(x => x.data !== data);
    salvaDati("sonno", sonno);
    mostraSonnoPagina();
    mostraToast("Notte eliminata");
}

function preparaSonno(iso) {
    document.getElementById("sonnoData").value = iso;
    const ore = oreSonno(iso);
    const campo = document.getElementById("sonnoOre");
    campo.value = ore !== null ? ore : "";
    campo.focus();
}

function mostraSonnoPagina() {
    const giorni = ultimi7Giorni();
    const valori = giorni.map(oreSonno).filter(v => v !== null);

    const media = valori.length ? fmtOre(valori.reduce((a, b) => a + b, 0) / valori.length) : "—";
    const ultima = sonno.length ? sonno[sonno.length - 1] : null;
    const buone = valori.filter(v => v >= 7).length;

    document.getElementById("statSonno").innerHTML = `
        <div class="stat"><small>Media</small><strong>${media}</strong></div>
        <div class="stat"><small>Ultima notte</small><strong>${ultima ? fmtOre(ultima.ore) : "—"}</strong></div>
        <div class="stat"><small>Notti ≥ 7h</small><strong class="${buone >= 5 ? "buono" : ""}">${buone}/7</strong></div>
    `;

    document.getElementById("graficoSonno").innerHTML = svgGraficoSonno(giorni);

    const box = document.getElementById("listaSonno");
    if (!sonno.length) {
        box.innerHTML = "";
        return;
    }
    box.innerHTML = '<h4 class="titolo-lista">Ultime notti</h4>' +
        sonno.slice(-5).reverse().map(v => `
            <div class="riga-lista">
                <div><strong>${fmtOre(v.ore)}</strong><small>${fDataLunga(v.data)}</small></div>
                <div class="riga-dx">
                    <button type="button" class="btn-elimina-mini" onclick="eliminaSonno('${v.data}')" aria-label="Elimina">✕</button>
                </div>
            </div>
        `).join("");
}

function svgGraficoSonno(giorni) {
    const W = 300, H = 190, L = 28, R = 8, T = 16, B = 26;
    const pw = W - L - R, ph = H - T - B;
    const valori = giorni.map(oreSonno);
    const max = Math.ceil(Math.max(10, ...valori.filter(v => v !== null)) / 2) * 2;
    const passo = max <= 12 ? 2 : 4;
    const yDi = v => T + ph - (v / max) * ph;
    const oggi = oggiISO();

    let svg = `<svg viewBox="0 0 ${W} ${H}" class="svg-grafico" role="img" aria-label="Ore di sonno degli ultimi 7 giorni">`;

    // fascia ideale 7-9 ore
    svg += `<rect class="banda-ideale" x="${L}" y="${yDi(9).toFixed(1)}" width="${pw}" height="${(yDi(7) - yDi(9)).toFixed(1)}" rx="4"/>`;
    svg += `<text class="etichetta-banda" x="${L + 5}" y="${(yDi(9) + 10).toFixed(1)}">ideale 7–9h</text>`;

    // asse y
    for (let v = 0; v <= max; v += passo) {
        const y = yDi(v);
        if (v > 0) svg += `<line class="griglia" x1="${L}" y1="${y.toFixed(1)}" x2="${L + pw}" y2="${y.toFixed(1)}"/>`;
        svg += `<text class="etichetta" x="${L - 6}" y="${(y + 3).toFixed(1)}" text-anchor="end">${v}</text>`;
    }
    svg += `<text class="etichetta" x="${L - 6}" y="8" text-anchor="end">ore</text>`;
    svg += `<line class="asse" x1="${L}" y1="${T}" x2="${L}" y2="${T + ph}"/>`;
    svg += `<line class="asse" x1="${L}" y1="${T + ph}" x2="${L + pw}" y2="${T + ph}"/>`;

    // barre
    const slot = pw / 7, larghezza = Math.min(24, slot * 0.62);
    giorni.forEach((g, i) => {
        const cx = L + slot * i + slot / 2;
        const [a, m, gg] = g.split("-").map(Number);
        const nome = g === oggi ? "Oggi" : GIORNI_BREVI[new Date(a, m - 1, gg).getDay()];
        const v = valori[i];

        if (v !== null) {
            const y = yDi(v);
            svg += `<rect class="barra-sonno ${v >= 7 ? "" : "poco"}" x="${(cx - larghezza / 2).toFixed(1)}" y="${y.toFixed(1)}" width="${larghezza.toFixed(1)}" height="${Math.max(T + ph - y, 2).toFixed(1)}" rx="5"/>`;
            svg += `<text class="valore-barra" x="${cx.toFixed(1)}" y="${(y - 4).toFixed(1)}" text-anchor="middle">${fmtNum(v, 2)}</text>`;
        } else {
            svg += `<rect class="barra-vuota" x="${(cx - larghezza / 2).toFixed(1)}" y="${T + ph - 3}" width="${larghezza.toFixed(1)}" height="3" rx="1.5"/>`;
        }
        svg += `<text class="etichetta" x="${cx.toFixed(1)}" y="${H - 8}" text-anchor="middle">${nome}</text>`;
        svg += `<rect class="hit" x="${(L + slot * i).toFixed(1)}" y="${T}" width="${slot.toFixed(1)}" height="${ph}" onclick="preparaSonno('${g}')"/>`;
    });
    return svg + "</svg>";
}

// ----- HOME: riepilogo -----
function aggiornaMiniCard() {
    const ultimoPeso = pesi.length ? pesi[pesi.length - 1] : null;
    let subPeso = "Aggiungi il tuo peso";
    if (ultimoPeso) {
        if (pesi.length > 1) {
            const d = ultimoPeso.kg - pesi[pesi.length - 2].kg;
            subPeso = Math.abs(d) < 0.05 ? "invariato" : `${d > 0 ? "▲" : "▼"} ${fmtNum(Math.abs(d))} kg`;
        } else {
            subPeso = etichettaGiorno(ultimoPeso.data);
        }
    }
    document.getElementById("homePeso").textContent = ultimoPeso ? `${fmtNum(ultimoPeso.kg)} kg` : "—";
    document.getElementById("homePesoSub").textContent = subPeso;

    const ultimoSonno = sonno.length ? sonno[sonno.length - 1] : null;
    document.getElementById("homeSonno").textContent = ultimoSonno ? fmtOre(ultimoSonno.ore) : "—";
    let subSonno = "Registra la prima notte";
    if (sveglia.sessione) subSonno = "🌙 a letto";
    else if (ultimoSonno) subSonno = etichettaGiorno(ultimoSonno.data) + (sveglia.attiva ? ` · ⏰ ${sveglia.ora}` : "");
    document.getElementById("homeSonnoSub").textContent = subSonno;
}

// --- PUNTI, MISSIONI E STREAK ---
const MISSIONI = [
    { id: "accesso", icona: "🔑", titolo: "Accedi all'app", breve: "Accesso", punti: 10 },
    { id: "peso", icona: "⚖️", titolo: "Registra il tuo peso", breve: "Peso registrato", punti: 15 },
    { id: "pasti", icona: "🍽️", titolo: "Registra almeno 3 pasti", breve: "Pasti registrati", punti: 15 },
    { id: "allenamento", icona: "🏃", titolo: "Fai un allenamento", breve: "Allenamento fatto", punti: 20 },
    { id: "sonno", icona: "😴", titolo: "Dormi almeno 7 ore", breve: "Sonno di 7 ore o più", punti: 15 },
    { id: "kcal", icona: "🎯", titolo: "Kcal tra il 90% e il 105% dell'obiettivo", breve: "Kcal in obiettivo", punti: 20 }
];
const BONUS_GIORNATA_PERFETTA = 25;
const BONUS_STREAK = [[3, 20], [7, 50], [14, 100], [30, 250], [60, 500], [100, 1000]];
const NOMI_LIVELLO = ["Novizio", "Costante", "Atleta", "Campione", "Leggenda"];

function nuovoGioco() {
    return { punti: 0, streak: 0, record: 0, ultimoAccesso: null, giorni: {} };
}

let gioco = nuovoGioco();
let giornoCorrente = null;
let animaFiamma = false;

function sogliaLivello(l) {
    return 75 * l * (l - 1);   // livello 2 a 150 punti, 3 a 450, 4 a 900...
}

function infoLivello(punti) {
    let l = 1;
    while (punti >= sogliaLivello(l + 1)) l++;
    const da = sogliaLivello(l), a = sogliaLivello(l + 1);
    return {
        livello: l,
        nome: NOMI_LIVELLO[Math.min(Math.floor((l - 1) / 2), NOMI_LIVELLO.length - 1)],
        a,
        perc: Math.round(((punti - da) / (a - da)) * 100)
    };
}

function giornoGioco(iso) {
    if (!gioco.giorni[iso]) {
        gioco.giorni[iso] = { fatte: [], punti: 0 };
        const limite = aggiungiGiorni(oggiISO(), -60);   // si tengono solo gli ultimi 60 giorni
        Object.keys(gioco.giorni).forEach(k => { if (k < limite) delete gioco.giorni[k]; });
    }
    return gioco.giorni[iso];
}

function aggiungiPunti(n, giorno) {
    const prima = infoLivello(gioco.punti).livello;
    gioco.punti += n;
    giorno.punti += n;
    const dopo = infoLivello(gioco.punti).livello;
    return dopo > prima ? dopo : 0;   // livello appena raggiunto (0 = nessuno)
}

// Accesso del giorno: +10 punti e la streak sale se ieri eri entrato anche tu
function registraAccesso() {
    if (!utenteCorrente) return null;
    const oggi = oggiISO();
    const g = giornoGioco(oggi);
    if (g.fatte.includes("accesso")) return null;

    gioco.streak = gioco.ultimoAccesso === aggiungiGiorni(oggi, -1) ? gioco.streak + 1 : 1;
    gioco.ultimoAccesso = oggi;
    gioco.record = Math.max(gioco.record, gioco.streak);
    g.fatte.push("accesso");

    let punti = MISSIONI[0].punti;
    const bonus = BONUS_STREAK.find(b => b[0] === gioco.streak);
    if (bonus) punti += bonus[1];
    const livello = aggiungiPunti(punti, g);
    salvaDati("gioco", gioco);
    animaFiamma = true;

    let msg = bonus
        ? `🎉 Streak di ${gioco.streak} giorni! Bonus +${bonus[1]} · +${punti} punti`
        : `🔥 Streak di ${gioco.streak} ${gioco.streak === 1 ? "giorno" : "giorni"} · +${punti} punti`;
    if (livello) msg += ` · Livello ${livello}!`;
    return msg;
}

function condizioniMissioni(iso) {
    const tipiPasto = new Set(pasti.filter(p => p.data === iso).map(p => p.pasto));
    const notte = sonno.find(x => x.data === iso);
    const kcal = kcalDelGiorno(iso);
    return {
        peso: pesi.some(p => p.data === iso),
        pasti: tipiPasto.size >= 3,
        allenamento: allenamenti.some(a => a.data === iso),
        sonno: !!notte && notte.ore >= 7,
        kcal: OBIETTIVO_KCAL > 0 && kcal >= OBIETTIVO_KCAL * 0.9 && kcal <= OBIETTIVO_KCAL * 1.05
    };
}

// Controlla le missioni di oggi dopo ogni dato salvato: ogni missione dà punti una sola volta al giorno
function controllaMissioni() {
    if (!utenteCorrente || !profilo) return;
    const oggi = oggiISO();
    const g = giornoGioco(oggi);
    const cond = condizioniMissioni(oggi);

    const nuove = MISSIONI.filter(m => m.id !== "accesso" && cond[m.id] && !g.fatte.includes(m.id));
    if (nuove.length === 0) return;

    let totale = 0;
    nuove.forEach(m => {
        g.fatte.push(m.id);
        totale += m.punti;
    });

    let perfetta = false;
    if (MISSIONI.every(m => g.fatte.includes(m.id)) && !g.fatte.includes("perfetta")) {
        g.fatte.push("perfetta");
        totale += BONUS_GIORNATA_PERFETTA;
        perfetta = true;
    }

    const livello = aggiungiPunti(totale, g);
    salvaDati("gioco", gioco);

    let msg = nuove.length === 1
        ? `${nuove[0].icona} ${nuove[0].breve} · +${totale} punti`
        : `🎯 ${nuove.length} missioni completate · +${totale} punti`;
    if (perfetta) msg = `🏆 Giornata perfetta! Bonus +${BONUS_GIORNATA_PERFETTA} · +${totale} punti`;
    if (livello) msg += ` · Livello ${livello}!`;
    mostraToast(msg);
    aggiornaSchedaPunti();
}

function streakAttiva() {
    const oggi = oggiISO();
    const ok = gioco.ultimoAccesso === oggi || gioco.ultimoAccesso === aggiungiGiorni(oggi, -1);
    return ok ? gioco.streak : 0;
}

function animaFiammaOra() {
    const f = document.getElementById("fiammaIcona");
    f.classList.remove("anima");
    void f.offsetWidth;
    f.classList.add("anima");
}

function aggiornaSchedaPunti() {
    const oggi = oggiISO();
    const streak = streakAttiva();
    const l = infoLivello(gioco.punti);

    document.getElementById("streakNum").textContent = streak;
    document.getElementById("streakTesto").textContent = streak === 1 ? "giorno di fila" : "giorni di fila";
    document.getElementById("streakFiamma").classList.toggle("spenta", streak === 0);
    document.getElementById("puntiTot").textContent = gioco.punti;
    document.getElementById("livelloNome").textContent = `Livello ${l.livello} · ${l.nome}`;
    document.getElementById("livelloPunti").textContent = `${gioco.punti} / ${l.a}`;
    document.getElementById("livelloBarra").style.width = l.perc + "%";

    // ultimi 7 giorni con l'accesso fatto
    let giorni = "";
    for (let i = 6; i >= 0; i--) {
        const iso = aggiungiGiorni(oggi, -i);
        const [a, m, gg] = iso.split("-").map(Number);
        const fatto = !!(gioco.giorni[iso] && gioco.giorni[iso].fatte.includes("accesso"));
        giorni += `<div class="streak-giorno ${fatto ? "fatto" : ""} ${i === 0 ? "oggi" : ""}">
            <span>${fatto ? "✓" : ""}</span>${GIORNI_BREVI[new Date(a, m - 1, gg).getDay()]}
        </div>`;
    }
    document.getElementById("streakGiorni").innerHTML = giorni;

    const g = gioco.giorni[oggi];
    const fatte = g ? MISSIONI.filter(m => g.fatte.includes(m.id)).length : 0;
    document.getElementById("missioniContatore").textContent = `${fatte}/${MISSIONI.length}`;

    if (animaFiamma) {
        animaFiamma = false;
        animaFiammaOra();
    }
}

// Tocco sulla fiamma: anima la streak e dice quanto manca al prossimo bonus
function toccaStreak() {
    animaFiammaOra();
    const streak = streakAttiva();
    if (streak === 0) {
        mostraToast("Accedi ogni giorno per accendere la tua streak 🔥");
        return;
    }
    const prossimo = BONUS_STREAK.find(b => b[0] > streak);
    if (prossimo) {
        const manca = prossimo[0] - streak;
        mostraToast(`Ancora ${manca} ${manca === 1 ? "giorno" : "giorni"} al bonus di +${prossimo[1]} punti 🎁 · record: ${gioco.record}`);
    } else {
        mostraToast(`Sei una leggenda! Record: ${gioco.record} giorni 🏆`);
    }
}

function dettaglioMissione(id, iso, cond) {
    switch (id) {
        case "accesso":
            return "Fatto: sei dentro!";
        case "peso":
            return cond.peso ? "Peso di oggi registrato" : "Aggiungi il peso di oggi dalla card Peso";
        case "pasti": {
            const n = new Set(pasti.filter(p => p.data === iso).map(p => p.pasto)).size;
            return `${Math.min(n, 3)}/3 pasti (colazione, pranzo, cena, spuntino)`;
        }
        case "allenamento":
            return cond.allenamento ? "Allenamento di oggi registrato" : "Registra un allenamento nella sezione Sport";
        case "sonno": {
            const notte = sonno.find(x => x.data === iso);
            if (!notte) return "Salva le ore di sonno o usa la sveglia";
            return `${fmtOre(notte.ore)} registrate${notte.ore < 7 ? " (ne servono 7)" : ""}`;
        }
        case "kcal":
            return OBIETTIVO_KCAL
                ? `${Math.round((kcalDelGiorno(iso) / OBIETTIVO_KCAL) * 100)}% di ${OBIETTIVO_KCAL} kcal`
                : "—";
    }
    return "";
}

function apriMissioni() {
    controllaMissioni();
    const oggi = oggiISO();
    const g = giornoGioco(oggi);
    const cond = condizioniMissioni(oggi);

    const righe = MISSIONI.map(m => {
        const fatta = g.fatte.includes(m.id);
        return `
            <div class="missione ${fatta ? "fatta" : ""}">
                <div class="missione-icona">${m.icona}</div>
                <div class="missione-testo">
                    <strong>${m.titolo}</strong>
                    <small>${dettaglioMissione(m.id, oggi, cond)}</small>
                </div>
                <span class="missione-punti">${fatta ? "✓ " : "+"}${m.punti}</span>
            </div>`;
    });
    const perfetta = g.fatte.includes("perfetta");
    righe.push(`
        <div class="missione ${perfetta ? "fatta" : ""}">
            <div class="missione-icona">🏆</div>
            <div class="missione-testo">
                <strong>Giornata perfetta</strong>
                <small>Completa tutte le missioni</small>
            </div>
            <span class="missione-punti">${perfetta ? "✓ " : "+"}${BONUS_GIORNATA_PERFETTA}</span>
        </div>`);

    document.getElementById("listaMissioni").innerHTML = righe.join("");
    document.getElementById("puntiOggi").textContent = g.punti;
    document.getElementById("modaleMissioni").style.display = "flex";
}

function chiudiMissioni() {
    document.getElementById("modaleMissioni").style.display = "none";
}

function nuovoGiorno() {
    giornoCorrente = oggiISO();
    aggiornaObiettivo();
    if (profilo) {
        const msg = registraAccesso();
        if (msg) mostraToast(msg);
    }
    aggiornaPaginaCorrente();
}

// --- SVEGLIA (collegata al sonno) ---
// Nota: una pagina web può far suonare la sveglia solo finché è aperta (con lo schermo acceso).
// Per questo, mentre dormi, l'app chiede di tenere lo schermo acceso e prova a mandare una notifica.
function nuovaSveglia() {
    return { attiva: false, letto: "23:00", ora: "07:00", sessione: null };
}

let sveglia = nuovaSveglia();
let timerSveglia = null;
let overlayAperto = false;
let ctxAudio = null;
let timerSuono = null;
let wakeLock = null;

function isoDaData(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function hhmm(d) {
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function oraInMinuti(testo) {
    const [h, m] = testo.split(":").map(Number);
    return h * 60 + m;
}

function minutiInOra(minuti) {
    const m = ((minuti % 1440) + 1440) % 1440;
    return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

function fmtMinuti(minuti) {
    return fmtOre(minuti / 60);
}

// durata tra l'ora di andare a letto e quella della sveglia (anche oltre la mezzanotte)
function durataPrevista(letto, ora) {
    let d = oraInMinuti(ora) - oraInMinuti(letto);
    if (d <= 0) d += 1440;
    return d;
}

// prima occorrenza dell'ora della sveglia dopo il riferimento
function prossimaSveglia(ora, riferimento) {
    const [h, m] = ora.split(":").map(Number);
    const d = new Date(riferimento);
    d.setHours(h, m, 0, 0);
    if (d.getTime() <= riferimento) d.setDate(d.getDate() + 1);
    return d.getTime();
}

function mostraSveglia() {
    document.getElementById("svAttiva").checked = sveglia.attiva;
    document.getElementById("svLetto").value = sveglia.letto;
    document.getElementById("svOra").value = sveglia.ora;

    const durata = durataPrevista(sveglia.letto, sveglia.ora);
    const ore = durata / 60;
    const consigliata = minutiInOra(oraInMinuti(sveglia.ora) - 8 * 60);
    let classe = "ok";
    let testo = `Dormirai circa <strong>${fmtMinuti(durata)}</strong>`;
    if (ore >= 7 && ore <= 9) {
        testo += " · nella fascia ideale ✓";
    } else {
        classe = "attenzione";
        testo += ore < 7 ? " · pochino." : " · parecchio.";
        testo += ` Per dormire 8 ore vai a letto alle <strong>${consigliata}</strong>.`;
    }
    const box = document.getElementById("svRiepilogo");
    box.className = "sv-riepilogo " + classe;
    box.innerHTML = testo;

    mostraSessioneSveglia();
}

function mostraSessioneSveglia() {
    const box = document.getElementById("svSessione");
    const s = sveglia.sessione;

    if (!s) {
        box.innerHTML = `
            <button type="button" class="btn-primario" onclick="vadoADormire()">🌙 Vado a dormire</button>
            <p class="grafico-nota">${sveglia.attiva
                ? "La sveglia suona all'ora scelta e registra da sola le ore di sonno."
                : "Attiva la sveglia per svegliarti all'ora scelta. Le ore di sonno si registrano quando tocchi “Mi sono svegliato”."}</p>`;
        return;
    }

    let riga = `A letto dalle ${hhmm(new Date(s.inizio))}`;
    if (s.sveglia) {
        const restano = Math.max(0, Math.round((s.sveglia - Date.now()) / 60000));
        riga += ` · sveglia alle ${hhmm(new Date(s.sveglia))} (${restano < 1 ? "tra meno di un minuto" : "tra " + fmtMinuti(restano)})`;
    }
    box.innerHTML = `
        <div class="sv-stato">
            <div class="luna">🌙</div>
            <strong>Buonanotte!</strong>
            <small>${riga}</small>
        </div>
        <button type="button" class="btn-primario" onclick="terminaSessione()">☀️ Mi sono svegliato</button>
        <button type="button" class="btn-secondario" onclick="annullaSessione()">Annulla</button>`;
}

function salvaSveglia() {
    sveglia.letto = document.getElementById("svLetto").value || sveglia.letto;
    sveglia.ora = document.getElementById("svOra").value || sveglia.ora;
    sveglia.attiva = document.getElementById("svAttiva").checked;

    if (sveglia.attiva) {
        preparaAudio();
        richiediPermessoNotifiche();
    }
    if (sveglia.sessione) {
        sveglia.sessione.sveglia = sveglia.attiva ? prossimaSveglia(sveglia.ora, sveglia.sessione.inizio) : null;
    }
    salvaDati("sveglia", sveglia);
    mostraSveglia();
    aggiornaMiniCard();
}

function vadoADormire() {
    preparaAudio();
    richiediPermessoNotifiche();
    const adesso = Date.now();
    sveglia.sessione = {
        inizio: adesso,
        sveglia: sveglia.attiva ? prossimaSveglia(sveglia.ora, adesso) : null
    };
    salvaDati("sveglia", sveglia);
    richiediWakeLock();
    mostraSveglia();
    aggiornaMiniCard();
    mostraToast(sveglia.attiva ? `Buonanotte! Sveglia alle ${sveglia.ora} 🌙` : "Buonanotte! 🌙");
}

// Fine del sonno (dalla sveglia o con "Mi sono svegliato"): le ore si salvano da sole
function terminaSessione() {
    const s = sveglia.sessione;
    if (!s) return;

    // se la sveglia è già suonata si contano al massimo 30 minuti oltre l'orario
    let fine = Date.now();
    if (s.sveglia) fine = Math.min(fine, s.sveglia + 30 * 60000);
    const minuti = Math.round((fine - s.inizio) / 60000);

    sveglia.sessione = null;
    salvaDati("sveglia", sveglia);
    rilasciaWakeLock();

    if (minuti < 30) {
        mostraToast("Sessione troppo breve: sonno non registrato", true);
    } else {
        const ore = Math.round((minuti / 60) * 4) / 4;
        impostaSonno(isoDaData(new Date(fine)), ore);
        mostraToast(`Buongiorno! Hai dormito ${fmtOre(ore)} 😴`);
    }
    aggiornaPaginaCorrente();
}

function annullaSessione() {
    sveglia.sessione = null;
    salvaDati("sveglia", sveglia);
    rilasciaWakeLock();
    if (overlayAperto) chiudiOverlaySveglia();
    mostraToast("Sessione annullata");
    aggiornaPaginaCorrente();
}

function controllaSveglia() {
    if (!utenteCorrente) return;
    if (giornoCorrente && giornoCorrente !== oggiISO()) nuovoGiorno();

    const s = sveglia.sessione;
    if (!s) return;

    const paginaSonno = document.getElementById("progressi").classList.contains("attiva") && sezioneProgressi === "sonno";
    if (paginaSonno) mostraSessioneSveglia();

    if (sveglia.attiva && s.sveglia && Date.now() >= s.sveglia && !overlayAperto) apriOverlaySveglia();
}

function avviaTimerSveglia() {
    clearInterval(timerSveglia);
    timerSveglia = setInterval(controllaSveglia, 5000);
}

function apriOverlaySveglia() {
    const s = sveglia.sessione;
    const fine = Math.min(Date.now(), s.sveglia + 30 * 60000);
    overlayAperto = true;
    document.getElementById("osOra").textContent = hhmm(new Date());
    document.getElementById("osTesto").textContent =
        `Buongiorno${nomeUtente ? " " + nomeUtente : ""}! Finora hai dormito ${fmtMinuti(Math.max(0, Math.round((fine - s.inizio) / 60000)))}.`;
    document.getElementById("overlaySveglia").style.display = "flex";
    avviaSuonoSveglia();
    notifica("⏰ Sveglia", `Sono le ${hhmm(new Date())}. Apri NutriTrack per spegnerla.`);
}

function chiudiOverlaySveglia() {
    overlayAperto = false;
    fermaSuonoSveglia();
    document.getElementById("overlaySveglia").style.display = "none";
}

function spegniSveglia() {
    chiudiOverlaySveglia();
    terminaSessione();
}

function posticipaSveglia() {
    chiudiOverlaySveglia();
    if (sveglia.sessione) {
        sveglia.sessione.sveglia = Date.now() + 5 * 60000;
        salvaDati("sveglia", sveglia);
    }
    mostraToast("Sveglia posticipata di 5 minuti ⏰");
    aggiornaPaginaCorrente();
}

// suono generato dal browser (nessun file audio)
function preparaAudio() {
    try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC && !ctxAudio) ctxAudio = new AC();
        if (ctxAudio && ctxAudio.state === "suspended") ctxAudio.resume();
    } catch (e) { /* audio non disponibile */ }
}

function bip(frequenza, durata) {
    if (!ctxAudio) return;
    const t = ctxAudio.currentTime;
    const osc = ctxAudio.createOscillator();
    const volume = ctxAudio.createGain();
    osc.type = "sine";
    osc.frequency.value = frequenza;
    volume.gain.setValueAtTime(0.0001, t);
    volume.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
    volume.gain.exponentialRampToValueAtTime(0.0001, t + durata);
    osc.connect(volume);
    volume.connect(ctxAudio.destination);
    osc.start(t);
    osc.stop(t + durata + 0.05);
}

function avviaSuonoSveglia() {
    fermaSuonoSveglia();
    const ciclo = () => {
        [880, 880, 1175].forEach((f, i) => setTimeout(() => { try { bip(f, 0.2); } catch (e) { /* ok */ } }, i * 260));
        try { if (navigator.vibrate) navigator.vibrate([250, 120, 250]); } catch (e) { /* ok */ }
    };
    ciclo();
    timerSuono = setInterval(ciclo, 1600);
}

function fermaSuonoSveglia() {
    if (timerSuono) clearInterval(timerSuono);
    timerSuono = null;
    try { if (navigator.vibrate) navigator.vibrate(0); } catch (e) { /* ok */ }
}

function richiediPermessoNotifiche() {
    try {
        if ("Notification" in window && Notification.permission === "default") Notification.requestPermission();
    } catch (e) { /* ok */ }
}

function notifica(titolo, corpo) {
    try {
        if ("Notification" in window && Notification.permission === "granted") {
            new Notification(titolo, { body: corpo, icon: `img/logo-icona-${document.documentElement.dataset.tema || "foresta"}.png` });
        }
    } catch (e) { /* ok */ }
}

// durante il sonno lo schermo resta acceso, così la sveglia può suonare
async function richiediWakeLock() {
    try {
        if ("wakeLock" in navigator && !wakeLock) {
            wakeLock = await navigator.wakeLock.request("screen");
            wakeLock.addEventListener("release", () => { wakeLock = null; });
        }
    } catch (e) { /* ok */ }
}

function rilasciaWakeLock() {
    try { if (wakeLock) wakeLock.release(); } catch (e) { /* ok */ }
    wakeLock = null;
}

function ripristinaWakeLock() {
    if (sveglia.sessione) richiediWakeLock();
}

document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible" || !utenteCorrente) return;
    controllaSveglia();
    ripristinaWakeLock();
});

// --- TOAST NOTIFICATION ---
function mostraToast(msg, errore = false) {
    const t = document.createElement("div");
    t.className = "toast" + (errore ? " toast-err" : "");
    t.textContent = msg;
    const aperti = document.querySelectorAll(".toast").length;
    if (aperti) t.style.bottom = `${105 + aperti * 58}px`;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2500);
}

// --- INIZIALIZZAZIONE ---
window.addEventListener("DOMContentLoaded", () => {
    costruisciSelettoreTemi();
    applicaTema(localStorage.getItem(CHIAVE_TEMA) || "foresta", false);

    const chiave = localStorage.getItem(CHIAVE_SESSIONE);
    if (chiave && trovaUtente(chiave)) {
        avviaSessione(chiave);
    } else {
        localStorage.removeItem(CHIAVE_SESSIONE);
        mostraSchermataAuth();
    }
});
