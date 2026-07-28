import { useActionData, Form, redirect } from "react-router";
import { sessionStorage } from "../superadmin.server";

import bcrypt from "bcryptjs";
import prisma from "../db.server";

export const action = async ({ request }) => {
  const formData = await request.formData();
  const email = formData.get("email");
  const password = formData.get("password");
  
  const correctPassword = process.env.ADMIN_PASSWORD || "admin123";

  if (email === "admin" && password === correctPassword) {
    const session = await sessionStorage.getSession();
    session.set("adminId", "superadmin");
    return redirect("/superadmin", {
      headers: {
        "Set-Cookie": await sessionStorage.commitSession(session),
      },
    });
  }

  if (email && password) {
    const user = await prisma.adminUser.findUnique({ where: { email: email.toString() } });
    if (user) {
      const isValid = await bcrypt.compare(password.toString(), user.password_hash);
      if (isValid) {
        const session = await sessionStorage.getSession();
        session.set("adminId", user.id);
        return redirect("/superadmin", {
          headers: {
            "Set-Cookie": await sessionStorage.commitSession(session),
          },
        });
      }
    }
  }

  return { error: "Invalid credentials" };
};

export default function SuperadminLogin() {
  const actionData = useActionData();

  return (
    <div className="efx-flex efx-items-center efx-justify-center" style={{ minHeight: '100vh', background: 'var(--efx-bg-gradient)' }}>
      <div className="efx-glass-card efx-flex efx-flex-col efx-gap-md" style={{ width: '100%', maxWidth: '400px' }}>
        <h1 className="efx-heading-xl" style={{ textAlign: 'center', marginBottom: '8px' }}>Admin Login</h1>
        <p className="efx-text-subdued" style={{ textAlign: 'center' }}>
          Enter the master password to access the super admin portal.
        </p>

        {actionData?.error && (
          <div style={{ padding: '12px', background: 'var(--efx-color-error)', color: 'white', borderRadius: '4px', textAlign: 'center' }}>
            {actionData.error}
          </div>
        )}

        <Form method="post" className="efx-flex efx-flex-col efx-gap-md">
          <input 
            type="text" 
            name="email" 
            placeholder="Email (or 'admin' for master)" 
            className="efx-input" 
            required
            autoFocus
          />
          <input 
            type="password" 
            name="password" 
            placeholder="Password" 
            className="efx-input" 
            required
          />
          <button type="submit" className="efx-button efx-button-primary">
            Login
          </button>
        </Form>
      </div>
    </div>
  );
}
