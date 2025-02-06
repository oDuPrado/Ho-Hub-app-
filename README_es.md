<div align="center">

<img src="https://i.imgur.com/Tat47cS.png" alt="Ho-Hub Logo" width="300px">

---

🌍 **Elige tu idioma**:

[![Português](https://img.shields.io/badge/Português-green?style=for-the-badge)](README.md)
[![English](https://img.shields.io/badge/English-blue?style=for-the-badge)](README_en.md)
[![Español](https://img.shields.io/badge/Español-yellow?style=for-the-badge)](README_es.md)

</div>

---

## 🌟 **Visión General**

**Ho-Hub** es la **solución definitiva** para la **gestión de torneos y ligas de juegos de cartas coleccionables (TCG)**.

✅ **Automatiza y simplifica** toda la administración de torneos, eliminando procesos manuales.  
✅ **Unifica la experiencia** entre **jugadores, organizadores y jueces**.  
✅ **Plataforma Web + Aplicación Móvil**, garantizando una interfaz moderna e intuitiva.

---

## 🔥 **1️⃣ Introducción al Proyecto**

### 📌 **¿Qué es Ho-Hub?**  
**Ho-Hub** nació para eliminar los **procesos manuales ineficientes** en la organización de torneos de **TCG**. El sistema evolucionó de ser una herramienta **local y sencilla** (que utilizaba archivos del TOM y Códigos QR) a una **plataforma en línea completa e integrada**, aportando mayor **agilidad, automatización y profesionalismo** a las **ligas y torneos**.

Hoy en día, **Ho-Hub V3** centraliza **toda la gestión de torneos**, ofreciendo **estadísticas detalladas**, **gestión de jugadores** y una experiencia **totalmente sincronizada entre web y móvil**.

---

### 📌 **Línea de Evolución**

✅ **Versión Inicial (V0.5 a V1.0) - El Comienzo**  
🔹 Sistema **local** en Flask, que **leía los datos del TOM** y mostraba las mesas mediante **Códigos QR**.  
🔹 Primer intento de **acceso remoto a través de PythonAnywhere**, pero con **limitaciones en la actualización en tiempo real**.

✅ **Transición (V1.5 a V1.8) - Adopción de APIs**  
🔹 **Eliminación de WebSockets** en favor de **solicitudes POST/fetch**, mejorando la **escalabilidad**.  
🔹 Separación del sistema en **dos módulos principales (Main_1 y Main_2)**.  
🔹 Creación de la primera **aplicación móvil rudimentaria** para el reporte de partidos.

✅ **Nueva Era (V2 y App V0.1) - Firebase y Móvil**  
🔹 Integración con una **base de datos** para el **almacenamiento de datos en la nube**.  
🔹 Primera aplicación **móvil real**, eliminando los Códigos QR y optimizando los reportes de partidos.

✅ **Hoy en día (V1.1.38 y más allá) - ¡El Ho-Hub Completo!**  
🔥 Un **hub completo** con:  
✔️ **Sistema de inicio de sesión mediante Firebase**  
✔️ **Gestión avanzada de usuarios y torneos**  
✔️ **Interfaz moderna, fluida y responsiva**  
✔️ **Calendario inteligente para eventos**  
✔️ **Intercambio de cartas y gestión de mazos**  
✔️ **Asistente de inteligencia artificial para soporte y estadísticas**  
✔️ **Soporte multilingüe** (Portugués, Inglés y Español)

---

## 🚀 **2️⃣ Visión General del Sistema**

**Ho-Hub** se construye sobre **tres pilares fundamentales**:

### **📂 1. Sistema Local (Procesamiento Back-end)**  
🔹 **Procesa los datos del TOM** y los almacena en la **base de datos**.  
🔹 Gestiona las colecciones de **jugadores y torneos**, permitiendo la organización de **múltiples ligas de forma simultánea**.

### **🛠 2. Sistema en Línea (Front-end)**  
🔹 Controla la **autenticación y los permisos** a través de **Firebase Authentication**.  
🔹 Proporciona **APIs seguras** para la comunicación entre **web y móvil**.  
🔹 Gestiona los **reportes, registros de partidos y estadísticas**.

### **📱 3. Aplicación Ho-Hub (Interfaz de Usuario)**  
🔹 Plataforma completa para **jugadores, organizadores y jueces**.  
🔹 Funciona como un **hub central**, ofreciendo:  
✔️ Estadísticas detalladas  
✔️ Reporte rápido de partidos  
✔️ Gestión de mazos y comercio de cartas  
✔️ Notificaciones y recordatorios automáticos

### **🎯 Innovaciones Únicas**  
✅ **Automatización Completa** → Elimina numerosos procesos manuales.  
✅ **Escalabilidad** → Soporta **múltiples ligas y eventos simultáneos**.  
✅ **Experiencia Intuitiva** → Interfaz **moderna y fácil de usar**.  
✅ **Notificaciones Inteligentes** → Mantiene a jugadores y organizadores siempre informados.  
✅ **Integración Web y Móvil** → Sincronización total a través de Firebase.

---

## 🎮 **3️⃣ Funcionalidades del Sistema**

### 👥 **Registro y Gestión de Usuarios**  
✔️ Registro seguro con **PIN y autenticación Firebase**.  
✔️ Perfiles **personalizados** con **avatares, temas desbloqueables y logros**.  
✔️ Asignación de **roles**: **Host, Juez, Jefe de Jueces, VIP**.

### 🏆 **Torneos e Inscripciones**  
✔️ Creación y gestión de torneos con **control avanzado de inscripciones**.  
✔️ Listas de espera automáticas para eventos con cupos completos.  
✔️ Sistema de **reporte rápido y automatizado de partidos**.

### 📅 **Calendario Inteligente**  
✔️ **Filtros avanzados**: torneos por **ciudad, liga o globalmente**.  
✔️ Historial detallado de eventos.  
✔️ **Actualizaciones y notificaciones automáticas** para los jugadores.

### 🎲 **Gestión de Mesas y Reportes**  
✔️ Visualización de las **mesas directamente en la aplicación** (sin necesidad de consultar una televisión).  
✔️ Reporte de partidos con **verificación automática de resultados**.  
✔️ **Sistema de turnos con temporizadores inteligentes**.

### 📊 **Historial de Partidos y Estadísticas**  
✔️ Registro detallado del rendimiento de cada jugador.  
✔️ **Sistema de rivalidades** con clasificación de los enfrentamientos más destacados.  
✔️ Comparación entre jugadores y **estadísticas avanzadas**.

### 💱 **Intercambio de Cartas y Mazos**  
✔️ **Búsqueda y consulta de cartas válidas** para torneos.  
✔️ Sistema de **intercambio**: marca cartas para la venta o para expresar interés.  
✔️ Sincronización con APIs externas para obtener **precios actualizados en tiempo real**.

### 🧠 **Asistente de Inteligencia Artificial**  
✔️ **Soporte interactivo** para resolver dudas sobre torneos y reglas.  
✔️ Ayuda en la **elección de mazos y preparación de torneos**.

### 🌍 **Soporte Multilingüe**  
✔️ Idiomas disponibles: **Portugués, Inglés y Español**.  
✔️ Interfaz adaptable para **jugadores internacionales**.

---

Aquí se presenta la documentación con capturas de pantalla del sistema incluidas. 🎨📲

---

## 📱 **4️⃣ Presentación de las Pantallas**

### 🏠 **Pantalla Principal (Home Screen)**  
✔️ Estadísticas del jugador y **selección de idioma**.  
✔️ Acceso rápido a las **funciones principales del sistema**.  
![Pantalla Principal](https://i.imgur.com/Vo0nL4C.png)

### 👤 **Perfil del Jugador**  
✔️ Perfil detallado con **historial de torneos** y **desbloqueo de logros**.  
✔️ **Sistema de rivalidades** para seguir a tus principales oponentes.  
![Pantalla Jugador](https://i.imgur.com/S424y38.png)

### 📅 **Pantalla de Calendario**  
✔️ Filtros avanzados para torneos y eventos.  
✔️ **Registro directo y visualización de vacantes disponibles**.  
![Pantalla de Calendario](https://i.imgur.com/F574nnH.png)

### 🃏 **Pantalla de Cartas**  
✔️ **Búsqueda de cartas válidas y consulta de precios**.  
✔️ **Sistema de intercambio y mercado entre jugadores**.  
![Pantalla de Cartas](https://i.imgur.com/dgcF9fU.png)

### 💱 **Pantalla de Intercambio**  
✔️ Visualización de cartas disponibles para intercambio.  
✔️ Posibilidad de marcar **interés en las cartas de otros jugadores**.  
![Pantalla de Intercambio](https://i.imgur.com/nrRAak9.png)

---

## 🎯 **5️⃣ ¿Por Qué Elegir Ho-Hub?**

🔥 ¡Transforma tu torneo de Pokémon TCG en una experiencia profesional!

✅ **Automatización Completa** → No más hojas de cálculo ni registros manuales.  
✅ **Experiencia Intuitiva** → Rápido, fácil y eficiente.  
✅ **Integración Total** → Web y aplicación conectadas **100% en tiempo real**.  
✅ **Escalabilidad** → Administra **múltiples ligas y ciudades simultáneamente**.  
✅ **Seguridad** → **Autenticación mediante base de datos** para prevenir fraudes.  
✅ **Evolución Continua** → ¡**Nuevas funcionalidades agregadas constantemente!** 🚀

---

🚀 Tecnologías Utilizadas  
<div align="center">
📱 Móvil  
<img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg" height="50" alt="React Native" /> <img width="20" /> <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/firebase/firebase-plain.svg" height="50" alt="Firebase" /> <img width="20" /> <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/javascript/javascript-original.svg" height="50" alt="JavaScript" />
<br/><br/>

📌 Stack Móvil  
✅ React Native (Expo) → Framework para el desarrollo de la aplicación móvil, garantizando compatibilidad entre Android y iOS.  
✅ Firebase (Firestore, Auth, Notifications) → Gestiona la base de datos en tiempo real, autenticación segura y notificaciones push.  
✅ JavaScript (ES6+) → Lenguaje principal para la lógica de la aplicación y la comunicación con las APIs.

</div>
<div align="center">
🌐 Backend Web  
<img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg" height="50" alt="Python" /> <img width="20" /> <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/flask/flask-original.svg" height="50" alt="Flask" /> <img width="20" /> 
<img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/firebase/firebase-plain.svg" height="50" alt="Firebase" /> <img width="20" /> <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/html5/html5-original.svg" height="50" alt="HTML5" /> <img width="20" /> 
<img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/css3/css3-original.svg" height="50" alt="CSS3" /> <img width="20" /> 
<img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/javascript/javascript-original.svg" height="50" alt="JavaScript" />
<br/><br/>

📌 Stack Backend  
✅ Python → Lenguaje principal para el backend, garantizando eficiencia y escalabilidad.  
✅ Flask → Framework ligero y rápido para la creación de APIs REST y la comunicación entre web y móvil.  
✅ Firebase → Base de datos NoSQL en tiempo real utilizada para almacenar torneos, usuarios y partidos.  
✅ HTML5 y CSS3 → Construcción de una interfaz web responsiva.  
✅ JavaScript (ES6+) → Implementación de solicitudes asíncronas y comunicación con Firebase.

</div>

---

# 🚀 **Getting Started (Comenzando)**

### 🔧 **Requisitos Previos**  
Antes de comenzar, asegúrese de tener instalados:

✅ **Node.js** y **Expo CLI** → Para ejecutar la **aplicación móvil**.  
✅ **Python 3.x** → Para ejecutar el **backend en Flask**.  
✅ **Cuenta en Firebase** → Para configurar la **autenticación y el almacenamiento**.

---

### 📥 **Instalación**

1️⃣ **Clonar el repositorio:**
```bash
git clone https://github.com/seu-usuario/Ho-Hub.git
cd Ho-Hub
```

---

### 🖥️ **Configuración del Backend**  
1. Instale las dependencias:
   ```bash
   pip install -r requirements.txt
   ```
2. Configure las variables de entorno con las credenciales de **Firebase**.  
3. Ejecute el servidor Flask:
   ```bash
   python main_2.py
   ```

---

### 📱 **Configuración de la Aplicación Móvil**  
1. Instale las dependencias de **Expo**:
   ```bash
   npm install
   ```
2. Inicie el proyecto:
   ```bash
   expo start
   ```

---

## 📜 **Licencia**

🔓 Este proyecto está licenciado bajo la **[Licencia MIT](LICENSE)**, lo que permite el uso, modificación y distribución bajo los términos de la Licencia MIT.

---

## ☕ **Apoya el Proyecto**  
💡 ¿Te gusta **Ho-Hub**? Considera apoyarlo para que siga evolucionando.

<p align="center">
  <a href="https://picpay.me/marco.macedo10/0.5" target="_blank">
    <img src="https://img.shields.io/badge/💰%20Donar-PicPay-brightgreen?style=for-the-badge&logo=picpay">
  </a>
</p>

---

## Contacto

Si tiene dudas, sugerencias o desea contribuir, póngase en contacto:

<div align="center">
  <a href="https://www.linkedin.com/in/marcoauréliomacedoprado" target="_blank">
    <img src="https://img.shields.io/static/v1?message=LinkedIn&logo=linkedin&label=&color=0077B5&logoColor=white&labelColor=&style=plastic" height="36" alt="logo de LinkedIn" />
  </a>
  <a href="https://www.instagram.com/prado.marco1/" target="_blank">
    <img src="https://img.shields.io/static/v1?message=Instagram&logo=instagram&label=&color=E4405F&logoColor=white&labelColor=&style=plastic" height="36" alt="logo de Instagram" />
  </a>
  <a href="https://wa.me/5567996893356" target="_blank">
  <img src="https://img.shields.io/static/v1?message=Whatsapp&logo=whatsapp&label=&color=25D366&logoColor=white&labelColor=&style=plastic" height="36" alt="logo de Whatsapp" />
</a>
  <a href="https://discord.com/users/yourdiscordid" target="_blank">
    <img src="https://img.shields.io/static/v1?message=Discord&logo=discord&label=&color=7289DA&logoColor=white&labelColor=&style=plastic" height="36" alt="logo de Discord" />
  </a>
</div>
