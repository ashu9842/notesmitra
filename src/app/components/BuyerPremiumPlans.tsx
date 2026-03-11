import { Crown, Check, Star, Zap, Tag, Bookmark, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

interface BuyerPremiumPlansProps {
  isPremium: boolean;
  expiryDate?: string;
  onUpgrade: () => void;
  onComboUpgrade?: () => void;
  isLoggedIn?: boolean;
  showCurrentPlan?: boolean;
  hasComboActive?: boolean;
}

export function BuyerPremiumPlans({ isPremium, expiryDate, onUpgrade, onComboUpgrade, isLoggedIn, showCurrentPlan = true, hasComboActive = false }: BuyerPremiumPlansProps) {
  // Check if ONLY buyer premium is active (not combo)
  const isBuyerOnlyActive = isPremium && !hasComboActive;
  
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold">Buyer Premium Plans</h2>
        <p className="text-lg text-muted-foreground">
          Save money and get exclusive benefits
        </p>
      </div>

      <div className="overflow-x-auto">
      <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto min-w-0">
        {/* Free Buyer Plan */}
        <Card className={`transition-all border-2 ${
          !isPremium && showCurrentPlan
            ? "border-purple-300 dark:border-purple-700/60 bg-purple-50 dark:bg-purple-950/30"
            : isPremium && showCurrentPlan
            ? "border-border bg-muted/20 opacity-60"
            : "border-border hover:border-violet-300 dark:hover:border-violet-700/60 hover:shadow-md cursor-pointer"
        }`}>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between mb-2">
              <CardTitle className="text-2xl">Free Buyer</CardTitle>
              {!isPremium && showCurrentPlan && (
                <Badge className="bg-purple-600">Current Plan</Badge>
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
                <span className="text-sm">Access to all notes</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                <span className="text-sm">7-page preview before purchase</span>
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
          </CardContent>
        </Card>

        {/* Premium Buyer Plan */}
        <Card className={`transition-all border-2 relative overflow-hidden ${
          isBuyerOnlyActive && showCurrentPlan
            ? "border-yellow-500 dark:border-yellow-600/60 bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-950/30 dark:to-orange-950/20"
            : hasComboActive && showCurrentPlan
            ? "border-green-400 dark:border-green-700/60 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 opacity-80"
            : "border-purple-500 dark:border-purple-600/70 hover:border-purple-400 dark:hover:border-purple-500 hover:shadow-xl cursor-pointer"
        }`}>
          {!showCurrentPlan && (
            <div className="absolute top-0 right-0 bg-purple-500 text-white px-6 py-1 text-xs font-bold transform rotate-12 translate-x-6 -translate-y-1">
              SAVE MORE
            </div>
          )}
          {isBuyerOnlyActive && showCurrentPlan && (
            <div className="absolute top-0 right-0 bg-yellow-500 text-white px-6 py-1 text-xs font-bold transform rotate-12 translate-x-6 -translate-y-1">
              ACTIVE
            </div>
          )}
          {hasComboActive && showCurrentPlan && (
            <div className="absolute top-0 right-0 bg-green-600 text-white px-4 py-1 text-xs font-bold transform rotate-12 translate-x-6 -translate-y-1">
              IN COMBO
            </div>
          )}

          <CardHeader className="pb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Crown className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                <CardTitle className="text-2xl">Premium Buyer</CardTitle>
              </div>
              {isBuyerOnlyActive && showCurrentPlan && (
                <Badge className="bg-yellow-600">Active</Badge>
              )}
              {hasComboActive && showCurrentPlan && (
                <Badge className="bg-green-600">In Combo</Badge>
              )}
            </div>
            <div>
              <span className="text-4xl font-bold text-purple-600">₹99</span>
              <span className="text-muted-foreground">/month</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <Star className="w-5 h-5 text-purple-600 dark:text-purple-400 mt-0.5 fill-purple-600 dark:fill-purple-400 flex-shrink-0" />
                <span className="text-sm font-medium">Zero payment gateway fee (save 2%!)</span>
              </div>
              <div className="flex items-start gap-2">
                <Zap className="w-5 h-5 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                <span className="text-sm font-medium">24-hour early access to new notes</span>
              </div>
              <div className="flex items-start gap-2">
                <Tag className="w-5 h-5 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                <span className="text-sm font-medium">5-10% exclusive discounts on all purchases</span>
              </div>
              <div className="flex items-start gap-2">
                <Bookmark className="w-5 h-5 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                <span className="text-sm font-medium">Unlimited bookmarks</span>
              </div>
              <div className="flex items-start gap-2">
                <Crown className="w-5 h-5 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                <span className="text-sm font-medium">Premium buyer badge</span>
              </div>
              <div className="flex items-start gap-2">
                <Shield className="w-5 h-5 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                <span className="text-sm font-medium">Priority customer support</span>
              </div>
            </div>

            {showCurrentPlan ? (
              isBuyerOnlyActive ? (
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
                  className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-semibold h-12" 
                  onClick={onUpgrade}
                >
                  <Crown className="w-5 h-5 mr-2" />
                  Upgrade to Premium
                </Button>
              )
            ) : (
              <Button 
                className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-semibold h-12" 
                onClick={onUpgrade}
              >
                <Crown className="w-5 h-5 mr-2" />
                Get Premium Buyer
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
                🎉 Buyer Premium + Seller Premium Combined!
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-purple-900 dark:text-purple-300">✨ All Buyer Premium Features:</p>
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

              <p className="text-xs font-semibold text-blue-900 dark:text-blue-300 pt-2">✨ All Seller Premium Features:</p>
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
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/40 dark:to-pink-950/30 border border-purple-200 dark:border-purple-800/50 rounded-xl p-6 max-w-6xl mx-auto">
          <div className="text-center space-y-3">
            <h3 className="text-xl font-bold text-purple-900 dark:text-purple-200">💡 Why Choose Combo Pack?</h3>
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div className="bg-white dark:bg-card p-3 rounded-lg">
                <p className="font-semibold text-green-600 dark:text-green-400">Save ₹49/month</p>
                <p className="text-xs text-muted-foreground">₹588 savings annually</p>
              </div>
              <div className="bg-white dark:bg-card p-3 rounded-lg">
                <p className="font-semibold text-purple-600 dark:text-purple-400">Buy & Sell Both</p>
                <p className="text-xs text-muted-foreground">Perfect for active students</p>
              </div>
              <div className="bg-white dark:bg-card p-3 rounded-lg">
                <p className="font-semibold text-blue-600 dark:text-blue-400">All Features</p>
                <p className="text-xs text-muted-foreground">Complete premium experience</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}