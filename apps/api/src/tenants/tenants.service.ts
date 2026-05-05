import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ContactRequestStatus, Prisma, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { I18nService } from '../i18n/i18n.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { OnboardTenantDto } from './dto/onboard-tenant.dto';
import { UpdateTenantSettingsDto } from './dto/update-tenant-settings.dto';

const SLUG_TAKEN_MESSAGE = 'Bu slug band, boshqasini tanlang';

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);

  constructor(
    private prisma: PrismaService,
    private i18n: I18nService,
  ) {}

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

  /**
   * Tenant list shape for the /superadmin/tenants page:
   * { id, name, slug, createdAt, _count: { users, branches } }.
   */
  async listAllWithCounts() {
    return this.prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        _count: { select: { users: true, branches: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException(this.i18n.t('tenant_not_found'));
    return tenant;
  }

  /**
   * Public branding lookup by slug — no auth required.
   * Used by the login page to render per-tenant logo/colour before
   * the user has a JWT.  Only safe-to-publish fields are returned.
   */
  async getBrandingBySlug(slug: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        brandName: true,
        logoUrl: true,
        faviconUrl: true,
        primaryColor: true,
        isActive: true,
      },
    });
    if (!tenant || !tenant.isActive)
      throw new NotFoundException(this.i18n.t('tenant_not_found'));
    return tenant;
  }

  /**
   * Update mutable tenant-level settings (Phase 5: warningBlockLimit).
   * Returns the updated tenant row.
   */
  async updateSettings(tenantId: string, dto: UpdateTenantSettingsDto) {
    const exists = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException(this.i18n.t('tenant_not_found'));

    const data: Record<string, unknown> = {};
    if (dto.warningBlockLimit !== undefined)
      data.warningBlockLimit = dto.warningBlockLimit;
    if (dto.brandName !== undefined) data.brandName = dto.brandName;
    if (dto.logoUrl !== undefined) data.logoUrl = dto.logoUrl;
    if (dto.faviconUrl !== undefined) data.faviconUrl = dto.faviconUrl;
    if (dto.primaryColor !== undefined) data.primaryColor = dto.primaryColor;

    return this.prisma.tenant.update({
      where: { id: tenantId },
      data,
      select: {
        id: true,
        name: true,
        slug: true,
        warningBlockLimit: true,
        brandName: true,
        logoUrl: true,
        faviconUrl: true,
        primaryColor: true,
      },
    });
  }

  /** 25.C.3: Read certTemplate JSON for a tenant. */
  async getCertTemplate(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { certTemplate: true },
    });
    if (!tenant) throw new NotFoundException(this.i18n.t('tenant_not_found'));
    return { certTemplate: tenant.certTemplate };
  }

  /** 25.C.3: Update certTemplate JSON for a tenant. */
  async setCertTemplate(tenantId: string, certTemplate: unknown) {
    const exists = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException(this.i18n.t('tenant_not_found'));
    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: { certTemplate: certTemplate as Prisma.InputJsonValue },
      select: { id: true, certTemplate: true },
    });
  }

  /**
   * Phase 17 — superadmin renames a tenant. Returns the updated tenant.
   */
  async updateName(id: string, name: string) {
    const exists = await this.prisma.tenant.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException(this.i18n.t('tenant_not_found'));
    return this.prisma.tenant.update({ where: { id }, data: { name } });
  }

  /**
   * Phase 17 — superadmin disables a tenant. Sets tenant.isActive = false and
   * cascade-deactivates all of its users (status = 'inactive').
   */
  async disable(id: string) {
    const exists = await this.prisma.tenant.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException(this.i18n.t('tenant_not_found'));

    return this.prisma.$transaction([
      this.prisma.tenant.update({
        where: { id },
        data: { isActive: false },
      }),
      this.prisma.user.updateMany({
        where: { tenantId: id },
        data: { status: 'inactive' },
      }),
    ]);
  }

  async onboardTenant(dto: OnboardTenantDto, actorUserId?: string) {
    const existing = await this.prisma.tenant.findUnique({
      where: { slug: dto.tenant.slug },
    });
    if (existing) {
      throw new ConflictException(SLUG_TAKEN_MESSAGE);
    }

    const passwordHash = await bcrypt.hash(dto.admin.password, 12);

    let result: {
      tenant: { id: string; name: string; slug: string };
      admin: { id: string; name: string; login: string };
      branch: { id: string; name: string } | null;
    };
    try {
      result = await this.prisma.$transaction(async (tx) => {
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

    // Phase 26 — finalise demo-request funnel. Failure here must NOT roll
    // back the freshly-created tenant: we just log and return.
    if (dto.contactRequestId) {
      try {
        await this.prisma.contactRequest.update({
          where: { id: dto.contactRequestId },
          data: {
            status: ContactRequestStatus.converted,
            convertedTenantId: result.tenant.id,
            handledBy: actorUserId ?? null,
            handledAt: new Date(),
          },
        });
      } catch (err) {
        this.logger.warn(
          `onboardTenant: contact request ${dto.contactRequestId} convert failed: ${err}`,
        );
      }
    }

    return result;
  }
}
