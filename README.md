# Retrato de Sucesso

Site de demonstração do ateliê de retratos em Parnaíba, Piauí. A página é um museu: rolar a tela é caminhar pelos salões.

Os nomes, anos e histórias das obras são fictícios. As imagens são pinturas de domínio público, só para mostrar o lugar das fotos reais. A etiqueta **Acervo de demonstração** fica visível no topo.

## Abrir no computador

Na pasta do projeto:

```bash
python3 -m http.server 8000
```

Abra `http://localhost:8000`. Use um servidor local: abrir o `index.html` direto no navegador impede a leitura do `obras.json`.

## Trocar as obras

Edite só o arquivo `obras.json`. Cada obra tem:

| Campo | O que é |
| --- | --- |
| `id` | Identificador usado no link `obra.html?id=` |
| `imagem` | Caminho sem extensão, por exemplo `img/obra-01` |
| `nome` | Nome fictício na plaquinha |
| `tipo` | Tipo de ensaio, por exemplo `Ensaio família` |
| `ano` | Ano do ensaio fictício |
| `historia` | Duas ou três frases |
| `sala` | `Corporativo`, `Família`, `Casamento`, `15 anos` ou `Gestante` |

Para trocar a foto, coloque um `.webp` e um `.jpg` com o mesmo nome em `img/` e aponte `imagem` para esse nome, sem a extensão. O site usa o WebP e o JPEG fica de reserva.

O número de WhatsApp fica no topo de `js/galeria.js`, na constante `WHATSAPP_NUMBER` (só dígitos, com DDI e DDD).

## Caminhada pelos salões

Com JavaScript e movimento liberado, a entrada é o corredor: a rolagem caminha, vira a câmera de frente para cada retrato e segue até a obra principal. Não há atalho de um salão para outro. O rótulo do salão e o “Obra N de M” só acompanham o percurso.

Quem prefere movimento reduzido, ou quem está sem JavaScript, vê a galeria plana da primeira etapa.

A velocidade está no topo de `js/corredor.js`. Os números são altura de rolagem (`svh`): quanto maior, mais longa e mais lenta é a etapa.

| Constante | O que muda |
| --- | --- |
| `WALK_LEN` | Caminhada de uma obra até a próxima |
| `TURN_LEN` | Virada da câmera para a parede, e a volta |
| `DWELL_LEN` | Pausa diante do retrato |
| `TURN_ANGLE` | Ângulo da virada, em graus (88 deixa o quadro quase de frente) |
| `FINAL_WALK` | Última caminhada até a obra principal |
| `FINAL_HOLD` | Pausa final |
| `OBRAS_POR_SALAO` | Máximo de obras de cada salão na caminhada |

`OBRAS_POR_SALAO` vale 3. Entram as primeiras obras daquele salão em `obras.json`. Para alongar ou encurtar o percurso, mude esse número. A galeria plana continua mostrando o arquivo inteiro. Hoje cada salão tem duas obras, então as dez entram na caminhada.

## Publicar

O workflow em `.github/workflows/pages.yml` publica o site a partir da branch `main`. No GitHub, em **Settings → Pages → Build and deployment**, a origem precisa ser **GitHub Actions**. O endereço fica `https://<usuário>.github.io/museu-retrato-de-sucesso/`. Os caminhos do site são relativos para funcionar dentro dessa pasta.
