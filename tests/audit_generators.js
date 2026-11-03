/* Offline audit of every generator: node tests/audit_generators.js */
global.window={};require('../src/practice-bank.js');require('../src/practice-content.js');const g=require('../src/practice-gen.js');
const {N,check}=g;let problems=0,total=0;const per={};
const counts={};const report=(G,q,msg)=>{problems++;const k='g'+G.num+' '+msg.replace(/[0-9]+/g,'#').slice(0,40);counts[k]=(counts[k]||0)+1;if(problems<40)console.log('PROBLEM g'+G.num,msg,'|',q.prompt&&q.prompt.slice(0,60),'|',(q.sub||'').slice(0,80),'|',JSON.stringify(q.options),'ans',(JSON.stringify(q.answers)||'undefined').slice(0,100));};
for(const G of g.G){
  if(!G.gen)continue;
  for(const diff of ['beginner','intermediate','advanced']){
    const cfg={count:60,difficulty:diff};
    if(G.words==='Verbs')cfg.verbIds=g.VERBS.slice(0,8).map(v=>v.id);else if(G.words)cfg.wordIds=g.WORDS(G.words).slice(0,10).map(w=>w.id);
    const qs=G.gen(cfg);per[G.num]=(per[G.num]||0)+qs.length;
    const ids=new Set();
    for(const q of qs){total++;
      if(ids.has(q.id))report(G,q,'duplicate id');ids.add(q.id);
      if(q.kind!=='fields'&&(!q.answers||!q.answers.length))report(G,q,'no answers');
      if(!q.prompt)report(G,q,'no prompt');
      if(q.kind==='choice'&&q.options){
        const norm=q.options.map(N);if(new Set(norm).size!==norm.length)report(G,q,'duplicate options');
        const m=q.options.filter(o=>q.answers.map(N).includes(N(o)));
        if(m.length!==1)report(G,q,'options matching answer: '+m.length);
        if(q.options.length<2)report(G,q,'too few options');
        const r=check(q,m[0]||'');if(!r.ok)report(G,q,'check rejects own answer');
      }
      if(q.kind==='text'&&!q.usage){if(!check(q,q.answers[0]).ok)report(G,q,'check rejects own answer');}
      if(q.kind==='build'){if(!check(q,q.answers[0]).ok)report(G,q,'build rejects');const lc=x=>x.toLowerCase().replace(/[’‘]/g,"'").replace(/[.,?!]/g,'');const a=q.answers[0].split(' ').map(lc).filter(Boolean).sort().join(' '),b=q.tokens.map(lc).sort().join(' ');if(a!==b)report(G,q,'tokens mismatch '+a+' vs '+b);}
      if(q.kind==='pick'){const sel=(q.multi?q.answers:q.answers.slice(0,1)).map(a=>q.tokens.findIndex(t=>N(t)===N(a)));if(sel.includes(-1))report(G,q,'pick answer missing from tokens');else if(!check(q,sel).ok)report(G,q,'pick rejects');}
      if(q.kind==='fields'){const resp=q.fields.map(f=>f.given?'':f.answers[0]);if(!check(q,resp).ok)report(G,q,'fields rejects');}
      if(q.usage){const v=g.verbById(q.usage.verb);const r=check(q,q.answers[0]);if(!r.ok)report(G,q,'usage rejects its own example: '+r.msg);}
    }
  }
}
console.log(counts);console.log('questions audited:',total,'problems:',problems);
console.log('per game (3 difficulties):',JSON.stringify(per));
process.exit(problems?1:0);
