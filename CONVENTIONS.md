# Conventions — backend lessons

## HTML must be dark mode

Every HTML file in this directory ships a dark theme. Dark background, light
foreground, no white flash before styles load. Do not emit light-mode-only
markup and do not fall back to the browser default.

## Prose must follow ASD-STE100 Simplified Technical English

Write every lesson, reference card, glossary entry, and summary in Simplified
Technical English (ASD-STE100). This applies to all new lessons from Lesson 6
onward and to every edit of an older lesson. It applies to the prose. It does
not apply to code, SQL, terminal output, or quoted text from a specification.

The rules to keep:

1. **One meaning for each word.** Use a technical word in one sense only. Do
   not use "call" for a function call and also for a decision.
2. **One part of speech for each word.** Do not use a noun as a verb. Write
   "make a request", not "request the page". Write "start the server", not
   "boot it".
3. **Short sentences.** A maximum of 20 words for a procedural sentence and 25
   words for a descriptive sentence. One instruction in each sentence.
4. **Active voice.** Write "the database rejects the row", not "the row is
   rejected". Passive voice is permitted only when the agent is unknown or
   irrelevant.
5. **Simple present or simple past tense.** No perfect tenses ("has now
   parsed"), no future ("will have made"). Write "you parse", "you parsed".
6. **No -ing verb forms as the main construction.** Replace "Parsing the line
   gives you three parts" with "Parse the line. You get three parts."
7. **Approved vocabulary.** Prefer the short common word: "use" not "utilise",
   "start" not "commence", "before" not "prior to", "about" not "regarding".
   Technical names (`LEFT JOIN`, ASGI, idempotence) are Technical Names and are
   always permitted.
8. **No noun clusters longer than three words.** Break "database connection
   pool startup hook" into "the startup hook for the connection pool".
9. **No omitted articles.** Write "the socket", not "socket".
10. **Warnings and cautions come first.** Put the warning before the
    instruction that causes the risk, and start it with a command.
11. **Lists over long paragraphs.** A procedure is a numbered list. A paragraph
    holds a maximum of six sentences.
12. **No slang, no idiom, no metaphor that a non-native reader must decode.**
    "Under the hood", "out of the box", and "bites you later" are not
    permitted. State the mechanism instead.

Keep the teaching voice. STE controls the sentence, not the content: keep the
observable failures, the "one idea" openings, and the direct address to the
learner.
