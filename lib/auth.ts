import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import { type Bindings, localMock } from "./env";
export function auth(e: Bindings) {
  if (!e.BETTER_AUTH_SECRET || !e.GOOGLE_CLIENT_ID || !e.GOOGLE_CLIENT_SECRET)
    throw new Error("Google sign-in is not configured.");
  return betterAuth({
    database: drizzleAdapter(drizzle(e.DB, { schema }), {
      provider: "sqlite",
      schema,
    }),
    baseURL: e.APP_ORIGIN,
    secret: e.BETTER_AUTH_SECRET,
    trustedOrigins: [e.APP_ORIGIN],
    socialProviders: {
      google: {
        clientId: e.GOOGLE_CLIENT_ID,
        clientSecret: e.GOOGLE_CLIENT_SECRET,
      },
    },
    databaseHooks: {
      user: {
        create: {
          after: async (u) => {
            await e.DB.prepare(
              "INSERT OR IGNORE INTO user_wallets (user_id) VALUES (?)",
            )
              .bind(u.id)
              .run();
          },
        },
      },
    },
  });
}
export interface Identity {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  role: string;
}
export async function identity(
  e: Bindings,
  r: Request,
): Promise<Identity | null> {
  if (localMock(e, r)) {
    const token = r.headers
      .get("cookie")
      ?.match(/(?:^|; )mock_session=([^;]+)/)?.[1];
    if (token)
      return e.DB.prepare(
        "SELECT u.* FROM mock_sessions s JOIN user u ON u.id=s.user_id WHERE s.token=? AND s.expires_at>?",
      )
        .bind(token, Date.now())
        .first<Identity>();
  }
  if (!e.BETTER_AUTH_SECRET || !e.GOOGLE_CLIENT_ID) return null;
  const s = await auth(e).api.getSession({ headers: r.headers });
  if (!s) return null;
  return e.DB.prepare("SELECT id,name,email,image,role FROM user WHERE id=?")
    .bind(s.user.id)
    .first<Identity>();
}
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function requireUser(e: Bindings, r: Request) {
  const u = await identity(e, r);
  if (!u) throw new AppError(401, "Sign in to continue.");
  return u;
}
export function sameOrigin(e: Bindings, r: Request) {
  const origin = r.headers.get("origin");
  if (origin !== new URL(r.url).origin && origin !== e.APP_ORIGIN)
    throw new AppError(403, "Invalid request origin.");
}
