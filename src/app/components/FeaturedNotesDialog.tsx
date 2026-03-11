import { useState } from "react";
import { Star, Zap, TrendingUp } from "lucide-react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { toast } from "sonner";
import { formatClientErrorMessage } from "../../utils/errorMessages";

interface FeaturedNotesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  noteTitle: string;
  onFeature: (plan: "7days" | "30days") => void;
}

export function FeaturedNotesDialog({ isOpen, onClose, noteTitle, onFeature }: FeaturedNotesDialogProps) {
  const [selectedPlan, setSelectedPlan] = useState<"7days" | "30days" | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFeature = async () => {
    if (!selectedPlan) {
      toast.error(formatClientErrorMessage("Please select a featured plan"));
      return;
    }

    setIsProcessing(true);
    
    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    onFeature(selectedPlan);
    const days = selectedPlan === "7days" ? 7 : 30;
    const price = selectedPlan === "7days" ? 29 : 79;
    
    toast.success(`Note featured for ${days} days! Payment of ₹${price} processed.`);
    setIsProcessing(false);
    setSelectedPlan(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-600 fill-yellow-600" />
            Feature Your Note
          </DialogTitle>
          <DialogDescription>
            Boost visibility and sales by featuring: <strong>{noteTitle}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="font-medium mb-2 flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-600" />
              Featured Note Benefits:
            </h4>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <TrendingUp className="w-3 h-3" />
                Appear at the top of search results
              </li>
              <li className="flex items-center gap-2">
                <Star className="w-3 h-3 fill-yellow-600 text-yellow-600" />
                Display a "Featured Note" badge
              </li>
              <li className="flex items-center gap-2">
                <Zap className="w-3 h-3" />
                Get 3-5x more visibility and clicks
              </li>
            </ul>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* 7 Days Plan */}
            <Card 
              className={`cursor-pointer transition-all ${
                selectedPlan === "7days" 
                  ? "border-2 border-blue-500 bg-blue-50" 
                  : "hover:border-blue-300"
              }`}
              onClick={() => setSelectedPlan("7days")}
            >
              <CardContent className="pt-6 space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">Short Boost</Badge>
                  {selectedPlan === "7days" && (
                    <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                      <Star className="w-3 h-3 text-white fill-white" />
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-3xl font-bold">₹29</div>
                  <div className="text-sm text-muted-foreground">for 7 days</div>
                </div>
                <div className="space-y-1 text-sm">
                  <p className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-yellow-600" />
                    Featured badge for 7 days
                  </p>
                  <p className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-green-600" />
                    Top position in search
                  </p>
                  <p className="text-muted-foreground">
                    Perfect for quick sales boost
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* 30 Days Plan */}
            <Card 
              className={`cursor-pointer transition-all ${
                selectedPlan === "30days" 
                  ? "border-2 border-yellow-500 bg-yellow-50" 
                  : "hover:border-yellow-300"
              }`}
              onClick={() => setSelectedPlan("30days")}
            >
              <CardContent className="pt-6 space-y-3">
                <div className="flex items-center justify-between">
                  <Badge className="bg-yellow-600">Best Value</Badge>
                  {selectedPlan === "30days" && (
                    <div className="w-5 h-5 bg-yellow-600 rounded-full flex items-center justify-center">
                      <Star className="w-3 h-3 text-white fill-white" />
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-3xl font-bold">₹79</div>
                  <div className="text-sm text-muted-foreground">for 30 days</div>
                  <div className="text-xs text-green-600 font-medium">Save 36%!</div>
                </div>
                <div className="space-y-1 text-sm">
                  <p className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-yellow-600 fill-yellow-600" />
                    Featured badge for 30 days
                  </p>
                  <p className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-green-600" />
                    Top position in search
                  </p>
                  <p className="text-muted-foreground">
                    Maximum exposure & sales
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={onClose}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button 
              className="flex-1"
              onClick={handleFeature}
              disabled={!selectedPlan || isProcessing}
            >
              {isProcessing ? (
                "Processing..."
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  Feature Note - ₹{selectedPlan === "7days" ? "29" : selectedPlan === "30days" ? "79" : "0"}
                </>
              )}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Payment processed securely via Razorpay. Featured status activates immediately.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
