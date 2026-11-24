# Speech to Text

Speak in Hindi, English or a mix of both, and watch the words appear live. Every
transcription is saved, and the history can be searched, edited and deleted.

**Stack:** React + Vite + TypeScript, Django + DRF + Channels, Gemini
`gemini-3.5-transcribe-live`, PostgreSQL.

## How it works

```
Browser mic -> AudioWorklet (16 kHz PCM, 100 ms chunks)
     |  WebSocket: audio up, transcripts down
     v
Django Channels consumer <-> Gemini live transcription
     |  saves each final segment as it arrives
     v
PostgreSQL <- DRF CRUD API <- React history pages
```

- The Gemini key stays on the server.
- Interim text is shown in grey and replaced by the final text.
- If the connection drops, finalized text is kept and the recording is marked `interrupted`.
- Recordings stop at 9 minutes because Gemini ends a live session at 10.

## Run locally

Needs Python 3.13, Node 22 and PostgreSQL (with a database created for the app).

```
python -m venv .venv
.venv\Scripts\activate                  # macOS/Linux: source .venv/bin/activate
pip install -r requirements-dev.txt
copy .env.example .env                  # then fill it in (macOS/Linux: cp)
cd backend
python manage.py migrate
python -m uvicorn config.asgi:application --port 8000
```

In a second terminal:

```
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. If `DATABASE_URL` is empty and `DEBUG=1`, SQLite is used
so the app can be tried quickly.

## API

Interactive docs are at `/api/docs`. Send the passcode as the `X-Passcode` header.

| Method | Path | Purpose |
|---|---|---|
| WS | `/ws/transcribe` | Live audio and transcripts |
| GET, POST | `/api/transcriptions` | List (`search`, `page`) and create |
| GET, PATCH, DELETE | `/api/transcriptions/{id}` | Read, rename, delete |
| PATCH, DELETE | `/api/transcriptions/{id}/segments/{segment_id}` | Edit or remove a segment |

## Tests

```
cd backend && python -m pytest
cd frontend && npm test
```

Backend tests use SQLite unless `TEST_DATABASE_URL` is set.

## Deploy (Render + Neon)

1. Create a Neon database and copy its **direct** (non-pooled) connection string.
2. Create a Render web service from this repository using the Dockerfile.
3. Set `DATABASE_URL`, `GEMINI_API_KEY`, `SECRET_KEY` and `APP_PASSCODE`; leave `DEBUG`
   unset. Set the health check path to `/api/health`.

Run one instance: the limit on simultaneous recordings is kept in memory.

## Limitations

- Transcription uses Gemini's hosted API. On the free tier, Google may use the content to
  improve its products, so do not record anything sensitive.
- Segment times are approximate; they are measured from the audio sent.
- "Read aloud" uses the browser's voices, so Hindi depends on the device, and Hindi written
  in Roman letters is read with an English voice.
- Access is one shared passcode; there are no user accounts.
