const state={token:null,user:null};
const $=s=>document.querySelector(s);
async function api(path,options={}){const headers={"Content-Type":"application/json",...(options.headers||{})};if(state.token)headers.Authorization=`Bearer ${state.token}`;const res=await fetch(`/api/${path}`, {...options,headers});const reqId=res.headers.get('X-Request-ID');const data=await res.json().catch(()=>({error:"Unexpected response"}));if(!res.ok)throw new Error((data.error||"Request failed")+(reqId?` (Trace: ${reqId})`:''));if(reqId)data._reqId=reqId;return data}
function message(el,text,error=false){el.textContent=text;el.className=`message ${error?'error':'success'}`}
let metricsInterval;
function show(view){
  document.querySelectorAll('.view').forEach(x=>x.hidden=x.id!==view);
  document.querySelectorAll('[data-view]').forEach(x=>x.classList.toggle('active',x.dataset.view===view));
  clearInterval(metricsInterval);
  if(view==='courses')loadCourses();
  if(view==='materials')loadMaterials();
  if(view==='private')loadPrivate();
  if(view==='admin'){ loadMetrics(); metricsInterval = setInterval(loadMetrics, 2000); }
}
function renderTable(rows){if(!rows.length)return '<p>No records available.</p>';const heads=Object.keys(rows[0]);return `<table><thead><tr>${heads.map(x=>`<th>${x.replaceAll('_',' ')}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${heads.map(h=>`<td>${String(r[h]??'').replace('T',' ').slice(0,19)}</td>`).join('')}</tr>`).join('')}</tbody></table>`}
async function loadCourses(){try{const rows=await api('courses');$('#course-list').innerHTML=rows.map(c=>`<article><span class="badge public">${c.code}</span><h3>${c.title}</h3><p>${c.department}<br>${c.credits} credits · ${c.seats} seats</p><button onclick="registerCourse(${c.id})">Register for Semester 5</button></article>`).join('')}catch(e){$('#course-list').textContent=e.message}}
async function loadMaterials(){try{const rows=await api('materials');$('#material-list').innerHTML=rows.map(m=>`<article><span class="badge public">${m.course_code}</span><h3>${m.title}</h3><p>${m.description}</p><a class="resource" href="${m.resource_url}" target="_blank">Open learning resource ↗</a></article>`).join('')}catch(e){$('#material-list').textContent=e.message}}
async function loadPrivate(){try{const [a,f]=await Promise.all([api('academics'),api('finance')]);$('#academic-records').innerHTML=`<p class="trace-info">Trace: ${a._reqId||''} → ${a._trace?.private_service||'private-api'}</p>`+renderTable(a.records);$('#finance-records').innerHTML=`<p class="trace-info">Trace: ${f._reqId||''} → ${f._trace?.private_service||'private-api'}</p>`+renderTable(f.records)}catch(e){$('#academic-records').textContent=e.message}}
let charts={}; const chData={t:[], reqs:[], rep:[], avgL:[], p95L:[]};
function initCharts(){
  if(charts.traffic) return;
  Chart.defaults.font.family='system-ui';
  charts.traffic=new Chart($('#traffic-chart').getContext('2d'),{type:'line',data:{labels:chData.t,datasets:[{label:'Req/s',data:chData.reqs,borderColor:'#1677c8',tension:0.3}]},options:{animation:{duration:0},scales:{y:{beginAtZero:true}}}});
  charts.replicas=new Chart($('#replicas-chart').getContext('2d'),{type:'bar',data:{labels:chData.t,datasets:[{label:'Replicas',data:chData.rep,backgroundColor:'#6846c6'}]},options:{animation:{duration:0},scales:{y:{beginAtZero:true,ticks:{stepSize:1}}}}});
  charts.latency=new Chart($('#latency-chart').getContext('2d'),{type:'line',data:{labels:chData.t,datasets:[{label:'Avg Latency',data:chData.avgL,borderColor:'#13795b',tension:0.3},{label:'P95',data:chData.p95L,borderColor:'#ad5c00',borderDash:[5,5],tension:0.3}]},options:{animation:{duration:0},scales:{y:{beginAtZero:true}}}});
}
function updateCharts(m){
  chData.t.push(new Date().toLocaleTimeString()); chData.reqs.push(m.traffic.requestsPerSec); chData.rep.push(m.capacity.currentReplicas); chData.avgL.push(m.traffic.avgLatencyMs); chData.p95L.push(m.traffic.p95LatencyMs);
  if(chData.t.length>30){ chData.t.shift(); chData.reqs.shift(); chData.rep.shift(); chData.avgL.shift(); chData.p95L.shift(); }
  charts.traffic.update(); charts.replicas.update(); charts.latency.update();
}
async function loadMetrics(){try{
  const m=await api('admin/metrics');
  $('#metric-system').innerHTML=`<div class="status-row"><span>Public Cloud</span> <span class="status-indicator healthy">● ${m.system.publicCloud}</span></div><div class="status-row"><span>Private Cloud</span> <span class="status-indicator ${m.system.privateCloud==='HEALTHY'?'healthy':'error'}">● ${m.system.privateCloud}</span></div><div class="status-row"><span>Hybrid Link</span> <span class="status-indicator ${m.system.hybridLink==='HEALTHY'?'healthy':'error'}">● ${m.system.hybridLink}</span></div><div class="status-row"><span>Database</span> <span class="status-indicator healthy">● ${m.system.database}</span></div><div class="status-row"><span>Services</span> <span style="text-align:right;font-size:0.85em;color:#627d98">${m.services.join('<br>')}</span></div>`;$('#metric-traffic').innerHTML=`<div class="status-row"><span>Requests/sec (avg)</span> <strong>${m.traffic.requestsPerSec}</strong></div><div class="status-row"><span>Average latency</span> <strong>${m.traffic.avgLatencyMs} ms</strong></div><div class="status-row"><span>P95 latency</span> <strong>${m.traffic.p95LatencyMs} ms</strong></div><div class="status-row"><span>Error rate</span> <strong>${m.traffic.errorRatePct}%</strong></div>`;$('#metric-capacity').innerHTML=`<div class="status-row"><span>Current replicas</span> <strong>${m.capacity.currentReplicas}</strong></div><div class="status-row"><span>Minimum replicas</span> <strong>${m.capacity.minReplicas}</strong></div><div class="status-row"><span>Maximum replicas</span> <strong>${m.capacity.maxReplicas}</strong></div><div class="status-row"><span>Scaling state</span> <strong class="${m.capacity.scalingState==='BURST MODE'?'badge admin':''}">${m.capacity.scalingState}</strong></div>`;$('#metric-hybrid').innerHTML=`<div class="status-row"><span>Public → Private requests</span> <strong>${m.hybrid.totalRequests}</strong></div><div class="status-row"><span>Successful</span> <strong class="success">${m.hybrid.successful}</strong></div><div class="status-row"><span>Failed</span> <strong class="error">${m.hybrid.failed}</strong></div>`;
  initCharts(); updateCharts(m);
}catch(e){$('#metrics-grid').textContent=e.message}}
window.registerCourse=async id=>{try{const r=await api('registrations',{method:'POST',body:JSON.stringify({course_id:id,semester:'Semester 5'})});alert(r.message)}catch(e){alert(e.message)}};
$('#login-form').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);try{const r=await api('auth/login',{method:'POST',body:JSON.stringify(Object.fromEntries(f))});state.token=r.token;state.user=r.user;$('#auth-view').hidden=true;$('#app-view').hidden=false;$('#identity').innerHTML=`${r.user.full_name}<br><small>${r.user.role}</small>`;$('#admin-tab').hidden=r.user.role!=='admin';show('home')}catch(err){message($('#login-message'),err.message,true)}};
$('#admission-form').onsubmit=async e=>{e.preventDefault();try{const r=await api('admissions',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});message($('#admission-message'),`${r.message}. Reference #${r.application.id}`);e.target.reset()}catch(err){message($('#admission-message'),err.message,true)}};
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>show(b.dataset.view));$('#refresh-metrics').onclick=loadMetrics;$('#logout').onclick=()=>location.reload();

let privateChaos = false;
$('#btn-chaos-private').onclick = async () => { privateChaos = !privateChaos; try { const r = await api('admin/chaos/private', { method: 'POST', body: JSON.stringify({ active: privateChaos }) }); alert(r.message); $('#btn-chaos-private').textContent = privateChaos ? "Restore Private API" : "Kill Private API"; $('#btn-chaos-private').style.background = privateChaos ? "var(--green)" : "#b42318"; } catch(e) { alert(e.message); } };
$('#btn-chaos-public').onclick = async () => { try { const r = await api('admin/chaos/public-cpu', { method: 'POST' }); alert(r.message); } catch(e) { alert(e.message); } };

