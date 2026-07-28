import { Form, redirect, useActionData, Link } from "react-router";
import prisma from "../db.server";
import bcrypt from "bcryptjs";

export const action = async ({ request }) => {
  const formData = await request.formData();
  const name = formData.get("name");
  const email = formData.get("email");
  const password = formData.get("password");
  const role = formData.get("role") || "ADMIN";

  if (!name || !email || !password) {
    return { error: "Name, email, and password are required" };
  }

  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing) {
    return { error: "Email is already registered" };
  }

  const password_hash = await bcrypt.hash(password, 10);

  await prisma.adminUser.create({
    data: {
      name,
      email,
      password_hash,
      role
    }
  });

  return redirect("/superadmin/users");
};

export default function SuperadminUsersNew() {
  const actionData = useActionData();

  return (
    <div className="efx-flex efx-flex-col efx-gap-lg">
      <div className="efx-flex efx-items-center efx-gap-md">
        <Link to="/superadmin/users" className="efx-button" style={{textDecoration: 'none'}}>
          ← Back
        </Link>
        <h1 className="efx-heading-xl" style={{margin:0}}>Add New User</h1>
      </div>

      <div className="efx-glass-card" style={{ maxWidth: '600px' }}>
        {actionData?.error && (
          <div style={{ padding: '12px', background: 'var(--efx-color-error)', color: 'white', borderRadius: '4px', marginBottom: '16px' }}>
            {actionData.error}
          </div>
        )}
        <Form method="post" className="efx-flex efx-flex-col efx-gap-md">
          <div className="efx-flex efx-flex-col efx-gap-xs">
            <label className="efx-text-body" style={{ fontWeight: 500 }}>Name</label>
            <input type="text" name="name" className="efx-input" required />
          </div>

          <div className="efx-flex efx-flex-col efx-gap-xs">
            <label className="efx-text-body" style={{ fontWeight: 500 }}>Email</label>
            <input type="email" name="email" className="efx-input" required />
          </div>

          <div className="efx-flex efx-flex-col efx-gap-xs">
            <label className="efx-text-body" style={{ fontWeight: 500 }}>Password</label>
            <input type="password" name="password" className="efx-input" required minLength="6" />
          </div>
          
          <div className="efx-flex efx-flex-col efx-gap-xs">
            <label className="efx-text-body" style={{ fontWeight: 500 }}>Role</label>
            <select name="role" className="efx-input">
              <option value="ADMIN">Admin</option>
              <option value="STAFF">Staff</option>
            </select>
          </div>

          <div className="efx-flex efx-justify-end efx-mt-md">
            <button type="submit" className="efx-button efx-button-primary">
              Create User
            </button>
          </div>
        </Form>
      </div>
    </div>
  );
}
