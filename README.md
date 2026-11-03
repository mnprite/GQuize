# Grammar Practice — English Grammar & Verb Quiz

A responsive, static website built from the supplied grammar files. No backend, account, or external library is required.

## Run locally

**Option 1 — easiest:** double-click `index.html` and open it in a modern browser.

**Option 2 — local web server (recommended):** open a terminal in this folder and run:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000`.

## Included

- Dashboard with topic counts and category-specific quiz launches.
- 192 numbered questions parsed from the supplied Tenses answer key.
- Source-derived Prepositions and Conjunctions quizzes (question headings, accepted answers, and randomly selected original examples).
- Structured answer-key questions for Can, Could/Should, Would, Be To/Have To, and Has/Have/Had To Have.
- All nine supplied grammar/reference text files are preserved under `content/` and included in the in-browser Study Library.
- Random question and multiple-choice option ordering.
- Multiple-choice and typed-answer modes, normalised case/spacing checks, immediate feedback and automatic next question.
- Session score, accuracy, separate correct/wrong answer review lists, independent hide/show controls, restart, and retry-wrong options.
- Searchable prompt/answer bank and responsive layout.
- No progress bar.

## Project layout

- `index.html` — application shell
- `src/styles.css` — responsive styling
- `src/app.js` — navigation, quiz engine, scoring, answer review and search
- `src/data.js` — structured questions plus complete source text used by the Study Library
- `content/` — original supplied source text files

## Content notes and limitations

- Source notes are retained as provided; the website does not silently rewrite their grammar explanations.
- The Tenses quiz contains all 192 numbered answer-key items. The other structured quiz banks are extracted from numbered answer-key sections and explicit Can answer banks.
- Prepositions and Conjunctions each have a category-specific quiz built from their original numbered Q / Example List / Ans blocks. Each question shows its original Q number and heading plus one randomly selected example; accepted answers are taken from the source Ans line. The Prepositions file ends with an explicit “START NOW” instruction; the Conjunction file ends with source examples and answers but does not contain a separate final quiz prompt, so its quiz uses the same existing project quiz flow without inventing extra source rules.
- The source files do not provide a complete lexical verb inventory with individual conjugation tables. The Verb & Structure Bank therefore lists each structured prompt from the answer keys rather than claiming to enumerate every lexical verb mentioned in examples.
- Multi-answer questions accept any answer listed in the source bank. For typed answers, the user enters one accepted answer at a time; multiple-choice questions choose one accepted answer and use other bank answers as distractors.

## Quick verification performed

- `node --check src/app.js`
- `node --check src/data.js`
- Confirmed that all 192 numbered Tenses questions are present exactly once in the structured data.
- Confirmed that source Q / Example List / Ans blocks were extracted for both new quiz categories.
- Confirmed that all nine source files are present in `content/` and embedded for the Study Library.

These are static/syntax and data-integrity checks; a full cross-browser automated UI test suite is not included.

## Preposition and conjunction quiz integration

- **Prepositions:** 156 source-numbered questions and 783 extracted example items.
- **Conjunctions:** 104 source-numbered questions and 312 extracted example items.
- Each quiz shuffles questions and displays one randomly selected example from that question's source examples, followed by “Your answer?”.
- The accepted answers are extracted from the corresponding `Ans. :` line in the original notes.
- The Prepositions source ends with an explicit `START NOW` instruction. The Conjunctions source does **not** end with a separate quiz prompt; it ends with the `By the time / As long as` examples and answers. Its quiz therefore follows the existing project's shared quiz flow, without inventing an extra final prompt.

## Validation status

- `node --check src/app.js` — passed.
- `node --check src/data.js` — passed.
- Data integrity check — passed: 528 total questions, including 156 Prepositions and 104 Conjunctions; every new question has at least one answer and example; all question IDs are unique.
- ZIP archive integrity — checked before delivery.
- A Playwright browser interaction test was attempted, but Chromium navigation was blocked by the execution environment (`ERR_BLOCKED_BY_ADMINISTRATOR`). Therefore, an end-to-end browser interaction test could not be completed here; the local browser steps above can be used to check the website on your computer.

## Specific-word quiz (new)

Every topic that has words with 2+ distinct uses now offers two options when you click it on the dashboard:

- **Complete quiz** — exactly the existing quiz, unchanged.
- **Specific quiz** — pick one or more words (or tenses / verb forms), then practise only their different uses. Each question shows one use (the original Hindi + English description and one source example); the answer is the word that use belongs to.

Rules implemented:

- Words come straight from your source files — nothing is hard-coded.
- A word needs **at least 2 distinct uses**. One-use words stay visible (marked "not available yet"); if you select only those you see "This word has only one available use. A quiz cannot be started yet."; in a mixed selection they are listed as excluded with the reason, and the quiz runs on the eligible words.
- Questions are shuffled, each use appears once per session, and there is one overall score plus a live and final word-wise score.
- Multiple choice (default) and typed mode share the existing scoring, feedback, skip, wrong-answer review and retry flow. Typed answers are case/space-insensitive and only accept alternatives that the source lists (`Ans.` / `Also accepted:`).
- Multiple-choice distractors come from the other selected words first, topped up from the same topic's other words when fewer than three are available. A distractor that could also be a correct answer for that use is never offered; if no suitable option exists, that one question switches to typing.

### Files

- `scripts/build-word-bank.js` — reads `content/` and `src/data.js` and generates `src/word-bank.js`. **Re-run after editing a content file:** `node scripts/build-word-bank.js`
- `src/word-bank.js` — generated word → uses data (do not edit by hand)
- `src/app.js`, `index.html`, `src/styles.css` — extended (choice screen, word selection window, word quiz engine, results)
- `tests/e2e_word_quiz.py` — optional browser test (`pip install playwright && playwright install chromium && python tests/e2e_word_quiz.py`)

### How each topic is turned into "words"

| Topic | Selectable item | Uses |
|---|---|---|
| Prepositions, Conjunctions | the word group from your notes (e.g. From, Over / Above, As … As) | each distinct `Q.` heading in that group |
| Could & Should, Would, Can, Be To / Have To, Has to have | each answer form (e.g. Could be) | each Hindi clue with that answer |
| All Tenses | each tense (Present Simple … Future Perfect Continuous) | its 16 numbered questions |

## Practice games (46 games in 5 sections) — new

Open **Practice games** in the top navigation (or the *Practice games* cards at the bottom of the Dashboard).
Sections: **Tenses** (games 1–10), **Prepositions** (11–20), **Conjunctions** (21–30), **Verbs** (31–40), **Combined** (41–46).
Each game has its own setup screen (difficulty, question count, answer mode, word selection where relevant), one-question-at-a-time play with feedback and a *Next question* button, and a results screen (score, time, category/topic-wise table, play again, retry incorrect, review answers, back to category/home).

### New files
- `src/practice-bank.js` — **generated** from your original notes (`node scripts/build-practice-bank.js`): English example sentences + Hindi meanings for prepositions/conjunctions. Original content only.
- `src/practice-content.js` — **supplementary** content written for this project (see `PRACTICE_NOTES.md`).
- `src/practice-gen.js` — question generators + answer checking (no DOM; testable in Node).
- `src/practice-ui.js` — screens, session engine, progress storage (`localStorage` key `gp_practice_v1`).
- `scripts/build-practice-bank.js`, `tests/audit_generators.js`, `tests/e2e_practice.py`, `PRACTICE_NOTES.md`.

### Modified files
- `index.html` (nav button, dashboard card section, `#practice-view`, 4 script tags), `src/styles.css` (appended `.pg-*` rules at the end; nothing existing was changed). `src/app.js`, `src/data.js`, `src/word-bank.js` and `content/` are untouched.

### Testing
`node tests/audit_generators.js` (data/answer audit) · `python tests/e2e_practice.py` (browser test of all 46 games) · `python tests/e2e_word_quiz.py` (existing quizzes).
