import { useLoaderData, Form, redirect, useActionData, Link } from "react-router";
import prisma from "../db.server";
import bcrypt from "bcryptjs";

export const loader = async ({ params }) => {
  const user = await prisma.adminUser.findUnique({
    where: { id: params.id },
  });
  if (!user) {
    throw new Response("Not Found", { status: 404 });
  }
  return { user };
};

export const action = async ({ request, params }) => {
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "delete") {
    await prisma.adminUser.delete({ where: { id: params.id } });
    return redirect("/superadmin/users");
  }

  const name = formData.get("name");
  const email = formData.get("email");
  const role = formData.get("role");
  const password = formData.get("password");

  if (!name || !email) {
    return { error: "Name and email are required" };
  }
  
  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing && existing.id !== params.id) {
    return { error: "Email is already in use by another account" };
  }

  const data = { name, email, role };
  
  if (password) {
    data.password_hash = await bcrypt.hash(password, 10);
  }

  await prisma.adminUser.update({
    where: { id: params.id },
    data
  });

  return redirect("/superadmin/users");
};

export default function SuperadminUsersEdit() {
  const { user } = useLoaderData();
  const actionData = useActionData();

  return (
    <div className="sl-page-container">
      <div className="sl-page-header sl-flex sl-justify-between sl-items-center">
        <div className="sl-flex sl-items-center sl-gap-4">
          <Link to="/superadmin/users" className="sl-btn sl-btn-secondary">
            ← Back
          </Link>
          <h1 className="sl-page-title" style={{marginBottom: 0}}>Edit User</h1>
        </div>
        
        <Form method="post" onSubmit={e => { if(!confirm("Are you sure you want to delete this user?")) e.preventDefault() }}>
          <input type="hidden" name="intent" value="delete" />
          <button type="submit" className="sl-btn sl-btn-secondary" style={{ color: 'var(--sl-color-error)', borderColor: 'var(--sl-color-error-muted)' }}>
            Delete User
          </button>
        </Form>
      </div>

      <div className="sl-card sa-form-card" style={{ maxWidth: '600px', margin: '0 auto' }}>
        {actionData?.error && (
          <div className="sl-p-6 sl-pb-0">
            <div className="sl-alert sl-alert-error" role="alert">{actionData.error}</div>
          </div>
        )}
        <Form method="post" className="sa-form-section">
          <input type="hidden" name="intent" value="edit" />
          
          <div className="sl-field">
            <label className="sl-label-text">Name</label>
            <input type="text" name="name" defaultValue={user.name} className="sl-input" required />
          </div>

          <div className="sl-field">
            <label className="sl-label-text">Email</label>
            <input type="email" name="email" defaultValue={user.email} className="sl-input" required />
          </div>
          
          <div className="sl-field">
            <label className="sl-label-text">Role</label>
            <select name="role" defaultValue={user.role} className="sl-select">
              <option value="ADMIN">Admin</option>
              <option value="STAFF">Staff</option>
            </select>
          </div>

          <div className="sl-field">
            <label className="sl-label-text">New Password <span className="sa-hint">(leave blank to keep current)</span></label>
            <input type="password" name="password" className="sl-input" minLength="6" />
          </div>

          <div className="sa-form-footer">
            <button type="submit" className="sl-btn sl-btn-primary">
              Save Changes
            </button>
          </div>
        </Form>
      </div>
    </div>
  );
}
