# 🏍️ Rider Companion App: Comprehensive Overview

Welcome to the **Rider Companion Backend**. This document provides a complete explanation of the application, its architecture, core features, and technical implementation.

---

## 📖 Introduction
The Rider Companion app is designed for motorcycle enthusiasts who ride in groups. The backend serves as the central hub for user authentication, profile management, group ride coordination (ride rooms), and real-time GPS tracking.

---

## ✨ Core Features

### 1. Secure Authentication
- **Phone-based OTP:** Users log in using their phone numbers and a one-time password (OTP).
- **JWT Session Management:** Uses secure JSON Web Tokens (JWT) with Access and Refresh token logic for seamless, secure sessions.
- **Persistent Sessions:** Support for multiple devices with token rotation.

### 2. User & Safety Management
- **Profiles:** Custom profiles with names, bike information, and avatars.
- **Emergency Contacts:** Users can store emergency contacts for quick access during incidents.
- **Privacy:** User data is protected by JWT guards across all sensitive endpoints.

### 3. Ride Coordination (Ride Rooms)
- **Room Creation:** Riders can create public or private "Ride Rooms".
- **Invite Codes:** Private rooms generate a unique 8-character code for secure invites.
- **Member Management:** Admins can manage riders, and users can join/leave rides.
- **Ride Metadata:** Tracks destination, start times, and participant lists.

### 4. Real-time Tracking & Safety
- **Live GPS Broadcasting:** Real-time location sharing via WebSockets (Socket.IO).
- **Ride Dashboard:** Live "Who's where" view for all members of a ride.
- **Validation:** Intelligent location validation (GPS jump rejection) to filter out impossible speed updates (>300km/h).
- **Location History:** Persistent storage of ride paths for post-ride replay and analytics.

---

## 🛠️ Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Framework** | [NestJS](https://nestjs.com/) (Node.js) |
| **Language** | TypeScript |
| **Database** | MongoDB with [Mongoose](https://mongoosejs.com/) |
| **Real-time** | Socket.IO (WebSockets) |
| **Security** | Passport.js, JWT, Helmet |
| **Validation** | Class-validator, Class-transformer |
| **Documentation** | Swagger / OpenAPI |

---

## 📂 Project Structure

```text
src/
├── auth/           # Authentication logic (OTP, JWT, Refresh Tokens)
├── common/         # Shared guards (JwtAuth), filters, and interfaces
├── config/         # Environment variable validation and Config Service
├── rides/          # Ride room CRUD and member management logic
├── schemas/        # Mongoose Data Models (User, Ride, Location, Session)
├── tracking/       # REST endpoints for location history and persistence
├── users/          # Profile management and emergency contact logic
├── websocket/      # Socket.IO Gateway for real-time location events
├── app.module.ts   # Root module connecting all components
└── main.ts         # Application entry point & global configurations
```

---

## 🔄 Key Workflows

### 1. User Onboarding
1. User requests OTP via `POST /auth/send-otp`.
2. User verifies OTP via `POST /auth/verify-otp`.
3. System returns `accessToken`, `refreshToken`, and user profile.
4. User updates profile (name, bike) via `PATCH /users/me`.

### 2. Starting a Group Ride
1. **Admin** creates a ride via `POST /rides`.
2. **Admin** shares the `inviteCode` (for private rides).
3. **Riders** join via `POST /rides/:id/join`.
4. All participants connect to the WebSocket and emit `joinRide`.

### 3. Live Tracking Loop
1. The app emits `locationUpdate` via socket every few seconds.
2. The server:
    - Validates the rider is in the room.
    - Validates the coordinate accuracy.
    - Saves to the `Location` collection.
    - Broadcasts `riderLocation` to everyone else in the room.
3. Participants receive `riderLocation` and update their maps.

---

## 📡 API & Real-time Summary

### REST Endpoints
- **Auth:** `/auth/send-otp`, `/auth/verify-otp`, `/auth/refresh`
- **Users:** `/users/me`, `/users/emergency-contact`
- **Rides:** `/rides` (CRUD), `/rides/:id/join`, `/rides/:id/members`
- **Tracking:** `/tracking/location`, `/tracking/live/:rideId`, `/tracking/history/:rideId`

### Socket Events
- **Client -> Server:** `joinRide`, `leaveRide`, `locationUpdate`
- **Server -> Client:** `riderJoined`, `riderLeft`, `riderLocation`

> [!TIP]
> Complete API documentation is available via Swagger at `http://localhost:3000/docs` when the server is running.

---

## 🚀 Getting Started

1. **Environment:** Copy `.env.example` to `.env` and configure your `MONGODB_URI` and `JWT_SECRET`.
2. **Install:** `npm install`
3. **Run:** `npm run start:dev`
4. **Test:** `npm run test`

---

## 🗺️ Future Roadmap
- [ ] Integration with a real SMS provider (Twilio/AWS SNS).
- [ ] AWS S3 integration for avatar file uploads.
- [ ] Redis adapter for horizontal scaling of WebSockets.
- [ ] Push notifications for "SOS" alerts.
- [ ] Dockerization for easy deployment.
