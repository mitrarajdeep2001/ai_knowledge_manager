import "dotenv/config";
import { authService } from "./src/modules/auth/auth.service.js";

async function test() {
  try {
    const res = await authService.register(
      {
        email: "test.script@example.com",
        username: "testscript",
        fullname: "Test Script",
        password: "Test1234!",
      },
      { jwt: { sign: (payload: any) => "fake_jwt" } } as any,
    );
    console.log("Success:", res);
  } catch (err) {
    console.error("Error occurred:");
    console.error(err);
  }
  process.exit(0);
}

test();
