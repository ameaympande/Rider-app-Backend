import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type LiveLocationSessionDocument =
  HydratedDocument<LiveLocationSession>;

@Schema({ timestamps: true })
export class LiveLocationSession {
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
  roomId: Types.ObjectId;

  @Prop({
    required: true,
  })
  startTime: Date;

  @Prop()
  endTime?: Date;

  @Prop({
    default: true,
  })
  isActive: boolean;

  createdAt: Date;

  updatedAt: Date;
}

export const LiveLocationSessionSchema =
  SchemaFactory.createForClass(LiveLocationSession);

LiveLocationSessionSchema.index({ roomId: 1, userId: 1, isActive: 1 });
