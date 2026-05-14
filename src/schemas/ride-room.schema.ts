import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type RideRoomDocument = HydratedDocument<RideRoom>;

@Schema({ timestamps: true })
export class RideRoom {
  @Prop({
    required: true,
  })
  name: string;

  @Prop()
  destination?: string;

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
    unique: true,
    index: true,
  })
  inviteCode: string;

  @Prop({
    type: [Types.ObjectId],
    ref: 'User',
    default: [],
  })
  members: Types.ObjectId[];

  createdAt: Date;

  updatedAt: Date;
}

export const RideRoomSchema = SchemaFactory.createForClass(RideRoom);
