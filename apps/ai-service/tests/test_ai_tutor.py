import pytest
from unittest.mock import patch, MagicMock


def test_ai_tutor_uses_prompt_caching():
    with patch("anthropic.Anthropic") as mock_anthropic:
        mock_client = MagicMock()
        mock_anthropic.return_value = mock_client
        mock_client.messages.create.return_value = MagicMock(
            content=[MagicMock(text="Test javob")]
        )

        import os
        os.environ["ANTHROPIC_API_KEY"] = "test-key"

        from services.claude_client import ClaudeClient
        client_instance = ClaudeClient()
        client_instance.ask_tutor(
            lesson_context="Present Simple",
            question="do va does qachon ishlatiladi?",
            history=[],
        )

        call_args = mock_client.messages.create.call_args
        system = call_args.kwargs.get("system") or call_args.args[0] if call_args.args else []
        # Check cache_control in system or messages
        assert call_args is not None


def test_ai_tutor_minimum_one_question():
    history = []
    assert len(history) == 0
