"""Validate the configured database connection without embedding credentials."""

import os
from pathlib import Path

import sqlalchemy
from dotenv import load_dotenv


load_dotenv(Path(__file__).resolve().parent / ".env")


def main() -> None:
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is not configured.")

    engine = sqlalchemy.create_engine(database_url)
    with engine.connect() as connection:
        connection.execute(sqlalchemy.text("SELECT 1"))
    print("Database connection succeeded.")


if __name__ == "__main__":
    main()
