/* ============================================================
   quiz.js — retrieval-practice components for the Backend workspace.
   Zero dependencies. Include once per lesson:
       <link rel="stylesheet" href="../assets/quiz.css">
       <script src="../assets/quiz.js" defer></script>

   Three widget types, all declarative. Each is a <div> whose config
   lives in a child <script type="application/json">.

   1. MULTIPLE CHOICE — options are shuffled on every load, so position
      is never a cue and re-reviews are not rote.
       <div class="quiz" data-type="mcq">
         <script type="application/json">
         { "q": "...", "options": ["...","..."], "answer": 0,
           "why": "shown after answering" }
         </script>
       </div>

   2. TYPE THE ANSWER — hardest retrieval; no options to recognise.
       <div class="quiz" data-type="type">
         <script type="application/json">
         { "q": "...", "answer": "404", "accept": ["not found"],
           "why": "..." }
         </script>
       </div>

   3. RECALL CARD — self-graded free recall for things too long to type.
       <div class="quiz" data-type="recall">
         <script type="application/json">
         { "q": "...", "answer": "the full model answer", "why": "..." }
         </script>
       </div>

   Add <div class="quiz-score"></div> anywhere to render a live tally.
   Results persist in localStorage per page so a later review session
   shows what was missed last time (spacing signal).
   ============================================================ */

(function () {
  "use strict";

  var PAGE_KEY = "quiz:" + location.pathname.split("/").pop();
  var state = load();
  var widgets = [];

  function load() {
    try { return JSON.parse(localStorage.getItem(PAGE_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function save() {
    try { localStorage.setItem(PAGE_KEY, JSON.stringify(state)); }
    catch (e) { /* private mode — scoring just won't persist */ }
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  /* Fisher-Yates. Returns pairs so we can track the original index. */
  function shuffled(arr) {
    var pairs = arr.map(function (v, i) { return { v: v, i: i }; });
    for (var j = pairs.length - 1; j > 0; j--) {
      var k = Math.floor(Math.random() * (j + 1));
      var t = pairs[j]; pairs[j] = pairs[k]; pairs[k] = t;
    }
    return pairs;
  }

  function normalise(s) {
    return String(s)
      .toLowerCase()
      .trim()
      .replace(/[\s\u00a0]+/g, " ")
      .replace(/[.,;:!?'"`()]/g, "");
  }

  function record(id, correct) {
    state[id] = correct ? "ok" : "miss";
    save();
    renderScores();
  }

  /* ---------- shared chrome ---------- */

  function scaffold(root, cfg, kindLabel) {
    root.classList.add("quiz");
    root.innerHTML = "";

    var head = el("div", "quiz-head");
    head.appendChild(el("span", "quiz-kind", kindLabel));
    if (state[root.dataset.qid] === "miss") {
      head.appendChild(el("span", "quiz-flag", "missed last time"));
    }
    root.appendChild(head);

    var q = el("p", "quiz-q");
    q.innerHTML = cfg.q;               /* allows <code> inside questions */
    root.appendChild(q);

    return root;
  }

  function feedback(root, correct, cfg) {
    var fb = root.querySelector(".quiz-fb");
    if (!fb) { fb = el("div", "quiz-fb"); root.appendChild(fb); }
    fb.className = "quiz-fb " + (correct ? "is-ok" : "is-miss");
    fb.innerHTML =
      '<span class="quiz-verdict">' +
      (correct ? "Correct" : "Not quite") +
      "</span>" +
      (cfg.why ? '<span class="quiz-why">' + cfg.why + "</span>" : "");
  }

  /* ---------- 1. multiple choice ---------- */

  function mcq(root, cfg) {
    scaffold(root, cfg, "recall");
    var list = el("ul", "quiz-opts");
    var done = false;

    shuffled(cfg.options).forEach(function (pair) {
      var li = el("li");
      var btn = el("button", "quiz-opt");
      btn.type = "button";
      btn.innerHTML = pair.v;
      btn.addEventListener("click", function () {
        if (done) return;
        done = true;
        var right = pair.i === cfg.answer;
        list.querySelectorAll(".quiz-opt").forEach(function (b) {
          b.disabled = true;
        });
        btn.classList.add(right ? "is-ok" : "is-miss");
        if (!right) {
          /* reveal the correct one so the loop closes immediately */
          Array.prototype.forEach.call(
            list.querySelectorAll(".quiz-opt"),
            function (b, n) {
              if (b.dataset.orig === String(cfg.answer)) b.classList.add("is-answer");
            }
          );
        }
        feedback(root, right, cfg);
        record(root.dataset.qid, right);
      });
      btn.dataset.orig = pair.i;
      li.appendChild(btn);
      list.appendChild(li);
    });

    root.appendChild(list);
  }

  /* ---------- 2. type the answer ---------- */

  function typed(root, cfg) {
    scaffold(root, cfg, "type it");

    var form = el("form", "quiz-form");
    var input = el("input", "quiz-input");
    input.type = "text";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.placeholder = cfg.placeholder || "your answer";

    var submit = el("button", "quiz-submit", "Check");
    submit.type = "submit";

    form.appendChild(input);
    form.appendChild(submit);

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (input.disabled) return;
      var given = normalise(input.value);
      if (!given) return;
      var pool = [cfg.answer].concat(cfg.accept || []).map(normalise);
      var right = pool.indexOf(given) !== -1;

      input.disabled = true;
      submit.disabled = true;
      input.classList.add(right ? "is-ok" : "is-miss");

      if (!right) {
        var ans = el("p", "quiz-answer");
        ans.innerHTML = "Answer: <code>" + cfg.answer + "</code>";
        root.appendChild(ans);
      }
      feedback(root, right, cfg);
      record(root.dataset.qid, right);
    });

    root.appendChild(form);
  }

  /* ---------- 3. self-graded recall ---------- */

  function recall(root, cfg) {
    scaffold(root, cfg, "free recall");

    var hint = el("p", "quiz-hint", "Say it out loud or write it down first — then reveal.");
    root.appendChild(hint);

    var reveal = el("button", "quiz-submit", "Reveal answer");
    reveal.type = "button";
    root.appendChild(reveal);

    reveal.addEventListener("click", function () {
      reveal.remove();
      hint.remove();

      var ans = el("div", "quiz-model");
      ans.innerHTML = cfg.answer;
      root.appendChild(ans);

      var grade = el("div", "quiz-grade");
      [["I had it", true], ["I missed it", false]].forEach(function (g) {
        var b = el("button", "quiz-opt quiz-grade-btn", g[0]);
        b.type = "button";
        b.addEventListener("click", function () {
          grade.querySelectorAll("button").forEach(function (x) { x.disabled = true; });
          b.classList.add(g[1] ? "is-ok" : "is-miss");
          feedback(root, g[1], cfg);
          record(root.dataset.qid, g[1]);
        });
        grade.appendChild(b);
      });
      root.appendChild(grade);
    });
  }

  /* ---------- score tally ---------- */

  function renderScores() {
    var total = widgets.length;
    var answered = 0, ok = 0;
    widgets.forEach(function (id) {
      if (state[id]) { answered++; if (state[id] === "ok") ok++; }
    });

    document.querySelectorAll(".quiz-score").forEach(function (node) {
      node.innerHTML = "";
      var bar = el("div", "quiz-score-bar");
      widgets.forEach(function (id) {
        var pip = el("span", "quiz-pip " + (state[id] ? "is-" + state[id] : "is-todo"));
        bar.appendChild(pip);
      });
      node.appendChild(bar);

      var label = el("p", "quiz-score-label");
      if (answered < total) {
        label.textContent = answered + " of " + total + " answered";
      } else if (ok === total) {
        label.textContent = "All " + total + " correct — that is retrieval, not recognition. Well done.";
      } else {
        label.textContent =
          ok + " of " + total + " correct. Re-read the section behind each miss, " +
          "then reload this page and run the questions again.";
      }
      node.appendChild(label);

      if (answered) {
        var reset = el("button", "quiz-reset", "Reset answers");
        reset.type = "button";
        reset.addEventListener("click", function () {
          state = {};
          save();
          location.reload();
        });
        node.appendChild(reset);
      }
    });
  }

  /* ---------- boot ---------- */

  function init() {
    var nodes = document.querySelectorAll(".quiz");
    Array.prototype.forEach.call(nodes, function (root, i) {
      var data = root.querySelector('script[type="application/json"]');
      if (!data) return;
      var cfg;
      try { cfg = JSON.parse(data.textContent); }
      catch (e) {
        root.innerHTML = '<p class="quiz-err">Malformed quiz JSON: ' + e.message + "</p>";
        return;
      }
      var id = root.id || "q" + i;
      root.dataset.qid = id;
      widgets.push(id);

      var type = root.dataset.type || "mcq";
      if (type === "type") typed(root, cfg);
      else if (type === "recall") recall(root, cfg);
      else mcq(root, cfg);
    });
    renderScores();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
