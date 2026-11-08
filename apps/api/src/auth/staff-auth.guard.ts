import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import {
  findActiveMembership,
  findActiveMembershipsForUser,
  type DatabaseClient,
} from '@marquee/database';
import { DomainError } from '@marquee/domain';

import type { AppConfig } from '../config/env';
import { APP_CONFIG, DATABASE } from '../core/tokens';

import type { Principal } from './principal';

/** Header naming the development user. Accepted only when AUTH_MODE=dev. */
const DEV_USER_HEADER = 'x-dev-user-id';

/** Header naming the tenant the caller wants. A selector only; membership is verified. */
const TENANT_HEADER = 'x-tenant-id';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolves the caller for staff routes and checks that they hold an active membership in
 * the requested tenant. This is a development placeholder: it trusts a header and is
 * refused in production by configuration. It is replaced by the chosen OIDC provider
 * (see ADR-0005), and the membership check stays.
 */
@Injectable()
export class StaffAuthGuard implements CanActivate {
  private readonly config: AppConfig;
  private readonly database: DatabaseClient;

  /**
   * @param config Validated configuration.
   * @param database Database handle.
   */
  constructor(@Inject(APP_CONFIG) config: AppConfig, @Inject(DATABASE) database: DatabaseClient) {
    this.config = config;
    this.database = database;
  }

  /**
   * Attaches a verified principal to the request or throws.
   * @param context Nest execution context.
   * @returns True when the caller is authenticated and authorised for the tenant.
   * @throws DomainError UNAUTHENTICATED, FORBIDDEN_SCOPE or VALIDATION_FAILED.
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Typed as string: the mode set widens when an identity provider is added.
    const authMode: string = this.config.authMode;
    if (authMode !== 'dev') {
      throw new DomainError('UNAUTHENTICATED', 'Sign in is not configured for this environment.');
    }
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      principal?: Principal;
    }>();

    const userId = singleHeader(request.headers[DEV_USER_HEADER]);
    if (!userId || !UUID_PATTERN.test(userId)) {
      throw new DomainError('UNAUTHENTICATED', 'Sign in is required.');
    }

    const requestedTenant = singleHeader(request.headers[TENANT_HEADER]);
    const membership = await this.resolveMembership(userId, requestedTenant);
    request.principal = {
      userId: membership.userId,
      displayName: membership.userDisplayName,
      tenantId: membership.tenantId,
      tenantSlug: membership.tenantSlug,
      role: membership.role,
    };
    return true;
  }

  /**
   * Finds the membership to use: the requested tenant if the caller belongs to it, or the
   * caller's only tenant when no tenant is named.
   * @param userId Authenticated user identifier.
   * @param requestedTenant Tenant identifier from the header, if any.
   * @returns The active membership.
   * @throws DomainError FORBIDDEN_SCOPE or VALIDATION_FAILED.
   */
  private async resolveMembership(userId: string, requestedTenant: string | undefined) {
    if (requestedTenant !== undefined) {
      if (!UUID_PATTERN.test(requestedTenant)) {
        throw new DomainError('VALIDATION_FAILED', 'Tenant identifier must be a UUID.');
      }
      const membership = await findActiveMembership(this.database.db, userId, requestedTenant);
      if (!membership) {
        throw new DomainError('FORBIDDEN_SCOPE', 'You do not have access to that workspace.');
      }
      return membership;
    }
    const memberships = await findActiveMembershipsForUser(this.database.db, userId);
    if (memberships.length === 0) {
      throw new DomainError('FORBIDDEN_SCOPE', 'Your account is not linked to a workspace.');
    }
    if (memberships.length > 1) {
      throw new DomainError(
        'VALIDATION_FAILED',
        'Choose a workspace by sending the x-tenant-id header.',
      );
    }
    const [only] = memberships;
    if (!only) {
      throw new DomainError('FORBIDDEN_SCOPE', 'Your account is not linked to a workspace.');
    }
    return only;
  }
}

/**
 * Reads a header that must appear at most once.
 * @param value Raw header value.
 * @returns The single value, or undefined.
 */
function singleHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? undefined : value;
}
