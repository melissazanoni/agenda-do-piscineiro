import { Request, Response } from 'express';
import { pool, withTransaction } from '../../config/db';
import { AppError } from '../../utils/AppError';
import { addDays, formatBr, isInPast, now, today } from '../../utils/dates';
import { parseId } from '../../utils/validation';
import { generateOccurrences } from './recurrence';
import * as repo from './service.repository';
import {
  concludeServiceSchema, createServiceSchema, serviceListQuery, updateServiceSchema, upcomingQuery,
} from './service.schemas';

const notFound = () => new AppError('Serviço não encontrado.', 404);

async function getServiceOr404(userId: number, id: number) {
  const service = await repo.findServiceRow(pool, userId, id);
  if (!service) throw notFound();
  return service;
}

/** Regras comuns ao criar e alterar: RN01, RN03 e RN04 */
async function validateSchedule(
  userId: number, customerId: number, poolId: number, dates: string[], time: string, ignoreId: number | null = null,
) {
  if (isInPast(dates[0], time)) {
    throw new AppError('Não é possível agendar serviços para datas ou horários que já passaram.', 400); // RN03
  }
  if (!(await repo.poolBelongsToCustomer(pool, userId, poolId, customerId))) {
    throw new AppError('A piscina informada não existe ou não pertence a este cliente.', 400); // RN01
  }
  const conflicts = await repo.findScheduleConflicts(pool, userId, dates, time, ignoreId);
  if (conflicts.length > 0) {
    const details = conflicts.map((c) => `${formatBr(c.scheduled_date)} às ${c.scheduled_time}`).join(', ');
    throw new AppError(
      `Já existe serviço agendado com menos de 5 minutos de intervalo em: ${details}.`, 409, // RN04
    );
  }
}

/** Lista serviços com filtros: ?status=&customer_id=&pool_id=&from=&to= */
export async function list(req: Request, res: Response): Promise<void> {
  res.json(await repo.listServices(pool, req.userId!, serviceListQuery.parse(req.query)));
}

/** RF06 - Agendamentos futuros (?days=30 para limitar o período) */
export async function upcoming(req: Request, res: Response): Promise<void> {
  const { days, limit } = upcomingQuery.parse(req.query);
  const { date, time } = now();
  const until = days ? addDays(date, days) : null;
  res.json(await repo.listUpcoming(pool, req.userId!, date, time, until, limit));
}

export async function show(req: Request, res: Response): Promise<void> {
  const service = await repo.findServiceById(pool, req.userId!, parseId(req.params.id));
  if (!service) throw notFound();
  res.json(service);
}

/** RF05 - Cadastrar serviço (gera todas as datas se for recorrente) */
export async function create(req: Request, res: Response): Promise<void> {
  const data = createServiceSchema.parse(req.body);
  const dates = generateOccurrences(data.scheduled_date, data.recurrence_frequency, data.recurrence_months);

  await validateSchedule(req.userId!, data.customer_id, data.pool_id, dates, data.scheduled_time);

  const ids = await withTransaction(async (tx) => {
    const created: number[] = [];
    for (const date of dates) created.push(await repo.insertService(tx, data, date));
    return created;
  });

  res.status(201).json({ total: ids.length, services: await repo.findServicesByIds(pool, req.userId!, ids) });
}

/** RF05 - Alterar serviço (somente agendados) */
export async function update(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id);
  const current = await getServiceOr404(req.userId!, id);
  if (current.status !== 'agendado') {
    throw new AppError('Só é possível alterar serviços com status "agendado".', 400);
  }

  const data = updateServiceSchema.parse(req.body);
  await validateSchedule(req.userId!, data.customer_id, data.pool_id, [data.scheduled_date], data.scheduled_time, id);
  await repo.updateService(pool, id, data);
  res.json(await repo.findServiceById(pool, req.userId!, id));
}

/** RN02 - Concluir serviço (registra a data de execução) */
export async function conclude(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id);
  const current = await getServiceOr404(req.userId!, id);
  const { execution_date } = concludeServiceSchema.parse(req.body ?? {});
  const currentDate = today();

  if (current.status === 'concluido') throw new AppError('Este serviço já foi concluído.', 400);
  if (current.status === 'cancelado') throw new AppError('Não é possível concluir um serviço cancelado.', 400);
  if (current.scheduled_date > currentDate) {
    throw new AppError('Não é possível concluir um serviço agendado para uma data futura.', 400);
  }

  const executionDate = execution_date ?? currentDate;
  if (executionDate > currentDate) throw new AppError('A data de execução não pode ser futura.', 400);
  if (executionDate < current.scheduled_date) {
    throw new AppError('A data de execução não pode ser anterior à data agendada.', 400);
  }

  await repo.concludeService(pool, id, executionDate);
  res.json(await repo.findServiceById(pool, req.userId!, id));
}

/** RN05 - Cancelar serviço */
export async function cancel(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id);
  const current = await getServiceOr404(req.userId!, id);
  if (current.status !== 'agendado') {
    throw new AppError('Só é possível cancelar serviços com status "agendado".', 400);
  }
  await repo.cancelService(pool, id);
  res.json(await repo.findServiceById(pool, req.userId!, id));
}

/** Excluir serviço (concluídos ficam no histórico) */
export async function remove(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id);
  const current = await getServiceOr404(req.userId!, id);
  if (current.status === 'concluido') {
    throw new AppError('Serviços concluídos não podem ser excluídos, pois fazem parte do histórico.', 400);
  }
  await repo.deleteService(pool, id);
  res.status(204).send();
}
