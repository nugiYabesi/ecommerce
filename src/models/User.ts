import mongoose, { Model, Schema } from "mongoose";

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  created_at: Date;
}

export type SafeUser = Pick<User, "id" | "name" | "email">;
export interface UserFields { name: string; email: string; password: string; created_at: Date }

const userSchema = new Schema<UserFields>({
  name: { type: String, required: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  created_at: { type: Date, default: Date.now },
});

export const UserModel: Model<UserFields> = mongoose.models.User as Model<UserFields> ||
  mongoose.model<UserFields>("User", userSchema);
