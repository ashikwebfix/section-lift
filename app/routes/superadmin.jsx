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

const Icon = ({ d }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
);

const ICONS = {
  dashboard: <Icon d={<><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></>} />,
  sections: <Icon d={<><path d="M12 2 2 7l10 5 10-5-10-5z" /><path d="m2 17 10 5 10-5" /><path d="m2 12 10 5 10-5" /></>} />,
  categories: <Icon d={<><path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><circle cx="7" cy="7" r="1.5" /></>} />,
  users: <Icon d={<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>} />,
  logout: <Icon d={<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></>} />,
};

export default function SuperadminLayout() {
  const location = useLocation();

  const navItems = [
    { name: "Dashboard", path: "/superadmin", icon: ICONS.dashboard },
    { name: "Sections", path: "/superadmin/sections", icon: ICONS.sections },
    { name: "Categories", path: "/superadmin/categories", icon: ICONS.categories },
    { name: "Users", path: "/superadmin/users", icon: ICONS.users },
  ];

  const isActive = (path) =>
    location.pathname === path || (path !== "/superadmin" && location.pathname.startsWith(path));

  return (
    <div className="sa-shell">
      <aside className="sa-sidebar">
        <div className="sa-brand">
          <div className="sa-brand-mark">SL</div>
          <div>
            <div className="sa-brand-name">Section Lift</div>
            <div className="sa-brand-sub">Super Admin</div>
          </div>
        </div>

        <div className="sa-nav-label">Manage</div>
        <nav className="sa-nav">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`sa-nav-item ${isActive(item.path) ? "sa-nav-item-active" : ""}`}
            >
              {item.icon}
              {item.name}
            </Link>
          ))}
        </nav>

        <form method="post" style={{ marginTop: "auto" }}>
          <input type="hidden" name="intent" value="logout" />
          <button type="submit" className="sa-logout">
            {ICONS.logout}
            Log out
          </button>
        </form>
      </aside>

      <main className="sa-main">
        <div className="sa-content" key={location.pathname}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
