import { Button } from "@/components/ui/button";
import { useAuthContext } from "@/context/AuthProvider";

export function AuthButton() {
  const { isAuthenticated, loginWithGoogle, logout, isLogoutPending } = useAuthContext();

  if (isAuthenticated) {
    return (
      <Button
        variant="outline"
        onClick={() => logout()}
        disabled={isLogoutPending}
        className="border-oracle-accent text-oracle-accent hover:bg-oracle-accent hover:text-white"
      >
        {isLogoutPending ? "Logging out..." : "Logout"}
      </Button>
    );
  }

  return (
    <Button
      onClick={loginWithGoogle}
      className="bg-oracle-accent hover:bg-oracle-accent/90 text-white"
    >
      Login / Sign Up with Google
    </Button>
  );
}
