/* Número com DDI e DDD, só dígitos. Ex.: 5586999990000.
   Troque este valor quando o contato de verdade for ligado. */
const WHATSAPP_NUMBER = "5500000000000";

const movimento = window.matchMedia("(prefers-reduced-motion: reduce)");

document.addEventListener("DOMContentLoaded", () => {
  prepararMenu();
  prepararWhatsapp();
  const pagina = document.body.dataset.pagina;
  if (pagina === "entrada") iniciarGaleria();
  if (pagina === "obra") iniciarObra();
});

function prepararMenu() {
  const botao = document.querySelector(".menu-botao");
  const menu = document.querySelector(".menu");
  if (!botao || !menu) return;

  const fechar = () => {
    botao.setAttribute("aria-expanded", "false");
    botao.querySelector(".sr").textContent = "Abrir menu";
    menu.classList.remove("aberto");
  };

  botao.addEventListener("click", () => {
    const aberto = botao.getAttribute("aria-expanded") === "true";
    botao.setAttribute("aria-expanded", aberto ? "false" : "true");
    botao.querySelector(".sr").textContent = aberto ? "Abrir menu" : "Fechar menu";
    menu.classList.toggle("aberto", !aberto);
  });

  menu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", fechar);
  });

  document.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape") fechar();
  });
}

function prepararWhatsapp() {
  const numero = String(WHATSAPP_NUMBER).replace(/\D/g, "");
  if (numero.length < 12) return;
  const texto = encodeURIComponent(
    "Olá! Vi o museu Retrato de Sucesso e quero conversar sobre um ensaio."
  );
  document.querySelectorAll("[data-whatsapp]").forEach((link) => {
    link.href = `https://wa.me/${numero}?text=${texto}`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  });
}

async function carregarObras() {
  const resposta = await fetch("obras.json");
  if (!resposta.ok) throw new Error("obras");
  const obras = await resposta.json();
  if (!Array.isArray(obras)) throw new Error("formato");
  return obras;
}

async function iniciarGaleria() {
  const paredes = document.querySelectorAll("[data-parede]");
  let obras;
  try {
    obras = await carregarObras();
  } catch (erro) {
    paredes.forEach((parede) => {
      parede.classList.add("parede-erro");
      parede.textContent =
        "Não foi possível abrir o acervo. Sirva a pasta do site por um servidor local e confira o arquivo obras.json.";
    });
    return;
  }

  const porSala = new Map();
  obras.forEach((obra) => {
    const lista = porSala.get(obra.sala) || [];
    lista.push(obra);
    porSala.set(obra.sala, lista);
  });

  document.querySelectorAll(".sala").forEach((sala) => {
    const parede = sala.querySelector("[data-parede]");
    const lista = porSala.get(sala.dataset.sala) || [];
    parede.replaceChildren();
    if (!lista.length) {
      parede.classList.add("parede-erro");
      parede.textContent = "Este salão ainda não tem obras.";
      return;
    }
    lista.forEach((obra) => parede.append(criarObra(obra)));
  });

  observarRevelacao();
}

function criarObra(obra) {
  const link = document.createElement("a");
  link.className = "obra";
  link.href = `obra.html?id=${encodeURIComponent(obra.id)}`;

  const figura = document.createElement("figure");
  const moldura = document.createElement("div");
  moldura.className = "moldura";
  const passe = document.createElement("div");
  passe.className = "passe";

  const picture = document.createElement("picture");
  const source = document.createElement("source");
  source.type = "image/webp";
  source.srcset = `${obra.imagem}.webp`;
  const img = document.createElement("img");
  img.src = `${obra.imagem}.jpg`;
  img.alt = `Retrato de demonstração de ${obra.nome}. Pintura em domínio público, não é uma cliente real.`;
  img.loading = "lazy";
  img.decoding = "async";
  picture.append(source, img);
  passe.append(picture);
  moldura.append(passe);

  const placa = document.createElement("figcaption");
  placa.className = "placa";

  const numero = document.createElement("p");
  numero.className = "placa-num";
  numero.textContent = `Obra nº ${obra.id}`;

  const nome = document.createElement("p");
  nome.className = "placa-nome";
  nome.textContent = obra.nome;

  const tipo = document.createElement("p");
  tipo.className = "placa-tipo";
  tipo.textContent = `${obra.tipo} · ${obra.ano}`;

  placa.append(numero, nome, tipo);
  figura.append(moldura, placa);
  link.append(figura);
  return link;
}

function observarRevelacao() {
  const obras = document.querySelectorAll(".obra");
  if (movimento.matches || !("IntersectionObserver" in window)) {
    obras.forEach((obra) => obra.classList.add("revelada"));
    return;
  }

  const observador = new IntersectionObserver(
    (entradas) => {
      entradas.forEach((entrada) => {
        if (!entrada.isIntersecting) return;
        entrada.target.classList.add("revelada");
        observador.unobserve(entrada.target);
      });
    },
    { threshold: 0.22, rootMargin: "0px 0px -8% 0px" }
  );

  obras.forEach((obra) => observador.observe(obra));
  window.addEventListener("scroll", agendarParallax, { passive: true });
  window.addEventListener("resize", agendarParallax);
  movimento.addEventListener("change", () => {
    if (!movimento.matches) return;
    obras.forEach((obra) => {
      obra.classList.add("revelada");
      obra.style.removeProperty("--py");
    });
  });
}

let parallaxAgendado = false;

function agendarParallax() {
  if (parallaxAgendado || movimento.matches) return;
  parallaxAgendado = true;
  requestAnimationFrame(() => {
    const meio = window.innerHeight * 0.5;
    document.querySelectorAll(".obra.revelada").forEach((obra) => {
      const caixa = obra.getBoundingClientRect();
      if (caixa.bottom < 0 || caixa.top > window.innerHeight) return;
      const distancia = (caixa.top + caixa.height * 0.4 - meio) / window.innerHeight;
      const deslocamento = Math.max(-14, Math.min(14, distancia * -18));
      obra.style.setProperty("--py", `${deslocamento.toFixed(2)}px`);
    });
    parallaxAgendado = false;
  });
}

async function iniciarObra() {
  const ficha = document.querySelector("[data-ficha]");
  if (!ficha) return;
  const parametros = new URLSearchParams(window.location.search);
  const id = parametros.get("id");

  let obras;
  try {
    obras = await carregarObras();
  } catch (erro) {
    ficha.innerHTML = "";
    const aviso = document.createElement("p");
    aviso.textContent =
      "Não foi possível abrir o acervo. Use um servidor local e confira o arquivo obras.json.";
    ficha.append(aviso);
    return;
  }

  const obra = obras.find((item) => String(item.id) === String(id));
  ficha.replaceChildren();

  if (!obra) {
    const aviso = document.createElement("p");
    aviso.className = "indice";
    aviso.textContent = id
      ? `Não há obra com o identificador ${id}.`
      : "Escolha um retrato na galeria.";
    const voltar = document.createElement("a");
    voltar.className = "botao";
    voltar.href = "index.html#galeria";
    voltar.textContent = "Voltar ao salão";
    ficha.append(aviso, voltar);
    return;
  }

  document.title = `${obra.nome} — Retrato de Sucesso`;

  const indice = document.createElement("p");
  indice.className = "indice";
  indice.textContent = `Obra nº ${obra.id} · ${obra.sala}`;

  const moldura = document.createElement("div");
  moldura.className = "moldura moldura-ficha";
  const passe = document.createElement("div");
  passe.className = "passe";
  const picture = document.createElement("picture");
  const source = document.createElement("source");
  source.type = "image/webp";
  source.srcset = `${obra.imagem}.webp`;
  const img = document.createElement("img");
  img.src = `${obra.imagem}.jpg`;
  img.alt = `Retrato de demonstração de ${obra.nome}. Pintura em domínio público, não é uma cliente real.`;
  img.decoding = "async";
  picture.append(source, img);
  passe.append(picture);
  moldura.append(passe);

  const nome = document.createElement("h1");
  nome.textContent = obra.nome;

  const tipo = document.createElement("p");
  tipo.className = "placa-tipo";
  tipo.textContent = `${obra.tipo} · ${obra.ano}`;

  const historia = document.createElement("p");
  historia.className = "historia";
  historia.textContent = obra.historia;

  const nota = document.createElement("p");
  nota.className = "sussurro";
  nota.textContent =
    "A ficha completa desta obra, com compartilhamento, chega na próxima etapa da demonstração.";

  const voltar = document.createElement("a");
  voltar.className = "botao botao-contorno";
  voltar.href = "index.html#galeria";
  voltar.textContent = "Voltar ao salão";

  ficha.append(indice, moldura, nome, tipo, historia, nota, voltar);
}
