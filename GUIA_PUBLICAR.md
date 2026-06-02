# Como publicar o site ABB League no GitHub Pages (passo a passo)

Este guia coloca seu site no ar numa URL pública e o deixa atualizando sozinho
a cada rodada. É gratuito e não exige instalar nada além de uma conta no GitHub.

Tempo estimado: 15 minutos.

---

## Antes de começar
- Crie uma conta gratuita em https://github.com (se ainda não tiver).
- Tenha o `abb-league.zip` baixado e descompactado numa pasta no seu computador.

---

## Passo 1 — Criar o repositório
1. Logado no GitHub, clique no `+` no canto superior direito → **New repository**.
2. Em **Repository name**, escreva: `abb-league`
3. Deixe marcado como **Public**.
4. NÃO marque "Add a README".
5. Clique em **Create repository**.

---

## Passo 2 — Subir os arquivos do site
1. Na página do repositório recém-criado, clique em **uploading an existing file**
   (link azul no meio da tela).
2. Abra a pasta descompactada `abb-league` no seu computador e **entre na pasta `site`**.
3. Selecione TODOS os arquivos de dentro de `site` (index.html, logic.js, data.json,
   logo.jpg) e arraste para a janela do GitHub.
   - Dica: para selecionar tudo, clique em um arquivo e aperte Ctrl+A (Windows) ou Cmd+A (Mac).
4. Role até o fim e clique em **Commit changes**.

> Importante: suba o CONTEÚDO de dentro de `site` na raiz do repositório.
> O `index.html` precisa ficar na raiz (não dentro de uma pasta `site`).

---

## Passo 3 — Subir os arquivos de automação
Agora vamos adicionar os arquivos que leem a API do Cartola.

1. No repositório, clique em **Add file** → **Upload files**.
2. Arraste estes 3 arquivos (estão na pasta `abb-league`, um nível acima de `site`):
   `update_cartola.py`, `teams.json`, `README.md`
3. Clique em **Commit changes**.

---

## Passo 4 — Criar o robô de atualização (workflow)
Pastas que começam com ponto (como `.github`) não sobem bem por arrasto,
então vamos criar esse arquivo direto no GitHub — é rápido:

1. No repositório, clique em **Add file** → **Create new file**.
2. No campo do nome do arquivo, digite exatamente (com as barras):
   ```
   .github/workflows/atualizar.yml
   ```
   (ao digitar as barras `/`, o GitHub cria as pastas sozinho)
3. Abra o arquivo `atualizar.yml` que está no `.zip` (em `abb-league/.github/workflows/`)
   com o Bloco de Notas, copie TODO o conteúdo e cole na caixona do GitHub.
4. Clique em **Commit changes**.

---

## Passo 5 — Ligar o GitHub Pages
1. No repositório, vá em **Settings** (aba no topo).
2. No menu da esquerda, clique em **Pages**.
3. Em **Source**, escolha **GitHub Actions**.

---

## Passo 6 — Rodar pela primeira vez
1. Vá na aba **Actions** (no topo do repositório).
2. Se aparecer um aviso pedindo para habilitar workflows, clique para habilitar.
3. Clique em **"Atualizar ABB League"** na lista à esquerda.
4. Clique no botão **Run workflow** → **Run workflow** (verde).
5. Aguarde uns 2 minutos (vai aparecer uma bolinha verde quando terminar).

---

## Pronto!
Seu site fica disponível em:
```
https://SEU-USUARIO.github.io/abb-league/
```
(troque SEU-USUARIO pelo seu nome de usuário do GitHub)

A partir daqui, a cada 3 horas o robô lê a API do Cartola, atualiza as
pontuações e republica o site automaticamente. Você não precisa fazer mais nada.

---

## Opcional — placar AO VIVO durante a rodada
Sem isto, o site mostra as rodadas já encerradas (que é o normal). Se quiser ver
pontuação parcial durante os jogos, antes do mercado fechar:

1. No repositório: **Settings** → **Secrets and variables** → **Actions**.
2. Clique em **New repository secret**.
3. Nome: `GLB_TOKEN`
4. Valor: seu token GLBID do Cartola (logado no site do Cartola pelo navegador:
   tecle F12 → aba Application → Cookies → copie o valor de `GLBID`).
5. Clique em **Add secret**.

---

## Dúvidas comuns
- **"A página deu 404"**: espere o Passo 6 terminar (bolinha verde) e recarregue.
- **"Quero atualizar agora"**: aba Actions → Run workflow, a qualquer momento.
- **"Mudei o regulamento/quero outro layout"**: é só me pedir as alterações;
  você re-sobe os arquivos alterados pelo mesmo caminho do Passo 2.
