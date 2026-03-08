import bcrypt from "bcrypt";
import { FastifyInstance } from "fastify";
import { AppError } from "../../utils/AppError";
import { logger } from "../../utils/logger";
import { authRepository } from "./auth.repository";
import { RegisterInput, LoginInput } from "./auth.schema";

export class AuthService {
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

    const token = fastify.jwt.sign({ id: user.id, email: user.email });

    logger.info("User registration completed", {
      userId: user.id,
      email: user.email,
      module: "auth-service",
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        fullname: user.fullname,
      },
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

    const token = fastify.jwt.sign({ id: user.id, email: user.email });

    logger.info("User login completed", {
      userId: user.id,
      email: user.email,
      module: "auth-service",
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        fullname: user.fullname,
      },
    };
  }
}

export const authService = new AuthService();
