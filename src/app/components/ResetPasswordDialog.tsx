import { useState } from "react";
import { Lock } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { toast } from "sonner";
import { formatClientErrorMessage } from "../../utils/errorMessages";

interface ResetPasswordDialogProps {
  isOpen: boolean;
  token: string;
  firebaseToken?: string;
  onClose: () => void;
}

export function ResetPasswordDialog({ isOpen, token, firebaseToken, onClose }: ResetPasswordDialogProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password || !confirmPassword) {
      toast.error(formatClientErrorMessage("Please fill in all fields"));
      return;
    }
    if (password.length < 6) {
      toast.error(formatClientErrorMessage("Password must be at least 6 characters"));
      return;
    }
    if (password !== confirmPassword) {
      toast.error(formatClientErrorMessage("Passwords do not match"));
      return;
    }

    try {
      setLoading(true);
      const apiBase = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

      let res: Response;
      if (firebaseToken) {
        // Firebase email-link flow — verify ID token on backend, update MongoDB password
        res = await fetch(`${apiBase}/auth/reset-password-firebase`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${firebaseToken}`,
          },
          body: JSON.stringify({ password }),
        });
      } else {
        // Legacy URL-token flow
        res = await fetch(`${apiBase}/auth/reset-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, password }),
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reset password");
      toast.success("Password reset successful! You can now log in.");
      setPassword("");
      setConfirmPassword("");
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to reset password";
      toast.error(formatClientErrorMessage(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Set New Password</DialogTitle>
          <DialogDescription>
            Choose a new password for your account.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reset-new-password">New Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="reset-new-password"
                type="password"
                placeholder="Minimum 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10"
                autoFocus
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reset-confirm-password">Confirm Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="reset-confirm-password"
                type="password"
                placeholder="Re-enter your new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Saving..." : "Reset Password"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
