import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <s-app-nav>
        <s-link href="/app">Dashboard</s-link>
        <s-link href="/app/discover">Sections</s-link>
        <s-link href="/app/pages">Pages</s-link>
        <s-link href="/app/my-sections">Library</s-link>
        <s-link href="/app/history">Installations</s-link>
        <s-link href="/app/ab-testing">A/B Testing</s-link>
        <s-link href="/app/pricing">Pricing</s-link>
        <s-link href="/app/support">Support</s-link>
      </s-app-nav>
      <div className="sl-page-full">
        <Outlet />
      </div>
    </AppProvider>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
