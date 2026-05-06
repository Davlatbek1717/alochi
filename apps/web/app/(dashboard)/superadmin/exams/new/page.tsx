import { ExamEditor, type ExamPayload } from '../_components/ExamEditor';

const EMPTY: ExamPayload = {
  title: '',
  description: '',
  kind: 'test',
  language: 'en',
  aiPrompt: '',
  maxMinutes: 10,
  passThreshold: 70,
  timeLimitMinutes: null,
  isPublished: false,
  questions: [],
};

export default function NewExamPage() {
  return <ExamEditor initial={EMPTY} />;
}
