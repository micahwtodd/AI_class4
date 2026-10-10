"""FastAPI backend: chat with the professor agents.

Run from the backend folder:  .venv/Scripts/python -m uvicorn main:app --port 8000
"""

import os
from collections import OrderedDict
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from pydantic_ai.messages import ModelMessage

from professors import PERSONAS, Deps, make_agent

ENV_PATH = Path(__file__).resolve().parent / '.env'
load_dotenv(ENV_PATH)

app = FastAPI(title='Yale SOM Virtual: professor agents')
app.add_middleware(
    CORSMiddleware,
    allow_origins=['http://localhost:5173', 'http://127.0.0.1:5173'],
    allow_methods=['GET', 'POST'],
    allow_headers=['*'],
)

# conversation memory per (professor, browser session); in memory, so it resets when the server restarts
MAX_SESSIONS = 200
histories: OrderedDict[tuple[str, str], list[ModelMessage]] = OrderedDict()


class ChatIn(BaseModel):
    session_id: str = Field(min_length=1, max_length=100)
    message: str = Field(min_length=1, max_length=4000)


class ChatOut(BaseModel):
    reply: str


@app.get('/api/health')
def health():
    return {'ok': True}


@app.get('/api/professors')
def professors():
    return [{'id': p.id, 'name': p.name, 'room': p.room} for p in PERSONAS.values()]


@app.post('/api/chat/{prof_id}', response_model=ChatOut)
async def chat(prof_id: str, body: ChatIn):
    persona = PERSONAS.get(prof_id)
    if not persona:
        raise HTTPException(404, f'No professor called {prof_id!r}')
    load_dotenv(ENV_PATH, override=True)  # pick up a new API key without a restart
    try:
        agent = make_agent(persona)
    except RuntimeError as e:
        raise HTTPException(503, str(e))

    key = (prof_id, body.session_id)
    history = histories.get(key, [])
    try:
        result = await agent.run(body.message, message_history=history, deps=Deps(persona))
    except Exception as e:  # surface gateway/model errors to the chat window instead of a bare 500
        msg = str(e)
        key = os.getenv('PORTKEY_API_KEY', '').strip()
        if key:
            msg = msg.replace(key, '[hidden]')  # never echo the API key to the browser
        raise HTTPException(502, f'The model call failed: {msg}')

    histories[key] = result.all_messages()
    histories.move_to_end(key)
    while len(histories) > MAX_SESSIONS:
        histories.popitem(last=False)
    return ChatOut(reply=result.output)


@app.post('/api/chat/{prof_id}/reset')
def reset(prof_id: str, body: dict):
    histories.pop((prof_id, str(body.get('session_id', ''))), None)
    return {'ok': True}
