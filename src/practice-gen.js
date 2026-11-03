/* Practice games — question generators and answer checking (no DOM).
   Original content: window.PRACTICE_BANK (from content/*.txt).  Supplementary content: window.PRACTICE_CONTENT.
   Every question carries origin:'original' | 'supplementary' | 'generated' (generated = built by grammar rules from the verb table). */
(function(root){
'use strict';
const C=root.PRACTICE_CONTENT||{}, B=root.PRACTICE_BANK||{};

/* ---------- utilities ---------- */
const shuffle=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
const pick=a=>a[Math.floor(Math.random()*a.length)];
const cap=s=>s?s.charAt(0).toUpperCase()+s.slice(1):s;
const uniq=a=>[...new Set(a)];
const fixq=s=>String(s??'').replace(/[’‘]/g,"'");
function N(s){
  let t=fixq(s).toLowerCase().trim();
  t=t.replace(/\bwon't\b/g,'will not').replace(/\bshan't\b/g,'shall not').replace(/\bcan't\b/g,'cannot').replace(/n't\b/g,' not')
     .replace(/\bi'm\b/g,'i am').replace(/'re\b/g,' are').replace(/'ve\b/g,' have').replace(/'ll\b/g,' will');
  t=t.replace(/\bcan not\b/g,'cannot').replace(/[.,;:!?"“”()\[\]]/g,' ').replace(/'/g,'').replace(/\s+/g,' ').trim();
  return t;
}
const sameAns=(a,list)=>{const n=N(a);return !!n&&list.some(x=>N(x)===n);};
const lcFirst=s=>/^I(\s|')/.test(s)?s:s.charAt(0).toLowerCase()+s.slice(1);

/* ---------- verbs ---------- */
const VERBS=(C.verbs||'').split('\n').filter(Boolean).map(l=>{
  const f=l.split('|'); const forms=f.slice(0,5).map(x=>x.split('/'));
  const reg=f[7]==='r';
  const rg=forms[0][0];
  const plain=forms[1][0]===rg+'ed'||forms[1][0]===rg+'d';
  const level=reg?(plain?1:2):(forms[1][0]===forms[2][0]?2:3);
  const pattern=reg?'Regular (-ed)':(forms[0][0]===forms[1][0]&&forms[1][0]===forms[2][0]?'AAA':forms[1][0]===forms[2][0]?'ABB':forms[0][0]===forms[2][0]?'ABA':'ABC');
  return {id:'v-'+rg,v1:forms[0],v2:forms[1],v3:forms[2],v4:forms[3],v5:forms[4],forms,hi:f[5],obj:f[6],reg,level,gen:f[8]!=='0',pattern,label:rg,
    head:f[5].split('(')[0].trim()};
});
const FORM_NAMES=['V1 (Base form)','V2 (Past Simple)','V3 (Past Participle)','V4 (-ing form)','V5 (3rd person singular)'];
const FORM_SHORT=['V1','V2','V3','V4','V5'];
const verbById=id=>VERBS.find(v=>v.id===id);
const GEN_VERBS=VERBS.filter(v=>v.gen);
const patternNote=v=>v.reg?`“${v.v1[0]}” is a regular verb: V2 and V3 both add -ed / -d (${v.v2[0]}).`:
  v.pattern==='AAA'?`“${v.v1[0]}” is irregular: V1, V2 and V3 are all the same (${v.v1[0]} – ${v.v2[0]} – ${v.v3[0]}).`:
  v.pattern==='ABB'?`“${v.v1[0]}” is irregular: V2 and V3 are the same (${v.v2[0]}) but different from V1.`:
  v.pattern==='ABA'?`“${v.v1[0]}” is irregular: V1 and V3 are the same (${v.v1[0]}), V2 is different (${v.v2[0]}).`:
  `“${v.v1[0]}” is irregular: all three forms are different (${v.v1[0]} – ${v.v2[0]} – ${v.v3[0]}).`;
const forms5=v=>v.forms.map(f=>f[0]).join(' – ');

/* ---------- tenses ---------- */
const T=[
 {id:'ps',name:'Present Simple',alt:['simple present'],level:1,time:'Present',asp:'Simple',marker:'every day',use:'habits, routines, facts and fixed timetables',
  pos:['Subject','V1 / V5'],neg:['Subject','do/does','not','V1'],q:['Do/Does','Subject','V1','?'],formName:'V1 (V5 for he/she/it)'},
 {id:'pc',name:'Present Continuous',alt:['present progressive'],level:2,time:'Present',asp:'Continuous',marker:'now',use:'actions happening now or temporary situations',
  pos:['Subject','am/is/are','V4'],neg:['Subject','am/is/are','not','V4'],q:['Am/Is/Are','Subject','V4','?'],formName:'V4 (-ing)'},
 {id:'pp',name:'Present Perfect',alt:['perfect present'],level:3,time:'Present',asp:'Perfect',marker:'since morning',use:'past actions connected to the present, experiences and results',
  pos:['Subject','has/have','V3'],neg:['Subject','has/have','not','V3'],q:['Has/Have','Subject','V3','?'],formName:'V3'},
 {id:'ppc',name:'Present Perfect Continuous',alt:['present perfect progressive'],level:3,time:'Present',asp:'Perfect Continuous',marker:'for two hours',use:'actions that started in the past and are still continuing, with their duration',
  pos:['Subject','has/have','been','V4'],neg:['Subject','has/have','not','been','V4'],q:['Has/Have','Subject','been','V4','?'],formName:'V4 (-ing)'},
 {id:'pas',name:'Past Simple',alt:['simple past'],level:1,time:'Past',asp:'Simple',marker:'yesterday',use:'finished actions at a definite time in the past',
  pos:['Subject','V2'],neg:['Subject','did','not','V1'],q:['Did','Subject','V1','?'],formName:'V2 (V1 after did)'},
 {id:'pac',name:'Past Continuous',alt:['past progressive'],level:2,time:'Past',asp:'Continuous',marker:'at 5 o’clock yesterday',use:'actions in progress at a moment in the past',
  pos:['Subject','was/were','V4'],neg:['Subject','was/were','not','V4'],q:['Was/Were','Subject','V4','?'],formName:'V4 (-ing)'},
 {id:'pap',name:'Past Perfect',alt:['perfect past'],level:3,time:'Past',asp:'Perfect',marker:'before noon',use:'an action completed before another past action or time',
  pos:['Subject','had','V3'],neg:['Subject','had','not','V3'],q:['Had','Subject','V3','?'],formName:'V3'},
 {id:'papc',name:'Past Perfect Continuous',alt:['past perfect progressive'],level:3,time:'Past',asp:'Perfect Continuous',marker:'for an hour',use:'an activity that had been going on before a past moment',
  pos:['Subject','had','been','V4'],neg:['Subject','had','not','been','V4'],q:['Had','Subject','been','V4','?'],formName:'V4 (-ing)'},
 {id:'fs',name:'Future Simple',alt:['simple future'],level:1,time:'Future',asp:'Simple',marker:'tomorrow',use:'decisions, promises and predictions about the future',
  pos:['Subject','will','V1'],neg:['Subject','will','not','V1'],q:['Will','Subject','V1','?'],formName:'V1'},
 {id:'fc',name:'Future Continuous',alt:['future progressive'],level:2,time:'Future',asp:'Continuous',marker:'at 8 o’clock tomorrow',use:'actions in progress at a time in the future',
  pos:['Subject','will','be','V4'],neg:['Subject','will','not','be','V4'],q:['Will','Subject','be','V4','?'],formName:'V4 (-ing)'},
 {id:'fp',name:'Future Perfect',alt:['perfect future'],level:3,time:'Future',asp:'Perfect',marker:'by tomorrow evening',use:'an action that will be completed before a future time',
  pos:['Subject','will','have','V3'],neg:['Subject','will','not','have','V3'],q:['Will','Subject','have','V3','?'],formName:'V3'},
 {id:'fpc',name:'Future Perfect Continuous',alt:['future perfect progressive'],level:3,time:'Future',asp:'Perfect Continuous',marker:'for an hour by noon',use:'how long an activity will have been going on by a future time',
  pos:['Subject','will','have','been','V4'],neg:['Subject','will','not','have','been','V4'],q:['Will','Subject','have','been','V4','?'],formName:'V4 (-ing)'}
];
const tenseById=id=>T.find(t=>t.id===id);
const tenseByName=n=>T.find(t=>t.name===n);
const LEVELS={beginner:1,intermediate:2,advanced:3};
const tensesFor=cfg=>cfg&&cfg.tenseIds&&cfg.tenseIds.length?cfg.tenseIds.map(tenseById):T.filter(t=>t.level<=(LEVELS[(cfg&&cfg.difficulty)||'advanced']||3));
const structStr=(arr)=>arr.join(' + ').replace(' + ?',' ?');
const tenseExplain=t=>`${t.name} — used for ${t.use}. Positive: ${structStr(t.pos)}. Negative: ${structStr(t.neg)}. Question: ${structStr(t.q)}.`;

const SUBJ=[
 {s:'I',be:'am',bp:'was',hv:'have',ds:'do',sg:false},{s:'you',be:'are',bp:'were',hv:'have',ds:'do',sg:false},
 {s:'we',be:'are',bp:'were',hv:'have',ds:'do',sg:false},{s:'they',be:'are',bp:'were',hv:'have',ds:'do',sg:false},
 {s:'he',be:'is',bp:'was',hv:'has',ds:'does',sg:true},{s:'she',be:'is',bp:'was',hv:'has',ds:'does',sg:true},
 {s:'my sister',be:'is',bp:'was',hv:'has',ds:'does',sg:true},{s:'my brother',be:'is',bp:'was',hv:'has',ds:'does',sg:true},
 {s:'the students',be:'are',bp:'were',hv:'have',ds:'do',sg:false}
];
/* returns {aux:[...], main, words, text, first} for a tense/subject/verb/polarity/question form. vi = variant index of the verb forms */
function conj(t,s,v,pol,isQ,opts){
  opts=opts||{}; const vi=opts.vi||0; const f=i=>v.forms[i][Math.min(vi,v.forms[i].length-1)];
  const marker=opts.noMarker?'':t.marker;
  let aux=[],main;
  switch(t.id){
    case 'ps':aux=[];main=s.sg?f(4):f(0);break;
    case 'pc':aux=[s.be];main=f(3);break;
    case 'pp':aux=[s.hv];main=f(2);break;
    case 'ppc':aux=[s.hv,'been'];main=f(3);break;
    case 'pas':aux=[];main=f(1);break;
    case 'pac':aux=[s.bp];main=f(3);break;
    case 'pap':aux=['had'];main=f(2);break;
    case 'papc':aux=['had','been'];main=f(3);break;
    case 'fs':aux=['will'];main=f(0);break;
    case 'fc':aux=['will','be'];main=f(3);break;
    case 'fp':aux=['will','have'];main=f(2);break;
    case 'fpc':aux=['will','have','been'];main=f(3);break;
  }
  let first=aux[0]||null, rest=aux.slice(1), mainW=main, neg=pol==='neg';
  if(!aux.length){ // do-support
    if(t.id==='ps'){ if(neg||isQ){first=s.ds;mainW=f(0);} }
    if(t.id==='pas'){ if(neg||isQ){first='did';mainW=f(0);} }
  }
  const tail=[...rest,mainW,v.obj,marker].filter(Boolean);
  const subj=s.s;
  let words,text;
  if(isQ){
    words=[first,subj,...tail];
    text=cap(words.join(' '))+'?';
  }else{
    const body=[];
    if(first){body.push(first); if(neg)body.push('not');}
    words=[subj,...body,...tail];
    text=cap(words.join(' '))+'.';
  }
  text=text.replace(/^I\b/,'I'); 
  return {text,first,mainW,rest,aux:first?[first,...rest]:[],words};
}
/* all accepted answers for a tense sentence (verb variants x optional marker) */
function conjAnswers(t,s,v,pol,isQ,withMarkerOptions){
  const out=[];const nv=Math.max(...v.forms.map(f=>f.length));
  for(let vi=0;vi<nv;vi++){
    out.push(conj(t,s,v,pol,isQ,{vi}).text);
    if(withMarkerOptions){out.push(conj(t,s,v,pol,isQ,{vi,noMarker:true}).text);}
  }
  return uniq(out);
}
const AUXMAP={do:'does',does:'do',is:'are',are:'is',am:'is',was:'were',were:'was',has:'have',have:'has'};
/* plausible WRONG versions of a sentence (wrong agreement / wrong verb form). Never equal to a correct answer. */
function wrongs(t,s,v,pol,isQ){
  const correct=conjAnswers(t,s,v,pol,isQ,true).map(N);const base=conj(t,s,v,pol,isQ);const out=[];
  const make=(first,mainW)=>{
    const tail=[...base.rest,mainW,v.obj,t.marker].filter(Boolean);let w;
    if(isQ)w=[first,s.s,...tail];else{w=[s.s];if(first){w.push(first);if(pol==='neg')w.push('not');}w.push(...tail);}
    return cap(w.join(' '))+(isQ?'?':'.');
  };
  const ok=x=>!correct.includes(N(x));
  if(base.first&&AUXMAP[base.first]){const x=make(AUXMAP[base.first],base.mainW);if(ok(x))out.push({text:x,kind:'aux',bad:AUXMAP[base.first],good:base.first});}
  const mainOptions=[0,1,2,3,4].map(i=>v.forms[i][0]).filter(f=>N(f)!==N(base.mainW));
  for(const mf of shuffle(uniq(mainOptions))){const x=make(base.first,mf);if(ok(x))out.push({text:x,kind:'form',bad:mf,good:base.mainW});}
  return out;
}
const RULE=t=>`In the ${t.name}, the structure is ${structStr(t.pos)}.`;

/* ---------- question helpers ---------- */
let SEQ=0;
const Q=(o)=>Object.assign({origin:'generated',kind:'choice',typed:true},o);
const tnameAns=t=>[t.name,t.name+' tense',...t.alt,...t.alt.map(a=>a+' tense')];
function tenseOptions(t,pool){
  const same=pool.filter(x=>x.id!==t.id&&(x.time===t.time||x.asp===t.asp));
  const rest=pool.filter(x=>x.id!==t.id&&!same.includes(x));
  return uniq([t.name,...shuffle(same).slice(0,3).map(x=>x.name),...shuffle(rest).map(x=>x.name)]).slice(0,4);
}
function loop(count,fn,maxTry){
  const seen=new Set(),out=[];let tries=0;maxTry=maxTry||count*40;
  while(out.length<count&&tries++<maxTry){const q=fn();if(!q||seen.has(q.id))continue;seen.add(q.id);out.push(q);}
  return out;
}
function randSent(cfg,opts){
  const ts=tensesFor(cfg),t=pick(ts),s=pick(SUBJ),v=pick(cfg&&cfg.verbIds&&cfg.verbIds.length?cfg.verbIds.map(verbById).filter(x=>x&&x.gen).concat([]):GEN_VERBS);
  return {t,s,v:v||pick(GEN_VERBS)};
}
const polFor=(cfg,t)=>((cfg&&cfg.difficulty==='advanced')?pick(['pos','neg','pos']):'pos');

/* ===================== TENSES (games 1–10) ===================== */
const TG={};
TG.g1=cfg=>loop(cfg.count,()=>{
  const {t,s,v}=randSent(cfg),pol=pick(['pos','pos','neg']),isQ=pol==='pos'&&cfg.difficulty==='advanced'&&Math.random()<.25;
  const c=conj(t,s,v,pol,isQ),pool=tensesFor(cfg).length>=4?tensesFor(cfg):T;
  return Q({id:'g1|'+c.text,game:1,cat:'Tenses',topic:t.name,prompt:'Which tense is used in this sentence?',sub:c.text,options:tenseOptions(t,pool),answers:tnameAns(t),show:t.name,
    explain:`${c.text} — ${t.name}. ${tenseExplain(t)}`});
});
TG.g2=cfg=>loop(cfg.count,()=>{
  const ts=tensesFor(cfg);const a=pick(ts);let b=cfg.targetTense&&cfg.targetTense!=='random'?tenseById(cfg.targetTense):pick(T);
  if(a.id===b.id)return null;const s=pick(SUBJ),v=pick(GEN_VERBS),pol=cfg.difficulty==='advanced'?pick(['pos','neg']):'pos';
  const from=conj(a,s,v,pol,false,{noMarker:true}).text,answers=conjAnswers(b,s,v,pol,false,true);
  const an=answers.map(N);if(an.includes(N(from)))return null;
  const wr=shuffle(T.filter(x=>x.id!==b.id)).map(x=>conj(x,s,v,pol,false,{noMarker:true}).text).filter(x=>!an.includes(N(x))).slice(0,3);
  return Q({id:`g2|${a.id}>${b.id}|${from}`,game:2,cat:'Tenses',topic:b.name,prompt:`Rewrite this sentence in the ${b.name}.`,sub:from,hint:`Original: ${a.name} → Target: ${b.name}`,
    options:uniq([answers[0],...wr]),answers,show:answers[0],
    explain:`${a.name} → ${b.name}: “${from}” becomes “${answers[0]}”. ${b.name} structure: ${structStr(b.pos)}.`});
});
TG.g3=cfg=>loop(cfg.count,()=>{
  const {t,s,v}=randSent(cfg),pol=polFor(cfg,t),isQ=pol==='pos'&&Math.random()<.2&&cfg.difficulty==='advanced';
  const c=conj(t,s,v,pol,isQ);const ansForms=v.forms.map(f=>f[0]);const answerSet=[];
  const nv=Math.max(...v.forms.map(f=>f.length));for(let i=0;i<nv;i++)answerSet.push(conj(t,s,v,pol,isQ,{vi:i}).mainW);
  const blanked=c.text.replace(new RegExp('\\b'+c.mainW.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b'),'_____');
  const opts=uniq([c.mainW,...shuffle(ansForms.filter(x=>!answerSet.includes(x)))]).slice(0,4);
  if(opts.length<3)return null;
  return Q({id:'g3|'+c.text,game:3,cat:'Tenses',topic:t.name,prompt:'Choose the correct verb form to complete the sentence.',sub:blanked,options:opts,answers:uniq(answerSet),show:c.mainW,
    explain:`${c.text} — ${t.name}: ${structStr(t.pos)}. Here the verb must be ${t.formName}.`});
});
TG.g4=cfg=>loop(cfg.count,()=>{
  const {t,s,v}=randSent(cfg);const p=conj(t,s,v,'pos',false),answers=conjAnswers(t,s,v,'neg',false,false),w=wrongs(t,s,v,'neg',false);
  if(w.length<3)return null;
  const why=t.id==='ps'||t.id==='pas'?`${t.name} has no helping verb in positive sentences, so we add ${t.id==='ps'?'do / does':'did'} + not and use V1.`:`Add “not” after the first helping verb (${p.first}).`;
  return Q({id:'g4|'+p.text,game:4,cat:'Tenses',topic:t.name,prompt:'Change this sentence into the negative.',sub:p.text,options:uniq([answers[0],...shuffle(w).slice(0,3).map(x=>x.text)]),answers,show:answers[0],
    explain:`${answers[0]} — ${why} Negative structure: ${structStr(t.neg)}.`});
});
TG.g5=cfg=>loop(cfg.count,()=>{
  const {t,s,v}=randSent(cfg);const p=conj(t,s,v,'pos',false),answers=conjAnswers(t,s,v,'pos',true,false),w=wrongs(t,s,v,'pos',true);
  if(w.length<3)return null;
  const why=t.id==='ps'||t.id==='pas'?`${t.name} needs ${t.id==='ps'?'do / does':'did'} at the start, and the main verb goes back to V1.`:`Move the first helping verb (${p.first}) before the subject.`;
  return Q({id:'g5|'+p.text,game:5,cat:'Tenses',topic:t.name,prompt:'Change this statement into a question.',sub:p.text,options:uniq([answers[0],...shuffle(w).slice(0,3).map(x=>x.text)]),answers,show:answers[0],
    explain:`${answers[0]} — ${why} Question structure: ${structStr(t.q)}.`});
});
TG.g6=cfg=>loop(cfg.count,()=>{
  const {t,s,v}=randSent(cfg);const pol=pick(['pos','pos','neg']);const w=wrongs(t,s,v,pol,false);if(w.length<4)return null;
  const bad=pick(w),correct=conjAnswers(t,s,v,pol,false,false),others=shuffle(w.filter(x=>x!==bad)).slice(0,3);
  const ruleTxt=bad.kind==='aux'?`The helping verb must agree with the subject “${s.s}”: use “${bad.good}”, not “${bad.bad}”.`:`${RULE(t)} After this helping verb the verb must be ${t.formName}, so “${bad.good}” is needed, not “${bad.bad}”.`;
  return Q({id:'g6|'+bad.text,game:6,cat:'Tenses',topic:t.name,prompt:'This sentence contains a tense mistake. Write the correct sentence.',sub:bad.text,
    options:uniq([correct[0],...others.map(x=>x.text)]),answers:correct,show:correct[0],
    explain:`Incorrect part: “${bad.bad}” → correct: “${bad.good}”. ${ruleTxt}`});
});
TG.g8=cfg=>{
  const list=(C.situations||[]).filter(x=>tensesFor(cfg).some(t=>t.name===x[0]));const pool=tensesFor(cfg).length>=4?tensesFor(cfg):T;
  return shuffle(list).slice(0,cfg.count).map(([name,sit,ex,why])=>{const t=tenseByName(name);
    return Q({id:'g8|'+sit,game:8,cat:'Tenses',topic:name,origin:'supplementary',prompt:'Which tense is appropriate for this situation?',sub:sit,options:tenseOptions(t,pool),answers:tnameAns(t),show:name,
      explain:`${name}. ${why} Example: “${ex}”`});});
};
const HELP_POOL=['is','am','are','was','were','has','have','had','do','does','did','will'];
TG.g9=cfg=>loop(cfg.count,()=>{
  const {t,s,v}=randSent(cfg);const kinds=t.id==='ps'||t.id==='pas'?['neg','q']:['pos','neg','q'];const k=pick(kinds);
  const c=conj(t,s,v,k==='neg'?'neg':'pos',k==='q');const first=c.first;if(!first)return null;
  const answers=[first];if(t.id==='fs'||t.id==='fc'||t.id==='fp'||t.id==='fpc'){if(s.s==='I'||s.s==='we')answers.push(first==='will'?'shall':'will');}
  const wrongAgree=AUXMAP[first]?[AUXMAP[first]]:[];
  const timeBad={Present:['was','were','had','did','will'],Past:['is','am','are','has','have','do','does','will'],Future:['is','am','are','was','were','has','have','had','do','does','did']}[t.time];
  const pool=uniq([...wrongAgree,...shuffle(timeBad)]).filter(x=>!answers.map(N).includes(N(x))&&HELP_POOL.includes(x));
  const opts=uniq([pick(answers),...pool]).slice(0,4);
  const blanked=c.text.replace(new RegExp((k==='q'?'^':'\\b')+first+'\\b','i'),'_____');
  const tag=k==='neg'?' (negative)':k==='q'?' (question)':'';
  return Q({id:'g9|'+c.text,game:9,cat:'Tenses',topic:t.name,prompt:'Choose the correct helping verb.',sub:blanked,hint:`Tense: ${t.name}${tag}`,options:opts,answers,show:answers.join(' / '),
    explain:`${c.text} — ${t.name}${tag}: ${structStr(k==='neg'?t.neg:k==='q'?t.q:t.pos)}. “${first}” agrees with “${s.s}”.${answers.length>1?' With I / we, “shall” can also be used in the future.':''}`});
});
const aliasTok=tok=>{const base=tok.replace(/\s*\(.*\)/,'');const parts=base.split('/').map(x=>x.trim());const out=[tok,base,...parts,parts.join('/')];
  parts.forEach(p=>{const m=p.match(/^v(\d)$/i);if(m)out.push('verb '+m[1],'verb form '+m[1],'form '+m[1]);});return uniq(out);};
const STRUCT_POOL=['am/is/are','was/were','has/have','had','do/does','did','will','not','been','be','have','V1','V2','V3','V4','V1 / V5'];
TG.g10=cfg=>loop(cfg.count,()=>{
  const t=pick(tensesFor(cfg)),k=pick(['pos','neg','q']),arr=t[k];const idxs=arr.map((x,i)=>i).filter(i=>arr[i]!=='Subject'&&arr[i]!=='?');
  const i=pick(idxs),tok=arr[i];const shown=arr.map((x,j)=>j===i?'_____':x).join(' + ').replace(' + ?',' ?');
  const ans=aliasTok(tok);let pool=STRUCT_POOL.filter(x=>!aliasTok(x).some(a=>ans.map(N).includes(N(a))));
  const label=k==='pos'?'Positive':k==='neg'?'Negative':'Question';
  return Q({id:`g10|${t.id}|${k}|${i}`,game:10,cat:'Tenses',topic:t.name,prompt:`Complete the ${label.toLowerCase()} structure of the ${t.name}.`,sub:shown,hint:`Tense: ${t.name} · ${label} form`,
    options:uniq([tok,...shuffle(pool).slice(0,3)]),answers:ans,show:tok,explain:`${t.name} — ${label}: ${structStr(arr)}. Used for ${t.use}.`});
});

/* ===================== VERBS (games 31–40) ===================== */
const vf=(v,i)=>v.forms[i][0];
const vLevelOK=(v,cfg)=>v.level<=(LEVELS[(cfg&&cfg.difficulty)||'advanced']||3);
const verbPool=cfg=>{let p=cfg&&cfg.verbIds&&cfg.verbIds.length?cfg.verbIds.map(verbById).filter(Boolean):VERBS.filter(v=>vLevelOK(v,cfg));return p.length?p:VERBS;};
function formOptions(v,slot){
  const correct=v.forms[slot],ans=correct.map(N);
  let pool=uniq(v.forms.flatMap((f,i)=>i===slot?[]:[f[0]])).filter(x=>!ans.includes(N(x)));
  if(!v.reg){const w=v.v1[0]+(v.v1[0].endsWith('e')?'d':'ed');if(!ans.includes(N(w))&&!pool.includes(w))pool.push(w);}
  const others=shuffle(VERBS.filter(x=>x!==v)).map(x=>x.forms[slot][0]).filter(x=>!ans.includes(N(x))&&!pool.includes(x));
  return uniq([correct[0],...shuffle(pool),...others]).slice(0,4);
}
const VG={};
VG.g31=cfg=>loop(cfg.count,()=>{
  const v=pick(verbPool(cfg));let a=Math.floor(Math.random()*5),b=Math.floor(Math.random()*5);if(a===b)return null;
  return Q({id:`g31|${v.id}|${a}>${b}`,game:31,cat:'Verbs',topic:v.label,origin:'supplementary',prompt:`${FORM_SHORT[a]}: ${vf(v,a)} — what is ${FORM_NAMES[b]}?`,sub:`Meaning: ${v.hi}`,
    options:formOptions(v,b),answers:v.forms[b],show:vf(v,b),explain:`${v.v1[0]} – ${v.v2[0]} – ${v.v3[0]} – ${v.v4[0]} – ${v.v5[0]}  (V1–V5). ${patternNote(v)}`});
});
const fieldsQ=(id,game,v,hidden,given,extra)=>Q(Object.assign({id,game,cat:'Verbs',topic:v.label,origin:'supplementary',kind:'fields',
  fields:[0,1,2,3,4].map(i=>({label:FORM_NAMES[i],short:FORM_SHORT[i],given:!hidden.includes(i),answers:v.forms[i],value:vf(v,i)})),
  show:forms5(v),explain:`${forms5(v)} (V1–V5). ${patternNote(v)}`,sub:`Meaning: ${v.hi}`},extra||{}));
VG.g32=cfg=>loop(cfg.count,()=>{const v=pick(verbPool(cfg));const g=Math.random()<.6?0:Math.floor(Math.random()*5);
  return fieldsQ(`g32|${v.id}|${g}`,32,v,[0,1,2,3,4].filter(i=>i!==g),g,{prompt:`Complete all five forms of “${vf(v,g)}”.`,typed:true,fieldsOnly:true});});
VG.g33=cfg=>loop(cfg.count,()=>{
  const v=pick(verbPool(cfg));const ex=cap(`she ${vf(v,4)} ${v.obj}.`);
  const alts=VERBS.filter(x=>x!==v&&x.head===v.head);const opts=uniq([vf(v,0),...shuffle(VERBS.filter(x=>x!==v&&x.head!==v.head)).slice(0,3).map(x=>vf(x,0))]);
  return Q({id:'g33|'+v.id,game:33,cat:'Verbs',topic:v.label,origin:'supplementary',prompt:`Hindi: ${v.hi}`,sub:'Which English verb (V1) has this meaning?',options:opts,answers:v.v1,show:vf(v,0),
    explain:`${vf(v,0)} — ${forms5(v)}. Example: ${ex}`,altNote:alts.length?alts.map(x=>x.label).join(', '):''});
});
VG.g35=cfg=>loop(cfg.count,()=>{
  const v=pick(verbPool(cfg));const nHide=cfg.difficulty==='beginner'?1:cfg.difficulty==='intermediate'?2:pick([1,2,3]);
  const hidden=shuffle([1,2,3,4,0].filter(i=>true)).slice(0,nHide).sort();
  const row=[0,1,2,3,4].map(i=>hidden.includes(i)?'_____':vf(v,i)).join(' – ');
  const q=fieldsQ(`g35|${v.id}|${hidden.join('')}`,35,v,hidden,0,{prompt:'Complete the missing verb forms.',sub:`${row}\n(Meaning: ${v.hi})`});
  if(hidden.length===1){q.options=formOptions(v,hidden[0]);q.fieldsOnly=false;q.answers=v.forms[hidden[0]];q.kind='choice';q.fields=null;q.prompt=`${row}\nWhich form is missing?`;q.sub=`Meaning: ${v.hi}`;}
  return q;
});
VG.g37=cfg=>loop(cfg.count,()=>{
  const v=pick(verbPool(cfg));
  return Q({id:'g37|'+v.id,game:37,cat:'Verbs',topic:v.label,origin:'supplementary',prompt:`Is “${vf(v,0)}” a regular or an irregular verb?`,sub:`Meaning: ${v.hi}`,options:['Regular','Irregular'],
    answers:v.reg?['Regular','r']:['Irregular','i'],show:v.reg?'Regular':'Irregular',explain:`${forms5(v)}. ${patternNote(v)} Example: ${cap(`she ${vf(v,4)} ${v.obj}.`)}`});
});
VG.g39=cfg=>{
  const pool=verbPool(cfg);const out=loop(Math.ceil(cfg.count*.75),()=>{
    const t=pick(tensesFor(cfg).filter(x=>x.id!=='ps'||true)),s=pick(SUBJ),v=pick(pool.filter(x=>x.gen)||GEN_VERBS);const c=conj(t,s,v,'pos',false,{noMarker:true});
    const answerSet=v.forms.map((f,i)=>i).map(i=>null);const nv=Math.max(...v.forms.map(f=>f.length));const ans=[];for(let i=0;i<nv;i++)ans.push(conj(t,s,v,'pos',false,{noMarker:true,vi:i}).mainW);
    const blanked=c.text.replace(new RegExp('\\b'+c.mainW+'\\b'),'_____');
    const opts=uniq([c.mainW,...shuffle(v.forms.map(f=>f[0]).filter(x=>!ans.includes(x)))]).slice(0,4);if(opts.length<3)return null;
    return Q({id:'g39|'+c.text,game:39,cat:'Verbs',topic:v.label,prompt:'Choose the correct verb form.',sub:blanked,hint:`Tense: ${t.name}`,options:opts,answers:uniq(ans),show:c.mainW,
      explain:`${c.text} — ${t.name}: ${structStr(t.pos)}. The verb form needed is ${t.formName}.`});
  });
  const agree=[['be','am','is','are','was','were'],['have','have','has'],['do','do','does']];
  const extra=loop(cfg.count-out.length,()=>{
    const s=pick(SUBJ),kind=pick(['be','be-past','have','do']);let ans,opts,sent,why;
    if(kind==='be'){ans=s.be;opts=['am','is','are'];sent=`${cap(s.s)} ___ ready now.`;why=`“${s.s}” takes “${ans}” in the present.`;}
    else if(kind==='be-past'){ans=s.bp;opts=['was','were'];sent=`${cap(s.s)} ___ at home yesterday.`;why=`“${s.s}” takes “${ans}” in the past.`;}
    else if(kind==='have'){ans=s.hv;opts=['have','has'];sent=`${cap(s.s)} ___ a new bag.`;why=`“${s.s}” takes “${ans}”.`;}
    else{ans=s.ds;opts=['do','does'];sent=`${cap(s.s)} ___ the homework every day.`;why=`“${s.s}” takes “${ans}”.`;}
    return Q({id:'g39a|'+sent,game:39,cat:'Verbs',topic:kind==='have'?'have':kind==='do'?'do':'be',origin:'supplementary',prompt:'Choose the verb that agrees with the subject.',sub:sent,options:shuffle(opts),answers:[ans],show:ans,explain:`${sent.replace('___',ans)} — subject–verb agreement: ${why}`});
  });
  return [...out,...extra];
};
/* verb identification from generated sentences + multi-verb sentences */
VG.g36=cfg=>{
  const a=loop(Math.ceil(cfg.count*.75),()=>{
    const {t,s,v}=randSent(cfg),pol=pick(['pos','pos','neg']),c=conj(t,s,v,pol,false,{noMarker:true});
    const tokens=c.text.replace(/[.?]$/,'').split(' ');const askHelp=c.aux.length&&Math.random()<.35;
    const target=askHelp?c.first:c.mainW;const idx=tokens.findIndex(w=>N(w)===N(target));if(idx<0)return null;
    const tail=c.aux.length?`Helping verb(s): ${c.aux.join(' ')}. `:'There is no helping verb here. ';
    return Q({id:`g36|${c.text}|${askHelp?'h':'m'}`,game:36,cat:'Verbs',topic:t.name,kind:'pick',typed:false,prompt:askHelp?'Select the helping verb.':'Select the main verb.',sub:'',tokens,answers:[target.toLowerCase()],show:target,
      explain:`${c.text} — ${tail}The main verb is “${c.mainW}” (${t.formName}).`});
  });
  const b=shuffle(C.multiVerb||[]).slice(0,Math.max(0,cfg.count-a.length)).map(([sent,mains,helps])=>Q({id:'g36m|'+sent,game:36,cat:'Verbs',topic:'Multiple verbs',origin:'supplementary',kind:'pick',multi:true,typed:false,
    prompt:'Select ALL the main verbs in this sentence.',sub:'',tokens:sent.replace(/[.?]$/,'').split(' '),answers:mains,show:mains.join(', '),explain:`${sent} — main verbs: ${mains.join(', ')}.${helps.length?' Helping verb: '+helps.join(', ')+'.':''}`}));
  return [...a,...b];
};
/* usage challenge */
const SCEN=[
 {d:'Say something you do every day.',t:'Present Simple',need:(v)=>[...v.v1,...v.v5]},
 {d:'Say something that happened yesterday.',t:'Past Simple',need:(v)=>v.v2},
 {d:'Say what someone is doing right now.',t:'Present Continuous',need:(v)=>v.v4,aux:['am','is','are']},
 {d:'Say something that someone has already finished.',t:'Present Perfect',need:(v)=>v.v3,aux:['has','have']},
 {d:'Say something you will do tomorrow.',t:'Future Simple',need:(v)=>v.v1,aux:['will','shall']}
];
function usageCheck(text,v,sc){
  const t=fixq(text).trim();const words=N(t).split(' ').filter(Boolean);
  if(words.length<3)return {ok:false,msg:'Write a complete sentence (at least 3 words).'};
  const has=forms=>forms.some(f=>words.includes(N(f)));
  if(!has(sc.need(v)))return {ok:false,msg:`Use the ${sc.t} form of “${vf(v,0)}” (${sc.need(v)[0]}).`};
  if(sc.aux&&!sc.aux.some(a=>words.includes(a)))return {ok:false,msg:`The ${sc.t} needs a helping verb: ${sc.aux.join(' / ')}.`};
  const forms=i=>v.forms[i].map(N);const sing=['he','she','it'],plur=['i','you','we','they'];
  for(let i=0;i<words.length-1;i++){
    const w=words[i],n=words[i+1];
    if(sing.includes(w)&&forms(0).includes(n)&&!forms(4).includes(n)&&!forms(1).includes(n)&&!['will','can','could','would','should','shall'].includes(w))return {ok:false,msg:`With “${w}” in the present simple, use “${vf(v,4)}”, not “${n}”.`};
    if(plur.includes(w)&&forms(4).includes(n)&&!forms(0).includes(n))return {ok:false,msg:`With “${w}”, use “${vf(v,0)}”, not “${n}”.`};
    if(['has','have','had'].includes(w)&&forms(1).includes(n)&&!forms(2).includes(n))return {ok:false,msg:`After “${w}” use V3 “${vf(v,2)}”, not “${n}”.`};
    if(['will','shall','did','does','do','can','could','would','should'].includes(w)&&(forms(1).includes(n)||forms(4).includes(n)||forms(3).includes(n))&&!forms(0).includes(n))return {ok:false,msg:`After “${w}” use the base form “${vf(v,0)}”, not “${n}”.`};
  }
  return {ok:true};
}
VG.g38=cfg=>loop(cfg.count,()=>{
  const v=pick(verbPool(cfg)),sc=pick(SCEN);
  if(Math.random()<.35){ // identify the correct usage
    const t=pick(T.filter(x=>x.level<=1||x.level<=(LEVELS[cfg.difficulty||'advanced']))),s=pick(SUBJ),vv=v.gen?v:pick(GEN_VERBS);
    const w=wrongs(t,s,vv,'pos',false);if(w.length<3)return null;const ans=conjAnswers(t,s,vv,'pos',false,false);
    return Q({id:`g38c|${t.id}|${s.s}|${vv.id}`,game:38,cat:'Verbs',topic:vv.label,prompt:`Which sentence uses “${vf(vv,0)}” correctly?`,sub:`Meaning: ${vv.hi}`,options:uniq([ans[0],...shuffle(w).slice(0,3).map(x=>x.text)]),answers:ans,show:ans[0],
      explain:`${ans[0]} — ${t.name}: ${structStr(t.pos)}.`});
  }
  const ex=sc.t==='Present Simple'?cap(`she ${vf(v,4)} ${v.obj}.`):sc.t==='Past Simple'?cap(`she ${vf(v,1)} ${v.obj}.`):sc.t==='Present Continuous'?cap(`she is ${vf(v,3)} ${v.obj}.`):sc.t==='Present Perfect'?cap(`she has ${vf(v,2)} ${v.obj}.`):cap(`I will ${vf(v,0)} ${v.obj}.`);
  return Q({id:`g38|${v.id}|${sc.t}`,game:38,cat:'Verbs',topic:v.label,origin:'supplementary',kind:'text',typedOnly:true,usage:{verb:v.id,sc:SCEN.indexOf(sc)},
    prompt:`Write a sentence using the verb “${vf(v,0)}” (${v.hi}).`,sub:`Situation: ${sc.d} (${sc.t})`,answers:[ex],show:ex,
    explain:`Example: ${ex} — Forms: ${forms5(v)}. The answer is checked by simple grammar rules (verb form, helping verb, agreement); it is not a full grammar parser.`});
});
VG.g40=cfg=>shuffle(verbPool({difficulty:cfg.difficulty})).map(v=>fieldsQ('g40|'+v.id,40,v,[1,2],0,{prompt:`${vf(v,0)} — enter V2 and V3`,sub:`Meaning: ${v.hi}`,fieldsOnly:true}));

/* ===================== ORIGINAL BANK (prepositions / conjunctions) ===================== */
const srcSet=new Set();
Object.values(B).forEach(ws=>ws.forEach(w=>w.uses.forEach(u=>u.sentences.forEach(s=>srcSet.add(N(s.en))))));
const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function findMatch(sentence,answers){
  const s=fixq(sentence);
  for(const a of [...answers].sort((x,y)=>y.length-x.length)){
    const re=new RegExp('(^|[^A-Za-z])('+esc(fixq(a)).replace(/\s+/g,'\\s+')+')((?:\\/[A-Za-z]+)*)(?=$|[^A-Za-z])','gi');
    const ms=[...s.matchAll(re)];if(ms.length===1){const m=ms[0];const start=m.index+m[1].length;return {text:s.substr(start,m[2].length),start,end:start+m[2].length+m[3].length,alt:m[3]};}
  }
  return null;
}
function items(cat){
  const out=[];const words=(B[cat]||[]);
  for(const w of words)for(const u of w.uses)for(const s of u.sentences){
    const m=findMatch(s.en,u.answers);if(!m)continue;
    out.push({cat,word:w,use:u,sentence:s,m,blank:s.en.slice(0,m.start)+'_____'+s.en.slice(m.end),single:!/\s/.test(m.text)&&!m.alt});
  }
  return out;
}
const ITEMS={Prepositions:items('Prepositions'),Conjunctions:items('Conjunctions')};
const WORDS=cat=>B[cat]||[];
const wordPool=(cat,cfg)=>{let w=WORDS(cat);if(cfg&&cfg.wordIds&&cfg.wordIds.length)w=w.filter(x=>cfg.wordIds.includes(x.id));else if(cfg&&cfg.difficulty)w=w.filter(x=>x.level<=(LEVELS[cfg.difficulty]||3));return w;};
const itemPool=(cat,cfg)=>{const ids=new Set(wordPool(cat,cfg).map(w=>w.id));return ITEMS[cat].filter(i=>ids.has(i.word.id));};
const hintAnswerSet=(cat,hint)=>{const s=new Set();WORDS(cat).forEach(w=>w.uses.forEach(u=>{if(u.hint===hint)u.answers.forEach(a=>s.add(N(a)));}));return s;};
const allVariants=cat=>uniq(WORDS(cat).flatMap(w=>w.variants).filter(x=>x.length<=14&&!/[….+–]/.test(x)).map(x=>x.toLowerCase()));
const caseLike=(sample,w)=>/^[A-Z]/.test(sample)?cap(w):w;
const nm=s=>s.toLowerCase();
function fillOptions(it,n){
  const bad=hintAnswerSet(it.cat,it.use.hint);it.use.answers.forEach(a=>bad.add(N(a)));bad.add(N(it.m.text));
  const ok=w=>{if(bad.has(N(w)))return false;const filled=it.sentence.en.slice(0,it.m.start)+w+it.sentence.en.slice(it.m.end);return !srcSet.has(N(filled));};
  const pool=shuffle(allVariants(it.cat)).filter(ok);
  return uniq([caseLike(it.m.text,nm(it.m.text)),...pool.slice(0,n-1).map(w=>caseLike(it.m.text,w))]);
}
const itemTopic=it=>it.word.label;
const itemOrigin='original';
function fillQ(it,game,prompt){
  const accepted=uniq([it.m.text,...it.use.answers]);const opts=fillOptions(it,4);
  const filledSentence=it.sentence.en;
  return Q({id:`g${game}|${it.use.id}|${it.sentence.en}`,game,cat:it.cat,topic:itemTopic(it),origin:itemOrigin,prompt:prompt,sub:it.blank,hint:`Meaning: ${it.use.hint}`,options:opts,answers:accepted,show:it.m.text,
    explain:`${filledSentence} — ${it.use.hint}. Accepted for this use: ${it.use.answers.join(' / ')}.`});
}
function hindiQ(it,game){
  const accepted=it.use.answers;const ex=it.sentence.hi?`${it.sentence.hi}\n${it.blank}`:it.blank;
  const label=it.cat==='Prepositions'?'preposition':'conjunction';
  const opts=fillOptions(it,4).map(x=>cap(x));
  return Q({id:`g${game}|${it.use.id}`,game,cat:it.cat,topic:itemTopic(it),origin:itemOrigin,prompt:`Hindi: ${it.use.hint}`,sub:ex,options:uniq([cap(it.m.text),...opts.filter(o=>N(o)!==N(it.m.text))]).slice(0,4),
    answers:accepted,show:accepted.join(' / '),explain:`${it.use.hint} → ${accepted.join(' / ')}. Example: ${it.sentence.en}`,labelWord:label});
}
function useOnly(cat,use,w,game,typedOnly){
  const accepted=use.answers;const s=pick(use.sentences.length?use.sentences:[{en:'',hi:''}]);
  return Q({id:`g${game}m|${use.id}`,game,cat,topic:w.label,origin:itemOrigin,prompt:`Meaning: ${use.hint}`,sub:'',typedOnly:!!typedOnly,answers:accepted,show:accepted.join(' / '),
    options:typedOnly?null:undefined,explain:`${use.hint} → ${accepted.join(' / ')}. Example: ${s.en}`});
}
function pickQ(it,game,prompt){
  const tokens=fixq(it.sentence.en).replace(/[.?!”"]+$/,'').split(' ');const target=nm(it.m.text);
  const idx=tokens.findIndex(t=>N(t)===N(target));if(idx<0||!it.single)return null;
  return Q({id:`g${game}|${it.use.id}|${it.sentence.en}`,game,cat:it.cat,topic:itemTopic(it),origin:itemOrigin,kind:'pick',typed:false,prompt,sub:'',hint:`Meaning: ${it.use.hint}`,tokens:it.sentence.en.replace(/[.?!”"]+$/,'').split(' '),
    answers:uniq([target,...it.use.answers.filter(a=>!/\s/.test(a)).map(nm).filter(a=>tokens.some(t=>N(t)===N(a)))]),show:it.m.text,
    explain:`${it.sentence.en} — “${it.m.text}” (${it.use.hint}).`});
}
function errorQ(it,game,prompt){
  if(!it.single)return null;const bad=new Set(hintAnswerSet(it.cat,it.use.hint));it.use.answers.forEach(a=>bad.add(N(a)));
  const cands=shuffle(it.cat==='Prepositions'?['in','on','at','to','from','with','by','for','of','about','into','over']:['and','but','or','so','because','if','unless','while','although','until']).filter(w=>!bad.has(N(w)));
  let wrong=null;for(const c of cands){const f=it.sentence.en.slice(0,it.m.start)+caseLike(it.m.text,c)+it.sentence.en.slice(it.m.end);if(!srcSet.has(N(f))){wrong=caseLike(it.m.text,c);break;}}
  if(!wrong)return null;const wrongSentence=it.sentence.en.slice(0,it.m.start)+wrong+it.sentence.en.slice(it.m.end);
  const right=nm(it.m.text);const opts=uniq([caseLike(it.m.text,right),...fillOptions(it,4).slice(1)]).slice(0,4);
  return Q({id:`g${game}|${it.use.id}|${wrongSentence}`,game,cat:it.cat,topic:itemTopic(it),origin:itemOrigin,prompt,sub:wrongSentence,hint:`Meaning intended: ${it.use.hint}`,options:opts,
    answers:uniq([it.m.text,...it.use.answers,it.sentence.en]),show:it.m.text,explain:`Incorrect: “${wrong}” → correct: “${it.m.text}”. ${it.sentence.en} — ${it.use.hint}.`});
}
function buildQ(it,game,prompt){
  const raw=fixq(it.sentence.en);const toks=raw.replace(/[.?!”"]+$/,'').split(' ');if(toks.length<4||toks.length>11)return null;
  const alts=uniq([it.sentence.en,...ITEMS[it.cat].filter(x=>x!==it&&x.word===it.word&&x.use===it.use).map(x=>x.sentence.en)]).filter(a=>N(a).split(' ').slice().sort().join(' ')===N(it.sentence.en).split(' ').slice().sort().join(' '));
  return Q({id:`g${game}|${it.use.id}|${it.sentence.en}`,game,cat:it.cat,topic:itemTopic(it),origin:itemOrigin,kind:'build',typed:false,prompt,sub:`Hindi: ${it.sentence.hi||it.use.hint}`,hint:`Use “${it.m.text}” — ${it.use.hint}`,
    tokens:shuffle(toks),answers:alts,show:it.sentence.en,explain:`${it.sentence.en} — ${it.use.hint}.`});
}
const OG={};
const per=(cat,cfg,mk,tries)=>{const p=shuffle(itemPool(cat,cfg));const out=[];const seen=new Set();for(const it of p){const q=mk(it);if(q&&!seen.has(q.id)){seen.add(q.id);out.push(q);}if(out.length>=cfg.count)break;}return out;};
/* Specific word quizzes (11, 21, 34) */
function specificWords(cat,game,cfg){
  const ws=wordPool(cat,{wordIds:cfg.wordIds});const out=[];
  for(const w of ws)for(const u of w.uses){
    const its=ITEMS[cat].filter(i=>i.use===u);
    if(its.length){const it=pick(its);out.push(Object.assign(hindiQ(it,game),{id:`g${game}s|${u.id}`,prompt:`Which ${cat==='Prepositions'?'preposition':'conjunction'} fits this use?\n${u.hint}`}));}
    else out.push(Object.assign(useOnly(cat,u,w,game,false),{id:`g${game}s|${u.id}`,options:undefined,kind:'text',typedOnly:true}));
  }
  return shuffle(out);
}
OG.g11=cfg=>specificWords('Prepositions',11,cfg);
OG.g21=cfg=>specificWords('Conjunctions',21,cfg);
OG.g13=cfg=>{
  const orig=per('Prepositions',cfg,it=>fillQ(it,13,'Choose the correct preposition.'));
  const need=Math.max(0,cfg.count-orig.length);
  const sup=(!cfg.wordIds||!cfg.wordIds.length)?shuffle(C.prepFill||[]).slice(0,Math.floor(cfg.count*.25)).map(([s,a,h,w,e])=>Q({id:'g13x|'+s,game:13,cat:'Prepositions',topic:'Collocations',origin:'supplementary',prompt:'Choose the correct preposition.',sub:s,hint:`Hint: ${h}`,options:shuffle([a,...w]),answers:[a],show:a,explain:`${s.replace('___',a)} — ${e}`})):[];
  return shuffle([...orig.slice(0,cfg.count-sup.length),...sup]);
};
OG.g14=cfg=>{const p=shuffle(itemPool('Prepositions',cfg)),seen=new Set(),out=[];for(const it of p){if(seen.has(it.use.id))continue;seen.add(it.use.id);out.push(hindiQ(it,14));if(out.length>=cfg.count)break;}return out;};
OG.g20=cfg=>{const out=[];for(const w of shuffle(wordPool('Prepositions',cfg)))for(const u of w.uses)out.push(Object.assign(useOnly('Prepositions',u,w,20,true),{kind:'text'}));return shuffle(out).slice(0,cfg.count);};
OG.g15=cfg=>{
  const orig=per('Prepositions',cfg,it=>pickQ(it,15,'Select the preposition in this sentence.'));
  const multi=(C.prepMulti||[]).map(([s,ans])=>Q({id:'g15m|'+s,game:15,cat:'Prepositions',topic:'Multiple prepositions',origin:'supplementary',kind:'pick',multi:true,typed:false,prompt:'Select ALL the prepositions in this sentence.',sub:'',tokens:s.replace(/[.?]$/,'').split(' '),answers:ans,show:ans.join(', '),explain:`${s} — prepositions: ${ans.join(', ')}.`}));
  return shuffle([...orig.slice(0,Math.max(1,cfg.count-3)),...shuffle(multi).slice(0,cfg.wordIds&&cfg.wordIds.length?0:3)]);
};
OG.g16=cfg=>{
  const orig=per('Prepositions',cfg,it=>errorQ(it,16,'This sentence uses the wrong preposition. Choose the correct one.'));
  const sup=(!cfg.wordIds||!cfg.wordIds.length)?shuffle(C.prepError||[]).slice(0,Math.floor(cfg.count*.3)).map(([s,bad,good,e])=>Q({id:'g16x|'+s,game:16,cat:'Prepositions',topic:'Collocations',origin:'supplementary',prompt:'This sentence uses the wrong preposition. Choose the correct one.',sub:s,
    options:shuffle(uniq([good,...shuffle(['in','on','at','to','from','with','by','for','of','since'].filter(x=>x!==good&&x!==bad)).slice(0,3)])),answers:[good,s.replace(new RegExp('\\b'+bad+'\\b'),good)],show:good,explain:`Incorrect: “${bad}” → correct: “${good}”. ${e}`})):[];
  return shuffle([...orig.slice(0,cfg.count-sup.length),...sup]);
};
function compareQs(list,cat,game,cfg,pairKey){
  const out=[];for(const p of list)for(const [s,a,h] of p.qs){
    const note=`${p.a} vs ${p.b}\n${p.diff}\n${p.hi}\nExamples: ${p.ex.join(' · ')}`;
    out.push(Q({id:`g${game}|${p.a}|${p.b}|${s}`,game,cat,topic:p.a+' vs '+p.b,origin:'supplementary',prompt:`${p.a} or ${p.b}?`,note,sub:s,hint:`Hint: ${h}`,options:shuffle([cap(p.a).toLowerCase()===p.a.toLowerCase()?p.a.toLowerCase():p.a,p.b.toLowerCase()]),answers:[a],show:a,
      explain:`${a} — ${p.diff}`}));
  }
  return shuffle(out).slice(0,cfg.count);
}
OG.g17=cfg=>compareQs(C.prepCompare||[],'Prepositions',17,cfg);
OG.g27=cfg=>compareQs(C.conjCompare||[],'Conjunctions',27,cfg);
OG.g18=cfg=>per('Prepositions',cfg,it=>buildQ(it,18,'Arrange the words to make a correct sentence.'));
OG.g22=cfg=>per('Conjunctions',cfg,it=>fillQ(it,22,'Choose the correct conjunction.'));
OG.g24=cfg=>{
  const orig=per('Conjunctions',cfg,it=>pickQ(it,24,'Select the conjunction in this sentence.'));
  const multi=[['I stayed home because it was raining and I was tired.',['because','and']],['She studied hard but she did not pass because the paper was difficult.',['but','because']],['He will wait here until you come back or call him.',['until','or']],['Although it was late, we kept working while they rested.',['although','while']]].map(([s,ans])=>Q({id:'g24m|'+s,game:24,cat:'Conjunctions',topic:'Multiple conjunctions',origin:'supplementary',kind:'pick',multi:true,typed:false,prompt:'Select ALL the conjunctions in this sentence.',sub:'',tokens:s.replace(/[.?]$/,'').split(' '),answers:ans,show:ans.join(', '),explain:`${s} — conjunctions: ${ans.join(', ')}.`}));
  return shuffle([...orig.slice(0,Math.max(1,cfg.count-3)),...shuffle(multi).slice(0,cfg.wordIds&&cfg.wordIds.length?0:3)]);
};
OG.g25=cfg=>{const p=shuffle(itemPool('Conjunctions',cfg)),seen=new Set(),out=[];for(const it of p){if(seen.has(it.use.id))continue;seen.add(it.use.id);out.push(hindiQ(it,25));if(out.length>=cfg.count)break;}return out;};
OG.g26=cfg=>{
  const orig=per('Conjunctions',cfg,it=>errorQ(it,26,'The wrong conjunction is used. Choose the correct one.'));
  const sup=(!cfg.wordIds||!cfg.wordIds.length)?shuffle(C.conjError||[]).slice(0,Math.ceil(cfg.count*.5)).map(([s,fix,e,bad])=>Q({id:'g26x|'+s,game:26,cat:'Conjunctions',topic:'Conjunction errors',origin:'supplementary',kind:'text',typedOnly:true,prompt:'Correct this sentence.',sub:s,answers:fix,show:fix[0],explain:`Correct: ${fix[0]} — ${e}`})):[];
  return shuffle([...orig.slice(0,Math.max(1,cfg.count-sup.length)),...sup]);
};
/* join / complete / builders (supplementary) */
const joinForms=(item)=>{const [a,b]=item;return item[3].map(([conj,first,second,pos])=>{const A=first==='a'?item[0]:item[1],Bs=second==='a'?item[0]:item[1];
  return {conj,text:pos==='mid'?`${cap(A)}${/^(so|but|yet|and|or|otherwise)$/.test(conj)?',':''} ${conj} ${lcFirst(Bs)}.`:`${cap(conj)} ${lcFirst(A)}, ${lcFirst(Bs)}.`};});};
OG.g23=cfg=>shuffle(C.conjJoin||[]).slice(0,cfg.count).map(it=>{const f=joinForms(it);
  return Q({id:'g23|'+it[0]+'|'+it[1],game:23,cat:'Conjunctions',topic:uniq(f.map(x=>cap(x.conj))).slice(0,2).join(' / '),origin:'supplementary',kind:'text',typedOnly:true,
    prompt:'Join the two sentences using a suitable conjunction.',sub:`1. ${cap(it[0])}.\n2. ${cap(it[1])}.`,answers:f.map(x=>x.text),show:f.map(x=>x.text).slice(0,3).join('  |  '),explain:`${it[2]} Valid answers: ${f.map(x=>x.text).join(' | ')}`});});
OG.g28=cfg=>shuffle(C.conjComplete||[]).slice(0,cfg.count).map(([s,ok,bad,e])=>Q({id:'g28|'+s,game:28,cat:'Conjunctions',topic:cap(ok[0]),origin:'supplementary',prompt:'Complete the sentence with a suitable conjunction.',sub:s,
  options:shuffle([pick(ok),...shuffle(bad).slice(0,3)]),answers:ok,show:ok.join(' / '),explain:`${s.replace('___',ok[0])} — ${e}${ok.length>1?' Also correct: '+ok.slice(1).join(', ')+'.':''}`}));
OG.g29=cfg=>{
  const list=shuffle(C.conjJoin||[]);const out=[];
  for(const it of list){const f=joinForms(it);const pk=pick(f);const sameConj=f.filter(x=>x.conj===pk.conj);
    const toks=pk.text.replace(/[.?]$/,'').replace(/,/g,'').split(' ');if(toks.length>13)continue;
    out.push(Q({id:'g29|'+pk.text,game:29,cat:'Conjunctions',topic:cap(pk.conj),origin:'supplementary',kind:'build',typed:false,prompt:`Build one sentence with “${pk.conj}”.`,sub:`1. ${cap(it[0])}.\n2. ${cap(it[1])}.`,hint:`Target conjunction: ${pk.conj}`,
      tokens:shuffle(toks),answers:sameConj.map(x=>x.text),show:pk.text,explain:`${pk.text} — ${it[2]}`}));
    if(out.length>=cfg.count)break;}
  return out;
};

/* ===================== Mixed pools ===================== */
const mixOf=(gens,cfg,tag)=>{const per=Math.max(2,Math.ceil(cfg.count/gens.length)+1);let all=[];gens.forEach(g=>{try{all=all.concat(g(Object.assign({},cfg,{count:per})));}catch(e){}});
  return shuffle(all).slice(0,cfg.count);};
const mixTenses=cfg=>mixOf([TG.g1,TG.g2,TG.g3,TG.g4,TG.g5,TG.g6,TG.g8,TG.g9,TG.g10],cfg);
const mixPreps=cfg=>mixOf([OG.g13,OG.g14,OG.g15,OG.g16,OG.g17,OG.g18,OG.g20],cfg);
const mixConjs=cfg=>mixOf([OG.g22,OG.g23,OG.g24,OG.g25,OG.g26,OG.g27,OG.g28,OG.g29],cfg);
const mixVerbs=cfg=>mixOf([VG.g31,VG.g32,VG.g33,VG.g35,VG.g36,VG.g37,VG.g38,VG.g39],cfg);
TG.g7=mixTenses;OG.g19=mixPreps;OG.g30=mixConjs;VG.g34=cfg=>{const ids=cfg.verbIds||[];const ps=[VG.g31,VG.g33,VG.g35,VG.g37,VG.g39];let all=[];ps.forEach(g=>{all=all.concat(g(Object.assign({},cfg,{count:Math.max(3,Math.ceil(cfg.count/ps.length)*2)})));});
  all=all.filter(q=>ids.includes('v-'+q.topic)||true);return shuffle(all).slice(0,cfg.count);};
const MIX={Tenses:mixTenses,Prepositions:mixPreps,Conjunctions:mixConjs,Verbs:mixVerbs};

/* reverse quiz (game 41) */
function reverseQs(cfg){
  const n=cfg.count;const out=[];const cats=cfg.cats&&cfg.cats.length?cfg.cats:['Tenses','Prepositions','Conjunctions','Verbs'];
  const per=Math.ceil(n/cats.length)+1;
  if(cats.includes('Prepositions')){OG.g14({count:per,difficulty:cfg.difficulty}).forEach(q=>out.push(Object.assign(q,{id:'g41|'+q.id,game:41,prompt:'Which preposition matches this meaning?\n'+q.prompt})));}
  if(cats.includes('Conjunctions')){OG.g25({count:per,difficulty:cfg.difficulty}).forEach(q=>out.push(Object.assign(q,{id:'g41|'+q.id,game:41,prompt:'Which conjunction matches this meaning?\n'+q.prompt})));}
  if(cats.includes('Tenses')){shuffle(tensesFor(cfg)).slice(0,per).forEach(t=>{const k=pick(['pos','neg','q']);const lab=k==='pos'?'positive':k==='neg'?'negative':'question';
    out.push(Q({id:`g41|t|${t.id}|${k}`,game:41,cat:'Tenses',topic:t.name,prompt:`Which tense has this ${lab} structure?`,sub:structStr(t[k]),options:tenseOptions(t,T),answers:tnameAns(t),show:t.name,explain:tenseExplain(t)}));});}
  if(cats.includes('Verbs')){shuffle(verbPool(cfg)).slice(0,per).forEach(v=>{const kind=Math.random()<.5;
    out.push(kind?Q({id:'g41|v|'+v.id,game:41,cat:'Verbs',topic:v.label,origin:'supplementary',prompt:'Which verb (V1) has these forms?',sub:`V2: ${vf(v,1)}   V3: ${vf(v,2)}   V4: ${vf(v,3)}   V5: ${vf(v,4)}`,
      options:uniq([vf(v,0),...shuffle(VERBS.filter(x=>x!==v)).slice(0,3).map(x=>vf(x,0))]),answers:v.v1,show:vf(v,0),explain:`${forms5(v)} — ${v.hi}`}):
      Q({id:'g41|vh|'+v.id,game:41,cat:'Verbs',topic:v.label,origin:'supplementary',prompt:`Which English verb (V1) means: ${v.hi}?`,options:uniq([vf(v,0),...shuffle(VERBS.filter(x=>x!==v&&x.head!==v.head)).slice(0,3).map(x=>vf(x,0))]),answers:v.v1,show:vf(v,0),explain:`${forms5(v)}`}));});}
  return shuffle(out).slice(0,n);
}

/* ===================== topics, learn cards ===================== */
const TOPIC_LIST={
  Tenses:()=>T.map(t=>({id:t.id,label:t.name})),
  Prepositions:()=>WORDS('Prepositions').map(w=>({id:w.id,label:w.label})),
  Conjunctions:()=>WORDS('Conjunctions').map(w=>({id:w.id,label:w.label})),
  Verbs:()=>VERBS.map(v=>({id:v.id,label:v.label}))
};
function cfgForTopic(cat,id){return cat==='Tenses'?{tenseIds:[id]}:cat==='Verbs'?{verbIds:[id]}:{wordIds:[id]};}
function topicPool(cat,id,n){
  const cfg=Object.assign({count:n,difficulty:'advanced'},cfgForTopic(cat,id));
  let qs=[];
  if(cat==='Tenses')qs=mixTenses(Object.assign({},cfg,{count:n*2}));
  else if(cat==='Verbs')qs=mixVerbs(Object.assign({},cfg,{count:n*3}));
  else{const w=WORDS(cat).find(x=>x.id===id);const g=cat==='Prepositions'?[OG.g13,OG.g14,OG.g15,OG.g16,OG.g18]:[OG.g22,OG.g25,OG.g24,OG.g26,OG.g29];
    qs=[];g.forEach(f=>{qs=qs.concat(f(Object.assign({},cfg,{count:n})));});if(cat==='Conjunctions')qs=qs.filter(q=>q.topic===w.label||!q.origin||q.origin!=='original');
    qs=qs.filter(q=>q.topic===w.label);
    const base=cat==='Prepositions'?OG.g11(Object.assign({},cfg)):OG.g21(Object.assign({},cfg));qs=qs.concat(base);}
  return uniq(qs.map(q=>q.id)).map(id=>qs.find(q=>q.id===id)).slice(0,n*2);
}
const esch=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function learnCard(cat,id){
  if(cat==='Tenses'){const t=tenseById(id);const s=pick(SUBJ),v=pick(GEN_VERBS);const ex=['pos','neg'].map(p=>conj(t,s,v,p,false).text).concat(conj(t,s,v,'pos',true).text);
    const sits=(C.situations||[]).filter(x=>x[0]===t.name);
    return {title:t.name,origin:'supplementary',html:`<p><b>Use:</b> ${esch(t.use)}.</p><p><b>Positive:</b> ${esch(structStr(t.pos))}<br><b>Negative:</b> ${esch(structStr(t.neg))}<br><b>Question:</b> ${esch(structStr(t.q))}</p><p><b>Examples:</b><br>${ex.map(esch).join('<br>')}</p>${sits.length?'<p><b>Situations:</b><br>'+sits.map(x=>esch(x[1]+' — “'+x[2]+'”')).join('<br>')+'</p>':''}<p class="muted">Tense key from your notes: Verb form needed = ${esch(t.formName)}.</p>`};}
  if(cat==='Verbs'){const v=verbById(id);return {title:forms5(v),origin:'supplementary',html:`<p><b>Meaning:</b> ${esch(v.hi)}</p><p>${FORM_NAMES.map((n,i)=>`<b>${n}:</b> ${esch(v.forms[i].join(' / '))}`).join('<br>')}</p><p>${esch(patternNote(v))}</p><p><b>Example:</b> ${esch(cap(`she ${vf(v,4)} ${v.obj}.`))}</p>`};}
  const w=WORDS(cat).find(x=>x.id===id);
  return {title:w.label,origin:'original',html:w.uses.map((u,i)=>`<p><b>Use ${i+1}:</b> ${esch(u.hint)}<br><span class="muted">Answer: ${esch(u.answers.join(' / '))}</span>${u.sentences.slice(0,3).map(s=>`<br>• ${esch(s.hi?s.hi+' ':'')}${esch(s.en)}`).join('')}</p>`).join('')};
}

/* ===================== answer checking ===================== */
function check(q,resp){
  if(q.kind==='fields'){const res=q.fields.map((f,i)=>f.given?{ok:true}:{ok:sameAns(resp[i]||'',f.answers),given:resp[i]||''});return {ok:res.every(r=>r.ok),fields:res};}
  if(q.kind==='pick'){const sel=(resp||[]).map(i=>N(q.tokens[i]));const ans=q.answers.map(N);const ok=q.multi?(sel.length===ans.length&&ans.every(a=>sel.includes(a))):(sel.length===1&&ans.includes(sel[0]));return {ok};}
  if(q.kind==='build'){return {ok:sameAns(resp,q.answers)};}
  if(q.usage){const v=verbById(q.usage.verb),sc=SCEN[q.usage.sc];const r=usageCheck(resp,v,sc);return {ok:r.ok,msg:r.msg};}
  return {ok:sameAns(resp,q.answers)};
}

/* ===================== game catalogue ===================== */
const D=['beginner','intermediate','advanced'];
const G=[];
const add=(num,cat,title,desc,gen,o)=>G.push(Object.assign({num,cat,title,desc,gen,difficulty:false,count:true,modes:true,words:null,instructions:desc},o||{}));
add(1,'Tenses','12 Tenses Identification','Read a sentence and identify its tense.',TG.g1,{difficulty:true});
add(2,'Tenses','Tense Conversion','Rewrite a sentence in a target tense.',TG.g2,{difficulty:true,target:true});
add(3,'Tenses','Fill in the Correct Verb','Choose the verb form that fits the tense.',TG.g3,{difficulty:true});
add(4,'Tenses','Positive to Negative','Convert positive sentences into negatives.',TG.g4,{difficulty:true});
add(5,'Tenses','Positive to Interrogative','Convert statements into questions.',TG.g5,{difficulty:true});
add(6,'Tenses','Tense Error Correction','Find and fix the tense mistake.',TG.g6,{difficulty:true});
add(7,'Tenses','Mixed Tenses Challenge','All tense question styles mixed together.',TG.g7,{difficulty:true});
add(8,'Tenses','Situation-Based Tenses','Pick the tense that suits a real-life situation.',TG.g8,{difficulty:true});
add(9,'Tenses','Helping Verb Challenge','Choose the correct helping verb.',TG.g9,{difficulty:true});
add(10,'Tenses','Tense Structure Practice','Complete the structure of a tense.',TG.g10,{difficulty:true});
add(11,'Prepositions','Specific Preposition Quiz','Choose prepositions and practise only their uses.',OG.g11,{words:'Prepositions',count:false});
add(12,'Prepositions','Preposition Uses Challenge','Identify what a preposition expresses, or which preposition fits a use.',function(cfg){
  const out=[];const seenIds=new Set();const ws=wordPool('Prepositions',cfg).filter(w=>w.uses.length>=2);
  for(const it of shuffle(ITEMS.Prepositions.filter(i=>ws.includes(i.word)))){
    if(Math.random()<.5){const own=it.word.uses.map(u=>u.hint);if(new Set(own).size<2)continue;const opts=uniq([it.use.hint,...shuffle(own.filter(h=>h!==it.use.hint))]).slice(0,4);if(opts.length<2)continue;
      out.push(Q({id:`g12a|${it.use.id}|${it.sentence.en}`,game:12,cat:'Prepositions',topic:it.word.label,origin:'original',typed:false,prompt:`What does “${it.word.label}” express in this sentence?`,sub:it.sentence.en,options:opts,answers:[it.use.hint],show:it.use.hint,explain:`${it.sentence.en} — ${it.use.hint}.`}));}
    else{const hq=Object.assign(hindiQ(it,12),{id:`g12b|${it.use.id}`,prompt:`Which preposition expresses: ${it.use.hint}`});if(seenIds.has(hq.id))continue;out.push(hq);}
    if(out.length&&seenIds.has(out[out.length-1].id)){out.pop();continue;}if(out.length)seenIds.add(out[out.length-1].id);
    if(out.length>=cfg.count)break;}
  return out;},{words:'Prepositions',count:true,wordOptional:true});
add(13,'Prepositions','Choose the Correct Preposition','Complete sentences with the right preposition.',OG.g13,{});
add(14,'Prepositions','Hindi Meaning to Preposition','Recall the preposition from its Hindi meaning.',OG.g14,{});
add(15,'Prepositions','Preposition Identification','Tap the preposition inside a sentence.',OG.g15,{modes:false});
add(16,'Prepositions','Preposition Error Correction','Spot the wrong preposition and correct it.',OG.g16,{});
add(17,'Prepositions','Similar Preposition Comparison','Learn the difference between confusing prepositions.',OG.g17,{});
add(18,'Prepositions','Preposition Sentence Builder','Arrange words to build a correct sentence.',OG.g18,{modes:false});
add(19,'Prepositions','Mixed Preposition Challenge','Every preposition question style mixed.',OG.g19,{});
add(20,'Prepositions','Preposition Uses Memory Test','Recall the preposition from its meaning — type your answer.',OG.g20,{modes:false});
add(21,'Conjunctions','Specific Conjunction Quiz','Choose conjunctions and practise only their uses.',OG.g21,{words:'Conjunctions',count:false});
add(22,'Conjunctions','Choose the Correct Conjunction','Pick the conjunction that connects the ideas.',OG.g22,{});
add(23,'Conjunctions','Join Two Sentences','Join two sentences with a suitable conjunction.',OG.g23,{modes:false});
add(24,'Conjunctions','Conjunction Identification','Tap the conjunction inside a sentence.',OG.g24,{modes:false});
add(25,'Conjunctions','Hindi Meaning to Conjunction','Recall the conjunction from its Hindi meaning.',OG.g25,{});
add(26,'Conjunctions','Conjunction Error Correction','Fix the wrong conjunction.',OG.g26,{});
add(27,'Conjunctions','Similar Conjunction Comparison','Understand confusing conjunctions.',OG.g27,{});
add(28,'Conjunctions','Complete the Sentence','Complete a sentence with a fitting conjunction.',OG.g28,{});
add(29,'Conjunctions','Conjunction Sentence Builder','Build a sentence with a target conjunction.',OG.g29,{modes:false});
add(30,'Conjunctions','Mixed Conjunction Challenge','Every conjunction question style mixed.',OG.g30,{});
add(31,'Verbs','Four/Five Verb Forms Quiz','Given one form, find another (V1–V5).',VG.g31,{difficulty:true});
add(32,'Verbs','V1 to V5 Challenge','Fill in all the missing forms of a verb.',VG.g32,{difficulty:true,modes:false});
add(33,'Verbs','Hindi to English Verb','Recall the English verb from its Hindi meaning.',VG.g33,{difficulty:true});
add(34,'Verbs','Specific Verb Practice','Choose verbs and practise only those.',VG.g34,{words:'Verbs'});
add(35,'Verbs','Missing Verb Form','Complete a verb-form table.',VG.g35,{difficulty:true});
add(36,'Verbs','Verb Identification','Select the main (or helping) verb.',VG.g36,{difficulty:true,modes:false});
add(37,'Verbs','Regular vs Irregular Verbs','Decide whether a verb is regular or irregular.',VG.g37,{difficulty:true});
add(38,'Verbs','Verb Usage Challenge','Use a verb correctly in a sentence.',VG.g38,{difficulty:true});
add(39,'Verbs','Choose the Correct Verb','Pick the right verb form or agreement.',VG.g39,{difficulty:true});
add(40,'Verbs','Verb Forms Speed Test','60 seconds: type V2 and V3 as fast as you can.',VG.g40,{difficulty:true,count:false,modes:false,timed:60});
add(41,'Combined','Reverse Quiz','From a meaning or structure to the grammar word.',reverseQs,{difficulty:true,catSelect:true});
add(42,'Combined','Random Questions','A random mixed test from the categories you choose.',null,{catSelect:true});
add(43,'Combined','Weak Topics Practice','Practise the topics where you make most mistakes.',null,{special:'weak'});
add(44,'Combined','Learn and Test Mode','Read about a topic, then practise it.',null,{special:'learn'});
add(45,'Combined','Retry Incorrect Questions','Practise the questions you got wrong before.',null,{special:'retry'});
add(46,'Combined','Mastery Challenge','Reach the target accuracy to master a topic.',null,{special:'mastery'});

root.PracticeGen={shuffle,pick,N,check,G,T,VERBS,SUBJ,TG,OG,VG,MIX,WORDS,ITEMS,TOPIC_LIST,topicPool,learnCard,reverseQs,tensesFor,tenseById,conj,conjAnswers,wrongs,verbById,usageCheck,SCEN,FORM_NAMES,cap,uniq,srcSet,LEVELS,mixTenses,cfgForTopic};
if(typeof module!=='undefined')module.exports=root.PracticeGen;
})(typeof window!=='undefined'?window:globalThis);
