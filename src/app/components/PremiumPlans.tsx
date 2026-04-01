import { Crown, Check, Star, Zap, TrendingUp, Tag, Bookmark, Shield, Upload, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

interface PremiumPlansProps {
  isPremium: boolean;
  onUpgrade: () => void;
  isLoggedIn?: boolean;
  onLoginRequired?: () => void;
}

export function PremiumPlans({ isPremium, onUpgrade, isLoggedIn, onLoginRequired }: PremiumPlansProps) {
  const handleUpgrade = () => {
    if (!isLoggedIn && onLoginRequired) {
      onLoginRequired();
      return;
    }
    onUpgrade();
  };

  return (
    <div className="space-y-6 px-2 sm:px-0">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold">Premium Membership</h2>
        <p className="text-lg text-muted-foreground">
          Unlock the full potential - Buy AND Sell with exclusive benefits
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
        {/* Free Plan */}
        <Card className={`transition-all cursor-pointer border-2 ${
          !isPremium 
            ? "border-gray-300 bg-white" 
            : "border-gray-200 hover:border-gray-300 hover:shadow-md"
        }`}>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between mb-2">
              <CardTitle className="text-2xl">Free User</CardTitle>
              {!isPremium && <Badge className="bg-gray-600">Current Plan</Badge>}
            </div>
            <div>
              <span className="text-4xl font-bold">₹0</span>
              <span className="text-muted-foreground">/month</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <p className="font-semibold text-sm text-blue-600">As Seller:</p>
              <div className="space-y-2 ml-2">
                <div className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Upload up to 5 notes/month</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Standard approval (3-5 days)</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Earn 80% on each sale</span>
                </div>
              </div>

              <p className="font-semibold text-sm text-purple-600 mt-4">As Buyer:</p>
              <div className="space-y-2 ml-2">
                <div className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Access to all notes</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">7-page preview</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Pay 2% payment gateway fee</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Up to 10 bookmarks</span>
                </div>
              </div>
            </div>
            {!isPremium && (
              <Button className="w-full bg-gray-600 hover:bg-gray-700" disabled>
                Current Plan
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Premium Plan */}
        <Card className={`transition-all cursor-pointer border-2 relative overflow-hidden ${
          isPremium 
            ? "border-yellow-500 bg-gradient-to-br from-yellow-50 to-orange-50" 
            : "border-yellow-500 hover:border-yellow-400 hover:shadow-xl"
        }`}>
          {/* Premium Badge Corner */}
          <div className="absolute top-0 right-0 bg-yellow-500 text-white px-6 py-1 text-xs font-bold transform rotate-12 translate-x-6 -translate-y-1">
            BEST VALUE
          </div>

          <CardHeader className="pb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Crown className="w-6 h-6 text-yellow-600" />
                <CardTitle className="text-2xl">Premium User</CardTitle>
              </div>
              {isPremium && <Badge className="bg-yellow-600">Active</Badge>}
            </div>
            <div>
              <span className="text-4xl font-bold text-yellow-600">₹149</span>
              <span className="text-muted-foreground">/month</span>
            </div>
            <p className="text-sm text-yellow-700 font-medium mt-1">
              ✨ Save ₹49/month vs buying seller + buyer separately!
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="font-semibold text-sm text-blue-700 mb-2 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Seller Benefits:
                </p>
                <div className="space-y-2 ml-2">
                  <div className="flex items-start gap-2">
                    <Star className="w-5 h-5 text-yellow-600 mt-0.5 fill-yellow-600 flex-shrink-0" />
                    <span className="text-sm font-medium">Unlimited uploads</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Zap className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm font-medium">Priority approval (24 hours)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Eye className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm font-medium">Featured visibility on marketplace</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <TrendingUp className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm font-medium">Advanced sales analytics</span>
                  </div>
                </div>
              </div>

              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                <p className="font-semibold text-sm text-purple-700 mb-2 flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Buyer Benefits:
                </p>
                <div className="space-y-2 ml-2">
                  <div className="flex items-start gap-2">
                    <Star className="w-5 h-5 text-purple-600 mt-0.5 fill-purple-600 flex-shrink-0" />
                    <span className="text-sm font-medium">Zero payment fee (save 2%!)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Zap className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm font-medium">24-hour early access to new notes</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Tag className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm font-medium">5-10% exclusive discounts</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Bookmark className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm font-medium">Unlimited bookmarks</span>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-yellow-100 to-orange-100 border border-yellow-300 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <Crown className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm font-medium">Premium badge on profile</span>
                </div>
              </div>
            </div>

            {!isPremium ? (
              <Button 
                className="w-full bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 text-white font-semibold text-base h-12" 
                onClick={handleUpgrade}
              >
                <Crown className="w-5 h-5 mr-2" />
                Upgrade to Premium Now
              </Button>
            ) : (
              <Button className="w-full bg-yellow-600 hover:bg-yellow-700 font-semibold text-base h-12" disabled>
                <Check className="w-5 h-5 mr-2" />
                Premium Active
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Value Proposition */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-6 max-w-5xl mx-auto mt-6">
        <div className="text-center space-y-3">
          <h3 className="text-xl font-bold text-blue-900">💡 Smart Investment for Active Users</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <p className="font-semibold text-blue-600 mb-1">For Sellers</p>
              <p className="text-muted-foreground">Upload just 2-3 notes and the unlimited uploads + visibility boost pays for itself!</p>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <p className="font-semibold text-purple-600 mb-1">For Buyers</p>
              <p className="text-muted-foreground">Buy 2-3 notes monthly? Save more than ₹149 with fee waiver + discounts!</p>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <p className="font-semibold text-yellow-600 mb-1">Best for Both</p>
              <p className="text-muted-foreground">Do both? Premium is a no-brainer - double the benefits, one low price!</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
