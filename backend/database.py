import sqlite3
import os
from passlib.context import CryptContext

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data","medverify.db")
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db() -> None:
    with get_db() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS drugs (
                id    INTEGER PRIMARY KEY AUTOINCREMENT,
                name  TEXT    NOT NULL UNIQUE COLLATE NOCASE
            );

            CREATE TABLE IF NOT EXISTS scan_sessions(
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp   TEXT    NOT NULL,
                scanned_by  TEXT,
                location,   TEXT,
                matched     INTEGER DEFAULT 0,
                missing     INTEGER DEFAULT 0,
                extra       INTEGER DEFAULT 0,
                review      INTEGER DEFAULT 0,
                unknown     INTEGER DEFAULT 0,
                annotated   TEXT
            );
            
            CREATE TABLE IF NOT EXISTS scan_results(
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id      INTEGER NOT NULL REFERENCES scan_sessions(id),
                box_id          TEXT,
                final_name      TEXT,
                scan_status     TEXT,
                confidence      TEXT,
                ocr_raw         TEXT,
                qr_name         TEXT,
                reference_image TEXT
            );
            
            CREATE TABLE IF NOT EXISTS users (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                username    TEXT    NOT NULL UNIQUE,
                password_hash   TEXT NOT NULL,
                role        TEXT DEFAULT 'pharmacist'
            );

            CREATE TABLE IF NOT EXISTS medicine_codes (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                label       TEXT
            );

            CREATE TABLE IF NOT EXISTS medicine_code_items (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                code_id     INTEGER NOT NULL REFERENCES medicine_codes(id) ON DELETE CASCADE,
                drug_name   TEXT    NOT NULL,
                quantity    INTEGER DEFAULT 1
            );
                           

        """)
        hashed = pwd_context.hash("1234")

        conn.execute("INSERT OR IGNORE INTO users(username,password_hash,role) VALUES (?,?,?)", ('admin',hashed,'admin'))
        conn.commit()
    print("[DB] SQLite initialised -> ", DB_PATH)