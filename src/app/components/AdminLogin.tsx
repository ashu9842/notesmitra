import { useState } from "react";
import { Shield, Lock, User, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { toast } from "sonner";
import { authAPI } from "../../utils/api-mern";
import { formatClientErrorMessage } from "../../utils/errorMessages";

interface AdminLoginProps {
  onLogin: (userData: any) => void;
}

export function AdminLogin({ onLogin }: AdminLoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim() || !password.trim()) {
      toast.error(formatClientErrorMessage("Please enter both email and password"));
      return;
    }

    setIsLoading(true);

    try {
      const response = await authAPI.adminSignIn(email, password);
      
      // Role verification is now done on backend, but keep this as safety check
      if (response.user.role !== 'admin') {
        toast.error(formatClientErrorMessage("You do not have admin privileges"));
        setIsLoading(false);
        return;
      }

      toast.success("Welcome, Admin!");
      onLogin(response.user);
      
      // Clear form
      setEmail("");
      setPassword("");
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Login failed. Please check your credentials.';
      toast.error(formatClientErrorMessage(errorMsg, 'Login failed. Please check your credentials.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <Shield className="w-8 h-8 text-blue-600" />
            </div>
          </div>
          <CardTitle className="text-center">Admin Login</CardTitle>
          <p className="text-sm text-center text-muted-foreground mt-2">
            Please login with your admin credentials
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@notesmitra.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  disabled={isLoading}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  disabled={isLoading}
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Logging in...
                </>
              ) : (
                "Login"
              )}
            </Button>
          </form>

          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded">
            <p className="text-xs font-semibold text-blue-900 mb-2">Important:</p>
            <p className="text-xs text-blue-800">
              Use your registered email and password. Your account must have admin role to access the admin panel.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
