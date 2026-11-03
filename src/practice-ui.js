/* Practice games — user interface, session engine, progress storage.
   Uses the existing site classes (panel, quiz-main, option-btn, typed-form, feedback, results, word-card, mode-switch …).
   Rendered inside <section id="practice-view">. Never touches the existing quiz engine in app.js. */
(function(){
'use strict';
const PG=window.PracticeGen,view=document.getElementById('practice-view');if(!PG||!view)return;
const {shuffle,check,G,WORDS,VERBS,TOPIC_LIST,N}=PG;
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const plural=(n,a,b)=>n===1?a:b;
const CATS=[
 {id:'Tenses',title:'Tenses practice',icon:'T',desc:'Identify, convert, correct and build sentences across all 12 tenses.'},
 {id:'Prepositions',title:'Prepositions practice',icon:'P',desc:'Practise every preposition and each of its uses from your notes.'},
 {id:'Conjunctions',title:'Conjunctions practice',icon:'C',desc:'Connect ideas with the right conjunction; compare similar ones.'},
 {id:'Verbs',title:'Verbs practice',icon:'V',desc:'Verb forms V1–V5, regular and irregular verbs, usage and speed.'},
 {id:'Combined',title:'Combined grammar practice',icon:'★',desc:'Mixed tests, weak topics, learn mode, retry and mastery.'}
];
const catOf=id=>CATS.find(c=>c.id===id);
const gamesOf=cat=>G.filter(g=>g.cat===cat);
const FINITE=g=>g.cat==='Prepositions'||g.cat==='Conjunctions'||g.num===8||g.num===10;
const WEAK_MIN=5,WEAK_ACC=70,MASTERY_MIN_Q=20,MASTERY_ATTEMPTS=2;

/* ---------- progress storage (separate key; the existing site stores nothing) ---------- */
const KEY='gp_practice_v1';let mem=null;
const fresh=()=>({v:1,stats:{},mistakes:{},mastery:{},best:{}});
function load(){if(mem)return mem;try{const s=JSON.parse(localStorage.getItem(KEY)||'null');mem=s&&s.v===1?s:fresh();}catch(e){mem=fresh();}return mem;}
function save(){try{localStorage.setItem(KEY,JSON.stringify(mem));}catch(e){}}
function record(q,ok,sess){
  const s=load(),k=q.cat+'::'+q.topic;const st=s.stats[k]||(s.stats[k]={cat:q.cat,topic:q.topic,attempts:0,correct:0});
  st.attempts++;if(ok)st.correct++;
  if(!ok){const m=s.mistakes[q.id]||(s.mistakes[q.id]={q,cat:q.cat,topic:q.topic,count:0});m.count++;m.q=q;
    const keys=Object.keys(s.mistakes);if(keys.length>400)delete s.mistakes[keys[0]];}
  else if(sess&&(sess.g.num===45||sess.g.num===43)&&s.mistakes[q.id])delete s.mistakes[q.id];
  save();
}
const weakTopics=()=>Object.values(load().stats).filter(t=>t.attempts>=WEAK_MIN&&t.correct/t.attempts*100<WEAK_ACC).sort((a,b)=>a.correct/a.attempts-b.correct/b.attempts);

/* ---------- state ---------- */
let S=null,setup={},tick=null;
const clearTimers=()=>{if(tick){clearInterval(tick);tick=null;}};
const originLabel=o=>o==='original'?'Original content (from your notes)':o==='supplementary'?'Supplementary content (written for this project)':'Generated from grammar rules';
const bestLine=g=>{const b=load().best[g.num];return b?` · best ${b.pct}%`:'';};

/* ---------- navigation ---------- */
function goPractice(){const b=document.querySelector('.nav-btn[data-view="practice"]');if(b)b.click();}
function top(backLabel,backFn,tag){view.innerHTML=`<div class="quiz-top"><button class="text-button" id="pg-back">← ${esc(backLabel)}</button><span class="session-tag">${esc(tag||'')}</span></div><div id="pg-screen"></div>`;$('pg-back').addEventListener('click',()=>{clearTimers();backFn();});return $('pg-screen');}
function renderHub(){
  clearTimers();S=null;
  view.innerHTML=`<div class="page-heading"><p class="eyebrow">PRACTICE GAMES</p><h1>Grammar practice games</h1><p class="muted">${G.length} games in five sections. Original grammar content is used first; any extra questions are labelled as supplementary.</p></div>
  <div class="launch-grid">${CATS.map(c=>`<button class="launch-card${c.id==='Combined'?' featured':''}" data-cat="${c.id}"><span class="card-icon">${c.icon}</span><span class="card-title">${esc(c.title)}</span><span class="card-description">${esc(c.desc)}</span><span class="card-action">${gamesOf(c.id).length} games <span>→</span></span></button>`).join('')}</div>`;
  view.querySelectorAll('[data-cat]').forEach(b=>b.addEventListener('click',()=>renderSection(b.dataset.cat)));
}
function renderSection(cat){
  clearTimers();S=null;const c=catOf(cat);const scr=top('Practice games',renderHub,c.title);
  scr.innerHTML=`<div class="page-heading"><p class="eyebrow">SECTION · ${esc(cat.toUpperCase())}</p><h1>${esc(c.title)}</h1><p class="muted">${esc(c.desc)} Choose a game.</p></div>
  <div class="category-grid">${gamesOf(cat).map(g=>`<button class="category-card" data-game="${g.num}"><span class="category-symbol">${g.num}</span><span><strong>${esc(g.title)}</strong><small>${esc(g.desc)}${bestLine(g)}</small><span class="card-action">Open game <span>→</span></span></span></button>`).join('')}</div>`;
  scr.querySelectorAll('[data-game]').forEach(b=>b.addEventListener('click',()=>openGame(+b.dataset.game)));
}
const gameBy=n=>G.find(g=>g.num===n);
function openGame(n){const g=gameBy(n);setup={difficulty:'advanced',count:10,mode:'mc',target:'random',words:new Set(),cats:new Set(['Tenses','Prepositions','Conjunctions','Verbs']),targetAcc:90};
  if(g.special==='weak')return renderWeak(g);if(g.special==='learn')return renderLearn(g);if(g.special==='retry')return renderRetry(g);if(g.special==='mastery')return renderMastery(g);
  renderSetup(g);}

/* ---------- generic setup screen ---------- */
const seg=(name,opts,cur)=>`<div class="mode-switch pg-seg" data-seg="${name}">${opts.map(([v,l])=>`<button type="button" class="mode-btn${String(cur)===String(v)?' active':''}" data-val="${v}">${esc(l)}</button>`).join('')}</div>`;
const row=(label,html,note)=>`<div class="pg-row"><label>${esc(label)}</label>${html}${note?`<p class="input-help">${esc(note)}</p>`:''}</div>`;
function wireSeg(scope,onChange){scope.querySelectorAll('.pg-seg').forEach(sg=>sg.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{sg.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));setup[sg.dataset.seg]=isNaN(+b.dataset.val)?b.dataset.val:+b.dataset.val;if(onChange)onChange(sg.dataset.seg);})));}
const DIFF_NOTE={Tenses:'Beginner = the 3 simple tenses · Intermediate = simple + continuous (6 tenses) · Advanced = all 12 tenses (advanced also adds negative and question forms).',
  Verbs:'Beginner = regular verbs with plain -ed · Intermediate = other regular verbs and irregular verbs whose V2 = V3 · Advanced = all verbs, including fully irregular ones.',Combined:'Applies to the tense and verb questions.'};
function wordGrid(listKey){const items=listKey==='Verbs'?VERBS.map(v=>({id:v.id,label:v.label,n:v.hi})):WORDS(listKey).map(w=>({id:w.id,label:w.label,n:w.uses.length+' '+plural(w.uses.length,'use','uses')}));
  return `<div class="ws-toolbar"><button type="button" class="secondary-btn" id="pg-sa">Select all</button><button type="button" class="secondary-btn" id="pg-da">Deselect all</button><span class="count-label" id="pg-wc">0 selected</span></div>
  <div class="word-grid">${items.map(w=>`<label class="word-card"><input type="checkbox" value="${esc(w.id)}"><span class="word-name">${esc(w.label)}</span><span class="word-uses">${esc(w.n)}</span></label>`).join('')}</div>`;}
function wireWords(scope,after){
  const upd=()=>{$('pg-wc').textContent=setup.words.size+' selected';if(after)after();};
  scope.querySelectorAll('.word-card input').forEach(i=>i.addEventListener('change',()=>{i.checked?setup.words.add(i.value):setup.words.delete(i.value);i.closest('.word-card').classList.toggle('selected',i.checked);upd();}));
  $('pg-sa').addEventListener('click',()=>{scope.querySelectorAll('.word-card input').forEach(i=>{i.checked=true;setup.words.add(i.value);i.closest('.word-card').classList.add('selected');});upd();});
  $('pg-da').addEventListener('click',()=>{scope.querySelectorAll('.word-card input').forEach(i=>{i.checked=false;i.closest('.word-card').classList.remove('selected');});setup.words.clear();upd();});upd();
}
function renderSetup(g){
  const scr=top(catOf(g.cat).title,()=>renderSection(g.cat),`Game ${g.num}`);
  const rows=[];
  if(g.difficulty)rows.push(row('Difficulty',seg('difficulty',[['beginner','Beginner'],['intermediate','Intermediate'],['advanced','Advanced']],setup.difficulty),DIFF_NOTE[g.cat]||''));
  if(g.target)rows.push(row('Target tense',`<select id="pg-target" class="pg-select"><option value="random">Random tense</option>${PG.T.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select>`,'Every sentence is converted to this tense (or to a random one).'));
  if(g.catSelect)rows.push(row('Grammar categories',`<div class="word-grid pg-cats">${['Tenses','Prepositions','Conjunctions','Verbs'].map(c=>`<label class="word-card selected"><input type="checkbox" value="${c}" checked><span class="word-name">${c}</span></label>`).join('')}</div>`));
  if(g.count)rows.push(row('Number of questions',seg('count',[[10,'10'],[20,'20'],[30,'30'],[50,'50'],['all','All available']],setup.count)));
  if(g.modes)rows.push(row('Answer mode',seg('mode',[['mc','Multiple choice'],['typed','Type your answer']],setup.mode),'Questions that need typing, tapping or building use their own input automatically.'));
  scr.innerHTML=`<div class="page-heading"><p class="eyebrow">GAME ${g.num} · ${esc(g.cat.toUpperCase())}</p><h1>${esc(g.title)}</h1><p class="muted">${esc(g.instructions)}${g.timed?' You have '+g.timed+' seconds.':''}</p></div>
  <section class="panel pg-setup">${rows.join('')}${g.words?`<div class="pg-row"><label>${g.words==='Verbs'?'Choose verbs':'Choose '+g.words.toLowerCase()}${g.wordOptional?' (optional — leave empty for all)':''}</label>${wordGrid(g.words)}<div id="pg-wsum" class="ws-summary"></div></div>`:''}
  <div class="ws-actions"><button class="primary-btn" id="pg-start">Start game</button></div></section>`;
  wireSeg(scr);
  if(g.target)$('pg-target').addEventListener('change',e=>setup.target=e.target.value);
  if(g.catSelect)scr.querySelectorAll('.pg-cats input').forEach(i=>i.addEventListener('change',()=>{i.checked?setup.cats.add(i.value):setup.cats.delete(i.value);i.closest('.word-card').classList.toggle('selected',i.checked);$('pg-start').disabled=!setup.cats.size;}));
  if(g.words)wireWords(scr,()=>{if(!g.wordOptional)$('pg-start').disabled=!setup.words.size;});
  $('pg-start').addEventListener('click',()=>startGame(g));
}
function configFor(g){
  const cfg={difficulty:setup.difficulty,count:setup.count==='all'?(FINITE(g)?500:100):setup.count,mode:setup.mode,targetTense:setup.target};
  if(g.words==='Verbs')cfg.verbIds=[...setup.words];else if(g.words)cfg.wordIds=[...setup.words];
  if(g.catSelect)cfg.cats=[...setup.cats];
  if(g.timed||g.count===false)cfg.count=500;
  return cfg;
}
function buildQs(g,cfg){
  let qs;
  if(g.num===42){const cats=cfg.cats.length?cfg.cats:['Tenses'];const per=Math.ceil(cfg.count/cats.length)+2;qs=[];cats.forEach(c=>qs=qs.concat(PG.MIX[c](Object.assign({},cfg,{count:per}))));qs=shuffle(qs);}
  else qs=g.gen(cfg);
  const seen=new Set();qs=qs.filter(q=>q&&!seen.has(q.id)&&seen.add(q.id));
  if(!g.timed&&g.count!==false&&qs.length>cfg.count)qs=qs.slice(0,cfg.count);
  return qs;
}
function startGame(g,extra){
  const cfg=configFor(g);const qs=buildQs(g,cfg);
  if(!qs.length){const scr=$('pg-screen');scr.insertAdjacentHTML('afterbegin','<div class="ws-summary"><p class="warn-line">No questions are available for this selection. Try other options.</p></div>');return;}
  launch(g,qs,{cfg,mode:cfg.mode,back:()=>renderSetup(g),backLabel:'Setup',replay:()=>{const q2=buildQs(g,cfg);launch(g,q2,{cfg,mode:cfg.mode,back:()=>renderSetup(g),replay:S.replay,extra})},extra});
}

/* ---------- special games (43–46) ---------- */
function msgScreen(g,backFn,backLabel,html){const scr=top(backLabel,backFn,`Game ${g.num}`);scr.innerHTML=`<div class="page-heading"><p class="eyebrow">GAME ${g.num} · COMBINED</p><h1>${esc(g.title)}</h1><p class="muted">${esc(g.instructions)}</p></div>${html}`;return scr;}
const sectionBack=()=>renderSection('Combined');
function topicIdFor(cat,label){const t=(TOPIC_LIST[cat]?TOPIC_LIST[cat]():[]).find(x=>x.label===label);return t&&t.id;}
function renderWeak(g){
  const w=weakTopics();const st=Object.values(load().stats);
  const table=st.length?`<div class="table-wrap"><table class="word-table"><thead><tr><th>Category</th><th>Topic</th><th>Attempts</th><th>Accuracy</th><th>Status</th></tr></thead><tbody>${st.sort((a,b)=>a.correct/a.attempts-b.correct/b.attempts).slice(0,40).map(t=>{const acc=Math.round(t.correct/t.attempts*100);return `<tr><td>${esc(t.cat)}</td><td>${esc(t.topic)}</td><td>${t.attempts}</td><td>${acc}%</td><td>${t.attempts<WEAK_MIN?'Not enough attempts':acc<WEAK_ACC?'Weak':'OK'}</td></tr>`;}).join('')}</tbody></table></div>`:'';
  const scr=msgScreen(g,sectionBack,'Combined grammar practice',`<section class="panel pg-setup"><p>A topic counts as <b>weak</b> only after at least ${WEAK_MIN} attempts with accuracy below ${WEAK_ACC}%. Topics with fewer attempts are never marked weak.</p>
  ${w.length?`<p class="warn-line ws-summary"><b>${w.length} weak ${plural(w.length,'topic','topics')}:</b> ${w.slice(0,8).map(t=>esc(t.topic)+' ('+Math.round(t.correct/t.attempts*100)+'%)').join(', ')}</p>${row('Number of questions',seg('count',[[10,'10'],[20,'20'],[30,'30']],setup.count))}<div class="ws-actions"><button class="primary-btn" id="pg-start">Practise weak topics</button></div>`:`<p class="muted">No weak topics yet. Play other games first so there is enough data${st.length?' — your progress so far is shown below':''}.</p>`}${table}</section>`);
  wireSeg(scr);
  const b=$('pg-start');if(b)b.addEventListener('click',()=>{
    const n=setup.count,mis=Object.values(load().mistakes);let qs=[];
    for(const t of w){mis.filter(m=>m.cat===t.cat&&m.topic===t.topic).forEach(m=>qs.push(m.q));
      const id=topicIdFor(t.cat,t.topic);if(id)qs=qs.concat(PG.topicPool(t.cat,id,6));}
    const seen=new Set();qs=qs.filter(q=>!seen.has(q.id)&&seen.add(q.id));
    const first=qs.filter(q=>mis.some(m=>m.q.id===q.id)),rest=shuffle(qs.filter(q=>!mis.some(m=>m.q.id===q.id)));
    qs=shuffle(first).concat(rest).slice(0,n);
    if(!qs.length){scr.insertAdjacentHTML('afterbegin','<div class="ws-summary"><p class="warn-line">No questions could be built for your weak topics.</p></div>');return;}
    launch(g,qs,{cfg:{},mode:'mc',back:()=>renderWeak(g),replay:()=>renderWeak(g)});});
}
function renderLearn(g){
  setup.lcat=setup.lcat||'Tenses';
  const scr=msgScreen(g,sectionBack,'Combined grammar practice',`<section class="panel pg-setup">${row('Category',seg('lcat',['Tenses','Prepositions','Conjunctions','Verbs'].map(c=>[c,c]),setup.lcat))}<div id="pg-lt"></div><div id="pg-lcard"></div></section>`);
  const drawTopics=()=>{const list=TOPIC_LIST[setup.lcat]();$('pg-lt').innerHTML=`<div class="pg-row"><label>Topic</label><select id="pg-ltopic" class="pg-select"><option value="">Choose a topic…</option>${list.map(t=>`<option value="${esc(t.id)}">${esc(t.label)}</option>`).join('')}</select></div>`;$('pg-lcard').innerHTML='';
    $('pg-ltopic').addEventListener('change',e=>{if(!e.target.value){$('pg-lcard').innerHTML='';return;}const c=PG.learnCard(setup.lcat,e.target.value);
      $('pg-lcard').innerHTML=`<div class="results"><h2>${esc(c.title)}</h2><p class="muted">${esc(originLabel(c.origin))}</p><div class="pg-learn">${c.html}</div><div class="results-actions"><button class="primary-btn" id="pg-lstart">Start practice</button></div></div>`;
      $('pg-lstart').addEventListener('click',()=>{const qs=PG.topicPool(setup.lcat,e.target.value,10).slice(0,10);if(!qs.length){$('pg-lcard').insertAdjacentHTML('beforeend','<p class="warn-line">No questions available for this topic yet.</p>');return;}
        launch(g,qs,{cfg:{},mode:'mc',back:()=>renderLearn(g),replay:()=>renderLearn(g)});});});};
  wireSeg(scr,()=>drawTopics());drawTopics();
}
function renderRetry(g){
  const mis=Object.values(load().mistakes);const by={};mis.forEach(m=>{(by[m.cat]=by[m.cat]||{n:0,topics:{}}).n++;by[m.cat].topics[m.topic]=(by[m.cat].topics[m.topic]||0)+1;});
  const scr=msgScreen(g,sectionBack,'Combined grammar practice',`<section class="panel pg-setup">${mis.length?`<p>You have <b>${mis.length}</b> saved ${plural(mis.length,'mistake','mistakes')}. Each question is stored once, even if you got it wrong several times. A question is removed when you answer it correctly here.</p>
  <div class="table-wrap"><table class="word-table"><thead><tr><th>Category</th><th>Questions</th><th>Topics</th></tr></thead><tbody>${Object.keys(by).map(c=>`<tr><td>${esc(c)}</td><td>${by[c].n}</td><td>${Object.keys(by[c].topics).slice(0,6).map(t=>esc(t)+' ('+by[c].topics[t]+')').join(', ')}</td></tr>`).join('')}</tbody></table></div>
  <div class="results-actions"><button class="primary-btn" data-r="all">Retry all (${mis.length})</button>${Object.keys(by).map(c=>`<button class="secondary-btn" data-r="${esc(c)}">${esc(c)} (${by[c].n})</button>`).join('')}</div>`:'<p class="muted">No saved mistakes yet. Answers you get wrong in any game are saved here.</p>'}</section>`);
  scr.querySelectorAll('[data-r]').forEach(b=>b.addEventListener('click',()=>{const c=b.dataset.r;const qs=shuffle(mis.filter(m=>c==='all'||m.cat===c).map(m=>m.q));launch(g,qs,{cfg:{},mode:'mc',back:()=>renderRetry(g),replay:()=>renderRetry(g)});}));
}
function masteryKey(cat,label){return cat+'::'+(label||'*');}
function masteryStatus(m,target){const a=(m&&m.attempts)||[];const q=a.filter(x=>x.total>=MASTERY_MIN_Q);const lastN=q.slice(-MASTERY_ATTEMPTS);
  const okN=lastN.filter(x=>x.pct>=target).length;const mastered=lastN.length===MASTERY_ATTEMPTS&&okN===MASTERY_ATTEMPTS;
  let streak=0;for(let i=q.length-1;i>=0&&q[i].pct>=target;i--)streak++;return {mastered,streak:Math.min(streak,MASTERY_ATTEMPTS),attempts:q.length};}
function renderMastery(g){
  setup.mcat=setup.mcat||'Tenses';setup.mtopic=setup.mtopic||'';
  const scr=msgScreen(g,sectionBack,'Combined grammar practice',`<section class="panel pg-setup">${row('Category',seg('mcat',['Tenses','Prepositions','Conjunctions','Verbs'].map(c=>[c,c]),setup.mcat))}<div id="pg-mt"></div>${row('Target accuracy',seg('targetAcc',[[80,'80%'],[90,'90%'],[95,'95%']],setup.targetAcc),`A topic is mastered after ${MASTERY_ATTEMPTS} qualifying tests in a row, each with at least ${MASTERY_MIN_Q} questions and at least the target accuracy.`)}<div id="pg-mprog"></div><div class="ws-actions"><button class="primary-btn" id="pg-start">Start mastery test</button></div></section>`);
  const prog=()=>{const lab=setup.mtopic?(TOPIC_LIST[setup.mcat]().find(t=>t.id===setup.mtopic)||{}).label:'';const m=load().mastery[masteryKey(setup.mcat,lab)];const s=masteryStatus(m,setup.targetAcc);
    $('pg-mprog').innerHTML=`<div class="results"><h2>${s.mastered?'✓ Mastered':'In progress'}</h2><p>${esc(setup.mcat)}${lab?' · '+esc(lab):' · all topics'} — qualifying tests: ${s.attempts}. Progress: ${s.streak} / ${MASTERY_ATTEMPTS} consecutive tests at ${setup.targetAcc}% or higher.</p>${m&&m.attempts.length?`<p class="muted">Recent tests: ${m.attempts.slice(-5).map(a=>a.pct+'% ('+a.total+' q)').join(' · ')}</p>`:''}</div>`;};
  const drawT=()=>{const list=TOPIC_LIST[setup.mcat]();$('pg-mt').innerHTML=`<div class="pg-row"><label>Topic</label><select id="pg-mtopic" class="pg-select"><option value="">All topics in this category</option>${list.map(t=>`<option value="${esc(t.id)}"${t.id===setup.mtopic?' selected':''}>${esc(t.label)}</option>`).join('')}</select></div>`;$('pg-mtopic').addEventListener('change',e=>{setup.mtopic=e.target.value;prog();});prog();};
  wireSeg(scr,k=>{if(k==='mcat'){setup.mtopic='';drawT();}else prog();});drawT();
  $('pg-start').addEventListener('click',()=>{
    const cat=setup.mcat,id=setup.mtopic;const lab=id?(TOPIC_LIST[cat]().find(t=>t.id===id)||{}).label:'';let qs;
    if(id){qs=PG.topicPool(cat,id,MASTERY_MIN_Q);}else qs=PG.MIX[cat]({count:MASTERY_MIN_Q+10,difficulty:'advanced'});
    const seen=new Set();qs=shuffle(qs.filter(q=>!seen.has(q.id)&&seen.add(q.id))).slice(0,MASTERY_MIN_Q);
    if(qs.length<10){scr.insertAdjacentHTML('afterbegin','<div class="ws-summary"><p class="warn-line">Not enough different questions exist for this topic to run a mastery test (at least 10 are needed). Choose a larger topic or the whole category.</p></div>');return;}
    launch(g,qs,{cfg:{},mode:'mc',back:()=>renderMastery(g),replay:()=>renderMastery(g),extra:{mastery:{key:masteryKey(cat,lab),target:setup.targetAcc,label:(cat+(lab?' · '+lab:' · all topics'))}}});});
}

/* ---------- session shell ---------- */
function launch(g,qs,o){
  clearTimers();
  S={g,qs,i:0,correct:[],wrong:[],skipped:[],answered:false,finished:false,mode:o.mode||'mc',start:Date.now(),qStart:Date.now(),times:[],back:o.back,replay:o.replay,extra:o.extra||{},cfg:o.cfg||{},cV:true,wV:true,asm:[]};
  const cat=g.cat;
  view.innerHTML=`<div class="quiz-top"><button class="text-button" id="pg-back">← ${esc(o.backLabel||'Back')}</button><span class="session-tag">Game ${g.num} · ${esc(g.title)}</span></div>
  <div class="quiz-layout"><section class="quiz-main panel">
   <div class="quiz-meta"><span id="pg-qn"></span><span id="pg-ml"></span></div>
   <h1 id="pg-prompt" class="pg-pre"></h1>
   <div id="pg-note" class="question-example hidden"></div><div id="pg-sub" class="question-example pg-pre hidden"></div>
   <p id="pg-hint" class="muted"></p><p class="question-instruction" id="pg-instr"></p><p id="pg-ctx" class="muted"></p>
   <div id="pg-body"></div><div id="pg-fb" class="feedback hidden" aria-live="polite"></div>
   <div class="quiz-controls"><button id="pg-skip" class="text-button">Skip question</button>${g.modes?`<div class="mode-switch"><button class="mode-btn" id="pg-mc">Multiple choice</button><button class="mode-btn" id="pg-ty">Type answer</button></div>`:''}</div>
   <div id="pg-results" class="results hidden"></div></section>
  <aside class="quiz-side">
   <section class="panel score-panel"><h3>Session score</h3><div class="score-number"><strong id="pg-sc">0</strong><span>/ <span id="pg-sa2">0</span></span></div>
    <div class="score-details"><span>Correct <b id="pg-s1">0</b></span><span>Incorrect <b id="pg-s2">0</b></span></div><div class="score-details"><span>Questions left <b id="pg-s3">—</b></span><span>Accuracy <b id="pg-s4">—</b></span></div><div class="score-details"><span>Skipped <b id="pg-s5">0</b></span></div>
    <button id="pg-restart" class="secondary-btn full-width">Restart game</button></section>
   <section class="panel word-score-panel"><h3 id="pg-tw">Topic-wise score</h3><div id="pg-tl"></div></section>
   <section class="panel review-panel"><div class="review-title"><h3>Correct answers <span id="pg-cc" class="pill-count">0</span></h3><button class="text-button compact" id="pg-tc">Hide</button></div><div id="pg-cl" class="review-list"></div></section>
   <section class="panel review-panel"><div class="review-title"><h3>Wrong answers <span id="pg-wc2" class="pill-count">0</span></h3><button class="text-button compact" id="pg-tx">Hide</button></div><div id="pg-wl" class="review-list"></div><button id="pg-rw" class="secondary-btn full-width hidden">Retry incorrect answers</button></section>
  </aside></div>`;
  $('pg-back').addEventListener('click',()=>{clearTimers();S.finished=true;o.back();});
  $('pg-skip').addEventListener('click',skip);$('pg-restart').addEventListener('click',()=>{clearTimers();S.replay();});
  $('pg-tc').addEventListener('click',()=>{S.cV=!S.cV;renderSide();});$('pg-tx').addEventListener('click',()=>{S.wV=!S.wV;renderSide();});$('pg-rw').addEventListener('click',retryWrong);
  if(g.modes){$('pg-mc').addEventListener('click',()=>{if(S.answered||S.finished)return;S.mode='mc';renderQ();});$('pg-ty').addEventListener('click',()=>{if(S.answered||S.finished)return;S.mode='typed';renderQ();});}
  $('pg-tw').textContent=cat==='Tenses'?'Tense-wise score':cat==='Verbs'?'Verb-wise score':cat==='Combined'?'Topic-wise score':'Word-wise score';
  if(g.timed){S.deadline=Date.now()+g.timed*1000;tick=setInterval(()=>{const left=Math.max(0,Math.ceil((S.deadline-Date.now())/1000));const el=$('pg-ml');if(el)el.textContent='⏱ '+left+'s';if(left<=0){clearTimers();finish();}},250);}
  renderQ();renderSide();window.scrollTo({top:0,behavior:'smooth'});
}
function tallyBy(fn){const m={};const add=(r,k)=>{const key=fn(r.q);const t=m[key]||(m[key]={total:0,c:0,w:0,k:0});t.total++;t[k]++;};S.correct.forEach(r=>add(r,'c'));S.wrong.forEach(r=>add(r,'w'));S.skipped.forEach(r=>add(r,'k'));return m;}
function renderSide(){
  const a=S.correct.length+S.wrong.length;
  $('pg-sc').textContent=S.correct.length;$('pg-sa2').textContent=a;$('pg-s1').textContent=S.correct.length;$('pg-s2').textContent=S.wrong.length;$('pg-s5').textContent=S.skipped.length;
  $('pg-s3').textContent=S.g.timed?'—':S.finished?'0':Math.max(0,S.qs.length-S.i);$('pg-s4').textContent=a?Math.round(S.correct.length/a*100)+'%':'—';
  const t=tallyBy(q=>q.topic);$('pg-tl').innerHTML=Object.keys(t).slice(-12).map(k=>`<div class="word-score-row" title="${t[k].c} correct · ${t[k].w} incorrect"><span>${esc(k)}</span><b>${t[k].c} / ${t[k].c+t[k].w}</b></div>`).join('')||'<div class="empty-review">No answers yet.</div>';
  const items=(l,good)=>l.length?l.slice().reverse().map(r=>`<div class="review-item"><strong>${esc((r.q.prompt||'').split('\n')[0])}</strong>${r.q.sub?`<p>${esc(String(r.q.sub).split('\n')[0])}</p>`:''}<p class="${good?'answer-good':'answer-bad'}">Your answer: ${esc(r.sub)}</p><p>Correct: ${esc(r.q.show)}</p><p>${esc(r.q.cat+' · '+r.q.topic)}</p></div>`).join(''):'<div class="empty-review">No answers recorded yet.</div>';
  $('pg-cc').textContent=S.correct.length;$('pg-wc2').textContent=S.wrong.length;$('pg-cl').innerHTML=items(S.correct,true);$('pg-wl').innerHTML=items(S.wrong,false);
  $('pg-cl').classList.toggle('hidden',!S.cV);$('pg-wl').classList.toggle('hidden',!S.wV);$('pg-tc').textContent=S.cV?'Hide':'Show';$('pg-tx').textContent=S.wV?'Hide':'Show';$('pg-rw').classList.toggle('hidden',!S.wrong.length||S.g.timed);
}

/* ---------- question rendering ---------- */
function renderQ(){
  if(S.finished)return;if(S.i>=S.qs.length){if(S.g.timed&&S.qs.length){S.qs=S.qs.concat(shuffle(S.qs));}else return finish();}
  const q=S.qs[S.i];S.answered=false;S.asm=[];S.qStart=Date.now();
  const g=S.g;const kind=q.kind;
  const useMC=kind==='choice'&&q.options&&q.options.length>=2&&!q.typedOnly&&(S.mode==='mc'||q.typed===false);
  const useTyped=(kind==='choice'||kind==='text')&&!useMC;
  $('pg-qn').textContent=g.timed?'Question '+(S.i+1):`Question ${S.i+1} of ${S.qs.length}`;
  if(!g.timed)$('pg-ml').textContent=kind==='pick'?'Tap the word':kind==='build'?'Build the sentence':kind==='fields'?'Fill in the forms':useMC?'Multiple choice':(S.mode==='mc'&&q.kind==='choice'&&!q.options?'Type your answer (no options)':'Type your answer');
  $('pg-prompt').textContent=q.prompt;
  const note=$('pg-note');note.textContent=q.note||'';note.classList.toggle('hidden',!q.note);note.classList.add('pg-pre');
  const sub=$('pg-sub');sub.textContent=q.sub||'';sub.classList.toggle('hidden',!q.sub);
  $('pg-hint').textContent=q.hint||'';
  $('pg-instr').textContent=kind==='pick'?(q.multi?'Select every correct word, then press Check.':'Tap the correct word.'):kind==='build'?'Tap the words in the correct order.':kind==='fields'?'Type the missing forms.':'Your answer?';
  $('pg-ctx').textContent=[q.cat,q.topic,originLabel(q.origin)].join(' · ');
  const fb=$('pg-fb');fb.className='feedback hidden';fb.innerHTML='';$('pg-results').classList.add('hidden');
  if(g.modes){$('pg-mc').classList.toggle('active',S.mode==='mc');$('pg-ty').classList.toggle('active',S.mode==='typed');}
  $('pg-skip').classList.toggle('hidden',!!g.timed&&false);
  const body=$('pg-body');
  if(useMC){
    body.innerHTML=`<div class="options">${shuffle(q.options).map(o=>`<button class="option-btn" data-a="${esc(o)}">${esc(o)}</button>`).join('')}</div>`;
    body.querySelectorAll('.option-btn').forEach(b=>b.addEventListener('click',()=>submit(b.dataset.a,b)));
  }else if(useTyped){
    body.innerHTML=`<form class="typed-form" id="pg-form"><label for="pg-input">Your answer</label><div class="typed-row"><input id="pg-input" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Type your answer…"><button class="primary-btn" type="submit">Check answer</button></div><p class="input-help">Press Enter to submit. Capitalisation and extra spaces do not matter.</p></form>`;
    $('pg-form').addEventListener('submit',e=>{e.preventDefault();const v=$('pg-input').value;if(!v.trim()){$('pg-input').focus();return;}submit(v);});$('pg-input').focus();
  }else if(kind==='pick'){
    body.innerHTML=`<div class="pg-tokens">${q.tokens.map((t,i)=>`<button class="option-btn pg-token" data-i="${i}">${esc(t)}</button>`).join('')}</div>${q.multi?'<div class="results-actions"><button class="primary-btn" id="pg-chk">Check</button></div>':''}`;
    const sel=new Set();body.querySelectorAll('.pg-token').forEach(b=>b.addEventListener('click',()=>{if(S.answered)return;if(q.multi){const i=+b.dataset.i;sel.has(i)?sel.delete(i):sel.add(i);b.classList.toggle('pg-sel',sel.has(i));}else submit([+b.dataset.i],b);}));
    if(q.multi)$('pg-chk').addEventListener('click',()=>{if(!sel.size)return;submit([...sel]);});
  }else if(kind==='build'){
    body.innerHTML=`<div class="question-example pg-tray" id="pg-tray" aria-label="Your sentence"></div><div class="pg-tokens" id="pg-pool"></div><div class="results-actions"><button class="secondary-btn" id="pg-undo">Undo</button><button class="secondary-btn" id="pg-reset">Reset</button><button class="primary-btn" id="pg-chk">Check</button></div>`;
    const draw=()=>{$('pg-tray').textContent=S.asm.map(i=>q.tokens[i]).join(' ')||'Tap words below…';$('pg-pool').innerHTML=q.tokens.map((t,i)=>S.asm.includes(i)?'':`<button class="option-btn pg-token" data-i="${i}">${esc(t)}</button>`).join('');
      $('pg-pool').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{if(S.answered)return;S.asm.push(+b.dataset.i);draw();}));};
    draw();$('pg-undo').addEventListener('click',()=>{if(!S.answered){S.asm.pop();draw();}});$('pg-reset').addEventListener('click',()=>{if(!S.answered){S.asm=[];draw();}});
    $('pg-chk').addEventListener('click',()=>{if(S.answered||!S.asm.length)return;submit(S.asm.map(i=>q.tokens[i]).join(' '));});
  }else if(kind==='fields'){
    body.innerHTML=`<form class="typed-form" id="pg-form"><div class="pg-fields">${q.fields.map((f,i)=>`<label class="pg-field"><span>${esc(f.label)}</span><input data-i="${i}" autocomplete="off" autocapitalize="off" spellcheck="false" ${f.given?`value="${esc(f.value)}" disabled`:'placeholder="Type…"'}></label>`).join('')}</div><div class="results-actions"><button class="primary-btn" type="submit">Check answer</button></div><p class="input-help">Press Enter to move to the next box; Enter in the last box checks your answer.</p></form>`;
    const inputs=[...body.querySelectorAll('input:not([disabled])')];
    inputs.forEach((inp,k)=>inp.addEventListener('keydown',e=>{if(e.key==='Enter'&&k<inputs.length-1){e.preventDefault();inputs[k+1].focus();}}));
    $('pg-form').addEventListener('submit',e=>{e.preventDefault();const resp=q.fields.map((f,i)=>f.given?f.value:(body.querySelector(`input[data-i="${i}"]`).value||''));if(inputs.every(x=>!x.value.trim())){inputs[0].focus();return;}submit(resp);});
    if(inputs[0])inputs[0].focus();
  }
  renderSide();
}
function respText(q,resp){return q.kind==='pick'?resp.map(i=>q.tokens[i]).join(', '):q.kind==='fields'?q.fields.map((f,i)=>f.given?null:(resp[i]||'—')).filter(x=>x!==null).join(' · '):String(resp).trim();}
function submit(resp,btn){
  if(!S||S.answered||S.finished)return;const q=S.qs[S.i];S.answered=true;
  const r=check(q,resp);const ok=r.ok;const rec={q,sub:respText(q,resp),ok};const dt=Date.now()-S.qStart;S.times.push(dt);
  (ok?S.correct:S.wrong).push(rec);record(q,ok,S);
  const body=$('pg-body');
  body.querySelectorAll('.option-btn').forEach(b=>{b.disabled=true;if(b.dataset.a!==undefined){if(check(q,b.dataset.a).ok)b.classList.add('correct');}});
  if(btn&&!ok)btn.classList.add('incorrect');
  if(q.kind==='pick'){body.querySelectorAll('.pg-token').forEach(b=>{const w=N(q.tokens[+b.dataset.i]);const isA=q.answers.map(N).includes(w);const chosen=resp.includes(+b.dataset.i);if(isA)b.classList.add('correct');else if(chosen)b.classList.add('incorrect');});}
  body.querySelectorAll('input,.pg-token').forEach(x=>{if(x.tagName==='INPUT')x.disabled=true;});body.querySelectorAll('.typed-row button,#pg-chk,#pg-undo,#pg-reset').forEach(b=>b.disabled=true);
  let extra='';
  if(q.kind==='fields'){extra='<br>'+q.fields.map((f,i)=>f.given?'':`${esc(f.short)}: ${r.fields[i].ok?'✓':'✕'} ${esc(r.fields[i].ok?f.value:'your: '+(resp[i]||'—')+' → '+f.value)}`).filter(Boolean).join(' &nbsp; ');}
  else if(r.msg)extra='<br>'+esc(r.msg);
  const fb=$('pg-fb');fb.className=`feedback ${ok?'good':'bad'}`;
  fb.innerHTML=`<b>${ok?'✓ Correct':'✕ Incorrect'}</b>${ok?'':`Your answer: <strong>${esc(rec.sub)}</strong><br>Correct answer: <strong>${esc(q.show)}</strong>`}${extra}<br><span class="pg-expl">${esc(q.explain||'')}</span><div class="results-actions"><button class="primary-btn" id="pg-next">${S.i+1>=S.qs.length&&!S.g.timed?'See results':'Next question →'}</button></div>`;
  $('pg-next').addEventListener('click',next);renderSide();
  if(S.g.timed){fb.querySelector('.results-actions').remove();setTimeout(()=>{if(S&&!S.finished&&S.answered)next();},ok?350:900);}else $('pg-next').focus();
}
function next(){if(!S||!S.answered||S.finished)return;S.i++;renderQ();}
function skip(){if(!S||S.answered||S.finished)return;S.skipped.push({q:S.qs[S.i],sub:'(skipped)'});S.i++;renderQ();}
function retryWrong(){if(!S||!S.wrong.length)return;const g=S.g,qs=shuffle(S.wrong.map(r=>r.q)),o={cfg:S.cfg,mode:S.mode,back:S.back,backLabel:'Back',replay:S.replay,extra:S.extra};launch(g,qs,o);}

/* ---------- results ---------- */
const fmtTime=ms=>{const s=Math.round(ms/1000);return Math.floor(s/60)+'m '+String(s%60).padStart(2,'0')+'s';};
function finish(){
  if(!S||S.finished&&S.resultsShown)return;S.finished=true;S.resultsShown=true;clearTimers();
  const g=S.g,c=S.correct.length,w=S.wrong.length,k=S.skipped.length,a=c+w,total=g.timed?a:S.qs.length,pct=a?Math.round(c/a*100):0;
  const elapsed=Date.now()-S.start,avg=S.times.length?S.times.reduce((x,y)=>x+y,0)/S.times.length:0;
  const store=load();const b=store.best[g.num];if(a&&(!b||pct>=b.pct))store.best[g.num]={pct,at:Date.now()};
  let masteryHTML='';
  if(S.extra.mastery&&a){const mm=S.extra.mastery;const m=store.mastery[mm.key]||(store.mastery[mm.key]={attempts:[]});m.attempts.push({pct,total:a,at:Date.now()});m.attempts=m.attempts.slice(-20);
    const st=masteryStatus(m,mm.target);
    masteryHTML=`<h3 class="results-sub">Mastery result</h3><p><b>${esc(mm.label)}</b>: ${pct}% (target ${mm.target}%) — ${a<MASTERY_MIN_Q?`this test had fewer than ${MASTERY_MIN_Q} answered questions, so it does not count towards mastery.`:st.mastered?'<b>✓ Mastered</b> — you reached the target in '+MASTERY_ATTEMPTS+' consecutive tests.':pct>=mm.target?`target reached. ${st.streak} / ${MASTERY_ATTEMPTS} consecutive qualifying tests — take one more to confirm mastery.`:'target not reached yet. Review the mistakes and try another attempt.'}</p>`;}
  save();
  const byTopic=tallyBy(q=>q.topic),byCat=tallyBy(q=>q.cat);
  const tbl=(label,m)=>`<div class="table-wrap"><table class="word-table"><thead><tr><th>${label}</th><th>Questions</th><th>Correct</th><th>Incorrect</th><th>Skipped</th><th>Score</th></tr></thead><tbody>${Object.keys(m).map(x=>{const t=m[x];return `<tr><td>${esc(x)}</td><td>${t.total}</td><td>${t.c}</td><td>${t.w}</td><td>${t.k}</td><td>${t.c+t.w?Math.round(t.c/(t.c+t.w)*100):0}%</td></tr>`;}).join('')}</tbody></table></div>`;
  const cats=Object.keys(byCat);
  let repeated='';
  if(g.num===20||g.num===43){const mis=Object.values(store.mistakes).filter(m=>m.count>=2&&S.qs.some(q=>q.id===m.q.id));if(mis.length)repeated=`<h3 class="results-sub">Repeated mistakes</h3><p>${mis.map(m=>esc(m.topic)+' ('+m.count+'×)').join(', ')}</p>`;}
  const all=S.correct.concat(S.wrong).concat(S.skipped);
  $('pg-results').innerHTML=`<h2>${c} / ${total} correct · ${pct}%</h2>
  <div class="result-grid"><div><span>Total questions</span><b>${total}</b></div><div><span>Correct</span><b>${c}</b></div><div><span>Incorrect</span><b>${w}</b></div><div><span>Skipped</span><b>${k}</b></div><div><span>Final percentage</span><b>${pct}%</b></div><div><span>Overall score</span><b>${c} / ${total}</b></div><div><span>Time taken</span><b>${fmtTime(elapsed)}</b></div>${g.timed?`<div><span>Avg response</span><b>${(avg/1000).toFixed(1)}s</b></div>`:''}</div>
  ${cats.length>1?'<h3 class="results-sub">Category-wise performance</h3>'+tbl('Category',byCat):''}
  <h3 class="results-sub">${g.cat==='Tenses'?'Tense-wise':g.cat==='Verbs'?'Verb-wise':g.cat==='Combined'||cats.length>1?'Topic-wise':'Word-wise'} performance</h3>${tbl('Topic',byTopic)}${repeated}${masteryHTML}
  <div class="results-actions"><button class="primary-btn" id="pg-again">Play again</button>${w&&!g.timed?'<button class="secondary-btn" id="pg-retry">Retry incorrect questions</button>':''}<button class="secondary-btn" id="pg-review">Review answers</button><button class="secondary-btn" id="pg-cat">Back to category</button><button class="secondary-btn" id="pg-home">Back to home</button></div>
  <div id="pg-rv" class="review-list hidden">${all.map(r=>`<div class="review-item"><strong>${esc((r.q.prompt||'').replace(/\n/g,' '))}</strong>${r.q.sub?`<p>${esc(String(r.q.sub).replace(/\n/g,' '))}</p>`:''}<p class="${r.ok?'answer-good':r.sub==='(skipped)'?'':'answer-bad'}">Your answer: ${esc(r.sub)}</p><p>Correct: ${esc(r.q.show)}</p><p>${esc(r.q.explain||'')}</p></div>`).join('')}</div>`;
  $('pg-results').classList.remove('hidden');
  $('pg-qn').textContent='Game complete';$('pg-ml').textContent='Results';$('pg-prompt').textContent='You’ve completed this game.';['pg-note','pg-sub'].forEach(i=>$(i).classList.add('hidden'));$('pg-hint').textContent='';$('pg-instr').textContent='';$('pg-ctx').textContent='Review your answers or play again.';$('pg-body').innerHTML='';$('pg-fb').classList.add('hidden');
  $('pg-again').addEventListener('click',S.replay);
  if(w&&!g.timed)$('pg-retry').addEventListener('click',retryWrong);
  $('pg-review').addEventListener('click',e=>{const l=$('pg-rv');l.classList.toggle('hidden');e.target.textContent=l.classList.contains('hidden')?'Review answers':'Hide answers';});
  $('pg-cat').addEventListener('click',()=>renderSection(g.cat));$('pg-home').addEventListener('click',()=>{S=null;document.querySelector('.nav-btn[data-view="dashboard"]').click();});
  renderSide();$('pg-results').scrollIntoView({behavior:'smooth',block:'start'});
}

/* ---------- wiring ---------- */
const navBtn=document.querySelector('.nav-btn[data-view="practice"]');
if(navBtn)navBtn.addEventListener('click',renderHub);
document.querySelectorAll('[data-view]:not([data-view="practice"])').forEach(b=>b.addEventListener('click',clearTimers));
const launchGrid=$('practice-launch');
if(launchGrid){launchGrid.innerHTML=CATS.map(c=>`<button class="launch-card${c.id==='Combined'?' featured':''}" data-pcat="${c.id}"><span class="card-icon">${c.icon}</span><span class="card-title">${esc(c.title)}</span><span class="card-description">${esc(c.desc)}</span><span class="card-action">${gamesOf(c.id).length} games <span>→</span></span></button>`).join('');
  launchGrid.querySelectorAll('[data-pcat]').forEach(b=>b.addEventListener('click',()=>{goPractice();renderSection(b.dataset.pcat);}));}
window.__practiceTestHooks={get S(){return S;},openGame,renderHub,renderSection,launch,submit,next,finish,load,G,setupRef:()=>setup};
})();
