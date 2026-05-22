import anthropic
import os
import re
from typing import Optional
import json

CLAUDE_MODEL = "claude-haiku-4-5"
CLAUDE_SONNET = "claude-sonnet-4-5"

SYSTEM_PROMPT_TEMPLATE = """Siz A'lojon o'quv platformasining AI Tutor assistentiningsiz.
Sizning vazifangiz: o'quvchilarga ingliz tili darslarini o'zbek tilida tushuntirish.

Qoidalar:
- Har doim O'ZBEK tilida javob bering
- Oddiy va bolalar uchun tushunarli til ishlating (8-13 yosh)
- Dars mavzusidan chetga chiqmang
- Maksimal 3-4 gap bilan javob bering
- Rag'batlantiruvchi, ijobiy ton saqlang

Dars mavzusi va konteksti:
{lesson_context}"""


class ClaudeClient:
    def __init__(self):
        self.client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    def ask_tutor(
        self,
        lesson_context: str,
        question: str,
        history: list[dict],
        student_level: str = "beginner",
    ) -> str:
        system_content = SYSTEM_PROMPT_TEMPLATE.format(lesson_context=lesson_context)

        messages = [
            *history,
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": question,
                        "cache_control": {"type": "ephemeral"},
                    }
                ],
            },
        ]

        response = self.client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=300,
            system=[
                {
                    "type": "text",
                    "text": system_content,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            messages=messages,
        )

        return response.content[0].text

    def evaluate_lesson(
        self,
        lesson_context: str,
        student_answers: list[dict],
    ) -> dict:
        answers_text = "\n".join(
            f"Savol: {a['question']}\nJavob: {a['student_answer']}"
            for a in student_answers
        )

        prompt = f"""O'quvchining dars javoblarini baholang.

Dars: {lesson_context}

O'quvchi javoblari:
{answers_text}

JSON formatida javob bering:
{{
  "status": "green",
  "score": 0.0,
  "feedback": "O'quvchiga qisqa izoh (O'zbek tilida)",
  "strengths": ["kuchli tomonlar"],
  "weaknesses": ["zaif tomonlar"]
}}

status qiymatlari: "green" (yaxshi), "yellow" (o'rta), "red" (yomon)
score: 0.0 dan 1.0 gacha"""

        response = self.client.messages.create(
            model=CLAUDE_SONNET,
            max_tokens=500,
            system=[
                {
                    "type": "text",
                    "text": "Faqat JSON formatida javob bering.",
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            messages=[{"role": "user", "content": prompt}],
        )

        raw = response.content[0].text
        raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw.strip())
        try:
            return json.loads(raw)
        except json.JSONDecodeError as exc:
            raise ValueError(f"Claude returned non-JSON output: {raw[:200]}") from exc
