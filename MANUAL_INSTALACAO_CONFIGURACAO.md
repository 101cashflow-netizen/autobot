# 📘 Manual de Instalação e Configuração — Facebook Autobot AI

Este guia completo ensina passo a passo como instalar, configurar e colocar em produção o **Facebook Autobot AI** do zero, utilizando **100% de serviços gratuitos** (Supabase, Cloudflare Pages, Meta Graph API, Google Gemini, Groq, Cloudflare Workers AI e cron-job.org).

---

## 📑 Índice
1. [Requisitos Prévios](#1-requisitos-prévios)
2. [Passo 1: Banco de Dados e Armazenamento (Supabase)](#passo-1-banco-de-dados-e-armazenamento-supabase)
3. [Passo 2: Hospedagem e Deploy (Cloudflare Pages)](#passo-2-hospedagem-e-deploy-cloudflare-pages)
4. [Passo 3: Aplicativo no Meta for Developers (Facebook Graph API)](#passo-3-aplicativo-no-meta-for-developers-facebook-graph-api)
5. [Passo 4: Conectar sua Página no Painel do Autobot](#passo-4-conectar-sua-página-no-painel-do-autobot)
6. [Passo 5: Configurar as Inteligências Artificiais](#passo-5-configurar-as-inteligências-artificiais)
   - [Google Gemini API (Gratuito)](#google-gemini-api-gratuito)
   - [Groq AI — Llama 3 (Ultra-Rápido & Gratuito)](#groq-ai--llama-3-ultra-rápido--gratuito)
   - [Cloudflare Workers AI — FLUX.1 (Imagens em Alta Qualidade)](#cloudflare-workers-ai--flux1-imagens-em-alta-qualidade)
   - [Pollinations AI (Fallback Automático Sem Chave)](#pollinations-ai-fallback-automático-sem-chave)
7. [Passo 6: Provedores de Vídeos e Fotos de Banco de Imagens](#passo-6-provedores-de-vídeos-e-fotos-de-banco-de-imagens)
8. [Passo 7: Automação 24/7 com cron-job.org](#passo-7-automação-247-com-cron-joborg)
9. [Resumo das Variáveis de Ambiente](#resumo-das-variáveis-de-ambiente)

---

## 1. Requisitos Prévios

Antes de começar, certifique-se de ter:
* Uma **Página no Facebook** ativa da qual você seja Administrador (o Facebook não permite postagens automáticas via API em perfis pessoais comuns).
* Uma conta no **GitHub** (gratuita).
* Um bloco de notas aberto para copiar chaves e credenciais durante o processo.

---

## Passo 1: Banco de Dados e Armazenamento (Supabase)

O Supabase armazena as configurações, os temas, a fila de posts agendados, o histórico e as imagens geradas por IA.

1. Acesse [supabase.com](https://supabase.com) e crie uma conta gratuita.
2. Clique em **New Project** (Novo Projeto):
   * **Name:** `facebook-autobot` (ou o nome que preferir).
   * **Database Password:** Clique em *Generate* e guarde a senha.
   * **Region:** Escolha a região mais próxima (ex: *São Paulo* ou *East US*).
   * **Pricing Plan:** Free tier.
3. Aguarde cerca de 1 a 2 minutos até o provisionamento concluir.
4. **Executar o Script SQL:**
   * No menu lateral esquerdo do Supabase, clique em **SQL Editor** (ícone de terminal) e depois em **New Query**.
   * Abra o arquivo [`supabase/schema.sql`](supabase/schema.sql) deste repositório, copie todo o seu conteúdo e cole no editor do Supabase.
   * Clique no botão **Run** (Executar). Você verá a mensagem `Success. No rows returned.`
5. **Verificar o Bucket de Imagens (`post-images`):**
   * No menu lateral, clique em **Storage**.
   * Verifique se o bucket `post-images` existe. Se não existir, clique em **New Bucket**, dê o nome de `post-images` e marque obrigatoriamente a opção **Public Bucket** (Balde Público). Salve.
6. **Copiar as Chaves do Supabase:**
   * No menu lateral esquerdo, clique no ícone de engrenagem (**Project Settings**) e selecione a aba **API**.
   * Copie e guarde no seu bloco de notas:
     * **Project URL** (ex: `https://mvatltcqtnxbkstbbgus.supabase.co`).
     * **`service_role` Secret Key** (clique em *Reveal* na linha da chave `service_role`, **NÃO** use a chave `anon`).

---

## Passo 2: Hospedagem e Deploy (Cloudflare Pages)

O Cloudflare Pages executa o bot globalmente sem limites de tempo de execução e com custo zero.

1. Envie o código do bot para o seu repositório no GitHub (ex: `https://github.com/seu-usuario/autobot`).
2. Acesse o painel da [Cloudflare](https://dash.cloudflare.com/) e clique em **Workers & Pages** no menu lateral.
3. Clique em **Create application** > aba **Pages** > **Connect to Git**.
4. Selecione a sua conta do GitHub e o repositório do Autobot.
5. Em **Build settings** (Configurações de Build):
   * **Framework preset:** `Next.js`
   * **Build command:** `npx @cloudflare/next-on-pages`
   * **Build output directory:** `.vercel/output/static`
6. Em **Environment variables (Variables and Secrets)**, adicione:
   * `NODE_VERSION`: `22`
   * `NEXT_PUBLIC_SUPABASE_URL`: (a URL do seu projeto Supabase copiada no Passo 1)
   * `SUPABASE_SERVICE_ROLE_KEY`: (a chave `service_role` copiada no Passo 1)
   * `ADMIN_PASSWORD`: (uma senha segura para você fazer login no painel do Autobot, ex: `#MinhaSenha123`)
   * `SESSION_SECRET`: (uma sequência aleatória de 32 caracteres, ex: `m/bcd7ffea035e29aacd987654321`)
7. Clique em **Save and Deploy**.
8. Aguarde o build terminar (cerca de 1 a 2 minutos). A Cloudflare gerará um domínio gratuito no formato:
   `https://seu-projeto.pages.dev`

---

## Passo 3: Aplicativo no Meta for Developers (Facebook Graph API)

Para que o bot possa publicar na sua Página do Facebook, é necessário criar um App no portal de desenvolvedores da Meta.

1. Acesse [developers.facebook.com](https://developers.facebook.com/) e faça login com sua conta do Facebook.
2. Clique em **Meus Aplicativos** > **Criar aplicativo**.
3. **Tipo de Caso de Uso:** Selecione **Outro** ou **Empresarial** (Business) e avance.
4. Digite um nome para o app (ex: `Autobot Publicador`) e informe seu e-mail de contato.
5. **Configurar Casos de Uso / Permissões:**
   * No menu lateral do aplicativo, vá em **Casos de uso** (ou *Permissões e recursos*).
   * Adicione as seguintes permissões essenciais:
     * `pages_manage_posts` (Permite criar e publicar posts na Página)
     * `pages_read_engagement` (Permite ler status e engajamento da Página)
     * `pages_show_list` (Permite listar quais Páginas você administra)
6. **Configurar o Login do Facebook:**
   * No menu lateral, adicione o produto **Login do Facebook para Empresas** (ou *Login do Facebook*).
   * Vá em **Configurações** do Login do Facebook:
     * No campo **URIs de redirecionamento do OAuth válidos**, cole:
       `https://seu-projeto.pages.dev/api/facebook/oauth/callback`
     * Salve as alterações.
7. **Configurações Básicas do App:**
   * No menu lateral, vá em **Configurações do app** > **Básico**.
   * No campo **Domínios do aplicativo**, digite apenas o domínio da sua Cloudflare sem `https://` e sem barra:
     `seu-projeto.pages.dev`
   * No campo **URL da Política de Privacidade**, você pode colocar `https://seu-projeto.pages.dev/privacy` (ou a URL do seu site).
   * Salve as alterações.
8. **Copiar Credenciais do Facebook:**
   * Na mesma tela de Configurações Básicas, copie:
     * **ID do aplicativo** (App ID)
     * **Chave secreta do aplicativo** (App Secret — clique em *Mostrar*)

---

## Passo 4: Conectar sua Página no Painel do Autobot

1. Abra seu bot no navegador: `https://seu-projeto.pages.dev`.
2. Digite a senha cadastrada em `ADMIN_PASSWORD` para entrar no painel.
3. No menu lateral, clique em **Configurações**:
   * No cartão **Meta App Credentials (Facebook API)**:
     * Cole o seu **App ID**.
     * Cole o seu **App Secret**.
     * Clique em **Save credentials**.
4. Em seguida, clique no botão **Connect Facebook**.
5. Uma janela do Facebook se abrirá:
   * Conceda as permissões solicitadas.
   * Selecione a Página do Facebook que o bot deve gerenciar.
6. Após redirecionar com sucesso, selecione a **Página Padrão** no seletor e salve.

---

## Passo 5: Configurar as Inteligências Artificiais

No menu **Configurações**, você pode habilitar e configurar múltiplos provedores de IA com fallback automático.

### Google Gemini API (Gratuito)
* **Função:** Escreve títulos, legendas magnéticas e hashtags em português ou no idioma desejado com alta qualidade e tom natural.
* **Como obter:**
  1. Acesse [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
  2. Clique em **Create API Key**.
  3. No painel do Autobot em **Configurações** > cartão **Google Gemini AI**, cole a sua chave `AIzaSy...` e clique em **Salvar chave**.

### Groq AI — Llama 3 (Ultra-Rápido & Gratuito)
* **Função:** Geração em milissegundos com os modelos `llama-3.3-70b-versatile` e `llama-3.1-8b-instant`.
* **Como obter:**
  1. Acesse [console.groq.com/keys](https://console.groq.com/keys).
  2. Crie uma chave gratuita.
  3. No painel do Autobot em **Configurações** > cartão **Groq AI**, cole a chave `gsk_...` e clique em **Salvar chave da Groq**.

### Cloudflare Workers AI — FLUX.1 (Imagens em Alta Qualidade)
* **Função:** Gera imagens hiper-realistas para o avatar IA (Nasha) e para os posts com consistência visual usando o modelo **Black Forest Labs FLUX.1 [schnell]** sem custo na camada gratuita da Cloudflare.
* **Como obter:**
  1. No painel da Cloudflare ([dash.cloudflare.com](https://dash.cloudflare.com/)), copie o seu **Account ID** (encontrado na barra lateral direita da página inicial).
  2. Vá em **Gerenciar Conta** > **Tokens de API** > **Criar Token**.
  3. Escolha o modelo **Workers AI Read** (ou crie um token customizado com permissão `Workers AI: Read`).
  4. No painel do Autobot em **Configurações** > cartão **Cloudflare Workers AI**, cole o Account ID e o API Token e clique em **Salvar**.

### Pollinations AI (Fallback Automático Sem Chave)
* Não requer chave de API nem cadastro. Funciona como estepe automático para geração de textos e imagens caso as outras IAs atinjam limites temporários.

---

## Passo 6: Provedores de Vídeos e Fotos de Banco de Imagens

Para permitir que o bot crie posts com vídeos em Full HD ou fotos de bancos de imagens gratuitos:

1. **Pexels API:**
   * Acesse [pexels.com/api](https://www.pexels.com/api/) e crie uma conta gratuita.
   * Gere uma chave de API gratuita.
   * No painel do Autobot em **Configurações** > cartão **Bancos de Imagens e Vídeos**, cole a chave do Pexels.
2. **Pixabay API:**
   * Acesse [pixabay.com/api/docs](https://pixabay.com/api/docs/) e copie a chave da sua conta.
   * Cole no campo correspondente e clique em **Salvar**.

---

## Passo 7: Automação 24/7 com cron-job.org

Para que o bot publique posts agendados na hora exata e acione o Piloto Automático sem precisar deixar o computador ligado ou o site aberto:

1. Crie uma conta gratuita em [cron-job.org](https://cron-job.org).
2. Clique em **Cronjobs** > **Create Cronjob**.
3. Preencha os campos:
   * **Title:** `Autobot Facebook`
   * **URL:** `https://seu-projeto.pages.dev/api/cron/process-queue`
   * **Execution schedule:** `Every 15 minutes` (A cada 15 minutos) ou `Every 10 minutes`.
   * **Request method:** `GET`
   * **Authentication:** Nenhuma (deixe desmarcado).
4. Clique em **TEST RUN** (deve retornar `200 OK`).
5. Clique em **CREATE**.

---

## Resumo das Variáveis de Ambiente

| Variável | Obrigatória | Onde Configurar | Descrição |
| :--- | :---: | :---: | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Sim | Cloudflare Pages | URL do seu projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Sim | Cloudflare Pages | Chave secreta de serviço do Supabase |
| `ADMIN_PASSWORD` | Sim | Cloudflare Pages | Senha para login no dashboard do Autobot |
| `SESSION_SECRET` | Sim | Cloudflare Pages | String aleatória (32+ caracteres) para cookies de sessão |
| `NODE_VERSION` | Sim | Cloudflare Pages | Valor fixo: `22` |
| `GEMINI_API_KEY` | Opcional | Painel do Bot / CF | Chave da Google Gemini API |
| `GROQ_API_KEY` | Opcional | Painel do Bot / CF | Chave da Groq Cloud API |
| `CRON_SECRET` | Opcional | Cloudflare Pages | Chave secreta caso queira proteger a URL do cron |

---
*Parabéns! Sua instalação do Facebook Autobot AI está completa e operando 100% no piloto automático.*
