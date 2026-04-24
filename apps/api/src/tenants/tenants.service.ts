import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTenantDto } from './dto/create-tenant.dto';

@Injectable()
export class TenantsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateTenantDto) {
    const exists = await this.prisma.tenant.findUnique({ where: { slug: dto.slug } });
    if (exists) throw new ConflictException(`"${dto.slug}" slug allaqachon mavjud`);
    return this.prisma.tenant.create({ data: dto });
  }

  async findAll() {
    return this.prisma.tenant.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findById(id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant topilmadi');
    return tenant;
  }
}
