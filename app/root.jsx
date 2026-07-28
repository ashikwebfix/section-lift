import { Links, Meta, Outlet, Scripts, ScrollRestoration, useRouteError, isRouteErrorResponse } from "react-router";
import appStylesHref from "./app.css?url";

export const links = () => [
  { rel: "stylesheet", href: appStylesHref },
];

export default function App() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <link rel="preconnect" href="https://cdn.shopify.com/" />
        <link
          rel="stylesheet"
          href="https://cdn.shopify.com/static/fonts/inter/v4/styles.css"
        />
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

// ErrorBoundary ensures thrown Responses (e.g., 401 from webhook HMAC validation)
// are returned with the correct HTTP status code instead of being rendered as 200 HTML pages.
export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return (
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <title>{error.status}</title>
        </head>
        <body>
          <p>{error.status} {error.statusText}</p>
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>Error</title>
      </head>
      <body>
        <p>An unexpected error occurred.</p>
      </body>
    </html>
  );
}

export const headers = (headersArgs) => {
  // Preserve headers from thrown Responses (important for webhook error responses)
  if (headersArgs.errorHeaders) {
    return headersArgs.errorHeaders;
  }
  return headersArgs.loaderHeaders;
};
