import { prisma } from './db';

const TENANT_MODELS = new Set(['User', 'Task', 'Announcement', 'AuditLog', 'Invite']);
const WHERE_OPS = new Set(['findFirst', 'findFirstOrThrow', 'findMany', 'count', 'aggregate', 'groupBy', 'updateMany', 'deleteMany']);

type TenantArgs = {
  where?: Record<string, unknown>;
  data?: unknown;
};

export function applyTenantScope(model: string | undefined, operation: string, args: TenantArgs, teamId: string): TenantArgs {
  if (!model || !TENANT_MODELS.has(model)) return args;
  if (WHERE_OPS.has(operation)) {
    return { ...args, where: { ...(args.where ?? {}), teamId } };
  }
  if (operation === 'create') {
    return { ...args, data: { ...(args.data as Record<string, unknown>), teamId } };
  }
  if (operation === 'createMany') {
    const data = args.data;
    return {
      ...args,
      data: Array.isArray(data)
        ? data.map((item) => ({ ...(item as Record<string, unknown>), teamId }))
        : { ...(data as Record<string, unknown>), teamId },
    };
  }
  return args;
}

export function tenantDb(teamId: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          return query(applyTenantScope(model, operation, args as TenantArgs, teamId));
        },
      },
    },
  });
}

export function assertSameTeam(row: { teamId: string | null } | null | undefined, teamId: string) {
  return !!row && row.teamId === teamId;
}
