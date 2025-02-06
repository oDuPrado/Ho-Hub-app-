<div align="center">



<img src="https://i.imgur.com/Tat47cS.png" alt="Ho-Hub Logo" width="300px">

---

🌍 **Escolha o idioma / Select your language / Seleccione su idioma**:

[![Português](https://img.shields.io/badge/Português-green?style=for-the-badge)](README.md)
[![English](https://img.shields.io/badge/English-blue?style=for-the-badge)](README_en.md)
[![Español](https://img.shields.io/badge/Español-yellow?style=for-the-badge)](README_es.md)

</div>


---

## 🌟 **Visão Geral**

O **Ho-Hub** é a **solução definitiva** para o **gerenciamento de torneios e ligas TCG**.  

✅ **Automatiza e simplifica** toda a administração de torneios, eliminando processos manuais.  
✅ **Unifica a experiência** entre **jogadores, organizadores e juízes**.  
✅ **Plataforma Web + Aplicativo Mobile**, garantindo uma interface moderna e intuitiva.   

---

## 🔥 **1️⃣ Introdução ao Projeto**  

### 📌 **O que é o Ho-Hub?**  
O **Ho-Hub** nasceu para eliminar **processos manuais ineficientes** na organização de torneios **TCG**. O sistema evoluiu de uma ferramenta **local e simples** (que usava **arquivos do TOM e QR Codes**) para uma **plataforma online completa e integrada**, trazendo mais **agilidade, automação e profissionalismo** para **ligas e torneios**.  

Hoje, o **Ho-Hub V3** centraliza **toda a gestão de torneios**, oferecendo **estatísticas detalhadas**, **gerenciamento de jogadores**, **totalmente integrado** entre **web e mobile**.

---

### 📌 **Histórico de Evolução**  

✅ **Versão Inicial (V0.5 a V1.0) - O Começo**  
🔹 Sistema **local** em Flask, que **lia os dados do TOM** e exibia mesas via **QR Codes**.  
🔹 Primeira tentativa de **acesso remoto via PythonAnywhere**, mas com **limitações na atualização em tempo real**.  

✅ **Transição (V1.5 a V1.8) - Adoção de APIs**  
🔹 **Abandono dos WebSockets** em favor de **requisições POST/fetch**, melhorando a **escalabilidade**.  
🔹 Separação do sistema em **dois módulos principais (Main_1 e Main_2)**.  
🔹 Criação do primeiro **app mobile rudimentar** para reportar partidas.  

✅ **Nova Era (V2 e App V0.1) - Firebase & Mobile**  
🔹 Integração com **Banco de dados** para **armazenamento de dados em nuvem**.  
🔹 Primeiro app **mobile real**, eliminando QR Codes e otimizando o report de partidas.  

✅ **Hoje (V1.1.38 e além) - O Ho-Hub Completo!**  
🔥 Um **hub completo** com:  
✔️ **Sistema de login via Firebase**  
✔️ **Gerenciamento avançado de usuários e torneios** 
✔️ **Interface moderna, fluida e responsiva**
✔️ **Calendário inteligente para eventos**  
✔️ **Trade de cartas e gerenciamento de decks**  
✔️ **IA assistente para suporte e estatísticas**  
✔️ **Suporte multilíngue** (Português, Inglês e Espanhol)  


---

## 🚀 **2️⃣ Visão Geral do Sistema**  

O **Ho-Hub** é construído sobre **três pilares fundamentais**:

### **📂 1. Sistema Local (Back-end de Processamento)**  
🔹 **Processa os dados do TOM** e os armazena no **Banco de Dados**.  
🔹 Gerencia as coleções de **jogadores e torneios**, permitindo a organização de **múltiplas ligas simultaneamente**.  

### **🛠 2. Sistema Online (Front end Online)**  
🔹 Controla **autenticação e permissões** via **Authentication**.  
🔹 Oferece **APIs seguras** para comunicação entre **web e mobile**.  
🔹 Gerencia **reportes, logs de partidas e estatísticas**.  

### **📱 3. App Ho-Hub (Interface do Usuário)**  
🔹 Plataforma completa para **jogadores, organizadores e juízes**.  
🔹 Funciona como um **hub central**, oferecendo:  
✔️ Estatísticas detalhadas  
✔️ Reportes rápidos de partidas  
✔️ Gerenciamento de decks e trocas
✔️ Notificações e lembretes automáticos
  

### **🎯 Inovavações ùnicas**  
✅ **Automação Completa** → Elimina muitos processos manuais.  
✅ **Escalabilidade** → Suporte para **múltiplas ligas e eventos simultâneos**.  
✅ **Experiência Intuitiva** → Interface **moderna e fácil de usar**.  
✅ **Notificações Inteligentes** → Mantém jogadores e organizadores sempre informados.  
✅ **Integração Web & Mobile** → Sincronização total via Firebase.  

---

## 🎮 **3️⃣ Funcionalidades do Sistema**  

### 👥 **Cadastro e Gerenciamento de Usuários**  
✔️ Registro seguro com **PIN e autenticação Firebase**.  
✔️ Perfis **personalizados** com **avatares, temas desbloqueáveis e conquistas**.  
✔️ Atribuição de **funções**: **Host, Juiz, Head Judge, VIP**.  

### 🏆 **Torneios e Inscrições**  
✔️ Criar e gerenciar torneios com **controle avançado de inscrições**.  
✔️ **Listas de espera automáticas** para eventos lotados.  
✔️ Sistema de **report rápido e automatizado**.  

### 📅 **Calendário Inteligente**  
✔️ **Filtros avançados**: torneios por **cidade, liga ou globalmente**.  
✔️ Histórico detalhado de eventos.  
✔️ Atualizações e **notificações automáticas** para jogadores.  

### 🎲 **Gerenciamento de Mesas e Reportes**  
✔️ Exibição das **mesas diretamente no app** (sem precisar olhar TV).  
✔️ Reporte de partidas com **verificação automática de resultados**.  
✔️ **Controle de tempo e sistema de turnos inteligente**.  

### 📊 **Histórico de Jogos e Estatísticas**  
✔️ Registro detalhado do desempenho do jogador.  
✔️ **Sistema de rivalidades** com ranking dos principais confrontos.  
✔️ Comparação entre jogadores e **estatísticas avançadas**.  

### 💱 **Trade de Cartas e Decks**  
✔️ **Busca e consulta de cartas válidas** para torneios.  
✔️ **Sistema de trocas**: marque cartas para venda ou interesse.  
✔️ Sincronização com APIs externas para **preços atualizados**.  

### 🧠 **IA Assistente**  
✔️ **Suporte interativo** para dúvidas e estratégias.  
✔️ Ajuda na **escolha de decks e preparação de torneios**.  

### 🌍 **Suporte Multilíngue**  
✔️ Idiomas disponíveis: **Português, Inglês e Espanhol**.  
✔️ Interface adaptável para **jogadores internacionais**.  

---

Aqui está a apresentação com os prints das telas incluídos! 🎨📲  

---

## 📱 **4️⃣ Apresentação das Telas**  

### 🏠 **Tela Home**  
✔️ Estatísticas do jogador e **troca de idioma**.  
✔️ Acesso rápido às **funções principais do sistema**.  
![Tela Home](https://i.imgur.com/Vo0nL4C.png)  

### 👤 **Tela Jogador**  
✔️ Perfil detalhado com **histórico de torneios** e **desbloqueio de conquistas**.  
✔️ **Sistema de rivalidades** para acompanhar seus principais adversários.  

![Tela Jogador](https://i.imgur.com/S424y38.png)  

### 📅 **Tela Calendário**  
✔️ Filtros avançados para **torneios e eventos**.  
✔️ **Inscrição direta e visualização de vagas disponíveis**.  

![Tela Calendário](https://i.imgur.com/F574nnH.png)  

### 🃏 **Tela Cartas**  
✔️ **Busca de cartas válidas e consulta de preços**.  
✔️ **Sistema de trocas e vendas entre jogadores**.  

![Tela Cartas](https://i.imgur.com/dgcF9fU.png)  

### 💱 **Tela Trade**  
✔️ Exibição de cartas disponíveis para troca.  
✔️ Possibilidade de marcar **interesse em cartas de outros jogadores**.  

![Tela Trade](https://i.imgur.com/nrRAak9.png)  

---

## 🎯 **5️⃣ Por Que Escolher o Ho-Hub?**  

🔥 **Transforme seu torneio Pokémon TCG em uma experiência profissional!**  

✅ **Automação Completa** → Nada de planilhas e anotações manuais.  
✅ **Experiência Intuitiva** → Rápido, fácil e eficiente.  
✅ **Integração Total** → Web e app conectados 100% em tempo real.  
✅ **Escalabilidade** → Administre **várias ligas e cidades ao mesmo tempo**.    
✅ **Segurança** → **Autenticação via Banco de dados** para evitar fraudes.  
✅ **Evolução Contínua** → **Novas funcionalidades sempre chegando!** 🚀  

---

🚀 Tecnologias Utilizadas
<div align="center">
📱 Mobile
<img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg" height="50" alt="React Native" /> <img width="20" /> <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/firebase/firebase-plain.svg" height="50" alt="Firebase" /> <img width="20" /> <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/javascript/javascript-original.svg" height="50" alt="JavaScript" />
<br/><br/>

📌 Mobile Stack
✅ React Native (Expo) → Framework para desenvolvimento do app mobile, garantindo compatibilidade entre Android e iOS.
✅ Firebase (Firestore, Auth, Notifications) → Gerencia o banco de dados em tempo real, autenticação segura e notificações push.
✅ JavaScript (ES6+) → Linguagem principal para a lógica do app e comunicação com APIs.

</div>
<div align="center">
🌐 Backend Web
<img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg" height="50" alt="Python" /> <img width="20" /> <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/flask/flask-original.svg" height="50" alt="Flask" /> <img width="20" /> 
<img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/firebase/firebase-plain.svg" height="50" alt="Firebase" /> <img width="20" /> <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/html5/html5-original.svg" height="50" alt="HTML5" /> <img width="20" /> 
<img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/css3/css3-original.svg" height="50" alt="CSS3" /> <img width="20" /> 
<img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/javascript/javascript-original.svg" height="50" alt="JavaScript" />
<br/><br/>

📌 Backend Stack
✅ Python → Linguagem principal para o backend, garantindo eficiência e escalabilidade.
✅ Flask → Framework leve e rápido para criação da API REST e comunicação entre web e mobile.
✅ Firebase → Banco de dados NoSQL em tempo real utilizado para armazenar torneios, usuários e partidas.
✅ HTML5 & CSS3 → Construção da interface web responsiva.
✅ JavaScript (ES6+) → Implementação das requisições assíncronas e comunicação com Firebase.

</div>

---

# 🚀 **Getting Started**

### 🔧 **Pré-requisitos**  
Antes de começar, certifique-se de ter instalado:  

✅ **Node.js** e **Expo CLI** → Para rodar o **app mobile**.  
✅ **Python 3.x** → Para rodar o **backend Flask**.  
✅ **Conta no Firebase** → Para configurar **autenticação e armazenamento**.  

---

### 📥 **Instalação**

1️⃣ **Clone o repositório:**
```bash
git clone https://github.com/seu-usuario/Ho-Hub.git
cd Ho-Hub
```

---

### 🖥️ **Configuração do Backend**
1. Instale as dependências:
   ```bash
   pip install -r requirements.txt
   ```
2. Configure as variáveis de ambiente com as credenciais do **Firebase**.  
3. Execute o servidor Flask:
   ```bash
   python main_2.py
   ```

---

### 📱 **Configuração do App Mobile**
1. Instale as dependências do **Expo**:
   ```bash
   npm install
   ```
2. Inicie o projeto:
   ```bash
   expo start
   ```

---

## 📜 **Licença**

🔓 Este projeto está licenciado sob a **[MIT License](LICENSE)**, permitindo o uso, modificação e distribuição sob os termos da licença MIT.  
 

---

## ☕ Apoie o Projeto  
💡 Gostou do **Ho-Hub**? Considere apoiar para que ele continue evoluindo!  

<p align="center">
  <a href="https://picpay.me/marco.macedo10/0.5" target="_blank">
    <img src="https://img.shields.io/badge/💰%20Doar-PicPay-brightgreen?style=for-the-badge&logo=picpay">
  </a>
</p>


---

## Contato

Caso tenha dúvidas, sugestões ou queira contribuir, entre em contato:

<div align="center">
  <a href="https://www.linkedin.com/in/marcoauréliomacedoprado" target="_blank">
    <img src="https://img.shields.io/static/v1?message=LinkedIn&logo=linkedin&label=&color=0077B5&logoColor=white&labelColor=&style=plastic" height="36" alt="linkedin logo" />
  </a>
  <a href="https://www.instagram.com/prado.marco1/" target="_blank">
    <img src="https://img.shields.io/static/v1?message=Instagram&logo=instagram&label=&color=E4405F&logoColor=white&labelColor=&style=plastic" height="36" alt="instagram logo" />
  </a>
  <a href="https://wa.me/5567996893356" target="_blank">
  <img src="https://img.shields.io/static/v1?message=Whatsapp&logo=whatsapp&label=&color=25D366&logoColor=white&labelColor=&style=plastic" height="36" alt="whatsapp logo" />
</a>
  <a href="https://discord.com/users/yourdiscordid" target="_blank">
    <img src="https://img.shields.io/static/v1?message=Discord&logo=discord&label=&color=7289DA&logoColor=white&labelColor=&style=plastic" height="36" alt="discord logo" />
  </a>
</div>
