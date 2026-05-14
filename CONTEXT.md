# Project Context: Rider Companion Backend

## Overview
The **Rider Companion Backend** is a NestJS-based application designed to support a mobile app for motorcycle riders. It handles authentication, profile management, ride coordination (rooms), and real-time location tracking for group rides.

## Tech Stack
- **Framework:** [NestJS](https://nestjs.com/) (Node.js)
- **Language:** TypeScript
- **Database:** MongoDB with [Mongoose](https://mongoosejs.com/)
- **Real-time:** Socket.IO for live location updates
- **Security:** JWT (Access + Refresh Tokens), Passport.js, Helmet, Class-validator
- **Documentation:** Swagger (OpenAPI) - accessible at `/docs`

## Core Modules & Functionality

### 1. Authentication (`src/auth`)
- **Flow:** Phone-number based OTP authentication.
- **Tokens:** Uses short-lived JWT Access Tokens (15 min) and long-lived Refresh Tokens (30 days).
- **OTP:** Fixed as `123456` for development/testing; logic ready for SMS integration.
- **Guards:** `JwtAuthGuard` protects REST routes and WebSocket connections.

### 2. User Management (`src/users`)
- **Profiles:** CRUD operations for user profiles (name, phone, avatar, bike info).
- **Safety:** Management of emergency contacts.
- **Schemas:** `UserSchema` stores basic info and an array of emergency contacts.

### 3. Ride Coordination (`src/rides`)
- **Ride Rooms:** Users can create, join, and leave rides.
- **Privacy:** Supports both Public and Private rides (via 8-character `inviteCode`).
- **Roles:** The creator is assigned as the `admin` of the ride.
- **Schemas:** `RideRoomSchema` tracks members, admin, and privacy settings.

### 4. Location Tracking (`src/tracking` & `src/websocket`)
- **Live Updates:** Real-time location broadcasting via Socket.IO.
- **Events:** 
  - `locationUpdate` (Client -> Server): Saves to DB and broadcasts to room.
  - `riderLocation` (Server -> Client): Broadcasts a rider's new location to others in the same ride.
  - `riderJoined` / `riderLeft`: Presence updates.
- **Validation:** Basic "GPS jump" rejection (ignores updates indicating impossible speeds > 300km/h).
- **History:** REST API to fetch location history for replay/analytics.

## Directory Structure
```text
src/
├── auth/           # OTP & JWT logic, Refresh token management
├── common/         # Shared guards, interfaces, and filters
├── config/         # Environment variable validation & config service
├── rides/          # Ride room creation and member management
├── schemas/        # Mongoose data models (User, Ride, Location, Session)
├── tracking/       # REST endpoints for location persistence & history
├── users/          # User profile and emergency contact logic
├── websocket/      # Socket.IO gateways for real-time features
├── app.module.ts   # Root module
└── main.ts         # App entry point (CORS, Helmet, Swagger, Validation)
```

## Key Workflows

### Starting a Ride
1. User logs in via OTP.
2. User creates a ride via `POST /rides` (becomes admin).
3. User shares `inviteCode` (if private) or others join via `POST /rides/:id/join`.
4. All members connect to WebSocket and emit `joinRide`.

### Live Tracking
1. App fetches initial state via `GET /tracking/live/:rideId`.
2. App sends periodic location via socket `locationUpdate`.
3. Server validates speed/location, saves to `Location` collection, and broadcasts `riderLocation` to the room.

## Current Limitations / TODOs
- No real SMS provider (OTP is static).
- No file storage for avatars (currently string URLs).
- SOS REST APIs not yet persistent.
- Redis adapter needed for horizontal Socket.IO scaling.
- Missing rate limiting and Docker configuration.
