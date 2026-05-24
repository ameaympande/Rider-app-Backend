import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type BikeDocument = HydratedDocument<Bike>;

@Schema({ timestamps: true })
export class Bike {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId: Types.ObjectId;

  @Prop({
    required: true,
  })
  name: string;

  @Prop({
    required: true,
  })
  brand: string;

  @Prop({
    required: true,
  })
  year: number;

  @Prop({
    required: true,
  })
  odometer: number;
}

export const BikeSchema = SchemaFactory.createForClass(Bike);
