import Link from "next/link";
import { peekAuthToken } from "@/lib/authTokens";
import { ResetPasswordForm } from "@/components/ResetPasswordForm";
import { getT } from "@/i18n/getDictionary";

export const metadata = { title: "Réinitialiser le mot de passe — Omniscient" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const { dict } = await getT();
  const valid = token ? await peekAuthToken(token, "password_reset") : null;

  return (
    <div className="mx-auto max-w-sm px-4 py-16 sm:py-24">
      <h1 className="text-2xl font-bold text-foreground mb-2">{dict.auth.resetPasswordTitle}</h1>
      {valid && token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-danger">{dict.auth.resetLinkInvalid}</p>
          <Link href="/forgot-password" className="text-sm text-accent">
            {dict.auth.forgotPasswordTitle}
          </Link>
        </div>
      )}
    </div>
  );
}
