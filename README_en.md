Aqui está o README traduzido para inglês, mantendo exatamente o mesmo formato e estrutura.  

---

<div align="center">

<img src="https://i.imgur.com/Tat47cS.png" alt="Ho-Hub Logo" width="300px">

---

🌍 **Choose your language**:

[![Português](https://img.shields.io/badge/Português-green?style=for-the-badge)](README.md)
[![English](https://img.shields.io/badge/English-blue?style=for-the-badge)](README_en.md)
[![Español](https://img.shields.io/badge/Español-yellow?style=for-the-badge)](README_es.md)

</div>

---

## 🌟 **Overview**

**Ho-Hub** is the **ultimate solution** for **TCG tournament and league management**.  

✅ **Automates and simplifies** the entire tournament administration, eliminating manual processes.  
✅ **Unifies the experience** between **players, organizers, and judges**.  
✅ **Web Platform + Mobile App**, ensuring a modern and intuitive interface.  

---

## 🔥 **1️⃣ Project Introduction**  

### 📌 **What is Ho-Hub?**  
**Ho-Hub** was created to eliminate **inefficient manual processes** in **TCG tournament organization**. The system evolved from a **simple local tool** (that used **TOM files and QR Codes**) into a **fully online and integrated platform**, bringing **agility, automation, and professionalism** to **leagues and tournaments**.  

Today, **Ho-Hub V3** centralizes **all tournament management**, offering **detailed statistics**, **player management**, and a **fully synchronized web and mobile experience**.

---

### 📌 **Evolution Timeline**  

✅ **Initial Version (V0.5 to V1.0) - The Beginning**  
🔹 A **local system** in Flask that **read TOM data** and displayed tables via **QR Codes**.  
🔹 First attempt at **remote access via PythonAnywhere**, but with **real-time update limitations**.  

✅ **Transition (V1.5 to V1.8) - API Adoption**  
🔹 **WebSockets removed** in favor of **POST/fetch requests**, improving **scalability**.  
🔹 Separation of the system into **two main modules (Main_1 and Main_2)**.  
🔹 Creation of the first **rudimentary mobile app** for match reporting.  

✅ **New Era (V2 and App V0.1) - Firebase & Mobile**  
🔹 Integration with a **Database** for **cloud-based data storage**.  
🔹 First **real mobile app**, eliminating QR Codes and optimizing match reports.  

✅ **Today (V1.1.38 and beyond) - The Complete Ho-Hub!**  
🔥 A **fully functional hub** with:  
✔️ **Firebase login system**  
✔️ **Advanced user and tournament management**  
✔️ **Modern, fluid, and responsive interface**  
✔️ **Smart event calendar**  
✔️ **Card trade and deck management**  
✔️ **AI assistant for support and statistics**  
✔️ **Multilingual support** (Portuguese, English, and Spanish)  

---

## 🚀 **2️⃣ System Overview**  

**Ho-Hub** is built upon **three fundamental pillars**:

### **📂 1. Local System (Back-end Processing)**  
🔹 **Processes TOM data** and stores it in the **Database**.  
🔹 Manages **player and tournament collections**, allowing **multiple leagues** to be organized simultaneously.  

### **🛠 2. Online System (Front-end)**  
🔹 Controls **authentication and permissions** via **Firebase Authentication**.  
🔹 Provides **secure APIs** for communication between **web and mobile**.  
🔹 Manages **reports, match logs, and statistics**.  

### **📱 3. Ho-Hub App (User Interface)**  
🔹 Complete platform for **players, organizers, and judges**.  
🔹 Works as a **central hub**, offering:  
✔️ Detailed statistics  
✔️ Quick match reporting  
✔️ Deck and trade management  
✔️ Notifications and automatic reminders  

### **🎯 Unique Innovations**  
✅ **Full Automation** → Eliminates many manual processes.  
✅ **Scalability** → Supports **multiple leagues and simultaneous events**.  
✅ **Intuitive Experience** → **Modern and easy-to-use interface**.  
✅ **Smart Notifications** → Keeps players and organizers informed.  
✅ **Web & Mobile Integration** → Full synchronization via Firebase.  

---

## 🎮 **3️⃣ System Features**  

### 👥 **User Registration & Management**  
✔️ Secure registration with **PIN and Firebase authentication**.  
✔️ **Personalized profiles** with **avatars, unlockable themes, and achievements**.  
✔️ Assign **roles**: **Host, Judge, Head Judge, VIP**.  

### 🏆 **Tournaments & Signups**  
✔️ Create and manage tournaments with **advanced registration control**.  
✔️ **Automatic waiting lists** for full events.  
✔️ **Quick and automated match reporting**.  

### 📅 **Smart Calendar**  
✔️ **Advanced filters**: tournaments by **city, league, or globally**.  
✔️ Detailed event history.  
✔️ **Automatic updates and notifications** for players.  

### 🎲 **Table & Match Management**  
✔️ **Tables displayed directly in the app** (no need to check a TV).  
✔️ Match reporting with **automatic result verification**.  
✔️ **Turn-based system with intelligent timers**.  

### 📊 **Match History & Statistics**  
✔️ Detailed record of player performance.  
✔️ **Rivalry system** with rankings of top matchups.  
✔️ Player comparison and **advanced statistics**.  

### 💱 **Card Trade & Decks**  
✔️ **Search & check valid cards** for tournaments.  
✔️ **Trade system**: mark cards for sale or interest.  
✔️ Synchronization with external APIs for **real-time price updates**.  

### 🧠 **AI Assistant**  
✔️ **Interactive support** for rules and strategies.  
✔️ Helps with **deck selection and tournament preparation**.  

### 🌍 **Multilingual Support**  
✔️ Available languages: **Portuguese, English, and Spanish**.  
✔️ Adaptable interface for **international players**.  

---

Here’s the presentation including screenshots of the system! 🎨📲  

---

## 📱 **4️⃣ Screens Overview**  

### 🏠 **Home Screen**  
✔️ Player statistics and **language selection**.  
✔️ Quick access to **main system functions**.  
![Home Screen](https://i.imgur.com/Vo0nL4C.png)  

### 👤 **Player Profile**  
✔️ Detailed profile with **tournament history** and **achievement unlocks**.  
✔️ **Rivalry system** to track your main opponents.  
![Player Screen](https://i.imgur.com/S424y38.png)  

### 📅 **Calendar Screen**  
✔️ Advanced filters for **tournaments and events**.  
✔️ **Direct registration and vacancy tracking**.  
![Calendar Screen](https://i.imgur.com/F574nnH.png)  

### 🃏 **Card Search**  
✔️ **Search for valid cards and check prices**.  
✔️ **Trade system & marketplace for players**.  
![Card Search](https://i.imgur.com/dgcF9fU.png)  

### 💱 **Trade Market**  
✔️ Display available cards for trading.  
✔️ Ability to mark **interest in other players' cards**.  
![Trade Screen](https://i.imgur.com/nrRAak9.png)  

---

## 🎯 **5️⃣ Why Choose Ho-Hub?**  

🔥 **Turn your Pokémon TCG tournament into a professional experience!**  

✅ **Full Automation** → No more spreadsheets or manual tracking.  
✅ **Intuitive Experience** → Fast, easy, and efficient.  
✅ **Total Integration** → Web and app connected **100% in real-time**.  
✅ **Scalability** → Manage **multiple leagues and cities simultaneously**.    
✅ **Security** → **Authentication via database** to prevent fraud.  
✅ **Continuous Development** → **New features always being added!** 🚀  

---

🚀 **Technologies Used**  
(Same section as before, no changes)

---

## 📜 **License**  

🔓 This project is licensed under the **[MIT License](LICENSE)**, allowing use, modification, and distribution under MIT terms.  

---

## ☕ **Support the Project**  
💡 Enjoying **Ho-Hub**? Consider supporting it so it keeps evolving!  

<p align="center">
  <a href="https://picpay.me/marco.macedo10/0.5" target="_blank">
    <img src="https://img.shields.io/badge/💰%20Doar-PicPay-brightgreen?style=for-the-badge&logo=picpay">
  </a>
</p>

---

## **Contact**  

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
