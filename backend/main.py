from fastapi import FastAPI, Request
from pydantic import BaseModel
from typing import List
from openai import OpenAI
from starlette.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os


load_dotenv()
env = os.environ

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Patient(BaseModel):
    patientId: str
    severity: str
    bestDest: str
    minutes: str
    score: str

class ReportRequest(BaseModel):
    incidentName: str
    incidentDate: str
    incidentNotes: str
    patients: List[Patient]
    generatedAt: str

@app.post("/generate-report")
async def generate_report(request: ReportRequest):
    prompt = f"""
    Burn Incident Description
    Incident: {request.incidentName}
    Date: {request.incidentDate}
    Notes: {request.incidentNotes}

    Patient Assignments:
    """

    for p in request.patients:
        prompt += (
            f"- Patient ID: {p.patientId}, Severity: {p.severity}, "
            f"Destination: {p.bestDest}, Minutes: {p.minutes}, Score: {p.score}\n"
        )

    prompt += f"\nReport generated at {request.generatedAt}"

    client = OpenAI(
        api_key=env.get('OPENAI_KEY'),
        organization=env.get('ORG'),
        project=env.get('PROJECT'), 
    )

    thread = client.beta.threads.create()

    message = client.beta.threads.messages.create(
        thread_id=thread.id,
        role="user",
        content=prompt
    )

    run = client.beta.threads.runs.create_and_poll(
        thread_id=thread.id,
        assistant_id=env.get('ASSISTANT'),
    )

    if run.status == 'completed':
        messages = client.beta.threads.messages.list(thread_id=thread.id)

    last_message = messages.data[0].content[0].text.value

    return {"message": last_message}