(() => {
  'use strict';
  const data = window.GRAMMAR_DATA;
  const bankCats = (window.WORD_BANK && window.WORD_BANK.categories) || {};
  const $ = id => document.getElementById(id);
  const state = {view:'dashboard',quiz:[],original:[],index:0,correct:[],wrong:[],skipped:[],answered:false,mode:'mc',activeCategory:'',correctVisible:true,wrongVisible:true,finished:false,timer:null,wordSession:null,choiceCategory:'',selectedWords:new Set()};
  const escapeHTML = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm = s => String(s??'').toLowerCase().trim().replace(/[’‘]/g,"'").replace(/\s+/g,' ').replace(/[.!?]+$/,'');
  const shuffle = arr => {const a=[...arr];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
  const cats = [...new Set(data.questions.map(q=>q.category))];
  const icons = {'All Tenses':'T','Could & Should':'C','Would Forms':'W','Can, Can Be, Can Have & Ability':'Can','Be To / Have To':'To','Has / Have / Had To Have':'H'};

  /* ---------- Specific-word quiz: data helpers (all driven by window.WORD_BANK) ---------- */
  const MIN_USES = 2;                                   // a word needs at least this many distinct uses to start a quiz
  const SHOW_EXAMPLE_IN_WORD_QUIZ = true;               // one random source example under the use description (same as the complete quiz)
  const ONE_USE_MESSAGE = 'This word has only one available use. A quiz cannot be started yet.';
  const isEligible = w => w.uses.length >= MIN_USES;
  const hasWordQuiz = cat => !!bankCats[cat] && bankCats[cat].words.some(isEligible);
  const cap = s => s.charAt(0).toUpperCase()+s.slice(1);
  const plural = (n,one,many) => n===1?one:many;

  function setView(view){state.view=view;document.querySelectorAll('.view').forEach(e=>e.classList.add('hidden'));$(`${view}-view`)?.classList.remove('hidden');document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.view===view));window.scrollTo({top:0,behavior:'smooth'});}

  function renderDashboard(){
    $('stats').innerHTML=[[data.documents.length,'Source files included'],[cats.length,'Quiz categories'],[data.questions.length,'Structured questions'],[192,'Tense answer-key questions']].map(([n,l])=>`<div class="stat"><strong>${n.toLocaleString()}</strong><span>${l}</span></div>`).join('');
    $('topic-count').textContent=`${cats.length} categories`;
    $('category-grid').innerHTML=cats.map(cat=>`<button class="category-card" data-category="${escapeHTML(cat)}"><span class="category-symbol">${escapeHTML(icons[cat]||cat.slice(0,2))}</span><span><strong>${escapeHTML(cat)}</strong><small>${data.questions.filter(q=>q.category===cat).length} questions · random order${hasWordQuiz(cat)?' · specific-word practice':''}</small><span class="card-action">Practise topic <span>→</span></span></span></button>`).join('');
    $('category-grid').querySelectorAll('[data-category]').forEach(b=>b.addEventListener('click',()=>openCategory(b.dataset.category)));
  }

  /* ---------- Category -> (complete | specific word) choice ---------- */
  function openCategory(cat){ if(hasWordQuiz(cat)) showChoice(cat); else startQuiz(cat); }
  function showChoice(cat){
    const bank=bankCats[cat], total=data.questions.filter(q=>q.category===cat).length, elig=bank.words.filter(isEligible).length;
    state.choiceCategory=cat;
    $('choice-tag').textContent=cat;
    $('choice-title').textContent=cat;
    $('choice-sub').textContent='Practise everything in this topic, or focus on individual '+bank.itemLabelPlural+'.';
    $('choice-complete-title').textContent=`Complete ${cat} quiz`;
    $('choice-complete-desc').textContent=`Play questions from all available ${cat}. ${total} questions · random order.`;
    $('choice-specific-title').textContent=`Specific ${bank.itemLabel} quiz`;
    $('choice-specific-desc').textContent=`Choose one or more ${bank.itemLabelPlural} and practise only their different uses. ${elig} of ${bank.words.length} ${bank.itemLabelPlural} have ${MIN_USES}+ uses.`;
    setView('choice');
  }

  /* ---------- Specific-word selection window ---------- */
  function showWordSelect(cat){
    const bank=bankCats[cat]; state.choiceCategory=cat; state.selectedWords=new Set();
    $('ws-tag').textContent=cat;
    $('ws-title').textContent=`Specific ${bank.itemLabel} quiz`;
    const elig=bank.words.filter(isEligible).length;
    $('ws-sub').textContent=`${bank.words.length} ${bank.itemLabelPlural} found in your notes · ${elig} ${plural(elig,'has','have')} ${MIN_USES}+ uses and can start a quiz. Select one or more.`;
    $('ws-grid').innerHTML=bank.words.map(w=>`<label class="word-card${isEligible(w)?'':' single'}"><input type="checkbox" value="${escapeHTML(w.id)}"><span class="word-name">${escapeHTML(w.label)}</span><span class="word-uses">${w.uses.length} ${plural(w.uses.length,'use','uses')}${isEligible(w)?'':' · not available yet'}</span></label>`).join('');
    $('ws-grid').querySelectorAll('input').forEach(i=>i.addEventListener('change',()=>{i.checked?state.selectedWords.add(i.value):state.selectedWords.delete(i.value);i.closest('.word-card').classList.toggle('selected',i.checked);updateSelection();}));
    updateSelection(); setView('wordselect');
  }
  function selectionInfo(){
    const bank=bankCats[state.choiceCategory]; const chosen=bank.words.filter(w=>state.selectedWords.has(w.id));
    return {bank,chosen,eligible:chosen.filter(isEligible),excluded:chosen.filter(w=>!isEligible(w))};
  }
  function updateSelection(){
    const {bank,chosen,eligible,excluded}=selectionInfo();
    $('ws-count').textContent=`${chosen.length} selected`;
    const parts=[];
    if(!chosen.length) parts.push(`<p class="muted">Select one or more ${bank.itemLabelPlural} to begin.</p>`);
    if(eligible.length) parts.push(`<p class="ok-line"><b>Will be quizzed (${eligible.length}):</b> ${eligible.map(w=>`${escapeHTML(w.label)} <span class="muted">(${w.uses.length} uses)</span>`).join(', ')}</p>`);
    if(excluded.length) parts.push(`<p class="warn-line"><b>Not included (${excluded.length}):</b> ${excluded.map(w=>escapeHTML(w.label)).join(', ')}<br><span>${chosen.length===1?ONE_USE_MESSAGE:`These have only one available use, so they can’t be quizzed yet.`}</span></p>`);
    if(chosen.length&&!eligible.length&&chosen.length>1) parts.push(`<p class="warn-line"><span>None of the selected ${bank.itemLabelPlural} has at least ${MIN_USES} uses, so a quiz cannot be started yet.</span></p>`);
    $('ws-summary').innerHTML=parts.join('');
    $('ws-start').disabled=!eligible.length;
    const n=eligible.reduce((t,w)=>t+w.uses.length,0);
    $('ws-start').textContent=eligible.length?`Start quiz · ${n} questions`:'Start quiz';
  }
  function startFromSelection(){
    const {bank,eligible,excluded}=selectionInfo(); if(!eligible.length) return;
    startWordQuiz({category:state.choiceCategory,kind:bank.kind,itemLabel:bank.itemLabel,itemLabelPlural:bank.itemLabelPlural,words:eligible,excluded,bankWords:bank.words});
  }

  /* ---------- Quiz launch (shared by complete and specific-word quizzes) ---------- */
  function startQuiz(category,subset=null){
    const qs=subset?[...subset]:category==='all-grammar'?[...data.questions]:category==='all-verbs'?data.questions.filter(q=>cats.includes(q.category)&&!['Prepositions','Conjunctions'].includes(q.category)) :data.questions.filter(q=>q.category===category);
    if(!qs.length){alert('No structured quiz questions are available for this selection yet. Open the Study library to read the original notes.');return;}
    const label=category==='all-grammar'?'All grammar':category==='all-verbs'?'All verbs & structures':category==='Prepositions'?'Prepositions Quiz started!':category==='Conjunctions'?'Conjunctions Quiz started!':category;
    launch(qs,category,label,null);
  }
  function wordQuestions(session){
    return session.words.flatMap(w=>w.uses.map(u=>({id:u.id,category:session.category,prompt:u.prompt,answers:u.answers,examples:u.examples||[],source:u.source,wordMode:true,kind:session.kind,wordId:w.id,wordLabel:w.label})));
  }
  function startWordQuiz(session,subset=null){
    const qs=subset?[...subset]:wordQuestions(session);
    if(!qs.length) return;
    const names=session.words.map(w=>w.label);
    const label=`${session.category} · specific ${names.length>3?`${names.length} ${session.itemLabelPlural}`:names.join(', ')}`;
    launch(qs,session.category,label,session);
  }
  function launch(qs,category,label,session){
    clearTimeout(state.timer);
    state.quiz=shuffle(qs);state.original=[...state.quiz];state.index=0;state.correct=[];state.wrong=[];state.skipped=[];state.answered=false;state.finished=false;state.activeCategory=category;state.wordSession=session;state.correctVisible=true;state.wrongVisible=true;
    $('toggle-correct').textContent='Hide';$('toggle-wrong').textContent='Hide';$('correct-list').classList.remove('hidden');$('wrong-list').classList.remove('hidden');$('results').classList.add('hidden');$('retry-wrong').classList.add('hidden');
    $('quiz-category-label').textContent=label;
    $('word-score-panel').classList.toggle('hidden',!session);
    const banner=$('word-banner');
    if(session){banner.innerHTML=`<b>Practising ${session.words.length} ${plural(session.words.length,session.itemLabel,session.itemLabelPlural)}:</b> ${session.words.map(w=>escapeHTML(w.label)).join(', ')}`+(session.excluded.length?`<br><span>Not included (only one use): ${session.excluded.map(w=>escapeHTML(w.label)).join(', ')}</span>`:'');banner.classList.remove('hidden');}
    else{banner.innerHTML='';banner.classList.add('hidden');}
    setView('quiz');renderQuestion();renderScore();renderReview();
  }
  const restartCurrent=()=>state.wordSession?startWordQuiz(state.wordSession):startQuiz(state.activeCategory);

  /* ---------- Answer checking and options ---------- */
  function valid(answer,q){const a=norm(answer);if(!a)return false;if(q.prompt.includes('Verb Form?')){const n=a.replace(/^(v|form|verb form)\s*/,'').trim();return q.answers.some(x=>norm(x)===n);}return q.answers.some(x=>norm(x)===a);}
  // For specific-word questions the option shown for the correct word is that word's label (e.g. "Through / Via").
  function isCorrect(answer,q){return valid(answer,q)||(q.wordMode&&q.kind==='word'&&norm(answer)===norm(q.wordLabel));}
  function makeOptions(q){const correct=shuffle(q.answers)[0];const pool=[];for(const other of data.questions)for(const a of other.answers){if(norm(a)!==norm(correct)&&!q.answers.some(x=>norm(x)===norm(a))&&!pool.some(x=>norm(x)===norm(a)))pool.push(a);}return shuffle([correct,...shuffle(pool).slice(0,3)]);}
  // Distractors come from the other selected words first; if fewer than 3 are suitable, the same topic's other words top them up.
  // A word is unsuitable if it could also be a correct answer for this use. Returns null if no suitable option exists.
  function makeWordOptions(q){
    const s=state.wordSession; if(!s) return null;
    const own=s.bankWords.find(w=>w.id===q.wordId); if(!own) return null;
    const bad=new Set(q.answers.map(norm));
    const suitable=w=>w.id!==q.wordId&&norm(w.label)!==norm(own.label)&&w.variants.length&&!w.variants.some(v=>bad.has(norm(v)));
    let picks=shuffle(s.words.filter(suitable)).slice(0,3);
    if(picks.length<3){const have=new Set(picks.map(w=>w.id));picks=picks.concat(shuffle(s.bankWords.filter(w=>suitable(w)&&!have.has(w.id))).slice(0,3-picks.length));}
    const opts=shuffle([own,...picks]).map(w=>w.label);
    return opts.length>=2?opts:null;
  }

  function renderQuestion(){
    if(state.index>=state.quiz.length){finishQuiz();return;}state.answered=false;const q=state.quiz[state.index];
    const wordChoices=q.wordMode&&q.kind==='word';
    let opts=null;if(state.mode==='mc'){opts=wordChoices?makeWordOptions(q):makeOptions(q);}
    const typedOnly=state.mode==='mc'&&!opts;          // no suitable options for this use -> type the answer instead
    const showTyped=state.mode==='typed'||typedOnly;
    $('question-number').textContent=`Question ${state.index+1} of ${state.quiz.length}`;$('mode-label').textContent=typedOnly?'Type your answer (no suitable options)':state.mode==='mc'?'Multiple choice':'Type your answer';$('question-prompt').textContent=q.prompt;
    const chosenExample=(q.examples&&q.examples.length&&(!q.wordMode||SHOW_EXAMPLE_IN_WORD_QUIZ))?q.examples[Math.floor(Math.random()*q.examples.length)]:'';$('question-example').textContent=chosenExample;$('question-example').classList.toggle('hidden',!chosenExample);$('question-instruction').textContent='Your answer?';
    $('question-context').textContent=q.wordMode?[q.category,`Specific ${state.wordSession?state.wordSession.itemLabel:'word'} quiz`,q.source?`Source: ${q.source}`:''].filter(Boolean).join(' · '):[q.category,q.source?`Source: ${q.source}`:''].filter(Boolean).join(' · ');
    $('feedback').className='feedback hidden';$('feedback').innerHTML='';$('results').classList.add('hidden');$('mc-options').classList.toggle('hidden',showTyped);$('typed-form').classList.toggle('hidden',!showTyped);$('mode-mc').classList.toggle('active',state.mode==='mc');$('mode-typed').classList.toggle('active',state.mode==='typed');$('typed-answer').value='';$('typed-answer').disabled=false;
    if(!showTyped){$('mc-options').innerHTML=opts.map(a=>`<button class="option-btn" data-answer="${escapeHTML(a)}">${escapeHTML(a)}</button>`).join('');$('mc-options').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>submitAnswer(b.dataset.answer,b)));}
    renderScore();
  }
  function submitAnswer(answer,button=null){if(state.answered||state.finished)return;const q=state.quiz[state.index];if(!String(answer??'').trim()){if(state.mode==='typed'||!$('typed-form').classList.contains('hidden')){$('typed-answer').focus();}return;}state.answered=true;const ok=isCorrect(answer,q);const record={q,submitted:String(answer).trim(),correct:q.answers.join(' / ')};(ok?state.correct:state.wrong).push(record);
    if(button){document.querySelectorAll('.option-btn').forEach(b=>{b.disabled=true;if(isCorrect(b.dataset.answer,q))b.classList.add('correct');});if(!ok)button.classList.add('incorrect');}
    $('typed-answer').disabled=true;$('feedback').className=`feedback ${ok?'good':'bad'}`;$('feedback').innerHTML=`<b>${ok?'✓ Correct':'✕ Incorrect'}</b>${ok?'Your answer is correct.':`Your answer: <strong>${escapeHTML(answer)}</strong><br>Correct answer: <strong>${escapeHTML(q.answers.join(' / '))}</strong>`}${q.answers.length>1&&ok?`<br>Other accepted answers: ${escapeHTML(q.answers.filter(a=>norm(a)!==norm(answer)).join(' / ')||'—')}`:''}`;
    renderScore();renderReview();state.timer=setTimeout(()=>{state.index++;renderQuestion();},1650);
  }

  /* ---------- Scores, review, results ---------- */
  function wordStats(){
    const s=state.wordSession; if(!s) return [];
    return s.words.map(w=>{
      const total=state.original.filter(q=>q.wordId===w.id).length;
      const c=state.correct.filter(r=>r.q.wordId===w.id).length, x=state.wrong.filter(r=>r.q.wordId===w.id).length, k=state.skipped.filter(r=>r.q.wordId===w.id).length;
      return {id:w.id,label:w.label,total,correct:c,wrong:x,skipped:k,pct:total?Math.round(c/total*100):0};
    }).filter(r=>r.total>0);
  }
  function renderScore(){const attempted=state.correct.length+state.wrong.length;$('score-correct').textContent=state.correct.length;$('score-attempted').textContent=attempted;$('score-correct-small').textContent=state.correct.length;$('score-wrong').textContent=state.wrong.length;$('score-skipped').textContent=state.skipped.length;$('score-remaining').textContent=state.finished?'0':Math.max(0,state.quiz.length-state.index);$('score-accuracy').textContent=attempted?`${Math.round(state.correct.length/attempted*100)}%`:'—';
    if(state.wordSession)$('word-score-list').innerHTML=wordStats().map(r=>`<div class="word-score-row" title="${r.correct} correct · ${r.wrong} incorrect · ${r.skipped} skipped"><span>${escapeHTML(r.label)}</span><b>${r.correct} / ${r.correct+r.wrong}</b></div>`).join('');}
  function reviewItems(records,good){return records.length?records.slice().reverse().map(r=>`<div class="review-item"><strong>${escapeHTML(r.q.prompt)}</strong><p class="${good?'answer-good':'answer-bad'}">Your answer: ${escapeHTML(r.submitted)}</p><p>Correct: ${escapeHTML(r.correct)}</p><p>${escapeHTML(r.q.wordMode?`${r.q.category} · ${r.q.wordLabel}`:r.q.category)}</p></div>`).join(''):'<div class="empty-review">No answers recorded yet.</div>';}
  function renderReview(){
    $('correct-count').textContent=state.correct.length;$('wrong-count').textContent=state.wrong.length;
    $('correct-list').innerHTML=reviewItems(state.correct,true);$('wrong-list').innerHTML=reviewItems(state.wrong,false);$('correct-list').classList.toggle('hidden',!state.correctVisible);$('wrong-list').classList.toggle('hidden',!state.wrongVisible);$('toggle-correct').textContent=state.correctVisible?'Hide':'Show';$('toggle-wrong').textContent=state.wrongVisible?'Hide':'Show';$('retry-wrong').classList.toggle('hidden',state.wrong.length===0);
  }
  function finishQuiz(){state.finished=true;renderScore();$('question-number').textContent='Session complete';$('mode-label').textContent='Results';$('question-prompt').textContent='You’ve completed this session.';$('question-example').textContent='';$('question-example').classList.add('hidden');$('question-instruction').textContent='';$('question-context').textContent='Review your answers or start a fresh random session.';$('mc-options').classList.add('hidden');$('typed-form').classList.add('hidden');$('feedback').classList.add('hidden');
    const attempted=state.correct.length+state.wrong.length;const pct=attempted?Math.round(state.correct.length/attempted*100):0;
    if(state.wordSession){renderWordResults();}
    else{
      $('results').innerHTML=`<h2>${state.correct.length} / ${attempted} correct</h2><p>Accuracy: ${pct}% · Incorrect: ${state.wrong.length}${state.skipped.length?` · Skipped: ${state.skipped.length}`:''} · Questions in this session: ${state.quiz.length}</p><div class="results-actions"><button class="primary-btn" id="result-restart">Restart randomly</button>${state.wrong.length?'<button class="secondary-btn" id="result-retry">Retry incorrect answers</button>':''}<button class="secondary-btn" id="result-home">Dashboard</button></div>`;
      $('results').querySelector('#result-restart').addEventListener('click',restartCurrent);$('results').querySelector('#result-home').addEventListener('click',()=>setView('dashboard'));if(state.wrong.length)$('results').querySelector('#result-retry').addEventListener('click',()=>retryWrong());
    }
    $('results').classList.remove('hidden');
  }
  function renderWordResults(){
    const total=state.quiz.length, c=state.correct.length, w=state.wrong.length, k=state.skipped.length, pct=total?Math.round(c/total*100):0;
    const rows=wordStats();
    $('results').innerHTML=`<h2>${c} / ${total} correct · ${pct}%</h2>
      <div class="result-grid"><div><span>Total questions</span><b>${total}</b></div><div><span>Correct</span><b>${c}</b></div><div><span>Incorrect</span><b>${w}</b></div><div><span>Skipped</span><b>${k}</b></div><div><span>Final percentage</span><b>${pct}%</b></div><div><span>Overall score</span><b>${c} / ${total}</b></div></div>
      <h3 class="results-sub">Word-wise performance</h3>
      <div class="table-wrap"><table class="word-table"><thead><tr><th>${escapeHTML(cap(state.wordSession.itemLabel))}</th><th>Questions</th><th>Correct</th><th>Incorrect</th><th>Skipped</th><th>Score</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${escapeHTML(r.label)}</td><td>${r.total}</td><td>${r.correct}</td><td>${r.wrong}</td><td>${r.skipped}</td><td>${r.pct}%</td></tr>`).join('')}</tbody></table></div>
      <div class="results-actions">${w?'<button class="secondary-btn" id="result-review">Review wrong answers</button><button class="primary-btn" id="result-retry">Retry wrong answers</button>':''}<button class="${w?'secondary-btn':'primary-btn'}" id="result-restart">Play again</button><button class="secondary-btn" id="result-home">Back to home</button></div>
      <div id="result-review-list" class="review-list hidden">${reviewItems(state.wrong,false)}</div>`;
    const r=$('results');
    r.querySelector('#result-restart').addEventListener('click',restartCurrent);r.querySelector('#result-home').addEventListener('click',()=>setView('dashboard'));
    if(w){r.querySelector('#result-retry').addEventListener('click',()=>retryWrong());r.querySelector('#result-review').addEventListener('click',e=>{const l=r.querySelector('#result-review-list');l.classList.toggle('hidden');e.target.textContent=l.classList.contains('hidden')?'Review wrong answers':'Hide wrong answers';});}
  }
  function retryWrong(){const wrongQs=state.wrong.map(r=>r.q);if(!wrongQs.length)return;state.wordSession?startWordQuiz(state.wordSession,wrongQs):startQuiz(state.activeCategory,wrongQs);}

  /* ---------- Library and verb bank (unchanged) ---------- */
  function renderLibrary(){
    $('library-nav').innerHTML=data.documents.map(d=>`<button data-doc="${d.id}" class="${d.id===state.currentDoc?'active':''}">${escapeHTML(d.title)}<small>${d.chars.toLocaleString()} characters</small></button>`).join('');$('library-nav').querySelectorAll('[data-doc]').forEach(b=>b.addEventListener('click',()=>{state.currentDoc=b.dataset.doc;renderLibrary();}));
    const doc=data.documents.find(d=>d.id===state.currentDoc)||data.documents[0];if(!doc)return;$('doc-title').textContent=doc.title;const search=norm($('doc-search').value);let content=doc.content;
    if(search){const idx=content.toLowerCase().indexOf(search);if(idx>=0){const start=Math.max(0,idx-1000),end=Math.min(content.length,idx+Math.max(search.length,1)+1800);content=(start?'…\n':'')+content.slice(start,end)+(end<doc.content.length?'\n…':'');}}
    $('doc-content').textContent=content;
  }
  function renderVerbBank(){const filter=$('verb-filter').value,search=norm($('verb-search').value);let list=data.questions.filter(q=>(filter==='all'||q.category===filter)&&(!search||norm(q.prompt+' '+q.answers.join(' ')+' '+q.category).includes(search)));
    $('verb-list').innerHTML=list.map(q=>`<div class="verb-item"><div><h3>${escapeHTML(q.prompt)}</h3><p>${escapeHTML(q.category)} · ${q.answers.length} accepted answer${q.answers.length===1?'':'s'}</p></div><button data-qid="${q.id}">Practise</button></div>`).join('')||'<div class="panel" style="padding:20px;color:#697582">No matching prompts. Try another search or topic.</div>';
    $('verb-list').querySelectorAll('[data-qid]').forEach(b=>{b.addEventListener('click',()=>{const q=data.questions.find(x=>x.id===b.dataset.qid);startQuiz(q.category,[q]);});});
  }

  /* ---------- Wiring ---------- */
  document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{setView(b.dataset.view);if(b.dataset.view==='library')renderLibrary();if(b.dataset.view==='verbs')renderVerbBank();}));
  document.querySelectorAll('[data-quiz]').forEach(b=>b.addEventListener('click',()=>startQuiz(b.dataset.quiz)));
  $('back-dashboard').addEventListener('click',()=>{clearTimeout(state.timer);setView('dashboard');});
  $('choice-back').addEventListener('click',()=>setView('dashboard'));
  $('choice-complete').addEventListener('click',()=>startQuiz(state.choiceCategory));
  $('choice-specific').addEventListener('click',()=>showWordSelect(state.choiceCategory));
  $('ws-back').addEventListener('click',()=>showChoice(state.choiceCategory));
  $('ws-select-all').addEventListener('click',()=>{$('ws-grid').querySelectorAll('input').forEach(i=>{i.checked=true;state.selectedWords.add(i.value);i.closest('.word-card').classList.add('selected');});updateSelection();});
  $('ws-deselect-all').addEventListener('click',()=>{$('ws-grid').querySelectorAll('input').forEach(i=>{i.checked=false;i.closest('.word-card').classList.remove('selected');});state.selectedWords.clear();updateSelection();});
  $('ws-start').addEventListener('click',startFromSelection);
  $('typed-form').addEventListener('submit',e=>{e.preventDefault();submitAnswer($('typed-answer').value);});
  $('mode-mc').addEventListener('click',()=>{if(state.answered||state.finished)return;state.mode='mc';renderQuestion();});$('mode-typed').addEventListener('click',()=>{if(state.answered||state.finished)return;state.mode='typed';renderQuestion();$('typed-answer').focus();});
  $('skip-question').addEventListener('click',()=>{if(state.answered||state.finished)return;clearTimeout(state.timer);state.skipped.push({q:state.quiz[state.index]});state.index++;renderQuestion();});$('restart-quiz').addEventListener('click',restartCurrent);
  $('toggle-correct').addEventListener('click',()=>{state.correctVisible=!state.correctVisible;renderReview();});$('toggle-wrong').addEventListener('click',()=>{state.wrongVisible=!state.wrongVisible;renderReview();});$('retry-wrong').addEventListener('click',retryWrong);
  $('doc-search').addEventListener('input',()=>renderLibrary());$('verb-search').addEventListener('input',renderVerbBank);
  $('verb-filter').innerHTML='<option value="all">All topics</option>'+cats.map(c=>`<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join('');$('verb-filter').addEventListener('change',renderVerbBank);
  renderDashboard();renderLibrary();renderVerbBank();

  // Small hook so the logic can be exercised from automated tests (does nothing in normal use).
  window.__grammarQuizTestHooks = {state,startQuiz,startWordQuiz,makeWordOptions,isCorrect,wordQuestions,isEligible,bankCats};
})();
