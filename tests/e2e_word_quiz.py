"""
End-to-end checks for the Specific Word quiz feature (real browser, real site files).
Run:  pip install playwright && playwright install chromium && python tests/e2e_word_quiz.py
"""
import os, re, sys, json, hashlib, pathlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = (ROOT / 'index.html').as_uri()
results = []
def check(name, cond, detail=''):
    results.append((name, bool(cond), detail))
    print(('PASS' if cond else 'FAIL'), '-', name, ('| ' + str(detail)) if (detail and not cond) else '')

def norm(s): return re.sub(r'\s+', ' ', s.lower().strip().replace('’', "'"))

with sync_playwright() as p:
    b = p.chromium.launch()
    page = b.new_page(viewport={'width': 1280, 'height': 900})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.goto(URL)
    H = 'window.__grammarQuizTestHooks'

    def open_category(cat):
        page.click('.nav-btn[data-view="dashboard"]')
        page.click(f'[data-category="{cat}"]')
    def start_specific(cat, labels):
        open_category(cat)
        page.click('#choice-specific')
        for l in labels:
            page.locator('.word-card', has=page.locator('.word-name', has_text=re.compile(f'^{re.escape(l)}$'))).click()
    def qstate():
        return page.evaluate(f'({H}.state.quiz.map(q=>({{id:q.id,prompt:q.prompt,wordId:q.wordId,wordLabel:q.wordLabel,answers:q.answers}})))')
    def wait_next(n):
        page.wait_for_function(f'document.getElementById("question-number").textContent.startsWith("Question {n} ") || document.getElementById("question-number").textContent==="Session complete"', timeout=6000)

    # ---- 1. Complete Prepositions quiz unchanged ----
    open_category('Prepositions')
    check('Category click shows the two options', page.locator('#choice-view:not(.hidden)').count() == 1 and 'Complete Prepositions quiz' in page.inner_text('#choice-complete-title') and 'Specific preposition quiz' in page.inner_text('#choice-specific-title'))
    page.click('#choice-complete')
    check('Complete Prepositions quiz starts with original label', page.inner_text('#quiz-category-label') == 'Prepositions Quiz started!')
    check('Complete quiz keeps all 156 original questions', page.evaluate(f'{H}.state.quiz.length') == 156)
    check('Complete quiz has no word banner / word-score panel', page.locator('#word-banner.hidden').count() == 1 and page.locator('#word-score-panel.hidden').count() == 1)
    opts = page.locator('#mc-options .option-btn')
    check('Complete quiz shows 4 multiple-choice options', opts.count() == 4)
    ans = page.evaluate(f'{H}.state.quiz[0].answers')
    page.locator('#mc-options .option-btn', has_text=re.compile('^' + re.escape(ans[0]) + '$')).first.click()
    check('Complete quiz scores a correct click immediately', page.inner_text('#score-correct') == '1' and 'Correct' in page.inner_text('#feedback'))

    # ---- 2/3. Selection window + extraction ----
    open_category('Prepositions'); page.click('#choice-specific')
    check('Specific Preposition quiz opens the selection window', page.locator('#wordselect-view:not(.hidden)').count() == 1)
    labels = page.locator('.word-card .word-name').all_inner_texts()
    src = (ROOT / 'content' / 'Prepositions_contents.txt').read_text(encoding='utf-8').lower()
    bank = page.evaluate(f'{H}.bankCats["Prepositions"].words.map(w=>({{label:w.label,variants:w.variants,uses:w.uses.length}}))')
    check('All words come from the source (no invented words)', all(all(v.lower() in src for v in w['variants']) for w in bank))
    check('Selection window lists exactly the extracted prepositions', labels == [w['label'] for w in bank] and len(labels) == 46, len(labels))
    check('Core prepositions present (From, For, By, With, Up to, In / At / On)', all(x in labels for x in ['From', 'For', 'By', 'With', 'Up to', 'In / At / On']))
    check('Source totals: 78 distinct uses (not the 156 duplicated entries)', sum(w['uses'] for w in bank) == 78)
    check('Initial state: 0 selected, Start disabled', page.inner_text('#ws-count') == '0 selected' and page.locator('#ws-start:disabled').count() == 1)
    page.click('#ws-select-all')
    check('Select all selects every card', page.inner_text('#ws-count') == '46 selected')
    page.click('#ws-deselect-all')
    check('Deselect all clears the selection', page.inner_text('#ws-count') == '0 selected')

    # ---- 4/5. FROM only ----
    page.locator('.word-card', has=page.locator('.word-name', has_text=re.compile('^From$'))).click()
    check('Selected count shown', page.inner_text('#ws-count') == '1 selected')
    page.click('#ws-start')
    qs = qstate()
    check('FROM generates exactly 3 questions', len(qs) == 3, len(qs))
    check('FROM questions are the three source uses', sorted(q['prompt'] for q in qs) == sorted(['Q. 1. किसी जगह से (From some place)', 'Q. 2. किसी भविष्य के समय (Future time) से', 'Q. 3. किसी स्रोत से (From any source)']), [q['prompt'] for q in qs])
    check('Only FROM answers', all('From' in q['answers'] and q['wordLabel'] == 'From' for q in qs))
    check('Only one question visible, with its Hindi use shown', page.locator('#question-prompt').count() == 1 and any(q['prompt'] == page.inner_text('#question-prompt') for q in qs))
    check('Banner + word-wise panel visible', page.locator('#word-banner:not(.hidden)').count() == 1 and page.locator('#word-score-panel:not(.hidden)').count() == 1)
    # MC options for single word: correct word present, topped up from same topic, no duplicates
    texts = page.locator('#mc-options .option-btn').all_inner_texts()
    check('MC (single word) includes correct word + unique distractors', 'From' in texts and len(set(texts)) == len(texts) >= 2, texts)

    # ---- typed mode, case/space ----
    page.click('#mode-typed')
    page.fill('#typed-answer', '   FROM  ')
    page.press('#typed-answer', 'Enter')
    check('Typed mode accepts case-insensitive, trimmed answer (Enter submits)', page.inner_text('#score-correct') == '1' and 'Correct' in page.inner_text('#feedback'))
    page.press('#typed-answer', 'Enter')  # disabled; duplicate submit must not add
    check('Duplicate submission prevented', page.inner_text('#score-attempted') == '1')
    wait_next(2)
    page.fill('#typed-answer', 'in'); page.click('#typed-form button[type=submit]')
    check('Wrong typed answer recorded as incorrect + correct answer shown', page.inner_text('#score-wrong') == '1' and 'From' in page.inner_text('#feedback'))
    wait_next(3)
    page.click('#skip-question')
    check('Skip tracked separately', page.inner_text('#score-skipped') == '1')
    page.wait_for_selector('#results:not(.hidden)')
    res = page.inner_text('#results')
    check('Results (word quiz): totals, percentage, overall score', all(t in res for t in ['Total questions', 'Correct', 'Incorrect', 'Skipped', 'Final percentage', 'Overall score', '1 / 3']))
    check('Results: word-wise performance for FROM', 'Word-wise performance' in res and page.locator('.word-table tbody tr').count() == 1 and 'From' in page.inner_text('.word-table tbody'))
    for t in ['Review wrong answers', 'Retry wrong answers', 'Play again', 'Back to home']:
        check(f'Results button: {t}', t in res)
    page.click('#result-review')
    check('Review wrong answers shows the wrong item', page.locator('#result-review-list:not(.hidden) .review-item').count() == 1)
    wrong_id = page.evaluate(f'{H}.state.wrong[0].q.id')
    page.click('#result-retry')
    qs2 = qstate()
    check('Retry wrong answers replays only the wrong question', len(qs2) == 1 and qs2[0]['id'] == wrong_id and page.locator('#word-score-panel:not(.hidden)').count() == 1)
    page.click('#restart-quiz')
    check('Restart/Play again re-creates the full FROM quiz', len(qstate()) == 3)

    # ---- one-use word ----
    start_specific('Prepositions', ['Off'])
    summ = page.inner_text('#ws-summary')
    check('One-use word: exact message shown', 'This word has only one available use. A quiz cannot be started yet.' in summ)
    check('One-use word: Start disabled', page.locator('#ws-start:disabled').count() == 1)
    page.locator('.word-card', has=page.locator('.word-name', has_text=re.compile('^Since$'))).click()
    check('Only ineligible words selected (2): no quiz, explained', 'None of the selected' in page.inner_text('#ws-summary') and page.locator('#ws-start:disabled').count() == 1)

    # ---- mixed selection ----
    page.locator('.word-card', has=page.locator('.word-name', has_text=re.compile('^From$'))).click()
    summ = page.inner_text('#ws-summary')
    check('Mixed selection lists eligible and excluded with reason', 'Will be quizzed (1)' in summ and 'Not included (2)' in summ and 'Off' in summ and 'Since' in summ and 'only one available use' in summ)
    check('Mixed selection: Start enabled', page.locator('#ws-start:disabled').count() == 0)
    page.click('#ws-start')
    qs = qstate()
    check('Mixed: only eligible word quizzed', len(qs) == 3 and all(q['wordLabel'] == 'From' for q in qs))
    check('Mixed: excluded words stated in quiz banner', 'Off' in page.inner_text('#word-banner') and 'Since' in page.inner_text('#word-banner'))

    # ---- multiple words ----
    sel = ['From', 'For', 'By', 'Up to']
    start_specific('Prepositions', sel)
    page.click('#ws-start')
    qs = qstate()
    exp = {'From': 3, 'For': 4, 'By': 4, 'Up to': 6}
    got = {}
    for q in qs: got[q['wordLabel']] = got.get(q['wordLabel'], 0) + 1
    check('Multiple words: every use of every selected word, nothing else', got == exp and len(qs) == 17 and len({q['id'] for q in qs}) == 17, got)
    orders = set()
    for _ in range(4):
        page.click('#restart-quiz'); orders.add(tuple(q['id'] for q in qstate()))
    check('Multiple words: order is randomised', len(orders) > 1)
    page.click('#mode-mc')   # answer mode is remembered across quizzes (typed was used above)
    # MC distractors: only selected words (4 words -> 3 other selected words available)
    bad = []
    for i, q in enumerate(qstate()):
        pass
    sess_ok = page.evaluate(f'''(() => {{ const h={H}; const out=[]; h.state.quiz.forEach(q=>{{ for(let t=0;t<30;t++){{ const o=h.makeWordOptions(q); const sel=h.state.wordSession.words.map(w=>w.label);
        if(!o||!o.includes(q.wordLabel)||new Set(o).size!==o.length||o.some(x=>x!==q.wordLabel&&h.isCorrect(x,q))) out.push(q.id);
        // every distractor must be another SELECTED word here (3 are available)
        if(o&&o.some(x=>!sel.includes(x))) out.push('nonselected:'+q.id); }} }}); return out; }})()''')
    check('Multi MC: correct word always present, no duplicate/overlapping options, distractors = other selected words', sess_ok == [], sess_ok[:5])
    pw = page.inner_text('#word-score-list')
    check('Word-wise live panel lists all four words', all(w in pw for w in sel))
    # play 3 questions through the UI with mixed outcomes and check separate word scores
    for k in range(3):
        q = page.evaluate(f'{H}.state.quiz[{H}.state.index]')
        correct_label = q['wordLabel']
        if k < 2:
            page.locator('#mc-options').get_by_role('button', name=correct_label, exact=True).click()
        else:
            page.locator('#mc-options .option-btn:not(.correct)').filter(has_not_text=correct_label).first.click()
        wait_next(k + 2)
    check('Overall score 2/3 correct tracked', page.inner_text('#score-correct') == '2' and page.inner_text('#score-wrong') == '1')
    rows = page.locator('.word-score-row').all_inner_texts()
    check('Word-wise scores sum to the overall score', sum(int(re.search(r'(\d+) / (\d+)', r.replace('\n', ' ')).group(1)) for r in rows) == 2, rows)

    # ---- Conjunctions / Tenses / modal categories ----
    open_category('Conjunctions'); page.click('#choice-specific')
    check('Conjunctions: selection window with real conjunctions', page.locator('.word-card').count() == 39 and 'And' in page.locator('.word-card .word-name').all_inner_texts())
    # ---- exhaustive data-level checks across every category / every eligible word ----
    report = page.evaluate(f'''(() => {{ const h={H}; const out={{}}; 
      for (const [cat, bank] of Object.entries(h.bankCats)) {{
        const elig = bank.words.filter(h.isEligible); let issues=[]; let n=0;
        for (const w of elig) {{
          h.startWordQuiz({{category:cat,kind:bank.kind,itemLabel:bank.itemLabel,itemLabelPlural:bank.itemLabelPlural,words:[w],excluded:[],bankWords:bank.words}});
          const qs=h.state.quiz; n+=qs.length;
          if (qs.length!==w.uses.length) issues.push('count '+w.label);
          if (new Set(qs.map(q=>q.id)).size!==qs.length) issues.push('dup '+w.label);
          if (qs.some(q=>q.wordId!==w.id)) issues.push('mixed '+w.label);
          for (const q of qs) {{
            if (!q.answers.every(a=>h.isCorrect(a,q))) issues.push('answer rejected '+q.id);
            if (bank.kind==='word') {{
              if(!h.isCorrect(w.label,q)) issues.push('label rejected '+q.id);
              for (let t=0;t<10;t++) {{ const o=h.makeWordOptions(q); if(!o) {{ issues.push('no options '+q.id); break; }} if(!o.includes(w.label)) issues.push('missing correct '+q.id); if (o.filter(x=>h.isCorrect(x,q)).length!==1) issues.push('ambiguous options '+q.id); }}
            }}
          }}
        }}
        out[cat]={{eligible:elig.length,total:bank.words.length,questions:n,issues}};
      }}
      return out; }})()''')
    for cat, r in report.items():
        check(f'[{cat}] all {r["eligible"]} eligible words: correct counts, answers accepted, unambiguous options', not r['issues'], r['issues'][:6])
    # ---- every category card still opens and plays ----
    cats = page.evaluate('Array.from(document.querySelectorAll("#category-grid [data-category]")).map(b=>b.dataset.category)')
    expected_counts = page.evaluate('(() => { const d = window.GRAMMAR_DATA.questions; const o = {}; d.forEach(q => o[q.category] = (o[q.category]||0)+1); return o; })()')
    for cat in cats:
        open_category(cat)
        if page.locator('#choice-view:not(.hidden)').count(): page.click('#choice-complete')
        n = page.evaluate(f'{H}.state.quiz.length')
        check(f'Complete quiz still works: {cat}', n == expected_counts[cat] and page.locator('#quiz-view:not(.hidden)').count() == 1 and page.locator('#word-score-panel.hidden').count() == 1, n)
    for q in ['all-grammar', 'all-verbs']:
        page.click('.nav-btn[data-view="dashboard"]'); page.click(f'[data-quiz="{q}"]')
        check(f'{q} quiz still works', page.evaluate(f'{H}.state.quiz.length') > 0 and page.locator('#word-score-panel.hidden').count() == 1)
    # ---- typed fallback when no suitable option exists ----
    fallback = page.evaluate(f'''(() => {{ const h={H}; const cat='Has / Have / Had To Have'; const bank=h.bankCats[cat]; const w=bank.words.find(h.isEligible);
      h.startWordQuiz({{category:cat,kind:'word',itemLabel:'form',itemLabelPlural:'forms',words:[w],excluded:[],bankWords:[w]}}); return h.makeWordOptions(h.state.quiz[0]); }})()''')
    check('No suitable distractors -> question falls back to typing (no misleading options)', fallback is None, fallback)
    page.locator('#mode-mc').click()
    check('...and the typed form is shown for that question', page.locator('#typed-form:not(.hidden)').count() == 1 and page.locator('#mc-options.hidden').count() == 1)

    # ---- integrity: original content untouched ----
    check('No JavaScript errors during the whole run', not errors, errors[:3])
    b.close()

failed = [r for r in results if not r[1]]
print(f'\n{len(results)-len(failed)}/{len(results)} checks passed')
sys.exit(1 if failed else 0)
