import { useState } from "react";
import { Shield, Lock, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { toast } from "sonner";
import { authAPI, storeCsrfToken } from "../../utils/api-mern";
import { formatClientErrorMessage } from "../../utils/errorMessages";

interface AdminLoginDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (userData: any) => void;
}

export function AdminLoginDialog({ isOpen, onClose, onLogin }: AdminLoginDialogProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim() || !password.trim()) {
      toast.error(formatClientErrorMessage("Please enter email and password"));
      return;
    }

    setIsLoading(true);

    try {
      const response = await authAPI.adminSignIn(email, password);
      
      // Store CSRF token for subsequent state-changing requests
      if (response.csrfToken) storeCsrfToken(response.csrfToken);

      // Role verification is now done on backend, but keep this as safety check
      if (response.user.role !== 'admin') {
        toast.error(formatClientErrorMessage("You do not have admin privileges"));
        setIsLoading(false);
        return;
      }

      onLogin(response.user);
      onClose();
      setEmail("");
      setPassword("");
      toast.success("Admin login successful!");
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Login failed';
      toast.error(formatClientErrorMessage(errorMsg, 'Login failed'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            Admin Login
          </DialogTitle>
          <DialogDescription>
            Enter your admin credentials to access the admin panel
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="admin-email">Email Address</Label>
            <Input
              id="admin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              disabled={isLoading}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="admin-password">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="pl-10"
                disabled={isLoading}
                required
              />
            </div>
          </div>

          <div className="bg-amber-50 p-3 rounded-lg text-sm text-amber-800 border border-amber-200">
            <p className="font-semibold">Note:</p>
            <p>Use your registered admin account credentials. Contact the platform owner if you don't have admin access.</p>
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Logging in...
              </>
            ) : (
              "Login as Admin"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
