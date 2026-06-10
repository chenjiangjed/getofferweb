import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import { db } from "../db.js";
import type { User } from "../types.js";
import { nowIso } from "../utils/http.js";

const PASSWORD_COST = 12;
const CAPTCHA_REQUIRED_AFTER_FAILURES = 5;
const LOCK_AFTER_FAILURES = 10;
const LOCK_MINUTES = 10;

export function findUserById(id: string): User | undefined {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id) as User | undefined;
}

export function findUserByUsername(username: string): User | undefined {
  return db
    .prepare("SELECT * FROM users WHERE username = ?")
    .get(username) as User | undefined;
}

export function isUsernameTaken(username: string) {
  return Boolean(findUserByUsername(username));
}

export async function createUser(username: string, password: string, nickname = ""): Promise<User> {
  const id = uuidv4();
  const timestamp = nowIso();
  const profileUserId = `user_${id.replace(/-/g, "").slice(0, 12)}`;
  const passwordHash = await bcrypt.hash(password, PASSWORD_COST);

  db.prepare(
    `INSERT INTO users
      (id, username, nickname, password_hash, profile_user_id, failed_login_count, locked_until, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 0, NULL, ?, ?)`
  ).run(id, username, nickname.trim() || username, passwordHash, profileUserId, timestamp, timestamp);

  return findUserById(id)!;
}

export async function verifyPassword(user: User, password: string) {
  return bcrypt.compare(password, user.password_hash);
}

export function requiresCaptcha(user?: User) {
  return Boolean(user && user.failed_login_count >= CAPTCHA_REQUIRED_AFTER_FAILURES);
}

export function isLocked(user: User) {
  if (!user.locked_until) return false;
  return Date.parse(user.locked_until) > Date.now();
}

export function recordLoginFailure(user?: User) {
  if (!user) return;
  const nextCount = user.failed_login_count + 1;
  const lockedUntil =
    nextCount >= LOCK_AFTER_FAILURES
      ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000).toISOString()
      : user.locked_until;

  db.prepare(
    `UPDATE users
     SET failed_login_count = ?, locked_until = ?, updated_at = ?
     WHERE id = ?`
  ).run(nextCount, lockedUntil, nowIso(), user.id);
}

export function resetLoginFailures(userId: string) {
  db.prepare(
    `UPDATE users
     SET failed_login_count = 0, locked_until = NULL, updated_at = ?
     WHERE id = ?`
  ).run(nowIso(), userId);
}
