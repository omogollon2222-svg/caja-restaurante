// Conecta las apps con Firebase. Cada restaurante (usuario) solo ve sus datos,
// guardados en restaurantes/{uid}/products, /sales y /days.
(function () {
  "use strict";
  if (!firebase.apps.length) firebase.initializeApp(window.FIREBASE_CONFIG);
  const auth = firebase.auth();
  const fs = firebase.firestore();

  // Funciona sin internet: guarda en el dispositivo y sincroniza al reconectar.
  const ready = fs.enablePersistence({ synchronizeTabs: true }).catch(() => {});

  const firstUser = new Promise(res => {
    const off = auth.onAuthStateChanged(u => { off(); res(u); });
  });

  function scoped(uid) {
    const root = fs.collection("restaurantes").doc(uid);
    return {
      doc(path) { const [c, id] = String(path).split("/"); return root.collection(c).doc(id); },
      collection(name) { return root.collection(name); }
    };
  }

  // true si restaurantes/{uid}.vence es una fecha futura.
  async function activa(uid) {
    try {
      const snap = await fs.collection("restaurantes").doc(uid).get();
      const v = snap.exists ? snap.data().vence : null;
      const fecha = v && v.toDate ? v.toDate() : null;
      return !!fecha && fecha > new Date();
    } catch (e) {
      return false;
    }
  }

  const downloads = {
    save({ filename, data }) {
      const blob = new Blob([data], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 3000);
      return Promise.resolve();
    }
  };

  window.App = {
    auth, fs, ready, firstUser, scoped,
    async use(name) {
      if (name === "downloads") return downloads;
      if (name === "db") {
        await ready;
        const u = await firstUser;
        if (!u) { (window.top || window).location.href = "index.html"; return new Promise(() => {}); }
        // Sin suscripción vigente no se abre la app (las reglas de Firestore también lo bloquean).
        if (!(await activa(u.uid))) { (window.top || window).location.href = "index.html"; return new Promise(() => {}); }
        return scoped(u.uid);
      }
      return null;
    }
  };

  if (window.self !== window.top) document.documentElement.classList.add("embedded");
})();
