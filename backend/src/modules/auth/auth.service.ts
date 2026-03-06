import bcrypt from "bcrypt";
import { AppError } from "../../utils/AppError";
import { authRepository } from "./auth.repository";
import { RegisterInput, LoginInput } from "./auth.schema";
import { FastifyInstance } from "fastify";

export class AuthService {
  async register(input: RegisterInput, fastify: FastifyInstance) {
    // Check if email exists
    const existingEmail = await authRepository.findUserByEmail(input.email);
    if (existingEmail) {
      throw new AppError("Email already exists", 409);
    }

    // Check if username exists
    const existingUsername = await authRepository.findUserByUsername(
      input.username,
    );
    if (existingUsername) {
      throw new AppError("Username already exists", 409);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(input.password, 10);

    // Create user
    const user = await authRepository.createUser({
      email: input.email,
      username: input.username,
      fullname: input.fullname,
      passwordHash,
    });

    // Generate token
    const token = fastify.jwt.sign({ id: user.id, email: user.email });

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
    // Find user by email
    const user = await authRepository.findUserByEmail(input.email);
    if (!user) {
      throw new AppError("Invalid credentials", 401);
    }

    // Compare password
    const isMatch = await bcrypt.compare(input.password, user.passwordHash);
    if (!isMatch) {
      throw new AppError("Invalid credentials", 401);
    }

    // Generate token
    const token = fastify.jwt.sign({ id: user.id, email: user.email });

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
