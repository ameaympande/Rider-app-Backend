import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type RideHistoryDocument = HydratedDocument<RideHistory>;

@Schema({ timestamps: true })
export class RideHistory {
  @Prop({
    required: true,
  })
  name: string;

  @Prop()
  destination?: string;

  @Prop()
  destinationLat?: number;

  @Prop()
  destinationLng?: number;

  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
  })
  adminId: Types.ObjectId;

  @Prop({ default: false })
  isPrivate: boolean;

  @Prop({
    required: true,
  })
  inviteCode: string;

  @Prop({
    type: [Types.ObjectId],
    ref: 'User',
    default: [],
    index: true,
  })
  members: Types.ObjectId[];

  createdAt?: Date;
  updatedAt?: Date;
}

export const RideHistorySchema = SchemaFactory.createForClass(RideHistory);
