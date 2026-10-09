import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { createHash, randomInt, timingSafeEqual } from "crypto";
import { UserModel } from "../models/User";
import { LoginVerificationModel } from "../models/LoginVerification";
import { sendAccountDeletionEmail, sendLoginVerificationEmail, sendWelcomeEmail } from "../config/email";

export async function register(request: Request, response: Response): Promise<void> {
  const name = typeof request.body?.name === "string" ? request.body.name.trim() : "";
  const email = typeof request.body?.email === "string" ? request.body.email.trim().toLowerCase() : "";
  const password = typeof request.body?.password === "string" ? request.body.password : "";
  if (!name || name.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) {
    response.status(400).json({ message: "Provide a valid name, email, and password of at least 8 characters" });
    return;
  }

  try {
    if (await UserModel.exists({ email })) {
      response.status(409).json({ message: "Email is already registered" });
      return;
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const document = await UserModel.create({ name, email, password: hashedPassword });
    const user = { id: document._id.toString(), name: document.name, email: document.email };
    let welcomeEmailSent = true;
    try {
      await sendWelcomeEmail(document.email, document.name);
    } catch (emailError) {
      welcomeEmailSent = false;
      console.error("Welcome email could not be sent:", emailError);
    }
    response.status(201).json({
      message: welcomeEmailSent
        ? "User registered successfully. A welcome email was sent."
        : "User registered successfully, but the welcome email could not be sent.",
      welcomeEmailSent,
      user,
    });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      response.status(409).json({ message: "Email is already registered" });
      return;
    }
    console.error("Registration failed:", error);
    response.status(500).json({ message: "Unable to register user" });
  }
}

export async function login(request: Request, response: Response): Promise<void> {
  const email = typeof request.body?.email === "string" ? request.body.email.trim().toLowerCase() : "";
  const password = typeof request.body?.password === "string" ? request.body.password : "";
  if (!email || !password) {
    response.status(400).json({ message: "Email and password are required" });
    return;
  }

  try {
    const user = await UserModel.findOne({ email }).exec();
    if (!user || !(await bcrypt.compare(password, user.password))) {
      response.status(401).json({ message: "Invalid email or password" });
      return;
    }
    if (!process.env.BREVO_API_KEY || !process.env.BREVO_SENDER_EMAIL) {
      throw new Error("Brevo email configuration is incomplete");
    }
    const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
    const challenge = await LoginVerificationModel.create({
      userId: user._id,
      purpose: "login",
      codeHash: createHash("sha256").update(code).digest("hex"),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });
    try {
      await sendLoginVerificationEmail(user.email, code);
    } catch (error) {
      await LoginVerificationModel.deleteOne({ _id: challenge._id });
      throw error;
    }
    response.json({ message: "Verification code sent to your email", challengeId: challenge._id.toString() });
  } catch (error) {
    console.error("Login failed:", error);
    response.status(500).json({ message: "Unable to log in" });
  }
}

export async function verifyLogin(request: Request, response: Response): Promise<void> {
  const challengeId = typeof request.body?.challengeId === "string" ? request.body.challengeId : "";
  const code = typeof request.body?.code === "string" ? request.body.code.trim() : "";
  if (!/^[a-f\d]{24}$/i.test(challengeId) || !/^\d{6}$/.test(code)) {
    response.status(400).json({ message: "A valid challengeId and six-digit code are required" });
    return;
  }

  try {
    const challenge = await LoginVerificationModel.findOne({ _id: challengeId, purpose: "login" }).exec();
    if (!challenge || challenge.expiresAt.getTime() <= Date.now()) {
      response.status(401).json({ message: "Verification code is invalid or expired" });
      return;
    }
    if (challenge.attempts >= 5) {
      await LoginVerificationModel.deleteOne({ _id: challenge._id });
      response.status(429).json({ message: "Too many verification attempts; please log in again" });
      return;
    }

    const submittedHash = createHash("sha256").update(code).digest();
    const expectedHash = Buffer.from(challenge.codeHash, "hex");
    if (submittedHash.length !== expectedHash.length || !timingSafeEqual(submittedHash, expectedHash)) {
      const attempt = await LoginVerificationModel.updateOne(
        { _id: challenge._id, attempts: { $lt: 5 }, expiresAt: { $gt: new Date() } },
        { $inc: { attempts: 1 } },
      );
      if (attempt.modifiedCount === 0) {
        await LoginVerificationModel.deleteOne({ _id: challenge._id, attempts: { $gte: 5 } });
        response.status(429).json({ message: "Too many verification attempts; please log in again" });
        return;
      }
      response.status(401).json({ message: "Verification code is invalid or expired" });
      return;
    }

    const consumedChallenge = await LoginVerificationModel.findOneAndDelete({
      _id: challenge._id,
      codeHash: challenge.codeHash,
      expiresAt: { $gt: new Date() },
      attempts: { $lt: 5 },
    }).exec();
    if (!consumedChallenge) {
      response.status(401).json({ message: "Verification code is invalid or expired" });
      return;
    }
    const user = await UserModel.findById(consumedChallenge.userId).exec();
    if (!user) {
      response.status(401).json({ message: "Verification code is invalid or expired" });
      return;
    }
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET is not configured");
    const id = user._id.toString();
    const token = jwt.sign({ id }, secret, { expiresIn: "1d" });
    response.json({ message: "Login verified", token, user: { id, name: user.name, email: user.email } });
  } catch (error) {
    console.error("Login verification failed:", error);
    response.status(500).json({ message: "Unable to verify login" });
  }
}

export async function deleteMyAccount(request: Request, response: Response): Promise<void> {
  const userId = request.user?.id;
  if (!userId) {
    response.status(401).json({ message: "Please log in first" });
    return;
  }

  const email = typeof request.body?.email === "string" ? request.body.email.trim().toLowerCase() : "";
  const code = typeof request.body?.code === "string" ? request.body.code.trim() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    response.status(400).json({ message: "Enter the email address for your account" });
    return;
  }
  if (!/^\d{6}$/.test(code)) {
    response.status(400).json({ message: "Enter the six-digit code from your email" });
    return;
  }

  try {
    const user = await UserModel.findById(userId).exec();
    if (!user) {
      response.status(404).json({ message: "User account not found" });
      return;
    }
    if (user.email.toLowerCase() !== email) {
      response.status(400).json({ message: "The email address does not match your account" });
      return;
    }

    const challenge = await LoginVerificationModel.findOne({ userId, purpose: "account_deletion" })
      .sort({ created_at: -1 }).exec();
    if (!challenge || challenge.expiresAt.getTime() <= Date.now()) {
      response.status(401).json({ message: "The deletion code is invalid or expired. Request a new one." });
      return;
    }
    if (challenge.attempts >= 5) {
      await LoginVerificationModel.deleteOne({ _id: challenge._id }).exec();
      response.status(429).json({ message: "Too many code attempts. Request a new deletion code." });
      return;
    }
    const submittedHash = createHash("sha256").update(code).digest();
    const expectedHash = Buffer.from(challenge.codeHash, "hex");
    if (submittedHash.length !== expectedHash.length || !timingSafeEqual(submittedHash, expectedHash)) {
      await LoginVerificationModel.updateOne(
        { _id: challenge._id, attempts: { $lt: 5 }, expiresAt: { $gt: new Date() } },
        { $inc: { attempts: 1 } },
      ).exec();
      response.status(401).json({ message: "The deletion code is invalid or expired" });
      return;
    }

    const consumedChallenge = await LoginVerificationModel.findOneAndDelete({
      _id: challenge._id,
      purpose: "account_deletion",
      codeHash: challenge.codeHash,
      expiresAt: { $gt: new Date() },
      attempts: { $lt: 5 },
    }).exec();
    if (!consumedChallenge) {
      response.status(401).json({ message: "The deletion code is invalid or expired" });
      return;
    }
    await UserModel.findByIdAndDelete(userId).exec();
    await LoginVerificationModel.deleteMany({ userId }).exec();
    response.json({ message: "Your account was deleted successfully" });
  } catch (error) {
    console.error("Account deletion failed:", error);
    response.status(500).json({ message: "Unable to delete your account" });
  }
}

export async function requestAccountDeletionCode(request: Request, response: Response): Promise<void> {
  const userId = request.user?.id;
  if (!userId) {
    response.status(401).json({ message: "Please log in first" });
    return;
  }
  const email = typeof request.body?.email === "string" ? request.body.email.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    response.status(400).json({ message: "Enter a valid email address" });
    return;
  }

  try {
    const user = await UserModel.findById(userId).exec();
    if (!user) {
      response.status(404).json({ message: "User account not found" });
      return;
    }
    if (user.email.toLowerCase() !== email) {
      response.status(400).json({ message: "The email address does not match your account" });
      return;
    }
    await LoginVerificationModel.deleteMany({ userId, purpose: "account_deletion" }).exec();
    const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
    const challenge = await LoginVerificationModel.create({
      userId,
      purpose: "account_deletion",
      codeHash: createHash("sha256").update(code).digest("hex"),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });
    try {
      await sendAccountDeletionEmail(user.email, code);
    } catch (error) {
      await LoginVerificationModel.deleteOne({ _id: challenge._id }).exec();
      throw error;
    }
    response.json({ message: "Account deletion code sent to your email. It expires in 10 minutes." });
  } catch (error) {
    console.error("Account deletion code request failed:", error);
    response.status(500).json({ message: "Unable to send the account deletion code" });
  }
}
