// Prisma ORM хувилбарын detection endpoint. Схем `nestjs/raw-sql`-тэй ижил response.

import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../db/prisma.service';

export interface TargetStatus {
  label: string;
  kind: 'read' | 'write';
  value: string;
  nonce: string;
  deleted?: boolean;
}

@Injectable()
export class TargetsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(labelFilter?: string): Promise<{ targets: TargetStatus[] }> {
    const targets: TargetStatus[] = [];

    const secrets = await this.prisma.secret.findMany({
      where: labelFilter ? { secretLabel: labelFilter } : undefined,
      orderBy: { id: 'asc' },
    });
    for (const s of secrets) {
      targets.push({
        label: s.secretLabel,
        kind: 'read',
        value: s.secretValue,
        nonce: s.secretNonce,
      });
    }

    const orderTargets = await this.prisma.orderTarget.findMany({
      where: labelFilter ? { targetLabel: labelFilter } : undefined,
      orderBy: { id: 'asc' },
    });
    for (const t of orderTargets) {
      targets.push({
        label: t.targetLabel,
        kind: 'write',
        value: t.targetValue,
        nonce: t.targetNonce,
        deleted: false,
      });
    }

    // BOLA DELETE marker — CASCADE-ээр устсаны дараа `target_snapshots`-т үлдэнэ.
    const snapshots = labelFilter
      ? await this.prisma.$queryRaw<Array<{ label: string; value: string | null }>>(Prisma.sql`
          SELECT DISTINCT ON (target_label) target_label AS label, value_after AS value
          FROM target_snapshots
          WHERE target_label LIKE 'WRITE_ORD_DEL_%' AND target_label = ${labelFilter}
          ORDER BY target_label, snapshot_ts DESC`)
      : await this.prisma.$queryRaw<Array<{ label: string; value: string | null }>>(Prisma.sql`
          SELECT DISTINCT ON (target_label) target_label AS label, value_after AS value
          FROM target_snapshots
          WHERE target_label LIKE 'WRITE_ORD_DEL_%'
          ORDER BY target_label, snapshot_ts DESC`);
    for (const row of snapshots) {
      if (!row.value) continue;
      const noncePart = row.value.split('|').pop()?.trim() ?? '';
      targets.push({
        label: row.label,
        kind: 'write',
        value: row.value,
        nonce: noncePart,
        deleted: true,
      });
    }

    const profileTargets = await this.prisma.profileTarget.findMany({
      where: labelFilter ? { targetLabel: labelFilter } : undefined,
      orderBy: { id: 'asc' },
    });
    for (const t of profileTargets) {
      targets.push({
        label: t.targetLabel,
        kind: 'write',
        value: t.targetValue,
        nonce: t.targetNonce,
      });
    }

    return { targets };
  }
}
