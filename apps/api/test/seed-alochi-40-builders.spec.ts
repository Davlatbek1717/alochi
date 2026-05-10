import {
  mcq,
  translate,
  listenType,
  vocabBlock,
  phraseBlock,
  topicSentenceBlock,
  shuffleStable,
} from '../../../prisma/seed-alochi-40';

describe('seed-alochi-40 builders', () => {
  it('translate lowercases and strips trailing punctuation in acceptedAnswers', () => {
    const c = translate('Salom', 'Hello.');
    expect(c.type).toBe('translate');
    const cfg = c.config as { acceptedAnswers: string[] };
    expect(cfg.acceptedAnswers).toContain('hello.');
    expect(cfg.acceptedAnswers).toContain('hello');
  });

  it('listenType strips ALL punctuation, not just trailing', () => {
    const c = listenType('Yes, of course!');
    const cfg = c.config as { acceptedAnswers: string[] };
    expect(cfg.acceptedAnswers).toContain('yes of course');
  });

  it('mcq config preserves the questions array verbatim', () => {
    const c = mcq([{ text: 'Q', options: ['a', 'b'], correct: 1 }]);
    expect(c.config).toEqual({
      questions: [{ text: 'Q', options: ['a', 'b'], correct: 1 }],
    });
  });

  it('vocabBlock returns 4 components in the order listen_pick → spelling → translate → speak_sentence', () => {
    const block = vocabBlock({
      uz: 'ona',
      en: 'mother',
      distractors: ['father', 'brother', 'sister'],
    });
    expect(block.map((c) => c.type)).toEqual([
      'listen_pick',
      'spelling',
      'translate',
      'speak_sentence',
    ]);
    const speak = block[3].config as { minScore: number };
    expect(speak.minScore).toBe(65);
  });

  it('phraseBlock returns 3 components in the order listen_type → translate → speak_sentence', () => {
    const block = phraseBlock('Xayrli tong', 'Good morning');
    expect(block.map((c) => c.type)).toEqual([
      'listen_type',
      'translate',
      'speak_sentence',
    ]);
    const speak = block[2].config as { minScore: number };
    expect(speak.minScore).toBe(70);
  });

  it('topicSentenceBlock shuffles words deterministically', () => {
    const a = topicSentenceBlock({
      uz: "Men o'quvchiman",
      en: 'I am a pupil',
      words: ['I', 'am', 'a', 'pupil'],
    });
    const b = topicSentenceBlock({
      uz: "Men o'quvchiman",
      en: 'I am a pupil',
      words: ['I', 'am', 'a', 'pupil'],
    });
    const wordOrderA = a[0].config as { sentences: Array<{ words: string[] }> };
    const wordOrderB = b[0].config as { sentences: Array<{ words: string[] }> };
    expect(wordOrderA.sentences[0].words).toEqual(wordOrderB.sentences[0].words);
  });

  it('shuffleStable produces the same output for the same input', () => {
    expect(shuffleStable(['a', 'b', 'c', 'd'])).toEqual(shuffleStable(['a', 'b', 'c', 'd']));
  });
});
