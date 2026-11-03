"""End-to-end browser test of the 46 practice games (Playwright + Chromium).
Run:  pip install playwright && playwright install chromium && python tests/e2e_practice.py
Every game is opened through the real UI, started, answered (some right, some wrong, MC and typed), skipped to the end and checked for results."""
import pathlib, json, sys
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parent.parent
URL='file://'+str(ROOT/'index.html')
HELPER=r"""
window.__ans=function(correct){
 const S=__practiceTestHooks.S;const q=S.qs[S.i];const body=document.getElementById('pg-body');const PG=PracticeGen;
 const lc=x=>x.toLowerCase().replace(/[’‘]/g,"'").replace(/[.,?!]/g,'');
 if(body.querySelector('.options')){const bs=[...body.querySelectorAll('.option-btn')];let b=bs.find(x=>PG.check(q,x.dataset.a).ok===correct);if(!b)b=bs[0];b.click();return 'mc';}
 if(q.kind==='pick'){const toks=[...body.querySelectorAll('.pg-token')];const ansIdx=toks.map((t,i)=>i).filter(i=>q.answers.map(PG.N).includes(PG.N(q.tokens[i])));
   const wrong=toks.map((t,i)=>i).filter(i=>!ansIdx.includes(i)).slice(0,1);const pick=correct?ansIdx:wrong;
   if(q.multi){pick.forEach(i=>toks[i].click());document.getElementById('pg-chk').click();}else toks[pick[0]].click();return 'pick';}
 if(q.kind==='build'){const words=(correct?q.answers[0]:q.answers[0]).split(' ');const order=correct?words:words.slice().reverse();
   for(const w of order){const pool=[...document.querySelectorAll('#pg-pool .pg-token')];const b=pool.find(x=>lc(x.textContent)===lc(w));if(b)b.click();}
   document.getElementById('pg-chk').click();return 'build';}
 if(q.kind==='fields'){q.fields.forEach((f,i)=>{if(f.given)return;document.querySelector('input[data-i="'+i+'"]').value=correct?f.answers[0]:'zzz';});
   document.querySelector('#pg-form button[type=submit]').click();return 'fields';}
 const inp=document.getElementById('pg-input');inp.value=correct?q.answers[0]:'zzz qqq';document.querySelector('#pg-form button[type=submit]').click();return 'typed';
};
;true
"""
errors=[];results=[];fails=[]
def fail(msg):
    fails.append(msg);print('FAIL',msg)
def run():
    with sync_playwright() as p:
        b=p.chromium.launch();ctx=b.new_context(viewport={'width':1200,'height':900});pg=ctx.new_page()
        pg.on('pageerror',lambda e:errors.append(str(e)));pg.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
        pg.goto(URL);pg.evaluate(HELPER)
        # 1. existing quiz still works (unchanged flow)
        pg.click('[data-quiz="all-grammar"]');pg.wait_for_selector('#quiz-view:not(.hidden)')
        opts=pg.locator('#mc-options .option-btn');assert opts.count()>=2,'existing quiz has no options'
        opts.first.click();pg.wait_for_selector('#feedback:not(.hidden)')
        pg.click('#back-dashboard');pg.click('[data-category="Prepositions"]');pg.wait_for_selector('#choice-view:not(.hidden)')
        pg.click('#choice-back');print('existing quiz + specific-word choice screen: OK')
        # 2. five sections
        pg.click('.nav-btn[data-view="practice"]');pg.wait_for_selector('#practice-view:not(.hidden)')
        assert pg.locator('#practice-view [data-cat]').count()==5,'five sections'
        expect={'Tenses':10,'Prepositions':10,'Conjunctions':10,'Verbs':10,'Combined':6}
        for cat,n in expect.items():
            pg.click('#pg-back') if pg.locator('#pg-back').count() else None
            pg.click(f'#practice-view [data-cat="{cat}"]');cnt=pg.locator('#practice-view [data-game]').count()
            if cnt!=n: fail(f'{cat} section lists {cnt} games, expected {n}')
            pg.click('#pg-back')
        # 3. every regular game
        seed_store(pg)
        for num in range(1,47):
            test_game(pg,num)
        # 4. dashboard cards reach sections
        pg.click('.nav-btn[data-view="dashboard"]');pg.click('[data-pcat="Verbs"]');pg.wait_for_selector('#practice-view [data-game]')
        # 5. responsive overflow checks
        for w,h in [(375,800),(768,900)]:
            pg.set_viewport_size({'width':w,'height':h})
            for step in ['hub','section','setup','session']:
                pg.click('.nav-btn[data-view="practice"]')
                if step!='hub':
                    pg.click('#practice-view [data-cat="Tenses"]')
                if step in('setup','session'):
                    pg.click('#practice-view [data-game="1"]')
                if step=='session':
                    pg.click('#pg-start')
                sw=pg.evaluate('document.documentElement.scrollWidth');
                if sw>w+1: fail(f'horizontal overflow at {w}px on {step}: {sw}')
        pg.set_viewport_size({'width':1200,'height':900})
        # 6. leave and return, restart
        pg.click('.nav-btn[data-view="practice"]');pg.click('#practice-view [data-cat="Tenses"]');pg.click('#practice-view [data-game="1"]');pg.click('#pg-start')
        pg.evaluate('__ans(true)');pg.click('#pg-next');pg.click('#pg-back');pg.click('#pg-back');pg.click('#practice-view [data-game="1"]');pg.click('#pg-start')
        pg.click('#pg-restart');st=pg.evaluate('({i:__practiceTestHooks.S.i,c:__practiceTestHooks.S.correct.length})')
        if st!={'i':0,'c':0}: fail('restart did not reset: '+json.dumps(st))
        b.close()
def seed_store(pg):
    # make Weak / Retry / Mastery testable: a store with weak topics and saved mistakes
    pg.evaluate("""()=>{const s={v:1,stats:{},mistakes:{},mastery:{},best:{}};
      s.stats['Tenses::Present Perfect']={cat:'Tenses',topic:'Present Perfect',attempts:8,correct:2};
      s.stats['Tenses::Past Simple']={cat:'Tenses',topic:'Past Simple',attempts:3,correct:0};
      s.stats['Prepositions::From']={cat:'Prepositions',topic:'From',attempts:6,correct:5};
      const qs=PracticeGen.TG.g1({count:3,difficulty:'advanced'}).concat(PracticeGen.OG.g13({count:2,difficulty:'advanced'}));
      qs.forEach(q=>{s.mistakes[q.id]={q,cat:q.cat,topic:q.topic,count:1}});
      localStorage.setItem('gp_practice_v1',JSON.stringify(s));}""")
    pg.reload();pg.evaluate(HELPER)
def finish_and_check(pg,num,expected_total=None):
    pg.evaluate("""()=>{const H=__practiceTestHooks;let guard=0;while(!H.S.finished&&guard++<2000){const sk=document.getElementById('pg-skip');if(sk&&!document.getElementById('pg-fb').className.includes('good')&&!document.getElementById('pg-fb').className.includes('bad'))sk.click();else{const n=document.getElementById('pg-next');if(n)n.click();else break;}}}""")
    pg.wait_for_selector('#pg-results:not(.hidden)',timeout=5000)
    txt=pg.inner_text('#pg-results')
    for needle in ['Total questions','Correct','Incorrect','Skipped','Final percentage','Time taken','Play again','Back to category','Back to home']:
        if needle not in txt: fail(f'game {num}: results missing "{needle}"')
def test_game(pg,num):
    pg.click('.nav-btn[data-view="practice"]')
    cats={1:'Tenses',11:'Prepositions',21:'Conjunctions',31:'Verbs',41:'Combined'}
    cat=[c for lo,c in sorted(cats.items()) if num>=lo][-1]
    pg.click(f'#practice-view [data-cat="{cat}"]');pg.click(f'#practice-view [data-game="{num}"]')
    special=num in(43,44,45,46)
    if num==43:
        pg.click('#pg-start')
    elif num==44:
        pg.select_option('#pg-ltopic',index=1);pg.wait_for_selector('#pg-lstart');pg.click('#pg-lstart')
    elif num==45:
        pg.click('[data-r="all"]')
    elif num==46:
        pg.select_option('#pg-mtopic',index=0);pg.click('#pg-start')
    else:
        if pg.locator('.word-card input').count() and num not in(42,):
            boxes=pg.locator('.word-card input')
            for i in range(3):boxes.nth(i).check()
        if num==42: pass
        pg.click('#pg-start')
    pg.wait_for_selector('#pg-prompt',timeout=5000)
    S=pg.evaluate('({n:__practiceTestHooks.S.qs.length})')
    if S['n']==0: fail(f'game {num}: no questions');return
    modes=['mc','typed'] if pg.locator('#pg-ty').count() else ['mc']
    expect_c=expect_w=0
    for mi,mode in enumerate(modes):
        if mode=='typed': pg.click('#pg-ty')
        for k in range(4):
            if pg.evaluate('__practiceTestHooks.S.finished'):break
            want=(k%2==0)
            kind=pg.evaluate(f'__ans({str(want).lower()})')
            pg.wait_for_selector('#pg-fb:not(.hidden)') if num!=40 else pg.wait_for_timeout(1200)
            if num!=40:
                ok='good' in pg.get_attribute('#pg-fb','class')
                if want and not ok: fail(f'game {num} ({kind}): correct answer rejected: '+pg.evaluate('JSON.stringify(__practiceTestHooks.S.qs[__practiceTestHooks.S.i]).slice(0,200)'))
                if not want and ok: print(f'  note: game {num} ({kind}) wrong answer accepted (may be coincidence)')
                if ok:expect_c+=1
                else:expect_w+=1
                pg.click('#pg-next')
    if num==40:
        pg.evaluate('__practiceTestHooks.S.deadline=Date.now()+500');pg.wait_for_selector('#pg-results:not(.hidden)',timeout=5000);txt=pg.inner_text('#pg-results')
        if 'Avg response' not in txt: fail('game 40: no response time')
    else:
        finish_and_check(pg,num)
        c=pg.evaluate('__practiceTestHooks.S.correct.length');w=pg.evaluate('__practiceTestHooks.S.wrong.length')
        if (c,w)!=(expect_c,expect_w): fail(f'game {num}: score mismatch {(c,w)} vs {(expect_c,expect_w)}')
        tot=pg.evaluate('(()=>{const S=__practiceTestHooks.S;return S.correct.length+S.wrong.length+S.skipped.length-S.qs.length})()')
        if tot!=0: fail(f'game {num}: answered+skipped != total ({tot})')
    # retry / play again buttons exist and work
    if pg.locator('#pg-retry').count():
        pg.click('#pg-retry');pg.wait_for_selector('#pg-prompt');n2=pg.evaluate('__practiceTestHooks.S.qs.length')
        pg.click('#pg-back')
    else:
        pg.click('#pg-again');pg.wait_for_selector('#pg-prompt') if not special else None
    print(f'game {num}: OK ({S["n"]} questions, modes {modes})')
run()
print('\nJS errors:',errors if errors else 'none')
print('FAILURES:',len(fails))
sys.exit(1 if fails or errors else 0)
