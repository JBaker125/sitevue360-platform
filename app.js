const DEMO_DATA = (() => {
  const cities = ["Manchester","Birmingham","Leeds","Bristol","London","Liverpool","Sheffield","Nottingham","Newcastle","Cardiff"];
  const types = ["Commercial","Industrial","Retail","Education","Healthcare"];
  const roofs = ["Standing Seam","Single Ply","Built-Up Felt","Metal Profile","Liquid Applied"];
  const clients = ["Demonstration Portfolio","North Estate Group","Central Assets Ltd"];
  const thermal = ["Excellent","Good","Average","Poor","Fail"];
  const energy = ["Excellent","Good","Average","Poor","Fail"];
  const rows = [];
  for (let i=1;i<=50;i++) {
    const rag = i<=32 ? "Green" : i<=45 ? "Amber" : "Red";
    const life = rag==="Green" ? 11 + (i%10) : rag==="Amber" ? 4 + (i%7) : Math.max(0, i%4);
    const works = rag==="Green" ? (i%8===0 ? "Yes":"No") : "Yes";
    const est = rag==="Green" ? 8000 + i*650 : rag==="Amber" ? 28000 + i*1800 : 98000 + i*4200;
    const future = Math.round(est * (rag==="Green" ? 1.15 : rag==="Amber" ? 1.42 : 1.72));
    const t = rag==="Green" ? thermal[i%3] : rag==="Amber" ? thermal[2 + (i%2)] : thermal[3 + (i%2)];
    const e = rag==="Green" ? energy[i%3] : rag==="Amber" ? energy[2 + (i%2)] : energy[3 + (i%2)];
    rows.push({
      buildingId:`SV-${String(i).padStart(3,"0")}`,
      buildingName:`${cities[(i-1)%cities.length]} ${["House","Centre","Works","Campus","Point"][i%5]}`,
      clientName:clients[i%clients.length],
      address:`${10+i} Portfolio Road, ${cities[(i-1)%cities.length]}`,
      buildingType:types[i%types.length],
      roofType:roofs[i%roofs.length],
      roofAge:6 + (i*3)%38,
      surveyDate:`2026-${String((i%6)+1).padStart(2,"0")}-${String((i%24)+1).padStart(2,"0")}`,
      ragRating:rag,
      worksRequired:works,
      estimatedCosts:est,
      serviceableLife:life,
      thermalAssessment:t,
      energyAssessment:e,
      portfolioScore:rag==="Green" ? 88+(i%11) : rag==="Amber" ? 70+(i%14) : 48+(i%18),
      futureCosts:future
    });
  }
  return rows;
})();

let allBuildings = structuredClone(DEMO_DATA);
let filteredBuildings = structuredClone(DEMO_DATA);
let selectedBuildingId = allBuildings[0]?.buildingId;
let singleSiteMode = false;
let lastPortfolioFiltered = structuredClone(DEMO_DATA);

const $ = (id) => document.getElementById(id);
const currency = (n) => new Intl.NumberFormat("en-GB", {style:"currency",currency:"GBP",maximumFractionDigits:0}).format(n);
const compactMoney = (n) => n >= 1_000_000 ? `£${(n/1_000_000).toFixed(1)}m` : currency(n);
const norm = (s) => String(s ?? "").trim().toLowerCase();
const poorOrFail = (v) => ["poor","fail"].includes(norm(v));

function computeAnalytics(data) {
  const total = data.length || 1;
  const green = data.filter(x=>norm(x.ragRating)==="green").length;
  const amber = data.filter(x=>norm(x.ragRating)==="amber").length;
  const red = data.filter(x=>norm(x.ragRating)==="red").length;
  const works = data.filter(x=>["yes","true","1"].includes(norm(x.worksRequired))).length;
  const immediate = data.filter(x=>norm(x.ragRating)==="red" || Number(x.serviceableLife)<3).length;
  const future = data.reduce((a,x)=>a+Number(x.futureCosts||0),0);
  const estimated = data.reduce((a,x)=>a+Number(x.estimatedCosts||0),0);
  const thermalOpp = data.filter(x=>poorOrFail(x.thermalAssessment) || norm(x.thermalAssessment)==="average").length;
  const energyOpp = data.filter(x=>poorOrFail(x.energyAssessment) || norm(x.energyAssessment)==="average").length;
  const lifeAlert = data.filter(x=>Number(x.serviceableLife)<5).length;
  const avgLife = data.reduce((a,x)=>a+Number(x.serviceableLife||0),0)/total;
  const weightedHealth = Math.round(data.reduce((a,x)=> {
    const rag = norm(x.ragRating)==="green" ? 100 : norm(x.ragRating)==="amber" ? 72 : 42;
    const life = Math.min(100, Number(x.serviceableLife||0)*7);
    const thermalScore = norm(x.thermalAssessment)==="excellent"?100:norm(x.thermalAssessment)==="good"?88:norm(x.thermalAssessment)==="average"?68:norm(x.thermalAssessment)==="poor"?42:25;
    const energyScore = norm(x.energyAssessment)==="excellent"?100:norm(x.energyAssessment)==="good"?88:norm(x.energyAssessment)==="average"?68:norm(x.energyAssessment)==="poor"?42:25;
    return a + rag*.45 + life*.20 + thermalScore*.175 + energyScore*.175;
  },0)/total);
  return {total:data.length,green,amber,red,works,immediate,future,estimated,thermalOpp,energyOpp,lifeAlert,avgLife,health:weightedHealth};
}

function riskClass(rag) {
  const v=norm(rag);
  return v==="green" ? "risk-green" : v==="amber" ? "risk-amber" : "risk-red";
}

function recommendationFor(b) {
  const r=norm(b.ragRating), life=Number(b.serviceableLife), future=Number(b.futureCosts);
  if (r==="red" && (poorOrFail(b.thermalAssessment) || poorOrFail(b.energyAssessment))) return "Urgent technical review and immediate intervention are recommended.";
  if (r==="red" || life<3) return "Immediate intervention and CAPEX planning are recommended.";
  if (r==="amber" || life<5) return "Planned intervention and CAPEX planning are advised.";
  if (poorOrFail(b.thermalAssessment)) return "Thermal improvements and further technical review are advised.";
  if (poorOrFail(b.energyAssessment)) return "Energy performance improvements are advised.";
  if (future>100000) return "Future liability requires inclusion within the planned works programme.";
  return "No immediate intervention is required. Continue planned monitoring.";
}

function populateFilters() {
  const client=$("clientFilter"), type=$("typeFilter");
  const currentClient=client.value, currentType=type.value;
  client.innerHTML='<option value="">All clients</option>'+[...new Set(allBuildings.map(x=>x.clientName))].sort().map(v=>`<option>${v}</option>`).join("");
  type.innerHTML='<option value="">All building types</option>'+[...new Set(allBuildings.map(x=>x.buildingType))].sort().map(v=>`<option>${v}</option>`).join("");
  client.value=currentClient; type.value=currentType;
}

function applyFilters() {
  const c=norm($("clientFilter").value), t=norm($("typeFilter").value), r=norm($("ragFilter").value), q=norm($("searchInput").value);
  lastPortfolioFiltered=allBuildings.filter(b => (!c || norm(b.clientName)===c) && (!t || norm(b.buildingType)===t) && (!r || norm(b.ragRating)===r) && (!q || [b.buildingId,b.buildingName,b.clientName,b.address].some(v=>norm(v).includes(q))));
  filteredBuildings = singleSiteMode ? lastPortfolioFiltered.filter(b=>b.buildingId===selectedBuildingId) : structuredClone(lastPortfolioFiltered);
  renderAll();
}


function openBuilding(buildingId,switchView=false){selectedBuildingId=buildingId;singleSiteMode=true;filteredBuildings=allBuildings.filter(b=>b.buildingId===buildingId);renderAll();if(switchView){document.querySelectorAll(".nav button").forEach(x=>x.classList.toggle("active",x.dataset.view==="technical"));document.querySelectorAll(".view").forEach(x=>x.classList.toggle("active",x.id==="technical"));}window.scrollTo({top:0,behavior:"smooth"});sendTwinContext();}
function clearBuildingSelection(){singleSiteMode=false;filteredBuildings=structuredClone(lastPortfolioFiltered);renderAll();}
function renderPropertyBrowser(){const source=lastPortfolioFiltered||filteredBuildings;$("matchingCount").textContent=`${source.length} found`;$("matchingPropertyList").innerHTML=source.map(b=>`<button class="property-card ${b.buildingId===selectedBuildingId&&singleSiteMode?"active":""}" data-property-card="${b.buildingId}"><div class="property-card-top"><strong>${b.buildingName}</strong><span class="risk-pill ${riskClass(b.ragRating)}">${b.ragRating}</span></div><small>${b.buildingId} · ${b.address}<br>${b.serviceableLife} years remaining · ${currency(Number(b.futureCosts))} future liability</small></button>`).join("")||`<div class="empty">No matching properties.</div>`;document.querySelectorAll("[data-property-card]").forEach(btn=>btn.onclick=()=>openBuilding(btn.dataset.propertyCard));const b=allBuildings.find(x=>x.buildingId===selectedBuildingId);if(!b){$("selectedPropertySummary").innerHTML='<div class="empty">Select a property to open its SiteVue360 intelligence.</div>';}else{$("selectedPropertySummary").innerHTML=`<div class="property-detail-head"><div><div class="eyebrow">Selected property</div><h2 style="margin:6px 0 4px;">${b.buildingName}</h2><div class="subtle">${b.buildingId} · ${b.address}</div></div><span class="risk-pill ${riskClass(b.ragRating)}">${b.ragRating}</span></div><div class="grid tech-detail-grid"><div class="metric"><span>Client</span><strong>${b.clientName}</strong></div><div class="metric"><span>Serviceable life</span><strong>${b.serviceableLife} years</strong></div><div class="metric"><span>Future liability</span><strong>${currency(Number(b.futureCosts))}</strong></div><div class="metric"><span>Works required</span><strong>${b.worksRequired}</strong></div><div class="metric"><span>Thermal</span><strong>${b.thermalAssessment}</strong></div><div class="metric"><span>Energy</span><strong>${b.energyAssessment}</strong></div></div><div class="reco"><b>SiteVue360 recommendation</b><br>${recommendationFor(b)}</div><div class="property-actions"><button class="primary-btn" id="openTechnicalBtn">Open full building record</button><button class="secondary-btn" id="siteOnlyBtn">${singleSiteMode?"Site-only view active":"Show only this site"}</button></div>`;$("openTechnicalBtn").onclick=()=>openBuilding(b.buildingId,true);$("siteOnlyBtn").onclick=()=>openBuilding(b.buildingId,false);}$("selectionBanner").classList.toggle("visible",singleSiteMode);if(singleSiteMode&&b){$("selectionTitle").textContent=`Single-site view: ${b.buildingName}`;$("selectionCopy").textContent="All dashboard intelligence is currently calculated for this property only.";}}
function sendTwinContext(){const frame=document.querySelector("#twinFrame iframe");const b=allBuildings.find(x=>x.buildingId===selectedBuildingId);if(!frame||!b)return;frame.contentWindow?.postMessage({source:"SITEVUE360",type:"SITEVUE360_BUILDING_SELECTED",buildingId:b.buildingId,buildingName:b.buildingName,clientName:b.clientName},"*");}
function loadTwinViewer(){const raw=$("twinUrlInput").value.trim();if(!raw)return alert("Enter the secure HTTPS URL for your digital twin viewer.");if(!/^https:\/\//i.test(raw))return alert("The digital twin viewer must use HTTPS.");const b=allBuildings.find(x=>x.buildingId===selectedBuildingId);const url=new URL(raw);if(b)url.searchParams.set("buildingId",b.buildingId);$("twinFrame").innerHTML=`<iframe id="digitalTwinIframe" src="${url.toString()}" allow="fullscreen; xr-spatial-tracking" referrerpolicy="strict-origin-when-cross-origin"></iframe>`;document.querySelector("#twinFrame iframe").addEventListener("load",sendTwinContext);}

function renderExecutive() {
  const a=computeAnalytics(filteredBuildings);
  $("kpiTotal").textContent=a.total;
  $("kpiHealth").textContent=a.health+"%";
  $("kpiFuture").textContent=compactMoney(a.future);
  $("kpiWorks").textContent=a.works;
  $("kpiThermal").textContent=a.thermalOpp;
  $("kpiEnergy").textContent=a.energyOpp;
  $("greenCount").textContent=a.green; $("amberCount").textContent=a.amber; $("redCount").textContent=a.red;
  $("donutHealth").textContent=a.health+"%";
  const gt=a.total? a.green/a.total*100:0, at=a.total? a.amber/a.total*100:0;
  $("ragDonut").style.background=`conic-gradient(var(--green) 0 ${gt}%, var(--amber) ${gt}% ${gt+at}%, var(--red) ${gt+at}% 100%)`;

  const noImmediate=Math.max(0,a.total-a.immediate);
  const noImmediatePct=a.total?Math.round(noImmediate/a.total*100):0;
  const status = a.red>0
    ? `${a.red} high-risk asset${a.red===1?"":"s"} require priority review.`
    : a.amber>0 ? "CAPEX planning is recommended across the current works cycle."
    : "No immediate intervention is required.";
  $("heroSummary").textContent=status;
  $("executiveNarrative").innerHTML =
    `SiteVue360 has analysed <b>${a.total} buildings</b> and identified an overall portfolio health score of <b>${a.health}%</b>. `+
    `<b>${a.works} buildings</b> require planned or immediate works, with forecast future liabilities of <b>${compactMoney(a.future)}</b>. `+
    `<b>${noImmediatePct}%</b> of the filtered portfolio requires no immediate intervention.`;

  const insights = [
    ["⚠", "Immediate intervention", `${a.immediate} buildings meet high-risk or short-life criteria.`],
    ["£", "CAPEX planning", `${compactMoney(a.future)} of future liability is currently forecast.`],
    ["↗", "Thermal opportunity", `${a.thermalOpp} buildings present thermal improvement opportunities.`],
    ["⚡", "Energy opportunity", `${a.energyOpp} buildings present energy improvement opportunities.`]
  ];
  $("priorityInsights").innerHTML=insights.map(x=>`<div class="insight"><div class="insight-icon">${x[0]}</div><div><b>${x[1]}</b><span>${x[2]}</span></div></div>`).join("");

  const lifeBuckets = [
    ["<1", filteredBuildings.filter(x=>Number(x.serviceableLife)<1).length],
    ["1–3", filteredBuildings.filter(x=>Number(x.serviceableLife)>=1 && Number(x.serviceableLife)<3).length],
    ["3–5", filteredBuildings.filter(x=>Number(x.serviceableLife)>=3 && Number(x.serviceableLife)<5).length],
    ["5–10", filteredBuildings.filter(x=>Number(x.serviceableLife)>=5 && Number(x.serviceableLife)<10).length],
    ["10+", filteredBuildings.filter(x=>Number(x.serviceableLife)>=10).length]
  ];
  const max=Math.max(1,...lifeBuckets.map(x=>x[1]));
  $("lifeChart").innerHTML=lifeBuckets.map(([label,val])=>`<div class="bar-col"><span class="bar-value">${val}</span><div class="bar" style="height:${Math.max(6,val/max*130)}px"></div><span class="bar-label">${label}</span></div>`).join("");
}

function renderPortfolio() {
  $("portfolioRowCount").textContent=`${filteredBuildings.length} buildings`;
  $("portfolioTable").innerHTML = filteredBuildings.map(b=>`
    <tr data-open-building="${b.buildingId}" style="cursor:pointer;">
      <td>${b.buildingId}</td><td>${b.buildingName}</td><td>${b.clientName}</td><td>${b.buildingType}</td>
      <td><span class="risk-pill ${riskClass(b.ragRating)}">${b.ragRating}</span></td>
      <td>${b.worksRequired}</td><td>${b.serviceableLife} yrs</td><td>${b.thermalAssessment}</td><td>${b.energyAssessment}</td><td>${currency(Number(b.futureCosts))}</td>
    </tr>`).join("") || `<tr><td colspan="10" class="empty">No buildings match the selected filters.</td></tr>`;
}

function renderTechnical() {
  if (!filteredBuildings.some(x=>x.buildingId===selectedBuildingId)) selectedBuildingId=filteredBuildings[0]?.buildingId;
  $("buildingList").innerHTML=filteredBuildings.map(b=>`
    <button class="building-btn ${b.buildingId===selectedBuildingId?"active":""}" data-building="${b.buildingId}">
      <strong>${b.buildingName}</strong><small>${b.buildingId} · ${b.ragRating} · ${b.serviceableLife} years remaining</small>
    </button>`).join("") || `<div class="empty">No buildings available.</div>`;

  document.querySelectorAll("[data-building]").forEach(btn=>btn.onclick=()=>{selectedBuildingId=btn.dataset.building;renderTechnical();});
  const b=filteredBuildings.find(x=>x.buildingId===selectedBuildingId);
  if (!b) { $("technicalDetail").innerHTML='<div class="empty">Select a building to view its Building Intelligence Record.</div>'; return; }
  $("technicalDetail").innerHTML=`
    <div class="panel-title"><div><h2>${b.buildingName}</h2><div class="subtle">${b.buildingId} · ${b.address}</div></div><span class="risk-pill ${riskClass(b.ragRating)}">${b.ragRating}</span></div>
    <div class="grid tech-detail-grid">
      <div class="metric"><span>Client</span><strong>${b.clientName}</strong></div>
      <div class="metric"><span>Building type</span><strong>${b.buildingType}</strong></div>
      <div class="metric"><span>Roof system</span><strong>${b.roofType}</strong></div>
      <div class="metric"><span>Roof age</span><strong>${b.roofAge} years</strong></div>
      <div class="metric"><span>Serviceable life</span><strong>${b.serviceableLife} years</strong></div>
      <div class="metric"><span>Works required</span><strong>${b.worksRequired}</strong></div>
      <div class="metric"><span>Estimated cost</span><strong>${currency(Number(b.estimatedCosts))}</strong></div>
      <div class="metric"><span>Future liability</span><strong>${currency(Number(b.futureCosts))}</strong></div>
      <div class="metric"><span>Portfolio score</span><strong>${b.portfolioScore}%</strong></div>
      <div class="metric"><span>Thermal assessment</span><strong>${b.thermalAssessment}</strong></div>
      <div class="metric"><span>Energy assessment</span><strong>${b.energyAssessment}</strong></div>
      <div class="metric"><span>Survey date</span><strong>${b.surveyDate}</strong></div>
    </div>
    <div class="reco"><b>SiteVue360 recommendation</b><br>${recommendationFor(b)}</div>`;
}

function renderIntelligence() {
  const a=computeAnalytics(filteredBuildings);
  const actions = [
    [a.red ? "Immediate action" : "Portfolio position", a.red ? `${a.red} high-risk assets require priority intervention.` : "No high-risk assets are present in the filtered portfolio."],
    ["CAPEX planning", `${compactMoney(a.future)} of future expenditure should be considered within portfolio planning.`],
    ["Lifecycle planning", `${a.lifeAlert} buildings have fewer than five years of serviceable life remaining.`],
    ["Performance opportunity", `${a.thermalOpp} thermal and ${a.energyOpp} energy improvement opportunities have been identified.`]
  ];
  $("actionList").innerHTML=actions.map((x,i)=>`<div class="insight"><div class="insight-icon">${["!","£","◷","↗"][i]}</div><div><b>${x[0]}</b><span>${x[1]}</span></div></div>`).join("");

  const buckets=[
    ["Immediate", filteredBuildings.filter(x=>norm(x.ragRating)==="red" || Number(x.serviceableLife)<3).reduce((a,x)=>a+Number(x.futureCosts),0)],
    ["1–3 yrs", filteredBuildings.filter(x=>Number(x.serviceableLife)>=3 && Number(x.serviceableLife)<5).reduce((a,x)=>a+Number(x.futureCosts),0)],
    ["3–5 yrs", filteredBuildings.filter(x=>Number(x.serviceableLife)>=5 && Number(x.serviceableLife)<10).reduce((a,x)=>a+Number(x.futureCosts),0)],
    ["5+ yrs", filteredBuildings.filter(x=>Number(x.serviceableLife)>=10).reduce((a,x)=>a+Number(x.futureCosts),0)]
  ];
  const max=Math.max(1,...buckets.map(x=>x[1]));
  $("costChart").innerHTML=buckets.map(([label,val])=>`<div class="bar-col"><span class="bar-value">${compactMoney(val)}</span><div class="bar" style="height:${Math.max(6,val/max*130)}px"></div><span class="bar-label">${label}</span></div>`).join("");
  $("traceabilityText").innerHTML=`Every portfolio output is generated from the filtered Building Intelligence Records. The current summary uses <b>${filteredBuildings.length} records</b>, applying RAG, serviceable-life, works, thermal, energy and cost rules before presenting the resulting intelligence.`;
}

function renderAll() {
  renderPropertyBrowser(); renderExecutive(); renderPortfolio(); renderTechnical(); renderIntelligence();
  document.querySelectorAll("[data-open-building]").forEach(row=>row.onclick=()=>openBuilding(row.dataset.openBuilding,true));
  $("updatedAt").textContent="Last updated: "+new Date().toLocaleString("en-GB",{dateStyle:"medium",timeStyle:"short"});
}

function parseCSV(text) {
  const lines=text.replace(/\r/g,"").split("\n").filter(Boolean);
  if(lines.length<2) throw new Error("CSV contains no data rows.");
  const split=(line)=>{ const out=[]; let cur="",quoted=false; for(let i=0;i<line.length;i++){ const c=line[i]; if(c==='"' && line[i+1]==='"'){cur+='"';i++;} else if(c==='"') quoted=!quoted; else if(c===","&&!quoted){out.push(cur.trim());cur="";} else cur+=c; } out.push(cur.trim()); return out; };
  const headers=split(lines[0]).map(h=>norm(h).replace(/[^a-z0-9]/g,""));
  const map = {
    buildingid:"buildingId", buildingname:"buildingName", clientname:"clientName", buildingaddress:"address", address:"address",
    buildingtype:"buildingType", rooftype:"roofType", roofageyears:"roofAge", roofage:"roofAge", surveydate:"surveyDate",
    ragrating:"ragRating", worksrequiredyesno:"worksRequired", worksrequired:"worksRequired", estimatedcosts:"estimatedCosts",
    estimatedcosts:"estimatedCosts", serviceableliferemainingyears:"serviceableLife", serviceablelife:"serviceableLife",
    thermalassessment:"thermalAssessment", energyassessment:"energyAssessment", portfolioscore:"portfolioScore",
    futurecosts:"futureCosts"
  };
  return lines.slice(1).map(line=>{
    const vals=split(line), obj={};
    headers.forEach((h,i)=>{ if(map[h]) obj[map[h]]=vals[i]; });
    ["roofAge","estimatedCosts","serviceableLife","portfolioScore","futureCosts"].forEach(k=>obj[k]=Number(String(obj[k]||0).replace(/[^0-9.-]/g,"")));
    return obj;
  }).filter(x=>x.buildingId||x.buildingName);
}

document.querySelectorAll(".nav button").forEach(btn=>btn.onclick=()=>{
  document.querySelectorAll(".nav button").forEach(x=>x.classList.remove("active"));
  document.querySelectorAll(".view").forEach(x=>x.classList.remove("active"));
  btn.classList.add("active"); $(btn.dataset.view).classList.add("active");
});

["clientFilter","typeFilter","ragFilter"].forEach(id=>$(id).addEventListener("change",applyFilters));
$("searchInput").addEventListener("input",applyFilters);
$("resetBtn").onclick=()=>{allBuildings=structuredClone(DEMO_DATA);lastPortfolioFiltered=structuredClone(DEMO_DATA);filteredBuildings=structuredClone(DEMO_DATA);selectedBuildingId=allBuildings[0].buildingId;singleSiteMode=false;populateFilters();renderAll();};
$("clearSiteSelection").onclick=clearBuildingSelection;
$("loadTwinBtn").onclick=loadTwinViewer;
window.addEventListener("message",event=>{const data=event.data||{};if(data.source==="DIGITAL_TWIN"&&data.type==="BUILDING_SELECTED"&&data.buildingId&&allBuildings.some(b=>b.buildingId===data.buildingId))openBuilding(data.buildingId,false);if(data.source==="DIGITAL_TWIN"&&data.type==="ASSET_SELECTED")console.info("Digital twin asset selected:",data);});
$("csvInput").addEventListener("change", async (e)=>{
  const file=e.target.files[0]; if(!file) return;
  try {
    const rows=parseCSV(await file.text());
    if(!rows.length) throw new Error("No usable records were found.");
    allBuildings=rows; lastPortfolioFiltered=structuredClone(rows); filteredBuildings=rows; selectedBuildingId=rows[0]?.buildingId; singleSiteMode=false; populateFilters(); renderAll();
    alert(`Imported ${rows.length} building records.`);
  } catch(err) { alert("CSV import failed: "+err.message); }
  e.target.value="";
});

populateFilters();
renderAll();
