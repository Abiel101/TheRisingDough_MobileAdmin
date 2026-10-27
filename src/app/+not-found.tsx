import { Redirect } from "expo-router";

import { useAuth } from "@/auth/auth-context";

// "/" is guarded away once signed in, so send any unmatched route to the right home screen.
export default function NotFound() {
  const { session } = useAuth();
  return <Redirect href={session ? "/calendar" : "/"} />;
}
