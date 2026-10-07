# 📖 Manual de Uso e Boas Práticas — Facebook Autobot AI

Este guia orienta sobre como utilizar todos os recursos do **Facebook Autobot AI** com máxima eficiência, ensinando como criar conteúdos com alto engajamento, utilizar a personagem/avatar IA, gerenciar agendamentos e seguir as melhores práticas para manter sua Página do Facebook segura e em crescimento contínuo.

---

## 📑 Sumário
1. [Navegação pelo Painel (Dashboard)](#1-navegação-pelo-painel-dashboard)
2. [Criação de Posts Manuais](#2-criação-de-posts-manuais)
   - [Formatos de Conteúdo: Imagem, Vídeo ou Texto](#formatos-de-conteúdo-imagem-vídeo-ou-texto)
   - [Diretrizes de Redação (Copywriting)](#diretrizes-de-redação-copywriting)
   - [Regeneração Individual (Granular)](#regeneração-individual-granular)
   - [Ações: Postar Agora, Agendar ou Rascunho](#ações-postar-agora-agendar-ou-rascunho)
3. [Avatar IA — Personagem Consistente (Nasha)](#3-avatar-ia--personagem-consistente-nasha)
4. [Gerenciamento da Fila & Agendados](#4-gerenciamento-da-fila--agendados)
5. [Histórico de Publicações](#5-histórico-de-publicações)
6. [Banco de Temas Próprios](#6-banco-de-temas-próprios)
7. [Piloto Automático (Autopilot 24/7)](#7-piloto-automático-autopilot-247)
8. [Boas Práticas e Prevenção de Bloqueios no Facebook](#8-boas-práticas-e-prevenção-de-bloqueios-no-facebook)

---

## 1. Navegação pelo Painel (Dashboard)

O menu lateral esquerdo organiza todas as ferramentas do sistema:

| Menu | O que faz |
| :--- | :--- |
| **Visão Geral** | Métricas rápidas: total de posts publicados, posts da semana, posts na fila, gráfico dos últimos 14 dias e status da conexão com o Facebook. |
| **Criar Post** | Estúdio de criação rápida com IA: escolha o tema, formato (foto, vídeo ou texto) e refine a copy e a mídia antes de postar. |
| **Banco de Temas** | Lista de tópicos e ideias personalizadas que você adiciona para alimentar o robô em lote ou no piloto automático. |
| **Fila & Agendados** | Visualize seus rascunhos e posts agendados, altere horários, dispare posts vencidos ou exclua posts. |
| **Histórico** | Registro completo de todos os posts publicados no Facebook, com links diretos para visualizar na rede social. |
| **Páginas** | Alternância e visualização das Páginas do Facebook administradas por sua conta. |
| **Configurações** | Ajuste das chaves de API (Gemini, Groq, Cloudflare, Pexels), avatar IA, preferências de copy e piloto automático. |

---

## 2. Criação de Posts Manuais

A tela **Criar Post** (`/dashboard/generate`) permite gerar postagens profissionais em poucos segundos.

### Formatos de Conteúdo: Imagem, Vídeo ou Texto
No topo do formulário, selecione o formato desejado:
1. **Foto / Imagem:**
   * **IA (FLUX.1 / Pollinations):** Cria uma arte visual inédita em alta definição a partir do tema ou da personagem Nasha.
   * **Stock (Pexels / Pixabay):** Busca fotos profissionais em bancos de imagens gratuitos.
   * **Misto:** A IA escolhe a melhor opção para o tema.
2. **Vídeo (Pexels / Pixabay):**
   * Busca vídeos em Full HD relevantes para o tema.
   * O vídeo é publicado diretamente na Página do Facebook sem sobrecarregar sua hospedagem.
3. **Somente Texto:**
   * Ideal para reflexões, perguntas para a audiência, citações ou posts de engajamento puro no feed (sem foto ou vídeo anexado).

### Diretrizes de Redação (Copywriting)
Abaixo do formato, você pode ajustar como as IAs redigirão o texto:
* **Provedor de Copy:** Escolha entre **Automático**, **Google Gemini**, **Groq (Llama 3)** ou **Pollinations**.
* **Idioma:**
  * `Automático`: Detecta o idioma a partir do tema digitado.
  * `Português (Brasil)`: Força a copy em português.
  * `Inglês (English)`: Força a copy em inglês (ótimo para audiências globais).
  * `Espanhol (Español)`: Força a copy em espanhol.
* **Tamanho do Texto:**
  * `Curto`: 1 a 2 frases diretas e objetivas.
  * `Médio` (Recomendado): 2 a 3 parágrafos curtos com gancho e chamada para ação (CTA).
  * `Longo`: Storytelling rico e detalhado (limitado automaticamente a no máximo 500 caracteres para garantir leitura ágil no Facebook).
  * `🎲 Aleatório`: O robô varia o comprimento a cada post.
* **Tom de Voz:** Escolha entre *Conversacional (amigável)*, *Persuasivo (foco em vendas/conversão)*, *Informativo (dicas práticas)*, *Inspiracional*, *Divertido*, *Profissional* ou *🎲 Aleatório*.
* **+ Regras Extras (Opcional):** Você pode fornecer comandos específicos para aquele post. Exemplo: *"Termine sempre com uma pergunta provocativa; use no máximo 2 emojis; mencione o benefício da consistência."*

### Regeneração Individual (Granular)
Após clicar em **Gerar Post**, você pode ajustar elementos de forma independente:
* **Gostou do texto, mas quer outra imagem?** Clique em **"Regenerar Somente Imagem"** (ou **"Buscar Outro Vídeo"**).
* **Gostou da imagem, mas quer outro texto?** Clique em **"Regenerar Somente Texto"**.
* **Edição Direta:** Você pode clicar no título, na descrição ou nas hashtags e editar qualquer palavra manualmente antes de publicar.

### Ações: Postar Agora, Agendar ou Rascunho
* **Postar agora:** Publica imediatamente na sua Página do Facebook.
* **Agendar:** Abre um seletor de data e hora. O post é enviado para a **Fila & Agendados** e publicado automaticamente no momento exato pelo cronjob.
* **Salvar rascunho:** Guarda o post na fila sem data definida para você revisar ou publicar quando quiser.

---

## 3. Avatar IA — Personagem Consistente (Nasha)

O recurso de Avatar IA foi projetado para criar uma **influenciadora virtual ou mascote com identidade visual contínua**.

### Como funciona:
* Quando o avatar está ativo em **Configurações**, qualquer imagem gerada no formato Foto/Imagem combina os traços físicos do prompt base (cabelo, formato do rosto, estilo de roupa, olhos) com o cenário e a ação do tema digitado.
* **Exemplo de Tema:** *"Nasha tomando café em uma sacada ensolarada, expressão feliz e relaxada."*

### Boas práticas com a Nasha:
1. **Mantenha o provedor Cloudflare Workers AI configurado:** O modelo **FLUX.1 [schnell]** oferece a melhor consistência de rosto e realismo fotográfico gratuito.
2. **Descreva ações e iluminação:** Em vez de apenas *"Nasha no parque"*, escreva *"Nasha caminhando em um parque arborizado ao entardecer, luz suave dourada, sorrindo para a câmera"*.
3. **Quando desativar o avatar:** Se você deseja criar posts sobre infográficos, produtos ou paisagens sem personagens humanas, basta desativar temporariamente o avatar no menu **Configurações**.

---

## 4. Gerenciamento da Fila & Agendados

Na página **Fila & Agendados** (`/dashboard/queue`), você tem o controle total do planejamento de conteúdo:

* **Identificação de Formatos:** Posts com fotos mostram a miniatura, vídeos mostram o selo `VID` e posts de texto exibem o selo azul `📝 TEXTO`.
* **Identificação de Posts Vencidos:** Posts cujo horário agendado já passou são destacados com a etiqueta amarela `Horário vencido`.
* **Disparo Manual:** O botão **"⚡ Disparar Posts Vencidos"** no topo da página publica instantaneamente todos os posts agendados pendentes com 1 clique.
* **Reagendar:** Clique no botão com lápis para abrir o calendário e alterar o dia e horário do post.
* **Excluir:** Clique no ícone de lixeira para remover o post da fila permanentemente.

---

## 5. Histórico de Publicações

Na página **Histórico** (`/dashboard/history`), você acompanha o resultado de todas as postagens:

* **Filtros rápidos:** Alterne entre `Todos`, `Publicados` e `Falharam`.
* **Link Direto:** Clique em **"Ver post ↗"** para abrir a publicação diretamente na sua Página do Facebook e interagir com os comentários da sua audiência.
* **Diagnóstico de Falhas:** Caso algum post falhe (por exemplo, se o Facebook rejeitar uma imagem ou se a conexão expirar), a mensagem exata do erro é exibida em vermelho para fácil correção.

---

## 6. Banco de Temas Próprios

Na tela **Banco de Temas** (`/dashboard/topics`), você pode cadastrar dezenas ou centenas de ideias de uma só vez:

* **Importação em Lote:** Cole uma lista com um tema por linha e clique em **Adicionar temas**.
* **Controle Individual:** Desative ou reative temas específicos com um clique.
* **Uso no Piloto Automático:** O robô utiliza essa lista em sequência para nunca ficar sem assunto nas publicações automáticas.

---

## 7. Piloto Automático (Autopilot 24/7)

O Piloto Automático permite que sua Página no Facebook seja alimentada todos os dias sem nenhuma intervenção humana.

### Como configurar em Configurações:
1. **Ativar Piloto Automático:** Ligue a chave seletora.
2. **Posts por Dia:** Defina uma quantidade saudável (recomendado: de **1 a 4 posts por dia**).
3. **Horários de Postagem:** Selecione os horários de pico da sua audiência (ex: 09:00, 13:00, 18:00, 21:00).
4. **Fuso Horário:** Selecione o seu fuso (ex: `America/Sao_Paulo`).
5. **Fonte dos Temas:**
   * `Somente meus temas`: Usa exclusivamente a sua lista do Banco de Temas.
   * `Temas em alta (Trending)`: O bot pesquisa assuntos do momento na internet.
   * `Misto`: Alterna entre seus temas e tendências.

---

## 8. Boas Práticas e Prevenção de Bloqueios no Facebook

O Facebook possui algoritmos rigorosos contra comportamentos de spam. Siga estas diretrizes para manter sua página 100% segura:

### 1. Frequência Saudável de Postagens
* **Recomendado:** De **2 a 5 posts por dia** com pelo menos 2 a 3 horas de intervalo entre cada um.
* **Evite:** Postar 10 conteúdos em um intervalo de poucos minutos.

### 2. Variação de Formatos
* O algoritmo do Facebook valoriza a diversidade. Alterne entre:
  * 📸 Imagens e fotos com legendas engajantes.
  * 🎬 Vídeos curtos informativos ou inspiracionais.
  * 📝 Posts somente de texto com perguntas ou enquetes abertas.

### 3. Chamadas para Ação Humanizadas (CTAs)
* Termine suas postagens incentivando a interação genuína:
  * *"Qual dessas dicas você já pratica no seu dia a dia? Comente aqui embaixo!"*
  * *"Salve este post para consultar mais tarde!"*
* Evite termos apelativos repetitivos como *"Compartilhe agora ou você terá azar"* ou esquemas do tipo *"curta para ganhar"*, pois o Facebook reduz o alcance orgânico desse tipo de texto.

### 4. Gestão de Chaves e Tokens
* O token obtido via OAuth é de longa duração (60 dias a perpétuo para Páginas). Caso note que os posts falharam com erro `(#200) Permissions error`, basta entrar em **Configurações**, clicar em **Desconectar Facebook** e reconectar para renovar a autorização.
* Mantenha o serviço [cron-job.org](https://cron-job.org) ativo a cada 15 minutos para garantir pontualidade nos agendamentos.

---
*Com o Facebook Autobot AI configurado e seguindo estas boas práticas, sua Página terá uma presença constante, profissional e altamente atrativa no Facebook.*
