# Added quiz integration notes

- `Prepositions` is generated from `content/Prepositions_contents.txt`, pairing each numbered `Q.` heading with its source `Example List` and `Ans.` line. Its source ends with the instruction to begin immediately and ask one randomly selected example.
- `Conjunctions` is generated from `content/Conjuction_Content.txt` using the same source block structure. The source does not contain a separate final quiz instruction block; therefore, the quiz follows the existing project quiz interaction model while using only the file's examples and answer lines.
- Both question banks are stored in `src/data.js` and use the shared quiz engine in `src/app.js`.
