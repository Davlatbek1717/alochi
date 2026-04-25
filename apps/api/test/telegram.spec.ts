import { TelegramService } from '../src/telegram/telegram.service';

describe('TelegramService', () => {
  it('formats daily report correctly', () => {
    const service = new TelegramService({ get: () => undefined } as any);

    const report = service.formatDailyReport({
      studentName: 'Alibek Rahimov',
      date: '23-Aprel',
      lessons: 1,
      englishStatus: 'green',
      personalStatus: 'yellow',
      criticalStatus: 'yellow',
      studyMinutes: 45,
      streak: 12,
      totalXp: 2340,
    });

    expect(report).toContain('Alibek Rahimov');
    expect(report).toContain('🟢');
    expect(report).toContain('12');
  });

  it('formats warning notification with block message when count >= 3', () => {
    const service = new TelegramService({ get: () => undefined } as any);
    const msg = service.formatWarningNotification('Test User', 3, 'Darsga kelmadi');
    expect(msg).toContain('bloklandi');
    expect(msg).toContain('Test User');
  });
});
