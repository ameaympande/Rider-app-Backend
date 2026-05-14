# 🏍️ Rider Companion Backend

The server-side application for the **Rider Companion** mobile app. Built with NestJS, this backend manages authentication, group ride rooms, and real-time location tracking for motorcycle riders.

## 🚀 Overview

This backend provides:
- **Authentication:** Phone-based OTP with JWT session management.
- **Ride Management:** Create and join public/private ride rooms.
- **Real-time Tracking:** Live location sharing via WebSockets (Socket.IO).
- **History:** Persistent storage of ride paths and rider telemetry.

---

## 📚 Documentation

For a deep dive into how the application works, please refer to:

- [**APP_GUIDE.md**](./APP_GUIDE.md) - **Start Here!** Comprehensive overview of features, architecture, and workflows.
- [**CONTEXT.md**](./CONTEXT.md) - Technical context for developers and AI assistants.
- [**API_INTEGRATION.md**](./API_INTEGRATION.md) - Detailed guide for frontend integration and socket events.

---

## 🛠️ Project Setup

### Prerequisites
- Node.js (v18+)
- MongoDB

### Installation
```bash
$ npm install
```

### Configuration
Create a `.env` file in the root directory (refer to `.env.example`):
```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/rider_app
JWT_SECRET=your_secret_key
REFRESH_SECRET=your_refresh_secret
```

### Running the App
```bash
# development
$ npm run start:dev

# production mode
$ npm run start:prod
```

### API Documentation
Once the server is running, visit:
`http://localhost:3000/docs`

---

## 🏗️ Tech Stack
- **Framework:** NestJS
- **Database:** MongoDB (Mongoose)
- **Real-time:** Socket.IO
- **Language:** TypeScript

---

## 📄 License
Nest is [MIT licensed](LICENSE).

