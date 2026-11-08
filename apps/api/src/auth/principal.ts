import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { DomainError } from '@marquee/domain';

/** Roles a staff member can hold inside one tenant. Permissions are checked per action. */
export const STAFF_ROLES = [
  'owner',
  'manager',
  'sales',
  'coordinator',
  'accounts',
  'viewer',
] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

/** The verified caller for one request, always resolved from an active membership. */
export interface Principal {
  readonly userId: string;
  readonly displayName: string;
  readonly tenantId: string;
  readonly tenantSlug: string;
  readonly role: StaffRole;
}

/**
 * Parameter decorator that returns the verified principal attached by the staff guard.
 * Throws when a route that needs a principal was reached without one, which indicates a
 * missing guard and must fail closed.
 */
export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Principal => {
    const request = context.switchToHttp().getRequest<{ principal?: Principal }>();
    if (!request.principal) {
      throw new DomainError('UNAUTHENTICATED', 'Sign in is required.');
    }
    return request.principal;
  },
);

/**
 * Asserts that a principal's role is allowed to perform an action.
 * @param principal Verified caller.
 * @param allowed Roles that may perform the action.
 * @throws DomainError FORBIDDEN_SCOPE when the role is not allowed.
 */
export function requireRole(principal: Principal, allowed: readonly StaffRole[]): void {
  if (!allowed.includes(principal.role)) {
    throw new DomainError('FORBIDDEN_SCOPE', 'Your role does not allow this action.');
  }
}
