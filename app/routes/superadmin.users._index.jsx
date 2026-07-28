import { useLoaderData, Link } from "react-router";
import prisma from "../db.server";

export const loader = async () => {
  const users = await prisma.adminUser.findMany({
    orderBy: { created_at: "desc" }
  });
  return { users };
};

export default function SuperadminUsersList() {
  const { users } = useLoaderData();

  return (
    <div className="efx-flex efx-flex-col efx-gap-lg">
      <div className="efx-flex efx-justify-between efx-items-end">
        <div>
          <h1 className="efx-heading-xl" style={{margin:0}}>Manage Users</h1>
          <p className="efx-text-subdued" style={{margin:0}}>Add or remove admin accounts.</p>
        </div>
        <Link to="/superadmin/users/new" className="efx-button efx-button-primary" style={{textDecoration: 'none'}}>
          + Add New User
        </Link>
      </div>

      <div className="efx-glass-card" style={{ padding: '0', overflow: 'hidden' }}>
        <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--efx-border)' }}>
              <th className="efx-text-subdued" style={{ padding: '16px 24px', fontWeight: 500 }}>Name</th>
              <th className="efx-text-subdued" style={{ padding: '16px 24px', fontWeight: 500 }}>Email</th>
              <th className="efx-text-subdued" style={{ padding: '16px 24px', fontWeight: 500 }}>Role</th>
              <th className="efx-text-subdued" style={{ padding: '16px 24px', fontWeight: 500 }}>Joined</th>
              <th className="efx-text-subdued" style={{ padding: '16px 24px', fontWeight: 500, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} style={{ borderBottom: '1px solid var(--efx-border)', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <td style={{ padding: '16px 24px' }}>
                  <span className="efx-text-body" style={{ fontWeight: 500 }}>{user.name}</span>
                </td>
                <td style={{ padding: '16px 24px' }}>
                  <span className="efx-text-body" style={{ margin: 0 }}>{user.email}</span>
                </td>
                <td style={{ padding: '16px 24px' }}>
                  <span className="efx-badge" style={{ margin: 0 }}>{user.role}</span>
                </td>
                <td style={{ padding: '16px 24px' }}>
                  <span className="efx-text-body" style={{ margin: 0 }}>{new Date(user.created_at).toLocaleDateString()}</span>
                </td>
                <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                  <Link to={`/superadmin/users/${user.id}`} className="efx-button" style={{textDecoration: 'none'}}>
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
               <tr style={{ borderBottom: '1px solid var(--efx-border)' }}>
                 <td colSpan="5" style={{ padding: '32px', textAlign: 'center', color: 'var(--efx-text-subdued)' }}>
                   No users found. You are currently using the master fallback account.
                 </td>
               </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
