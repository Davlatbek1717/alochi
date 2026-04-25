import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class AiService {
  private readonly aiServiceUrl: string;

  constructor(private http: HttpService, private config: ConfigService) {
    this.aiServiceUrl = this.config.get('AI_SERVICE_URL', 'http://localhost:8000');
  }

  async askTutor(
    lessonContext: string,
    question: string,
    history: { role: string; content: string }[],
  ) {
    try {
      const res = await firstValueFrom(
        this.http.post(`${this.aiServiceUrl}/ai/tutor/ask`, {
          lesson_context: lessonContext,
          question,
          conversation_history: history,
        }),
      );
      return res.data;
    } catch {
      throw new ServiceUnavailableException('AI servis vaqtincha ishlamayapti');
    }
  }

  async evaluate(
    lessonContext: string,
    studentAnswers: { question: string; student_answer: string }[],
  ) {
    try {
      const res = await firstValueFrom(
        this.http.post(`${this.aiServiceUrl}/ai/evaluate/`, {
          lesson_context: lessonContext,
          student_answers: studentAnswers,
        }),
      );
      return res.data;
    } catch {
      throw new ServiceUnavailableException('Baholash servisi vaqtincha ishlamayapti');
    }
  }

  async checkPronunciation(wordEn: string, audioBase64: string) {
    try {
      const res = await firstValueFrom(
        this.http.post(`${this.aiServiceUrl}/ai/speech/check`, {
          word_en: wordEn,
          audio_base64: audioBase64,
        }),
      );
      return res.data;
    } catch {
      return { is_correct: true, accuracy_score: 100, feedback: 'Fallback mode' };
    }
  }
}
