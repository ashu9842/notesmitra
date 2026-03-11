import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Wallet, CreditCard, Loader2, CheckCircle2, Crown } from "lucide-react";
import { toast } from "sonner";
import { razorpayAPI } from "../../utils/api-mern";
import { formatClientErrorMessage } from "../../utils/errorMessages";

interface PremiumPaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  planType: "seller" | "buyer" | "combo";
  amount: number;
  walletBalance?: number;
  onPayment: (paymentId: string, method: "wallet" | "razorpay") => void;
  showWalletOption?: boolean;
  userName?: string;
  userEmail?: string;
  userPhone?: string;
  onSavePhone?: (phone: string) => Promise<void>;
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

export function PremiumPaymentDialog({
  isOpen,
  onClose,
  planType,
  amount,
  walletBalance = 0,
  onPayment,
  showWalletOption = false,
  userName,
  userEmail,
  userPhone,
  onSavePhone,
}: PremiumPaymentDialogProps) {
  const [paymentMethod, setPaymentMethod] = useState<"wallet" | "razorpay">(
    showWalletOption && walletBalance >= amount ? "wallet" : "razorpay"
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [localPhone, setLocalPhone] = useState(userPhone || '');

  useEffect(() => {
    if (isOpen) setLocalPhone(userPhone || '');
  }, [isOpen, userPhone]);

  const handleWalletPayment = async () => {
    if (walletBalance < amount) {
      toast.error(formatClientErrorMessage("Insufficient wallet balance"));
      return;
    }

    try {
      setIsProcessing(true);

      if (localPhone && localPhone !== userPhone) {
        onSavePhone?.(localPhone).catch(() => {});
      }

      // Wallet deduction is handled server-side in activateSubscription
      const transactionId = `wallet_${Date.now()}`;
      setIsSuccess(true);
      setTimeout(() => {
        onPayment(transactionId, 'wallet');
        setTimeout(() => {
          setIsSuccess(false);
          setPaymentMethod(showWalletOption && walletBalance >= amount ? "wallet" : "razorpay");
          onClose();
        }, 500);
      }, 1500);
    } catch (error) {
      toast.error(formatClientErrorMessage(error, 'Payment failed. Please try again.'));
      setIsProcessing(false);
    }
  };

  const handleRazorpayPayment = async () => {
    try {
      setIsProcessing(true);

      // Get Razorpay key
      const keyResponse = await razorpayAPI.getKey();
      const razorpayKey = keyResponse.key;

      // Create premium order (does NOT credit user wallet)
      const orderResponse = await razorpayAPI.createPremiumOrder(amount);
      const orderId = orderResponse.order.id;

      // Open Razorpay checkout
      const options = {
        key: razorpayKey,
        amount: amount * 100,
        currency: 'INR',
        name: 'NotesMitra',
        description: `${planType === 'seller' ? 'Seller Premium' : planType === 'buyer' ? 'Buyer Premium' : 'Combo Pack'} Plan`,
        order_id: orderId,
        handler: async (response: any) => {
          try {
            // Verify premium payment (signature check only, does NOT credit wallet)
            await razorpayAPI.verifyPremiumPayment(
              orderId,
              response.razorpay_payment_id,
              response.razorpay_signature
            );

            if (localPhone && localPhone !== userPhone) {
              onSavePhone?.(localPhone).catch(() => {});
            }

            setIsSuccess(true);
            setTimeout(() => {
              onPayment(response.razorpay_payment_id, 'razorpay');
              setTimeout(() => {
                setIsSuccess(false);
                setPaymentMethod(showWalletOption && walletBalance >= amount ? "wallet" : "razorpay");
                onClose();
              }, 500);
            }, 1500);
          } catch (error) {
            toast.error(formatClientErrorMessage('Payment verification failed. Please contact support.'));
            setIsProcessing(false);
          }
        },
        prefill: {
          name: userName || '',
          email: userEmail || '',
          contact: localPhone || ''
        },
        theme: {
          color: '#3B82F6'
        }
      };

      if (!window.Razorpay) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://checkout.razorpay.com/v1/checkout.js';
          s.onload = () => resolve();
          s.onerror = () => reject(new Error('Failed to load payment SDK'));
          document.head.appendChild(s);
        });
      }

      const razorpay = new window.Razorpay(options);
      razorpay.open();
      setIsProcessing(false);
    } catch (error) {
      toast.error(formatClientErrorMessage(error, 'Failed to initiate payment. Please try again.'));
      setIsProcessing(false);
    }
  };

  const handlePayment = () => {
    if (paymentMethod === 'wallet') {
      handleWalletPayment();
    } else {
      handleRazorpayPayment();
    }
  };

  const planName = planType === "seller" ? "Seller Premium" : planType === "buyer" ? "Buyer Premium" : "Combo Pack";
  const sufficientWalletBalance = walletBalance >= amount;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        {isSuccess ? (
          <div className="py-8 text-center">
            <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto mb-4" />
            <h3 className="text-2xl font-bold mb-2">Payment Successful!</h3>
            <p className="text-muted-foreground mb-4">
              {planName} activated successfully
            </p>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-yellow-600" />
                Upgrade to {planName}
              </DialogTitle>
              <DialogDescription>
                Complete your payment to activate {planName}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Plan Summary */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{planName}</p>
                    <p className="text-sm text-muted-foreground">1 Month Subscription</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-blue-600">₹{amount}</p>
                  </div>
                </div>
              </div>

              {/* Payment Method Selection */}
              <div className="space-y-4">
                <Label>Select Payment Method</Label>
                <RadioGroup value={paymentMethod} onValueChange={(value: any) => setPaymentMethod(value)}>
                  {/* Wallet Option (only with sufficient balance) */}
                  {showWalletOption && (
                    <div className={`flex items-center space-x-2 p-4 rounded-lg border-2 cursor-pointer ${
                      paymentMethod === "wallet" ? "border-blue-600 bg-blue-50" : "border-gray-200"
                    } ${!sufficientWalletBalance ? "opacity-50 cursor-not-allowed" : ""}`}>
                      <RadioGroupItem value="wallet" id="wallet" disabled={!sufficientWalletBalance} />
                      <Label htmlFor="wallet" className="flex-1 cursor-pointer">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Wallet className="w-5 h-5 text-blue-600" />
                            <div>
                              <p className="font-medium">Wallet Payment</p>
                              <p className="text-xs text-muted-foreground">
                                Balance: ₹{walletBalance.toFixed(2)}
                              </p>
                            </div>
                          </div>
                          {sufficientWalletBalance && (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                              Recommended
                            </span>
                          )}
                        </div>
                      </Label>
                    </div>
                  )}

                  {/* Razorpay Option */}
                  <div className={`flex items-center space-x-2 p-4 rounded-lg border-2 cursor-pointer ${
                    paymentMethod === "razorpay" ? "border-purple-600 bg-purple-50" : "border-gray-200"
                  }`}>
                    <RadioGroupItem value="razorpay" id="razorpay" />
                    <Label htmlFor="razorpay" className="flex-1 cursor-pointer">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-purple-600" />
                        <div>
                          <p className="font-medium">Card Payment</p>
                          <p className="text-xs text-muted-foreground">
                            Debit/Credit Card, UPI via Razorpay
                          </p>
                        </div>
                      </div>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Wallet Insufficient Balance Message */}
              {showWalletOption && !sufficientWalletBalance && paymentMethod === "wallet" && (
                <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    ⚠ Insufficient wallet balance. Please select card payment or add funds to wallet.
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={onClose}
                  disabled={isProcessing}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                  onClick={handlePayment}
                  disabled={isProcessing || (paymentMethod === "wallet" && !sufficientWalletBalance)}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    `Pay ₹${amount}`
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
