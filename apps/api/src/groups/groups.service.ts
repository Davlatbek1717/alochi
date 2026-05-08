import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GroupsService {
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {}

  // ── invalidate marketing student cache after group changes ──────────
  private async invalidateStudentCache() {
    await Promise.all([
      this.cache.del('mc:students:50:0').catch(() => undefined),
      this.cache.del('mc:students:100:0').catch(() => undefined),
    ]);
  }

  // ── list groups for a single branch (filadmin / manager view) ───────
  async listForBranch(branchId: string, tenantId: string) {
    const groups = await this.prisma.group.findMany({
      where: { branchId, tenantId },
      orderBy: { name: 'asc' },
    });

    return Promise.all(
      groups.map(async (g) => {
        const [studentCount, mentor] = await Promise.all([
          this.prisma.user.count({
            where: { groupId: g.id, role: 'student', tenantId },
          }),
          g.mentorId
            ? this.prisma.user.findFirst({
                where: { id: g.mentorId, tenantId },
                select: { id: true, name: true },
              })
            : null,
        ]);
        return { ...g, studentCount, mentor };
      }),
    );
  }

  // ── list groups tenant-wide (superadmin view) ────────────────────────
  async listForTenant(tenantId: string) {
    const groups = await this.prisma.group.findMany({
      where: { tenantId },
      orderBy: [{ branchId: 'asc' }, { name: 'asc' }],
      include: { branch: { select: { id: true, name: true } } },
    });

    return Promise.all(
      groups.map(async (g) => {
        const [studentCount, mentor] = await Promise.all([
          this.prisma.user.count({
            where: { groupId: g.id, role: 'student', tenantId },
          }),
          g.mentorId
            ? this.prisma.user.findFirst({
                where: { id: g.mentorId, tenantId },
                select: { id: true, name: true },
              })
            : null,
        ]);
        return { ...g, studentCount, mentor };
      }),
    );
  }

  // ── create ─────────────────────────────────────────────────────────────
  async create(
    tenantId: string,
    branchId: string,
    name: string,
    mentorId: string | null,
  ) {
    if (!name?.trim()) throw new BadRequestException('Guruh nomi kerak');

    // Validate branch belongs to tenant
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, tenantId },
    });
    if (!branch) throw new NotFoundException('Filial topilmadi');

    // Validate mentor if provided
    if (mentorId) {
      await this.validateMentor(mentorId, branchId, tenantId);
    }

    const group = await this.prisma.group.create({
      data: {
        tenantId,
        branchId,
        name: name.trim(),
        mentorId: mentorId ?? null,
      },
    });

    // Assign mentor's groupId to the new group
    if (mentorId) {
      await this.setMentorGroup(mentorId, group.id, tenantId);
    }

    await this.invalidateStudentCache();
    return group;
  }

  // ── update ─────────────────────────────────────────────────────────────
  async update(
    id: string,
    tenantId: string,
    data: { name?: string; mentorId?: string | null },
  ) {
    const group = await this.findById(id, tenantId);

    if (data.name !== undefined) {
      if (!data.name.trim()) throw new BadRequestException('Guruh nomi kerak');
    }

    if (data.mentorId !== undefined && data.mentorId !== group.mentorId) {
      // Clear old mentor's groupId
      if (group.mentorId) {
        await this.prisma.user.updateMany({
          where: { id: group.mentorId, tenantId },
          data: { groupId: null },
        });
      }
      // Validate and assign new mentor
      if (data.mentorId) {
        await this.validateMentor(data.mentorId, group.branchId, tenantId);
        await this.setMentorGroup(data.mentorId, id, tenantId);
      }
    }

    const patch: { name?: string; mentorId?: string | null } = {};
    if (data.name !== undefined) patch.name = data.name.trim();
    if (data.mentorId !== undefined) patch.mentorId = data.mentorId ?? null;

    const updated = await this.prisma.group.update({
      where: { id },
      data: patch,
    });

    await this.invalidateStudentCache();
    return updated;
  }

  // ── add students (bulk) ─────────────────────────────────────────────────
  async addStudents(groupId: string, tenantId: string, studentIds: string[]) {
    const group = await this.findById(groupId, tenantId);

    // Validate: all must be students in the same branch
    const students = await this.prisma.user.findMany({
      where: { id: { in: studentIds }, tenantId },
      select: { id: true, role: true, branchId: true },
    });

    for (const s of students) {
      if (s.role !== 'student') {
        throw new BadRequestException(`Foydalanuvchi ${s.id} o'quvchi emas`);
      }
      if (s.branchId !== group.branchId) {
        throw new BadRequestException(
          `O'quvchi ${s.id} bu filialga tegishli emas`,
        );
      }
    }

    if (students.length !== studentIds.length) {
      throw new BadRequestException("Ba'zi o'quvchilar topilmadi");
    }

    await this.prisma.user.updateMany({
      where: { id: { in: studentIds }, tenantId },
      data: { groupId },
    });

    await this.invalidateStudentCache();
    return { updated: studentIds.length };
  }

  // ── remove a single student ─────────────────────────────────────────────
  async removeStudent(groupId: string, tenantId: string, studentId: string) {
    await this.findById(groupId, tenantId);

    const student = await this.prisma.user.findFirst({
      where: { id: studentId, tenantId, groupId, role: 'student' },
    });
    if (!student) {
      throw new NotFoundException("O'quvchi bu guruhda topilmadi");
    }

    await this.prisma.user.update({
      where: { id: studentId },
      data: { groupId: null },
    });

    await this.invalidateStudentCache();
    return { removed: true };
  }

  // ── delete ─────────────────────────────────────────────────────────────
  async delete(id: string, tenantId: string) {
    const group = await this.findById(id, tenantId);

    const studentCount = await this.prisma.user.count({
      where: { groupId: id, role: 'student', tenantId },
    });
    if (studentCount > 0) {
      throw new BadRequestException(
        `Guruhda ${studentCount} ta o'quvchi bor. Avval ularni boshqa guruhga ko'chiring yoki guruhdan chiqaring.`,
      );
    }

    // Clear mentor's groupId
    if (group.mentorId) {
      await this.prisma.user.updateMany({
        where: { id: group.mentorId, tenantId },
        data: { groupId: null },
      });
    }

    await this.prisma.group.delete({ where: { id } });
    await this.invalidateStudentCache();
    return { deleted: true };
  }

  // ── helpers ──────────────────────────────────────────────────────────────
  private async findById(id: string, tenantId: string) {
    const group = await this.prisma.group.findFirst({
      where: { id, tenantId },
    });
    if (!group) throw new NotFoundException('Guruh topilmadi');
    return group;
  }

  private async validateMentor(
    mentorId: string,
    branchId: string,
    tenantId: string,
  ) {
    const mentor = await this.prisma.user.findFirst({
      where: { id: mentorId, tenantId, role: 'mentor' },
    });
    if (!mentor) {
      throw new BadRequestException('Mentor topilmadi yoki rol mos emas');
    }
    if (mentor.branchId !== branchId) {
      throw new BadRequestException('Mentor bu filialga tegishli emas');
    }
  }

  private async setMentorGroup(
    mentorId: string,
    groupId: string,
    tenantId: string,
  ) {
    // If mentor already leads another group, clear that group's mentorId first
    const currentGroup = await this.prisma.group.findFirst({
      where: { mentorId, tenantId, id: { not: groupId } },
    });
    if (currentGroup) {
      await this.prisma.group.update({
        where: { id: currentGroup.id },
        data: { mentorId: null },
      });
    }
    await this.prisma.user.update({
      where: { id: mentorId },
      data: { groupId },
    });
  }
}
