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
    <div className="efx-flex efx-flex-col efx-gap-lg">
      <div className="efx-flex efx-items-center efx-justify-between">
        <div className="efx-flex efx-items-center efx-gap-md">
          <Link to="/superadmin/users" className="efx-button" style={{textDecoration: 'none'}}>
            ← Back
          </Link>
          <h1 className="efx-heading-xl" style={{margin:0}}>Edit User</h1>
        </div>
        
        <Form method="post" onSubmit={e => { if(!confirm("Are you sure you want to delete this user?")) e.preventDefault() }}>
          <input type="hidden" name="intent" value="delete" />
          <button type="submit" className="efx-button" style={{color: 'var(--efx-color-error)', border: '1px solid var(--efx-color-error)', background: 'transparent'}}>
            Delete User
          </button>
        </Form>
      </div>

      <div className="efx-glass-card" style={{ maxWidth: '600px' }}>
        {actionData?.error && (
          <div style={{ padding: '12px', background: 'var(--efx-color-error)', color: 'white', borderRadius: '4px', marginBottom: '16px' }}>
            {actionData.error}
          </div>
        )}
        <Form method="post" className="efx-flex efx-flex-col efx-gap-md">
          <input type="hidden" name="intent" value="edit" />
          
          <div className="efx-flex efx-flex-col efx-gap-xs">
            <label className="efx-text-body" style={{ fontWeight: 500 }}>Name</label>
            <input type="text" name="name" defaultValue={user.name} className="efx-input" required />
          </div>

          <div className="efx-flex efx-flex-col efx-gap-xs">
            <label className="efx-text-body" style={{ fontWeight: 500 }}>Email</label>
            <input type="email" name="email" defaultValue={user.email} className="efx-input" required />
          </div>
          
          <div className="efx-flex efx-flex-col efx-gap-xs">
            <label className="efx-text-body" style={{ fontWeight: 500 }}>Role</label>
            <select name="role" defaultValue={user.role} className="efx-input">
              <option value="ADMIN">Admin</option>
              <option value="STAFF">Staff</option>
            </select>
          </div>

          <div className="efx-flex efx-flex-col efx-gap-xs">
            <label className="efx-text-body" style={{ fontWeight: 500 }}>New Password (leave blank to keep current)</label>
            <input type="password" name="password" className="efx-input" minLength="6" />
          </div>

          <div className="efx-flex efx-justify-end efx-mt-md">
            <button type="submit" className="efx-button efx-button-primary">
              Save Changes
            </button>
          </div>
        </Form>
      </div>
    </div>
  );
}
