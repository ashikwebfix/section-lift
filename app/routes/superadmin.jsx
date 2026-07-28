import { Outlet, Link, useLocation, redirect } from "react-router";
import { requireSuperadmin, sessionStorage } from "../superadmin.server";

export const loader = async ({ request }) => {
  await requireSuperadmin(request);
  return null;
};

export const action = async ({ request }) => {
  const formData = await request.formData();
  if (formData.get("intent") === "logout") {
    const session = await sessionStorage.getSession(request.headers.get("Cookie"));
    return redirect("/superadmin/login", {
      headers: { "Set-Cookie": await sessionStorage.destroySession(session) }
    });
  }
  return null;
};

export default function SuperadminLayout() {
  const location = useLocation();

  const navItems = [
    { name: "Dashboard", path: "/superadmin" },
    { name: "Sections", path: "/superadmin/sections" },
    { name: "Categories", path: "/superadmin/categories" },
    { name: "Users", path: "/superadmin/users" },
  ];

  return (
    <div className="efx-flex efx-flex-row" style={{ minHeight: '100vh', background: 'var(--efx-bg-gradient)' }}>
      {/* Sidebar */}
      <div className="efx-glass-card efx-flex efx-flex-col" style={{ width: '250px', borderRight: '1px solid var(--efx-border)', borderTop: 'none', borderLeft: 'none', borderBottom: 'none', borderRadius: 0, padding: '32px' }}>
        <h2 className="efx-heading-xl efx-mb-lg" style={{ color: 'var(--efx-primary)' }}>Super Admin</h2>
        
        <nav className="efx-flex efx-flex-col efx-gap-sm" style={{ flexGrow: 1 }}>
          {navItems.map(item => (
            <Link 
              key={item.path} 
              to={item.path}
              className={`efx-button ${location.pathname === item.path || (item.path !== '/superadmin' && location.pathname.startsWith(item.path)) ? 'efx-button-primary' : ''}`}
              style={{ textAlign: 'left', justifyContent: 'flex-start', background: location.pathname === item.path || (item.path !== '/superadmin' && location.pathname.startsWith(item.path)) ? '' : 'transparent', color: location.pathname === item.path || (item.path !== '/superadmin' && location.pathname.startsWith(item.path)) ? '' : 'var(--efx-text-main)' }}
            >
              {item.name}
            </Link>
          ))}
        </nav>

        <form method="post" style={{ marginTop: 'auto' }}>
          <input type="hidden" name="intent" value="logout" />
          <button type="submit" className="efx-button" style={{ width: '100%', color: 'var(--efx-color-error)', background: 'transparent', border: '1px solid var(--efx-color-error)' }}>
            Logout
          </button>
        </form>
      </div>

      {/* Main Content */}
      <div className="efx-flex-col" style={{ flexGrow: 1, padding: '48px', overflowY: 'auto', height: '100vh', boxSizing: 'border-box' }}>
        <Outlet />
      </div>
    </div>
  );
}
