# API Contract

## Auth

POST /auth/register

POST /auth/login

---

## Notes

POST /notes

GET /notes

GET /notes/:id

DELETE /notes/:id

---

## Documents

POST /documents/upload

GET /documents

DELETE /documents/:id

---

## AI Chat (Streaming)

POST /chat/stream

Request

{
  message: string
}

Response

text/event-stream

Example events

data: {"token":"React "}
data: {"token":"useEffect "}
data: {"token":"is "}
data: {"token":"a hook"}

---

## Quiz

POST /quiz/generate

Body:

{
  topic: string
  difficulty: string
  questions: number
}