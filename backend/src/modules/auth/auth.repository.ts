import { eq } from "drizzle-orm";
import { db } from "../../db/index";
import { logger } from "../../utils/logger";
import { users, NewUser, User } from "../../db/schema/users";

export class AuthRepository {
  async findUserByEmail(email: string): Promise<User | undefined> {
    try {
      const result = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      return result[0];
    } catch (error) {
      logger.error("Database error while finding user by email", {
        email,
        module: "auth-repository",
        err: error,
      });
      throw error;
    }
  }

  async findUserByUsername(username: string): Promise<User | undefined> {
    try {
      const result = await db
        .select()
        .from(users)
        .where(eq(users.username, username))
        .limit(1);
      return result[0];
    } catch (error) {
      logger.error("Database error while finding user by username", {
        username,
        module: "auth-repository",
        err: error,
      });
      throw error;
    }
  }

  async findUserById(id: string): Promise<User | undefined> {
    try {
      const result = await db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1);
      return result[0];
    } catch (error) {
      logger.error("Database error while finding user by id", {
        userId: id,
        module: "auth-repository",
        err: error,
      });
      throw error;
    }
  }

  async createUser(data: NewUser): Promise<User> {
    try {
      const result = await db.insert(users).values(data).returning();
      return result[0];
    } catch (error) {
      logger.error("Database error while creating user", {
        email: data.email,
        username: data.username,
        module: "auth-repository",
        err: error,
      });
      throw error;
    }
  }
}

export const authRepository = new AuthRepository();
