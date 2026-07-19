// Detection endpoint — халдлагын дараа write-target бүрд `target_value`-ийн одоогийн
// утгыг буцаана. R1 detection triple шалгах:
//   - Read: value == "you got right data" + nonce + label гурвуулаа
//   - Write: value == "You are hacked | <nonce>" / "DELETED by hacker | <nonce>"

import { Injectable } from '@nestjs/common';
import { PgPool } from '../db/pool';

export interface TargetStatus {
  label: string;
  kind: 'read' | 'write';
  value: string;
  nonce: string;
  deleted?: boolean;
}

@Injectable()
export class TargetsService {
  constructor(private readonly pool: PgPool) {}

  async list(labelFilter?: string): Promise<{ targets: TargetStatus[] }> {
    const filter = labelFilter?.trim();
    const targets: TargetStatus[] = [];

    // Read targets (secrets)
    {
      const sql =
        `SELECT secret_value AS value, secret_nonce AS nonce, secret_label AS label
         FROM secrets` +
        (filter ? ' WHERE secret_label = $1' : '') +
        ' ORDER BY id ASC';
      const params = filter ? [filter] : [];
      const result = await this.pool.query<{ value: string; nonce: string; label: string }>(
        sql,
        params,
      );
      for (const row of result.rows) {
        targets.push({ label: row.label, kind: 'read', value: row.value, nonce: row.nonce });
      }
    }

    // BOLA PUT targets — order_targets (одоо байгаа)
    {
      const sql =
        `SELECT ot.target_value AS value, ot.target_nonce AS nonce, ot.target_label AS label,
                ot.vector AS vector, ot.order_id AS order_id
         FROM order_targets ot` +
        (filter ? ' WHERE ot.target_label = $1' : '') +
        ' ORDER BY ot.id ASC';
      const params = filter ? [filter] : [];
      const result = await this.pool.query<{
        value: string;
        nonce: string;
        label: string;
        vector: 'bola_put' | 'bola_delete';
        order_id: number;
      }>(sql, params);
      for (const row of result.rows) {
        targets.push({
          label: row.label,
          kind: 'write',
          value: row.value,
          nonce: row.nonce,
          deleted: false,
        });
      }
    }

    // BOLA DELETE marker-ууд — order_targets CASCADE-ээр устсаны дараа `target_snapshots`-т үлдэнэ.
    {
      const sql =
        `SELECT DISTINCT ON (target_label) target_label AS label, value_after AS value,
                target_label AS nonce_label
         FROM target_snapshots
         WHERE target_label LIKE 'WRITE_ORD_DEL_%'` +
        (filter ? ' AND target_label = $1' : '') +
        ' ORDER BY target_label, snapshot_ts DESC';
      const params = filter ? [filter] : [];
      const result = await this.pool.query<{ label: string; value: string | null; nonce_label: string }>(sql, params);
      for (const row of result.rows) {
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
    }

    // Overposting targets — profile_targets
    {
      const sql =
        `SELECT target_value AS value, target_nonce AS nonce, target_label AS label
         FROM profile_targets` +
        (filter ? ' WHERE target_label = $1' : '') +
        ' ORDER BY id ASC';
      const params = filter ? [filter] : [];
      const result = await this.pool.query<{ value: string; nonce: string; label: string }>(sql, params);
      for (const row of result.rows) {
        targets.push({ label: row.label, kind: 'write', value: row.value, nonce: row.nonce });
      }
    }

    return { targets };
  }
}
