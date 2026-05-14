import { io, Socket } from 'socket.io-client';

const socket: Socket = io('http://localhost:3000', {
  auth: {
    token: process.env.ACCESS_TOKEN ?? '',
  },
});

socket.on('connect', () => {
  console.log('Connected');

  socket.emit('joinRide', {
    rideId: 'ride123',
    userId: 'user1',
  });

  setInterval(() => {
    socket.emit('locationUpdate', {
      rideId: 'ride123',
      userId: 'user1',
      lat: 18.5204 + Math.random() / 100,
      lng: 73.8567 + Math.random() / 100,
      speed: 60 + Math.random() * 20,
      heading: 180,
    });
  }, 3000);
});

socket.on('riderJoined', (data) => {
  console.log('Rider Joined:', data);
});

socket.on('riderLocation', (data) => {
  console.log('Live Location:', data);
});
