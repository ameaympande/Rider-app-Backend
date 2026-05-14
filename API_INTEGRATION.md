# Rider Companion Backend API Integration Guide

This document describes the backend APIs currently implemented for frontend integration.

Base URL for local development:

```txt
http://localhost:3000
```

Swagger docs:

```txt
http://localhost:3000/docs
```

## Current Implementation Status

Built:

- Phone OTP auth
- JWT access token auth
- Refresh token sessions
- Protected user profile APIs
- Emergency contact API
- Ride room create/get/join/leave/member APIs
- Tracking save/live/history APIs
- Authenticated Socket.IO gateway
- Room-scoped live rider events
- Location validation and basic GPS jump rejection

Not built yet:

- Real SMS provider integration
- Avatar file upload storage
- Persistent SOS REST APIs
- Push notifications
- Redis socket adapter
- Rate limiting
- Docker setup
- Full integration/socket test coverage

## Authentication Model

Protected REST APIs require:

```txt
Authorization: Bearer ACCESS_TOKEN
```

Socket.IO connections require the same access token in either:

```ts
io(BASE_URL, {
  auth: {
    token: accessToken,
  },
});
```

or:

```txt
Authorization: Bearer ACCESS_TOKEN
```

Access tokens currently expire in 15 minutes. Refresh tokens currently expire in 30 days.

For local development and tests, OTP is fixed as:

```txt
123456
```

In production, the backend generates a random OTP, but SMS delivery is not integrated yet.

## Standard Error Shape

NestJS returns validation and auth errors in the default format, usually:

```json
{
  "message": "Invalid access token",
  "error": "Unauthorized",
  "statusCode": 401
}
```

Validation errors may return `message` as an array of strings.

## Auth APIs

### Send OTP

Requests an OTP for the phone number.

```http
POST /auth/send-otp
Content-Type: application/json
```

Request:

```json
{
  "phone": "+919999999999"
}
```

Response:

```json
{
  "success": true,
  "message": "OTP sent"
}
```

Frontend use:

- Call this when the user enters their phone number.
- Show OTP input after success.

### Verify OTP

Verifies the OTP, creates the user if the phone number is new, and returns tokens.

```http
POST /auth/verify-otp
Content-Type: application/json
```

Request:

```json
{
  "phone": "+919999999999",
  "otp": "123456"
}
```

Response:

```json
{
  "success": true,
  "accessToken": "jwt-access-token",
  "refreshToken": "refresh-token",
  "user": {
    "_id": "userId",
    "phone": "+919999999999",
    "emergencyContacts": [],
    "createdAt": "2026-05-09T00:00:00.000Z",
    "updatedAt": "2026-05-09T00:00:00.000Z"
  }
}
```

Frontend use:

- Save `accessToken` and `refreshToken`.
- Use `accessToken` for all protected REST and socket calls.
- If the returned user has no `name`, send them to profile completion.

### Refresh Token

Returns a new access token and refresh token. The old refresh token is revoked.

```http
POST /auth/refresh
Content-Type: application/json
```

Request:

```json
{
  "refreshToken": "refresh-token"
}
```

Response:

```json
{
  "accessToken": "new-jwt-access-token",
  "refreshToken": "new-refresh-token"
}
```

Frontend use:

- Call when an API returns `401 Unauthorized`.
- Replace both stored tokens after success.
- If refresh fails, log the user out.

## User APIs

### Create User

Creates a user profile manually.

```http
POST /users
Content-Type: application/json
```

Request:

```json
{
  "name": "Aman",
  "phone": "+919999999999",
  "bikeName": "KTM Duke 390"
}
```

Response:

```json
{
  "_id": "userId",
  "name": "Aman",
  "phone": "+919999999999",
  "bikeName": "KTM Duke 390",
  "emergencyContacts": [],
  "createdAt": "2026-05-09T00:00:00.000Z",
  "updatedAt": "2026-05-09T00:00:00.000Z"
}
```

Frontend use:

- Prefer OTP flow for login.
- Use this only if you need a separate profile creation screen before auth is finalized.

### Get My Profile

Returns the authenticated user profile.

```http
GET /users/me
Authorization: Bearer ACCESS_TOKEN
```

Response:

```json
{
  "_id": "userId",
  "name": "Aman",
  "phone": "+919999999999",
  "avatar": "https://example.com/avatar.jpg",
  "bikeName": "KTM Duke 390",
  "emergencyContacts": [
    {
      "name": "Rahul",
      "phone": "+919999999999"
    }
  ],
  "createdAt": "2026-05-09T00:00:00.000Z",
  "updatedAt": "2026-05-09T00:00:00.000Z"
}
```

Frontend use:

- Call after app start if an access token exists.
- Use to hydrate account/profile state.

### Update My Profile

Updates the authenticated user profile.

```http
PATCH /users/me
Authorization: Bearer ACCESS_TOKEN
Content-Type: application/json
```

Request:

```json
{
  "name": "Aman",
  "bikeName": "KTM Duke 390",
  "avatar": "https://example.com/avatar.jpg"
}
```

All fields are optional.

Response:

```json
{
  "_id": "userId",
  "name": "Aman",
  "phone": "+919999999999",
  "avatar": "https://example.com/avatar.jpg",
  "bikeName": "KTM Duke 390",
  "emergencyContacts": [],
  "createdAt": "2026-05-09T00:00:00.000Z",
  "updatedAt": "2026-05-09T00:00:00.000Z"
}
```

Frontend use:

- Use for profile completion and profile edit screens.
- Avatar is currently a string URL. File upload is not implemented yet.

### Add Emergency Contact

Adds an emergency contact to the authenticated user.

```http
POST /users/emergency-contact
Authorization: Bearer ACCESS_TOKEN
Content-Type: application/json
```

Request:

```json
{
  "name": "Rahul",
  "phone": "+919999999999"
}
```

Response:

```json
{
  "_id": "userId",
  "name": "Aman",
  "phone": "+919999999999",
  "emergencyContacts": [
    {
      "name": "Rahul",
      "phone": "+919999999999"
    }
  ]
}
```

Frontend use:

- Use from safety settings.
- Backend currently supports adding contacts, not deleting/editing contacts.

## Ride APIs

All ride APIs require:

```txt
Authorization: Bearer ACCESS_TOKEN
```

### Create Ride

Creates a ride room. The authenticated user becomes the admin and first member.

```http
POST /rides
Authorization: Bearer ACCESS_TOKEN
Content-Type: application/json
```

Request:

```json
{
  "name": "Lonavala Ride",
  "destination": "Lonavala",
  "isPrivate": true
}
```

Response:

```json
{
  "_id": "rideId",
  "name": "Lonavala Ride",
  "destination": "Lonavala",
  "adminId": "userId",
  "isPrivate": true,
  "inviteCode": "A1B2C3D4",
  "members": ["userId"],
  "createdAt": "2026-05-09T00:00:00.000Z",
  "updatedAt": "2026-05-09T00:00:00.000Z"
}
```

Frontend use:

- Store `_id` as `rideId`.
- Show `inviteCode` to the admin for private ride invites.
- Join the socket room with this `rideId`.

### Get Ride

Returns ride room details.

```http
GET /rides/:rideId
Authorization: Bearer ACCESS_TOKEN
```

Response:

```json
{
  "_id": "rideId",
  "name": "Lonavala Ride",
  "destination": "Lonavala",
  "adminId": "userId",
  "isPrivate": true,
  "inviteCode": "A1B2C3D4",
  "members": ["userId"],
  "createdAt": "2026-05-09T00:00:00.000Z",
  "updatedAt": "2026-05-09T00:00:00.000Z"
}
```

Frontend use:

- Load ride metadata before opening the live tracking screen.

### Join Ride

Adds the authenticated user to a ride room.

```http
POST /rides/:rideId/join
Authorization: Bearer ACCESS_TOKEN
Content-Type: application/json
```

Request for private ride:

```json
{
  "inviteCode": "A1B2C3D4"
}
```

Request for public ride:

```json
{}
```

Response:

```json
{
  "_id": "rideId",
  "name": "Lonavala Ride",
  "members": ["adminUserId", "joinedUserId"]
}
```

Frontend use:

- Call before joining the socket room.
- For private rides, ask user for invite code.
- If user is already a member, backend returns the ride without duplicating them.

### Leave Ride

Removes the authenticated user from the ride members list.

```http
POST /rides/:rideId/leave
Authorization: Bearer ACCESS_TOKEN
```

Response:

```json
{
  "_id": "rideId",
  "members": ["remainingUserId"]
}
```

Frontend use:

- Call when the rider leaves the ride.
- Then emit `leaveRide` on socket or disconnect from the ride screen.
- Ride admin cannot leave currently.

### Get Ride Members

Returns populated member records.

```http
GET /rides/:rideId/members
Authorization: Bearer ACCESS_TOKEN
```

Response:

```json
[
  {
    "_id": "userId",
    "name": "Aman",
    "phone": "+919999999999",
    "bikeName": "KTM Duke 390"
  }
]
```

Frontend use:

- Use for rider list, map sidebar, and participant count.

### Remove Rider

Admin-only endpoint to remove a rider from the room.

```http
DELETE /rides/:rideId/members/:userId
Authorization: Bearer ACCESS_TOKEN
```

Response:

```json
{
  "_id": "rideId",
  "members": ["adminUserId"]
}
```

Frontend use:

- Show this action only to ride admin.
- Admin cannot remove themselves.

## Tracking APIs

All tracking APIs require:

```txt
Authorization: Bearer ACCESS_TOKEN
```

The authenticated user must be a member of the ride.

### Save Location

Stores the authenticated rider's current location.

```http
POST /tracking/location
Authorization: Bearer ACCESS_TOKEN
Content-Type: application/json
```

Request:

```json
{
  "rideId": "rideId",
  "lat": 18.5204,
  "lng": 73.8567,
  "speed": 72,
  "heading": 180,
  "battery": 80,
  "status": "RIDING"
}
```

Field validation:

- `rideId`: MongoDB ObjectId
- `lat`: valid latitude
- `lng`: valid longitude
- `speed`: optional, 0 to 250 km/h
- `heading`: optional, 0 to 360
- `battery`: optional, 0 to 100
- `status`: optional, one of `RIDING`, `STOPPED`, `OFFLINE`, `SOS`

Response:

```json
{
  "_id": "locationId",
  "rideId": "rideId",
  "userId": "userId",
  "lat": 18.5204,
  "lng": 73.8567,
  "speed": 72,
  "heading": 180,
  "battery": 80,
  "status": "RIDING",
  "createdAt": "2026-05-09T00:00:00.000Z",
  "updatedAt": "2026-05-09T00:00:00.000Z"
}
```

Frontend use:

- Prefer socket `locationUpdate` during live ride.
- Use this REST endpoint as fallback if socket is disconnected.
- Do not send duplicate location updates.

Backend rejects:

- Invalid coordinates
- Invalid speed/heading/battery values
- Duplicate location updates
- Impossible GPS jumps above roughly 300 km/h calculated from the previous point

### Get Live Riders

Returns the latest location for each rider in a ride.

```http
GET /tracking/live/:rideId
Authorization: Bearer ACCESS_TOKEN
```

Response:

```json
[
  {
    "_id": "locationId",
    "rideId": "rideId",
    "userId": "userId",
    "lat": 18.5204,
    "lng": 73.8567,
    "speed": 72,
    "heading": 180,
    "battery": 80,
    "status": "RIDING",
    "createdAt": "2026-05-09T00:00:00.000Z"
  }
]
```

Frontend use:

- Call once when opening the ride map to hydrate initial marker positions.
- Then listen to socket `riderLocation` for live updates.

### Get Location History

Returns location history for a ride, optionally filtered by rider and date range.

```http
GET /tracking/history/:rideId?userId=:userId&startDate=:isoDate&endDate=:isoDate
Authorization: Bearer ACCESS_TOKEN
```

Example:

```txt
GET /tracking/history/rideId?userId=userId&startDate=2026-05-09T00:00:00.000Z&endDate=2026-05-09T23:59:59.999Z
```

Response:

```json
[
  {
    "_id": "locationId",
    "rideId": "rideId",
    "userId": "userId",
    "lat": 18.5204,
    "lng": 73.8567,
    "speed": 72,
    "heading": 180,
    "battery": 80,
    "status": "RIDING",
    "createdAt": "2026-05-09T00:00:00.000Z"
  }
]
```

Frontend use:

- Use for ride replay, route polyline, and ride analytics screens.

## Socket.IO Integration

Socket endpoint:

```txt
http://localhost:3000
```

Install client:

```sh
npm install socket.io-client
```

Frontend connection example:

```ts
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  auth: {
    token: accessToken,
  },
  transports: ['websocket'],
});

socket.on('connect', () => {
  socket.emit('joinRide', {
    rideId,
  });
});
```

Important:

- Do not send `userId` from frontend for socket identity.
- Backend derives `userId` from the JWT.
- User must already be a ride member before `joinRide` succeeds.

## Client To Server Socket Events

### joinRide

Joins the socket room for a ride.

```ts
socket.emit('joinRide', {
  rideId: 'rideId',
});
```

Server emits:

```ts
socket.on('riderJoined', (payload) => {
  // payload: { userId: string }
});
```

Frontend use:

- Emit after joining/creating a ride via REST.
- Use `riderJoined` to update rider presence UI.

### leaveRide

Leaves the socket room.

```ts
socket.emit('leaveRide', {
  rideId: 'rideId',
});
```

Server emits:

```ts
socket.on('riderLeft', (payload) => {
  // payload: { userId: string }
});
```

Frontend use:

- Emit when leaving the ride tracking screen.

### locationUpdate

Saves and broadcasts the rider location.

```ts
socket.emit('locationUpdate', {
  rideId: 'rideId',
  lat: 18.5204,
  lng: 73.8567,
  speed: 72,
  heading: 180,
  battery: 80,
  status: 'RIDING',
});
```

Server emits:

```ts
socket.on('riderLocation', (payload) => {
  // payload:
  // {
  //   rideId: string;
  //   userId: string;
  //   lat: number;
  //   lng: number;
  //   speed?: number;
  //   heading?: number;
  //   battery?: number;
  //   status: string;
  //   createdAt: string;
  // }
});
```

Frontend use:

- Emit location at a battery-conscious interval.
- Recommended starting interval: 3 to 5 seconds during active ride.
- Increase interval when stationary or app is backgrounded.
- Use `riderLocation` to update map markers.

### speedUpdate

Broadcasts speed separately.

```ts
socket.emit('speedUpdate', {
  rideId: 'rideId',
  speed: 72,
});
```

Server emits:

```ts
socket.on('riderSpeed', (payload) => {
  // payload: { rideId: string; userId: string; speed: number }
});
```

Frontend use:

- Optional if `locationUpdate` already includes speed.
- Useful for lightweight dashboard updates.

### riderStatus

Broadcasts rider status.

```ts
socket.emit('riderStatus', {
  rideId: 'rideId',
  status: 'STOPPED',
});
```

Server emits:

```ts
socket.on('rideUpdated', (payload) => {
  // payload: { rideId: string; userId: string; status: string }
});
```

Frontend use:

- Use for `RIDING`, `STOPPED`, `OFFLINE`, or similar status UI.

### emergencySOS

Broadcasts an emergency alert to the ride room.

```ts
socket.emit('emergencySOS', {
  rideId: 'rideId',
  message: 'Accident',
});
```

Server emits:

```ts
socket.on('emergencyAlert', (payload) => {
  // payload: { rideId: string; userId: string; message: string }
});
```

Frontend use:

- Show an urgent in-ride alert.
- This is currently websocket-only and is not persisted yet.

## Server To Client Socket Events

Listen for:

```ts
socket.on('riderJoined', handleRiderJoined);
socket.on('riderLeft', handleRiderLeft);
socket.on('riderLocation', handleRiderLocation);
socket.on('riderSpeed', handleRiderSpeed);
socket.on('rideUpdated', handleRideUpdated);
socket.on('emergencyAlert', handleEmergencyAlert);
socket.on('error', handleSocketError);
```

Socket error payload:

```json
{
  "message": "Invalid location payload"
}
```

## Suggested Frontend Flow

### Login Flow

1. User enters phone.
2. Call `POST /auth/send-otp`.
3. User enters OTP.
4. Call `POST /auth/verify-otp`.
5. Store `accessToken` and `refreshToken`.
6. Call `GET /users/me`.
7. If profile is incomplete, call `PATCH /users/me`.

### Create Ride Flow

1. Call `POST /rides`.
2. Store returned `rideId`.
3. Connect socket with `accessToken`.
4. Emit `joinRide`.
5. Call `GET /tracking/live/:rideId` for initial map state.
6. Start location updates through socket `locationUpdate`.

### Join Ride Flow

1. User enters invite code or opens invite link.
2. Call `POST /rides/:rideId/join`.
3. Connect socket with `accessToken`.
4. Emit `joinRide`.
5. Call `GET /tracking/live/:rideId`.
6. Start map updates from `riderLocation`.

### Live Tracking Flow

1. Hydrate current markers with `GET /tracking/live/:rideId`.
2. Listen to `riderLocation`.
3. Send own location through `locationUpdate`.
4. On disconnect, show offline/reconnecting UI.
5. On reconnect, emit `joinRide` again.

## Frontend TypeScript Types

```ts
export type RiderStatus = 'RIDING' | 'STOPPED' | 'OFFLINE' | 'SOS';

export type User = {
  _id: string;
  name?: string;
  phone: string;
  avatar?: string;
  bikeName?: string;
  emergencyContacts: EmergencyContact[];
  createdAt: string;
  updatedAt: string;
};

export type EmergencyContact = {
  name: string;
  phone: string;
};

export type Ride = {
  _id: string;
  name: string;
  destination?: string;
  adminId: string;
  isPrivate: boolean;
  inviteCode: string;
  members: string[];
  createdAt: string;
  updatedAt: string;
};

export type RiderLocation = {
  _id?: string;
  rideId: string;
  userId: string;
  lat: number;
  lng: number;
  speed?: number;
  heading?: number;
  battery?: number;
  status: RiderStatus;
  createdAt?: string;
  updatedAt?: string;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};
```

## Axios Setup Example

```ts
import axios from 'axios';

export const api = axios.create({
  baseURL: 'http://localhost:3000',
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});
```

## Token Refresh Example

```ts
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status !== 401) {
      throw error;
    }

    const refreshToken = getRefreshToken();
    const response = await axios.post('http://localhost:3000/auth/refresh', {
      refreshToken,
    });

    saveTokens(response.data.accessToken, response.data.refreshToken);

    error.config.headers.Authorization = `Bearer ${response.data.accessToken}`;
    return api.request(error.config);
  },
);
```

## Location Update Recommendations

Recommended initial client behavior:

- Send every 3 to 5 seconds while moving.
- Send immediately when heading changes significantly.
- Reduce frequency when speed is near 0.
- Include battery percentage when available.
- Do not send location if permission is denied.
- Stop updates when user leaves ride.

Avoid:

- Sending `userId` from the client for identity.
- Sending global location events outside a ride room.
- Sending duplicate coordinates repeatedly.
- Sending location before `joinRide` succeeds.

## Environment Variables Used By Backend

```txt
PORT=3000
MONGO_URI=mongodb+srv://...
JWT_SECRET=change-this-secret
CORS_ORIGIN=http://localhost:5173,http://localhost:3001
NODE_ENV=development
```

Notes:

- `JWT_SECRET` should be set for any shared environment.
- If `CORS_ORIGIN` is not set, the backend currently allows all origins.

