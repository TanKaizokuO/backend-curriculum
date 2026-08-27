const API = "http://127.0.0.2:8040";
const out = document.getElementById("output");

document.getElementById("inline-status").textContent = window.__inlineRan ? "yes" : "no";

function show(label, value) {
  out.textContent = `${label}\n${JSON.stringify(value, null, 2)}`;
}

document.getElementById("load").addEventListener("click", async () => {
  try {
    const res = await fetch(`${API}/bookmarks`);
    show("GET /bookmarks ->", await res.json());
  } catch (err) {
    show("GET /bookmarks -> fetch() rejected:", String(err));
  }
});

document.getElementById("login").addEventListener("click", async () => {
  try {
    const res = await fetch(`${API}/login`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    show("POST /login ->", await res.json());
  } catch (err) {
    show("POST /login -> fetch() rejected:", String(err));
  }
});

document.getElementById("whoami").addEventListener("click", async () => {
  try {
    const res = await fetch(`${API}/whoami`, { credentials: "include" });
    show("GET /whoami ->", await res.json());
  } catch (err) {
    show("GET /whoami -> fetch() rejected:", String(err));
  }
});
