import { Crown, Check, Star, Zap, TrendingUp, Eye, Upload, BarChart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

interface SellerPremiumPlansProps {
  isPremium: boolean;
  isExpired?: boolean;
  expiryDate?: string;
  onUpgrade: () => void;
  onComboUpgrade?: () => void;
  walletBalance?: number;
  onFeatureNote?: (noteId: string, plan: "7days" | "30days") => void;
  isLoggedIn?: boolean;
  showCurrentPlan?: boolean;
  hasComboActive?: boolean;
}

export function SellerPremiumPlans({ isPremium, isExpired = false, expiryDate, onUpgrade, onComboUpgrade, walletBalance, onFeatureNote, isLoggedIn, showCurrentPlan = true, hasComboActive = false }: SellerPremiumPlansProps) {
  // Check if ONLY seller premium is active (not combo)
  const isSellerOnlyActive = isPremium && !hasComboActive && !isExpired;
  
  return (
    <div className="space-y-6 px-2 sm:px-0">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold">Seller Premium Plans</h2>
        <p className="text-lg text-muted-foreground">
          Boost your sales and reach more students
        </p>
      </div>

      <div className="overflow-x-auto">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto min-w-0">
        {/* Free Seller Plan */}
        <Card className={`transition-all border-2 ${
          !isPremium && showCurrentPlan
            ? "border-blue-300 dark:border-blue-700/60 bg-blue-50 dark:bg-blue-950/30"
            : isPremium && showCurrentPlan
            ? "border-border bg-muted/20 opacity-60"
            : "border-border hover:border-indigo-300 dark:hover:border-indigo-700/60 hover:shadow-md cursor-pointer"
        }`}>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between mb-2">
              <CardTitle className="text-2xl">Free Seller</CardTitle>
              {!isPremium && showCurrentPlan && (
                <Badge className="bg-blue-600">Current Plan</Badge>
              )}
              {isPremium && showCurrentPlan && (
                <Badge variant="outline" className="text-muted-foreground border-muted-foreground/40">Upgraded</Badge>
              )}
            </div>
            <div>
              <span className="text-4xl font-bold">₹0</span>
              <span className="text-muted-foreground">/month</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
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
              <div className="flex items-start gap-2">
                <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                <span className="text-sm">Basic dashboard</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Premium Seller Plan */}
        <Card className={`transition-all border-2 relative overflow-hidden ${
          isSellerOnlyActive && showCurrentPlan
            ? "border-yellow-500 dark:border-yellow-600/60 bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-950/30 dark:to-orange-950/20"
            : hasComboActive && showCurrentPlan && !isExpired
            ? "border-green-400 dark:border-green-700/60 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 opacity-80"
            : isPremium && isExpired && showCurrentPlan
            ? "border-gray-300 dark:border-gray-700/60 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950/30 dark:to-gray-900/20 opacity-70"
            : "border-blue-500 dark:border-blue-600/70 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-xl cursor-pointer"
        }`}>
          {!showCurrentPlan && (
            <div className="absolute top-0 right-0 bg-blue-500 text-white px-6 py-1 text-xs font-bold transform rotate-12 translate-x-6 -translate-y-1">
              POPULAR
            </div>
          )}
          {isSellerOnlyActive && showCurrentPlan && (
            <div className="absolute top-0 right-0 bg-yellow-500 text-white px-6 py-1 text-xs font-bold transform rotate-12 translate-x-6 -translate-y-1">
              ACTIVE
            </div>
          )}
          {hasComboActive && showCurrentPlan && !isExpired && (
            <div className="absolute top-0 right-0 bg-green-600 text-white px-4 py-1 text-xs font-bold transform rotate-12 translate-x-6 -translate-y-1">
              IN COMBO
            </div>
          )}
          {isPremium && isExpired && showCurrentPlan && (
            <div className="absolute top-0 right-0 bg-gray-500 text-white px-3 py-1 text-xs font-bold transform rotate-12 translate-x-6 -translate-y-1">
              EXPIRED
            </div>
          )}
          

          <CardHeader className="pb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Crown className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                <CardTitle className="text-2xl">Premium Seller</CardTitle>
              </div>
              {isSellerOnlyActive && showCurrentPlan && (
                <Badge className="bg-yellow-600">Active</Badge>
              )}
              {hasComboActive && showCurrentPlan && !isExpired && (
                <Badge className="bg-green-600">In Combo</Badge>
              )}
              {isPremium && isExpired && showCurrentPlan && (
                <Badge className="bg-gray-500">Expired</Badge>
              )}
            </div>
            <div>
              <span className="text-4xl font-bold text-blue-600 dark:text-blue-400">₹99</span>
              <span className="text-muted-foreground">/month</span>
            </div>
            {isPremium && isExpired && expiryDate && (
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                Expired on {new Date(expiryDate).toLocaleDateString()}
              </p>
            )}
            {isSellerOnlyActive && expiryDate && (
              <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                Valid until {new Date(expiryDate).toLocaleDateString()}
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <Star className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 fill-blue-600 dark:fill-blue-400 flex-shrink-0" />
                <span className="text-sm font-medium">Unlimited note uploads</span>
              </div>
              <div className="flex items-start gap-2">
                <Zap className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <span className="text-sm font-medium">Priority approval (24 hours)</span>
              </div>
              <div className="flex items-start gap-2">
                <Eye className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <span className="text-sm font-medium">Featured visibility boost</span>
              </div>
              <div className="flex items-start gap-2">
                <BarChart className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <span className="text-sm font-medium">Advanced sales analytics</span>
              </div>
              <div className="flex items-start gap-2">
                <Crown className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <span className="text-sm font-medium">Premium seller badge</span>
              </div>
              <div className="flex items-start gap-2">
                <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <span className="text-sm font-medium">Increased discoverability</span>
              </div>
            </div>

            {showCurrentPlan ? (
              isSellerOnlyActive ? (
                <Button className="w-full bg-yellow-600 hover:bg-yellow-700 font-semibold h-12" disabled>
                  <Check className="w-5 h-5 mr-2" />
                  Premium Active
                </Button>
              ) : hasComboActive ? (
                <Button className="w-full bg-green-600 hover:bg-green-700 font-semibold h-12" disabled>
                  <Check className="w-5 h-5 mr-2" />
                  Included in Combo
                </Button>
              ) : (
                <Button 
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold h-12" 
                  onClick={onUpgrade}
                >
                  <Crown className="w-5 h-5 mr-2" />
                  Upgrade to Premium
                </Button>
              )
            ) : (
              <Button 
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold h-12" 
                onClick={onUpgrade}
              >
                <Crown className="w-5 h-5 mr-2" />
                Get Premium Seller
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Combo Pack - Seller + Buyer */}
        <Card className={`transition-all border-2 relative overflow-hidden hover:shadow-2xl cursor-pointer ${
          hasComboActive && showCurrentPlan
            ? "border-yellow-500 dark:border-yellow-600/60 bg-gradient-to-br from-yellow-50 via-orange-50 to-pink-50 dark:from-yellow-950/30 dark:via-orange-950/20 dark:to-pink-950/20"
            : "border-purple-400 dark:border-purple-700/60 bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-blue-950/30 dark:via-purple-950/30 dark:to-pink-950/20"
        }`}>
          {hasComboActive && showCurrentPlan ? (
            <div className="absolute top-0 right-0 bg-yellow-500 text-white px-6 py-1 text-xs font-bold transform rotate-12 translate-x-6 -translate-y-1">
              ACTIVE
            </div>
          ) : (
            <div className="absolute top-0 right-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-1 text-xs font-bold transform rotate-12 translate-x-6 -translate-y-1">
              BEST VALUE
            </div>
          )}

          <CardHeader className="pb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Crown className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                  <Star className="w-3 h-3 text-yellow-500 fill-yellow-500 absolute -top-1 -right-1" />
                </div>
                <CardTitle className="text-xl">Combo Pack</CardTitle>
              </div>
              {hasComboActive && showCurrentPlan && (
                <Badge className="bg-yellow-600">Active</Badge>
              )}
            </div>
            <div className="space-y-1">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-purple-600 dark:text-purple-400">₹149</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm line-through text-gray-400">₹198</span>
                <Badge className="bg-green-600 text-xs">Save ₹49</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 p-3 rounded-lg border border-purple-200 dark:border-purple-800/50 mb-3">
              <p className="text-xs font-bold text-purple-900 dark:text-purple-200 text-center">
                🎉 Seller Premium + Buyer Premium Combined!
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-blue-900 dark:text-blue-300">✨ All Seller Premium Features:</p>
              <div className="space-y-1.5 pl-3">
                <div className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                  <span className="text-xs">Unlimited uploads</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                  <span className="text-xs">Priority 24hr approval</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                  <span className="text-xs">Featured visibility</span>
                </div>
              </div>

              <p className="text-xs font-semibold text-purple-900 dark:text-purple-300 pt-2">✨ All Buyer Premium Features:</p>
              <div className="space-y-1.5 pl-3">
                <div className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                  <span className="text-xs">Zero payment fees</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                  <span className="text-xs">5-10% discounts</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                  <span className="text-xs">Early access to notes</span>
                </div>
              </div>
            </div>

            <Button 
              className="w-full bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 text-white font-semibold h-12" 
              onClick={onComboUpgrade}
              disabled={hasComboActive && showCurrentPlan}
            >
              {hasComboActive && showCurrentPlan ? (
                <>
                  <Check className="w-5 h-5 mr-2" />
                  Combo Active
                </>
              ) : (
                <>
                  <Crown className="w-5 h-5 mr-2" />
                  Get Combo Pack
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
      </div>

      {/* Value Comparison */}
      {showCurrentPlan && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/40 dark:to-purple-950/40 border border-blue-200 dark:border-blue-800/50 rounded-xl p-6 max-w-6xl mx-auto mt-6">
          <div className="text-center space-y-3">
            <h3 className="text-xl font-bold text-blue-900 dark:text-blue-200">💡 Why Choose Combo Pack?</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="bg-white dark:bg-card p-3 rounded-lg">
                <p className="font-semibold text-green-600 dark:text-green-400">Save ₹49/month</p>
                <p className="text-xs text-muted-foreground">₹588 savings annually</p>
              </div>
              <div className="bg-white dark:bg-card p-3 rounded-lg">
                <p className="font-semibold text-blue-600 dark:text-blue-400">Sell & Buy Both</p>
                <p className="text-xs text-muted-foreground">Perfect for active students</p>
              </div>
              <div className="bg-white dark:bg-card p-3 rounded-lg">
                <p className="font-semibold text-purple-600 dark:text-purple-400">All Features</p>
                <p className="text-xs text-muted-foreground">Complete premium experience</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}