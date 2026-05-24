import { Subject } from 'rxjs';

export interface RideEvent {
  type: 'RIDE_ENDED';
  rideId: string;
}

export const rideEvents$ = new Subject<RideEvent>();
