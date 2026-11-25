import { Db } from '../../config/db';
import { addressJson } from '../addresses/address.repository';
import { CreateServiceInput, UpdateServiceInput } from './service.schemas';


const SELECT_SERVICE = `
  SELECT s.service_id, s.customer_id, c.name AS customer_name, c.phone AS customer_phone,
         s.pool_id, p.description AS pool_description, p.filter_type,
         s.scheduled_date, to_char(s.scheduled_time, 'HH24:MI') AS scheduled_time,
         s.description, s.recurrence, s.recurrence_frequency, s.recurrence_months,
         s.status, s.execution_date,
         ${addressJson('a')} AS address
  FROM services s
  JOIN customers c ON c.customer_id = s.customer_id
  JOIN pools p     ON p.pool_id = s.pool_id
  JOIN addresses a ON a.address_id = p.address_id`;

const ORDER = 'ORDER BY s.scheduled_date, s.scheduled_time';

export type ServiceRow = {
  service_id: number;
  customer_id: number;
  pool_id: number;
  status: 'agendado' | 'concluido' | 'cancelado';
  scheduled_date: string;
  scheduled_time: string;
};

export type ServiceFilters = {
  status?: string;
  customer_id?: number;
  pool_id?: number;
  from?: string;
  to?: string;
};

export type ScheduleConflict = {
  scheduled_date: string;
  scheduled_time: string;
};

export async function listServices(db: Db, userId: number, f: ServiceFilters) {
  const { rows } = await db.query(
    `${SELECT_SERVICE}
     WHERE c.user_id = $6
       AND ($1::service_status_enum IS NULL OR s.status = $1)
       AND ($2::int IS NULL OR s.customer_id = $2)
       AND ($3::int IS NULL OR s.pool_id = $3)
       AND ($4::date IS NULL OR s.scheduled_date >= $4)
       AND ($5::date IS NULL OR s.scheduled_date <= $5)
     ${ORDER}`,
    [f.status ?? null, f.customer_id ?? null, f.pool_id ?? null, f.from ?? null, f.to ?? null, userId],
  );
  return rows;
}

/** RF06 / RF12 - Serviços agendados a partir de agora */
export async function listUpcoming(
  db: Db, userId: number, nowDate: string, nowTime: string, until: string | null, limit: number,
) {
  const { rows } = await db.query(
    `${SELECT_SERVICE}
     WHERE c.user_id = $5
       AND s.status = 'agendado'
       AND (s.scheduled_date > $1 OR (s.scheduled_date = $1 AND s.scheduled_time >= $2))
       AND ($3::date IS NULL OR s.scheduled_date <= $3)
     ${ORDER}
     LIMIT $4`,
    [nowDate, nowTime, until, limit, userId],
  );
  return rows;
}

export async function findServiceById(db: Db, userId: number, id: number) {
  const { rows } = await db.query(`${SELECT_SERVICE} WHERE c.user_id = $1 AND s.service_id = $2`, [userId, id]);
  return rows[0];
}

export async function findServicesByIds(db: Db, userId: number, ids: number[]) {
  const { rows } = await db.query(
    `${SELECT_SERVICE} WHERE c.user_id = $1 AND s.service_id = ANY($2::int[]) ${ORDER}`,
    [userId, ids],
  );
  return rows;
}

export async function findServiceRow(db: Db, userId: number, id: number): Promise<ServiceRow | undefined> {
  const { rows } = await db.query<ServiceRow>(
    `SELECT s.service_id, s.customer_id, s.pool_id, s.status, s.scheduled_date, s.scheduled_time::text
     FROM services s JOIN customers c ON c.customer_id = s.customer_id
     WHERE c.user_id = $1 AND s.service_id = $2`,
    [userId, id],
  );
  return rows[0];
}

/** RN01 - A piscina precisa pertencer ao cliente informado (e o cliente, ao usuário) */
export async function poolBelongsToCustomer(db: Db, userId: number, poolId: number, customerId: number): Promise<boolean> {
  const { rowCount } = await db.query(
    `SELECT 1 FROM pools p JOIN customers c ON c.customer_id = p.customer_id
     WHERE p.pool_id = $1 AND p.customer_id = $2 AND c.user_id = $3`,
    [poolId, customerId, userId],
  );
  return (rowCount ?? 0) > 0;
}

/** RN04 - Datas em que já existe serviço não cancelado em um intervalo menor que 15 minutos */
export async function findScheduleConflicts(
  db: Db, userId: number, dates: string[], time: string, ignoreServiceId: number | null = null,
): Promise<ScheduleConflict[]> {
  const { rows } = await db.query<ScheduleConflict>(
    `SELECT s.scheduled_date, to_char(s.scheduled_time, 'HH24:MI') AS scheduled_time
     FROM services s
     JOIN customers c ON c.customer_id = s.customer_id
     WHERE c.user_id = $4
       AND s.status <> 'cancelado'
       AND ABS(EXTRACT(EPOCH FROM (s.scheduled_time - $1::time))) < 300
       AND s.scheduled_date = ANY($2::date[])
       AND ($3::int IS NULL OR s.service_id <> $3)
     ORDER BY s.scheduled_date, s.scheduled_time`,
    [time, dates, ignoreServiceId, userId],
  );
  return rows;
}

export async function insertService(db: Db, data: CreateServiceInput, date: string): Promise<number> {
  const { rows } = await db.query<{ service_id: number }>(
    `INSERT INTO services (customer_id, pool_id, scheduled_date, scheduled_time, description,
                           recurrence, recurrence_frequency, recurrence_months)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING service_id`,
    [data.customer_id, data.pool_id, date, data.scheduled_time, data.description,
      data.recurrence, data.recurrence_frequency, data.recurrence_months],
  );
  return rows[0].service_id;
}

export async function updateService(db: Db, id: number, data: UpdateServiceInput): Promise<void> {
  await db.query(
    `UPDATE services SET customer_id = $2, pool_id = $3, scheduled_date = $4, scheduled_time = $5, description = $6
     WHERE service_id = $1`,
    [id, data.customer_id, data.pool_id, data.scheduled_date, data.scheduled_time, data.description],
  );
}

export async function concludeService(db: Db, id: number, executionDate: string): Promise<void> {
  await db.query(`UPDATE services SET status = 'concluido', execution_date = $2 WHERE service_id = $1`, [id, executionDate]);
}

export async function cancelService(db: Db, id: number): Promise<void> {
  await db.query(`UPDATE services SET status = 'cancelado' WHERE service_id = $1`, [id]);
}

export async function deleteService(db: Db, id: number): Promise<void> {
  await db.query('DELETE FROM services WHERE service_id = $1', [id]);
}