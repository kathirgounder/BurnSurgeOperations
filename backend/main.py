from fastapi import FastAPI
from openai import OpenAI
from dotenv import load_dotenv
import os


load_dotenv()
env = os.environ

app = FastAPI()


@app.get("/generate-report/{content}")
async def generate_report(content):
    prompt = content

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