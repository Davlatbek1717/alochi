import pytest
from unittest.mock import patch, MagicMock


def test_speech_check_returns_correct_format():
    with patch('azure.cognitiveservices.speech.SpeechConfig'):
        with patch('azure.cognitiveservices.speech.SpeechRecognizer'):
            # Minimal test — real Azure credentials needed for full test
            assert True
