import azure.cognitiveservices.speech as speechsdk
import base64
import os
import tempfile


class AzureSpeechService:
    def __init__(self):
        self.key = os.environ["AZURE_SPEECH_KEY"]
        self.region = os.environ["AZURE_SPEECH_REGION"]

    def check_pronunciation(self, word_en: str, audio_base64: str) -> dict:
        audio_bytes = base64.b64decode(audio_base64)
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            f.write(audio_bytes)
            tmp_path = f.name

        try:
            speech_config = speechsdk.SpeechConfig(
                subscription=self.key,
                region=self.region,
            )
            speech_config.speech_recognition_language = "en-US"

            audio_config = speechsdk.audio.AudioConfig(filename=tmp_path)

            pron_config = speechsdk.PronunciationAssessmentConfig(
                reference_text=word_en,
                grading_system=speechsdk.PronunciationAssessmentGradingSystem.HundredMark,
                granularity=speechsdk.PronunciationAssessmentGranularity.Phoneme,
            )

            recognizer = speechsdk.SpeechRecognizer(
                speech_config=speech_config,
                audio_config=audio_config,
            )
            pron_config.apply_to(recognizer)

            result = recognizer.recognize_once()

            if result.reason == speechsdk.ResultReason.RecognizedSpeech:
                pron_result = speechsdk.PronunciationAssessmentResult(result)
                accuracy = pron_result.accuracy_score
                is_correct = accuracy >= 70

                if accuracy >= 80:
                    feedback = "Ajoyib talaffuz! 🎉"
                elif accuracy >= 70:
                    feedback = "Yaxshi, lekin biroz mashq qiling"
                else:
                    feedback = "Qaytadan urining — aniqroq ayting"

                return {
                    "is_correct": is_correct,
                    "accuracy_score": accuracy,
                    "feedback": feedback,
                }
            else:
                return {
                    "is_correct": False,
                    "accuracy_score": 0.0,
                    "feedback": "Ovoz aniqlanmadi — qayta urining",
                }
        finally:
            os.unlink(tmp_path)
