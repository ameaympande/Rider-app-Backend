import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type RiderLocationDocument = HydratedDocument<RiderLocation>;

@Schema({ timestamps: true })
export class RiderLocation {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
  })
  userId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'RideRoom',
    required: true,
  })
  rideId: Types.ObjectId;

  @Prop({
    required: true,
  })
  lat: number;

  @Prop({
    required: true,
  })
  lng: number;

  @Prop()
  accuracy?: number;

  @Prop()
  speed: number;

  @Prop()
  heading: number;

  @Prop()
  battery: number;

  @Prop({
    default: 'RIDING',
  })
  status: string;

  createdAt: Date;

  updatedAt: Date;
}

export const RiderLocationSchema = SchemaFactory.createForClass(RiderLocation);

RiderLocationSchema.index({ rideId: 1, userId: 1, createdAt: -1 });
