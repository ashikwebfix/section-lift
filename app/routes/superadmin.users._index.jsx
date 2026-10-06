import { useLoaderData, Link } from "react-router";
import prisma from "../db.server";

export const loader = async () => {
  const users = await prisma.adminUser.findMany({
    orderBy: { created_at: "desc" },
    include: {
      _count: {
        select: { sections: true }
      }
    }
  });
  return { users };
};

export default function SuperadminUsersList() {
  const { users } = useLoaderData();

  return (
    <div className="sl-page-container">
      <div className="sl-page-header sl-flex sl-justify-between sl-items-center">
        <div>
          <h1 className="sl-page-title">Manage Users</h1>
          <p className="sl-page-desc">Add or remove admin accounts.</p>
        </div>
        <Link to="/superadmin/users/new" className="sl-btn sl-btn-primary">
          + Add New User
        </Link>
      </div>

      <div className="sl-card" style={{ padding: '0', overflow: 'hidden' }}>
        <div className="sl-table-wrapper">
          <table className="sl-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Sections Added</th>
                <th>Joined</th>
                <th className="sl-text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td><strong>{user.name}</strong></td>
                  <td>{user.email}</td>
                  <td><span className="sl-badge">{user.role}</span></td>
                  <td>{user._count.sections}</td>
                  <td className="sl-text-subdued">{new Date(user.created_at).toLocaleDateString()}</td>
                  <td className="sl-text-right">
                    <Link to={`/superadmin/users/${user.id}`} className="sl-btn sl-btn-secondary sl-btn-sm">
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                 <tr>
                   <td colSpan="6" className="sl-text-center sl-text-subdued sl-p-8">
                     No users found. You are currently using the master fallback account.
                   </td>
                 </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
