import { useState } from "react";
import { CreditCard, Wallet, Loader2, Check } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { toast } from "sonner";
import { razorpayAPI, walletAPI } from "../../utils/api-mern";
import { formatClientErrorMessage } from "../../utils/errorMessages";

interface PaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  planName: string;
  onPaymentSuccess: () => void;
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

export function PaymentDialog({ isOpen, onClose, amount, planName, onPaymentSuccess }: PaymentDialogProps) {
  const [paymentMethod, setPaymentMethod] = useState<"razorpay" | "wallet">("razorpay");
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  const handleWalletPayment = async () => {
    try {
      setIsProcessing(true);
      const result = await walletAPI.addFunds(amount, 'wallet');
      
      if (result.success) {
        setPaymentSuccess(true);
        setTimeout(() => {
          onPaymentSuccess();
          onClose();
          setPaymentSuccess(false);
          toast.success(`${planName} activated successfully!`);
        }, 1500);
      }
    } catch (error) {
      toast.error(formatClientErrorMessage(error, 'Payment failed. Please try again.'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRazorpayPayment = async () => {
    try {
      setIsProcessing(true);

      // Get Razorpay key
      const keyResponse = await razorpayAPI.getKey();
      const razorpayKey = keyResponse.key;

      // Create order
      const orderResponse = await razorpayAPI.createWalletOrder(amount);
      const orderId = orderResponse.order.id;

      // Open Razorpay checkout
      const options = {
        key: razorpayKey,
        amount: amount * 100,
        currency: 'INR',
        name: 'NotesMitra',
        description: `Premium ${planName}`,
        order_id: orderId,
        handler: async (response: any) => {
          try {
            // Verify payment
            await razorpayAPI.verifyWalletPayment(
              response.razorpay_order_id,
              response.razorpay_payment_id,
              response.razorpay_signature
            );

            setPaymentSuccess(true);
            setTimeout(() => {
              onPaymentSuccess();
              onClose();
              setPaymentSuccess(false);
              toast.success(`${planName} activated successfully!`);
            }, 1500);
          } catch (error) {
            toast.error(formatClientErrorMessage(error, 'Payment verification failed. Please contact support.'));
          }
        },
        prefill: {
          name: '',
          email: '',
          contact: ''
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
    } catch (error) {
      toast.error(formatClientErrorMessage(error, 'Failed to initiate payment. Please try again.'));
    } finally {
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Complete Payment</DialogTitle>
          <DialogDescription>
            Pay ₹{amount} to activate {planName}
          </DialogDescription>
        </DialogHeader>

        {!paymentSuccess ? (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Plan:</span>
                <span className="font-semibold">{planName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Amount:</span>
                <span className="text-2xl font-bold text-blue-600">₹{amount}</span>
              </div>
            </div>

            <div className="space-y-3">
              <Label>Payment Method</Label>
              <RadioGroup value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as "razorpay" | "wallet")}>
                <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-gray-50">
                  <RadioGroupItem value="razorpay" id="razorpay" />
                  <Label htmlFor="razorpay" className="flex items-center gap-2 cursor-pointer flex-1">
                    <CreditCard className="w-4 h-4" />
                    <div>
                      <p className="font-medium">Razorpay</p>
                      <p className="text-xs text-muted-foreground">Credit/Debit Card, UPI, NetBanking</p>
                    </div>
                  </Label>
                </div>

                <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-gray-50">
                  <RadioGroupItem value="wallet" id="wallet" />
                  <Label htmlFor="wallet" className="flex items-center gap-2 cursor-pointer flex-1">
                    <Wallet className="w-4 h-4" />
                    <div>
                      <p className="font-medium">Wallet</p>
                      <p className="text-xs text-muted-foreground">Pay from your NotesMitra wallet</p>
                    </div>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="flex gap-2 pt-4">
              <Button variant="outline" className="flex-1" onClick={onClose} disabled={isProcessing}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handlePayment} disabled={isProcessing}>
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>Pay ₹{amount}</>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Payment Successful!</h3>
            <p className="text-muted-foreground">Your {planName} is now active</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
