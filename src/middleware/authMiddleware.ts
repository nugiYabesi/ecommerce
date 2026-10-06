import { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";

declare global {
  namespace Express {
    interface Request {
      user?: { id: string };
    }
  }
}

export function authMiddleware(request: Request, response: Response, next: NextFunction): void {
  const authorization = request.header("Authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : undefined;
  const secret = process.env.JWT_SECRET;

  if (!token || !secret) {
    response.status(401).json({ message: "Authentication token is missing or invalid" });
    return;
  }

  try {
    const payload = jwt.verify(token, secret) as JwtPayload;
    const id = typeof payload.id === "string" ? payload.id : "";
    if (!/^[a-f\d]{24}$/i.test(id)) {
      response.status(401).json({ message: "Authentication token is invalid" });
      return;
    }
    request.user = { id };
    next();
  } catch {
    response.status(401).json({ message: "Authentication token is invalid or expired" });
  }
}
