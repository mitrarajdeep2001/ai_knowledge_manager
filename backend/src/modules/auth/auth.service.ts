import bcrypt from "bcrypt";
import { FastifyInstance } from "fastify";
import { AppError } from "../../utils/AppError";
import { logger } from "../../utils/logger";
import { authRepository } from "./auth.repository";
import { RegisterInput, LoginInput } from "./auth.schema";

const DEFAULT_JWT_EXPIRES_IN = "7d";

export class AuthService {
  private signAccessToken(fastify: FastifyInstance, payload: { id: string; email: string }) {
    return fastify.jwt.sign(payload, {
      expiresIn: process.env.JWT_EXPIRES_IN ?? DEFAULT_JWT_EXPIRES_IN,
    });
  }

  private toSafeUser(user: {
    id: string;
    email: string;
    username: string;
    fullname: string;
  }) {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      fullname: user.fullname,
    };
  }

  async register(input: RegisterInput, fastify: FastifyInstance) {
    const existingEmail = await authRepository.findUserByEmail(input.email);
    if (existingEmail) {
      throw new AppError("Email already exists", 409);
    }

    const existingUsername = await authRepository.findUserByUsername(input.username);
    if (existingUsername) {
      throw new AppError("Username already exists", 409);
    }

    const passwordHash = await bcrypt.hash(input.password, 10);

    logger.info("User registration started", {
      email: input.email,
      username: input.username,
      module: "auth-service",
    });

    const user = await authRepository.createUser({
      email: input.email,
      username: input.username,
      fullname: input.fullname,
      passwordHash,
    });

    const token = this.signAccessToken(fastify, { id: user.id, email: user.email });

    logger.info("User registration completed", {
      userId: user.id,
      email: user.email,
      module: "auth-service",
    });

    return {
      token,
      user: this.toSafeUser(user),
    };
  }

  async login(input: LoginInput, fastify: FastifyInstance) {
    logger.info("User login started", {
      email: input.email,
      module: "auth-service",
    });

    const user = await authRepository.findUserByEmail(input.email);
    if (!user) {
      throw new AppError("Invalid credentials", 401);
    }

    const isMatch = await bcrypt.compare(input.password, user.passwordHash);
    if (!isMatch) {
      throw new AppError("Invalid credentials", 401);
    }

    const token = this.signAccessToken(fastify, { id: user.id, email: user.email });

    logger.info("User login completed", {
      userId: user.id,
      email: user.email,
      module: "auth-service",
    });

    return {
      token,
      user: this.toSafeUser(user),
    };
  }

  async getCurrentUser(userId: string) {
    const user = await authRepository.findUserById(userId);
    if (!user) {
      throw new AppError("Unauthorized", 401);
    }

    return this.toSafeUser(user);
  }
}

export const authService = new AuthService();
