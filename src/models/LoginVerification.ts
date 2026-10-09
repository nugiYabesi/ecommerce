import mongoose, { Model, Schema, Types } from "mongoose";

export interface LoginVerificationFields {
  userId: Types.ObjectId;
  purpose: "login" | "account_deletion";
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  created_at: Date;
}

const loginVerificationSchema = new Schema<LoginVerificationFields>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  purpose: { type: String, enum: ["login", "account_deletion"], default: "login", required: true },
  codeHash: { type: String, required: true },
  expiresAt: { type: Date, required: true, expires: 0 },
  attempts: { type: Number, default: 0, required: true },
  created_at: { type: Date, default: Date.now },
});

export const LoginVerificationModel: Model<LoginVerificationFields> =
  mongoose.models.LoginVerification as Model<LoginVerificationFields> ||
  mongoose.model<LoginVerificationFields>("LoginVerification", loginVerificationSchema);
