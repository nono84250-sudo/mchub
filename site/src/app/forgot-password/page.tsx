import { ForgotPasswordForm } from "@/components/ForgotPasswordForm";
import { getT } from "@/i18n/getDictionary";

export const metadata = { title: "Mot de passe oublié — Omniscient" };

export default async function ForgotPasswordPage() {
  const { dict } = await getT();

  return (
    <div className="mx-auto max-w-sm px-4 py-16 sm:py-24">
      <h1 className="text-2xl font-bold text-foreground mb-2">{dict.auth.forgotPasswordTitle}</h1>
      <ForgotPasswordForm />
    </div>
  );
}
