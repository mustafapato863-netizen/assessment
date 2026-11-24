import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LockKeyhole, Shield } from 'lucide-react';
import { api, type AccessAccount } from '../../lib/api';
import { queryKeys } from '../../lib/query-keys';

export function RolesMatrixSection({ accounts }: { accounts: AccessAccount[] }) {
  const {
    data: matrix = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: queryKeys.adminRolesMatrix(),
    queryFn: api.adminRolesMatrix,
    staleTime: 120_000,
  });

  const userCountsByRole = useMemo(() => {
    const map = new Map<string, { active: number; total: number }>();
    for (const acc of accounts) {
      for (const role of acc.roles) {
        const entry = map.get(role) ?? { active: 0, total: 0 };
        entry.total += 1;
        if (acc.active) entry.active += 1;
        map.set(role, entry);
      }
    }
    return map;
  }, [accounts]);

  return (
    <section className="administration-card" aria-label="Roles and Permissions Matrix">
      <div className="administration-card-heading">
        <div>
          <h2>Roles &amp; Permissions Matrix</h2>
          <p>
            Live capability matrix enforced by API route guards. Accounts must hold the listed
            backend role and matching data scope to perform each operation.
          </p>
        </div>
        <span className="administration-chip teal">
          <Shield size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} />
          {matrix.length || 11} governed roles
        </span>
      </div>

      {isLoading ? (
        <div className="admin-table-message">Loading permissions matrix…</div>
      ) : isError ? (
        <div className="administration-error" role="alert">
          Could not load RBAC permissions matrix.
        </div>
      ) : (
        <div className="admin-matrix-grid">
          {matrix.map((entry) => {
            const counts = userCountsByRole.get(entry.role) ?? { active: 0, total: 0 };
            return (
              <article key={entry.role} className="admin-matrix-card">
                <div className="admin-matrix-card-head">
                  <div>
                    <strong>{entry.label}</strong>
                    <code>{entry.role}</code>
                  </div>
                  <span className={`administration-chip ${counts.active > 0 ? 'teal' : 'gray'}`}>
                    {counts.active} active{counts.total > counts.active ? ` / ${counts.total}` : ''}
                  </span>
                </div>
                <p className="admin-matrix-desc">{entry.description}</p>
                <div className="admin-matrix-meta">
                  <span>
                    <LockKeyhole size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                    Allowed scopes: <strong>{entry.allowedScopes.join(', ')}</strong> · Home:{' '}
                    <code>{entry.defaultHome}</code>
                  </span>
                </div>
                <div className="admin-matrix-caps">
                  {entry.capabilities.length > 0 ? (
                    entry.capabilities.map((cap) => (
                      <span key={cap} className="admin-cap-chip">
                        {cap}
                      </span>
                    ))
                  ) : (
                    <span className="sub">Self-service view only</span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
