import LoginForm from "@/components/LoginForm";
import { getTenant } from "@/lib/tenant";

export default async function LoginPage() {
  const tenant = await getTenant();

  return <LoginForm tenantName={tenant.name} tenantLogoUrl={tenant.logo_url} />;
}
