import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  @Prop()
  name: string;

  @Prop({
    required: true,
    unique: true,
  })
  phone: string;

  @Prop()
  avatar?: string;

  @Prop()
  bikeName?: string;

  @Prop({
    type: [
      {
        name: { type: String, required: true },
        phone: { type: String, required: true },
      },
    ],
    default: [],
  })
  emergencyContacts: Array<{
    name: string;
    phone: string;
  }>;

  @Prop({ default: false })
  isOnline: boolean;

  @Prop()
  lastActive?: Date;

  createdAt: Date;

  updatedAt: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
