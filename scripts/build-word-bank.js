#!/usr/bin/env node
/*
 * build-word-bank.js
 * ------------------
 * Generates src/word-bank.js: the data model behind the "Specific word" quiz.
 *
 *   node scripts/build-word-bank.js
 *
 * Model (all data-driven, nothing about individual words is hard-coded):
 *   WORD_BANK.categories[<category>] = {
 *     category, kind, itemLabel, itemLabelPlural,
 *     words: [ { id, label, accepted:[...], uses:[ { id, prompt, answers, examples, source } ] } ]
 *   }
 *
 * Where the data comes from
 *   - Prepositions / Conjunctions: parsed directly from content/*.txt.
 *       The source files contain every question twice (study notes + quiz question bank).
 *       Word groups ("From", "For", "By", ...) come from the study-notes headers; the
 *       prompts, examples, answers and "Also accepted" lines come from the question bank.
 *       Each distinct question is therefore counted ONCE.
 *   - Modal / verb files and Tenses: grouped from the structured questions already in
 *       src/data.js (by answer form, or by tense for Tenses).
 *
 * To add a new word later: add it to the source text file (same Q. / Example List / Ans. layout)
 * and re-run this script. The quiz engine itself never needs to change.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, 'content', f), 'utf8').replace(/\r/g, '');

/* ---------- helpers ---------- */
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9\u0900-\u097f]+/g, '-').replace(/^-+|-+$/g, '') || 'x';
const stripHindiBracket = s => s.replace(/\s*\([^)]*[\u0900-\u097f][^)]*\)\s*$/, '').trim();
const splitAnswers = s => s
  .replace(/\s+\([^)]*[\u0900-\u097f][^)]*\)\s*/g, ' ')   // drop "(से)" style Hindi notes
  .replace(/\]$/, '')
  .split(/\s*[\/,]\s*|\s+vs\s+/i)
  .map(x => x.trim()).filter(Boolean);
const uniq = a => [...new Set(a)];

/* Parse "Q. n. heading ... Example List [ ... ] Ans. : ... Also accepted: ..." blocks in [lo,hi). */
function parseBlocks(lines, lo, hi, headerOf) {
  const out = [];
  let header = null;
  for (let i = lo; i < hi; i++) {
    const s = lines[i].trim();
    if (!/^Q\.\s*\d+\./.test(s)) {
      const h = headerOf(lines, i, hi);
      if (h) header = h;
      continue;
    }
    let heading = s, j = i + 1;
    while (j < hi && lines[j].trim() && !lines[j].trim().startsWith('Example List')) { heading += ' ' + lines[j].trim(); j++; }
    while (j < hi && !lines[j].trim().startsWith('Example List') && !lines[j].trim().startsWith('Ans.')) j++;
    const examples = [];
    if (j < hi && lines[j].trim().startsWith('Example List')) {
      j++;
      let para = [];
      for (; j < hi; j++) {
        const t = lines[j].trim();
        if (t === ']' || t.startsWith('Ans.')) break;
        if (!t) { if (para.length) examples.push(para.join(' ')); para = []; } else para.push(t);
      }
      if (para.length) examples.push(para.join(' '));
      if (lines[j] && lines[j].trim() === ']') j++;
    }
    while (j < hi && !lines[j].trim().startsWith('Ans.')) j++;
    const ansLine = j < hi ? lines[j].trim().replace(/^Ans\.\s*:?\s*/, '').replace(/\]\s*$/, '') : '';
    const also = [];
    for (let m = j + 1; m < hi && lines[m].trim().startsWith('Also accepted'); m++) {
      also.push(...splitAnswers(lines[m].trim().replace(/^Also accepted:\s*/, '')));
    }
    out.push({ header, heading: heading.replace(/^Q\.\s*\d+\.\s*/, ''), number: Number((s.match(/^Q\.\s*(\d+)\./) || [])[1]), examples, ansLine, also });
    i = j;
  }
  return out;
}

/* Merge notes-section blocks (headers) with bank-section blocks (clean text), checking they line up. */
function mergeSections(notes, bank, name) {
  if (notes.length !== bank.length) throw new Error(`${name}: notes (${notes.length}) and bank (${bank.length}) differ in length`);
  return notes.map((n, i) => {
    const b = bank[i];
    if (n.number !== b.number) throw new Error(`${name}: question number mismatch at index ${i}`);
    return { ...b, header: n.header };
  });
}

/* ---------- Prepositions ---------- */
function buildPrepositions() {
  const lines = read('Prepositions_contents.txt').split('\n');
  const notesEnd = lines.findIndex(l => l.startsWith('[# Prepositions Quiz Game'));
  const bankStart = lines.findIndex(l => l.startsWith('# QUESTION BANK'));
  const bankEnd = lines.findIndex(l => l.startsWith('# START NOW'));
  // Study-notes headers are short plain lines directly above a "Q. 1." line.
  const headerOf = (ls, i, hi) => {
    const s = ls[i].trim();
    if (!s || s.length > 80 || /^(Example List|\]|Ans\.|Q\.)/.test(s)) return null;
    let j = i + 1; while (j < hi && !ls[j].trim()) j++;
    return j < hi && /^Q\.\s*1\./.test(ls[j].trim()) ? s : null;
  };
  const notes = parseBlocks(lines, 0, notesEnd, headerOf);
  const bank = parseBlocks(lines, bankStart, bankEnd, () => null);
  return mergeSections(notes, bank, 'Prepositions').map(b => ({ ...b, source: 'Prepositions_contents.txt' }));
}

/* ---------- Conjunctions ---------- */
function buildConjunctions() {
  const lines = read('Conjuction_Content.txt').split('\n');
  const firstQ = lines.findIndex(l => /^\s*Q\.\s*1\./.test(l));
  const secondQ = lines.findIndex((l, i) => i > firstQ + 5 && /^\s*Q\.\s*1\. और/.test(l));
  // Study-notes headers look like "> And (और)"; consecutive "> " lines form one header.
  const headerOf = (ls, i) => {
    const s = ls[i].trim();
    if (!s.startsWith('> ') || i === 0) return null;
    let h = s.slice(2).trim();
    let k = i + 1;
    while (k < ls.length && ls[k].trim().startsWith('> ')) { h += ' — ' + ls[k].trim().slice(2).trim(); k++; }
    if (i > 0 && ls[i - 1].trim().startsWith('> ')) return null; // continuation already merged
    return h;
  };
  const notes = parseBlocks(lines, 0, secondQ - 6, headerOf);
  const bank = parseBlocks(lines, secondQ - 6, lines.length, () => null);
  return mergeSections(notes, bank, 'Conjunctions').map(b => ({ ...b, source: 'Conjuction_Content.txt' }));
}

/* Group parsed blocks into words. A group's header is the word; groups whose questions have
 * different single answers (e.g. the “WH word” group) are split by answer instead. */
function blocksToWords(blocks, idPrefix) {
  const groups = new Map();
  blocks.forEach(b => { const k = b.header || '(ungrouped)'; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(b); });
  const words = [];
  for (const [header, qs] of groups) {
    const answerKeys = uniq(qs.map(q => q.ansLine));
    const splitByAnswer = qs.length > 1 && answerKeys.length === qs.length && qs.every(q => splitAnswers(q.ansLine).length === 1);
    const buckets = splitByAnswer ? qs.map(q => [q.ansLine, [q]]) : [[null, qs]];
    for (const [ans, list] of buckets) {
      const accepted = uniq(list.flatMap(q => [...splitAnswers(q.ansLine), ...q.also]));
      const baseAnswers = uniq(list.flatMap(q => splitAnswers(q.ansLine)));
      const label = ans ? stripHindiBracket(ans) : baseAnswers.join(' / ');
      // distinct uses = distinct (heading, number) pairs
      const seen = new Set();
      const uses = [];
      list.forEach(q => {
        const key = q.heading.trim();
        if (seen.has(key)) return;
        seen.add(key);
        uses.push({ id: `${idPrefix}-${slug(label)}-${uses.length + 1}`, prompt: `Q. ${q.number}. ${q.heading}`, answers: uniq([...splitAnswers(q.ansLine), ...q.also]), examples: q.examples, source: q.source });
      });
      words.push({ id: `${idPrefix}-${slug(label)}`, label, group: stripHindiBracket(header), variants: baseAnswers, accepted, uses });
    }
  }
  return words;
}

/* ---------- Other categories: group existing structured questions ---------- */
function loadDataQuestions() {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, 'src', 'data.js'), 'utf8'), sandbox);
  return sandbox.window.GRAMMAR_DATA.questions;
}

function groupByAnswerForm(questions, category, idPrefix) {
  const map = new Map();
  questions.filter(q => q.category === category).forEach(q => {
    const label = q.answers.join(' / ');
    if (!map.has(label)) map.set(label, { id: `${idPrefix}-${slug(label)}`, label, group: category, variants: uniq(q.answers), accepted: uniq(q.answers), uses: [] });
    const w = map.get(label);
    w.uses.push({ id: q.id, prompt: q.prompt, answers: q.answers, examples: q.examples || [], source: q.source });
  });
  return [...map.values()];
}

function groupTenses(questions) {
  const map = new Map();
  const order = ['Present', 'Past', 'Future'];
  questions.filter(q => q.category === 'All Tenses').forEach(q => {
    const seg = q.prompt.split('➔').map(s => s.replace(/\?/g, '').trim());
    const tense = seg[0];
    let kind = (seg[1] || '').toLowerCase();
    if (kind === 'perfect' && /^continuous/i.test(seg[2] || '')) kind = 'perfect continuous';
    const label = `${tense} ${kind}`.replace(/\b\w/g, c => c.toUpperCase());
    if (!map.has(label)) map.set(label, { id: `tense-${slug(label)}`, label, group: 'All Tenses', variants: [], accepted: [], uses: [], tenseOrder: order.indexOf(tense) });
    map.get(label).uses.push({ id: q.id, prompt: q.prompt, answers: q.answers, examples: [], source: q.source });
  });
  return [...map.values()].sort((a, b) => a.tenseOrder - b.tenseOrder || a.label.localeCompare(b.label)).map(({ tenseOrder, ...w }) => w);
}

/* ---------- assemble ---------- */
const dq = loadDataQuestions();
const categories = {
  'Prepositions': { kind: 'word', itemLabel: 'preposition', itemLabelPlural: 'prepositions', words: blocksToWords(buildPrepositions(), 'prep') },
  'Conjunctions': { kind: 'word', itemLabel: 'conjunction', itemLabelPlural: 'conjunctions', words: blocksToWords(buildConjunctions(), 'conj') },
  'All Tenses': { kind: 'filter', itemLabel: 'tense', itemLabelPlural: 'tenses', words: groupTenses(dq) },
  'Could & Should': { kind: 'word', itemLabel: 'form', itemLabelPlural: 'forms', words: groupByAnswerForm(dq, 'Could & Should', 'cs') },
  'Would Forms': { kind: 'word', itemLabel: 'form', itemLabelPlural: 'forms', words: groupByAnswerForm(dq, 'Would Forms', 'would') },
  'Can, Can Be, Can Have & Ability': { kind: 'word', itemLabel: 'form', itemLabelPlural: 'forms', words: groupByAnswerForm(dq, 'Can, Can Be, Can Have & Ability', 'can') },
  'Be To / Have To': { kind: 'word', itemLabel: 'form', itemLabelPlural: 'forms', words: groupByAnswerForm(dq, 'Be To / Have To', 'beto') },
  'Has / Have / Had To Have': { kind: 'word', itemLabel: 'form', itemLabelPlural: 'forms', words: groupByAnswerForm(dq, 'Has / Have / Had To Have', 'hastohave') }
};
Object.entries(categories).forEach(([c, v]) => { v.category = c; });

Object.entries(categories).forEach(([c, v]) => {
  const ids = new Set();
  v.words.forEach(w => { if (ids.has(w.id)) throw new Error(`Duplicate word id in ${c}: ${w.id}`); ids.add(w.id); });
});

const banner = '/* AUTO-GENERATED by scripts/build-word-bank.js — do not edit by hand. Re-run: node scripts/build-word-bank.js */\n';
fs.writeFileSync(path.join(root, 'src', 'word-bank.js'), banner + 'window.WORD_BANK = ' + JSON.stringify({ categories }, null, 1) + ';\n');

/* summary */
for (const [c, v] of Object.entries(categories)) {
  const elig = v.words.filter(w => w.uses.length >= 2).length;
  console.log(`${c.padEnd(34)} ${String(v.words.length).padStart(3)} items, ${String(v.words.reduce((n, w) => n + w.uses.length, 0)).padStart(3)} uses, ${elig} with >=2 uses`);
}
