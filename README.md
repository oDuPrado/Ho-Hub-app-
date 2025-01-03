# **App_torneios_Pokemon**

---

## **Overview**

**App_torneios_Pokemon** is a mobile application designed to enhance the user experience of the **QRCodeDrivenTournament** system. It serves as a remote companion for players, providing a streamlined platform for reporting match results, tracking tournaments, and accessing real-time updates directly from their devices.

The app seamlessly integrates with the backend system of **QRCodeDrivenTournament**, leveraging its functionalities while providing a responsive and modern interface for players. With the app, players can view their statistics, manage deck lists, and receive personalized notifications for their matches.

---

## **Features**

### **Player Features**

1. **Match Reporting**:

   - Players can report their match results directly from their mobile devices using unique IDs and PINs.

2. **Tournament Tracking**:

   - Real-time updates for ongoing tournaments, including tables, match results, and round status.

3. **Deck Management**:

   - Create, edit, and manage deck lists with detailed information about Pokémon, trainers, and energy cards.

4. **Personal Statistics**:

   - Track performance statistics such as win rate, total matches played, and unique titles unlocked.

5. **Notifications**:

   - Receive push notifications for round updates, table assignments, and important announcements.

6. **Titles and Achievements**:
   - Unlock achievements and view personalized titles based on in-game performance.

---

## **Integration with QRCodeDrivenTournament**

The app is fully integrated with the **QRCodeDrivenTournament** backend, ensuring real-time synchronization of tournament data. The connection allows players to:

- Access match results and table assignments instantly.
- Report discrepancies or finalize matches via mobile.
- Utilize QR codes generated by the backend for seamless table identification.

The backend system continues to provide centralized tournament management, while the app acts as a dedicated interface for players.

---

## **Tech Stack**

### **Mobile App**

- **Framework**: React Native (Expo)
- **Backend**: Firebase (Firestore, Auth, Notifications)
- **Design**: Responsive UI with modern Material Design principles

### **Backend System**

- Python (Flask)
- QR Code generation
- Real-time data synchronization via Firebase

---

## **Getting Started**

### **Prerequisites**

Ensure you have Node.js and Expo CLI installed on your system. Use the following commands to check:

---

Usage

1. Player Login
   Players log in using their unique IDs and PINs, which are synchronized with the QRCodeDrivenTournament backend.
2. Manage Decks
   Add new decks or edit existing ones using the app's built-in deck editor.
   Decks are saved to the Firebase backend for future reference.
3. Track Matches
   View real-time updates for assigned tables, opponents, and match results.
   Use notifications to stay updated on tournament progress.
4. Unlock Achievements
   Earn unique titles and achievements based on tournament performance.
   View progress and milestones directly in the app.

---

<div align="center"> <p>If you find this project helpful and would like to support further development, consider donating:</p> <a href="https://picpay.me/marco.macedo10/0.5" target="_blank"> <img src="https://img.shields.io/badge/Donate-PicPay-brightgreen?style=plastic&logo=amazonpay&logoColor=white" alt="Donate with PicPay" height="36" /> </a> </div>

---

License

This project is licensed under the MIT License. See the LICENSE file for more details.
