# Practice games — content origin & design notes

## Original vs supplementary content
Every question carries an `origin` label that is also shown under the question:
- **original** — built from your notes: all Prepositions/Conjunctions meanings, Hindi clues and example sentences (`src/practice-bank.js`, generated from `content/`). Accepted answers are the `Ans.` lists of your files.
- **supplementary** — written for this project (`src/practice-content.js`): 89-verb table (V1–V5, Hindi meaning, regular/irregular) — your files contain no verb inventory; 36 tense situations; 8 multi-verb sentences; 12 + 10 extra preposition fill-in / error items; 5 multi-preposition sentences; 8 similar-preposition and 6 similar-conjunction comparisons; 28 sentence-joining items; 20 conjunction-completion items; 14 conjunction-error items; 12 tense-structure tables (12 tenses × positive/negative/question).
- **generated** — tense sentences built by grammar rules (conjugation engine in `practice-gen.js`) from the verb table; wrong options and error sentences are produced the same way and are checked never to equal an accepted answer.

## Behaviour decisions to know about
- Difficulty: Tenses — Beginner = 3 simple tenses, Intermediate = + continuous, Advanced = all 12. Verbs — by regularity/irregularity pattern. Prepositions/Conjunctions have no difficulty switch (their level would only be word frequency, not grammar knowledge).
- Typed answers ignore case, extra spaces, final punctuation and contractions (don't = do not). Tense names accept alternatives (Simple Past = Past Simple).
- Game 38 (verb usage) is checked by simple rules (right form, helping verb, agreement) — it is not a full grammar parser.
- Weak topic = at least 5 attempts and accuracy below 70%. Mastery = 2 consecutive tests of ≥20 questions at/above the target (80/90/95%).
- Retry list stores each wrong question once; it is removed when answered correctly in Retry or Weak-topics games.
- Auto-advance is **not** used in the new games (explanations need reading time); use *Next question*. The existing quizzes keep their auto-advance.
