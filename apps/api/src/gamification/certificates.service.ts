import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as QRCode from 'qrcode';

const CERTIFICATE_LEVELS = [
  { level: 'diamond', minLessons: 500 },
  { level: 'gold', minLessons: 250 },
  { level: 'silver', minLessons: 100 },
  { level: 'bronze', minLessons: 50 },
] as const;

@Injectable()
export class CertificatesService {
  constructor(private prisma: PrismaService) {}

  async checkAndAward(studentId: string, tenantId: string) {
    const completedCount = await this.prisma.studentProgress.count({
      where: { studentId, academyCompleted: true },
    });

    const eligible = CERTIFICATE_LEVELS.find((l) => completedCount >= l.minLessons);
    if (!eligible) return null;

    const existing = await this.prisma.certificate.findFirst({
      where: { studentId, level: eligible.level },
    });
    if (existing) return null;

    const qrCode = await QRCode.toDataURL(
      `https://alochi.uz/verify/${tenantId}/${studentId}/${eligible.level}`,
    );

    return this.prisma.certificate.create({
      data: {
        studentId,
        tenantId,
        level: eligible.level,
        lessonsCompleted: completedCount,
        qrCode,
      },
    });
  }

  async getStudentCertificates(studentId: string) {
    return this.prisma.certificate.findMany({
      where: { studentId },
      orderBy: { issuedAt: 'desc' },
    });
  }

  async generatePdf(certificateId: string): Promise<Buffer> {
    const cert = await this.prisma.certificate.findUniqueOrThrow({
      where: { id: certificateId },
      include: {
        student: { select: { name: true } },
        tenant: { select: { name: true } },
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape' });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    const levelLabels: Record<string, string> = {
      bronze: "🥉 Bronze A'lochi",
      silver: "🥈 Silver A'lochi",
      gold: "🥇 Gold A'lochi",
      diamond: "💎 Diamond A'lochi",
    };

    doc
      .fontSize(36)
      .font('Helvetica-Bold')
      .text("A'LOCHI SERTIFIKATI", { align: 'center' });

    doc.moveDown();
    doc.fontSize(20).font('Helvetica').text(cert.student.name, { align: 'center' });

    doc.moveDown(0.5);
    doc.fontSize(24).text(levelLabels[cert.level] ?? cert.level, { align: 'center' });

    doc.moveDown(0.5);
    doc
      .fontSize(14)
      .text(`${cert.lessonsCompleted} ta darsni muvaffaqiyatli tamomladı`, { align: 'center' });

    doc.moveDown(0.5);
    doc
      .fontSize(12)
      .text(
        `${cert.tenant.name} | ${cert.issuedAt.toLocaleDateString('uz-UZ')}`,
        { align: 'center' },
      );

    const qrBuffer = Buffer.from(
      cert.qrCode.replace(/^data:image\/png;base64,/, ''),
      'base64',
    );
    doc.image(qrBuffer, { width: 80, align: 'center' });

    doc.end();

    return new Promise((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });
  }
}
