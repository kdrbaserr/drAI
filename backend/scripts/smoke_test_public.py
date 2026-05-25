"""Smoke-test a deployed DrAI API through its public URL."""

import argparse
import json
import secrets
import sys

import httpx


def require(response: httpx.Response, expected: int, label: str) -> dict:
    if response.status_code != expected:
        raise RuntimeError(
            f"{label}: expected {expected}, received {response.status_code}: "
            f"{response.text[:300]}"
        )
    if response.content:
        return response.json()
    return {}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("base_url", help="Public API base URL, e.g. https://drai-api.onrender.com")
    parser.add_argument("--timeout", type=float, default=90.0)
    args = parser.parse_args()

    base_url = args.base_url.rstrip("/")
    suffix = secrets.token_hex(5)
    username = f"smoke_{suffix}"
    password = f"Smoke-{suffix}-Password1!"
    email = f"{username}@example.com"

    with httpx.Client(base_url=base_url, timeout=args.timeout) as client:
        health = require(client.get("/health"), 200, "GET /health")
        model_info = require(client.get("/api/v1/model/info"), 200, "GET /api/v1/model/info")
        require(
            client.get("/api/v1/history"),
            401,
            "GET /api/v1/history without token",
        )
        require(
            client.post(
                "/api/v1/auth/register",
                json={"username": username, "email": email, "password": password},
            ),
            200,
            "POST /api/v1/auth/register",
        )
        token_response = require(
            client.post(
                "/api/v1/auth/login",
                data={"username": username, "password": password},
            ),
            200,
            "POST /api/v1/auth/login",
        )
        headers = {"Authorization": f"Bearer {token_response['access_token']}"}
        database = require(client.get("/db-test", headers=headers), 200, "GET /db-test")
        ecg = require(
            client.post(
                "/api/v1/analyze/ecg",
                files={"file": ("smoke.dat", b"smoke-test", "application/octet-stream")},
                headers=headers,
            ),
            200,
            "POST /api/v1/analyze/ecg",
        )
        eeg = require(
            client.post(
                "/api/v1/analyze/eeg",
                files={"file": ("smoke.edf", b"smoke-test", "application/octet-stream")},
                headers=headers,
            ),
            200,
            "POST /api/v1/analyze/eeg",
        )
        history = require(client.get("/api/v1/history", headers=headers), 200, "GET /api/v1/history")
        result = require(
            client.get(f"/api/v1/results/{ecg['id']}", headers=headers),
            200,
            "GET /api/v1/results/{id}",
        )
        invalid_eeg = require(
            client.post(
                "/api/v1/analyze/eeg",
                files={"file": ("invalid.txt", b"invalid", "text/plain")},
                headers=headers,
            ),
            400,
            "POST /api/v1/analyze/eeg invalid extension",
        )

    print(
        json.dumps(
            {
                "health": health["status"],
                "database": database["status"],
                "models": sorted(model_info["models"].keys()),
                "ecg_status": ecg["status"],
                "eeg_status": eeg["status"],
                "history_count": len(history),
                "result_id": result["id"],
                "eeg_invalid_detail": invalid_eeg["detail"],
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"Smoke test failed: {exc}", file=sys.stderr)
        raise SystemExit(1)
