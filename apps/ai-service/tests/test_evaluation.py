import pytest
from unittest.mock import patch


def test_evaluation_returns_valid_status():
    with patch('services.claude_client.ClaudeClient.evaluate_lesson') as mock_eval:
        mock_eval.return_value = {
            "status": "green",
            "score": 0.85,
            "feedback": "Yaxshi natija!",
            "strengths": ["Grammatika to'g'ri"],
            "weaknesses": [],
        }

        result = mock_eval(
            lesson_context="Present Simple",
            student_answers=[{"question": "Q1", "student_answer": "A1"}],
        )

        assert result["status"] in ["green", "yellow", "red"]
        assert 0.0 <= result["score"] <= 1.0
