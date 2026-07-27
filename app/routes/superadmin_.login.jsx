import { useActionData, Form, redirect } from "react-router";
import { sessionStorage } from "../superadmin.server";

export const action = async ({ request }) => {
  const formData = await request.formData();
  const password = formData.get("password");
  
  const correctPassword = process.env.ADMIN_PASSWORD || "admin123";

  console.log("Login attempt:", { passwordLength: password?.length, correctLength: correctPassword?.length });

  if (password === correctPassword) {
    console.log("Password correct, setting session...");
    const session = await sessionStorage.getSession();
    session.set("adminId", "superadmin");
    return redirect("/superadmin", {
      headers: {
        "Set-Cookie": await sessionStorage.commitSession(session),
      },
    });
  }

  return { error: "Invalid password" };
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
            type="password" 
            name="password" 
            placeholder="Password" 
            className="efx-input" 
            required
            autoFocus
          />
          <button type="submit" className="efx-button efx-button-primary">
            Login
          </button>
        </Form>
      </div>
    </div>
  );
}
