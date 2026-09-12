"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SpinnerIcon } from "@/components/ui/Icons";
import { useAuth } from "@/lib/auth-context";

/** "You" in the nav — resolves to the signed-in handle so profile URLs stay
 * shareable rather than having a second private route for the same page. */
export default function MyProfileRedirect() {
  const router = useRouter();
  const { me, loading } = useAuth();

  useEffect(() => {
    if (!loading && me) router.replace(`/profile/${me.user.handle}`);
  }, [loading, me, router]);

  return (
    <div className="flex flex-1 items-center justify-center">
      <SpinnerIcon className="text-faint" />
    </div>
  );
}
