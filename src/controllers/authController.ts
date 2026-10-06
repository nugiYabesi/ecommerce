import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { UserModel } from "../models/User";

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
    response.status(201).json({ message: "User registered successfully", user });
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
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET is not configured");
    const id = user._id.toString();
    const token = jwt.sign({ id }, secret, { expiresIn: "1d" });
    response.json({ message: "Login successful", token, user: { id, name: user.name, email: user.email } });
  } catch (error) {
    console.error("Login failed:", error);
    response.status(500).json({ message: "Unable to log in" });
  }
}
