# Backend Additions Required for Full Join Flow

## 1. Find Ride by Invite Code (REQUIRED)

Currently, `POST /rides/:rideId/join` requires the `rideId` in the URL.
But riders only share a short 8-character invite code (e.g. `A1B2C3D4`).
There is no way for a joining rider to know the `rideId` from just the code.

### Add this endpoint:

```http
GET /rides/code/:inviteCode
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

Error if not found:
```json
{ "statusCode": 404, "message": "Ride not found" }
```

### NestJS Implementation Hint:

In `rides.controller.ts`, add **before** the `/:rideId` route to avoid conflict:

```ts
@Get('code/:inviteCode')
@UseGuards(JwtAuthGuard)
findByCode(@Param('inviteCode') inviteCode: string) {
  return this.ridesService.findByInviteCode(inviteCode);
}
```

In `rides.service.ts`:

```ts
async findByInviteCode(inviteCode: string): Promise<Ride> {
  const ride = await this.rideModel.findOne({ inviteCode }).exec();
  if (!ride) throw new NotFoundException('Ride not found');
  return ride;
}
```

---

## 2. (Optional) Deep Link / Share Link

To make sharing even easier, in the future add a shareable link like:

```
ridercompanion://join/A1B2C3D4
```

or:

```
https://ridercompanion.app/join/A1B2C3D4
```

This is not required for the current in-app flow.

---

## Summary Table

| Feature                     | Status       | Action Needed                       |
|-----------------------------|--------------|-------------------------------------|
| Create Ride                 | ✅ Built      | None                                |
| Join by rideId + code       | ✅ Built      | None                                |
| **Lookup ride by code only**| ❌ Missing   | Add `GET /rides/code/:inviteCode`   |
| Share location via socket   | ✅ Built      | None                                |
| See other riders on map     | ✅ Built      | None                                |
