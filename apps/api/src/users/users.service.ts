import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    const exists = await this.prisma.user.findFirst({
      where: { tenantId: dto.tenantId, login: dto.login },
    });
    if (exists) throw new ConflictException('Bu login allaqachon mavjud');

    const { password, ...data } = dto;
    const passwordHash = await bcrypt.hash(password, 12);

    return this.prisma.user.create({ data: { ...data, passwordHash } });
  }

  async findByBranch(branchId: string, tenantId: string) {
    return this.prisma.user.findMany({
      where: { branchId, tenantId },
      select: {
        id: true,
        name: true,
        role: true,
        status: true,
        phone: true,
        login: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string, tenantId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        name: true,
        role: true,
        status: true,
        tenantId: true,
        branchId: true,
        phone: true,
        login: true,
      },
    });
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');
    return user;
  }

  async updateStatus(
    id: string,
    tenantId: string,
    status: 'active' | 'inactive',
  ) {
    await this.findById(id, tenantId);
    return this.prisma.user.update({ where: { id }, data: { status } });
  }
}
