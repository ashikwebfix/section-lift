import { useActionData, useNavigation, Form, redirect } from "react-router";
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
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="sa-login">
      <div className="sa-login-card">
        <div className="sl-flex sl-flex-col sl-items-center sl-gap-3 sl-text-center">
          <div className="sa-brand-mark" style={{ width: 44, height: 44, fontSize: 17 }}>SL</div>
          <div>
            <h1 className="sl-page-title">Super Admin</h1>
            <p className="sl-body sl-mt-1">Sign in to manage Section Lift.</p>
          </div>
        </div>

        {actionData?.error && (
          <div className="sl-alert sl-alert-error" role="alert">{actionData.error}</div>
        )}

        <Form method="post" className="sl-flex sl-flex-col sl-gap-4">
          <div className="sl-field">
            <label htmlFor="sa-email" className="sl-label-text" style={{ marginBottom: 0 }}>Email</label>
            <input
              id="sa-email"
              type="text"
              name="email"
              placeholder="you@company.com"
              className="sl-input"
              autoComplete="username"
              required
              autoFocus
            />
          </div>
          <div className="sl-field">
            <label htmlFor="sa-password" className="sl-label-text" style={{ marginBottom: 0 }}>Password</label>
            <input
              id="sa-password"
              type="password"
              name="password"
              placeholder="••••••••"
              className="sl-input"
              autoComplete="current-password"
              required
            />
          </div>
          <button type="submit" className="sl-btn sl-btn-primary sl-btn-lg sl-w-full sl-mt-2" disabled={isSubmitting}>
            {isSubmitting ? "Signing in…" : "Sign in"}
          </button>
        </Form>
      </div>
    </div>
  );
}
