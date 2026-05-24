# 🏍️ Frontend Integration Guide: Live Ride-Sharing Location Tracking

This guide details how to integrate real-time location tracking, rider presence updates, and live sharing features in the **Rider Companion React Native** application.

---

## 📡 1. Socket.IO Connection Setup

Establish a Socket.IO connection using your auth token. The socket requires the token in the `auth` handshake configuration.

```typescript
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:3000'; // Replace with your backend URL

export const createRideSocket = (token: string): Socket => {
  return io(SOCKET_URL, {
    auth: {
      token,
    },
    transports: ['websocket'],
    autoConnect: false,
  });
};
```

---

## 🔄 2. Real-Time Socket Events Flow

Here is the life-cycle flow for real-time tracking:

### Join Flow
1. **Join Socket Room:** Client emits `joinRide` with `{ rideId }`.
2. **Receive Initial State:** Client immediately receives a single `liveRiders` event containing the list of all riders, their profile details, sharing status, and latest locations.
3. **Presence:** Other riders in the room receive the `user_joined` (alias: `riderJoined`) event.

### Tracking Flow
* **Start Sharing Location:** Client emits `startSharing` with `{ rideId }`. Other riders receive `sharing_started`.
* **Send Location Update:** Client periodically emits `locationUpdate` with coordinate details. Other riders receive `location_update` (alias: `riderLocation`).
* **Update Speed/Status:** Client emits `speedUpdate` or `riderStatus`. Other riders receive `riderSpeed` or `rideUpdated`.
* **SOS Alert:** Client emits `emergencySOS`. Other riders receive `emergencyAlert`.
* **Stop Sharing Location:** Client emits `stopSharing` with `{ rideId }`. Other riders receive `sharing_stopped`.
* **Leave Room:** Client emits `leaveRide` with `{ rideId }`. Other riders receive `user_left` (alias: `riderLeft`).

---

## 🧑‍💻 3. React Native Hook: `useLiveRide`

Use this React hook in your `RideRoomScreen` to manage live coordinates, speed metrics, and rider presence.

```typescript
import { useEffect, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';
import { createRideSocket } from '../utils/socket'; // Adjust path

export interface Rider {
  user: {
    _id: string;
    name: string;
    phone: string;
    avatar?: string;
    bikeName?: string;
    isOnline: boolean;
    lastActive?: string;
    emergencyContacts: Array<{ name: string; phone: string }>;
  };
  isSharing: boolean;
  location: {
    lat: number;
    lng: number;
    accuracy?: number;
    speed: number;
    heading: number;
    battery: number;
    status: string;
    createdAt: string;
  } | null;
}

export const useLiveRide = (rideId: string, token: string) => {
  const [riders, setRiders] = useState<Rider[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isCurrentlySharing, setIsCurrentlySharing] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // 1. Initialize socket connection
    const socket = createRideSocket(token);
    socketRef.current = socket;

    socket.connect();

    socket.on('connect', () => {
      setIsConnected(true);
      // 2. Join the ride room
      socket.emit('joinRide', { rideId });
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    // 3. Listen for initial state of all riders
    socket.on('liveRiders', (initialRiders: Rider[]) => {
      setRiders(initialRiders);
    });

    // 4. Update presence: Rider joined
    socket.on('user_joined', ({ userId }) => {
      setRiders((prev) =>
        prev.map((r) =>
          r.user._id === userId
            ? { ...r, user: { ...r.user, isOnline: true } }
            : r
        )
      );
    });

    // 5. Update presence: Rider left the room
    socket.on('user_left', ({ userId }) => {
      setRiders((prev) =>
        prev.map((r) =>
          r.user._id === userId
            ? { ...r, user: { ...r.user, isOnline: false }, isSharing: false, location: null }
            : r
        )
      );
    });

    // 6. Rider went offline/disconnected
    socket.on('user_offline', ({ userId }) => {
      setRiders((prev) =>
        prev.map((r) =>
          r.user._id === userId
            ? { ...r, user: { ...r.user, isOnline: false } }
            : r
        )
      );
    });

    // 7. Rider started sharing location
    socket.on('sharing_started', ({ userId }) => {
      setRiders((prev) =>
        prev.map((r) =>
          r.user._id === userId ? { ...r, isSharing: true } : r
        )
      );
    });

    // 8. Rider stopped sharing location
    socket.on('sharing_stopped', ({ userId }) => {
      setRiders((prev) =>
        prev.map((r) =>
          r.user._id === userId ? { ...r, isSharing: false, location: null } : r
        )
      );
    });

    // 9. Rider location updated
    socket.on('location_update', (updatedLoc) => {
      setRiders((prev) =>
        prev.map((r) =>
          r.user._id === updatedLoc.userId
            ? {
                ...r,
                location: {
                  lat: updatedLoc.lat,
                  lng: updatedLoc.lng,
                  accuracy: updatedLoc.accuracy,
                  speed: updatedLoc.speed,
                  heading: updatedLoc.heading,
                  battery: updatedLoc.battery,
                  status: updatedLoc.status,
                  createdAt: updatedLoc.createdAt,
                },
              }
            : r
        )
      );
    });

    // 10. Rider speed updated
    socket.on('riderSpeed', ({ userId, speed }) => {
      setRiders((prev) =>
        prev.map((r) =>
          r.user._id === userId && r.location
            ? { ...r, location: { ...r.location, speed } }
            : r
        )
      );
    });

    // 11. Rider custom status updated (e.g. STOPPED, RIDING)
    socket.on('rideUpdated', ({ userId, status }) => {
      setRiders((prev) =>
        prev.map((r) =>
          r.user._id === userId && r.location
            ? { ...r, location: { ...r.location, status } }
            : r
        )
      );
    });

    // 12. Emergency SOS Alert
    socket.on('emergencyAlert', ({ userId, message }) => {
      alert(`⚠️ SOS Alert from rider! Message: ${message}`);
    });

    socket.on('error', (err) => {
      console.error('Socket error:', err);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.emit('leaveRide', { rideId });
        socketRef.current.disconnect();
      }
    };
  }, [rideId, token]);

  // Actions
  const startSharing = () => {
    if (socketRef.current) {
      socketRef.current.emit('startSharing', { rideId });
      setIsCurrentlySharing(true);
    }
  };

  const stopSharing = () => {
    if (socketRef.current) {
      socketRef.current.emit('stopSharing', { rideId });
      setIsCurrentlySharing(false);
    }
  };

  const updateLocation = (coords: {
    lat: number;
    lng: number;
    accuracy?: number;
    speed: number;
    heading: number;
    battery: number;
    status: string;
  }) => {
    if (socketRef.current && isCurrentlySharing) {
      socketRef.current.emit('locationUpdate', {
        rideId,
        ...coords,
      });
    }
  };

  const triggerSOS = (message?: string) => {
    if (socketRef.current) {
      socketRef.current.emit('emergencySOS', { rideId, message });
    }
  };

  return {
    riders,
    isConnected,
    isCurrentlySharing,
    startSharing,
    stopSharing,
    updateLocation,
    triggerSOS,
  };
};
```

---

## 🗺️ 4. Rendering Riders on Map & List

Render markers dynamically in your React Native MapView and list card elements:

### Map Integration
```tsx
import MapView, { Marker } from 'react-native-maps';
import { View, Image } from 'react-native';

// Inside your component render:
<MapView style={{ flex: 1 }}>
  {riders
    .filter((r) => r.isSharing && r.location)
    .map((rider) => (
      <Marker
        key={rider.user._id}
        coordinate={{
          latitude: rider.location!.lat,
          longitude: rider.location!.lng,
        }}
        title={rider.user.name}
        description={`Speed: ${Math.round(rider.location!.speed)} km/h | Bike: ${rider.user.bikeName || 'N/A'}`}
      >
        {/* Customized Rider Marker */}
        <View style={{ width: 40, height: 40, borderRadius: 20, overflow: 'hidden', borderWidth: 2, borderColor: '#4CAF50' }}>
          <Image
            source={{ uri: rider.user.avatar || 'https://via.placeholder.com/150' }}
            style={{ width: '100%', height: '100%' }}
          />
        </View>
      </Marker>
    ))}
</MapView>
```

### Riders List (e.g. bottom sheet)
```tsx
import { FlatList, Text, View } from 'react-native';

<FlatList
  data={riders}
  keyExtractor={(item) => item.user._id}
  renderItem={({ item }) => (
    <View style={{ flexDirection: 'row', padding: 12, alignItems: 'center' }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: item.user.isOnline ? 'green' : 'grey', marginRight: 8 }} />
      <Text style={{ fontWeight: 'bold' }}>{item.user.name}</Text>
      <Text style={{ marginLeft: 8 }}>({item.user.bikeName || 'No Bike Info'})</Text>
      
      <Text style={{ marginLeft: 'auto', color: item.isSharing ? 'green' : 'gray' }}>
        {item.isSharing 
          ? `${Math.round(item.location?.speed || 0)} km/h (⚡ ${item.location?.battery || 0}%)` 
          : 'Offline'}
      </Text>
    </View>
  )}
/>
```

---

## 🏃 5. Location Tracking Implementation (Expo Location Example)

To periodically track user location and send updates to the socket server, use `expo-location` (for foreground and background tracking):

```typescript
import * as Location from 'expo-location';
import * as Battery from 'expo-battery';

export const startLocationTracking = async (
  onLocationUpdate: (coords: any) => void
) => {
  // 1. Request foreground permission
  const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
  if (fgStatus !== 'granted') {
    console.error('Foreground location permission denied');
    return;
  }

  // 2. Query initial battery levels
  const batteryLevel = await Battery.getBatteryLevelAsync();
  const batteryPercent = Math.round(batteryLevel * 100);

  // 3. Track foreground location updates
  await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 5000, // every 5 seconds
      distanceInterval: 10, // or every 10 meters
    },
    (location) => {
      onLocationUpdate({
        lat: location.coords.latitude,
        lng: location.coords.longitude,
        accuracy: location.coords.accuracy || undefined,
        speed: location.coords.speed ? location.coords.speed * 3.6 : 0, // convert m/s to km/h
        heading: location.coords.heading || 0,
        battery: batteryPercent,
        status: 'RIDING',
      });
    }
  );
};
```
