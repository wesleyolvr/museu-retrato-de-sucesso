/* Caminhada pelo museu. A câmera é fixa e o mundo anda em Z.
   Comprimentos em svh de rolagem: valor maior = trecho mais longo e mais lento.
   OBRAS_POR_SALAO é o máximo de obras de cada salão nesta caminhada
   (as primeiras de obras.json, na ordem do arquivo). A galeria plana mostra todas. */
(() => {
  "use strict";

  const WALK_LEN = 110;
  const TURN_LEN = 70;
  const DWELL_LEN = 80;
  const TURN_ANGLE = 88;
  const FINAL_WALK = 150;
  const FINAL_HOLD = 60;
  const OBRAS_POR_SALAO = 3;

  const FINALE = { imagem: "img/finale", w: 636, h: 800 };
  const ROMANOS = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

  const $ = (s, r = document) => r.querySelector(s);
  const finePointer = matchMedia("(pointer: fine)").matches;
  const tipoNav = performance.getEntriesByType("navigation")[0]?.type;
  const restaurar = tipoNav === "back_forward";

  const ease = {
    lin: (x) => x,
    io: (x) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2),
    sine: (x) => -(Math.cos(Math.PI * x) - 1) / 2,
  };

  let lenis = null;
  let st = null;
  let tween = null;
  let G = null;
  let items = [];
  let stops = [];
  let path = [];
  let U = 0;
  let saloes = [];
  let curLabel = "";
  let painelAberto = false;

  function romano(n) {
    return ROMANOS[n] || String(n);
  }

  function agrupar(obras) {
    const porNome = new Map();
    obras.forEach((obra) => {
      if (!obra || !obra.sala || !obra.imagem) return;
      const lista = porNome.get(obra.sala) || [];
      if (lista.length < OBRAS_POR_SALAO) lista.push(obra);
      porNome.set(obra.sala, lista);
    });

    const vistos = new Set();
    const lista = [];
    document.querySelectorAll(".sala").forEach((secao) => {
      const nome = secao.dataset.sala;
      if (!nome) return;
      vistos.add(nome);
      const works = porNome.get(nome);
      if (!works || !works.length) return;
      const texto = secao.querySelector(".sala-cabeca p:last-child");
      lista.push({
        id: secao.id,
        name: nome,
        text: texto ? texto.textContent.trim() : "",
        works,
      });
    });

    porNome.forEach((works, nome) => {
      if (vistos.has(nome) || !works.length) return;
      lista.push({ id: "", name: nome, text: "", works });
    });
    return lista;
  }

  function medir(src) {
    return new Promise((resolve) => {
      const img = new Image();
      const fim = () => resolve({ w: img.naturalWidth || 4, h: img.naturalHeight || 5 });
      img.onload = fim;
      img.onerror = () => resolve({ w: 4, h: 5 });
      img.src = src;
    });
  }

  async function medirObras() {
    const tarefas = [];
    saloes.forEach((salao) => {
      salao.works.forEach((obra) => {
        tarefas.push(
          medir(`${obra.imagem}.webp`).then((d) => {
            obra.w = d.w;
            obra.h = d.h;
          })
        );
      });
    });
    tarefas.push(
      medir(`${FINALE.imagem}.webp`).then((d) => {
        if (d.w > 4) {
          FINALE.w = d.w;
          FINALE.h = d.h;
        }
      })
    );
    await Promise.all(tarefas);
  }

  function criarFigura(obra) {
    const picture = document.createElement("picture");
    const source = document.createElement("source");
    source.type = "image/webp";
    source.srcset = `${obra.imagem}.webp`;
    const img = document.createElement("img");
    img.src = `${obra.imagem}.jpg`;
    img.alt = "";
    img.decoding = "async";
    if (obra.w) img.width = obra.w;
    if (obra.h) img.height = obra.h;
    picture.append(source, img);
    return picture;
  }

  function criarPlaca(obra) {
    const placa = document.createElement("span");
    placa.className = "plaque-w";
    const titulo = document.createElement("em");
    titulo.textContent = obra.nome;
    placa.append(titulo);
    const ensaio = String(obra.tipo || "").replace(/^ensaio\s+/i, "");
    const ensaioValor = ensaio ? ensaio.charAt(0).toUpperCase() + ensaio.slice(1) : obra.tipo;
    [
      ["Ensaio", ensaioValor],
      ["Ano", String(obra.ano)],
      ["Técnica", "Fotografia fine art"],
    ].forEach(([rotulo, valor]) => {
      const linha = document.createElement("span");
      linha.className = "pl-row";
      const pequeno = document.createElement("small");
      pequeno.textContent = rotulo;
      linha.append(pequeno, document.createTextNode(valor || ""));
      placa.append(linha);
    });
    return placa;
  }

  function criarMoldura(obra, opts = {}) {
    const link = Boolean(obra.id);
    const el = document.createElement(link ? "a" : "div");
    el.className = "frame" + (opts.side ? ` side-${opts.side}` : "");
    if (link) {
      el.href = `obra.html?id=${encodeURIComponent(obra.id)}`;
      el.tabIndex = -1;
      el.setAttribute(
        "aria-label",
        `Abrir o retrato de ${obra.nome}, salão ${obra.sala}`
      );
      el.addEventListener("click", (evento) => {
        if (!el.classList.contains("focus")) evento.preventDefault();
      });
    } else {
      el.setAttribute("aria-hidden", "true");
    }

    if (opts.light) {
      const pool = document.createElement("span");
      pool.className = "pool";
      pool.setAttribute("aria-hidden", "true");
      const cone = document.createElement("span");
      cone.className = "cone";
      cone.setAttribute("aria-hidden", "true");
      const fixture = document.createElement("i");
      fixture.className = "fixture";
      cone.append(fixture);
      el.append(pool, cone);
    }

    const gold = document.createElement("span");
    gold.className = "gold";
    const slip = document.createElement("span");
    slip.className = "slip";
    slip.append(criarFigura(obra));
    gold.append(slip);
    el.append(gold);
    if (opts.plaque !== false && obra.nome) el.append(criarPlaca(obra));
    return el;
  }

  function place(el, { x = 0, y = 0, z = 0, ry = 0, rx = 0, w, h }) {
    if (w != null) el.style.width = `${w}px`;
    if (h != null) el.style.height = `${h}px`;
    el.style.transform = `translate3d(${x}px,${y}px,${z}px) rotateY(${ry}deg) rotateX(${rx}deg) translate(-50%,-50%)`;
    return el;
  }

  function add(cls, opts, near, extra = {}) {
    const el = document.createElement("div");
    el.className = cls;
    if (!extra.rotulo) el.setAttribute("aria-hidden", "true");
    place(el, opts);
    world.appendChild(el);
    items.push({ el, near, ...extra });
    return el;
  }

  function geometry(nSaloes) {
    const vw = innerWidth;
    const vh = innerHeight;
    const portrait = vh > vw * 1.15;
    const p = portrait ? Math.round(vh * 0.78) : Math.round(Math.max(vw * 0.62, vh * 0.95));
    const W = portrait ? Math.round(p * 1.45) : Math.round(vw * 1.2);
    const H = portrait ? Math.round(p * 1.75) : Math.round(W * 0.66);
    const E = Math.round(H * (portrait ? 0.38 : 0.4));
    const S = portrait ? 2100 : 2600;
    const lead = portrait ? 1000 : 1300;
    const tail = portrait ? 700 : 900;
    const seg = portrait ? 380 : 450;
    const zStart = p;
    const zEnd = -(lead + nSaloes * S + tail);
    const dEnd = Math.round((p * W) / (vw * (portrait ? 0.98 : 0.86)));
    return { vw, vh, portrait, p, W, H, E, S, lead, tail, seg, zStart, zEnd, dEnd };
  }

  function pontos(n) {
    if (n <= 1) return [0.5];
    const inicio = 0.22;
    const fim = 0.78;
    return Array.from({ length: n }, (_, i) => inicio + ((fim - inicio) * i) / (n - 1));
  }

  function preencherCartaz(el, blocos) {
    blocos.forEach((bloco) => {
      const no = document.createElement(bloco.tag);
      if (bloco.cls) no.className = bloco.cls;
      if (bloco.html) no.innerHTML = bloco.html;
      else no.textContent = bloco.text || "";
      el.append(no);
    });
  }

  const stage = $("#stage");
  const world = $("#world");

  function build() {
    world.textContent = "";
    items = [];
    stops = [];
    G = geometry(saloes.length);
    const { p, W, H, E, S, lead, seg, zStart, zEnd } = G;
    stage.style.setProperty("--p", `${p}px`);
    world.style.setProperty("--u", `${(H / 1000).toFixed(4)}px`);
    const wallCY = E - H / 2;

    for (let z = zStart; z > zEnd; z -= seg) {
      const len = Math.min(seg, z - zEnd);
      const zc = z - len / 2;
      const ov = 2;
      add("wall left", { x: -W / 2, y: wallCY, z: zc, ry: 90, w: len + ov, h: H }, z).style.backgroundPosition =
        `${-(zStart - z)}px 0`;
      add("wall right", { x: W / 2, y: wallCY, z: zc, ry: -90, w: len + ov, h: H }, z).style.backgroundPosition =
        `${zStart - z}px 0`;
      add("floor", { x: 0, y: E, z: zc, rx: 90, w: W, h: len + ov }, z).style.backgroundPosition =
        `0 ${-(zStart - z)}px, 0 ${-(zStart - z)}px`;
      add("ceiling", { x: 0, y: E - H, z: zc, rx: -90, w: W, h: len + ov }, z).style.backgroundPosition =
        `0 0, 0 0, 0 0, 0 ${zStart - z}px, 0 0`;
    }

    const end = add("endwall", { x: 0, y: wallCY, z: zEnd, w: W, h: H }, zEnd, { finale: true, rotulo: true });
    const k = G.dEnd / p;
    end.style.paddingTop = `${H * 0.15}px`;
    const efH = H * 0.44;
    const efW = (efH * FINALE.w) / FINALE.h;
    const ef = criarMoldura(FINALE, { plaque: false });
    ef.classList.add("grand");
    ef.style.width = `${efW}px`;
    ef.style.height = `${efH}px`;
    const fin = document.createElement("div");
    fin.className = "finale-light";
    fin.setAttribute("aria-hidden", "true");
    const cone = document.createElement("i");
    cone.className = "f-cone";
    const pool = document.createElement("i");
    pool.className = "f-pool";
    fin.append(cone, pool);
    for (let i = 0; i < 14; i += 1) {
      const poeira = document.createElement("i");
      poeira.className = "dust";
      poeira.style.left = `${(30 + Math.random() * 40).toFixed(1)}%`;
      poeira.style.top = `${(8 + Math.random() * 60).toFixed(1)}%`;
      poeira.style.animationDelay = `${(-Math.random() * 9).toFixed(2)}s`;
      poeira.style.animationDuration = `${(7 + Math.random() * 6).toFixed(1)}s`;
      fin.append(poeira);
    }
    end.append(fin, ef);

    const kick = document.createElement("p");
    kick.className = "end-kicker";
    kick.textContent = "Obra principal do acervo";
    kick.style.fontSize = `${11 * k}px`;
    kick.style.marginTop = `${H * 0.05}px`;
    const h3 = document.createElement("h3");
    h3.textContent = "Seu retrato pode estar aqui.";
    h3.style.fontSize = `${30 * k}px`;
    const cta = document.createElement("a");
    cta.className = "btn-cta";
    cta.href = "#contato";
    cta.dataset.whatsapp = "";
    cta.textContent = "Quero meu retrato";
    cta.style.fontSize = `${17 * k}px`;
    cta.style.marginTop = `${14 * k}px`;
    cta.tabIndex = -1;
    end.append(kick, h3, cta);
    if (window.prepararWhatsapp) window.prepararWhatsapp();

    const zTitle = -lead * 0.55;
    const card = add(
      "title-card",
      { x: -W / 2 + 6, y: E - H * 0.55, z: zTitle, ry: 90, w: H * 0.46, h: H * 0.56 },
      zTitle + H * 0.21,
      { rotulo: true }
    );
    preencherCartaz(card, [
      { tag: "small", text: "Exposição permanente" },
      { tag: "strong", html: "Retrato<br>de Sucesso" },
      { tag: "span", cls: "rule" },
      { tag: "em", text: "cada retrato, uma obra" },
      { tag: "p", cls: "saloes-lista", text: saloes.map((s) => s.name).join(" · ") },
    ]);

    const info = add(
      "info-card",
      { x: W / 2 - 6, y: E - H * 0.52, z: zTitle, ry: -90, w: H * 0.4, h: H * 0.5 },
      zTitle + H * 0.15,
      { rotulo: true }
    );
    preencherCartaz(info, [
      { tag: "small", text: "Bem-vindo" },
      {
        tag: "p",
        text: "Role para caminhar pelos salões. Toque em uma obra, de frente, para vê-la de perto.",
      },
      {
        tag: "p",
        cls: "nota-acervo",
        text: "Acervo de demonstração. Nomes, anos e histórias são fictícios. As imagens são pinturas de domínio público e não retratam clientes do ateliê.",
      },
    ]);
    const fH = H * 0.36;
    const frameY = E - H * 0.56;
    saloes.forEach((salao, si) => {
      const z0 = -(lead + si * S);
      const portal = add("portal", { x: 0, y: wallCY, z: z0, w: W, h: H }, z0, { rotulo: true });
      const side = W * 0.17;
      const top = H * 0.2;
      portal.style.borderWidth = `${top}px ${side}px 0 ${side}px`;
      const lbl = document.createElement("span");
      lbl.className = "portal-label";
      const pequeno = document.createElement("small");
      pequeno.textContent = `Salão ${romano(si + 1)}`;
      lbl.append(pequeno, document.createTextNode(salao.name));
      lbl.style.fontSize = `${H * 0.05}px`;
      lbl.style.top = `${-top * 0.8}px`;
      const arch = document.createElement("i");
      arch.className = "arch";
      arch.style.height = `${(W - 2 * side) * 0.22}px`;
      portal.append(lbl, arch);

      const tz = z0 - S * 0.07;
      const tLeft = (1 + si) % 2 === 0;
      const panel = add(
        "cur-panel",
        {
          x: tLeft ? -W / 2 + 6 : W / 2 - 6,
          y: E - H * 0.52,
          z: tz,
          ry: tLeft ? 90 : -90,
          w: H * 0.4,
          h: H * 0.38,
        },
        tz + H * 0.18,
        { rotulo: true }
      );
      preencherCartaz(panel, [
        { tag: "small", text: `Salão ${romano(si + 1)}` },
        { tag: "strong", text: salao.name },
        { tag: "span", cls: "rule" },
        { tag: "p", text: salao.text },
        { tag: "small", text: `${salao.works.length} obras` },
      ]);

      const spots = pontos(salao.works.length);
      salao.works.forEach((obra, wi) => {
        const left = (wi + si) % 2 === 0;
        const z = z0 - S * spots[wi];
        const fw = Math.min((fH * obra.w) / obra.h, H * (G.portrait ? 0.29 : 0.48));
        const fh = (fw * obra.h) / obra.w;
        const el = criarMoldura(obra, { side: left ? "l" : "r", light: true, plaque: true });
        place(el, {
          x: left ? -W / 2 + 4 : W / 2 - 4,
          y: frameY,
          z,
          ry: left ? 90 : -90,
          w: fw,
          h: fh,
        });
        el.style.setProperty("--gap", `${(frameY - fh / 2 - (E - H + H * 0.05)).toFixed(0)}px`);
        world.appendChild(el);
        const it = {
          el,
          near: z - fw / 2 - 20,
          frame: true,
          z,
          side: left ? -1 : 1,
          fw,
          fh,
          fy: frameY,
          salon: si,
          lights: [el.querySelector(".cone"), el.querySelector(".pool")],
        };
        items.push(it);
        stops.push(it);
      });

      const zb = z0 - S * 0.36;
      const bw = W * 0.16;
      const bh = H * 0.07;
      const bd = H * 0.09;
      [-1, 1].forEach((sx) => {
        add("bench-front", { x: sx * W * 0.2, y: E - bh / 2, z: zb + bd / 2, w: bw, h: bh }, zb + bd / 2);
        add("bench-top", { x: sx * W * 0.2, y: E - bh, z: zb, rx: 90, w: bw, h: bd }, zb + bd / 2);
      });

      const rh = H * 0.15;
      const rl = Math.min(seg, 450);
      for (let z = z0 - 120; z > z0 - S + 120; z -= rl) {
        const len = Math.min(rl, z - (z0 - S + 120));
        [-1, 1].forEach((sx) => {
          const r = add(
            "rail",
            { x: sx * W * 0.34, y: E - rh / 2, z: z - len / 2, ry: sx < 0 ? 90 : -90, w: len, h: rh },
            z
          );
          r.innerHTML = `<i class="post" style="left:0"></i><i class="rope" style="left:5px;right:5px"></i><i class="post" style="right:0"></i>`;
        });
      }
    });

    document.documentElement.classList.toggle("is-portrait", G.portrait);
    buildPath();
  }

  function facePose(s) {
    const { p, W, vw, vh, portrait } = G;
    const a = (TURN_ANGLE * Math.PI) / 180;
    let d = portrait
      ? Math.max((p * s.fw) / (vw * 0.78), (p * s.fh) / (vh * 0.5))
      : Math.max((p * s.fh) / (vh * 0.6), (p * s.fw) / (vw * 0.5));
    let dWall = d * Math.sin(a);
    const lim = W * 0.28;
    dWall = Math.max(W / 2 - lim, Math.min(W / 2 + lim, dWall));
    d = dWall / Math.sin(a);
    const yLift = portrait ? s.fy + s.fh * 0.22 : s.fy * 0.55;
    return {
      z: s.z + d * Math.cos(a),
      x: s.side * (W / 2 - dWall),
      y: yLift,
      yaw: s.side * TURN_ANGLE,
      f: 1,
      i: s.idx,
    };
  }

  function buildPath() {
    path = [];
    let u = 0;
    let cur = { z: G.p, x: 0, y: 0, yaw: 0, f: 0, i: 0 };
    const seg = (len, to, e, kind) => {
      path.push({ u0: u, u1: u + len, a: cur, b: to, e, kind });
      u += len;
      cur = to;
    };
    stops.forEach((s, i) => {
      s.idx = i;
      const face = facePose(s);
      seg(WALK_LEN, { z: face.z + G.W * 0.18, x: 0, y: 0, yaw: 0, f: 0, i }, ease.io, "walk");
      seg(TURN_LEN, face, ease.sine, "turn");
      seg(DWELL_LEN, { ...face, z: face.z - 6 }, ease.lin, "dwell");
      seg(TURN_LEN, { z: face.z - G.W * 0.12, x: 0, y: 0, yaw: 0, f: 0, i }, ease.sine, "turn");
    });
    seg(FINAL_WALK, { z: G.zEnd + G.dEnd, x: 0, y: 0, yaw: 0, f: 0, i: stops.length }, ease.io, "walk");
    seg(FINAL_HOLD, { ...cur }, ease.lin, "dwell");
    U = u;
    document.documentElement.style.setProperty("--corridor-h", `${U}svh`);
  }

  function poseAt(u) {
    let k = path.findIndex((s) => u < s.u1);
    if (k < 0) k = path.length - 1;
    const s = path[k];
    const t = s.e(Math.max(0, Math.min(1, (u - s.u0) / (s.u1 - s.u0))));
    const L = (a, b) => a + (b - a) * t;
    return {
      z: L(s.a.z, s.b.z),
      x: L(s.a.x, s.b.x),
      y: L(s.a.y, s.b.y),
      yaw: L(s.a.yaw, s.b.yaw),
      f: L(s.a.f, s.b.f),
      i: s.b.i,
    };
  }

  const hud = $("#hud");
  const hudName = $("#hudName");
  const hudBar = $("#hudBar");
  const hudCount = $("#hudCount");
  const focusV = $("#focusVignette");
  const introInner = $("#intro .intro-inner");

  function render(u) {
    if (!G || !path.length) return;
    const c = poseAt(u);
    const camZ = c.z;
    world.style.transform = `translateZ(${G.p}px) rotateY(${c.yaw.toFixed(3)}deg) translate3d(${(-c.x).toFixed(1)}px,${(-c.y).toFixed(1)}px,${(-camZ).toFixed(1)}px)`;
    const turn = Math.abs(c.yaw) / TURN_ANGLE;
    const margin = turn * G.W * 1.1;
    for (const it of items) {
      const off = camZ - it.near < 8 - margin;
      if (it.off !== off) {
        it.el.classList.toggle("is-off", off);
        it.off = off;
      }
      if (it.frame) {
        const d = camZ - it.z;
        const isNear = d > -900 && d < 2600;
        if (it.isNear !== isNear) {
          it.el.classList.toggle("near", isNear);
          it.isNear = isNear;
        }
        const o = d < 2200 ? 1 : Math.max(0.28, 1 - (d - 2200) / 5000);
        if (Math.abs((it.o ?? -1) - o) > 0.01) {
          it.el.style.opacity = o.toFixed(2);
          it.o = o;
        }
        const base = d > 2800 ? 0.3 : d > 1600 ? 0.3 + (0.35 * (2800 - d)) / 1200 : 0.65;
        const foc = it.idx === c.i ? c.f : 0;
        const l = base + (1 - base) * foc;
        if (Math.abs((it.l ?? -1) - l) > 0.02) {
          it.lights.forEach((e) => {
            if (e) e.style.opacity = l.toFixed(2);
          });
          it.l = l;
        }
        const isFoc = foc > 0.6;
        if (it.isFoc !== isFoc) {
          it.el.classList.toggle("focus", isFoc);
          it.el.tabIndex = isFoc ? 0 : -1;
          it.isFoc = isFoc;
        }
      } else if (it.finale) {
        const lit = camZ - it.near < G.dEnd * 1.35;
        if (it.lit !== lit) {
          it.el.classList.toggle("lit", lit);
          const botao = it.el.querySelector(".btn-cta");
          if (botao) botao.tabIndex = lit ? 0 : -1;
          it.lit = lit;
        }
      }
    }
    focusV.style.opacity = (c.f * 0.9).toFixed(3);
    const s = stops[Math.min(c.i, stops.length - 1)];
    const label = c.i >= stops.length ? "Obra principal" : saloes[s.salon].name;
    if (label !== curLabel) {
      curLabel = label;
      hudName.textContent = label;
    }
    hudCount.textContent =
      c.i >= stops.length ? "Final do percurso" : `Obra ${c.i + 1} de ${stops.length}`;
    hudBar.style.transform = `scaleX(${(u / U).toFixed(3)})`;
    hud.classList.toggle("show", u > 25 && !(G.portrait && c.f > 0.5));
    introInner.style.opacity = Math.max(0, 1 - u / 45).toFixed(3);
  }

  function setupScroll() {
    if (st) st.kill();
    if (tween) tween.kill();
    const proxy = { u: 0 };
    tween = gsap.to(proxy, {
      u: U,
      ease: "none",
      paused: true,
      onUpdate: () => render(proxy.u),
    });
    st = ScrollTrigger.create({
      trigger: "#track",
      start: "top top",
      end: "bottom bottom",
      scrub: finePointer ? true : 0.6,
      animation: tween,
    });
    render(U * st.progress);
  }

  const yOfU = (u) => (st ? st.start + (st.end - st.start) * (u / U) : 0);

  function scrollToY(y, dur = 2.6) {
    if (lenis) lenis.scrollTo(y, { duration: dur });
    else scrollTo({ top: y, behavior: "smooth" });
  }

  function entrar(evento) {
    if (evento) evento.preventDefault();
    fecharPainel();
    if (!path[1]) return;
    scrollToY(yOfU(path[1].u1), 3.2);
  }

  function aoTopo(evento) {
    if (evento) evento.preventDefault();
    fecharPainel();
    scrollToY(0, 2.2);
  }

  function secaoDoId(id) {
    if (!id) return null;
    if (id === "galeria") return $("#galeria");
    const direto = document.getElementById(id);
    if (!direto || !direto.closest("#conteudo")) return null;
    if (direto.matches("#conteudo > *")) return direto;
    const sala = direto.closest(".sala") || direto.closest("#galeria");
    return sala ? $("#galeria") : direto.closest("#conteudo > *");
  }

  async function abrirPainel(id) {
    const alvo = secaoDoId(id);
    if (!alvo) return;
    if (window.garantirGaleriaPlana) await window.garantirGaleriaPlana();
    document.querySelectorAll("#conteudo > *").forEach((el) => {
      el.classList.toggle("painel-alvo", el === alvo);
    });
    document.documentElement.classList.add("painel");
    painelAberto = true;
    if (lenis) lenis.stop();
    const conteudo = $("#conteudo");
    const rodape = $(".rodape");
    if (rodape && rodape.parentElement !== conteudo) conteudo.append(rodape);
    conteudo.scrollTop = 0;
    const foco = document.getElementById(id);
    if (foco && foco !== alvo) {
      const caixa = conteudo.getBoundingClientRect();
      const caixaFoco = foco.getBoundingClientRect();
      conteudo.scrollTop += caixaFoco.top - caixa.top - 72;
    }
    const fechar = $(".fechar-painel");
    if (fechar) fechar.focus();
  }

  function fecharPainel() {
    if (!painelAberto) return;
    document.documentElement.classList.remove("painel");
    painelAberto = false;
    const rodape = $(".rodape");
    if (rodape && rodape.parentElement !== document.body) document.body.append(rodape);
    if (lenis) lenis.start();
  }

  function ligarNavegacao() {
    const entrarBtn = $("#btnEnter");
    if (entrarBtn) entrarBtn.addEventListener("click", entrar);
    const marca = $(".marca a");
    if (marca) {
      marca.addEventListener("click", (evento) => {
        if (!document.documentElement.classList.contains("caminhada")) return;
        aoTopo(evento);
      });
    }
    document.querySelectorAll(".menu a").forEach((link) => {
      link.addEventListener("click", (evento) => {
        if (!document.documentElement.classList.contains("caminhada")) return;
        const href = link.getAttribute("href") || "";
        if (!href.startsWith("#")) return;
        evento.preventDefault();
        const id = href.slice(1);
        if (id === "galeria" || id === "entrada") entrar();
        else abrirPainel(id);
      });
    });
    $("#conteudo").addEventListener("click", (evento) => {
      if (!document.documentElement.classList.contains("caminhada")) return;
      const link = evento.target.closest("a[href^='#']");
      if (!link || !link.closest("#conteudo")) return;
      evento.preventDefault();
      abrirPainel(link.getAttribute("href").slice(1));
    });
    const fechar = $(".fechar-painel");
    if (fechar) fechar.addEventListener("click", fecharPainel);
    addEventListener("keydown", (evento) => {
      if (evento.key === "Escape") fecharPainel();
    });
    const pular = $(".pular");
    if (pular) pular.href = "#btnEnter";
  }

  function aplicarHash() {
    if (restaurar) return;
    const id = location.hash.replace("#", "");
    if (!id || id === "entrada" || id === "galeria" || id === "intro" || id === "btnEnter") {
      scrollTo(0, 0);
      return;
    }
    if (document.getElementById(id)) {
      scrollTo(0, 0);
      abrirPainel(id);
    }
  }

  window.montarCorredor = async function montarCorredor(obras) {
    if (!window.gsap || !window.ScrollTrigger) return false;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
    saloes = agrupar(obras);
    if (!saloes.length || !stage || !world) return false;

    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.config({ ignoreMobileResize: true });
    document.documentElement.classList.add("caminhada");
    await medirObras();
    if (finePointer && window.Lenis) {
      lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9 });
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add((time) => lenis.raf(time * 1000));
      gsap.ticker.lagSmoothing(0);
    }
    build();
    ligarNavegacao();
    document.documentElement.classList.add("pronto");
    if (!restaurar) scrollTo(0, 0);
    setupScroll();
    aplicarHash();

    let lastW = innerWidth;
    let rT;
    addEventListener("resize", () => {
      if (!finePointer && innerWidth === lastW) return;
      clearTimeout(rT);
      rT = setTimeout(() => {
        lastW = innerWidth;
        build();
        ScrollTrigger.refresh();
        setupScroll();
      }, 200);
    });
    let usuarioRolou = false;
    addEventListener(
      "scroll",
      () => {
        usuarioRolou = true;
      },
      { passive: true, once: true }
    );
    addEventListener("load", () => {
      if (!restaurar && !painelAberto && !usuarioRolou) scrollTo(0, 0);
      ScrollTrigger.refresh();
      if (st) render(U * st.progress);
    });

    window.museuCorredor = {
      get U() {
        return U;
      },
      get path() {
        return path;
      },
      yOfU,
    };
    return true;
  };
})();
