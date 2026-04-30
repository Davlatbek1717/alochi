import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { OnboardTenantDto } from './dto/onboard-tenant.dto';

const SLUG_TAKEN_MESSAGE = 'Bu slug band, boshqasini tanlang';

@Injectable()
export class TenantsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateTenantDto) {
    const exists = await this.prisma.tenant.findUnique({
      where: { slug: dto.slug },
    });
    if (exists)
      throw new ConflictException(`"${dto.slug}" slug allaqachon mavjud`);
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

  async onboardTenant(dto: OnboardTenantDto) {
    const existing = await this.prisma.tenant.findUnique({
      where: { slug: dto.tenant.slug },
    });
    if (existing) {
      throw new ConflictException(SLUG_TAKEN_MESSAGE);
    }

    const passwordHash = await bcrypt.hash(dto.admin.password, 12);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: {
            name: dto.tenant.name,
            slug: dto.tenant.slug,
            status: 'active',
          },
        });

        let branch: { id: string; name: string } | null = null;
        if (dto.branch) {
          const created = await tx.branch.create({
            data: { tenantId: tenant.id, name: dto.branch.name },
          });
          branch = { id: created.id, name: created.name };
        }

        const admin = await tx.user.create({
          data: {
            tenantId: tenant.id,
            branchId: branch?.id,
            role: UserRole.filadmin,
            name: dto.admin.name,
            login: dto.admin.login,
            passwordHash,
            phone: dto.admin.phone,
            status: 'active',
          },
        });

        return {
          tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
          admin: { id: admin.id, name: admin.name, login: admin.login },
          branch,
        };
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException(SLUG_TAKEN_MESSAGE);
      }
      throw e;
    }
  }
}
