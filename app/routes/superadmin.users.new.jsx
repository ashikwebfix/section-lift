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
    <div className="sl-page-container">
      <div className="sl-page-header sl-flex sl-items-center sl-gap-4">
        <Link to="/superadmin/users" className="sl-btn sl-btn-secondary">
          ← Back
        </Link>
        <h1 className="sl-page-title" style={{marginBottom: 0}}>Add New User</h1>
      </div>

      <div className="sl-card sa-form-card" style={{ maxWidth: '600px', margin: '0 auto' }}>
        {actionData?.error && (
          <div className="sl-p-6 sl-pb-0">
            <div className="sl-alert sl-alert-error" role="alert">{actionData.error}</div>
          </div>
        )}
        <Form method="post" className="sa-form-section">
          <div className="sl-field">
            <label className="sl-label-text">Name</label>
            <input type="text" name="name" className="sl-input" required />
          </div>

          <div className="sl-field">
            <label className="sl-label-text">Email</label>
            <input type="email" name="email" className="sl-input" required />
          </div>

          <div className="sl-field">
            <label className="sl-label-text">Password</label>
            <input type="password" name="password" className="sl-input" required minLength="6" />
          </div>
          
          <div className="sl-field">
            <label className="sl-label-text">Role</label>
            <select name="role" className="sl-select">
              <option value="ADMIN">Admin</option>
              <option value="STAFF">Staff</option>
            </select>
          </div>

          <div className="sa-form-footer">
            <button type="submit" className="sl-btn sl-btn-primary">
              Create User
            </button>
          </div>
        </Form>
      </div>
    </div>
  );
}
