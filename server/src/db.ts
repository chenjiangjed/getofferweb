import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { config } from "./config.js";

const dbPath = path.resolve(process.cwd(), config.databasePath);
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

const userColumns = db
  .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'")
  .get()
  ? (db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>)
  : [];
const hasLegacyPhoneSchema = userColumns.some((column) => column.name === "phone_hash");
const hasNicknameColumn = userColumns.some((column) => column.name === "nickname");
const conversationColumns = db
  .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'conversations'")
  .get()
  ? (db.prepare("PRAGMA table_info(conversations)").all() as Array<{ name: string }>)
  : [];
const hasConversationPinnedColumn = conversationColumns.some((column) => column.name === "pinned");
const hasLegacyBackup = Boolean(
  db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users_legacy_phone'")
    .get()
);

if (hasLegacyPhoneSchema && !hasLegacyBackup) {
  db.exec(`
    ALTER TABLE users RENAME TO users_legacy_phone;
  `);
} else if (hasLegacyPhoneSchema && hasLegacyBackup) {
  db.exec("DROP TABLE users;");
}

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  nickname TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  profile_user_id TEXT NOT NULL UNIQUE,
  failed_login_count INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  pinned INTEGER NOT NULL DEFAULT 0,
  bailian_session_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS resume_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  collected_fields TEXT NOT NULL,
  photo_oss_key TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS interview_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  target_job TEXT NOT NULL,
  total_questions INTEGER NOT NULL,
  current_index INTEGER NOT NULL DEFAULT 1,
  current_question_id TEXT NOT NULL,
  current_question TEXT NOT NULL,
  current_question_type TEXT NOT NULL DEFAULT 'behavior',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS interview_answers (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  question TEXT NOT NULL,
  question_type TEXT NOT NULL,
  answer_text TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL,
  feedback_json TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES interview_sessions(id) ON DELETE CASCADE
);
`);

if (userColumns.length > 0 && !hasLegacyPhoneSchema && !hasNicknameColumn) {
  db.exec("ALTER TABLE users ADD COLUMN nickname TEXT NOT NULL DEFAULT '';");
}

if (conversationColumns.length > 0 && !hasConversationPinnedColumn) {
  db.exec("ALTER TABLE conversations ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0;");
}
